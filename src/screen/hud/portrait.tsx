import { onMount } from "solid-js"
import type { Kind } from "../../units/profiles"
import { FEET, Sprites, SW } from "../board/sprites"

const sprites = new Sprites(devicePixelRatio || 1)

/** A unit's idle sprite, cut to its head and body. */
export function Portrait(props: { kind: Kind; face?: 1 | -1 }) {
  let canvas!: HTMLCanvasElement
  onMount(() => {
    const dpr = devicePixelRatio || 1,
      size = 48
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    ctx.scale(dpr, dpr)
    ctx.translate(size / 2, size + 2)
    ctx.scale(props.face ?? 1, 1)
    ctx.drawImage(sprites.frames(props.kind, "idle")[0], -SW / 2 / 2.2, -FEET / 2.2, SW / 2.2, (SW * 0.8) / 2.2)
  })
  return <canvas ref={canvas} class="portrait" />
}
