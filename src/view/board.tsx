import { createEffect, onCleanup, onMount } from "solid-js"
import { canTarget } from "../rules/actions"
import { PROFILES } from "../rules/data"
import { area, inside, key, reach } from "../rules/grid"
import { visibleToSquad } from "../rules/stealth"
import type { Point } from "../rules/types"
import { sideOf } from "../rules/units"
import { type Model, range, slots } from "./model"
import { draw, type Scene } from "./scene"

const BAR_ROOM = 190
const PANEL_ROOM = 400

/** The canvas board: drawn from the model's state, every frame while something moves. */
export function Board(props: { model: Model }) {
  const m = props.model
  let canvas!: HTMLCanvasElement
  let size = 28
  let dirty = true
  const icons: Record<string, HTMLImageElement> = {}
  for (const kind of Object.keys(PROFILES)) {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}icons/${kind}.svg`
    img.onload = () => {
      dirty = true
    }
    icons[kind] = img
  }

  createEffect(() => {
    m.game()
    m.shown()
    m.selected()
    m.armed()
    m.hover()
    m.zones()
    m.lang()
    dirty = true
  })

  const cellSize = () => {
    const { width, height } = m.game().board
    const room = Math.min((window.innerWidth - PANEL_ROOM) / width, (window.innerHeight - BAR_ROOM) / height)
    size = Math.max(16, Math.min(44, Math.floor(room)))
    return size
  }

  const scene = (now: number): Scene => {
    const still = m.playback.at(now)
    if (still.game !== m.shown()) m.setShown(still.game)
    const g = m.game()
    const u = m.unit()
    const near = new Set<number>()
    const far = new Set<number>()
    let path: Point[] = []
    const targets = new Set<string>()
    let spot: Point[] = []
    let zone = new Set<number>()
    let aimed: Point | null = null
    const hover = m.hover()
    const armed = m.armed()
    if (u && g.phase === "squad" && u.ap > 0) {
      if (armed) {
        zone = range(g, u, armed.slot)
        const slot = slots(g, u).find((s) => s.id === armed.slot)
        const target = armed.target ? g.units.find((x) => x.id === armed.target) : null
        aimed = target?.pos ?? armed.at
        const at = armed.at ?? (slot?.aim === "tile" ? hover : null)
        if (at && armed.slot.startsWith("item:")) spot = armed.slot === "item:stone" ? [at] : area(at, 1)
        else if (at && slot?.aim === "tile") spot = [at]
      } else {
        const r = reach(g, u, u.mobility * u.ap)
        for (const [k, c] of r.cost) {
          if (c === 0) continue
          far.add(k)
          if (u.ap === 2 && c <= u.mobility) near.add(k)
        }
        if (hover && r.cost.has(key(hover))) path = r.path(hover)
      }
      for (const e of g.units) {
        if (sideOf(e) === "enemy" && (e.side === "squad" || visibleToSquad(g, e)) && canTarget(g, u, e))
          targets.add(e.id)
      }
    }
    return {
      game: still.game,
      size: cellSize(),
      icons,
      selected: u,
      near,
      far,
      path,
      hover,
      targets,
      area: spot.filter((p) => inside(g.board, p)),
      range: zone,
      aimed,
      zones: m.zones(),
      mover: still.mover,
      shot: still.shot,
      texts: m.playback.texts,
      now,
      life: 1100 / Math.max(1, m.playback.speed),
    }
  }

  const cursor = (): string => {
    const armed = m.armed()
    const u = m.unit()
    const slot = armed && u ? slots(m.game(), u).find((s) => s.id === armed.slot) : undefined
    if (slot?.aim === "unit") return "crosshair"
    if (slot?.aim === "tile") return "cell"
    const h = m.hover()
    if (h && m.foeAt(h)) return "crosshair"
    return "pointer"
  }

  const frame = () => {
    if (dirty || m.playback.live) {
      dirty = false
      const now = performance.now()
      const sc = scene(now)
      const { width, height } = sc.game.board
      const dpr = window.devicePixelRatio || 1
      const w = width * sc.size
      const h = height * sc.size
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      const ctx = canvas.getContext("2d")!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(ctx, sc)
      canvas.style.cursor = cursor()
    }
    raf = requestAnimationFrame(frame)
  }
  let raf = 0
  const resize = () => {
    dirty = true
  }

  onMount(() => {
    raf = requestAnimationFrame(frame)
    window.addEventListener("resize", resize)
  })
  onCleanup(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener("resize", resize)
  })

  const point = (e: MouseEvent): Point | null => {
    const r = canvas.getBoundingClientRect()
    const p = { x: Math.floor((e.clientX - r.left) / size), y: Math.floor((e.clientY - r.top) / size) }
    return m.inside(p) ? p : null
  }

  return (
    <canvas
      ref={canvas}
      onMouseMove={(e) => m.setHover(point(e))}
      onMouseLeave={() => m.setHover(null)}
      onClick={(e) => {
        const p = point(e)
        if (p) m.click(p)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        m.key(new KeyboardEvent("keydown", { key: "Escape" }))
      }}
    />
  )
}
