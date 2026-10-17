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

/** Cells of the unit sheet, one figure per kind. */
export const UNIT_CELLS: Record<Kind, Cell> = {
  vanguard: [0, 0],
  ranger: [1, 0],
  warden: [2, 0],
  cleric: [3, 0],
  rogue: [4, 0],
  mage: [5, 0],
  orc: [6, 0],
  bomber: [7, 0],
  ogre: [8, 0],
  shieldwall: [9, 0],
  assassin: [10, 0],
  warchief: [11, 0],
  whisperer: [12, 0],
}

/** Cells of the 1-bit sheet for action bar slots, by slot id. */
export const SLOT_CELLS: Record<string, Cell> = {
  "weapon:shotgun": [39, 9],
  "weapon:longbow": [42, 9],
  "weapon:repeater": [40, 9],
  "weapon:crossbow": [41, 9],
  "weapon:dagger": [24, 11],
  "weapon:bolt": [38, 9],
  "weapon:axes": [37, 9],
  "weapon:knives": [25, 11],
  "ability:charge": [29, 21],
  "ability:volley": [26, 11],
  "ability:bulwark": [40, 3],
  "ability:heal": [43, 10],
  "ability:ward": [38, 3],
  "ability:vanish": [24, 14],
  "ability:fear": [38, 14],
  "ability:blink": [28, 12],
  "ability:rouse": [36, 13],
  "ability:shove": [29, 20],
  "ability:spot": [37, 11],
  "ability:rally": [24, 13],
  "item:flask": [28, 11],
  "item:smoke": [43, 8],
  "item:stone": [38, 16],
  overwatch: [35, 12],
  hunker: [37, 4],
  reload: [41, 20],
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

/** A pixel sheet, tinted once per color and drawn crisp at any whole scale. */
export class Sprites {
  readonly loaded: Promise<void>
  private sheet = new Image()
  private tinted = new Map<string, HTMLCanvasElement>()

  constructor(src: string) {
    this.sheet.src = src
    this.loaded = this.sheet.decode()
  }

  /** Draws a cell; a color multiplies it, so white takes the color and grey a darker shade; null draws it as is. */
  draw(ctx: CanvasRenderingContext2D, cell: Cell, color: string | null, x: number, y: number, size: number): void {
    if (!this.sheet.complete || this.sheet.naturalWidth === 0) return
    ctx.imageSmoothingEnabled = false
    const from = color ? this.tint(color) : this.sheet
    ctx.drawImage(from, cell[0] * TILE, cell[1] * TILE, TILE, TILE, x, y, size, size)
  }

  private tint(color: string): HTMLCanvasElement {
    const ready = this.tinted.get(color)
    if (ready) return ready
    const c = document.createElement("canvas")
    c.width = this.sheet.naturalWidth
    c.height = this.sheet.naturalHeight
    const g = c.getContext("2d")!
    g.drawImage(this.sheet, 0, 0)
    g.globalCompositeOperation = "multiply"
    g.fillStyle = color
    g.fillRect(0, 0, c.width, c.height)
    g.globalCompositeOperation = "destination-in"
    g.drawImage(this.sheet, 0, 0)
    this.tinted.set(color, c)
    return c
  }
}

export const sprites = new Sprites(`${import.meta.env.BASE_URL}sprites/1bit.png`)

export const figures = new Sprites(`${import.meta.env.BASE_URL}sprites/units.png`)

/** Untinted parts of the unit figures: visors, guns, eyes. */
export const gear = new Sprites(`${import.meta.env.BASE_URL}sprites/units-gear.png`)
