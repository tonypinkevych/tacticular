import type { Biome, Kind, Point, Tile, Unit } from "../rules/types"
import { has } from "../rules/units"

/** One cell of the Kenney 1-Bit sheet, as [column, row]. */
export type Cell = [number, number]

export const TILE = 16

/** The colors of a biome on its dark ground. */
export interface Palette {
  void: string
  ground: string
  dot: string
  tuft: string
  low: string
  high: string
  wall: string
  door: string
  water: string
  wave: string
  bridge: string
}

export const PALETTES: Record<Biome, Palette> = {
  forest: {
    void: "#0d0b10",
    ground: "#1b1720",
    dot: "#3a3346",
    tuft: "#2c3f33",
    low: "#7e9a5c",
    high: "#4fa06c",
    wall: "#6e6278",
    door: "#b07a4c",
    water: "#16304a",
    wave: "#3f78b0",
    bridge: "#8a6a48",
  },
  village: {
    void: "#0e0b0c",
    ground: "#1f191b",
    dot: "#45383a",
    tuft: "#3d3a28",
    low: "#b88a58",
    high: "#62a05c",
    wall: "#b4766a",
    door: "#d29a5a",
    water: "#172e44",
    wave: "#4a80b4",
    bridge: "#9a7650",
  },
  town: {
    void: "#0b0b0e",
    ground: "#1a1a20",
    dot: "#3a3a46",
    tuft: "#2a2a34",
    low: "#a88c68",
    high: "#8c94a8",
    wall: "#a4a2b4",
    door: "#c4925c",
    water: "#162a40",
    wave: "#4a7aaa",
    bridge: "#8e7454",
  },
}

/** A unit's color: blue for the squad, red for enemies, violet for a Dominated soldier. */
export const tone = (u: Unit): string => (has(u, "dominated") ? "#c08bff" : u.side === "squad" ? "#8ec5ff" : "#ff7a6b")

export const UNIT_CELLS: Record<Kind, Cell> = {
  vanguard: [28, 0],
  ranger: [26, 0],
  warden: [29, 0],
  cleric: [30, 1],
  rogue: [28, 1],
  mage: [26, 9],
  orc: [31, 3],
  bomber: [26, 2],
  ogre: [30, 6],
  shieldwall: [27, 0],
  assassin: [27, 1],
  warchief: [28, 3],
  whisperer: [26, 6],
}

const TUFTS: Cell[] = [
  [5, 0],
  [6, 0],
  [7, 0],
]
const COBBLES: Cell[] = [
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
]

const GLYPHS: Record<Biome, { low: Cell[]; high: Cell[]; wall: Cell }> = {
  forest: {
    low: [
      [5, 2],
      [0, 2],
    ],
    high: [
      [0, 1],
      [1, 1],
      [2, 1],
      [4, 1],
      [4, 2],
    ],
    wall: [16, 0],
  },
  village: {
    low: [
      [1, 3],
      [2, 3],
    ],
    high: [
      [4, 2],
      [2, 1],
      [0, 1],
    ],
    wall: [16, 0],
  },
  town: {
    low: [
      [7, 5],
      [6, 4],
    ],
    high: [
      [6, 5],
      [4, 2],
    ],
    wall: [17, 0],
  },
}

const hash = (p: Point): number => {
  const n = Math.imul(p.x * 374761393 + p.y * 668265263, 1274126177)
  return ((n ^ (n >>> 13)) >>> 0) % 1000
}

const one = (cells: Cell[], p: Point): Cell => cells[hash(p) % cells.length]

/** The glyph and color of a tile, or a dot for plain ground. */
export function glyph(biome: Biome, tile: Tile, p: Point): { cell: Cell; color: string } | "dot" | null {
  const c = PALETTES[biome]
  const g = GLYPHS[biome]
  switch (tile) {
    case "floor":
      if (biome === "town" && hash(p) < 350) return { cell: one(COBBLES, p), color: c.tuft }
      if (biome !== "town" && hash(p) < 220) return { cell: one(TUFTS, p), color: c.tuft }
      return "dot"
    case "low":
      return { cell: one(g.low, p), color: c.low }
    case "high":
      return { cell: one(g.high, p), color: c.high }
    case "wall":
      return { cell: g.wall, color: c.wall }
    case "door":
      return { cell: [3, 3], color: c.door }
    case "open":
      return { cell: [4, 3], color: c.door }
    case "water":
      return { cell: [8, 5], color: c.wave }
    case "bridge":
      return { cell: [4, 6], color: c.bridge }
  }
}

/** The 1-bit sheet, tinted once per color and drawn crisp at any whole scale. */
export class Sprites {
  readonly loaded: Promise<void>
  private sheet = new Image()
  private tinted = new Map<string, HTMLCanvasElement>()

  constructor(src: string) {
    this.sheet.src = src
    this.loaded = this.sheet.decode()
  }

  draw(ctx: CanvasRenderingContext2D, cell: Cell, color: string, x: number, y: number, size: number): void {
    if (!this.sheet.complete || this.sheet.naturalWidth === 0) return
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.tint(color), cell[0] * TILE, cell[1] * TILE, TILE, TILE, x, y, size, size)
  }

  private tint(color: string): HTMLCanvasElement {
    const ready = this.tinted.get(color)
    if (ready) return ready
    const c = document.createElement("canvas")
    c.width = this.sheet.naturalWidth
    c.height = this.sheet.naturalHeight
    const g = c.getContext("2d")!
    g.drawImage(this.sheet, 0, 0)
    g.globalCompositeOperation = "source-in"
    g.fillStyle = color
    g.fillRect(0, 0, c.width, c.height)
    this.tinted.set(color, c)
    return c
  }
}

export const sprites = new Sprites(`${import.meta.env.BASE_URL}sprites/1bit.png`)
