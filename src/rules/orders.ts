import { canReach } from "./combat"
import { PROFILES, WEAPONS } from "./data"
import type { Game } from "./game"
import { AROUND, adjacent, distance, key, type Point, plus, same } from "./point"
import type { Action, WeaponId } from "./types"
import type { Unit } from "./unit"

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
    check(u.ap > 0, "no AP")
    switch (action.type) {
      case "move":
        this.move(u, action.to)
        break
      case "attack":
        this.strike(u, game.unit(action.target), action.weapon ?? u.weapon)
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
    }
    game.stealth.scan()
    game.stealth.observe()
    if (action.type === "move") game.stealth.hear(u)
    this.settle()
  }

  /**
   * Steps tile by tile; each step can trigger fire, a mine, a Guard, overwatch and zone of control. Reaction shots lose their disadvantage against a dash or a vault; a Brute breaks the low cover it
   * vaults, and a tree or low cover a Heavy walks into turns to floor.
   */
  walk(u: Unit, path: Point[], dash = false): void {
    const game = this.game
    const { combat, sight } = game
    for (const step of path) {
      const vault = distance(u.pos, step) === 2 && (u.pos.x === step.x || u.pos.y === step.y)
      const risky = dash || vault
      if (vault && u.kind === "ogre") game.board.break({ x: (u.pos.x + step.x) / 2, y: (u.pos.y + step.y) / 2 })
      const threats = game.units.filter(
        (x) =>
          x.alive() &&
          x.foe(u) &&
          x.arms().melee &&
          x.stance !== "hunker" &&
          !x.has("exposed") &&
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
      this.guard(u, risky)
      for (const x of game.units) {
        if (!u.alive()) return
        if (!x.alive() || !x.foe(u) || x.stance !== "overwatch" || x.has("exposed")) continue
        const w = x.arms()
        if (w.melee ? !adjacent(x.pos, u.pos) : !sight.sees(x, u.pos) || (w.ammo !== null && x.ammo <= 0)) continue
        if (u.kind === "assassin" && u.concealed) continue
        if (!x.has("killzone")) x.stance = "none"
        combat.attack(x, u, x.weapon, { reaction: true, risky })
      }
      for (const x of threats) {
        if (u.alive() && x.alive()) combat.attack(x, u, x.weapon)
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
    if (!t.alive() || !(u.foe(t) || (t.has("dominated") && t.side !== u.allegiance()))) return false
    if (t.kind === "assassin" && t.concealed && distance(u.pos, t.pos) > 3) return false
    if (sight.sees(u, t.pos)) return true
    return u.kind === "ranger" && units.some((a) => a.alive() && a !== u && !a.foe(u) && sight.sees(a, t.pos))
  }

  /** Checks the end of the mission after each action. */
  settle(): void {
    const game = this.game
    const standing = game.units.filter((u) => u.alive() && u.soldier())
    const goal = game.goal
    if (!game.units.some((u) => u.alive() && u.side === "enemy")) game.phase = "won"
    else if (standing.length === 0) game.phase = "lost"
    else if (goal.kind === "evac" && standing.every((u) => goal.tiles.some((p) => same(p, u.pos)))) game.phase = "won"
  }

  private move(u: Unit, to: Point): void {
    const game = this.game
    const r = game.reach(u, u.mobility * u.ap)
    const cost = r.cost.get(key(to))
    check(cost !== undefined && cost > 0, "unreachable")
    u.ap -= cost <= u.mobility ? 1 : 2
    u.moved = true
    this.walk(u, r.path(to), cost > u.mobility)
  }

  /** A mine under an alien goes off: 2 damage, a push onward and a stop; returns true when it went off. */
  private trip(u: Unit, from: Point): boolean {
    const game = this.game
    const mine = game.zones.find((z) => z.kind === "mine" && z.tiles.some((t) => same(t, u.pos)))
    if (!mine) return false
    game.zones = game.zones.filter((z) => z !== mine)
    game.log.push({ key: "log.mine", params: { target: u.id, dmg: 2 } })
    if (!game.combat.hurt(u, 2)) game.combat.push(from, u)
    return true
  }

  /** A Sniper fires at the first foe that steps next to the ally it guards. */
  private guard(u: Unit, risky: boolean): void {
    const game = this.game
    for (const x of game.units) {
      const g = x.statuses.find((s) => s.id === "guarded")
      if (!g || !x.alive() || !u.alive() || !x.foe(u) || !adjacent(x.pos, u.pos)) continue
      x.lift("guarded")
      const sniper = game.units.find((s) => s.id === g.source)
      if (!sniper?.alive() || !game.sight.sees(sniper, u.pos) || sniper.ammo <= 0) continue
      game.combat.attack(sniper, u, sniper.weapon, { reaction: true, risky })
    }
  }

  private strike(u: Unit, t: Unit, weaponId: WeaponId): void {
    const p = PROFILES[u.kind]
    check((weaponId === u.weapon || weaponId === p.sidearm) && weaponId !== "none", "weapon")
    const w = WEAPONS[weaponId]
    check(this.canTarget(u, t), "target")
    check(canReach(u, t, w), "reach")
    if (w.twoAp) check(u.ap === 2 && !u.moved, "needs 2 AP")
    if (w.ammo !== null && weaponId === u.weapon) check(u.ammo > 0, "ammo")
    if (weaponId === "axes") check(u.axes > 0, "axes")
    this.game.combat.attack(u, t, weaponId)
    this.game.stealth.attacked(u, t, weaponId)
    u.ap = 0
  }

  private reload(u: Unit): void {
    const max = u.arms().ammo
    check(max !== null && u.ammo < max, "full")
    u.ammo = max
    u.ap -= 1
  }

  private door(u: Unit, at: Point): void {
    const game = this.game
    check(adjacent(u.pos, at) && game.tile(at) === "door", "door")
    game.board.set(at, "open")
    game.log.push({ key: "log.door", params: { unit: u.id } })
    game.stealth.scan()
    u.ap -= 1
  }

  private overwatch(u: Unit): void {
    const w = u.arms()
    check(w.ammo === null || u.ammo > 0, "ammo")
    u.stance = "overwatch"
    u.ap = 0
  }

  private hunker(u: Unit): void {
    check(this.game.cover.covered(u.pos), "cover")
    u.stance = "hunker"
    u.ap = 0
  }
}
