import type { Board } from "./board"
import { distance, type Point } from "./point"
import { coverOf } from "./tile"

/**
 * The damage the cover of a target cuts from a shot fired from a tile; 0 means the target is flanked.
 * A forest under the target cuts 2 unless the shooter stands next to it.
 */
export function cover(board: Board, target: Point, from: Point): number {
  const around = shelter(board, target, from)
  const forest = board.at(target) === "forest" && distance(target, from) > 1 ? 2 : 0
  return Math.max(around ? coverOf(board.at(around)) : 0, forest)
}

/** The tile next to a target that shields it from a shot fired from a tile, if any; a side counts from 2 tiles out on its axis. */
export function shelter(board: Board, target: Point, from: Point): Point | null {
  const best = facing(target, from).sort((a, b) => coverOf(board.at(b)) - coverOf(board.at(a)))[0]
  return best && coverOf(board.at(best)) > 0 ? best : null
}

function facing(target: Point, from: Point): Point[] {
  const sides: Point[] = []
  if (Math.abs(from.x - target.x) > 1) sides.push({ x: target.x + Math.sign(from.x - target.x), y: target.y })
  if (Math.abs(from.y - target.y) > 1) sides.push({ x: target.x, y: target.y + Math.sign(from.y - target.y) })
  return sides
}
