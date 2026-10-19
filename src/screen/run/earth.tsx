import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import type { Campaign } from "../../campaign/campaign"
import type { RegionId } from "../../campaign/world"
import { t } from "../../i18n/strings"
import { css, type Rgb } from "../board/color"
import { ICONS, textWidth } from "../board/glyphs"
import { Pixels } from "../board/pixels"
import { Projection } from "../board/projection"
import { EARTH, LABELS, land } from "./atlas"
import { BLUE, FAINT, GREEN, INK, LAND, OCHRE, PAPER, RED, RULE, SEPIA } from "./ink"

const CELL = 6
/** The cells of the frame around the Earth, where the coordinates and the ruler are. */
const FRAME = 3
const COLS = EARTH[0].length + 2 * FRAME
const ROWS = EARTH.length + 2 * FRAME
const W = COLS * CELL
const H = ROWS * CELL
const GRID = 10
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const
/** The cells of the compass rose and the scale bar, in the open sea. */
const ROSE = { x: 14, y: 35 }
const SCALE = { x: 62, y: 42, cells: 18, km: 6000 }

/**
 * The world map as a day tactical map: the Earth in a ruled frame with grid coordinates, a compass rose and a scale
 * bar; each region hatched in the ink of its state, with its name, the glyph of each operation in it and its alien
 * site, and a mark for a squad away there. A flashed region blinks ochre, with an arrow from where a push came; a
 * flight draws the squad's way out from home. A region is picked by a click on its land. When the names do not fit,
 * only the picked one shows.
 */
export function Earth(props: {
  campaign: Campaign
  chosen: RegionId
  flash: RegionId | null
  from: RegionId | null
  flight: { to: RegionId; t: number } | null
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
    const cell = (x: number, y: number) => ({
      x: ((x + FRAME) * CELL * scale) / size,
      y: ((y + FRAME) * CELL * scale) / size,
    })
    const at = (id: RegionId) => cell(LABELS[id].x + 0.5, LABELS[id].y + 0.5)
    instruments(px, cell)
    if (props.from && props.flash) arrow(px, at(props.from), at(props.flash))
    for (const r of c.regions) {
      const ops = c.ops.filter((o) => o.region === r.id)
      const marks = [
        ...ops.flatMap((o) => (o.squad.length > 0 ? [`op:${o.kind}`, "world:away"] : [`op:${o.kind}`])),
        ...(r.site ? ["world:project"] : []),
      ]
      const name = crowded && r.id !== chosen ? "" : t(`region.${r.id}`).toUpperCase()
      if (!name && marks.length === 0) continue
      const head = name ? textWidth(name) + 2 : 0
      const w = head + marks.length * 10 - 1
      const x = Math.round(at(r.id).x - w / 2)
      const y = Math.round(at(r.id).y - 2)
      px.dot(x - 2, y - 3, PAPER, 0.85, w + 4, 11)
      px.label(name, x, y, r.id === chosen ? INK : tint(c, r.id))
      for (const [i, m] of marks.entries())
        px.glyph(
          ICONS[m],
          x + head + i * 10 + 3,
          y + 7,
          m === "world:project" ? RED : m === "world:away" ? BLUE : OCHRE,
        )
    }
    if (props.flight) flight(px, at(c.home), at(props.flight.to), props.flight.t)
  }
  const pick = (e: MouseEvent) => {
    const box = canvas.getBoundingClientRect()
    const id = land(
      Math.floor(((e.clientX - box.left) / box.width) * COLS) - FRAME,
      Math.floor(((e.clientY - box.top) / box.height) * ROWS) - FRAME,
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
 * Draws the Earth on paper: the sea, tan land hatched in the ink of its state, the grid, coastlines and region borders,
 * the picked region outlined in ink, the flashed one lit ochre, and the ruled frame.
 */
function paint(ctx: CanvasRenderingContext2D, c: Campaign, chosen: RegionId, flash: RegionId | null): void {
  ctx.fillStyle = css(PAPER)
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(FRAME * CELL, FRAME * CELL)
  const px = new Pixels(ctx, new Projection(0, 0))
  const [w, h] = [EARTH[0].length * CELL, EARTH.length * CELL]
  for (let x = 0; x <= EARTH[0].length; x += GRID) px.dot(x * CELL, 0, FAINT, 1, 1, h)
  for (let y = 0; y <= EARTH.length; y += GRID) px.dot(0, y * CELL, FAINT, 1, w, 1)
  EARTH.forEach((row, y) => {
    ;[...row].forEach((_, x) => {
      if (!ground(x, y)) return
      const id = land(x, y)
      const cx = x * CELL
      const cy = y * CELL
      px.dot(cx, cy, LAND, 1, CELL, CELL)
      if (id === chosen) px.dot(cx, cy, INK, 0.08, CELL, CELL)
      if (id && id === flash) px.dot(cx, cy, OCHRE, 0.45, CELL, CELL)
      if (id && !c.region(id).free && (x + y) % 3 === 0)
        for (let k = 0; k < CELL; k++) px.dot(cx + k, cy + CELL - 1 - k, tint(c, id), 0.6, 1, 1)
      for (const [dx, dy] of SIDES) {
        const other = land(x + dx, y + dy)
        const line =
          id === chosen && other !== chosen
            ? INK
            : !ground(x + dx, y + dy)
              ? SEPIA
              : id && other && other !== id && other !== chosen && dx + dy > 0
                ? RULE
                : null
        if (!line) continue
        px.dot(dx === 1 ? cx + CELL - 1 : cx, dy === 1 ? cy + CELL - 1 : cy, line, 1, dx ? 1 : CELL, dy ? 1 : CELL)
      }
    })
  })
  px.dot(-1, -1, SEPIA, 1, w + 2, 1)
  px.dot(-1, h, SEPIA, 1, w + 2, 1)
  px.dot(-1, -1, SEPIA, 1, 1, h + 2)
  px.dot(w, -1, SEPIA, 1, 1, h + 2)
  for (let x = 0; x <= EARTH[0].length; x++) {
    const long = x % 5 === 0 ? 4 : 2
    px.dot(x * CELL, -1 - long, SEPIA, 1, 1, long)
    px.dot(x * CELL, h + 1, SEPIA, 1, 1, long)
  }
  for (let y = 0; y <= EARTH.length; y++) {
    const long = y % 5 === 0 ? 4 : 2
    px.dot(-1 - long, y * CELL, SEPIA, 1, long, 1)
    px.dot(w + 1, y * CELL, SEPIA, 1, long, 1)
  }
  ctx.restore()
}

/**
 * Draws the instruments in label pixels from a cell-to-point reading: the grid's letters and numbers on the frame, the
 * compass rose and the scale bar.
 */
function instruments(px: Pixels, cell: (x: number, y: number) => { x: number; y: number }): void {
  for (let i = 0; i * GRID < EARTH[0].length; i++) {
    const letter = String.fromCharCode(65 + i)
    const top = cell(i * GRID + GRID / 2, -FRAME / 2)
    const bottom = cell(i * GRID + GRID / 2, EARTH.length + FRAME / 2)
    px.label(letter, Math.round(top.x - 1), Math.round(top.y - 2), SEPIA)
    px.label(letter, Math.round(bottom.x - 1), Math.round(bottom.y - 2), SEPIA)
  }
  for (let i = 0; i * GRID < EARTH.length; i++) {
    const n = String(i + 1)
    const mid = (i * GRID + Math.min(EARTH.length, (i + 1) * GRID)) / 2
    const left = cell(-FRAME / 2, mid)
    const right = cell(EARTH[0].length + FRAME / 2, mid)
    px.label(n, Math.round(left.x - 1), Math.round(left.y - 2), SEPIA)
    px.label(n, Math.round(right.x - 1), Math.round(right.y - 2), SEPIA)
  }
  const o = cell(ROSE.x, ROSE.y)
  const [ox, oy] = [Math.round(o.x), Math.round(o.y)]
  for (let k = 1; k <= 12; k++) {
    const wide = Math.max(0, 3 - Math.floor(k / 4))
    px.dot(ox - wide, oy - k, INK, 1, 2 * wide + 1, 1)
    px.dot(ox - wide, oy + k, SEPIA, 1, 2 * wide + 1, 1)
    px.dot(ox + k, oy - Math.floor(wide / 2), SEPIA, 1, 1, wide + 1)
    px.dot(ox - k, oy - Math.floor(wide / 2), SEPIA, 1, 1, wide + 1)
  }
  for (let k = 2; k <= 6; k++)
    for (const [sx, sy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      px.dot(ox + sx * k, oy + sy * k, RULE, 1)
  px.dot(ox - 1, oy - 1, PAPER, 1, 3, 3)
  px.label("N", ox - 1, oy - 20, INK)
  const a = cell(SCALE.x, SCALE.y)
  const b = cell(SCALE.x + SCALE.cells, SCALE.y)
  const [ax, ay, bx] = [Math.round(a.x), Math.round(a.y), Math.round(b.x)]
  const part = (bx - ax) / 4
  for (let i = 0; i < 4; i++) px.dot(Math.round(ax + i * part), ay, i % 2 === 0 ? INK : PAPER, 1, Math.round(part), 3)
  px.dot(ax, ay - 1, INK, 1, bx - ax, 1)
  px.dot(ax, ay + 3, INK, 1, bx - ax, 1)
  px.dot(ax, ay - 3, INK, 1, 1, 7)
  px.dot(bx, ay - 3, INK, 1, 1, 7)
  px.label("0", ax - 1, ay - 9, INK)
  const km = t("world.scale", { km: SCALE.km })
  px.label(km, bx - Math.round(textWidth(km) / 2), ay - 9, INK)
}

/** Whether a cell is land, of a region or of none. */
function ground(x: number, y: number): boolean {
  return (EARTH[y]?.[x] ?? ".") !== "."
}

/** A dotted arrow between two points of the map, its head at the second. */
function arrow(px: Pixels, a: { x: number; y: number }, b: { x: number; y: number }): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const [ux, uy] = [(b.x - a.x) / len, (b.y - a.y) / len]
  for (let d = 6; d < len - 6; d += 3) px.dot(Math.round(a.x + ux * d), Math.round(a.y + uy * d), RED, 1, 2, 2)
  for (let k = 1; k <= 4; k++)
    for (const side of [-1, 1])
      px.dot(
        Math.round(b.x - ux * (6 + k) + side * uy * k),
        Math.round(b.y - uy * (6 + k) - side * ux * k),
        RED,
        1,
        2,
        2,
      )
}

/** A squad's way from one point to another, drawn up to a share of it: a dotted blue trail and the squad's mark. */
function flight(px: Pixels, a: { x: number; y: number }, b: { x: number; y: number }, share: number): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y) * share
  const [ux, uy] = [(b.x - a.x) / (len / share || 1), (b.y - a.y) / (len / share || 1)]
  for (let d = 0; d < len; d += 3) px.dot(Math.round(a.x + ux * d), Math.round(a.y + uy * d), BLUE, 1, 2, 2)
  const head = { x: Math.round(a.x + ux * len), y: Math.round(a.y + uy * len) }
  px.dot(head.x - 3, head.y - 3, PAPER, 1, 7, 7)
  px.dot(head.x - 2, head.y - 2, INK, 1, 5, 5)
}

/** Green ink for a free region, blue for one in contact, red for one the aliens hold. */
function tint(c: Campaign, id: RegionId): Rgb {
  const r = c.region(id)
  return r.free ? GREEN : r.resistance > 0 ? BLUE : RED
}
