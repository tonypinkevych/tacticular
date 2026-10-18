import type { Point } from "../rules/point"
import { css, type Rgb } from "./color"
import { FONT, type Glyph, SHIELDS } from "./glyphs"
import { type Projection, TH, TW } from "./projection"

const EDGES = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const

/** Crisp pixel drawing in world pixels on a canvas. */
export class Pixels {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly projection: Projection,
  ) {}

  dot(x: number, y: number, color: Rgb, a = 1, w = 1, h = 1): void {
    this.ctx.fillStyle = css(color, a)
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }

  /** A 7×9 glyph with its bottom middle at a point. */
  glyph(px: Glyph, x: number, y: number, color: Rgb, a = 1): void {
    this.ctx.fillStyle = css(color, a)
    const left = Math.round(x) - 3
    const top = Math.round(y) - px.length
    px.forEach((row, j) => {
      row.forEach((on, i) => {
        if (on) this.ctx.fillRect(left + i, top + j, 1, 1)
      })
    })
  }

  /** A glyph turned on its side, as a unit lying on the ground. */
  lying(px: Glyph, x: number, y: number, color: Rgb, a = 1): void {
    this.ctx.fillStyle = css(color, a)
    const left = Math.round(x) - Math.floor(px.length / 2)
    const top = Math.round(y) - px[0].length
    px.forEach((row, j) => {
      row.forEach((on, i) => {
        if (on) this.ctx.fillRect(left + j, top + (row.length - 1 - i), 1, 1)
      })
    })
  }

  /** Text in the pixel font, from its top left. */
  label(text: string, x: number, y: number, color: Rgb, a = 1): void {
    this.ctx.fillStyle = css(color, a)
    let left = Math.round(x)
    for (const ch of text) {
      const f = FONT[ch]
      if (!f) continue
      f.forEach((row, j) => {
        row.forEach((on, i) => {
          if (on) this.ctx.fillRect(left + i, Math.round(y) + j, 1, 1)
        })
      })
      left += f[0].length + 1
    }
  }

  /** A soft round light. */
  glow(x: number, y: number, r: number, color: Rgb, a: number): void {
    const grd = this.ctx.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, css(color, a))
    grd.addColorStop(1, css(color, 0))
    this.ctx.fillStyle = grd
    this.ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  /** A pixel line on the 2:1 slope of the tiles; every third pixel when dotted. */
  line(x0: number, y0: number, x1: number, y1: number, color: Rgb, a: number, dotted = false): void {
    const n = Math.abs(x1 - x0)
    for (let i = 0; i <= n; i++) {
      if (dotted && i % 3 !== 0) continue
      this.dot(x0 + Math.sign(x1 - x0) * i, y0 + Math.round(((y1 - y0) * i) / Math.max(1, n)), color, a)
    }
  }

  /** A dotted line at any angle, with a gap at both ends. */
  trace(x0: number, y0: number, x1: number, y1: number, color: Rgb, a: number, gap = 8): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let i = gap; i <= n - gap; i += 3) this.dot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color, a)
  }

  /** The edges of a set of tile keys that face a tile outside the set. */
  outline(keys: Set<number>, color: Rgb, a: number, dotted = false): void {
    for (const k of keys) {
      const p = { x: k % 1000, y: Math.floor(k / 1000) }
      EDGES.forEach(([dx, dy], d) => {
        if (!keys.has(k + dy * 1000 + dx)) this.edge(p, d, color, a, dotted)
      })
    }
  }

  /** One tile edge: toward x+1, y+1, x−1 or y−1. */
  edge(p: Point, d: number, color: Rgb, a: number, dotted = false, lift = 0): void {
    const g = this.projection.ground(p)
    const y = g.y - lift
    const R = [g.x + TW / 2, y]
    const B = [g.x, y + TH / 2]
    const L = [g.x - TW / 2, y]
    const T = [g.x, y - TH / 2]
    const [from, to] = [
      [R, B],
      [B, L],
      [L, T],
      [T, R],
    ][d]
    this.line(from[0], from[1], to[0], to[1], color, a, dotted)
  }

  /** A small diamond ring on the ground of a tile, inset from its edges. */
  ring(at: { x: number; y: number }, color: Rgb, a: number, dotted = false, lift = 0): void {
    const g = this.projection.ground(at)
    const y = g.y - lift
    const R = [g.x + 8, y]
    const B = [g.x, y + 4]
    const L = [g.x - 8, y]
    const T = [g.x, y - 4]
    for (const [from, to] of [
      [R, B],
      [B, L],
      [L, T],
      [T, R],
    ])
      this.line(from[0], from[1], to[0], to[1], color, a, dotted)
  }

  /** A cover shield, 3×4, from its top middle: level 2 is full cover, 1 is half. */
  shield(x: number, y: number, level: 1 | 2, color: Rgb, a = 1): void {
    SHIELDS[level].forEach((row, j) => {
      row.forEach((on, i) => {
        if (on) this.dot(x - 1 + i, y + j, color, a)
      })
    })
  }

  /** The bar over a unit: HP ticks, then AP ticks, between two brackets. */
  bar(x: number, y: number, hp: number, maxHp: number, ap: number, color: Rgb, apColor: Rgb): void {
    const w = maxHp * 2 + (ap ? ap * 3 + 2 : 0) + 4
    const x0 = Math.round(x - w / 2)
    this.dot(x0, y, color, 0.8, 1, 3)
    this.dot(x0 + w - 1, y, color, 0.8, 1, 3)
    this.dot(x0, y, color, 0.8, 2)
    this.dot(x0 + w - 2, y, color, 0.8, 2)
    for (let i = 0; i < maxHp; i++) this.dot(x0 + 2 + i * 2, y + 1, i < hp ? color : [70, 60, 55], i < hp ? 0.95 : 0.8)
    for (let i = 0; i < ap; i++) this.dot(x0 + 3 + maxHp * 2 + i * 3, y + 1, apColor, 0.95, 2)
  }
}
