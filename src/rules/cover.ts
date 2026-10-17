import { coverOf, inside, ORTHOGONAL, plus, tileAt } from "./grid"
import { sees } from "./sight"
import type { Game, Point, Unit } from "./types"

/** Best cover a target tile has against an attack from a point on that cover's side: 0 means the target is flanked. */
export function coverAgainst(game: Game, target: Point, from: Point): number {
  const p = coverTile(game, target, from)
  return p ? coverAt(game, p) : 0
}

/** The tile that gives a target its best cover against an attack from a point, if any. */
export function coverTile(game: Game, target: Point, from: Point): Point | null {
  const v = { x: from.x - target.x, y: from.y - target.y }
  let best: Point | null = null
  for (const d of ORTHOGONAL) {
    const p = plus(target, d)
    if (v.x * d.x + v.y * d.y <= 0 || coverAt(game, p) === 0) continue
    if (!best || coverAt(game, p) > coverAt(game, best)) best = p
  }
  return best
}

/** Damages cover on a tile: high cover becomes low, low cover is gone; walls and doors stay. */
export function breakCover(game: Game, p: Point): void {
  if (!inside(game.board, p)) return
  const i = p.y * game.board.width + p.x
  const tile = game.board.tiles[i]
  if (tile === "low") game.board.tiles[i] = "floor"
  if (tile === "high") game.board.tiles[i] = "low"
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
