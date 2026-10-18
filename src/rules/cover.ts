import { coverOf, inside, ORTHOGONAL, plus, same, tileAt } from "./grid"
import { clear, peeks, sees } from "./sight"
import type { Game, Point, Unit } from "./types"

/** Best cover a target tile has against an attack from a point on that cover's side: 0 means the target is flanked. */
export function coverAgainst(game: Game, target: Point, from: Point): number {
  const p = coverTile(game, target, from)
  return p ? shelter(game, target, p) : 0
}

/**
 * The tile that gives a target its cover against a shooter at a point, if any.
 *
 * The shooter fires from the step-out tile that leaves the least cover; a cover tile protects only against a
 * shooter past its line, not level with it.
 */
export function coverTile(game: Game, target: Point, from: Point): Point | null {
  let worst: Point | undefined
  for (const a of peeks(game, from)) {
    if (!same(a, from) && !clear(game, a, target)) continue
    const p = facing(game, target, a)
    if (!p) return null
    if (worst === undefined || shelter(game, target, p) < shelter(game, target, worst)) worst = p
  }
  return worst ?? null
}

function facing(game: Game, target: Point, from: Point): Point | null {
  const v = { x: from.x - target.x, y: from.y - target.y }
  let best: Point | null = null
  for (const d of ORTHOGONAL) {
    const p = plus(target, d)
    if (v.x * d.x + v.y * d.y < 2 || shelter(game, target, p) === 0) continue
    if (!best || shelter(game, target, p) > shelter(game, target, best)) best = p
  }
  return best
}

/** Cover a tile gives a unit standing next to it; roof tiles give none to a unit on the roof. */
export function shelter(game: Game, at: Point, p: Point): number {
  return tileAt(game, at) === "roof" && tileAt(game, p) === "roof" ? 0 : coverAt(game, p)
}

/** Damages cover on a tile: high cover and trees become low, low cover is gone; walls, doors and rocks stay. */
export function breakCover(game: Game, p: Point): void {
  if (!inside(game.board, p)) return
  const i = p.y * game.board.width + p.x
  const tile = game.board.tiles[i]
  if (tile === "low") game.board.tiles[i] = "floor"
  if (tile === "high" || tile === "tree") game.board.tiles[i] = "low"
}

export function inCover(game: Game, p: Point): boolean {
  return ORTHOGONAL.some((d) => shelter(game, p, plus(p, d)) > 0)
}

/** Cover a tile gives; the board edge gives none. */
export function coverAt(game: Game, p: Point): number {
  return inside(game.board, p) ? coverOf(tileAt(game, p)) : 0
}

/** Foes that see a unit and have no cover of it between them: they flank it. */
export function flankers(game: Game, u: Unit, foes: Unit[]): Unit[] {
  return foes.filter((f) => coverAgainst(game, u.pos, f.pos) === 0 && sees(game, f, u.pos))
}
