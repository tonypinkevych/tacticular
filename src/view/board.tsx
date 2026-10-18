import { createEffect, on, onCleanup, onMount } from "solid-js"
import type { Board as Tiles } from "../rules/board"
import type { Game } from "../rules/game"
import { key, type Point } from "../rules/point"
import { Camera } from "./camera"
import { BLACK, css } from "./color"
import { daylightOf } from "./daylight"
import { Houses } from "./houses"
import type { Model } from "./model"
import { Picture } from "./picture"
import { Pixels } from "./pixels"
import { Projection } from "./projection"
import type { Scene } from "./scene"

const PAN_SPEED = 900
const WHEEL_STEP = 50
const PAN_KEYS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

/** Keys of the tiles the squad sees now. */
function sight(game: Game): Set<number> {
  const out = new Set<number>()
  for (const u of game.units)
    if (u.alive() && u.allegiance() === "squad") for (const k of game.sight.tiles(u)) out.add(k)
  return out
}

/** The full-window board: an isometric camera over the map, panned by keys or drag and zoomed by the wheel. */
export function Board(props: { model: Model }) {
  const m = props.model
  let canvas!: HTMLCanvasElement
  const camera = new Camera()
  let projection = new Projection(m.game().board.width, m.game().board.height)
  let last = 0
  let raf = 0
  const held = new Set<string>()
  let drag: { x: number; y: number; moved: boolean } | null = null
  let dragged = false
  let wheel = 0
  let mouse: MouseEvent | null = null
  let sightOf: { game: Game; seen: Set<number> } | null = null
  let housesOf: { tiles: string; houses: Houses } | null = null

  const seen = (g: Game): Set<number> => {
    if (sightOf?.game !== g) sightOf = { game: g, seen: sight(g) }
    return sightOf.seen
  }

  const houses = (board: Tiles): Houses => {
    const tiles = board.tiles.join()
    if (housesOf?.tiles !== tiles) housesOf = { tiles, houses: Houses.of(board) }
    return housesOf.houses
  }

  const tileAt = (e: MouseEvent): Point | null => {
    const r = canvas.getBoundingClientRect()
    const p = projection.tile(camera.toWorld({ x: e.clientX - r.left, y: e.clientY - r.top }))
    return m.inside(p) ? p : null
  }

  const layout = () => {
    camera.view = { x: canvas.clientWidth, y: canvas.clientHeight }
    camera.world = projection.size()
    camera.clamp()
    if (mouse) m.setHover(tileAt(mouse))
  }

  createEffect(
    on(m.look, (p) => {
      if (p && canvas) camera.reveal(projection.ground(p))
    }),
  )

  createEffect(
    on(m.game, (g) => {
      if (g.board.width !== projection.width || g.board.height !== projection.height) {
        projection = new Projection(g.board.width, g.board.height)
        if (canvas) layout()
      }
    }),
  )

  const scene = (now: number): Scene => {
    const still = m.playback.at(now)
    if (still.game !== m.shown()) m.setShown(still.game)
    if (still.focus) camera.reveal(projection.ground(still.focus))
    const g = m.game()
    const kit = m.kit()
    const u = kit?.unit ?? null
    const near = new Set<number>()
    const far = new Set<number>()
    let path: Point[] = []
    const targets = new Set<string>()
    let area: Point[] = []
    let range = new Set<number>()
    let aim: Scene["aim"] = null
    let ghost: Scene["ghost"] = null
    const hover = m.hover()
    const raw = m.armed()
    if (kit && u && g.phase === "squad" && u.ap > 0) {
      if (raw) {
        const armed = kit.aim(raw, hover)
        range = kit.range(armed.slot)
        const slot = kit.slots().find((s) => s.id === armed.slot)
        if (armed.slot === "ability:charge" && armed.at) {
          ghost = { unit: u, at: armed.at }
          path = g.reach(u, u.mobility).path(armed.at)
        } else if (armed.at && (slot?.aim === "tile" || g.tile(armed.at) === "barrel")) area = [armed.at]
        const f = kit.forecast(raw, hover)
        if (f) {
          const from = armed.slot === "ability:charge" && armed.at ? armed.at : u.pos
          const chance = Math.round((f.kind === "attack" ? f.odds.chance : f.chance) * 100)
          aim = { target: f.target, chance, cover: f.kind === "attack" ? f.odds.cover : 0, from }
        }
        for (const e of g.units)
          if (e.allegiance() === "enemy" && (e.side === "squad" || g.stealth.visible(e)) && g.orders.canTarget(u, e))
            targets.add(e.id)
      } else {
        const r = g.reach(u, u.stride())
        for (const [k, c] of r.cost) {
          if (c === 0) continue
          far.add(k)
          if (u.ap === 2 && c <= u.mobility) near.add(k)
        }
        if (hover && r.cost.has(key(hover))) path = r.path(hover)
        const foe = hover && m.foeAt(hover)
        if (foe && g.orders.canTarget(u, foe)) {
          const o = g.combat.odds(u, foe)
          aim = { target: foe, chance: Math.round(o.chance * 100), cover: o.cover, from: u.pos }
        }
      }
    }
    const shown = still.game
    return {
      game: shown,
      daylight: daylightOf(shown.seed),
      seen: seen(shown),
      houses: houses(shown.board),
      selected: shown.phase === "enemy" ? null : u,
      near,
      far,
      path,
      hover,
      targets,
      area: area.filter((p) => g.board.inside(p)),
      range,
      aim,
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
    const slot = armed
      ? m
          .kit()
          ?.slots()
          .find((s) => s.id === armed.slot)
      : undefined
    if (slot?.aim === "unit") return "crosshair"
    if (slot?.aim === "tile") return "cell"
    const h = m.hover()
    if (h && m.foeAt(h)) return "crosshair"
    return "pointer"
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000)
    last = now
    camera.ease(dt)
    if (held.size > 0) {
      let dx = 0
      let dy = 0
      for (const k of held) {
        dx += PAN_KEYS[k].x * PAN_SPEED * dt
        dy += PAN_KEYS[k].y * PAN_SPEED * dt
      }
      camera.pan(dx, dy)
    }
    const sc = scene(performance.now())
    for (const cue of m.playback.sounds.splice(0)) m.sound.play(cue)
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = sc.daylight.ground
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    camera.transform(ctx, dpr)
    new Picture(new Pixels(ctx, projection), sc, now).draw()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const vg = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * 0.45,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.75,
    )
    vg.addColorStop(0, css(BLACK, 0))
    vg.addColorStop(1, css(BLACK, sc.daylight.vignette))
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    canvas.style.cursor = cursor()
    raf = requestAnimationFrame(frame)
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
    camera.view = { x: canvas.clientWidth, y: canvas.clientHeight }
    camera.world = projection.size()
    const u = m.unit()
    camera.look(u ? projection.ground(u.pos) : { x: camera.world.x / 2, y: camera.world.y / 2 })
    raf = requestAnimationFrame(frame)
    window.addEventListener("resize", layout)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
  })
  onCleanup(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener("resize", layout)
    window.removeEventListener("keydown", down)
    window.removeEventListener("keyup", up)
    window.removeEventListener("blur", blur)
  })

  return (
    <canvas
      ref={canvas}
      id="board"
      onMouseDown={(e) => {
        if (e.button === 0 || e.button === 1) drag = { x: e.clientX, y: e.clientY, moved: false }
      }}
      onMouseMove={(e) => {
        mouse = e
        if (drag && (e.buttons & 5) !== 0) {
          const dx = e.clientX - drag.x
          const dy = e.clientY - drag.y
          if (drag.moved || Math.hypot(dx, dy) > 5) {
            drag.moved = true
            camera.pan(-dx, -dy)
            drag.x = e.clientX
            drag.y = e.clientY
            return
          }
        }
        m.setHover(tileAt(e))
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
        wheel += e.deltaY
        if (Math.abs(wheel) < WHEEL_STEP) return
        const inward = wheel < 0
        wheel = 0
        const r = canvas.getBoundingClientRect()
        camera.step({ x: e.clientX - r.left, y: e.clientY - r.top }, inward)
      }}
      onClick={(e) => {
        if (dragged) {
          dragged = false
          return
        }
        const p = tileAt(e)
        if (p) m.click(p)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        m.key(new KeyboardEvent("keydown", { key: "Escape" }))
      }}
    />
  )
}
