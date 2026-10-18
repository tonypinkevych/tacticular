import { canReach } from "../rules/combat"
import { PROFILES, RANGE, SEARCH, WEAPONS } from "../rules/data"
import { failChance } from "../rules/dice"
import type { Game } from "../rules/game"
import { area, distance, key, type Point, pointOf, same } from "../rules/point"
import type { Action } from "../rules/types"
import type { Unit } from "../rules/unit"

interface Choice {
  action: Action
  value: number
  kill?: boolean
}

/** The enemy side's choices in a game: patrol, investigate, or fight with the best attack, tile or special. */
export class Mind {
  constructor(private readonly game: Game) {}

  /** The next action of an enemy-side unit, or null when it is done for the phase. */
  decide(u: Unit): Action | null {
    const game = this.game
    if (!u.alive() || u.ap <= 0) return null
    const mode = u.side === "squad" ? "engaged" : u.alert
    if (this.guards(u) && this.known(u).length === 0) return this.post(u)
    if (mode === "unaware") return this.patrol(u)
    if (mode === "investigating") {
      const goal = game.groups.find((g) => g.id === u.group)?.target
      return goal ? this.search(u, goal) : this.patrol(u)
    }
    return this.engaged(u)
  }

  /** Foes the unit's side knows about: not concealed and seen by any unit of its side. */
  known(u: Unit): Unit[] {
    const game = this.game
    const side = game.units.filter((x) => x.alive() && x.allegiance() === u.allegiance())
    return game.units.filter(
      (t) => t.alive() && u.foe(t) && !t.concealed && side.some((x) => game.sight.sees(x, t.pos)),
    )
  }

  /** One move along the walking path to a goal, or to the reachable tile nearest it; a dash when given the range. */
  toward(u: Unit, target: Point, range = u.mobility): Action | null {
    const game = this.game
    const r = game.reach(u, 400, u.allegiance())
    let goal = target
    if (!r.cost.has(key(goal))) {
      let best = Infinity
      for (const k of r.cost.keys()) {
        const p = pointOf(k)
        const d = distance(p, target)
        if (d < best) [best, goal] = [d, p]
      }
    }
    const path = r.path(goal).filter((p) => (r.cost.get(key(p)) ?? Infinity) <= range)
    const to = path.reverse().find((p) => !game.unitAt(p))
    return to ? { type: "move", unit: u.id, to } : null
  }

  private jitter(u: Unit, p: Point): number {
    const game = this.game
    let h = (game.rng ^ (p.x * 73856093) ^ (p.y * 19349663)) + u.id.length * 83492791
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
    return ((h >>> 0) % 1000) / 2000
  }

  /** Best attack from the unit's current tile, by expected damage, kills, wounds already dealt and target value. */
  private bestAttack(u: Unit, targets: Unit[]): Choice | null {
    const game = this.game
    let best: Choice | null = null
    for (const t of targets) {
      if (!game.orders.canTarget(u, t)) continue
      const weapon = u.arms()
      if (!canReach(u, t, weapon)) continue
      if (weapon.twoAp && (u.ap < 2 || u.moved)) continue
      if (weapon.ammo !== null && u.ammo <= 0) continue
      const o = game.combat.odds(u, t)
      const dmg = (o.min + o.max) / 2
      const value =
        o.chance * dmg * (dmg >= t.hp ? 2 : 1) +
        (t.maxHp - t.hp) * 0.3 +
        (t.kind === "mage" || t.kind === "cleric" ? 0.5 : 0)
      if (!best || value > best.value)
        best = { action: { type: "attack", unit: u.id, target: t.id }, value, kill: dmg >= t.hp }
    }
    return best
  }

  /** How good a tile is to stand on: cover against known foes, flanks it gives, attacks it opens, danger it holds. */
  private tileValue(u: Unit, p: Point, foesKnown: Unit[]): number {
    const game = this.game
    const from = u.pos
    u.pos = p
    let value = this.jitter(u, p) - (game.fire.burning(p) ? 3 : 0)
    const w = WEAPONS[u.weapon]
    const flanks = !w.melee && !w.ignoresCover
    for (const f of foesKnown) {
      const exposed = game.sight.sees(f, p)
      if (!exposed) continue
      const cover = game.cover.against(p, f.pos)
      value += cover === 0 ? -4 : cover / 2
      if (flanks && game.cover.against(f.pos, p) === 0) value += 4
      if (f.stance === "overwatch") value -= 3
    }
    const attack = this.bestAttack(u, foesKnown)
    value += attack ? attack.value : 0
    if (WEAPONS[u.weapon].melee && foesKnown.length > 0) {
      value -= Math.min(...foesKnown.map((f) => distance(p, f.pos))) * 0.3
    }
    if (u.side === "enemy" && game.goal.kind === "defend") value -= distance(p, game.goal.at) * 0.3
    if (u.kind === "whisperer" && foesKnown.length > 0) {
      value -= Math.max(0, 6 - Math.min(...foesKnown.map((f) => distance(p, f.pos))))
    }
    u.pos = from
    return value
  }

  /** A move to a tile farther from the known foes, behind cover or out of their sight, or null when none is better. */
  private fallBack(u: Unit, foes: Unit[]): Action | null {
    const game = this.game
    const near = (p: Point) => Math.min(...foes.map((f) => distance(p, f.pos)))
    const shelter = (p: Point) =>
      foes.reduce((v, f) => v + (!game.sight.sees(f, p) ? 2 : game.cover.against(p, f.pos) === 0 ? -2 : 1), 0)
    return this.bestMove(u, (p) => near(p) + shelter(p))?.action ?? null
  }

  /** Best tile within one move, or null when staying is as good. */
  private bestMove(u: Unit, score: (p: Point) => number): Choice | null {
    const game = this.game
    const r = game.reach(u, u.mobility)
    let best: Choice | null = null
    const stay = score(u.pos)
    for (const k of r.cost.keys()) {
      const p = pointOf(k)
      if (same(p, u.pos)) continue
      const value = score(p)
      if (value > stay + 0.5 && (!best || value > best.value))
        best = { action: { type: "move", unit: u.id, to: p }, value }
    }
    return best
  }

  /**
   * Goes to a place where soldiers were seen or heard, dashing when far, then moves to tiles its side does not see.
   * With nothing hidden there, it dashes on toward the next place given.
   */
  private search(u: Unit, goal: Point, next?: Point): Action | null {
    const game = this.game
    if (distance(u.pos, goal) > SEARCH) return this.toward(u, goal, u.stride())
    if (u.moved) return this.watch(u)
    const side = game.units.filter((x) => x.alive() && x.allegiance() === u.allegiance())
    const hidden = [...game.reach(u, u.mobility).cost.keys()]
      .map(pointOf)
      .filter((p) => distance(p, goal) <= SEARCH && !game.unitAt(p) && !side.some((x) => game.sight.sees(x, p)))
      .sort((a, b) => this.jitter(u, b) - this.jitter(u, a))
    if (hidden.length > 0) return { type: "move", unit: u.id, to: hidden[0] }
    if (next && distance(u.pos, next) > SEARCH) return this.toward(u, next, u.stride())
    return this.watch(u)
  }

  /** Overwatch when the weapon can fire, else nothing. */
  private watch(u: Unit): Action | null {
    return WEAPONS[u.weapon].ammo === null || u.ammo > 0 ? { type: "overwatch", unit: u.id } : null
  }

  /** True when the unit's group is the alien group nearest to the evac zone. */
  private guards(u: Unit): boolean {
    const game = this.game
    const goal = game.goal
    if (goal.kind !== "evac" || u.side !== "enemy") return false
    const zone = goal.tiles[0]
    const nearest = game.units
      .filter((x) => x.alive() && x.side === "enemy" && x.group)
      .sort((a, b) => distance(a.pos, zone) - distance(b.pos, zone))[0]
    return nearest?.group === u.group
  }

  /** Walks to the evac zone, then holds the covered tile near it that faces where the squad was last known. */
  private post(u: Unit): Action | null {
    const game = this.game
    if (game.goal.kind !== "evac") return null
    const zone = game.goal.tiles[0]
    if (distance(u.pos, zone) > SEARCH + 1) return this.toward(u, zone, u.stride())
    const group = game.groups.find((g) => g.id === u.group)
    const facing = group?.target ?? group?.landing ?? u.pos
    const score = (p: Point) => game.cover.against(p, facing) + this.jitter(u, p)
    const move = this.bestMove(u, (p) => (distance(p, zone) <= SEARCH ? score(p) : -Infinity))
    if (move && !u.moved) return move.action
    return this.watch(u)
  }

  private patrol(u: Unit): Action | null {
    if (u.moved || u.patrol.length === 0) return null
    const goal = u.patrol[u.patrolIndex % u.patrol.length]
    return this.toward(u, goal)
  }

  /** The soldier an alien aims at for its next phase: the one it would attack now, or null. */
  aim(u: Unit): Action | null {
    if (!u.alive() || u.allegiance() !== "enemy" || (u.intent && u.intent.type !== "shot")) return null
    const best = this.bestAttack(u, this.known(u))?.action
    return best?.type === "attack" ? { type: "aim", unit: u.id, target: best.target } : null
  }

  /** Special moves of the enemy types: telegraphs, then the strike they promised. */
  private special(u: Unit, targets: Unit[]): Choice | null {
    const game = this.game
    if (u.intent?.type === "shot") {
      const t = game.units.find((x) => x.id === (u.intent as { target: string }).target)
      if (t?.alive() && game.orders.canTarget(u, t) && canReach(u, t, WEAPONS[u.weapon])) {
        if (WEAPONS[u.weapon].ammo !== null && u.ammo <= 0)
          return { action: { type: "reload", unit: u.id }, value: 100 }
        return { action: { type: "attack", unit: u.id, target: t.id }, value: 100 }
      }
    }
    if (u.intent?.type === "charge") {
      const t = game.units.find((x) => x.id === (u.intent as { target: string }).target)
      if (t?.alive() && ready(u, "charge") && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= u.mobility + 1) {
        return { action: { type: "ability", unit: u.id, ability: "charge", target: t.id }, value: 100 }
      }
    }
    if (u.intent?.type === "psi") {
      const t = game.units.find((x) => x.id === (u.intent as { target: string }).target)
      if (
        t?.alive() &&
        ready(u, "dominate") &&
        game.orders.canTarget(u, t) &&
        distance(u.pos, t.pos) <= RANGE.dominate
      ) {
        return { action: { type: "ability", unit: u.id, ability: "dominate", target: t.id }, value: 100 }
      }
    }
    if (u.intent?.type === "bomb") {
      const at = u.intent.at
      const friendly = area(at, 1).some((p) => {
        const x = game.unitAt(p)
        return x?.alive() && !u.foe(x)
      })
      if (!friendly && distance(u.pos, at) <= RANGE.blast && game.sight.line(u.pos, at, false)) {
        return { action: { type: "ability", unit: u.id, ability: "blast", at }, value: 100 }
      }
    }
    if (u.kind === "ogre" && !u.intent && ready(u, "mark") && (u.cooldowns.charge ?? 0) <= 1) {
      const t = targets
        .filter((x) => game.orders.canTarget(u, x))
        .sort((a, b) => distance(u.pos, a.pos) - distance(u.pos, b.pos))[0]
      if (t && distance(u.pos, t.pos) <= u.mobility * 2) {
        return { action: { type: "ability", unit: u.id, ability: "mark", target: t.id }, value: 6 }
      }
    }
    if (u.kind === "bomber" && !u.intent) {
      let best: Choice | null = null
      for (const t of targets) {
        for (const c of area(t.pos, 1)) {
          if (!game.board.inside(c) || distance(u.pos, c) > RANGE.blast || !game.sight.line(u.pos, c, false)) continue
          const hit = area(c, 1)
            .map((p) => game.unitAt(p))
            .filter((x): x is Unit => !!x)
          const value = hit.filter((x) => u.foe(x)).length * 4 - hit.filter((x) => !u.foe(x)).length * 5
          if (value > 0 && (!best || value > best.value))
            best = { action: { type: "ability", unit: u.id, ability: "mark", at: c }, value }
        }
      }
      if (best) return best
    }
    if (u.kind === "warchief" && ready(u, "rally") && targets.length > 0) {
      const ally = game.units
        .filter(
          (x) =>
            x.alive() && x !== u && !u.foe(x) && distance(u.pos, x.pos) <= RANGE.rally && game.sight.sees(u, x.pos),
        )
        .sort((a, b) => b.ap - a.ap)[0]
      if (ally) return { action: { type: "ability", unit: u.id, ability: "rally", target: ally.id }, value: 2.5 }
    }
    if (u.kind === "whisperer") {
      const ally = game.units.find(
        (x) =>
          x.alive() &&
          x !== u &&
          !u.foe(x) &&
          x.alert === "engaged" &&
          !x.has("ward") &&
          distance(u.pos, x.pos) <= RANGE.ward &&
          game.sight.sees(u, x.pos),
      )
      if (ready(u, "ward") && ally)
        return { action: { type: "ability", unit: u.id, ability: "ward", target: ally.id }, value: 3 }
      for (const id of ["dominate", "dread"] as const) {
        const marked =
          u.intent?.type === "psi" &&
          game.units.some((x) => x.id === (u.intent as { target: string }).target && x.alive())
        if (!ready(u, id) || (id === "dominate" && marked)) continue
        const t = targets
          .filter(
            (x) =>
              game.orders.canTarget(u, x) && distance(u.pos, x.pos) <= RANGE[id] && (id === "dread" || x.soldier()),
          )
          .sort((a, b) => b.hp - a.hp)[0]
        if (!t) continue
        const value = failChance(t.will, 10 + u.will, t.stance === "hunker" ? 1 : 0) * (id === "dominate" ? 12 : 5)
        const ability = id === "dominate" ? "mark" : id
        return { action: { type: "ability", unit: u.id, ability, target: t.id }, value }
      }
    }
    return null
  }

  private engaged(u: Unit): Action | null {
    const game = this.game
    const targets = this.known(u)
    const group = game.groups.find((g) => g.id === u.group)
    const sp = this.special(u, targets)
    if (sp && sp.value >= 100) return sp.action
    if (targets.length === 0) {
      const beacon = u.side === "enemy" && game.goal.kind === "defend" ? game.goal.at : null
      if (beacon && !same(u.pos, beacon)) return this.toward(u, beacon, u.stride())
      const goal = group?.target ?? (u.waited ? group?.landing : undefined)
      if (!beacon && goal) return this.search(u, goal, group?.landing)
      if (u.ap > 0 && (WEAPONS[u.weapon].ammo === null || u.ammo > 0)) return { type: "overwatch", unit: u.id }
      return null
    }
    const attack = this.bestAttack(u, targets)
    const back = u.hp * 3 <= u.maxHp && !u.moved && !attack?.kill ? this.fallBack(u, targets) : null
    if (back) return back
    const options = [attack, sp].filter((c): c is Choice => !!c)
    const now = options.sort((a, b) => b.value - a.value)[0]
    if (u.ap >= 2 || game.reactions.includes(u.id)) {
      const move = this.bestMove(u, (p) => this.tileValue(u, p, targets))
      const here = this.tileValue(u, u.pos, targets)
      const exposed = targets.some((f) => game.sight.sees(f, u.pos) && game.cover.against(u.pos, f.pos) === 0)
      if (move && (move.value > here + 1 || (exposed && !now) || (exposed && (now?.value ?? 0) < 2))) return move.action
    }
    if (now && now.value > 0.4) return now.action
    if (WEAPONS[u.weapon].ammo !== null && u.ammo <= 0) return { type: "reload", unit: u.id }
    const nearest = targets.sort((a, b) => distance(u.pos, a.pos) - distance(u.pos, b.pos))[0]
    const keep = u.kind === "whisperer" ? 6 : 0
    const step = !attack && !u.moved && distance(u.pos, nearest.pos) > keep ? this.toward(u, nearest.pos) : null
    if (step) return step
    if (game.cover.covered(u.pos)) return { type: "hunker", unit: u.id }
    return { type: "overwatch", unit: u.id }
  }
}

function ready(u: Unit, id: "dominate" | "dread" | "charge" | "mark" | "rally" | "ward"): boolean {
  return PROFILES[u.kind].abilities.includes(id) && !u.cooldowns[id]
}
