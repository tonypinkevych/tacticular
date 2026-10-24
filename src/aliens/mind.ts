import type { Odds } from "../combat/combat"
import { cover } from "../map/cover"
import { adjacent, distance, ORTHOGONAL, type Point, plus, same } from "../map/point"
import { blocksMove } from "../map/tile"
import type { Game } from "../mission/game"
import type { Action } from "../mission/orders"
import type { Unit } from "../units/unit"

/** One choice of a unit: the action it starts with and what the plan is worth. */
interface Plan {
  action: Action
  value: number
}

const KILL = 3

/**
 * The player of a side: for each unit with AP it weighs where to stand and what to do there, through the
 * rules, and gives the first action of the best plan. Either side can be played; the aliens always are.
 */
export class Mind {
  constructor(private readonly game: Game) {}

  /** The next action of the side in turn; the turn ends when no unit has anything worth doing. */
  next(): Action {
    const game = this.game
    const side = game.phase === "squad" ? "squad" : "enemy"
    const ready = game.units
      .filter((u) => u.side === side && u.alive() && u.ap > 0)
      .sort((a, b) => Number(b.kind === "commander") - Number(a.kind === "commander"))
    for (const u of ready) {
      const plan = this.plan(u)
      if (plan) return plan.action
    }
    return { type: "endTurn" }
  }

  /** The best plan of a unit, or none when holding still is best. */
  private plan(u: Unit): Plan | null {
    const game = this.game
    const plans: Plan[] = []
    const stay = this.ground(u, u.at)
    for (const a of this.attacks(u, u.at)) plans.push({ action: a.action, value: a.value + stay })
    const one = game.reach(u, 1)
    for (const t of one.tiles()) {
      const after = u.ap > 1 ? Math.max(0, ...this.attacks(u, t).map((a) => a.value)) : 0
      plans.push({ action: { type: "move", unit: u.id, to: t }, value: after + this.ground(u, t) + this.closer(u, t) })
    }
    if (u.ap > 1)
      for (const t of game.reach(u, 2).tiles())
        if (!one.has(t))
          plans.push({
            action: { type: "move", unit: u.id, to: t },
            value: this.ground(u, t) + this.closer(u, t) - 0.3,
          })
    const best = plans.sort((a, b) => b.value - a.value)[0]
    const idle = stay + this.closer(u, u.at)
    if (best && best.value > idle + 0.05) return best
    if (u.profile.range > 0 && !u.profile.melee && !u.overwatch)
      return { action: { type: "overwatch", unit: u.id }, value: idle }
    return null
  }

  /** What standing on a tile is worth: its cover against each foe, less the damage foes can deal there. */
  private ground(u: Unit, at: Point): number {
    const foes = this.game.foes(u)
    if (!foes.length) return 0
    return this.moved(u, at, () => {
      const shelter = foes.reduce((s, f) => s + cover(this.game.board, at, f.at) / 40, 0) / foes.length
      const threat = foes.reduce(
        (s, f) => s + (this.game.combat.canShoot(f, u) ? this.worth(this.game.combat.odds(f, u), u) : 0),
        0,
      )
      const marked = this.game.marks.some(
        (m) => m.tiles.some((p) => same(p, at)) && this.game.unit(m.unit).side !== u.side,
      )
      return shelter * 0.8 - threat * 0.5 - (marked ? 3 : 0) - (this.game.board.at(at) === "fire" ? 1 : 0)
    })
  }

  /** A pull toward the nearest foe past the unit's range; for aliens it grows each round after the sixth. */
  private closer(u: Unit, at: Point): number {
    const foes = this.game.foes(u)
    if (!foes.length) return 0
    const gap = Math.min(...foes.map((f) => distance(f.at, at)))
    return (
      -Math.max(0, gap - u.profile.range) * (u.side === "enemy" ? 0.45 + 0.15 * Math.max(0, this.game.round - 6) : 0.45)
    )
  }

  /** The attacks a unit can make from a tile, with what each is worth. */
  private attacks(u: Unit, at: Point): Plan[] {
    const game = this.game,
      combat = game.combat,
      out: Plan[] = []
    const foes = game.foes(u)
    for (const f of foes)
      if (combat.canShoot(u, f, at))
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
          if (missing >= 2 && (a === u || adjacent(a.at, at))) skill(Math.min(2, missing) * 0.9, { target: a.id })
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
    return dmg + kill * KILL
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
