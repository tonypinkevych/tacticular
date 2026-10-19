import { type AbilityId, power } from "../combat/abilities"
import { canReach } from "../combat/combat"
import { AROUND, adjacent, distance, key, type Point, plus, same } from "../map/point"
import type { StatusId, Unit } from "../units/unit"
import type { Game } from "./game"

export type Action =
  | { type: "move"; unit: string; to: Point }
  | { type: "attack"; unit: string; target: string }
  | { type: "ability"; unit: string; ability: AbilityId; target?: string; at?: Point }
  | { type: "reload"; unit: string }
  | { type: "door"; unit: string; at: Point }
  | { type: "overwatch"; unit: string }
  | { type: "hunker"; unit: string }
  | { type: "aim"; unit: string; target: string; from?: Point }
  | { type: "shoot"; unit: string; at: Point }
  | { type: "use"; unit: string }
  | { type: "rank"; unit: string; skill: AbilityId }
  | { type: "endTurn" }

const inside = (p: Point, tiles: Point[]): boolean => tiles.some((t) => same(t, p))

/** An action the rules refuse. */
export class Illegal extends Error {}

export function check(ok: boolean, reason: string): asserts ok {
  if (!ok) throw new Illegal(reason)
}

/** The actions a unit carries out in a game, and the reactions they trigger. */
export class Orders {
  constructor(private readonly game: Game) {}

  /** Carries out one action in place, then updates sight and the mission's end. */
  run(action: Action): void {
    const game = this.game
    check(game.phase === "squad" || game.phase === "enemy", "over")
    if (action.type === "endTurn") {
      game.turn.end()
      return
    }
    const u = game.unit(action.unit)
    check(u.alive(), "dead")
    check(u.allegiance() === game.phase || game.reactions.includes(u.id), "not your turn")
    if (action.type === "rank") {
      check(u.promotable(action.skill), "rank")
      u.ranks = { ...u.ranks, [action.skill]: u.rank(action.skill) + 1 }
      return
    }
    check(!u.has("stasis"), "stasis")
    if (action.type === "aim") {
      this.aim(u, game.unit(action.target), action.from)
      return
    }
    check(u.ap > 0, "no AP")
    switch (action.type) {
      case "move":
        this.move(u, action.to)
        break
      case "attack":
        this.strike(u, game.unit(action.target))
        break
      case "ability":
        game.abilities.use(u, action.ability, action.target, action.at)
        break
      case "reload":
        this.reload(u)
        break
      case "door":
        this.door(u, action.at)
        break
      case "overwatch":
        this.overwatch(u)
        break
      case "hunker":
        this.hunker(u)
        break
      case "shoot":
        this.shoot(u, action.at)
        break
      case "use":
        this.use(u)
        break
    }
    game.stealth.scan()
    game.stealth.observe()
    if (action.type === "move") game.stealth.hear(u)
    this.release()
    this.settle()
  }

  /**
   * Steps tile by tile; each step can trigger fire, a mine, Suppress, Covering fire, overwatch and zone of control.
   * Reaction shots lose their disadvantage against a dash or a vault; a Brute breaks the low cover it vaults, and a
   * tree or low cover a Heavy walks into turns to floor.
   */
  walk(u: Unit, path: Point[], dash = false): void {
    const game = this.game
    const { combat, sight } = game
    for (const step of path) {
      const vault = distance(u.pos, step) === 2 && (u.pos.x === step.x || u.pos.y === step.y)
      const risky = dash || vault
      if (vault && u.kind === "ogre") game.combat.smash({ x: (u.pos.x + step.x) / 2, y: (u.pos.y + step.y) / 2 })
      const threats = game.units.filter(
        (x) =>
          x.alive() &&
          x.foe(u) &&
          x.arms().melee &&
          x.stance !== "hunker" &&
          !x.has("exposed") &&
          !x.has("stasis") &&
          adjacent(x.pos, u.pos) &&
          !adjacent(x.pos, step),
      )
      const from = u.pos
      u.pos = { ...step }
      if (game.tile(step) === "door") game.board.set(step, "open")
      if (game.tile(step) === "tree" || game.tile(step) === "low") game.board.set(step, "floor")
      game.fire.scorch(u)
      if (!u.alive()) return
      if (u.allegiance() === "enemy" && this.trip(u, from)) return
      game.stealth.scan()
      this.suppression(u, risky)
      this.cover(u, risky)
      for (const x of game.units) {
        if (!u.alive()) return
        if (!x.alive() || !x.foe(u) || x.stance !== "overwatch" || x.has("exposed") || x.has("stasis")) continue
        const w = x.arms()
        if (w.melee ? !adjacent(x.pos, u.pos) : !sight.sees(x, u.pos) || (w.ammo !== null && x.ammo <= 0)) continue
        if (u.kind === "assassin" && u.concealed) continue
        if (!x.has("killzone")) x.stance = "none"
        game.log.push({ key: "log.overwatch", params: { unit: x.id, target: u.id, x: step.x, y: step.y } })
        combat.attack(x, u, { reaction: true, risky, bonus: x.has("killzone") ? power(x, "killzone") : 0 })
      }
      for (const x of threats) {
        if (u.alive() && x.alive()) combat.attack(x, u)
      }
      if (!u.alive()) return
    }
  }

  /** Tiles next to a target that a unit can reach within one move, nearest first. */
  landings(u: Unit, t: Unit): Point[] {
    const r = this.game.reach(u, u.mobility)
    return AROUND.map((d) => plus(t.pos, d))
      .filter((p) => same(p, u.pos) || r.cost.has(key(p)))
      .sort((a, b) => (r.cost.get(key(a)) ?? 0) - (r.cost.get(key(b)) ?? 0))
  }

  canTarget(u: Unit, t: Unit): boolean {
    const { sight, units } = this.game
    if (!t.alive() || t.has("captive") || t.has("stasis")) return false
    if (!(u.foe(t) || (t.has("dominated") && t.side !== u.allegiance()))) return false
    if (t.kind === "assassin" && t.concealed && distance(u.pos, t.pos) > 3) return false
    if (sight.sees(u, t.pos)) return true
    return u.rank("squadsight") > 0 && units.some((a) => a.alive() && a !== u && !a.foe(u) && sight.sees(a, t.pos))
  }

  /** Checks the end of the mission after each action, and marks the Warchief slain when it dies. */
  settle(): void {
    const game = this.game
    const standing = game.units.filter((u) => u.alive() && u.soldier() && !u.has("captive"))
    const goal = game.goal
    if (goal.kind === "warchief" && !goal.slain && !game.units.some((u) => u.alive() && u.kind === "warchief")) {
      goal.slain = true
      game.log.push({ key: "log.chief", params: {} })
    }
    if (!game.units.some((u) => u.alive() && u.side === "enemy")) game.phase = "won"
    else if (standing.length === 0) game.phase = "lost"
    else if (goal.kind === "vip" && !game.unit(goal.captive).alive()) game.phase = "lost"
    else if (
      goal.kind === "vip" &&
      inside(game.unit(goal.captive).pos, goal.tiles) &&
      !game.unit(goal.captive).has("captive")
    )
      game.phase = "won"
    else if (
      (goal.kind === "evac" ||
        (goal.kind === "intel" && goal.taken) ||
        (goal.kind === "warchief" && goal.slain) ||
        (goal.kind === "relay" && goal.blown)) &&
      standing.every((u) => inside(u.pos, goal.tiles))
    )
      game.phase = "won"
  }

  /** A soldier next to a captive sets it free. */
  private release(): void {
    const game = this.game
    for (const c of game.units) {
      if (!c.alive() || !c.has("captive")) continue
      if (!game.units.some((s) => s !== c && s.alive() && s.soldier() && !s.has("captive") && adjacent(s.pos, c.pos)))
        continue
      c.lift("captive")
      game.log.push({ key: "log.freed", params: { unit: c.id } })
    }
  }

  /** True when an unused terminal or relay stands on or next to the unit. */
  usable(u: Unit): boolean {
    const goal = this.game.goal
    const open = (goal.kind === "intel" && !goal.taken) || (goal.kind === "relay" && goal.planted === null)
    return open && distance(u.pos, goal.at) <= 1
  }

  /** Uses the objective on or next to the unit: takes the intel, or plants a charge on the relay. */
  private use(u: Unit): void {
    const game = this.game
    const goal = game.goal
    check(this.usable(u) && (goal.kind === "intel" || goal.kind === "relay"), "use")
    if (goal.kind === "intel") goal.taken = true
    if (goal.kind === "relay") goal.planted = game.round
    game.log.push({ key: goal.kind === "intel" ? "log.intel" : "log.charge", params: { unit: u.id } })
    u.ap -= 1
  }

  private move(u: Unit, to: Point): void {
    const game = this.game
    const r = game.reach(u, u.stride())
    const cost = r.cost.get(key(to))
    check(cost !== undefined && cost > 0, "unreachable")
    u.ap -= cost <= u.mobility || u.has("running") ? 1 : 2
    u.moved = true
    this.walk(u, r.path(to), cost > u.mobility)
  }

  /** A mine under an alien goes off: its damage, a push onward and a stop; returns true when it went off. */
  private trip(u: Unit, from: Point): boolean {
    const game = this.game
    const mine = game.zones.find((z) => z.kind === "mine" && z.tiles.some((t) => same(t, u.pos)))
    if (!mine) return false
    game.zones = game.zones.filter((z) => z !== mine)
    const dmg = mine.power ?? 2
    game.log.push({ key: "log.mine", params: { target: u.id, dmg } })
    if (!game.combat.hurt(u, dmg)) game.combat.push(from, u)
    return true
  }

  /** A unit under Suppress that moves draws one reaction shot from the unit that suppresses it. */
  private suppression(u: Unit, risky: boolean): void {
    const game = this.game
    const s = u.statuses.find((x) => x.id === "suppressed")
    if (!s) return
    u.lift("suppressed")
    const by = game.units.find((x) => x.id === s.source)
    if (!by?.alive() || by.has("stasis") || !game.sight.sees(by, u.pos) || by.ammo <= 0) return
    game.combat.attack(by, u, { reaction: true, risky })
  }

  /** Covering fire: each Grunt that sees a soldier step takes one reaction shot at it each round. */
  private cover(u: Unit, risky: boolean): void {
    const game = this.game
    if (!u.soldier() || u.concealed) return
    for (const x of game.units) {
      if (!u.alive()) return
      if (!x.alive() || !x.foe(u) || x.rank("covering") === 0 || x.cooldowns.covering) continue
      if (["stasis", "suppressed", "exposed"].some((s) => x.has(s as StatusId))) continue
      if (x.ammo <= 0 || !game.sight.sees(x, u.pos)) continue
      x.cooldowns.covering = 1
      game.log.push({ key: "log.covering", params: { unit: x.id, target: u.id } })
      game.combat.attack(x, u, { reaction: true, risky })
    }
  }

  /** An alien marks the soldier it will shoot in its next phase, and the tile within one move it will fire from, for no AP. */
  private aim(u: Unit, t: Unit, from?: Point): void {
    check(u.allegiance() === "enemy" && (!u.intent || u.intent.type === "shot"), "aim")
    check(this.canTarget(from ? u.at(from) : u, t), "target")
    if (from) check(this.game.reach(u, u.mobility).cost.has(key(from)), "place")
    u.intent = { type: "shot", target: t.id, ...(from ? { from: { ...from } } : {}) }
  }

  private strike(u: Unit, t: Unit): void {
    const w = u.arms()
    check(this.canTarget(u, t), "target")
    check(canReach(u, t, w), "reach")
    if (w.twoAp) check(u.ap === 2 && !u.moved, "needs 2 AP")
    if (w.ammo !== null) check(u.ammo > 0, "ammo")
    if (u.intent?.type === "shot") u.intent = null
    this.game.combat.attack(u, t)
    this.game.stealth.attacked(u, t, u.weapon)
    u.ap = 0
    if (t.alive() || u.rank("close") < 3 || u.cooldowns.close || distance(u.pos, t.pos) > 2) return
    u.ap = 1
    u.cooldowns.close = 1
  }

  /** Fires at a barrel in sight and in weapon range; it blows up. */
  private shoot(u: Unit, at: Point): void {
    const game = this.game
    const w = u.arms()
    check(!w.melee && game.tile(at) === "barrel", "target")
    check(distance(u.pos, at) <= w.max && game.sight.sees(u, at), "range")
    if (w.twoAp) check(u.ap === 2 && !u.moved, "needs 2 AP")
    if (w.ammo !== null) {
      check(u.ammo > 0, "ammo")
      u.ammo -= 1
    }
    game.combat.smash(at)
    game.stealth.noise(u.pos, w.noise, u)
    u.ap = 0
  }

  private reload(u: Unit): void {
    const max = u.arms().ammo
    check(max !== null && u.ammo < max, "full")
    u.ammo = max
    u.ap -= 1
  }

  /** The doors next to the unit it can open or close; a door with a unit in it does not close. */
  doors(u: Unit): Point[] {
    const game = this.game
    return AROUND.map((d) => plus(u.pos, d)).filter(
      (p) => game.tile(p) === "door" || (game.tile(p) === "open" && !game.unitAt(p)),
    )
  }

  private door(u: Unit, at: Point): void {
    const game = this.game
    check(
      this.doors(u).some((p) => same(p, at)),
      "door",
    )
    const closed = game.tile(at) === "door"
    game.board.set(at, closed ? "open" : "door")
    game.log.push({ key: closed ? "log.door" : "log.close", params: { unit: u.id } })
    game.stealth.scan()
    u.ap -= 1
  }

  private overwatch(u: Unit): void {
    const w = u.arms()
    check(w.ammo === null || u.ammo > 0, "ammo")
    check(!u.has("suppressed"), "suppressed")
    u.stance = "overwatch"
    u.ap = 0
  }

  private hunker(u: Unit): void {
    check(this.game.cover.covered(u.pos), "cover")
    u.stance = "hunker"
    u.ap = 0
  }
}
