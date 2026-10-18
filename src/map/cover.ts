import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"
import { ORTHOGONAL, type Point, plus, same } from "./point"
import { coverOf } from "./tile"

/** The cover tiles of a game's board give to units next to them. */
export class Cover {
  constructor(private readonly game: Game) {}

  /** Best cover a target tile has against an attack from a point on that cover's side: 0 means the target is flanked. */
  against(target: Point, from: Point): number {
    const p = this.tile(target, from)
    return p ? this.shelter(target, p) : 0
  }

  /**
   * The tile that gives a target its cover against a shooter at a point, if any. The shooter fires from the
   * step-out tile that leaves the least cover; a cover tile protects only against a shooter past its line.
   */
  tile(target: Point, from: Point): Point | null {
    let worst: Point | undefined
    for (const a of this.game.sight.peeks(from)) {
      if (!same(a, from) && !this.game.sight.clear(a, target)) continue
      const p = this.facing(target, a)
      if (!p) return null
      if (worst === undefined || this.shelter(target, p) < this.shelter(target, worst)) worst = p
    }
    return worst ?? null
  }

  /** Cover a tile gives a unit standing next to it; roof tiles give none to a unit on the roof. */
  shelter(at: Point, p: Point): number {
    return this.game.tile(at) === "roof" && this.game.tile(p) === "roof" ? 0 : this.at(p)
  }

  /** Cover a tile gives; the board edge gives none. */
  at(p: Point): number {
    return this.game.board.inside(p) ? coverOf(this.game.tile(p)) : 0
  }

  /** True when any side of the tile gives cover. */
  covered(p: Point): boolean {
    return ORTHOGONAL.some((d) => this.shelter(p, plus(p, d)) > 0)
  }

  /** Foes that see a unit and have no cover of it between them: they flank it. */
  flankers(u: Unit, foes: Unit[]): Unit[] {
    return foes.filter((f) => this.against(u.pos, f.pos) === 0 && this.game.sight.sees(f, u.pos))
  }

  private facing(target: Point, from: Point): Point | null {
    const v = { x: from.x - target.x, y: from.y - target.y }
    let best: Point | null = null
    for (const d of ORTHOGONAL) {
      const p = plus(target, d)
      if (v.x * d.x + v.y * d.y < 2 || this.shelter(target, p) === 0) continue
      if (!best || this.shelter(target, p) > this.shelter(target, best)) best = p
    }
    return best
  }
}
