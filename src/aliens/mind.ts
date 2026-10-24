import type { Odds } from "../combat/combat"
import { cover } from "../map/cover"
import { AROUND, adjacent, distance, ORTHOGONAL, type Point, plus, same } from "../map/point"
import { clear } from "../map/sight"
import { blocksMove } from "../map/tile"
import type { Game } from "../mission/game"
import type { Action } from "../mission/orders"
import type { Side, Status, Unit } from "../units/unit"

/** One choice of a unit: the action it starts with and what the plan is worth. */
interface Plan {
  action: Action
  value: number
  /** A tactic that a soldier still to act can turn into a combo. */
  combo?: boolean
}

const KILL = 3
const FLANK = 4
/** How much a side minds the damage the foes' best replies can deal: aliens take more risk than soldiers. */
const RISK: Record<Side, number> = { squad: 0.5, enemy: 0.3 }
const NEAR = 0.5
const SIDE = 0.3
const BUNCH = 0.4
/** What a hurt target adds to a shot at it, for each HP it lost: the side focuses fire. */
const FOCUS = 0.15
/** What the next link of the chain a combo puts on is worth. */
const LINK = 0.5
/** What each status is worth by its own effect. */
const OWN: Record<Status, number> = { suppressed: 0.6, staggered: 0.3, exposed: 0.3, marked: 0.2 }

/**
 * The player of a side: for each unit with AP it weighs where to stand and what to do there, through the
 * rules, and gives the first action of the best plan. Either side can be played; the aliens always are.
 */
export class Mind {
  private readonly fields = new Map<Side, number[]>()
  private readonly from = new Map<string, Point[]>()

  constructor(private readonly game: Game) {}

  /**
   * The next action of the side in turn; the turn ends when no unit has anything worth doing. A soldier whose
   * best plan is a tactic another soldier can turn into a combo acts first.
   */
  next(): Action {
    const game = this.game
    const side = game.phase === "squad" ? "squad" : "enemy"
    const ready = game.units
      .filter((u) => u.side === side && u.alive() && u.ap > 0)
      .sort((a, b) => Number(b.kind === "commander") - Number(a.kind === "commander"))
    const plans: Plan[] = []
    for (const u of ready) {
      const plan = this.plan(u)
      if (plan && side === "enemy") return plan.action
      if (plan) plans.push(plan)
    }
    return (plans.find((p) => p.combo) ?? plans[0])?.action ?? { type: "endTurn" }
  }

  /** The best plan of a unit, valued by what it gains over holding still, or none when holding still is best. */
  private plan(u: Unit): Plan | null {
    const game = this.game
    const plans: Plan[] = []
    const stay = this.ground(u, u.at),
      pin = this.pin(u)
    for (const a of this.attacks(u, u.at)) plans.push({ action: a.action, value: a.value + stay })
    const after = (at: Point) => Math.max(0, ...this.attacks(u, at).map((a) => a.value))
    for (const a of this.tactics(u)) plans.push({ ...a, value: a.value + stay + (u.ap > 1 ? after(u.at) : 0) })
    const one = game.reach(u, 1)
    for (const t of one.tiles())
      plans.push({
        action: { type: "move", unit: u.id, to: t },
        value: (u.ap > 1 ? after(t) : 0) + this.ground(u, t) + this.closer(u, t) - pin,
      })
    if (u.ap > 1)
      for (const t of game.reach(u, 2).tiles())
        if (!one.has(t))
          plans.push({
            action: { type: "move", unit: u.id, to: t },
            value: this.ground(u, t) + this.closer(u, t) - 0.3 - pin,
          })
    const idle = stay + this.closer(u, u.at)
    if (u.side === "squad") plans.push({ action: { type: "hunker", unit: u.id }, value: idle + this.shield(u) })
    const best = plans.sort((a, b) => b.value - a.value)[0]
    if (best && best.value > idle + 0.05) return { ...best, value: best.value - idle }
    if (u.profile.range > 0 && !u.profile.melee && !u.overwatch)
      return { action: { type: "overwatch", unit: u.id }, value: 0 }
    return null
  }

  /** The damage the attacks aimed at a unit are expected to deal where it stands now. */
  private aimed(u: Unit): number {
    const game = this.game
    let sum = 0
    for (const m of game.marks) {
      if (m.target !== u.id) continue
      const f = game.unit(m.unit)
      if (!f.alive() || (m.kind === "claw" ? !adjacent(f.at, u.at) : !game.combat.canShoot(f, u))) continue
      const o = game.combat.odds(f, u, { aimed: true, penalty: m.kind === "volley" ? 15 : 0 })
      sum += this.worth(o, u) * (m.kind === "volley" ? 2 : 1)
    }
    return sum
  }

  /** What hunkering down saves a unit of the damage aimed at it and of the damage foes can deal next. */
  private shield(u: Unit): number {
    const game = this.game
    const threat = () =>
      this.aimed(u) +
      game.foes(u).reduce((s, f) => s + (game.combat.canShoot(f, u) ? this.worth(game.combat.odds(f, u), u) : 0), 0) *
        0.5
    const open = threat()
    u.hunkered = true
    const hunkered = threat()
    u.hunkered = false
    return open - hunkered
  }

  /** What a Suppressed unit loses when it moves: the shot it draws from its suppressor. */
  private pin(u: Unit): number {
    const by = u.status === "suppressed" ? this.game.units.find((x) => x.id === u.by) : undefined
    if (!by?.alive() || !this.game.combat.canShoot(by, u)) return 0
    return this.worth(this.game.combat.odds(by, u), u)
  }

  /**
   * The tactics a soldier can use from its tile, each worth its status's own effect and the best combo a
   * soldier still to act could make of it.
   */
  private tactics(u: Unit): Plan[] {
    const game = this.game,
      status = u.profile.tactic
    if (!status) return []
    const out: Plan[] = []
    for (const f of game.foes(u)) {
      if (status === "staggered" ? !adjacent(u.at, f.at) : distance(u.at, f.at) > u.profile.range) continue
      if (status !== "staggered" && !clear(game.board, u.at, f.at)) continue
      if (f.status === status) continue
      let value = OWN[status]
      if (status === "staggered") {
        const to = { x: f.at.x + Math.sign(f.at.x - u.at.x), y: f.at.y + Math.sign(f.at.y - u.at.y) }
        if (game.board.at(to) === "water" && game.board.inside(to)) value += KILL + 1
        if (game.marks.some((m) => m.unit === f.id)) value += 1.5
      }
      const combo = game
        .allies(u)
        .filter((a) => a !== u && a.ap > 0 && a.profile.combo === status)
        .flatMap((a) =>
          [a.at, ...(a.ap > 1 ? game.reach(a, 1).tiles() : [])]
            .filter((from) => game.combat.canShoot(a, f, from))
            .map((from) => {
              const was = this.worth(game.combat.odds(a, f, { from }), f)
              return this.as(f, status, () => this.worth(game.combat.odds(a, f, { from }), f)) - was + LINK
            }),
        )
      const gain = Math.max(0, ...combo)
      out.push({ action: { type: "tactic", unit: u.id, target: f.id }, value: value + gain, combo: gain > 0 })
    }
    return out
  }

  /** What standing on a tile is worth: its cover against each foe, less the damage each foe's best reply deals there. */
  private ground(u: Unit, at: Point): number {
    const foes = this.game.foes(u)
    if (!foes.length) return 0
    return this.moved(u, at, () => {
      const shelter = foes.reduce((s, f) => s + cover(this.game.board, at, f.at) / 40, 0) / foes.length
      const threat = foes.reduce((s, f) => s + this.reply(f, u), 0)
      const marked = this.game.marks.some(
        (m) => !m.target && m.tiles.some((p) => same(p, at)) && this.game.unit(m.unit).side !== u.side,
      )
      const goal = this.game.goal
      const beacon = goal.kind === "defend" && adjacent(at, goal.at, true) ? (u.side === "enemy" ? 1.2 : 0.8) : 0
      const fire = this.game.board.at(at) === "fire" ? 1 : 0
      return shelter * 0.8 - threat * RISK[u.side] - this.aimed(u) - (marked ? 3 : 0) - fire + beacon + this.team(u, at)
    })
  }

  /**
   * The damage a foe is expected to deal to a unit where it stands now with its best reply: a shot, or claws, from
   * its tile or from a tile one move away; a Staggered foe cannot move first.
   */
  private reply(f: Unit, u: Unit): number {
    const game = this.game
    if (f.profile.range === 0) return 0
    let best = 0
    for (const q of this.steps(f)) {
      if (same(q, u.at)) continue
      const reach = f.profile.melee ? adjacent(q, u.at) : game.combat.canShoot(f, u, q)
      if (reach) best = Math.max(best, this.worth(game.combat.odds(f, u, { from: q }), u))
    }
    return best
  }

  /** The tiles a unit can act from in its next turn: its own, and those one move away unless it is Staggered or a Sniper. */
  private steps(f: Unit): Point[] {
    const known = this.from.get(f.id)
    if (known) return known
    const stays = f.status === "staggered" || f.profile.passive === "keen"
    const tiles = [f.at, ...(stays ? [] : this.game.reach(f, 1).tiles())]
    this.from.set(f.id, tiles)
    return tiles
  }

  /** For an alien, what a tile adds to the pack: a flank on a soldier (more with a shot from cover), sides the other aliens leave open, and room from them. */
  private team(u: Unit, at: Point): number {
    if (u.side !== "enemy") return 0
    const game = this.game,
      others = game.allies(u).filter((a) => a !== u)
    let value = 0
    for (const f of game.foes(u)) {
      const shot = game.combat.canShoot(u, f, at),
        flank = cover(game.board, f.at, at) === 0 && distance(f.at, at) <= u.profile.range + 2
      const safe = cover(game.board, at, f.at) > 0
      if (flank) value += shot ? (safe ? FLANK : FLANK / 2) : NEAR
      if (!shot) continue
      const side = toward(f.at, at)
      if (!others.some((a) => same(toward(f.at, a.at), side) && game.combat.canShoot(a, f))) value += SIDE
    }
    return value - BUNCH * others.filter((a) => adjacent(a.at, at)).length
  }

  /** A pull toward the nearest foe by walking steps, past the unit's range when it has a shot from the tile, or a soldier's pull toward the evac; it grows each round after the sixth, for soldiers only toward the evac. */
  private closer(u: Unit, at: Point): number {
    const goal = this.game.goal,
      late = 0.15 * Math.max(0, this.game.round - 6)
    if (goal.kind === "evac" && u.side === "squad")
      return -Math.min(...goal.tiles.map((p) => distance(p, at))) * (0.8 + late)
    if (!this.game.foes(u).length) return 0
    const gap = this.walk(u.side)[at.y * this.game.board.width + at.x]
    const pull = u.side === "enemy" ? 0.45 + late : 0.45
    const sees = this.game.foes(u).some((f) => this.game.combat.canShoot(u, f, at))
    return -(sees ? Math.max(0, gap - u.profile.range) : gap) * pull
  }

  /** Walking steps from every tile to the nearest foe of a side, around anything that blocks a move. */
  private walk(side: Side): number[] {
    const known = this.fields.get(side)
    if (known) return known
    const board = this.game.board,
      width = board.width
    const field = new Array(board.tiles.length).fill(99)
    const queue = this.game.units.filter((f) => f.alive() && f.side !== side).map((f) => f.at)
    for (const p of queue) field[p.y * width + p.x] = 0
    while (queue.length) {
      const p = queue.shift() as Point
      for (const d of AROUND) {
        const q = plus(p, d)
        if (!board.inside(q) || blocksMove(board.at(q)) || field[q.y * width + q.x] <= field[p.y * width + p.x] + 1)
          continue
        field[q.y * width + q.x] = field[p.y * width + p.x] + 1
        queue.push(q)
      }
    }
    this.fields.set(side, field)
    return field
  }

  /** The attacks a unit can make from a tile, with what each is worth. */
  private attacks(u: Unit, at: Point): Plan[] {
    const game = this.game,
      combat = game.combat,
      out: Plan[] = []
    const foes = game.foes(u)
    const still = u.profile.passive !== "keen" || (!u.moved && same(at, u.at))
    for (const f of foes)
      if (still && combat.canShoot(u, f, at))
        out.push({
          action: { type: "shoot", unit: u.id, target: f.id },
          value: this.worth(combat.odds(u, f, { from: at }), f),
        })
    if (u.cooldown > 0 || (u.uses !== null && u.uses <= 0)) return out
    const skill = (value: number, extra: Partial<Extract<Action, { type: "skill" }>> = {}) =>
      out.push({ action: { type: "skill", unit: u.id, ...extra }, value })
    switch (u.profile.skill) {
      case "headshot":
        for (const f of foes)
          if (combat.canShoot(u, f, at) && cover(game.board, f.at, at) === 0) {
            const o = combat.odds(u, f, { from: at })
            skill(this.worth({ ...o, damage: o.damage + 1, crit: 0 }, f) - 0.4, { target: f.id })
          }
        break
      case "runGun":
        if (u.ap === 2 && same(at, u.at))
          for (const t of game.reach(u, 2).tiles())
            for (const f of foes)
              if (combat.canShoot(u, f, t))
                skill(this.worth(combat.odds(u, f, { from: t }), f) + this.ground(u, t) - 0.5, { to: t, target: f.id })
        break
      case "grenade":
      case "blast": {
        const reach = u.profile.skill === "grenade" ? 4 : 3,
          odds = u.profile.skill === "grenade" ? 1 : 0.6
        for (let y = 0; y < game.board.height; y++)
          for (let x = 0; x < game.board.width; x++) {
            const c = { x, y }
            if (distance(at, c) > reach) continue
            const area = [c, ...ORTHOGONAL.map((d) => plus(c, d))]
            const hit = area.map((p) => game.unitAt(p)).filter((v): v is Unit => !!v && v.id !== u.id)
            const gain = hit.reduce(
              (s, v) => s + (v.side === u.side ? -3 : 2 * odds + (v.hp <= 2 ? KILL * odds : 0)),
              0,
            )
            if (hit.some((v) => v.side !== u.side) && gain > (u.profile.skill === "grenade" ? 3 : 1))
              skill(gain - (u.profile.skill === "grenade" ? 1.5 : 0), { at: c })
          }
        break
      }
      case "medkit":
        for (const a of game.allies(u)) {
          const missing = a.profile.hp - a.hp
          const shot = a !== u && a.ap === 0 && foes.some((f) => combat.canShoot(a, f)) ? 1.5 : 0
          if ((missing >= 2 || shot) && (a === u || adjacent(a.at, at)))
            skill(Math.min(2, missing) * 0.9 + shot, { target: a.id })
        }
        break
      case "covering":
        for (const f of foes)
          if (combat.canShoot(u, f, at)) {
            const o = combat.odds(u, f, { from: at, penalty: 15 })
            skill(this.worth(o, f) * 1.8, { target: f.id })
          }
        break
      case "charge":
        if (same(at, u.at))
          for (const f of foes) {
            const dx = f.at.x - at.x,
              dy = f.at.y - at.y,
              n = distance(at, f.at)
            if (n < 2 || n > 4 || !(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) continue
            const step = { x: Math.sign(dx), y: Math.sign(dy) }
            const way = Array.from({ length: n - 1 }, (_, i) => ({
              x: at.x + step.x * (i + 1),
              y: at.y + step.y * (i + 1),
            }))
            if (way.every((p) => !blocksMove(game.board.at(p)) && !game.unitAt(p)))
              skill(2 + (f.hp <= 3 ? 1 : 0), { at: f.at })
          }
        break
      case "warcry":
        if (game.allies(u).filter((a) => a !== u && a.ap > 0).length >= 2) skill(1.5)
        break
    }
    return out
  }

  /** The damage a shot is expected to deal, with a bonus for a likely kill. */
  private worth(o: Odds, target: Unit): number {
    const p = o.chance / 100,
      c = o.crit / 100
    const dmg = p * (o.damage + c)
    const kill = target.hp <= o.damage ? p : target.hp <= o.damage + 1 ? p * c : 0
    return dmg + kill * KILL + p * (target.profile.hp - target.hp) * FOCUS
  }

  /** Reads the game as if a unit held a status. */
  private as<T>(u: Unit, status: Status, read: () => T): T {
    const was = u.status
    u.status = status
    try {
      return read()
    } finally {
      u.status = was
    }
  }

  /** Reads the game as if a unit stood on another tile. */
  private moved<T>(u: Unit, at: Point, read: () => T): T {
    const was = u.at
    u.at = at
    try {
      return read()
    } finally {
      u.at = was
    }
  }
}

/** The direction from one tile to another, each axis as -1, 0 or 1. */
const toward = (from: Point, to: Point): Point => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) })
