import type { Kind } from "../../units/profiles"
import { DARK, GLOW, INK, type Ink, PAPER, RED, SHADOW, TEAL, YELLOW } from "./ink"
import { box, circle, type Pt, shift, star, turn } from "./outline"
import type { Pose } from "./pose"

const MID = "#77746a"
const HOOD = "#5f5c53"
const HEAVY = "#3d3a35"
const METAL = "#55524b"
const ALIEN = "#3a3733"
const D = Math.PI / 180

type Warp = (q: Pt) => Pt

interface Gun {
  pts: Pt[]
  fore: Pt | null
  tip: Pt
  extra?: (G: Warp, p: Pose) => void
}

/** The chibi ink drawing of every unit kind in a pose, facing right with its feet at 0, 0. */
export class Figure {
  private readonly guns: Record<string, Gun>

  constructor(private readonly ink: Ink) {
    this.guns = {
      shotgun: {
        pts: [
          [-13, -2.5],
          [-3, -3.5],
          [0, -1.5],
          [10, -3],
          [22, -3],
          [22, 0.5],
          [9, 1.5],
          [3, 1.5],
          [2, 5.5],
          [-1, 5.5],
          [-2, 2],
          [-13, 2.5],
        ],
        fore: [10, 1.5],
        tip: [26, -1.2],
        extra: (G) => ink.shape(box(9, 0.5, 6, 3.4, 1).map(G), { fill: PAPER, key: 14, w: 1.2, sharp: true }),
      },
      rifle: {
        pts: [
          [-15, -2],
          [-3, -3],
          [0, -1.5],
          [14, -2.5],
          [38, -2],
          [38, 0.5],
          [14, 1.5],
          [4, 1.5],
          [3, 5.5],
          [0, 5.5],
          [-1, 2],
          [-15, 3],
        ],
        fore: [14, 1.5],
        tip: [42, -0.8],
        extra: (G) => ink.shape(box(3, -7, 11, 4, 1.5).map(G), { fill: PAPER, key: 14, w: 1.2, sharp: true }),
      },
      pistol: {
        pts: [
          [-2, -2.5],
          [11, -2.5],
          [11, 0.5],
          [3, 0.5],
          [2, 5.5],
          [-1, 5.5],
          [-2, 1],
        ],
        fore: null,
        tip: [14, -1],
      },
      plasma: {
        pts: [
          [-10, -2.5],
          [15, -3.5],
          [20, -1],
          [15, 1.5],
          [3, 1.5],
          [2, 5.5],
          [-1, 5.5],
          [-2, 2],
          [-10, 2.5],
        ],
        fore: [11, 1.5],
        tip: [23, -1],
        extra: (G) => {
          for (const [i, x] of [5, 9].entries())
            ink.shape(circle(x, -1, 1.8, 2.4, 8).map(G), { fill: GLOW, key: 30 + i, w: 1 })
        },
      },
      minigun: {
        pts: [
          [-7, -5],
          [9, -5],
          [10, 5],
          [-7, 5],
        ],
        fore: [4, -7],
        tip: [34, 0],
        extra: (G, p) => {
          const spin = p.spin ?? 0
          for (const [i, y] of [-3, 0, 3].entries())
            ink.line([G([9, y + Math.sin(spin + i) * 0.4]), G([31, y + Math.sin(spin + i) * 0.4])], 40 + i, 2.4)
          ink.shape(box(29, -5.5, 3.5, 11, 1).map(G), { fill: METAL, key: 44, w: 1.3, sharp: true })
          ink.shape(circle(-1, 8, 5.5, 5, 12).map(G), { fill: PAPER, key: 45, hatch: 2.2 })
          ink.shape(box(1, -9, 7, 4, 1).map(G), { fill: METAL, key: 46, w: 1.2, sharp: true })
        },
      },
    }
  }

  draw(kind: Kind, p: Pose): void {
    this[kind](p)
  }

  private frames(p: Pose) {
    const M: Warp = (q) =>
      shift(turn(shift([q[0], q[1] * p.squash], [-p.pivot, 0]), p.lean * D), [p.pivot + p.x, -p.lift])
    return {
      M,
      G: (q: Pt) => M(shift(p.gun, turn(q, p.ga * D))),
      S: (q: Pt) => M(shift(p.shield, turn(q, p.sa * D))),
      C: (q: Pt) => M(shift(p.claw, turn(q, p.ca * D))),
    }
  }

  private base(p: Pose, M: Warp, r = 16, big = 1): void {
    this.ink.shape(p.lean < -60 ? circle(-12, 1, r + 8, 6, 20) : circle(0, 1, r, 5.5, 20), {
      fill: SHADOW,
      w: 0,
      key: 1,
    })
    for (const [x, y, k] of [
      [-5 * big + p.feet[0], p.feet[1], 2],
      [5 * big + p.feet[2], p.feet[3], 3],
    ])
      this.ink.shape(circle(x, -2 + y, 4.2 * big, 2.8 * big, 10).map(M), { fill: INK, key: k, w: 1.2 })
  }

  private bean(M: Warp, fill: string, rx = 11.5, ry = 9.5, cy = -12): void {
    this.ink.shape(circle(0, cy, rx, ry, 18).map(M), {
      fill,
      key: 5,
      hatch: 2.6,
      hatchPts: circle(-rx * 0.6, cy + 2, rx * 0.7, ry * 1.1, 10).map(M),
    })
  }

  private scarf(M: Warp, t: number): void {
    this.ink.shape(
      [
        [-7, -19.5],
        [7, -19.5],
        [8.5, -15.5],
        [-8, -15.5],
      ].map((q) => M(q as Pt)),
      { fill: RED, key: 6, w: 1.5 },
    )
    const s = Math.sin(t * 6) * 1.2
    this.ink.shape(
      [
        [-6, -18],
        [-12, -16 + s],
        [-15, -12 + s * 1.3],
        [-10, -14],
      ].map((q) => M(q as Pt)),
      { fill: RED, key: 7, w: 1.4 },
    )
  }

  private hand(q: Pt, k: number, fill = PAPER): void {
    this.ink.shape(circle(q[0], q[1], 2.8, 2.8, 8), { fill, key: k, w: 1.3 })
  }

  private eyes(M: Warp, xs: number[], y: number, k: number): void {
    for (const [i, x] of xs.entries())
      this.ink.shape(circle(x, y, 1.4, 1.6, 6).map(M), { fill: INK, key: k + i, w: 0.8 })
  }

  private flash(c: Pt, color: string, s = 1): void {
    this.ink.shape(star(c, 9 * s, 3 * s, 5), { fill: color, key: 15, sharp: true, w: 1.4 })
  }

  private gun(G: Warp, p: Pose, name: string, color = YELLOW): Gun {
    const g = this.guns[name]
    this.ink.shape(g.pts.map(G), { fill: METAL, key: 13, sharp: true, w: 1.5 })
    g.extra?.(G, p)
    if (p.flash) this.flash(G(g.tip), color, name === "minigun" ? 0.85 : 1)
    return g
  }

  private P(M: Warp, pts: number[][]): Pt[] {
    return pts.map((q) => M(q as Pt))
  }

  private vanguard(p: Pose): void {
    const { M, G, S } = this.frames(p),
      ink = this.ink
    this.base(p, M)
    this.bean(M, DARK)
    this.scarf(M, p.t)
    ink.shape(circle(1, -29, 12.5, 11.5, 20).map(M), {
      fill: PAPER,
      key: 8,
      hatch: 2.6,
      hatchPts: circle(-6, -25, 9, 9, 12).map(M),
    })
    ink.line(
      this.P(M, [
        [-11, -27],
        [-5, -21.5],
        [8, -21],
        [13, -26],
      ]),
      9,
    )
    ink.shape(box(2.5, -33, 11.5, 6.5, 2.8).map(M), { fill: INK, key: 10, w: 1.4 })
    ink.shape(
      this.P(M, [
        [-2, -40.5],
        [2, -41],
        [3, -45],
        [-1, -45],
      ]),
      { fill: RED, key: 12, w: 1.3 },
    )
    const g = this.gun(G, p, "shotgun")
    this.hand(G([0, 0]), 16)
    if (g.fore) this.hand(G(g.fore), 17)
    ink.shape(
      this.P(S, [
        [-5, -12],
        [5, -12],
        [6, 9],
        [0, 13],
        [-6, 9],
      ]),
      {
        fill: PAPER,
        key: 18,
        w: 1.7,
        sharp: true,
        hatch: 2.6,
        hatchPts: this.P(S, [
          [0, -13],
          [7, -13],
          [7, 14],
          [0, 14],
        ]),
      },
    )
    for (const [dy, k] of [
      [-6, 19],
      [-1, 20],
    ])
      ink.line(
        this.P(S, [
          [-3, dy],
          [0, dy + 4],
          [3, dy],
        ]),
        k,
        2,
        RED,
      )
    this.effect(p, M, G)
  }

  private ranger(p: Pose): void {
    const { M, G } = this.frames(p),
      ink = this.ink,
      s = Math.sin(p.t * 5) * 1.5
    this.base(p, M)
    ink.shape(
      this.P(M, [
        [-7, -20],
        [-16, -14 + s * 0.5],
        [-19, -1 + s],
        [-8, -3],
      ]),
      { fill: HOOD, key: 20, hatch: 2.4 },
    )
    this.bean(M, MID)
    this.scarf(M, p.t)
    ink.shape(
      this.P(M, [
        [-12, -24],
        [-13, -34],
        [-8, -42],
        [-16, -46 + s * 0.4],
        [-4, -45],
        [6, -44],
        [12, -38],
        [13, -29],
        [11, -21],
        [2, -18],
        [-7, -19],
      ]),
      {
        fill: HOOD,
        key: 21,
        hatch: 2.4,
        hatchPts: circle(-6, -30, 9, 14, 10).map(M),
      },
    )
    ink.shape(circle(6, -29, 6.5, 7.5, 14).map(M), { fill: PAPER, key: 22, w: 1.4 })
    this.eyes(M, [5, 9], -29.5, 23)
    const g = this.gun(G, p, "rifle")
    this.hand(G([0, 0]), 26)
    if (g.fore) this.hand(G(g.fore), 27)
    this.effect(p, M, G)
  }

  private warden(p: Pose): void {
    const { M, G } = this.frames(p),
      ink = this.ink
    this.base(p, M, 19, 1.2)
    ink.shape(box(-23, -28, 12, 18, 2).map(M), { fill: PAPER, key: 30, hatch: 3, steep: true, sharp: true })
    this.bean(M, HEAVY, 13.5, 10.5)
    ink.line(
      this.P(M, [
        [-13, -14],
        [-6, -5],
        [2, -3],
        [p.gun[0] - 2, p.gun[1] + 5],
      ]),
      31,
      2.6,
    )
    ink.shape(box(-11, -44, 25, 23, 5).map(M), {
      fill: PAPER,
      key: 32,
      hatch: 2.6,
      hatchPts: this.P(M, [
        [-12, -45],
        [-1, -45],
        [-1, -20],
        [-12, -20],
      ]),
    })
    ink.shape(box(-6, -47.5, 13, 4.5, 1.5).map(M), { fill: DARK, key: 33, w: 1.3 })
    ink.shape(box(4, -36, 10.5, 4.5, 1.5).map(M), { fill: INK, key: 34, w: 1.3 })
    ink.shape(
      this.P(M, [
        [-10, -21],
        [12, -21],
        [10, -18],
        [-8, -18],
      ]),
      { fill: RED, key: 35, w: 1.3 },
    )
    const g = this.gun(G, p, "minigun")
    this.hand(G([0, 0]), 36)
    if (g.fore) this.hand(G(g.fore), 37)
    this.effect(p, M, G)
  }

  private cleric(p: Pose): void {
    const { M, G } = this.frames(p),
      ink = this.ink
    this.base(p, M)
    ink.shape(box(-21, -28, 11, 15, 2).map(M), { fill: PAPER, key: 50, hatch: 3, steep: true, sharp: true })
    ink.line(
      this.P(M, [
        [-15.5, -24],
        [-15.5, -17],
      ]),
      51,
      2.2,
      RED,
    )
    ink.line(
      this.P(M, [
        [-19, -20.5],
        [-12, -20.5],
      ]),
      52,
      2.2,
      RED,
    )
    ink.line(
      this.P(M, [
        [-15, -28],
        [-19, -44],
      ]),
      53,
      1.4,
    )
    ink.shape(circle(-19.3, -45.5, 2.2, 2.2, 8).map(M), { fill: RED, key: 54, w: 1.2 })
    this.bean(M, PAPER)
    this.scarf(M, p.t)
    ink.line(
      this.P(M, [
        [2, -14],
        [2, -7],
      ]),
      55,
      2.2,
      RED,
    )
    ink.line(
      this.P(M, [
        [-1.5, -10.5],
        [5.5, -10.5],
      ]),
      56,
      2.2,
      RED,
    )
    ink.shape(circle(1, -29, 11.5, 11, 18).map(M), {
      fill: PAPER,
      key: 57,
      hatch: 2.6,
      hatchPts: circle(-6, -25, 8, 8, 12).map(M),
    })
    this.eyes(M, [5, 9], -28.5, 58)
    ink.shape(
      this.P(M, [
        [-11, -31],
        [-9, -38],
        [0, -42],
        [9, -39],
        [12, -33],
      ]),
      { fill: DARK, key: 60, w: 1.5 },
    )
    if (p.kit) {
      const c = M(p.kit)
      ink.shape(box(c[0] - 6, c[1] - 5, 12, 10, 2), { fill: PAPER, key: 61, w: 1.4, sharp: true })
      ink.line(
        [
          [c[0], c[1] - 3],
          [c[0], c[1] + 3],
        ],
        62,
        2,
        RED,
      )
      ink.line(
        [
          [c[0] - 3, c[1]],
          [c[0] + 3, c[1]],
        ],
        63,
        2,
        RED,
      )
    }
    this.gun(G, p, "pistol")
    this.hand(G([0, 0]), 64)
    this.effect(p, M, G)
  }

  private grunt(p: Pose): void {
    const { M, G } = this.frames(p)
    this.drone(p, M)
    const g = this.gun(G, p, "plasma", GLOW)
    this.hand(G([0, 0]), 75, MID)
    if (g.fore) this.hand(G(g.fore), 76, MID)
    this.effect(p, M, G)
  }

  /** A grunt behind a big carapace plate held before it. */
  private guard(p: Pose): void {
    const { M, G } = this.frames(p),
      ink = this.ink
    this.drone(p, M)
    const g = this.gun(G, p, "plasma", GLOW)
    this.hand(G([0, 0]), 75, MID)
    if (g.fore) this.hand(G(g.fore), 76, MID)
    const plate = this.P(M, [
      [8, -44],
      [20, -38],
      [22, -14],
      [14, -2],
      [8, -6],
    ])
    ink.shape(plate, { fill: "#d8d5cc", key: 120, w: 1.8, hatch: 3, hatchPts: plate })
    ink.line(
      this.P(M, [
        [12, -36],
        [16, -12],
      ]),
      121,
      1.2,
    )
    this.effect(p, M, G)
  }

  /** A hooded grunt with a long rifle. */
  private sniper(p: Pose): void {
    const { M, G } = this.frames(p),
      ink = this.ink
    this.drone(p, M)
    ink.shape(
      this.P(M, [
        [-9, -30],
        [-4, -44],
        [8, -45],
        [14, -38],
        [4, -36],
        [-2, -26],
      ]),
      { fill: HOOD, key: 122, w: 1.5, hatch: 2.6 },
    )
    const g = this.gun(G, p, "rifle", GLOW)
    this.hand(G([0, 0]), 75, MID)
    if (g.fore) this.hand(G(g.fore), 76, MID)
    this.effect(p, M, G)
  }

  /** A pulsing egg that calls the drops. */
  private pod(p: Pose): void {
    const { M } = this.frames(p),
      ink = this.ink,
      s = p.swell
    this.base(p, M, 18)
    const shell = circle(0, -20 * s, 15 * s, 21 * s, 22).map(M)
    ink.shape(shell, { fill: ALIEN, key: 123, hatch: 2.4, hatchPts: circle(-6, -18 * s, 8, 18 * s, 10).map(M) })
    for (const [x, y, d, k] of [
      [4, -28, 3.2, 124],
      [-4, -16, 2.6, 125],
      [6, -12, 2.2, 126],
    ])
      ink.shape(circle(x * s, y * s, d * s, d * s, 10).map(M), { fill: p.blink ? YELLOW : GLOW, key: k, w: 1.1 })
    ink.line(
      this.P(M, [
        [-12, -4],
        [-18, 0],
      ]),
      127,
      1.4,
    )
    ink.line(
      this.P(M, [
        [12, -4],
        [18, 0],
      ]),
      128,
      1.4,
    )
    this.effect(p, M)
  }

  /** The body, head, antennae and eye every grunt-like alien shares. */
  private drone(p: Pose, M: Warp): void {
    const ink = this.ink
    this.base(p, M)
    this.bean(M, ALIEN, 10, 9.5)
    ink.shape(circle(3, -31, 10, 12, 18).map(M), {
      fill: ALIEN,
      key: 70,
      hatch: 2.4,
      hatchPts: circle(-3, -28, 7, 12, 10).map(M),
    })
    for (const [a, b, k] of [
      [[-2, -42], [-7, -51], 71],
      [[7, -42], [10, -50], 72],
    ] as [Pt, Pt, number][]) {
      ink.line([M(a), M(b)], k, 1.4)
      ink.shape(circle(b[0], b[1], 2, 2, 8).map(M), { fill: GLOW, key: k + 5, w: 1.1 })
    }
    ink.shape(circle(6, -31, 5.5, 5.5, 12).map(M), { fill: PAPER, key: 73, w: 1.4 })
    ink.shape(circle(7.5 + p.look, -31, 2.6, 2.6, 8).map(M), { fill: TEAL, key: 74, w: 0.9 })
  }

  private brute(p: Pose): void {
    const { M, C } = this.frames(p),
      ink = this.ink
    this.base(p, M, 22, 1.5)
    const claw = (Cf: Warp, k: number, fill: string) =>
      ink.shape(
        this.P(Cf, [
          [0, 0],
          [5, -4],
          [13, -3],
          [20, 4],
          [15, 3],
          [17, 9],
          [12, 5],
          [12, 11],
          [7, 5],
          [1, 5],
        ]),
        { fill, key: k, w: 1.6, hatch: 2.4 },
      )
    claw((q) => M(shift([-12, -18], turn(q, (p.ca - 40) * D))), 80, "#d8d5cc")
    ink.shape(circle(0, -17, 17, 14, 20).map(M), {
      fill: ALIEN,
      key: 81,
      hatch: 2.4,
      hatchPts: circle(-9, -14, 11, 15, 10).map(M),
    })
    ink.shape(circle(11, -31, 8, 7, 14).map(M), { fill: ALIEN, key: 82, w: 1.6 })
    for (const [x, k] of [
      [12, 83],
      [16, 84],
    ])
      ink.shape(circle(x, -32, 1.6, 1.6, 6).map(M), { fill: GLOW, key: k, w: 0.8 })
    ink.line(
      this.P(M, [
        [-10, -26],
        [-4, -31],
        [4, -30],
      ]),
      85,
      1.3,
    )
    claw(C, 86, PAPER)
    this.effect(p, M)
  }

  private bomber(p: Pose): void {
    const { M } = this.frames(p),
      ink = this.ink
    if (p.gone) {
      this.effect(p, M)
      return
    }
    this.base(p, M, 15)
    for (const [i, x] of [-9, -3, 3, 9].entries())
      ink.line(
        this.P(M, [
          [x * 0.6, -6],
          [x + p.feet[i % 2 ? 0 : 2] * 0.5, 0],
        ]),
        90 + i,
        1.6,
      )
    const s = p.swell,
      r = 15 * s
    ink.shape(circle(0, -18 * s, r, r * 0.95, 20).map(M), {
      fill: ALIEN,
      key: 94,
      hatch: 2.4,
      hatchPts: circle(-r * 0.55, -16 * s, r * 0.6, r, 10).map(M),
    })
    for (const [x, y, d, k] of [
      [5, -22, 3.5, 95],
      [-2, -12, 2.6, 96],
      [8, -12, 2.2, 97],
    ])
      ink.shape(circle(x * s, y * s, d * s, d * s, 10).map(M), { fill: p.blink ? YELLOW : GLOW, key: k, w: 1.1 })
    ink.line(
      this.P(M, [
        [0, -33 * s],
        [3, -40 * s],
      ]),
      98,
      1.4,
    )
    ink.shape(circle(3, -42 * s, 2.4, 2.4, 8).map(M), { fill: p.blink ? YELLOW : TEAL, key: 99, w: 1.1 })
    this.effect(p, M)
  }

  private commander(p: Pose): void {
    const { M, G } = this.frames(p),
      ink = this.ink,
      s = Math.sin(p.t * 4) * 1.5
    this.base(p, M, 18)
    ink.shape(
      this.P(M, [
        [-6, -24],
        [-18, -14 + s * 0.4],
        [-22, 2 + s],
        [-6, -1],
      ]),
      { fill: TEAL, key: 100, hatch: 2.6 },
    )
    this.bean(M, ALIEN, 12, 11, -13)
    ink.shape(circle(2, -33, 10.5, 11, 18).map(M), { fill: ALIEN, key: 101, w: 1.6 })
    const spikes: [number[], number[], number[], number][] = [
      [[-6, -40], [-8, -53], [-1, -42], 102],
      [[-1, -42], [2, -57], [5, -43], 103],
      [[5, -43], [11, -52], [10, -39], 104],
    ]
    for (const [a, b, c, k] of spikes) ink.shape(this.P(M, [a, b, c]), { fill: ALIEN, key: k, sharp: true, w: 1.5 })
    ink.shape(circle(6.5, -33, 3.6, 3.6, 10).map(M), { fill: GLOW, key: 105, w: 1.1 })
    ink.line(
      this.P(M, [
        [-9, -19],
        [8, -19],
      ]),
      106,
      1.3,
    )
    ink.line([G([0, 16]), G([0, -30])], 107, 2.6)
    ink.shape(circle(0, -34, 4.8, 4.8, 12).map(G), { fill: p.flash ? YELLOW : GLOW, key: 108, w: 1.4 })
    this.hand(G([0, 0]), 109, MID)
    if (p.flash) this.flash(G([0, -34]), GLOW, 1.2)
    this.effect(p, M, G)
  }

  private effect(p: Pose, M: Warp, G?: Warp): void {
    const ink = this.ink,
      f = p.fk ?? 0
    if (p.fx === "dash" || p.fx === "charge")
      for (const [y, k] of [
        [-10, 120],
        [-20, 121],
        [-30, 122],
      ])
        ink.line(
          this.P(M, [
            [-20 - f * 2, y],
            [-34 - f * 3, y],
          ]),
          k,
          1.4,
        )
    if (p.fx === "glint" && G)
      ink.shape(star(G([9, -5]), 5, 1.5, 4, 1), { fill: YELLOW, key: 123, sharp: true, w: 1.1 })
    if (p.fx === "throw") {
      const pos = (
        [
          [-8, -34],
          [-2, -44],
          [18, -44],
          [36, -26],
        ] as Pt[]
      )[f]
      const c = M(pos)
      ink.shape(circle(c[0], c[1], 3.6, 3.6, 10), { fill: METAL, key: 124, w: 1.3 })
      if (f >= 2)
        ink.shape(
          this.P(M, [
            [2, -44],
            [18, -46],
            [34, -30],
          ]),
          { closed: false, key: 125, w: 1.1, amp: 0.2 },
        )
    }
    if (p.fx === "heal")
      for (const [x, y, k] of [
        [-6, -48 - f * 4, 126],
        [8, -44 - f * 5, 127],
        [16, -52 - f * 3, 128],
      ]) {
        const c = M([x, y])
        ink.line(
          [
            [c[0], c[1] - 3],
            [c[0], c[1] + 3],
          ],
          k,
          2,
          RED,
        )
        ink.line(
          [
            [c[0] - 3, c[1]],
            [c[0] + 3, c[1]],
          ],
          k + 10,
          2,
          RED,
        )
      }
    if (p.fx === "swipe" && f === 1)
      ink.shape(
        this.P(M, [
          [8, -38],
          [26, -26],
          [28, -6],
        ]),
        { closed: false, key: 129, w: 2.2 },
      )
    if (p.fx === "cry") {
      const c = M([12, -34])
      for (const [r, k] of [
        [8 + f * 3, 130],
        [13 + f * 3, 131],
      ])
        ink.shape(
          circle(c[0], c[1], r, r, 10).filter((_, i) => i < 3 || i > 8),
          { closed: false, key: k, w: 1.3 },
        )
    }
    if (p.fx === "burst") {
      const c = M([0, -18])
      if (f === 2) {
        ink.shape(star(c, 24, 9, 8, 0.8), { fill: YELLOW, key: 132, sharp: true, w: 1.6 })
        ink.shape(star(c, 12, 5, 6, 0.8), { fill: RED, key: 133, sharp: true, w: 1.2 })
      }
      if (f === 3)
        for (const [x, y, r, k] of [
          [-10, -12, 7, 134],
          [6, -20, 9, 135],
          [12, -8, 6, 136],
        ])
          ink.shape(circle(c[0] + x, c[1] + y + 10, r, r * 0.85, 12), { fill: "#dcd9d0", key: k, w: 1.3 })
    }
  }
}
