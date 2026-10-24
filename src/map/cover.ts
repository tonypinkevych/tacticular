import type { Board } from "./board"
import type { Point } from "./point"
import { coverOf } from "./tile"

/** The percent the cover of a target takes from a shot fired from a tile; 0 means the target is flanked. */
export function cover(board: Board, target: Point, from: Point): number {
  const around = shelter(board, target, from)
  return Math.max(around ? coverOf(board.at(around)) : 0, board.at(target) === "forest" ? 20 : 0)
}

/** The tile next to a target that shields it from a shot fired from a tile, if any. */
export function shelter(board: Board, target: Point, from: Point): Point | null {
  const best = facing(target, from).sort((a, b) => coverOf(board.at(b)) - coverOf(board.at(a)))[0]
  return best && coverOf(board.at(best)) > 0 ? best : null
}

function facing(target: Point, from: Point): Point[] {
  const sides: Point[] = []
  if (from.x !== target.x) sides.push({ x: target.x + Math.sign(from.x - target.x), y: target.y })
  if (from.y !== target.y) sides.push({ x: target.x, y: target.y + Math.sign(from.y - target.y) })
  return sides
}
