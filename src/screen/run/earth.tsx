import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import type { Campaign } from "../../campaign/campaign"
import type { RegionId } from "../../campaign/world"
import { t } from "../../i18n/strings"
import { ALIEN, AMBER, BEACON, BLACK, css, EVAC, type Rgb, rgb } from "../board/color"
import { ICONS, textWidth } from "../board/glyphs"
import { Pixels } from "../board/pixels"
import { Projection } from "../board/projection"
import { EARTH, LABELS, land } from "./atlas"

const CELL = 6
const W = EARTH[0].length * CELL
const H = EARTH.length * CELL
const GRID = 10
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const
const BORDER = rgb("#c8d0d4")
const PICKED = rgb("#e8eef0")
const COAST = rgb("#5d6f75")
const EDGE = rgb("#2a3539")
const GRID_LINE = rgb("#11191c")

/**
 * The world map: the Earth as control zones, each region hatched in the color of its state, with its name, the glyph
 * of each operation in it and its alien site; a flashed region blinks amber, with an arrow from where a push came. A
 * region is picked by a click on its land. When the names do not fit, only the picked one shows.
 */
export function Earth(props: {
  campaign: Campaign
  chosen: RegionId
  flash: RegionId | null
  from: RegionId | null
  onPick: (id: RegionId) => void
}) {
  let canvas!: HTMLCanvasElement
  const [tick, setTick] = createSignal(0)
  const sheet = document.createElement("canvas")
  sheet.width = W
  sheet.height = H
  const draw = () => {
    const c = props.campaign
    const chosen = props.chosen
    const box = canvas.getBoundingClientRect()
    if (box.width === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(box.width * dpr)
    canvas.height = Math.round(box.height * dpr)
    paint(sheet.getContext("2d")!, c, chosen, props.flash && tick() % 2 === 0 ? props.flash : null)
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sheet, 0, 0, canvas.width, canvas.height)
    const scale = box.width / W
    const size = Math.max(2, Math.round(scale))
    const crowded = size > scale * 1.3
    ctx.setTransform(size * dpr, 0, 0, size * dpr, 0, 0)
    const px = new Pixels(ctx, new Projection(0, 0))
    const at = (id: RegionId) => ({
      x: ((LABELS[id].x + 0.5) * CELL * scale) / size,
      y: ((LABELS[id].y + 0.5) * CELL * scale) / size,
    })
    if (props.from && props.flash) arrow(px, at(props.from), at(props.flash))
    for (const r of c.regions) {
      const ops = c.ops.filter((o) => o.region === r.id)
      const marks = [...ops.map((o) => `op:${o.kind}`), ...(r.site ? ["world:project"] : [])]
      const name = crowded && r.id !== chosen ? "" : t(`region.${r.id}`).toUpperCase()
      if (!name && marks.length === 0) continue
      const head = name ? textWidth(name) + 2 : 0
      const w = head + marks.length * 10 - 1
      const x = Math.round(at(r.id).x - w / 2)
      const y = Math.round(at(r.id).y - 2)
      px.dot(x - 2, y - 3, BLACK, 0.8, w + 4, 11)
      px.label(name, x, y, r.id === chosen ? PICKED : tint(c, r.id))
      for (const [i, m] of marks.entries())
        px.glyph(ICONS[m], x + head + i * 10 + 3, y + 7, m === "world:project" ? ALIEN : AMBER)
    }
  }
  const pick = (e: MouseEvent) => {
    const box = canvas.getBoundingClientRect()
    const id = land(
      Math.floor(((e.clientX - box.left) / box.width) * EARTH[0].length),
      Math.floor(((e.clientY - box.top) / box.height) * EARTH.length),
    )
    if (e.type === "click" && id) props.onPick(id)
    canvas.style.cursor = id ? "pointer" : "default"
  }
  onMount(() => {
    const seen = new ResizeObserver(draw)
    seen.observe(canvas)
    const blink = setInterval(() => setTick((n) => n + 1), 500)
    onCleanup(() => {
      seen.disconnect()
      clearInterval(blink)
    })
  })
  createEffect(draw)
  return <canvas class="earth" ref={canvas} onClick={pick} onMouseMove={pick} aria-label={t("world.map")} />
}

/**
 * Draws the Earth as control zones: a faint grid, a hatch on land in the color of its state, coastlines and region
 * borders as thin lines, the picked region outlined bright and the flashed one lit amber.
 */
function paint(ctx: CanvasRenderingContext2D, c: Campaign, chosen: RegionId, flash: RegionId | null): void {
  ctx.fillStyle = css(BLACK)
  ctx.fillRect(0, 0, W, H)
  const px = new Pixels(ctx, new Projection(0, 0))
  for (let x = 0; x < EARTH[0].length; x += GRID) px.dot(x * CELL, 0, GRID_LINE, 1, 1, H)
  for (let y = 0; y < EARTH.length; y += GRID) px.dot(0, y * CELL, GRID_LINE, 1, W, 1)
  EARTH.forEach((row, y) => {
    ;[...row].forEach((_, x) => {
      if (!ground(x, y)) return
      const id = land(x, y)
      const cx = x * CELL
      const cy = y * CELL
      if (id === chosen) px.dot(cx, cy, BORDER, 0.08, CELL, CELL)
      if (id && id === flash) px.dot(cx, cy, AMBER, 0.45, CELL, CELL)
      if (id && !c.region(id).free && (x + y) % 3 === 0)
        for (let k = 0; k < CELL; k++) px.dot(cx + k, cy + CELL - 1 - k, tint(c, id), 0.45, 1, 1)
      for (const [dx, dy] of SIDES) {
        const other = land(x + dx, y + dy)
        const line =
          id === chosen && other !== chosen
            ? PICKED
            : !ground(x + dx, y + dy)
              ? COAST
              : id && other && other !== id && other !== chosen && dx + dy > 0
                ? EDGE
                : null
        if (!line) continue
        px.dot(dx === 1 ? cx + CELL - 1 : cx, dy === 1 ? cy + CELL - 1 : cy, line, 1, dx ? 1 : CELL, dy ? 1 : CELL)
      }
    })
  })
}

/** Whether a cell is land, of a region or of none. */
function ground(x: number, y: number): boolean {
  return (EARTH[y]?.[x] ?? ".") !== "."
}

/** A dotted arrow between two points of the map, its head at the second. */
function arrow(px: Pixels, a: { x: number; y: number }, b: { x: number; y: number }): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const [ux, uy] = [(b.x - a.x) / len, (b.y - a.y) / len]
  for (let d = 6; d < len - 6; d += 3) px.dot(Math.round(a.x + ux * d), Math.round(a.y + uy * d), ALIEN, 1, 2, 2)
  for (let k = 1; k <= 4; k++)
    for (const side of [-1, 1])
      px.dot(
        Math.round(b.x - ux * (6 + k) + side * uy * k),
        Math.round(b.y - uy * (6 + k) - side * ux * k),
        ALIEN,
        1,
        2,
        2,
      )
}

/** Green for a free region, blue for one in contact, red for one the aliens hold. */
function tint(c: Campaign, id: RegionId): Rgb {
  const r = c.region(id)
  return r.free ? EVAC : r.resistance > 0 ? BEACON : ALIEN
}
