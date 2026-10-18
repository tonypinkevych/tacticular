import { type Rgb, rgb } from "./color"

export type Time = "day" | "dusk" | "night"

export const TIMES: Time[] = ["day", "dusk", "night"]

/** How a time of day lights the board: ground, tint, sight falloff, the unseen part, lamps and vignette. */
export interface Daylight {
  time: Time
  ground: string
  tint: Rgb
  tintK: number
  /** Brightness of a seen tile at a distance from the nearest soldier. */
  falloff: (distance: number) => number
  unseen: number
  desaturate: number
  lamps: number
  vignette: number
}

export const DAYLIGHT: Record<Time, Daylight> = {
  day: {
    time: "day",
    ground: "#25231c",
    tint: [255, 250, 235],
    tintK: 0,
    falloff: () => 1,
    unseen: 0.42,
    desaturate: 0.75,
    lamps: 0,
    vignette: 0.35,
  },
  dusk: {
    time: "dusk",
    ground: "#1a120d",
    tint: rgb("#ff9650"),
    tintK: 0.25,
    falloff: (d) => Math.max(0.6, 1 - d / 14),
    unseen: 0.26,
    desaturate: 0.6,
    lamps: 0.55,
    vignette: 0.5,
  },
  night: {
    time: "night",
    ground: "#06070b",
    tint: rgb("#6e8cd2"),
    tintK: 0.35,
    falloff: (d) => Math.max(0.36, 1 - d / 8),
    unseen: 0.12,
    desaturate: 0.4,
    lamps: 1,
    vignette: 0.6,
  },
}

/** The time of day of a mission, picked by its seed. */
export const daylightOf = (seed: number): Daylight => DAYLIGHT[TIMES[seed % TIMES.length]]
