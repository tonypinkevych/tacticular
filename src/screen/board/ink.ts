import type { Pt } from "./outline"

export const INK = "#24221f"
export const PAPER = "#f4f3ee"
export const SHADOW = "rgba(120,114,102,.32)"
export const RED = "#d0553e"
export const YELLOW = "#e3b93a"
export const TEAL = "#3f9c88"
export const GLOW = "#8fd8c4"
export const GREEN = "#6fa35a"
export const DARK = "#4a4741"

/** How an inked shape is filled, hatched and stroked. */
export interface Stroke {
  fill?: string
  /** Gap between hatch lines; none when unset. */
  hatch?: number
  /** Hatch only inside this area, within the shape. */
  hatchPts?: Pt[]
  steep?: boolean
  /** Line width; 0 draws no line. */
  w?: number
  stroke?: string
  sharp?: boolean
  closed?: boolean
  amp?: number
  key?: number
  dash?: number[]
}

/** A pen that draws wobbly ink shapes on a canvas; `boil` picks the wobble of a frame. */
export class Ink {
  boil = 0

  constructor(readonly ctx: CanvasRenderingContext2D) {}

  shape(pts: Pt[], o: Stroke = {}): void {
    const ctx = this.ctx,
      amp = o.amp ?? 0.7,
      key = o.key ?? 0,
      closed = o.closed ?? true
    const p = pts.map(
      ([x, y], i): Pt => [x + (this.noise(key * 97 + i) - 0.5) * amp, y + (this.noise(key * 131 + i + 50) - 0.5) * amp],
    )
    if (o.fill) {
      this.trace(p, closed, o.sharp)
      ctx.fillStyle = o.fill
      ctx.fill()
    }
    if (o.hatch) {
      ctx.save()
      this.trace(p, closed, o.sharp)
      ctx.clip()
      if (o.hatchPts) {
        this.trace(o.hatchPts, true, true)
        ctx.clip()
      }
      this.hatch(o.hatch, p, o.steep)
      ctx.restore()
    }
    if (o.w === 0) return
    this.trace(p, closed, o.sharp)
    ctx.setLineDash(o.dash ?? [])
    ctx.strokeStyle = o.stroke ?? INK
    ctx.lineWidth = o.w ?? 1.8
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
    ctx.setLineDash([])
  }

  line(pts: Pt[], key: number, w = 1.4, stroke?: string): void {
    this.shape(pts, { closed: false, key, w, amp: 0.4, stroke })
  }

  private noise(i: number): number {
    const x = Math.sin(i * 127.1 + this.boil * 311.7) * 43758.5453
    return x - Math.floor(x)
  }

  private trace(pts: Pt[], closed: boolean, sharp?: boolean): void {
    const ctx = this.ctx
    ctx.beginPath()
    if (sharp || pts.length < 3) {
      pts.forEach(([x, y], i) => {
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      })
      if (closed) ctx.closePath()
      return
    }
    const n = pts.length,
      mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    if (closed) {
      const s = mid(pts[n - 1], pts[0])
      ctx.moveTo(s[0], s[1])
      for (let i = 0; i < n; i++) {
        const m = mid(pts[i], pts[(i + 1) % n])
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1])
      }
      ctx.closePath()
      return
    }
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i], pts[i + 1])
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1])
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1])
  }

  private hatch(gap: number, pts: Pt[], steep?: boolean): void {
    const ctx = this.ctx,
      xs = pts.map((q) => q[0]),
      ys = pts.map((q) => q[1])
    const x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys),
      h = y1 - y0
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.9
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    if (steep)
      for (let k = x0; k < x1; k += gap) {
        ctx.moveTo(k, y0)
        ctx.lineTo(k, y1)
      }
    else
      for (let k = x0 - h; k < x1; k += gap) {
        ctx.moveTo(k, y1)
        ctx.lineTo(k + h, y0)
      }
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
