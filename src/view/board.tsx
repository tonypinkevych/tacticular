import { createEffect, on, onCleanup, onMount } from "solid-js"
import { canTarget } from "../rules/actions"
import { area, inside, key, reach } from "../rules/grid"
import { visibleToSquad } from "../rules/stealth"
import type { Point } from "../rules/types"
import { sideOf } from "../rules/units"
import { aimFor, type Model, range, slots } from "./model"
import { draw, type Scene } from "./scene"
import { PALETTES, sprites, TILE } from "./sprites"

const ZOOMS = [2, 3, 4]
const MARGIN = 320
const PAN_SPEED = 900
const PAN_KEYS: Record<string, Point> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

/** The full-window board: a camera over the map, panned by keys or drag and zoomed by the wheel. */
export function Board(props: { model: Model }) {
  const m = props.model
  let canvas!: HTMLCanvasElement
  let zoom = 3
  let dirty = true
  let last = 0
  let raf = 0
  const cam = { x: 0, y: 0 }
  const held = new Set<string>()
  let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null
  let dragged = false
  const size = () => TILE * zoom
  sprites.loaded.then(() => {
    dirty = true
  })

  let mouse: MouseEvent | null = null

  /** Keeps the map on screen, with room past its edges for the HUD; the hovered tile follows the camera. */
  const clamp = () => {
    const { width, height } = m.game().board
    const axis = (v: number, map: number, view: number) =>
      map + 2 * MARGIN <= view ? (map - view) / 2 : Math.min(Math.max(v, -MARGIN), map - view + MARGIN)
    cam.x = axis(cam.x, width * size(), canvas.clientWidth)
    cam.y = axis(cam.y, height * size(), canvas.clientHeight)
    if (mouse) m.setHover(point(mouse))
    dirty = true
  }

  /** Centers the camera on a tile. */
  const focus = (p: Point) => {
    cam.x = (p.x + 0.5) * size() - canvas.clientWidth / 2
    cam.y = (p.y + 0.5) * size() - canvas.clientHeight / 2
    clamp()
  }

  /** Centers on a tile only when it is near the screen edge or off screen. */
  const reveal = (p: Point) => {
    const x = (p.x + 0.5) * size() - cam.x
    const y = (p.y + 0.5) * size() - cam.y
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (x < w * 0.2 || x > w * 0.8 || y < h * 0.2 || y > h * 0.75) focus(p)
  }

  createEffect(
    on(m.selected, () => {
      const u = m.unit()
      if (u && canvas) reveal(u.pos)
    }),
  )

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
    let ghost: Scene["ghost"] = null
    const hover = m.hover()
    const raw = m.armed()
    if (u && g.phase === "squad" && u.ap > 0) {
      if (raw) {
        const armed = aimFor(g, u, raw, hover)
        zone = range(g, u, armed.slot)
        const slot = slots(g, u).find((s) => s.id === armed.slot)
        const target = armed.target ? g.units.find((x) => x.id === armed.target) : null
        aimed = target?.pos ?? armed.at
        if (armed.slot === "ability:charge" && armed.at) {
          ghost = { unit: u, at: armed.at }
          path = reach(g, u, u.mobility).path(armed.at)
        } else if (armed.at && armed.slot.startsWith("item:"))
          spot = armed.slot === "item:stone" ? [armed.at] : area(armed.at, 1)
        else if (armed.at && slot?.aim === "tile") spot = [armed.at]
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
      size: size(),
      selected: u,
      near,
      far,
      path,
      hover,
      targets,
      area: spot.filter((p) => inside(g.board, p)),
      range: zone,
      aimed,
      ghost,
      zones: m.zones(),
      mover: still.mover,
      shot: still.shot,
      texts: m.playback.texts,
      now,
      life: 1100 / Math.max(1, m.playback.speed),
    }
  }

  const cursor = (): string => {
    if (drag?.moved) return "grabbing"
    const armed = m.armed()
    const u = m.unit()
    const slot = armed && u ? slots(m.game(), u).find((s) => s.id === armed.slot) : undefined
    if (slot?.aim === "unit") return "crosshair"
    if (slot?.aim === "tile") return "cell"
    const h = m.hover()
    if (h && m.foeAt(h)) return "crosshair"
    return "pointer"
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000)
    last = now
    if (held.size > 0) {
      for (const k of held) {
        cam.x += PAN_KEYS[k].x * PAN_SPEED * dt
        cam.y += PAN_KEYS[k].y * PAN_SPEED * dt
      }
      clamp()
    }
    if (dirty || m.playback.live) {
      dirty = false
      const sc = scene(performance.now())
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const ctx = canvas.getContext("2d")!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = PALETTES[sc.game.board.biome ?? "forest"].void
      ctx.fillRect(0, 0, w, h)
      ctx.translate(-Math.round(cam.x), -Math.round(cam.y))
      draw(ctx, sc)
      canvas.style.cursor = cursor()
    }
    raf = requestAnimationFrame(frame)
  }

  const resize = () => {
    clamp()
  }
  const down = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !(e.code in PAN_KEYS)) return
    e.preventDefault()
    held.add(e.code)
  }
  const up = (e: KeyboardEvent) => {
    held.delete(e.code)
  }
  const blur = () => {
    held.clear()
  }

  onMount(() => {
    const { width, height } = m.game().board
    const fits = width * TILE * zoom <= canvas.clientWidth && height * TILE * zoom <= canvas.clientHeight
    const u = m.unit()
    focus(u && !fits ? u.pos : { x: (width - 1) / 2, y: (height - 1) / 2 })
    raf = requestAnimationFrame(frame)
    window.addEventListener("resize", resize)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
  })
  onCleanup(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener("resize", resize)
    window.removeEventListener("keydown", down)
    window.removeEventListener("keyup", up)
    window.removeEventListener("blur", blur)
  })

  const point = (e: MouseEvent): Point | null => {
    const r = canvas.getBoundingClientRect()
    const p = {
      x: Math.floor((e.clientX - r.left + cam.x) / size()),
      y: Math.floor((e.clientY - r.top + cam.y) / size()),
    }
    return m.inside(p) ? p : null
  }

  return (
    <canvas
      ref={canvas}
      id="board"
      onMouseDown={(e) => {
        if (e.button === 0 || e.button === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }
      }}
      onMouseMove={(e) => {
        mouse = e
        if (drag && (e.buttons & 5) !== 0) {
          const dx = e.clientX - drag.x
          const dy = e.clientY - drag.y
          if (drag.moved || Math.hypot(dx, dy) > 5) {
            drag.moved = true
            cam.x = drag.cx - dx
            cam.y = drag.cy - dy
            clamp()
            return
          }
        }
        m.setHover(point(e))
      }}
      onMouseUp={() => {
        dragged = drag?.moved ?? false
        drag = null
      }}
      onMouseLeave={() => {
        mouse = null
        drag = null
        m.setHover(null)
      }}
      onWheel={(e) => {
        e.preventDefault()
        const i = ZOOMS.indexOf(zoom) + (e.deltaY < 0 ? 1 : -1)
        if (i < 0 || i >= ZOOMS.length) return
        const r = canvas.getBoundingClientRect()
        const mx = e.clientX - r.left
        const my = e.clientY - r.top
        const wx = (mx + cam.x) / size()
        const wy = (my + cam.y) / size()
        zoom = ZOOMS[i]
        cam.x = wx * size() - mx
        cam.y = wy * size() - my
        clamp()
      }}
      onClick={(e) => {
        if (dragged) {
          dragged = false
          return
        }
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
