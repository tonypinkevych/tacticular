import { Dice } from "../combat/dice"
import { Board } from "./board"
import { AROUND, key, type Point, plus } from "./point"
import { blocksMove, type Tile } from "./tile"

const SIZE = 8

/** The kind of land a map is drawn from. */
export type Biome = "village" | "forest" | "ruins" | "field"

export const BIOMES: Biome[] = ["village", "forest", "ruins", "field"]

type Piece = [Tile, Point[]]

const ONE: Point[] = [{ x: 0, y: 0 }]
const ROW2: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
]
const COL2: Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: 1 },
]
const ELL: Point[] = [...ROW2, { x: 0, y: 1 }]
const DIAG: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

/** What each biome lays first, the pieces it scatters and how many, and the least of each tile it must hold. */
const LAYOUTS: Record<
  Biome,
  { base: (board: Board, dice: Dice) => void; pieces: Piece[]; count: [number, number]; least: [Tile[], number][] }
> = {
  village: {
    base: (board, dice) => {
      const x = dice.between(1, 6),
        y = dice.between(2, 5)
      for (let i = 0; i < SIZE; i++) {
        board.set({ x, y: i }, "road")
        board.set({ x: i, y }, "road")
      }
    },
    pieces: [
      ["house", ONE],
      ["house", ROW2],
      ["house", COL2],
      ["house", ROW2],
      ["barrel", ONE],
      ["bags", ROW2],
      ["forest", ONE],
    ],
    count: [7, 9],
    least: [
      [["house"], 3],
      [["road"], 6],
    ],
  },
  forest: {
    base: (board, dice) => {
      const y = dice.between(3, 4),
        fords = dice.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 2)
      for (let x = 0; x < SIZE; x++) if (!fords.includes(x)) board.set({ x, y }, "water")
    },
    pieces: [
      ["forest", ELL],
      ["forest", ELL],
      ["forest", DIAG],
      ["forest", ROW2],
      ["forest", ONE],
      ["rock", ONE],
      ["bags", ROW2],
    ],
    count: [8, 10],
    least: [
      [["water"], 5],
      [["forest"], 6],
    ],
  },
  ruins: {
    base: () => {},
    pieces: [
      ["rock", ROW2],
      ["rock", ONE],
      ["cracked", ONE],
      ["cracked", COL2],
      ["rubble", ONE],
      ["rubble", ROW2],
      ["house", ONE],
      ["barrel", ONE],
    ],
    count: [9, 11],
    least: [
      [["rubble"], 3],
      [["rock", "cracked"], 3],
    ],
  },
  field: {
    base: (board, dice) => {
      for (const y of [2, 5]) {
        const gap = dice.between(2, 4)
        for (let x = 0; x < SIZE; x++)
          if (x !== gap && x !== gap + 1 && dice.random() < 0.85) board.set({ x, y }, "bags")
      }
    },
    pieces: [
      ["forest", ROW2],
      ["forest", ONE],
      ["barrel", ONE],
      ["rock", ONE],
      ["rubble", ONE],
    ],
    count: [3, 5],
    least: [[["bags"], 6]],
  },
}

/** The 8×8 map a seed gives in a biome: its base, then pieces between open start rows, with every open tile reachable. */
export function terrain(seed: number, biome: Biome): Board {
  for (let attempt = 0; ; attempt++) {
    const dice = new Dice({ rng: seed * 7919 + attempt * 104729 })
    const board = draft(dice, biome)
    const holds = LAYOUTS[biome].least.every(([kinds, n]) => board.tiles.filter((t) => kinds.includes(t)).length >= n)
    if (holds && cover(board) >= 8 && connected(board)) return board
  }
}

function draft(dice: Dice, biome: Biome): Board {
  const board = new Board(SIZE, SIZE),
    layout = LAYOUTS[biome]
  layout.base(board, dice)
  const count = dice.between(...layout.count)
  for (let n = 0, tries = 0; n < count && tries < 200; tries++) {
    const [tile, shape] = dice.pick(layout.pieces)
    const at = { x: dice.between(0, SIZE - 2), y: dice.between(1, SIZE - 3) }
    const cells = shape.map((d) => plus(at, d))
    const solid = blocksMove(tile)
    if (!cells.every((c) => board.inside(c) && (!solid || (c.y > 0 && c.y < SIZE - 1)) && open(board, c))) continue
    for (const c of cells) board.set(c, tile)
    n++
  }
  return board
}

const open = (board: Board, p: Point): boolean => board.at(p) === "grass" || board.at(p) === "road"

function cover(board: Board): number {
  return board.tiles.filter((t) => t === "bags" || t === "rock" || t === "cracked" || t === "house" || t === "forest")
    .length
}

/** Whether every tile a unit can stand on can be walked to from every other. */
function connected(board: Board): boolean {
  const all: Point[] = []
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!blocksMove(board.at({ x, y }))) all.push({ x, y })
  const seen = new Set([key(all[0])]),
    queue = [all[0]]
  while (queue.length) {
    const p = queue.shift() as Point
    for (const d of AROUND) {
      const q = plus(p, d)
      if (board.inside(q) && !blocksMove(board.at(q)) && !seen.has(key(q))) {
        seen.add(key(q))
        queue.push(q)
      }
    }
  }
  return seen.size === all.length
}
