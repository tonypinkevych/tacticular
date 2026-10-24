import type { Kind } from "../../units/profiles"
import type { Pt } from "./outline"

export type State =
  | "idle"
  | "walk"
  | "aim"
  | "shoot"
  | "low"
  | "lowShoot"
  | "high"
  | "skill"
  | "hit"
  | "death"
  | "attack"

/** Frames of each state at 8 a second. */
export const FRAMES: Record<State, number> = {
  idle: 4,
  walk: 6,
  aim: 2,
  shoot: 4,
  low: 4,
  lowShoot: 4,
  high: 4,
  skill: 4,
  hit: 4,
  death: 4,
  attack: 4,
}

/** A skill's drawn effect. */
export type Effect = "dash" | "charge" | "glint" | "throw" | "heal" | "swipe" | "cry" | "burst"

/** Where a unit's body, gun, shield and claw are in one frame; feet stand at 0, 0. */
export interface Pose {
  t: number
  x: number
  lift: number
  squash: number
  lean: number
  pivot: number
  gun: Pt
  ga: number
  shield: Pt
  sa: number
  claw: Pt
  ca: number
  feet: [number, number, number, number]
  flash: boolean
  look: number
  swell: number
  blink?: boolean
  gone?: boolean
  kit?: Pt
  spin?: number
  fx?: Effect | null
  fk?: number
}

const HOLD: Record<Kind, { gun: Pt; ga: number; aim: Pt }> = {
  vanguard: { gun: [8, -11], ga: -22, aim: [10, -13] },
  ranger: { gun: [5, -12], ga: -38, aim: [7, -15] },
  warden: { gun: [5, -9], ga: 6, aim: [6, -10] },
  cleric: { gun: [8, -11], ga: 25, aim: [10, -15] },
  blade: { gun: [6, -12], ga: -60, aim: [9, -14] },
  grunt: { gun: [7, -12], ga: -20, aim: [9, -14] },
  commander: { gun: [9, -13], ga: 6, aim: [11, -15] },
  brute: { gun: [0, 0], ga: 0, aim: [0, 0] },
  bomber: { gun: [0, 0], ga: 0, aim: [0, 0] },
  guard: { gun: [7, -12], ga: -20, aim: [9, -14] },
  sniper: { gun: [5, -12], ga: -38, aim: [7, -15] },
  pod: { gun: [0, 0], ga: 0, aim: [0, 0] },
}

/** The pose of a kind in frame `i` of a state. */
export function pose(kind: Kind, state: State, i: number): Pose {
  const h = HOLD[kind],
    t = i / 8,
    f4 = i % 4
  const stand: Pose = {
    t,
    x: 0,
    lift: 0,
    squash: 1,
    lean: 0,
    pivot: 0,
    gun: h.gun,
    ga: h.ga,
    shield: [-12, -14],
    sa: 4,
    claw: [10, -18],
    ca: 30,
    feet: [0, 0, 0, 0],
    flash: false,
    look: 0,
    swell: 1,
  }
  const aim: Pose = {
    ...stand,
    lean: 6,
    gun: h.aim,
    ga: kind === "commander" ? 30 : 0,
    shield: [-11, -15],
    sa: 0,
    feet: [-1, 0, 2, 0],
  }
  const kick = (b: Pose, f: number): Pose =>
    kind === "warden"
      ? { ...b, gun: [b.gun[0] - (f % 2), b.gun[1] + (f % 2) * 0.6], flash: f % 2 === 0, spin: f, lean: b.lean - 1 }
      : {
          ...b,
          gun: [b.gun[0] - [3, 1.5, 0.5, 0][f], b.gun[1]],
          ga: b.ga - [14, 7, 2, 0][f],
          lean: b.lean - [5, 2, 1, 0][f],
          flash: f === 0,
        }
  const walk = (f: number): Pose => {
    const ph = (f / 6) * Math.PI * 2,
      s = Math.sin(ph)
    return {
      ...stand,
      lift: Math.abs(s) * 3,
      lean: 4,
      feet: [s * 3, -Math.max(0, s) * 2, -s * 3, -Math.max(0, -s) * 2],
    }
  }
  const hit = (f: number): Pose => {
    const k = [0.7, 1, 0.5, 0.15][f]
    return {
      ...stand,
      lean: -18 * k,
      x: -2 * k,
      squash: 1 - 0.06 * k,
      ga: h.ga - 30 * k,
      ca: 30 + 30 * k,
      feet: [-2 * k, 0, 0, 0],
    }
  }
  const death = (f: number): Pose => ({
    ...stand,
    pivot: -7,
    lean: [-18, -55, -88, -90][f],
    squash: [0.95, 0.92, 0.9, 0.86][f],
    ga: h.ga + [10, 40, 70, 90][f],
    sa: [10, 25, 40, 50][f],
    ca: 30 + [20, 50, 70, 80][f],
  })
  if (kind === "pod") {
    if (state === "death") return { ...death(Math.min(i, 3)), swell: [1, 0.9, 0.8, 0.7][Math.min(i, 3)] }
    if (state === "hit") return { ...hit(f4), swell: 0.94 }
    return { ...stand, swell: [1, 1.04, 1.07, 1.04][f4], blink: f4 === 2 }
  }
  if (kind === "bomber") {
    if (state === "idle") return { ...stand, swell: [1, 1.03, 1.05, 1.03][f4] }
    if (state === "walk") return walk(i % 6)
    if (state === "attack" || state === "death") {
      const f = Math.min(i, 3)
      return { ...stand, swell: [1.15, 1.3, 1.3, 1][f], blink: f < 2, fx: "burst", fk: f, gone: f >= 2 }
    }
    if (state === "skill") return { ...stand, swell: [1.05, 1.12, 1.05, 1.12][f4], blink: f4 % 2 === 0 }
    if (state === "hit") return { ...hit(f4), swell: 0.92 }
    return stand
  }
  if (kind === "blade" && (state === "shoot" || state === "lowShoot" || state === "attack" || state === "skill"))
    return slash(stand, f4, state === "skill")
  switch (state) {
    case "idle":
      return { ...stand, squash: [1, 0.985, 0.975, 0.985][f4], look: [0, 0, 1, 1][f4] }
    case "walk":
      return walk(i % 6)
    case "aim":
      return { ...aim, squash: [1, 0.99][i % 2] }
    case "shoot":
      return kick(aim, f4)
    case "low":
      return {
        ...stand,
        squash: [0.74, 0.735, 0.73, 0.735][f4],
        lean: 10,
        gun: [h.gun[0], h.gun[1] - 2],
        ga: kind === "warden" ? -20 : -50,
        shield: [-8, -12],
        sa: 10,
      }
    case "lowShoot":
      return kick({ ...aim, squash: 0.84, lean: 8 }, f4)
    case "high":
      return {
        ...stand,
        lean: -5,
        gun: [h.gun[0] - 1, h.gun[1] - 4],
        ga: kind === "warden" ? -40 : -78,
        shield: [4, -16],
        sa: -6,
      }
    case "hit":
      return hit(f4)
    case "death":
      return death(Math.min(i, 3))
    case "attack":
      if (kind === "brute")
        return {
          ...stand,
          lean: [-8, 16, 10, 2][f4],
          ca: [-40, 60, 70, 30][f4],
          claw: (
            [
              [6, -24],
              [14, -14],
              [14, -12],
              [10, -18],
            ] as Pt[]
          )[f4],
          fx: "swipe",
          fk: f4,
          feet: [0, 0, [0, 4, 4, 1][f4], 0],
        }
      return kick(aim, f4)
    case "skill":
      return skill(kind, stand, aim, kick, f4, i)
  }
}

function skill(kind: Kind, stand: Pose, aim: Pose, kick: (b: Pose, f: number) => Pose, f4: number, i: number): Pose {
  const h = HOLD[kind]
  if (kind === "vanguard")
    return {
      ...aim,
      lean: 16,
      lift: [2, 4, 2, 0][f4],
      x: [0, 3, 6, 6][f4],
      fx: "dash",
      fk: f4,
      flash: f4 === 3,
      feet: [-3, -2, 4, 0],
    }
  if (kind === "ranger")
    return {
      ...aim,
      lean: 4,
      fx: f4 < 2 ? "glint" : null,
      flash: f4 === 2,
      gun: [h.aim[0] - (f4 === 3 ? 2 : 0), h.aim[1]],
      ga: f4 === 3 ? -8 : 0,
    }
  if (kind === "warden") return { ...stand, lean: [-6, -10, 8, 4][f4], gun: [3, -8], ga: 30, fx: "throw", fk: f4 }
  if (kind === "cleric")
    return {
      ...stand,
      gun: [6, -10],
      ga: 50,
      kit: (
        [
          [9, -16],
          [10, -24],
          [10, -26],
          [10, -24],
        ] as Pt[]
      )[f4],
      lift: [0, 1, 2, 1][f4],
      fx: "heal",
      fk: f4,
    }
  if (kind === "grunt") return kick({ ...aim, lean: 8 }, i % 2 === 0 ? 0 : 2)
  if (kind === "brute")
    return {
      ...stand,
      lean: 22,
      lift: [2, 4, 2, 0][f4],
      x: [0, 4, 8, 8][f4],
      ca: 70,
      claw: [14, -16],
      fx: "charge",
      fk: f4,
      feet: [-4, -2, 5, 0],
    }
  return {
    ...stand,
    gun: [6, -20],
    ga: -10,
    lean: -6,
    fx: "cry",
    fk: f4,
    flash: f4 === 1,
    squash: [1, 1.04, 1.04, 1][f4],
  }
}

/** A sword swing from above the head down past the front, with a step in; a lunge also dashes forward. */
function slash(stand: Pose, f: number, lunge: boolean): Pose {
  return {
    ...stand,
    gun: (
      [
        [2, -22],
        [10, -16],
        [12, -9],
        [9, -11],
      ] as Pt[]
    )[f],
    ga: [-125, -30, 35, 15][f],
    lean: [-8, 14, 16, 6][f],
    x: lunge ? [0, 4, 7, 7][f] : 0,
    lift: lunge ? [1, 3, 1, 0][f] : 0,
    fx: f === 1 ? "swipe" : lunge && f === 0 ? "dash" : null,
    fk: f,
    feet: [-2, 0, [0, 4, 4, 2][f], 0],
  }
}
