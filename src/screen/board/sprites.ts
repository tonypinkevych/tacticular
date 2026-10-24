import type { Kind } from "../../units/profiles"
import { Figure } from "./figure"
import { Ink } from "./ink"
import { FRAMES, pose, type State } from "./pose"

/** Width and height of a sprite frame, and where the feet stand in it, in board pixels. */
export const SW = 200
export const SH = 160
export const FEET = 146

const SCALE = 1.6

/** The baked frames of every unit kind and state: drawn once in ink, then played at 8 a second. */
export class Sprites {
  private readonly baked = new Map<string, HTMLCanvasElement[]>()

  constructor(private readonly resolution: number) {}

  frames(kind: Kind, state: State): HTMLCanvasElement[] {
    const id = `${kind}:${state}`
    const known = this.baked.get(id)
    if (known) return known
    const frames = Array.from({ length: FRAMES[state] }, (_, i) => {
      const c = document.createElement("canvas")
      c.width = SW * this.resolution
      c.height = SH * this.resolution
      const ctx = c.getContext("2d") as CanvasRenderingContext2D
      ctx.scale(this.resolution * SCALE, this.resolution * SCALE)
      ctx.translate(SW / 2 / SCALE, FEET / SCALE)
      const ink = new Ink(ctx)
      ink.boil = i % 3
      new Figure(ink).draw(kind, pose(kind, state, i))
      return c
    })
    this.baked.set(id, frames)
    return frames
  }
}
