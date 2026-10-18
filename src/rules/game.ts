import { observe } from "./stealth"
import type { Board, Game, Group, Tile, Unit } from "./types"

export interface Setup {
  seed: number
  board: Board
  units: Unit[]
  groups?: Group[]
}

export function newGame({ seed, board, units, groups = [] }: Setup): Game {
  const game: Game = {
    seed,
    rng: seed,
    round: 1,
    phase: "squad",
    board,
    units,
    zones: [],
    groups,
    explored: new Array(board.width * board.height).fill(false),
    noises: [],
    reactions: [],
    log: [],
    goal: { kind: "kill" },
    drop: null,
    drops: 0,
  }
  observe(game)
  return game
}

const LEGEND: Record<string, Tile> = {
  ".": "floor",
  ":": "low",
  H: "high",
  "#": "wall",
  "+": "door",
  "~": "water",
  "=": "bridge",
  ",": "floor",
  "^": "ridge",
  R: "roof",
  L: "ladder",
}

/** Reads a board from text rows; any unknown symbol is floor. */
export function parseBoard(rows: string[]): Board {
  const width = rows[0].length
  return {
    width,
    height: rows.length,
    tiles: rows
      .join("")
      .split("")
      .map((c) => LEGEND[c] ?? "floor"),
  }
}
