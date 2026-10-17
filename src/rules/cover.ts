import { coverOf, inside, ORTHOGONAL, plus, tileAt } from "./grid"
import { sees } from "./sight"
import type { Game, Point, Unit } from "./types"

/** Best cover a target tile has against an attack from a point: 0 means the target is flanked. */
export function coverAgainst(game: Game, target: Point, from: Point): number {
  const v = { x: from.x - target.x, y: from.y - target.y }
  let best = 0
  for (const d of ORTHOGONAL) {
    const along = v.x * d.x + v.y * d.y
    const across = Math.abs(v.x * d.y - v.y * d.x)
    if (along <= 0 || along < across) continue
    best = Math.max(best, coverAt(game, plus(target, d)))
  }
  return best
}

export function inCover(game: Game, p: Point): boolean {
  return ORTHOGONAL.some((d) => coverAt(game, plus(p, d)) > 0)
}

/** Cover a tile gives; the board edge gives none. */
export function coverAt(game: Game, p: Point): number {
  return inside(game.board, p) ? coverOf(tileAt(game, p)) : 0
}

/** Foes that see a unit and have no cover of it between them: they flank it. */
export function flankers(game: Game, u: Unit, foes: Unit[]): Unit[] {
  return foes.filter((f) => coverAgainst(game, u.pos, f.pos) === 0 && sees(game, f, u.pos))
}
