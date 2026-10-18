import { createEffect } from "solid-js"
import type { Glyph } from "../board/glyphs"

/** A glyph on a small canvas, one canvas pixel per glyph pixel; the stylesheet scales it up crisp. */
export function Icon(props: { glyph: Glyph; color: string; class: string }) {
  let canvas!: HTMLCanvasElement
  createEffect(() => {
    const { glyph, color } = props
    canvas.width = glyph[0].length
    canvas.height = glyph.length
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = color
    glyph.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) ctx.fillRect(x, y, 1, 1)
      })
    })
  })
  return <canvas ref={canvas} class={props.class} />
}
