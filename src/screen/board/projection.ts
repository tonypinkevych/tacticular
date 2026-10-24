import type { Point } from "../../map/point"
import type { Pt } from "./outline"

/** Half the width and half the height of a tile's diamond, in board pixels. */
export const TW = 48
export const TH = 30

/** The isometric layout of a board: x runs to the lower right, y to the lower left. */
export class Projection {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** The board's size in pixels, with room for tall cover above and cliffs below. */
  get size(): Pt {
    return [(this.width + this.height) * TW + 60, (this.width + this.height) * TH + 190]
  }

  /** The middle of a tile's diamond. */
  center(p: Point): Pt {
    return [this.height * TW + 30 + (p.x - p.y) * TW, 120 + (p.x + p.y) * TH + TH]
  }

  /** The tile under a board pixel, if any. */
  tile([px, py]: Pt): Point | null {
    const u = (px - this.height * TW - 30) / TW,
      v = (py - 120 - TH) / TH
    const p = { x: Math.round((u + v) / 2), y: Math.round((v - u) / 2) }
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height ? p : null
  }

  /** The 4 corners of a tile's diamond, shrunk by an inset and raised by a lift. */
  diamond(p: Point | Pt, inset = 0, lift = 0): Pt[] {
    const [cx, cy] = Array.isArray(p) ? p : this.center(p)
    const w = TW - inset,
      h = TH - (inset * TH) / TW
    return [
      [cx, cy - h - lift],
      [cx + w, cy - lift],
      [cx, cy + h - lift],
      [cx - w, cy - lift],
    ]
  }
}
