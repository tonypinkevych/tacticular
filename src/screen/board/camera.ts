import type { Spot } from "./projection"

export const ZOOMS = [2, 3, 4, 5]

/** Room past the board's edges, in screen pixels, so the HUD does not hide the edge tiles. */
const MARGIN = 240

/**
 * The view onto the world: the world point at the middle of the screen and a whole-number zoom that eases in.
 * It glides to a goal, pans by screen pixels and keeps the board on screen.
 */
export class Camera {
  center: Spot = { x: 0, y: 0 }
  zoom = 4
  scale = 4
  view: Spot = { x: 1, y: 1 }
  world: Spot = { x: 1, y: 1 }
  private goal: Spot | null = null
  private anchor: Spot = { x: 0, y: 0 }

  /** The world point under a screen point. */
  toWorld(s: Spot): Spot {
    return {
      x: (s.x - this.view.x / 2) / this.scale + this.center.x,
      y: (s.y - this.view.y / 2) / this.scale + this.center.y,
    }
  }

  /** The screen point of a world point. */
  toScreen(w: Spot): Spot {
    return {
      x: (w.x - this.center.x) * this.scale + this.view.x / 2,
      y: (w.y - this.center.y) * this.scale + this.view.y / 2,
    }
  }

  /** The canvas transform: world pixels to device pixels, snapped to whole device pixels. */
  transform(ctx: CanvasRenderingContext2D, dpr: number): void {
    const k = this.scale * dpr
    ctx.setTransform(
      k,
      0,
      0,
      k,
      Math.round((this.view.x / 2 - this.center.x * this.scale) * dpr),
      Math.round((this.view.y / 2 - this.center.y * this.scale) * dpr),
    )
  }

  /** Jumps to a world point. */
  look(w: Spot): void {
    this.center = { ...w }
    this.goal = null
    this.clamp()
  }

  /** Glides to a world point over the next frames. */
  glide(w: Spot): void {
    this.goal = { ...w }
  }

  /** Glides to a world point only when it sits near the screen edge. */
  reveal(w: Spot): void {
    const s = this.toScreen(w)
    const { x, y } = this.view
    if (s.x < x * 0.2 || s.x > x * 0.8 || s.y < y * 0.2 || s.y > y * 0.75) this.glide(w)
  }

  /** Moves by screen pixels and drops the goal. */
  pan(dx: number, dy: number): void {
    this.goal = null
    this.center = { x: this.center.x + dx / this.scale, y: this.center.y + dy / this.scale }
    this.clamp()
  }

  /** Steps the zoom one level in or out around a screen point; returns false at the last level. */
  step(at: Spot, inward: boolean): boolean {
    const i = ZOOMS.indexOf(this.zoom) + (inward ? 1 : -1)
    if (i < 0 || i >= ZOOMS.length) return false
    this.anchor = { ...at }
    this.zoom = ZOOMS[i]
    return true
  }

  /** Eases the zoom and the glide for a frame of dt seconds; returns true while it still moves. */
  ease(dt: number): boolean {
    let moving = false
    if (this.scale !== this.zoom) {
      const before = this.toWorld(this.anchor)
      this.scale += (this.zoom - this.scale) * (1 - Math.exp(-dt * 16))
      if (Math.abs(this.zoom - this.scale) < 0.02) this.scale = this.zoom
      const after = this.toWorld(this.anchor)
      this.center = { x: this.center.x + before.x - after.x, y: this.center.y + before.y - after.y }
      this.clamp()
      moving = true
    }
    if (this.goal && dt > 0) {
      const k = 1 - Math.exp(-dt * 8)
      const from = this.center
      this.center = { x: from.x + (this.goal.x - from.x) * k, y: from.y + (this.goal.y - from.y) * k }
      this.clamp()
      if (Math.abs(this.center.x - from.x) + Math.abs(this.center.y - from.y) < 0.05) this.goal = null
      moving = true
    }
    return moving
  }

  /** Keeps the board on screen, with a margin; a board smaller than the screen stays in the middle. */
  clamp(): void {
    const axis = (c: number, world: number, view: number) => {
      const half = view / 2 / this.scale
      const margin = MARGIN / this.scale
      if (world + 2 * margin <= 2 * half) return world / 2
      return Math.min(Math.max(c, half - margin), world - half + margin)
    }
    this.center = {
      x: axis(this.center.x, this.world.x, this.view.x),
      y: axis(this.center.y, this.world.y, this.view.y),
    }
  }
}
