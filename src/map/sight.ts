import type { Board } from "./board"
import { adjacent, type Point, plus, same } from "./point"
import { blocksShot } from "./tile"

/**
 * Whether a shot from one tile reaches another: no tile between them blocks it. A blocking tile next to either
 * end lets the shot pass when that end can step out to an open side.
 */
export function clear(board: Board, from: Point, to: Point): boolean {
  const n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
  for (let i = 1; i < n; i++) {
    const p = { x: Math.round(from.x + ((to.x - from.x) * i) / n), y: Math.round(from.y + ((to.y - from.y) * i) / n) }
    if (same(p, from) || same(p, to) || !blocksShot(board.at(p))) continue
    if ((adjacent(p, from) && peeks(board, from, p)) || (adjacent(p, to) && peeks(board, to, p))) continue
    return false
  }
  return true
}

/** Whether a unit can step past a blocking tile next to it: a side tile is open, and so is the tile beyond it. */
function peeks(board: Board, at: Point, wall: Point): boolean {
  const d = { x: wall.x - at.x, y: wall.y - at.y }
  const open = (p: Point) => !blocksShot(board.at(p))
  if (d.x && d.y) return open(plus(at, { x: d.x, y: 0 })) || open(plus(at, { x: 0, y: d.y }))
  return [
    { x: d.y, y: d.x },
    { x: -d.y, y: -d.x },
  ].some((side) => open(plus(at, side)) && open(plus(plus(at, side), d)))
}
