import { type Biome, Board } from "./board"
import type { Dice } from "./dice"
import { AROUND, key, type Point } from "./point"
import { blocksSight, climb, passable, type Tile } from "./tile"

export const SIZE = { width: 16, height: 16 }

const START = 3

/**
 * How a biome fills the map: river chance, house count, rooftop share, clutter, high cover share, fence lines,
 * groves, the share of high cover that is trees and rocks, grass patches and mud on river banks.
 */
interface Template {
  river: number
  houses: [number, number]
  roofs: number
  clutter: number
  high: number
  lines: number
  groves: boolean
  trees: number
  rocks: number
  grass: number
  mud: number
}

export const BIOMES: Biome[] = ["forest", "village", "town"]

const TEMPLATES: Record<Biome, Template> = {
  forest: {
    river: 0.5,
    houses: [0, 1],
    roofs: 0,
    clutter: 14,
    high: 0.7,
    lines: 0.05,
    groves: true,
    trees: 0.8,
    rocks: 0.2,
    grass: 4,
    mud: 0.4,
  },
  village: {
    river: 0.4,
    houses: [2, 3],
    roofs: 0.35,
    clutter: 24,
    high: 0.4,
    lines: 0.45,
    groves: false,
    trees: 0.5,
    rocks: 0.1,
    grass: 3,
    mud: 0.3,
  },
  town: {
    river: 0.2,
    houses: [3, 4],
    roofs: 0.35,
    clutter: 28,
    high: 0.25,
    lines: 0.2,
    groves: false,
    trees: 0.05,
    rocks: 0.1,
    grass: 1,
    mud: 0,
  },
}

/** The land of one map while it is laid out: river, houses, cover, grass and mud. */
class Terrain {
  constructor(
    private readonly dice: Dice,
    private readonly board: Board,
    private readonly template: Template,
  ) {}

  river(): void {
    const { dice: r, board: d } = this
    let x = r.between(Math.floor(d.width * 0.4), Math.floor(d.width * 0.6))
    const crossings = [
      r.between(2, Math.floor(d.height / 2) - 2),
      r.between(Math.floor(d.height / 2) + 1, d.height - 3),
    ]
    for (let y = 0; y < d.height; y++) {
      if (y > 0 && r.random() < 0.3) x = Math.min(d.width - 6, Math.max(5, x + r.pick([-1, 1])))
      const tile: Tile = crossings.includes(y) ? "bridge" : "water"
      d.set({ x, y }, tile)
      d.set({ x: x + 1, y }, tile)
    }
  }

  /** A house with doors, or a flat rooftop with a ladder on one side. */
  house(roof: boolean): void {
    const { dice: r, board: d } = this
    const w = r.between(4, 6)
    const h = r.between(3, 5)
    for (let tries = 0; tries < 30; tries++) {
      const x0 = r.between(START + 3, d.width - w - 1)
      const y0 = r.between(1, d.height - h - 1)
      let free = true
      for (let y = y0 - 1; y <= y0 + h && free; y++) {
        for (let x = x0 - 1; x <= x0 + w && free; x++) if (d.at({ x, y }) !== "floor") free = false
      }
      if (!free) continue
      if (roof) {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) d.set({ x, y }, "roof")
        const ladder = r.pick([
          { x: x0 - 1, y: r.between(y0, y0 + h - 1) },
          { x: x0 + w, y: r.between(y0, y0 + h - 1) },
          { x: r.between(x0, x0 + w - 1), y: y0 - 1 },
          { x: r.between(x0, x0 + w - 1), y: y0 + h },
        ])
        d.set(ladder, "ladder")
        return
      }
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1
          d.set({ x, y }, edge ? "wall" : "floor")
        }
      }
      const sides = r.shuffle([
        { x: x0, y: r.between(y0 + 1, y0 + h - 2) },
        { x: x0 + w - 1, y: r.between(y0 + 1, y0 + h - 2) },
        { x: r.between(x0 + 1, x0 + w - 2), y: y0 },
        { x: r.between(x0 + 1, x0 + w - 2), y: y0 + h - 1 },
      ])
      d.set(sides[0], "door")
      d.set(sides[1], r.random() < 0.5 ? "door" : "floor")
      if (r.random() < 0.6) d.set({ x: r.between(x0 + 1, x0 + w - 2), y: r.between(y0 + 1, y0 + h - 2) }, "low")
      return
    }
  }

  /** A small raised patch of open ground. */
  ridge(): void {
    const { dice: r, board: d } = this
    let at = { x: r.between(START + 3, d.width - 3), y: r.between(1, d.height - 2) }
    for (let tries = 0; tries < 30 && d.at(at) !== "floor"; tries++)
      at = { x: r.between(START + 3, d.width - 3), y: r.between(1, d.height - 2) }
    const spots = [
      at,
      ...r
        .shuffle(AROUND)
        .slice(0, r.between(3, 7))
        .map((s) => ({ x: at.x + s.x, y: at.y + s.y })),
    ]
    for (const p of spots) if (d.at(p) === "floor") d.set(p, "ridge")
  }

  clutter(): void {
    const { dice: r, board: d, template: t } = this
    const count = Math.floor((d.width * d.height) / t.clutter)
    for (let i = 0; i < count; i++) {
      const at = { x: r.between(1, d.width - 2), y: r.between(0, d.height - 1) }
      const roll = r.random()
      const tile: Tile =
        r.random() >= t.high ? "low" : roll < t.trees ? "tree" : roll < t.trees + t.rocks ? "rock" : "high"
      const step = r.pick([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ])
      const spots =
        r.random() < t.lines
          ? Array.from({ length: r.between(2, 4) }, (_, j) => ({ x: at.x + step.x * j, y: at.y + step.y * j }))
          : tile !== "low" && t.groves
            ? [
                at,
                ...r
                  .shuffle(AROUND)
                  .slice(0, r.between(1, 3))
                  .map((s) => ({ x: at.x + s.x, y: at.y + s.y })),
              ]
            : [at]
      for (const p of spots) {
        const near = AROUND.map((s) => d.at({ x: p.x + s.x, y: p.y + s.y }))
        if (d.at(p) === "floor" && !near.includes("door") && !near.includes("bridge")) d.set(p, tile)
      }
    }
  }

  /** Patches of tall grass that grow over open ground. */
  meadows(): void {
    const { dice: r, board: d, template: t } = this
    for (let i = 0; i < t.grass; i++) {
      const patch = [{ x: r.between(0, d.width - 1), y: r.between(0, d.height - 1) }]
      const size = r.between(4, 9)
      for (let tries = 0; patch.length < size && tries < 40; tries++) {
        const from = r.pick(patch)
        const p = { x: from.x + r.pick([-1, 0, 1]), y: from.y + r.pick([-1, 0, 1]) }
        if (d.at(p) === "floor" && !patch.some((q) => q.x === p.x && q.y === p.y)) patch.push(p)
      }
      for (const p of patch) if (d.at(p) === "floor") d.set(p, "grass")
    }
  }

  /** Mud on open ground next to water. */
  banks(): void {
    const { dice: r, board: d, template: t } = this
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        const p = { x, y }
        const wet = AROUND.slice(0, 4).some((s) => d.at({ x: x + s.x, y: y + s.y }) === "water")
        if (wet && d.at(p) === "floor" && r.random() < t.mud) d.set(p, "mud")
      }
    }
  }
}

export function flood(d: Board, from: Point): Set<number> {
  const seen = new Set([key(from)])
  const queue = [from]
  while (queue.length > 0) {
    const p = queue.pop()!
    for (const s of AROUND.slice(0, 4)) {
      const n = { x: p.x + s.x, y: p.y + s.y }
      if (!d.inside(n) || seen.has(key(n)) || !passable(d.at(n)) || !climb(d.at(p), d.at(n))) continue
      seen.add(key(n))
      queue.push(n)
    }
  }
  return seen
}

function walkables(d: Board): Point[] {
  const out: Point[] = []
  for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) if (passable(d.at({ x, y }))) out.push({ x, y })
  return out
}

/** Builds a map of a biome where every passable tile can be reached from the squad's start. */
export function map(r: Dice, biome: Biome = r.pick(BIOMES), width = SIZE.width, height = SIZE.height): Board {
  const t = TEMPLATES[biome]
  for (let attempt = 0; ; attempt++) {
    const d = new Board(width, height)
    const land = new Terrain(r, d, t)
    if (r.random() < t.river) land.river()
    const houses = r.between(...t.houses)
    for (let i = 0; i < houses; i++) land.house(r.random() < t.roofs)
    land.clutter()
    land.meadows()
    land.banks()
    const ridges = r.between(1, 2)
    for (let i = 0; i < ridges; i++) land.ridge()
    for (let y = 0; y < height; y++)
      for (let x = 0; x < START; x++) if (blocksSight(d.at({ x, y }))) d.set({ x, y }, "low")
    const start = { x: 1, y: Math.floor(height / 2) }
    d.set(start, "floor")
    const all = walkables(d)
    const reached = flood(d, start)
    if (reached.size < all.length * 0.95 && attempt < 20) continue
    for (const p of all) if (!reached.has(key(p))) d.set(p, "high")
    return d.in(biome)
  }
}
