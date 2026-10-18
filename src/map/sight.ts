import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"
import { area, distance, key, ORTHOGONAL, type Point, plus } from "./point"
import { blocksSight, climb, high, type Tile, walkable } from "./tile"

/** Who sees what on a game's board. */
export class Sight {
  constructor(private readonly game: Game) {}

  /** True when no wall, high cover or closed door lies strictly between the two tiles, nor a roof between two ground tiles. */
  clear(a: Point, b: Point): boolean {
    const over = this.game.tile(a) === "roof" || this.game.tile(b) === "roof"
    const blocks = (t: Tile) => blocksSight(t) || (t === "roof" && !over)
    const open = (from: Point, to: Point) => line(from, to).every((p) => !blocks(this.game.tile(p)))
    return open(a, b) || open(b, a)
  }

  /** Tiles a unit can look from: its own, and the open side tiles when it stands next to cover. */
  peeks(p: Point): Point[] {
    const sides = ORTHOGONAL.map((d) => plus(p, d))
    if (!sides.some((s) => this.game.cover.shelter(p, s) > 0)) return [p]
    return [p, ...sides.filter((s) => walkable(this.game.tile(s)) && climb(this.game.tile(p), this.game.tile(s)))]
  }

  /** True when one of the two units, never both, can step out from cover and see the other. */
  line(from: Point, to: Point, targetPeeks = true): boolean {
    if (this.peeks(from).some((a) => this.clear(a, to))) return true
    return targetPeeks && this.peeks(to).some((b) => this.clear(from, b))
  }

  /** How far a unit sees: 2 more from high ground. */
  range(u: Unit): number {
    return u.vision + (high(this.game.tile(u.pos)) ? 2 : 0)
  }

  sees(viewer: Unit, target: Point, radius = this.range(viewer)): boolean {
    return distance(viewer.pos, target) <= radius && this.line(viewer.pos, target)
  }

  /** Keys of the tiles a unit sees now. */
  tiles(viewer: Unit): Set<number> {
    const out = new Set<number>()
    const radius = this.range(viewer)
    for (const p of area(viewer.pos, radius)) {
      if (!this.game.board.inside(p) || distance(viewer.pos, p) > radius) continue
      if (this.line(viewer.pos, p, false)) out.add(key(p))
    }
    return out
  }
}

/** The tiles strictly between two points on a Bresenham line. */
function line(a: Point, b: Point): Point[] {
  const out: Point[] = []
  let { x, y } = a
  const dx = Math.abs(b.x - x)
  const dy = -Math.abs(b.y - y)
  const sx = x < b.x ? 1 : -1
  const sy = y < b.y ? 1 : -1
  let err = dx + dy
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
    out.push({ x, y })
  }
  out.pop()
  return out
}
