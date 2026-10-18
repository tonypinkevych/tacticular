import type { Point } from "../../map/point"

/** Width and height of a tile's diamond in world pixels. */
export const TW = 24
export const TH = 12

/** How far one storey lifts a glyph. */
export const LIFT = 9

const LEFT = 16
const TOP = 40

/** A point in world pixels, before the camera scales it. */
export interface Spot {
  x: number
  y: number
}

/** The isometric layout of a board: tiles as 24×12 diamonds, x to the lower right and y to the lower left. */
export class Projection {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** Where a tile's glyph stands: the bottom middle of its 7×9 box. */
  anchor(p: Point): Spot {
    return { x: (p.x - p.y) * (TW / 2) + this.height * (TW / 2) + LEFT, y: (p.x + p.y) * (TH / 2) + TOP }
  }

  /** The middle of a tile's diamond. */
  ground(p: Point): Spot {
    const a = this.anchor(p)
    return { x: a.x, y: a.y - 3 }
  }

  /** The tile under a world point. */
  tile(s: Spot): Point {
    const u = (s.x - this.height * (TW / 2) - LEFT) / (TW / 2)
    const v = (s.y + 3 - TOP) / (TH / 2)
    return { x: Math.round((u + v) / 2) || 0, y: Math.round((v - u) / 2) || 0 }
  }

  /** The size of the whole board in world pixels, with room for roofs above the top row. */
  size(): Spot {
    return { x: (this.width + this.height) * (TW / 2) + 2 * LEFT, y: (this.width + this.height) * (TH / 2) + TOP + 16 }
  }
}
