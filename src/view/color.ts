/** A color as red, green and blue from 0 to 255. */
export type Rgb = readonly [number, number, number]

export const rgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

export const css = ([r, g, b]: Rgb, a = 1): string => `rgba(${r | 0},${g | 0},${b | 0},${a})`

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

export const grey = (c: Rgb): Rgb => {
  const v = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
  return [v, v, v]
}

export const BLACK: Rgb = [0, 0, 0]
export const WHITE: Rgb = [255, 255, 255]
export const SQUAD = rgb("#efe4cc")
export const ALIEN = rgb("#d6493e")
export const PSION = rgb("#56c0b0")
export const DOMINATED = rgb("#b48cff")
export const AMBER = rgb("#ffb347")
export const MOVE = rgb("#6cb4ff")
export const DASH = rgb("#ffd84a")
export const FLAME = rgb("#ffcf5a")
export const EMBER = rgb("#e8542a")
export const BLOOD = rgb("#7a1d1d")
export const EVAC = rgb("#7fd27f")
export const BEACON = rgb("#5fd4e8")
export const SMOKE = rgb("#b8b4ac")
