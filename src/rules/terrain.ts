import { type Biome, Board } from "./board"
import type { Dice } from "./dice"
import { AROUND, key, type Point, plus, same } from "./point"
import { blocksSight, climb, passable, type Tile } from "./tile"

export const SIZE = { width: 32, height: 32 }

const START = 3

/**
 * How a biome fills a 16×16 area: river chance, the barrier tile when there is no river, house count, rooftop
 * share, clutter, high cover share, fence lines, groves, the share of high cover that is trees and rocks, grass
 * patches and mud on river banks.
 */
interface Template {
  river: number
  line: Tile
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

/** A place a mission asks the map for: a walled yard for the alien leader, a hill for the beacon, a landing pad. */
export interface Site {
  kind: "yard" | "hill" | "pad"
  at: Point
}

/** Hand-made pieces a map may hold: a crashed alien ship, a checkpoint and a farm with a silo. */
const PIECES: string[][] = [
  ["..HH..", ".H##H.", "H#oo#H", "+....#", "H#..#H", ".H##H."],
  [":::.:::", ":.....:", ".......", ":.....:", ":::.:::"],
  ["#####.HH", "#...#.HH", "#...+...", "#####..."],
]

const PAD = ["o.....o", ".......", ".......", ".......", "o.....o"]

const TEMPLATES: Record<Biome, Template> = {
  forest: {
    river: 0.5,
    line: "tree",
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
    line: "high",
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
    line: "wall",
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

/** The land of one map while it is laid out: barrier, routes, houses, cover, grass and mud. */
class Terrain {
  private readonly kept = new Set<number>()
  private readonly lining = new Set<number>()

  constructor(
    private readonly dice: Dice,
    private readonly board: Board,
    private readonly template: Template,
  ) {}

  /**
   * A river or a wall line across the map between the squad and the aliens, with 2 or 3 gaps off the rows to
   * avoid; returns the gaps.
   */
  barrier(avoid: number[]): Point[] {
    const { dice: r, board: d, template: t } = this
    const river = r.random() < t.river
    const count = r.between(2, 3)
    const band = Math.floor((d.height - 4) / count)
    const row = (i: number) => {
      const free = Array.from({ length: band - 2 }, (_, j) => 2 + i * band + j + 1).filter((y) => !avoid.includes(y))
      return free.length > 0 ? r.pick(free) : 2 + i * band + 1
    }
    const rows = Array.from({ length: count }, (_, i) => row(i))
    const left = Math.floor(d.width * 0.4)
    const right = Math.floor(d.width * 0.6) - 1
    let x = r.between(Math.floor(d.width * 0.45), Math.floor(d.width * 0.55))
    const gaps: Point[] = []
    for (let y = 0; y < d.height; y++) {
      const gap = rows.includes(y)
      if (y > 0 && !gap && !rows.includes(y - 1) && r.random() < 0.3)
        x = Math.min(right, Math.max(left, x + r.pick([-1, 1])))
      for (let i = 0; i < (river ? 2 : 1); i++) {
        const tile: Tile = river ? (gap ? "bridge" : "water") : gap ? "floor" : this.wall()
        d.set({ x: x + i, y }, tile)
      }
      if (!gap) continue
      gaps.push({ x, y })
      for (let i = -2; i <= (river ? 3 : 2); i++) this.kept.add(key({ x: x + i, y }))
    }
    return gaps
  }

  /**
   * Keeps a way along straight legs between points free of clutter: wide and bare when direct, lined with cover
   * on a flank. A later way clears the cover an earlier one put on its path.
   */
  route(points: Point[], flank: boolean): void {
    const { dice: r, board: d } = this
    let p = points[0]
    let step = 0
    for (const to of points.slice(1)) {
      while (!same(p, to)) {
        const along = p.x === to.x
        p = along ? { x: p.x, y: p.y + Math.sign(to.y - p.y) } : { x: p.x + Math.sign(to.x - p.x), y: p.y }
        if (this.lining.delete(key(p))) d.set(p, "floor")
        this.kept.add(key(p))
        if (!flank) for (const s of AROUND) this.kept.add(key(plus(p, s)))
        if (flank && step++ % 3 === 0) {
          const c = plus(p, along ? { x: r.pick([-1, 1]), y: 0 } : { x: 0, y: r.pick([-1, 1]) })
          if (d.at(c) === "floor" && !this.kept.has(key(c))) {
            d.set(c, r.random() < 0.7 ? "low" : "high")
            this.lining.add(key(c))
          }
        }
      }
    }
  }

  /** A walled yard of 7×6 around a point, with 2 doors. */
  yard(at: Point): void {
    const { dice: r, board: d } = this
    const x0 = at.x - 3
    const y0 = at.y - 2
    for (let y = y0; y < y0 + 6; y++)
      for (let x = x0; x < x0 + 7; x++) {
        const edge = x === x0 || y === y0 || x === x0 + 6 || y === y0 + 5
        d.set({ x, y }, edge ? "wall" : "floor")
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.kept.add(key({ x: x + dx, y: y + dy }))
      }
    const doors = r.shuffle([
      { x: x0, y: at.y },
      { x: x0 + 6, y: at.y },
      { x: at.x, y: y0 },
      { x: at.x, y: y0 + 5 },
    ])
    d.set(doors[0], "door")
    d.set(doors[1], "door")
  }

  /** A ridge of 3×3 around a point, ringed by low cover with 3 openings. */
  hill(at: Point): void {
    const { dice: r, board: d } = this
    const open = r
      .shuffle([
        { x: at.x - 2, y: at.y },
        { x: at.x + 2, y: at.y },
        { x: at.x, y: at.y - 2 },
        { x: at.x, y: at.y + 2 },
      ])
      .slice(0, 3)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const p = { x: at.x + dx, y: at.y + dy }
        const ring = Math.max(Math.abs(dx), Math.abs(dy)) === 2
        d.set(p, !ring ? "ridge" : open.some((o) => same(o, p)) ? "floor" : "low")
      }
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) this.kept.add(key({ x: at.x + dx, y: at.y + dy }))
  }

  /** A landing pad of 7×5 around a point. */
  pad(at: Point): void {
    this.stamp(PAD, { x: at.x - 3, y: at.y - 2 })
  }

  /** One hand-made piece on open ground off the routes; nothing when no place is free. */
  piece(): void {
    const { dice: r, board: d } = this
    const rows = r.pick(PIECES)
    for (let tries = 0; tries < 100; tries++) {
      const at = { x: r.between(START + 3, d.width - rows[0].length - 1), y: r.between(1, d.height - rows.length - 1) }
      let free = true
      for (let y = -1; y <= rows.length && free; y++)
        for (let x = -1; x <= rows[0].length && free; x++) {
          const p = { x: at.x + x, y: at.y + y }
          if (d.at(p) !== "floor" || this.kept.has(key(p))) free = false
        }
      if (!free) continue
      this.stamp(rows, at)
      return
    }
  }

  /** Low cover beside each of the squad's three start tiles. */
  shelter(start: Point): void {
    for (const dy of [-2, 0, 2]) {
      this.board.set({ x: start.x, y: start.y + dy }, "floor")
      this.board.set({ x: start.x + 1, y: start.y + dy }, "low")
      this.kept.add(key({ x: start.x, y: start.y + dy }))
    }
  }

  /** Copies text rows onto the map from a corner and keeps them and a ring around them from clutter. */
  private stamp(rows: string[], at: Point): void {
    const piece = Board.parse(rows)
    for (let y = -1; y <= piece.height; y++)
      for (let x = -1; x <= piece.width; x++) {
        const p = { x: at.x + x, y: at.y + y }
        if (piece.inside({ x, y })) this.board.set(p, piece.at({ x, y }))
        this.kept.add(key(p))
      }
  }

  private wall(): Tile {
    const { dice: r, template: t } = this
    if (t.line !== "tree") return t.line
    return r.random() < 0.8 ? "tree" : "rock"
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
        for (let x = x0 - 1; x <= x0 + w && free; x++)
          if (d.at({ x, y }) !== "floor" || this.kept.has(key({ x, y }))) free = false
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
    for (const p of spots) if (d.at(p) === "floor" && !this.kept.has(key(p))) d.set(p, "ridge")
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
        if (d.at(p) === "floor" && !this.kept.has(key(p)) && !near.includes("door") && !near.includes("bridge"))
          d.set(p, tile)
      }
    }
  }

  /** Patches of tall grass that grow over open ground. */
  meadows(count: number): void {
    const { dice: r, board: d } = this
    for (let i = 0; i < count; i++) {
      const patch = [{ x: r.between(0, d.width - 1), y: r.between(0, d.height - 1) }]
      const size = r.between(4, 9)
      for (let tries = 0; patch.length < size && tries < 40; tries++) {
        const from = r.pick(patch)
        const p = { x: from.x + r.pick([-1, 0, 1]), y: from.y + r.pick([-1, 0, 1]) }
        if (d.at(p) === "floor" && !patch.some((q) => q.x === p.x && q.y === p.y)) patch.push(p)
      }
      for (const p of patch) if (d.at(p) === "floor" && !this.kept.has(key(p))) d.set(p, "grass")
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

/**
 * Builds a map of a biome with the squad's start on the west edge and the aliens' side in the east: a barrier
 * with 2 or 3 gaps between them, a direct route through the gap nearest the squad, flank routes through the
 * others, the sites a mission asks for and 1 or 2 hand-made pieces. Every passable tile can be reached from the
 * start.
 */
export function map(
  r: Dice,
  biome: Biome = r.pick(BIOMES),
  sites: Site[] = [],
  width = SIZE.width,
  height = SIZE.height,
): Board {
  const t = TEMPLATES[biome]
  const scale = (width * height) / 256
  for (let attempt = 0; ; attempt++) {
    const d = new Board(width, height)
    const land = new Terrain(r, d, t)
    const start = { x: 1, y: Math.floor(height / 2) }
    const avoid = sites.flatMap((s) => Array.from({ length: 9 }, (_, i) => s.at.y - 4 + i))
    const gaps = land.barrier(avoid).sort((a, b) => Math.abs(a.y - start.y) - Math.abs(b.y - start.y))
    for (const site of sites) land[site.kind](site.at)
    gaps.forEach((gap, i) => {
      const west = start.x + 2 + r.between(0, 3)
      const east = r.between(Math.floor(width * 0.65), width - 3)
      land.route(
        [
          { x: start.x + 2, y: start.y },
          { x: west, y: start.y },
          { x: west, y: gap.y },
          { x: gap.x - 2, y: gap.y },
        ],
        i > 0,
      )
      land.route(
        [
          { x: gap.x + 3, y: gap.y },
          { x: east, y: gap.y },
          { x: east, y: r.between(2, height - 3) },
        ],
        i > 0,
      )
    })
    const houses = Math.round(r.between(...t.houses) * scale * 0.75)
    const pieces = r.between(1, 2)
    for (let i = 0; i < pieces; i++) land.piece()
    for (let i = 0; i < houses; i++) land.house(r.random() < t.roofs)
    land.clutter()
    land.meadows(Math.round(t.grass * scale))
    land.banks()
    const ridges = r.between(1, 2) * Math.round(scale)
    for (let i = 0; i < ridges; i++) land.ridge()
    for (let y = 0; y < height; y++)
      for (let x = 0; x < START; x++) if (blocksSight(d.at({ x, y }))) d.set({ x, y }, "low")
    land.shelter(start)
    const all = walkables(d)
    const reached = flood(d, start)
    if (reached.size < all.length * 0.95 && attempt < 20) continue
    for (const p of all) if (!reached.has(key(p))) d.set(p, "high")
    return d.in(biome)
  }
}
