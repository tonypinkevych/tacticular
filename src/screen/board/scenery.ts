import type { Board } from "../../map/board"
import type { Point } from "../../map/point"
import type { Tile } from "../../map/tile"
import { DARK, INK, type Ink, PAPER, RED, SHADOW, YELLOW } from "./ink"
import { box, circle, type Pt } from "./outline"
import { type Projection, TH, TW } from "./projection"

const hash = (a: number, b: number, c = 0): number =>
  ((((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0) % 997) / 997

const FLOOR: Partial<Record<Tile, string>> = { water: "#d6dad9", road: "#e0dcd0", fire: "#d8d3c7", rubble: "#e3e0d7" }

/** The ink drawing of the board: its paper ground and cliffs, and the prop that stands on each tile. */
export class Scenery {
  constructor(
    private readonly ink: Ink,
    private readonly projection: Projection,
  ) {}

  /** The island: cliffs on the two near sides, then every tile's floor with its marks. */
  ground(board: Board): void {
    const ink = this.ink,
      pr = this.projection,
      w = board.width,
      h = board.height
    ink.boil = 0
    const L = pr.diamond({ x: 0, y: h - 1 })[3],
      B = pr.diamond({ x: w - 1, y: h - 1 })[2],
      R = pr.diamond({ x: w - 1, y: 0 })[1]
    const down = ([x, y]: Pt, d = 30): Pt => [x, y + d]
    ink.shape([L, B, down(B), down(L)], { fill: "#dedbd2", sharp: true, key: 30, hatch: 4, steep: true })
    ink.shape([B, R, down(R), down(B)], { fill: "#d2cfc5", sharp: true, key: 31, hatch: 2.4, steep: true })
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.floor(board, { x, y })
    ink.shape([L, B, R], { closed: false, w: 2.2, key: 32, sharp: true })
  }

  private floor(board: Board, p: Point): void {
    const ink = this.ink,
      t = board.at(p),
      d = this.projection.diamond(p),
      [cx, cy] = this.projection.center(p)
    const fill = FLOOR[t] ?? ((p.x + p.y) % 2 ? "#e6e4dd" : "#efeee8")
    ink.shape(d, { fill, sharp: true, w: 0, key: 40 + p.x * 8 + p.y })
    const ctx = ink.ctx
    ctx.beginPath()
    d.forEach(([x, y], i) => {
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
    ctx.strokeStyle = "rgba(60,56,50,.16)"
    ctx.lineWidth = 1
    ctx.stroke()
    if (t === "water") this.water(board, p, d, cx, cy)
    else if (t === "road") this.dots(p, cx, cy)
    else if (t === "fire") ink.shape(circle(cx, cy, 30, 15, 18), { fill: "#cbc5b8", w: 0, key: 600 + p.x })
    else if (t === "grass" || t === "forest") this.grass(p, cx, cy)
  }

  private water(board: Board, p: Point, d: Pt[], cx: number, cy: number): void {
    const ink = this.ink,
      k = p.x * 8 + p.y
    if (board.at({ x: p.x - 1, y: p.y }) !== "water")
      ink.shape([d[3], d[0], [d[0][0], d[0][1] + 6], [d[3][0] + 10, d[3][1]]], {
        fill: "#e4e1d8",
        sharp: true,
        key: 300 + k,
        hatch: 2,
        w: 1.4,
      })
    if (board.at({ x: p.x, y: p.y - 1 }) !== "water")
      ink.shape([d[0], d[1], [d[1][0] - 10, d[1][1]], [d[0][0], d[0][1] + 6]], {
        fill: "#e4e1d8",
        sharp: true,
        key: 400 + k,
        hatch: 2,
        w: 1.4,
      })
    for (let i = 0; i < 3; i++) {
      const wx = cx - 22 + i * 16 + hash(p.x, p.y, i) * 6,
        wy = cy - 4 + i * 5
      ink.line(
        [
          [wx, wy],
          [wx + 4, wy - 3],
          [wx + 8, wy],
          [wx + 12, wy - 3],
        ],
        500 + k + i,
        1.3,
      )
    }
  }

  private dots(p: Point, cx: number, cy: number): void {
    const ctx = this.ink.ctx
    ctx.fillStyle = INK
    ctx.globalAlpha = 0.35
    for (let k = 0; k < 7; k++)
      ctx.fillRect(cx + (hash(p.x, p.y, k) - 0.5) * 50, cy + (hash(p.x, p.y, k + 9) - 0.5) * 24, 1.6, 1.6)
    ctx.globalAlpha = 1
  }

  private grass(p: Point, cx: number, cy: number): void {
    for (let g = 0; g < 3; g++) {
      if (hash(p.x, p.y, g) < 0.4) continue
      const gx = cx + (hash(p.x, p.y, 10 + g) - 0.5) * 50,
        gy = cy + (hash(p.x, p.y, 20 + g) - 0.5) * 22
      for (const o of [-2, 0, 2])
        this.ink.line(
          [
            [gx + o, gy],
            [gx + o * 1.3, gy - 4 - (o === 0 ? 1 : 0)],
          ],
          p.x * 31 + p.y * 7 + g + o,
          1.2,
        )
    }
  }

  /** The prop of a tile, if it has one; fire flickers with the frame. */
  prop(t: Tile, p: Point, frame: number): void {
    const [cx, cy] = this.projection.center(p),
      k = 1000 + (p.x * 8 + p.y) * 20
    this.ink.boil = 0
    if (t === "house") this.house(cx, cy, k)
    else if (t === "rock" || t === "cracked") this.rock(cx, cy, k, t === "cracked")
    else if (t === "bags" || t === "torn") this.bags(cx, cy, k, t === "torn")
    else if (t === "forest")
      for (const [i, [dx, dy, s]] of [
        [4, -14, 0.75],
        [-18, -2, 0.8],
        [14, -6, 0.9],
        [-2, 10, 1],
      ].entries())
        this.tree(cx + dx, cy + dy, s, k + i * 12)
    else if (t === "rubble")
      this.stones(
        cx,
        cy,
        [
          [2, -8, 4],
          [22, -4, 4],
          [-20, 0, 6],
          [14, 6, 5],
          [-6, 10, 7],
        ],
        k,
      )
    else if (t === "barrel") this.barrel(cx, cy, k)
    else if (t === "fire")
      this.flames(
        cx,
        cy,
        frame,
        [
          [-10, 0, 0.8],
          [8, 0, 0.9],
          [-1, 0, 1.2],
        ],
        k,
      )
  }

  private block(cx: number, cy: number, h: number, inset: number, key: number): Pt[] {
    const [T, R, B, L] = this.projection.diamond([cx, cy], inset),
      up = ([x, y]: Pt): Pt => [x, y - h]
    this.ink.shape([L, B, up(B), up(L)], { fill: PAPER, sharp: true, key, hatch: 3.4, steep: true })
    this.ink.shape([B, R, up(R), up(B)], { fill: "#e6e4dc", sharp: true, key: key + 1, hatch: 2.2 })
    this.ink.shape([up(T), up(R), up(B), up(L)], { fill: PAPER, sharp: true, key: key + 2 })
    return [T, R, B, L]
  }

  private house(cx: number, cy: number, k: number): void {
    const ink = this.ink
    ink.shape(this.projection.diamond([cx + 6, cy + 4], 2), { fill: SHADOW, w: 0, sharp: true, key: k })
    const [, R, B, L] = this.block(cx, cy, 58, 4, k + 1)
    for (const [P, Q, side] of [
      [L, B, 0],
      [B, R, 1],
    ] as const)
      for (const f of [0.28, 0.68]) {
        const px = P[0] + (Q[0] - P[0]) * f,
          py = P[1] + (Q[1] - P[1]) * f - 26,
          sx = (Q[0] - P[0]) * 0.09,
          sy = (Q[1] - P[1]) * 0.09
        ink.shape(
          [
            [px - sx, py - sy],
            [px + sx, py + sy],
            [px + sx, py + sy - 13],
            [px - sx, py - sy - 13],
          ],
          { fill: side ? INK : DARK, sharp: true, key: k + 5 + f * 10 + side, w: 1.3 },
        )
      }
    ink.shape(this.projection.diamond([cx, cy], 14, 58), { fill: "#e6e4dc", sharp: true, key: k + 9, w: 1.3, hatch: 3 })
    ink.shape(box(cx + 6, cy - 82, 7, 14, 1), { fill: PAPER, sharp: true, key: k + 10, hatch: 2.4 })
  }

  private rock(cx: number, cy: number, k: number, cracked: boolean): void {
    const ink = this.ink
    ink.shape(this.projection.diamond([cx + 6, cy + 4], 4), { fill: SHADOW, w: 0, sharp: true, key: k })
    const parts: { o: Pt[]; top: number; m: Pt }[] = [
      {
        o: [
          [-40, 2],
          [-36, -26],
          [-18, -54],
          [0, -44],
          [8, -10],
          [4, 12],
        ],
        top: 2,
        m: [-14, 10],
      },
      {
        o: [
          [0, 16],
          [2, -18],
          [20, -38],
          [40, -16],
          [38, 6],
          [20, 18],
        ],
        top: 2,
        m: [16, 18],
      },
      {
        o: [
          [-22, 22],
          [-20, 2],
          [-6, -8],
          [8, 4],
          [8, 24],
        ],
        top: 2,
        m: [-6, 24],
      },
    ]
    parts.forEach(({ o, top, m }, i) => {
      const pts = o.map(([x, y]): Pt => [cx + x, cy + y]),
        mm: Pt = [cx + m[0], cy + m[1]]
      ink.shape(pts, { fill: PAPER, sharp: true, key: k + 1 + i * 3, hatch: 2.4, hatchPts: [...pts.slice(top), mm] })
      ink.shape([pts[top], mm], { closed: false, w: 1.3, key: k + 2 + i * 3 })
    })
    if (!cracked) return
    ink.shape(
      [
        [cx - 24, cy - 40],
        [cx - 18, cy - 30],
        [cx - 25, cy - 22],
        [cx - 19, cy - 10],
      ],
      { closed: false, w: 1.6, key: k + 20, sharp: true },
    )
    ink.shape(
      [
        [cx + 24, cy - 30],
        [cx + 28, cy - 18],
        [cx + 22, cy - 10],
      ],
      { closed: false, w: 1.6, key: k + 21, sharp: true },
    )
    this.stones(
      cx,
      cy,
      [
        [30, 18, 4],
        [-34, 16, 3.5],
      ],
      k + 30,
    )
  }

  private bags(cx: number, cy: number, k: number, torn: boolean): void {
    const ink = this.ink
    ink.shape(this.projection.diamond([cx + 4, cy + 4], 6), { fill: SHADOW, w: 0, sharp: true, key: k })
    const a = Math.atan2(TH, TW),
      ux = Math.cos(a) * 14,
      uy = Math.sin(a) * 14
    const bag = (bx: number, by: number, kk: number) =>
      ink.shape(
        circle(bx, by, 9.5, 6, 14).map(([px, py]): Pt => {
          const dx = px - bx,
            dy = py - by
          return [bx + dx * Math.cos(a) - dy * Math.sin(a), by + dx * Math.sin(a) + dy * Math.cos(a)]
        }),
        { fill: PAPER, key: kk, hatch: 2.4, hatchPts: circle(bx + 2, by + 4, 9, 4, 10) },
      )
    for (let row = 0; row < (torn ? 2 : 3); row++)
      for (let j = -1.5 + row * 0.5; j <= 1.5 - row * 0.5 + 0.01; j++) {
        if (torn && row === 1 && j > 0) continue
        bag(cx + ux * j, cy + uy * j - row * 8, k + row * 10 + Math.round(j * 2) + 5)
      }
    if (torn)
      ink.shape(
        [
          [cx + 14, cy - 4],
          [cx + 26, cy + 2],
          [cx + 20, cy + 6],
          [cx + 8, cy + 2],
        ],
        { fill: "#dcd8cc", key: k + 40, hatch: 2 },
      )
  }

  private tree(cx: number, cy: number, s: number, k: number): void {
    const ink = this.ink
    ink.shape(circle(cx + 5 * s, cy + 3, 13 * s, 5 * s, 14), { fill: SHADOW, w: 0, key: k })
    ink.shape(
      [
        [cx - 2, cy + 1],
        [cx - 1.5, cy - 16 * s],
        [cx + 1.5, cy - 16 * s],
        [cx + 2, cy + 1],
      ],
      { fill: PAPER, key: k + 1, w: 1.4, sharp: true },
    )
    for (const [i, [x, y, r]] of [
      [-7, -22, 8],
      [7, -24, 8.5],
      [0, -33, 9.5],
      [0, -20, 7],
    ].entries())
      ink.shape(circle(cx + x * s, cy + y * s, r * s, r * s * 0.92, 14), {
        fill: PAPER,
        key: k + 2 + i,
        hatch: 2.4,
        hatchPts: circle(cx + (x + r * 0.5) * s, cy + (y + r * 0.45) * s, r * 0.8 * s, r * 0.6 * s, 10),
      })
  }

  private stones(cx: number, cy: number, list: number[][], k: number): void {
    for (const [i, [dx, dy, s]] of list.entries()) {
      this.ink.shape(circle(cx + dx + 1, cy + dy + 2, s * 1.4, s * 0.5, 10), { fill: SHADOW, w: 0, key: k + i * 3 })
      this.ink.shape(
        [
          [cx + dx - s, cy + dy + 1],
          [cx + dx - s * 0.6, cy + dy - s],
          [cx + dx + s * 0.7, cy + dy - s * 0.8],
          [cx + dx + s, cy + dy + 1],
        ],
        {
          fill: PAPER,
          sharp: true,
          key: k + i * 3 + 1,
          hatch: 2.2,
          hatchPts: [
            [cx + dx, cy + dy - s],
            [cx + dx + s * 1.2, cy + dy - s],
            [cx + dx + s * 1.2, cy + dy + 2],
            [cx + dx, cy + dy + 2],
          ],
        },
      )
    }
  }

  private barrel(cx: number, cy: number, k: number): void {
    const ink = this.ink
    ink.shape(circle(cx + 3, cy + 3, 16, 6, 14), { fill: SHADOW, w: 0, key: k })
    ink.shape(
      [
        [cx - 11, cy - 30],
        [cx - 11, cy],
        [cx - 6, cy + 4],
        [cx + 6, cy + 4],
        [cx + 11, cy],
        [cx + 11, cy - 30],
      ],
      {
        fill: PAPER,
        key: k + 1,
        hatch: 2.4,
        hatchPts: [
          [cx + 2, cy - 34],
          [cx + 14, cy - 34],
          [cx + 14, cy + 6],
          [cx + 2, cy + 6],
        ],
      },
    )
    ink.shape(
      [
        [cx - 11, cy - 21],
        [cx, cy - 18],
        [cx + 11, cy - 21],
        [cx + 11, cy - 15],
        [cx, cy - 12],
        [cx - 11, cy - 15],
      ],
      { fill: RED, key: k + 2, w: 1.3 },
    )
    ink.shape(circle(cx, cy - 30, 11, 4.5, 14), { fill: PAPER, key: k + 3 })
  }

  /** Flames on a tile; each flame flickers with the frame. */
  flames(cx: number, cy: number, frame: number, list: number[][], k: number): void {
    for (const [i, [dx, dy, s]] of list.entries()) {
      const j = [1, 1.12, 0.92][(frame + i) % 3],
        h = 28 * s * j,
        w = 9 * s
      this.ink.shape(
        [
          [cx + dx, cy + dy + 2 - h],
          [cx + dx + w * 0.7, cy + dy - h * 0.45],
          [cx + dx + w, cy + dy - 2],
          [cx + dx, cy + dy + 3],
          [cx + dx - w, cy + dy - 2],
          [cx + dx - w * 0.7, cy + dy - h * 0.45],
        ],
        {
          fill: YELLOW,
          key: k + i * 2,
        },
      )
      this.ink.shape(
        [
          [cx + dx, cy + dy - h * 0.55],
          [cx + dx + w * 0.45, cy + dy - 4],
          [cx + dx, cy + dy + 1],
          [cx + dx - w * 0.45, cy + dy - 4],
        ],
        { fill: RED, key: k + i * 2 + 1, w: 1.2 },
      )
    }
  }
}
