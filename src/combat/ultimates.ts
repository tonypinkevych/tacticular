import { distance, ORTHOGONAL, type Point, plus, same } from "../map/point"
import { clear } from "../map/sight"
import { blocksMove } from "../map/tile"
import type { Game } from "../mission/game"
import { type Action, check } from "../mission/orders"
import type { Unit } from "../units/unit"

type Ultimate = Extract<Action, { type: "ultimate" }>

/** Combos that make an ultimate ready. */
export const READY = 2

/** Tiles the Vanguard's Breach dashes at most. */
const BREACH = 3

/** The ultimate of each class: ready after 2 combos landed or set up in a mission, then it ends the turn. */
export class Ultimates {
  constructor(private readonly game: Game) {}

  /** Adds a combo to the shooter's charge and to the charge of the teammate whose status it used. */
  charge(shooter: Unit, by: string | null): void {
    for (const u of [shooter, this.game.units.find((x) => x.id === by && x !== shooter)])
      if (u && u.side === "squad") u.charge = Math.min(READY, u.charge + 1)
  }

  use(u: Unit, a: Ultimate): void {
    const game = this.game,
      combat = game.combat,
      kind = u.profile.ultimate
    check(!!kind, "ability")
    check(u.charge >= READY, "charge")
    game.log.push({ key: "log.ultimate", params: { unit: u.id, name: kind ?? "" } })
    let refund = false
    switch (kind) {
      case "breach": {
        const path = this.line(u, a.to)
        game.orders.walk(u, path)
        u.moved = true
        const hit = new Set<Unit>()
        for (const p of path)
          for (const d of ORTHOGONAL) {
            const f = game.unitAt(plus(p, d))
            if (!f || f.side === u.side || hit.has(f) || path.some((q) => same(q, f.at))) continue
            hit.add(f)
            combat.push(f, p)
            if (f.alive()) game.tactics.put(f, "staggered", u)
          }
        break
      }
      case "killshot": {
        const t = game.unit(a.target ?? "")
        check(t.alive() && t.side !== u.side && combat.canShoot(u, t), "target")
        combat.fire(u, t, { pierce: true, more: 3 })
        refund = !t.alive()
        break
      }
      case "lockdown":
        for (const f of game.foes(u))
          if (distance(u.at, f.at) <= u.profile.range && clear(game.board, u.at, f.at))
            game.tactics.put(f, "suppressed", u)
        break
      case "barrage":
        for (const f of game.foes(u)) if (distance(u.at, f.at) <= 2) game.tactics.put(f, "exposed", u)
        for (const x of game.allies(u)) x.hp = Math.min(x.profile.hp, x.hp + 2)
        break
      case "whirlwind":
        for (const f of game.foes(u)) if (f.alive() && distance(u.at, f.at) <= 1) combat.fire(u, f)
        break
    }
    u.charge = 0
    u.ap = refund ? 1 : 0
  }

  /** The free tiles of a straight dash to a tile 1 to 3 tiles away. */
  private line(u: Unit, to: Point | undefined): Point[] {
    check(!!to, "place")
    const dx = Math.sign(to.x - u.at.x),
      dy = Math.sign(to.y - u.at.y),
      n = distance(u.at, to)
    check((dx === 0) !== (dy === 0) && n >= 1 && n <= BREACH, "place")
    const path = Array.from({ length: n }, (_, i) => ({ x: u.at.x + dx * (i + 1), y: u.at.y + dy * (i + 1) }))
    check(
      path.every((p) => this.game.board.inside(p) && !blocksMove(this.game.board.at(p)) && !this.game.unitAt(p)),
      "unreachable",
    )
    return path
  }
}
