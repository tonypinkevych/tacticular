import type { Board } from "./board"
import { adjacent, type Point, same } from "./point"
import { blocksShot } from "./tile"

/** Whether a shot from one tile reaches another: no tile between them blocks it, except next to either end. */
export function clear(board: Board, from: Point, to: Point): boolean {
  const n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
  for (let i = 1; i < n; i++) {
    const p = { x: Math.round(from.x + ((to.x - from.x) * i) / n), y: Math.round(from.y + ((to.y - from.y) * i) / n) }
    if (same(p, from) || same(p, to) || adjacent(p, from) || adjacent(p, to)) continue
    if (blocksShot(board.at(p))) return false
  }
  return true
}
