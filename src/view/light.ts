import type { Game } from "../rules/game"
import { key, type Point } from "../rules/point"
import type { Tile } from "../rules/tile"
import { AMBER, BLACK, EMBER, FLAME, grey, mix, type Rgb, rgb } from "./color"
import type { Daylight } from "./daylight"

/** Base colors of the terrain, muted so that units stand out. */
export const TERRAIN: Record<Tile, Rgb> = {
  floor: rgb("#857e72"),
  open: rgb("#a08660"),
  grass: rgb("#76825e"),
  water: rgb("#5f84a0"),
  mud: rgb("#7e6c58"),
  tree: rgb("#738a5e"),
  rock: rgb("#928e88"),
  roof: rgb("#94806e"),
  wall: rgb("#928e86"),
  low: rgb("#98866c"),
  bridge: rgb("#98805e"),
  ladder: rgb("#a08660"),
  ridge: rgb("#8c846e"),
  high: rgb("#8e8a7c"),
  door: rgb("#a08660"),
}

/** A light on the board: a lamp, a fire or a muzzle flash. */
export interface Lamp {
  at: Point
  radius: number
  strength: number
  color: Rgb
}

/** The light of one frame: daylight, what the squad sees, lamps at ladders, doors and roof corners, and fires. */
export class Light {
  readonly lamps: Lamp[] = []

  constructor(
    private readonly daylight: Daylight,
    private readonly seen: Set<number>,
    private readonly eyes: Point[],
    private readonly t: number,
  ) {}

  /** The lights of a frame, with a muzzle flash at a point when given. */
  static of(game: Game, daylight: Daylight, seen: Set<number>, eyes: Point[], t: number, flash: Point | null): Light {
    const light = new Light(daylight, seen, eyes, t)
    const { board } = game
    let k = 0
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++) {
        const tile = board.at({ x, y })
        const corner =
          (tile === "roof" || tile === "wall") &&
          board.at({ x, y: y + 1 }) !== tile &&
          board.at({ x: x - 1, y }) !== tile &&
          x > 0
        if (tile === "ladder" || tile === "door" || corner)
          light.lamps.push({ at: { x, y }, radius: 3.2, strength: daylight.lamps * light.flicker(k++), color: AMBER })
      }
    for (const z of game.zones)
      if (z.kind === "fire")
        for (const at of z.tiles)
          light.lamps.push({
            at,
            radius: 3,
            strength: (daylight.time === "day" ? 0.35 : 1) * light.flicker(k++ + 9),
            color: EMBER,
          })
    if (flash) light.lamps.push({ at: flash, radius: 4, strength: daylight.time === "day" ? 0.4 : 1, color: FLAME })
    return light
  }

  /** The color of a tile's glyph: tinted by the time of day, dimmed by distance and fog, warmed by lamps. */
  shade(base: Rgb, p: Point): Rgb {
    const d = this.daylight
    let c = mix(mix(base, grey(base), 0.2), d.tint, d.tintK)
    c = this.seen.has(key({ x: Math.round(p.x), y: Math.round(p.y) }))
      ? mix(c, BLACK, 1 - d.falloff(this.distance(p)))
      : mix(mix(c, grey(c), d.desaturate), BLACK, 1 - d.unseen)
    const l = this.at(p)
    return mix(c, mix(l.color, base, 0.3), l.strength * 0.55)
  }

  /** The strongest lamp light on a point. */
  at(p: Point): { strength: number; color: Rgb } {
    let strength = 0
    let color = AMBER
    for (const l of this.lamps) {
      const v = l.strength * Math.max(0, 1 - Math.hypot(l.at.x - p.x, l.at.y - p.y) / l.radius)
      if (v > strength) {
        strength = v
        color = l.color
      }
    }
    return { strength, color }
  }

  private distance(p: Point): number {
    return Math.min(99, ...this.eyes.map((e) => Math.hypot(e.x - p.x, e.y - p.y)))
  }

  private flicker(k: number): number {
    return 0.85 + 0.15 * Math.sin(this.t / 90 + k * 1.7) * Math.sin(this.t / 37 + k)
  }
}
