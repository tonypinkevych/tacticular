import { t } from "../../i18n/strings"
import type { Point } from "../../map/point"
import { GREEN, INK, type Ink, ORANGE, PAPER, RED, TEAL, YELLOW } from "./ink"
import { circle, type Pt, star } from "./outline"
import type { Projection } from "./projection"

/** The marks the board draws over its tiles: zones, targets, alien intents, drops, the evac and the beacon. */
export class Overlay {
  constructor(
    private readonly ink: Ink,
    private readonly projection: Projection,
  ) {}

  selected(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 7), { w: 2.4, sharp: true, stroke: YELLOW, dash: [7, 6], amp: 0 })
  }

  move(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 5), {
      fill: "rgba(227,185,58,.28)",
      sharp: true,
      w: 1.6,
      stroke: "#b89020",
      amp: 0,
    })
  }

  /** A tile only a second move reaches. */
  dash(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 5), {
      fill: "rgba(214,124,46,.2)",
      sharp: true,
      w: 1.6,
      stroke: ORANGE,
      dash: [5, 3],
      amp: 0,
    })
  }

  /** The tile a first click planned an action on. */
  planned(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 2), { w: 3, sharp: true, stroke: INK, amp: 0 })
  }

  /** The way a planned move walks, from the soldier's tile. */
  path(points: Point[]): void {
    const pts = points.map((p) => this.projection.center(p))
    this.ink.line(pts, 1080, 7, PAPER)
    this.ink.line(pts, 1080, 3.5, INK)
    for (const [i, [x, y]] of pts.entries())
      if (i > 0) this.ink.shape(circle(x, y, 7, 4.5, 12), { fill: i === pts.length - 1 ? INK : PAPER, key: 1081, w: 2 })
  }

  /** A danger on a planned way: fire burns 1, or an alien on overwatch fires. */
  peril(p: Point, kind: "fire" | "watch"): void {
    const [x, y] = this.projection.center(p)
    this.sign([x, y - 18], RED)
    this.float([x, y - 36], kind === "fire" ? t("ui.float.fire") : t("ui.overwatch").toUpperCase(), RED)
  }

  /** A cover mark on a tile's edge toward a side, or in its middle for a forest: filled when full. */
  shield(p: Point, side: Point | null, full: boolean): void {
    const [cx, cy] = this.projection.center(p)
    const [tx, ty] = side ? this.projection.center({ x: p.x + side.x, y: p.y + side.y }) : [cx, cy]
    const x = cx + (tx - cx) * 0.42,
      y = cy + (ty - cy) * 0.42 - 4
    const outline: Pt[] = [
      [x - 6, y - 7],
      [x + 6, y - 7],
      [x + 6, y],
      [x, y + 6],
      [x - 6, y],
    ]
    this.ink.shape(outline, { fill: full ? INK : PAPER, sharp: true, w: 1.6, stroke: INK, amp: 0 })
    if (!full)
      this.ink.shape(
        [
          [x - 6, y - 2],
          [x + 6, y - 2],
          [x + 6, y],
          [x, y + 6],
          [x - 6, y],
        ],
        { fill: INK, sharp: true, w: 0, amp: 0 },
      )
  }

  /** A tile the alien under the cursor can walk to. */
  foeMove(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 5), {
      fill: "rgba(63,156,136,.22)",
      sharp: true,
      w: 1.4,
      stroke: TEAL,
      amp: 0,
    })
  }

  /** A tile the alien under the cursor can hit after one move. */
  foeShot(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 9), { w: 1.4, sharp: true, stroke: RED, dash: [3, 3], amp: 0 })
  }

  /** A tile a skill can reach. */
  reach(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 5), {
      fill: "rgba(63,156,136,.12)",
      sharp: true,
      w: 1.2,
      stroke: TEAL,
      dash: [3, 4],
      amp: 0,
    })
  }

  hover(p: Point): void {
    this.ink.shape(this.projection.diamond(p, 3), { w: 1.4, sharp: true, stroke: "rgba(36,34,31,.45)", amp: 0 })
  }

  target(p: Point, frame: number): void {
    const [x, y] = this.projection.center(p),
      r = 18 + (frame % 2) * 2
    this.ink.shape(circle(x, y, r, r * 0.6, 20), { w: 2, stroke: RED, amp: 0 })
    for (let a = 0; a < 4; a++) {
      const dx = Math.cos((a * Math.PI) / 2),
        dy = Math.sin((a * Math.PI) / 2) * 0.6
      this.ink.line(
        [
          [x + dx * (r - 6), y + dy * (r - 6)],
          [x + dx * (r + 6), y + dy * (r + 6)],
        ],
        1010 + a,
        2,
        RED,
      )
    }
  }

  /** A tile an alien attack lands on next turn. */
  danger(p: Point, frame: number, sign: boolean): void {
    const d = this.projection.diamond(p, 3)
    this.ink.shape(d, {
      fill: frame % 2 ? "rgba(208,85,62,.22)" : "rgba(208,85,62,.12)",
      sharp: true,
      w: 2,
      stroke: RED,
      dash: [6, 4],
      amp: 0,
      hatch: 5,
      hatchPts: d,
    })
    if (sign) this.sign(this.projection.center(p), RED)
  }

  drop(p: Point, frame: number): void {
    const [x, y] = this.projection.center(p),
      b = [0, -3, -6, -3][frame % 4]
    this.ink.shape(circle(x, y, 26, 15, 22), { w: 2, stroke: RED, dash: [5, 5], amp: 0 })
    this.ink.shape(circle(x, y, 14, 8, 16), { w: 1.6, stroke: RED, amp: 0 })
    this.ink.shape(
      [
        [x - 6, y - 40 + b],
        [x + 6, y - 40 + b],
        [x + 6, y - 28 + b],
        [x + 12, y - 28 + b],
        [x, y - 18 + b],
        [x - 12, y - 28 + b],
        [x - 6, y - 28 + b],
      ],
      { fill: RED, key: 1030, sharp: true, w: 1.4 },
    )
  }

  evac(p: Point, frame: number, flare: boolean): void {
    const [x, y] = this.projection.center(p)
    this.ink.shape(this.projection.diamond(p, 5), {
      fill: "rgba(111,163,90,.18)",
      sharp: true,
      w: 1.6,
      stroke: GREEN,
      dash: [6, 4],
      amp: 0,
    })
    if (!flare) return
    this.ink.line(
      [
        [x + 18, y - 4],
        [x + 18, y - 26],
      ],
      1040,
      1.6,
    )
    const h = [8, 10, 7][frame % 3]
    this.ink.shape(
      [
        [x + 18, y - 26 - h],
        [x + 22, y - 26],
        [x + 14, y - 26],
      ],
      { fill: GREEN, key: 1050, w: 1.2 },
    )
  }

  beacon(p: Point, frame: number): void {
    const [x, y] = this.projection.center(p)
    this.ink.shape(this.projection.diamond(p, 4), {
      fill: "rgba(227,185,58,.22)",
      sharp: true,
      w: 2,
      stroke: YELLOW,
      amp: 0,
    })
    this.ink.line(
      [
        [x, y],
        [x, y - 34],
      ],
      1060,
      1.8,
    )
    const wave = [0, 2, 0, -2][frame % 4]
    this.ink.shape(
      [
        [x, y - 34],
        [x + 16, y - 30 + wave],
        [x, y - 24],
      ],
      { fill: YELLOW, key: 1061, w: 1.4 },
    )
  }

  /** A short text over a point, in the paper look: damage, MISS, a skill name. */
  float(at: Pt, text: string, color: string): void {
    const ctx = this.ink.ctx
    ctx.font = "bold 13px ui-monospace, Menlo, monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.lineWidth = 4
    ctx.strokeStyle = PAPER
    ctx.strokeText(text, at[0], at[1])
    ctx.fillStyle = color
    ctx.fillText(text, at[0], at[1])
  }

  /** A blast on a tile, by its frame: a spark, a burst, then smoke. */
  blast(p: Point, frame: number): void {
    const [x, y] = this.projection.center(p)
    if (frame === 0) this.ink.shape(circle(x, y - 16, 14, 10, 12), { fill: YELLOW, key: 1070, w: 1.4 })
    if (frame === 1) {
      this.ink.shape(star([x, y - 16], 30, 11, 9, 0.8), { fill: YELLOW, key: 1071, sharp: true, w: 1.6 })
      this.ink.shape(star([x, y - 16], 14, 6, 9, 0.8), { fill: RED, key: 1072, sharp: true, w: 1.3 })
    }
    if (frame >= 2)
      for (const [dx, dy, r, k] of [
        [-12, -18, 10, 1073],
        [10, -26, 12, 1074],
        [14, -10, 8, 1075],
      ])
        this.ink.shape(circle(x + dx, y + dy - (frame - 2) * 6, r, r * 0.85, 12), { fill: "#dcd9d0", key: k, w: 1.3 })
  }

  private sign(at: Pt, color: string): void {
    this.ink.shape(circle(at[0], at[1] - 2, 8, 8, 12), { fill: color, key: 1020, w: 1.4 })
    this.float([at[0], at[1] - 1.5], "!", PAPER)
  }
}
