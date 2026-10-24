import { Dice } from "../combat/dice"
import { Board } from "./board"
import { AROUND, key, type Point, plus } from "./point"
import { blocksMove, type Tile } from "./tile"

const SIZE = 8

/** The 8×8 map a seed gives: cover in lines and pairs, buildings, forest, water and barrels between open start rows. */
export function terrain(seed: number): Board {
  for (let attempt = 0; ; attempt++) {
    const dice = new Dice({ rng: seed * 7919 + attempt * 104729 })
    const board = draft(dice)
    if (cover(board) >= 8 && connected(board)) return board
  }
}

function draft(dice: Dice): Board {
  const board = new Board(SIZE, SIZE)
  if (dice.random() < 0.5) {
    const x = dice.between(1, 6)
    for (let y = 0; y < SIZE; y++) board.set({ x, y }, "road")
  }
  const pieces: [Tile, Point[]][] = [
    ["house", [{ x: 0, y: 0 }]],
    [
      "house",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    ],
    [
      "bags",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    ],
    [
      "bags",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    ],
    [
      "bags",
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
    ],
    [
      "rock",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    ],
    ["rock", [{ x: 0, y: 0 }]],
    [
      "forest",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    ],
    [
      "forest",
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    ],
    [
      "water",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    ],
    ["rubble", [{ x: 0, y: 0 }]],
    ["barrel", [{ x: 0, y: 0 }]],
  ]
  const count = dice.between(8, 11)
  for (let n = 0, tries = 0; n < count && tries < 200; tries++) {
    const [tile, shape] = dice.pick(pieces)
    if (tile === "water" && board.tiles.includes("water")) continue
    const at = { x: dice.between(0, SIZE - 2), y: dice.between(1, SIZE - 3) }
    const cells = shape.map((d) => plus(at, d))
    const solid = blocksMove(tile)
    if (
      !cells.every(
        (c) => board.inside(c) && board.at(c) !== "house" && (!solid || (c.y > 0 && c.y < SIZE - 1)) && open(board, c),
      )
    )
      continue
    for (const c of cells) board.set(c, tile)
    n++
  }
  return board
}

const open = (board: Board, p: Point): boolean => board.at(p) === "grass" || board.at(p) === "road"

function cover(board: Board): number {
  return board.tiles.filter((t) => t === "bags" || t === "rock" || t === "house" || t === "forest").length
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
