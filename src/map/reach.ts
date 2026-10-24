import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"
import { AROUND, key, type Point, plus } from "./point"
import { blocksMove, rough } from "./tile"

/** The tiles a unit can walk to with one or two moves, and the way to each. */
export class Reach {
  private constructor(private readonly ways: Map<number, Point[]>) {}

  static of(game: Game, unit: Unit, moves: number): Reach {
    let ways = Reach.step(game, unit, unit.at, [])
    for (let m = 1; m < moves; m++) {
      const next = new Map(ways)
      for (const way of ways.values())
        for (const [k, w] of Reach.step(game, unit, way[way.length - 1], way))
          if (!next.has(k) || next.get(k)!.length > w.length) next.set(k, w)
      ways = next
    }
    ways.delete(key(unit.at))
    return new Reach(ways)
  }

  /** One move from a tile, by breadth: rough ground ends it unless the unit walks through. */
  private static step(game: Game, unit: Unit, from: Point, before: Point[]): Map<number, Point[]> {
    const out = new Map<number, Point[]>()
    let edge: Point[][] = [before]
    const start = before.length ? before[before.length - 1] : from
    const seen = new Set([key(start)])
    for (let s = 0; s < unit.steps(); s++) {
      const next: Point[][] = []
      for (const way of edge) {
        const at = way.length ? way[way.length - 1] : from
        if (way.length > before.length && rough(game.board.at(at)) && !unit.profile.rough) continue
        for (const d of AROUND) {
          const p = plus(at, d)
          if (seen.has(key(p)) || !game.board.inside(p) || blocksMove(game.board.at(p)) || game.unitAt(p)) continue
          seen.add(key(p))
          const w = [...way, p]
          out.set(key(p), w)
          next.push(w)
        }
      }
      edge = next
    }
    return out
  }

  tiles(): Point[] {
    return [...this.ways.values()].map((w) => w[w.length - 1])
  }

  has(p: Point): boolean {
    return this.ways.has(key(p))
  }

  /** The tiles walked to reach a tile, the tile included. */
  path(p: Point): Point[] {
    return this.ways.get(key(p)) ?? []
  }
}
