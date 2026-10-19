import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import type { Campaign } from "../../campaign/campaign"
import { place, type RegionId } from "../../campaign/world"
import { t } from "../../i18n/strings"
import { ALIEN, AMBER, BEACON, BLACK, css, EVAC, type Rgb, rgb, SQUAD } from "../board/color"
import { ICONS, LANDS, textWidth, UNITS } from "../board/glyphs"
import { Pixels } from "../board/pixels"
import { Projection } from "../board/projection"
import { EARTH, LABELS, land } from "./atlas"

const CELL = 6
const W = EARTH[0].length * CELL
const H = EARTH.length * CELL
const WASTE = rgb("#3e5660")
const SEA = rgb("#26343a")
const BORDER = rgb("#c8d0d4")

/**
 * The world map: the Earth in glyphs, each region in the color of its state, with its name, the glyph of each
 * operation in it, and a squad mark that blinks when its operation can launch; a flashed region blinks amber. A
 * region is picked by a click on its land. When the names do not fit, only the picked one shows.
 */
export function Earth(props: {
  campaign: Campaign
  chosen: RegionId
  flash: RegionId | null
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
    for (const r of c.regions) {
      const ops = c.ops.filter((o) => o.region === r.id)
      const sent = ops.find((o) => o.sent !== null)
      const name = crowded && r.id !== chosen ? "" : t(`region.${r.id}`).toUpperCase()
      if (!name && ops.length === 0) continue
      const head = name ? textWidth(name) + 2 : 0
      const w = head + ops.length * 10 + (sent ? 8 : 0) - 1
      const x = Math.round(((LABELS[r.id].x + 0.5) * CELL * scale) / size - w / 2)
      const y = Math.round(((LABELS[r.id].y + 0.5) * CELL * scale) / size - 2)
      px.dot(x - 2, y - 3, BLACK, 0.8, w + 4, 11)
      px.label(name, x, y, tint(c, r.id))
      for (const [i, o] of ops.entries()) px.glyph(ICONS[`op:${o.kind}`], x + head + i * 10 + 3, y + 7, AMBER)
      if (sent) {
        const lit = !c.launchable(sent) || tick() % 2 === 0
        const kind = c.roster.find((s) => s.id === sent.squad[0])?.kind ?? "vanguard"
        px.glyph(UNITS[kind], x + head + ops.length * 10 + 3, y + 7, SQUAD, lit ? 1 : 0.3)
      }
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

/** Draws every cell of the Earth at one pixel a world pixel, with a line between regions and the flashed one lit amber. */
function paint(ctx: CanvasRenderingContext2D, c: Campaign, chosen: RegionId, flash: RegionId | null): void {
  ctx.fillStyle = css(BLACK)
  ctx.fillRect(0, 0, W, H)
  const px = new Pixels(ctx, new Projection(0, 0))
  EARTH.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      const id = land(x, y)
      const cx = x * CELL + 3
      const cy = y * CELL + 6
      if (id) px.dot(x * CELL, y * CELL, tint(c, id), id === chosen ? 0.18 : 0.06, CELL, CELL)
      const right = land(x + 1, y)
      const below = land(x, y + 1)
      if (id && right && right !== id) px.dot(x * CELL + CELL - 1, y * CELL, BORDER, 0.45, 1, CELL)
      if (id && below && below !== id) px.dot(x * CELL, y * CELL + CELL - 1, BORDER, 0.45, CELL, 1)
      if (id && id === flash) px.dot(x * CELL, y * CELL, AMBER, 0.45, CELL, CELL)
      if (id) px.glyph(LANDS[place(id).biome], cx, cy, tint(c, id), id === chosen ? 1 : 0.7)
      else if (ch === "x") px.glyph(LANDS.waste, cx, cy, WASTE)
      else if ((x + y) % 3 === 0) px.glyph(LANDS.sea, cx, cy, SEA)
    })
  })
}

/** Green for a free region, blue for one in contact, red for one the aliens hold. */
function tint(c: Campaign, id: RegionId): Rgb {
  const r = c.region(id)
  return r.free ? EVAC : r.resistance > 0 ? BEACON : ALIEN
}
