import { coverAt } from "./cover"
import { area, blocksSight, distance, inside, key, ORTHOGONAL, plus, tileAt, walkable } from "./grid"
import type { Game, Point, Unit } from "./types"

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

/** True when no wall, high cover or closed door lies strictly between the two tiles. */
export function clear(game: Game, a: Point, b: Point): boolean {
  const open = (from: Point, to: Point) => line(from, to).every((p) => !blocksSight(tileAt(game, p)))
  return open(a, b) || open(b, a)
}

/** Tiles a unit can look from: its own, and the open side tiles when it stands next to cover. */
export function peeks(game: Game, p: Point): Point[] {
  const sides = ORTHOGONAL.map((d) => plus(p, d))
  if (!sides.some((s) => coverAt(game, s) > 0)) return [p]
  return [p, ...sides.filter((s) => walkable(tileAt(game, s)))]
}

export function lineOfSight(game: Game, from: Point, to: Point, targetPeeks = true): boolean {
  const ends = targetPeeks ? peeks(game, to) : [to]
  return peeks(game, from).some((a) => ends.some((b) => clear(game, a, b)))
}

export function sees(game: Game, viewer: Unit, target: Point, radius = viewer.vision): boolean {
  return distance(viewer.pos, target) <= radius && lineOfSight(game, viewer.pos, target)
}

export function visibleTiles(game: Game, viewer: Unit): Set<number> {
  const out = new Set<number>()
  for (const p of area(viewer.pos, viewer.vision)) {
    if (!inside(game.board, p) || distance(viewer.pos, p) > viewer.vision) continue
    if (lineOfSight(game, viewer.pos, p, false)) out.add(key(p))
  }
  return out
}
