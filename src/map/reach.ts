import type { Game } from "../mission/game"
import type { Side, Unit } from "../units/unit"
import { AROUND, key, type Point, plus } from "./point"
import { passable } from "./tile"

const state = (p: Point, parity: number) => key(p) * 2 + parity

const point = (s: number): Point => {
  const k = Math.floor(s / 2)
  return { x: k % 1000, y: Math.floor(k / 1000) }
}

/**
 * The tiles a unit can walk to within a budget, with their cost and the way there; allies can be passed,
 * nobody can be stood on. A straight step onto low cover vaults it and lands on the tile behind, for 2
 * (1 for the Assault). A ladder, mud, or a tile only the unit's class can enter costs 1 more.
 */
export class Reach {
  readonly cost = new Map<number, number>()
  private readonly end = new Map<number, number>()
  private readonly prev = new Map<number, number>()

  constructor(
    private readonly game: Game,
    private readonly unit: Unit,
    private readonly budget: number,
    private readonly side: Side = unit.side,
  ) {}

  /** The reach worked out in full. */
  static of(game: Game, unit: Unit, budget: number, side: Side = unit.side): Reach {
    return new Reach(game, unit, budget, side).spread()
  }

  /** The steps to a tile, without the start; empty when it is out of reach. */
  path(to: Point): Point[] {
    let s = this.end.get(key(to))
    const out: Point[] = []
    while (s !== undefined && s !== state(this.unit.pos, 0)) {
      out.unshift(point(s))
      s = this.prev.get(s)
    }
    return out
  }

  private spread(): Reach {
    const { game, unit, budget, side } = this
    const best = new Map<number, number>()
    const buckets: number[][] = [[state(unit.pos, 0)]]
    best.set(state(unit.pos, 0), 0)
    for (let cost = 0; cost < buckets.length; cost++) {
      for (const s of buckets[cost] ?? []) {
        if (best.get(s) !== cost) continue
        const p = point(s)
        const parity = s % 2
        for (const step of AROUND) {
          const diagonal = step.x !== 0 && step.y !== 0
          const vault = !diagonal && game.tile(plus(p, step)) === "low" && unit.kind !== "warden"
          const next = vault ? plus(plus(p, step), step) : plus(p, step)
          const tile = game.tile(next)
          if (!unit.enters(tile) || !unit.climbs(game.tile(p), tile)) continue
          if (
            diagonal &&
            (!unit.enters(game.tile({ x: next.x, y: p.y })) || !unit.enters(game.tile({ x: p.x, y: next.y })))
          )
            continue
          const other = game.unitAt(next)
          if (other && other.side !== side) continue
          const nextCost =
            cost +
            (diagonal ? (parity ? 2 : 1) : vault && unit.kind !== "vanguard" ? 2 : 1) +
            (tile === "ladder" || tile === "mud" || !passable(tile) ? 1 : 0)
          if (nextCost > budget) continue
          const ns = state(next, diagonal ? 1 - parity : parity)
          if ((best.get(ns) ?? Infinity) <= nextCost) continue
          best.set(ns, nextCost)
          this.prev.set(ns, s)
          if (!buckets[nextCost]) buckets[nextCost] = []
          buckets[nextCost].push(ns)
        }
      }
    }
    for (const [s, c] of best) {
      const k = Math.floor(s / 2)
      if (c < (this.cost.get(k) ?? Infinity)) {
        this.cost.set(k, c)
        this.end.set(k, s)
      }
    }
    for (const k of [...this.cost.keys()]) {
      const other = game.unitAt(point(k * 2))
      if (other && other !== unit) this.cost.delete(k)
    }
    return this
  }
}
