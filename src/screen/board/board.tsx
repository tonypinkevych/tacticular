import { onCleanup, onMount } from "solid-js"
import { ORTHOGONAL, type Point, plus } from "../../map/point"
import { coverOf } from "../../map/tile"
import type { Battle } from "../battle"
import { INK, Ink, RED, YELLOW } from "./ink"
import { Overlay } from "./overlay"
import { Projection } from "./projection"
import { Scenery } from "./scenery"
import { FEET, SH, Sprites, SW } from "./sprites"

const TONE = { hit: RED, crit: YELLOW, miss: "#6f6b62", note: INK }

/** The whole ink board of a battle on one canvas: ground, overlays, props and units in depth order, and texts. */
export function Board(props: { battle: Battle }) {
  let canvas!: HTMLCanvasElement
  const battle = props.battle
  const projection = new Projection(battle.game().board.width, battle.game().board.height)
  const [bw, bh] = projection.size
  const ground = document.createElement("canvas")
  let tiles = ""
  let scale = 1
  let frameId = 0

  onMount(() => {
    const dpr = devicePixelRatio || 1
    const sprites = new Sprites(dpr)
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    const ink = new Ink(ctx),
      overlay = new Overlay(ink, projection),
      scenery = new Scenery(ink, projection)
    const resize = () => {
      const box = canvas.parentElement as HTMLElement
      scale = Math.min(box.clientWidth / bw, box.clientHeight / bh)
      canvas.style.width = `${bw * scale}px`
      canvas.style.height = `${bh * scale}px`
      canvas.width = Math.round(bw * scale * dpr)
      canvas.height = Math.round(bh * scale * dpr)
      ground.width = canvas.width
      ground.height = canvas.height
      tiles = ""
    }
    const draw = () => {
      const now = performance.now() / 1000,
        g = battle.game(),
        frame = Math.floor(now * 8)
      battle.playback.tick(now)
      const key = g.board.tiles.join()
      if (key !== tiles) {
        tiles = key
        const gctx = ground.getContext("2d") as CanvasRenderingContext2D
        gctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0)
        gctx.clearRect(0, 0, bw, bh)
        new Scenery(new Ink(gctx), projection).ground(g.board)
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(ground, 0, 0)
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0)
      ink.boil = 0
      const goal = g.goal
      if (goal.kind === "evac") for (const [i, p] of goal.tiles.entries()) overlay.evac(p, frame, i % 2 === 0)
      if (goal.kind === "defend") overlay.beacon(goal.at, frame)
      for (const m of g.marks)
        for (const [i, p] of m.tiles.entries())
          overlay.danger(p, frame, i === (m.kind === "blast" ? 0 : m.tiles.length - 1))
      for (const p of g.landing) overlay.drop(p, frame)
      const ready = battle.ready(),
        zones = battle.zones(),
        u = battle.unit(),
        hover = battle.hovered()
      const route = ready ? battle.route() : null
      if (ready) {
        for (const p of zones.dash) overlay.dash(p)
        for (const p of zones.move) overlay.move(p)
        for (const p of zones.reach) overlay.reach(p)
        for (const p of zones.area) overlay.danger(p, 1, false)
        for (const p of zones.foeMove) overlay.foeMove(p)
        for (const p of zones.foeShot) overlay.foeShot(p)
        for (const p of [...zones.move, ...zones.dash]) {
          if (g.board.at(p) === "forest") overlay.shield(p, null, true)
          for (const d of ORTHOGONAL) {
            const c = coverOf(g.board.at(plus(p, d)))
            if (c > 0) overlay.shield(p, d, c >= 40)
          }
        }
        if (u) overlay.selected(u.at)
        if (hover) overlay.hover(hover)
        const planned = battle.planned()
        if (planned) overlay.planned(planned)
      }
      const things: { x: number; y: number; draw: () => void }[] = []
      g.board.tiles.forEach((t, i) => {
        const p = { x: i % g.board.width, y: Math.floor(i / g.board.width) }
        if (t !== "grass" && t !== "road" && t !== "water") things.push({ ...p, draw: () => scenery.prop(t, p, frame) })
      })
      for (const s of battle.playback.units.values())
        things.push({
          x: s.x,
          y: s.y,
          draw: () => {
            const image = sprites.frames(s.kind, s.side === "enemy" && s.state === "shoot" ? "attack" : s.state)[
              battle.playback.frame(s, now)
            ]
            const [cx, cy] = projection.center({ x: s.x, y: s.y })
            ctx.save()
            ctx.translate(cx, cy + 6)
            ctx.scale(s.face, 1)
            ctx.drawImage(image, -SW / 2, -FEET, SW, SH)
            ctx.restore()
          },
        })
      things.sort((a, b) => a.x + a.y - (b.x + b.y) || a.y - b.y)
      for (const t of things) t.draw()
      if (ready) for (const p of zones.targets) overlay.target(p, frame)
      if (route && u) overlay.path([u.at, ...route.path])
      for (const peril of route?.perils ?? []) overlay.peril(peril.at, peril.kind)
      for (const b of battle.playback.bursts) overlay.blast(b.at, Math.min(3, Math.floor((now - b.since) * 7)))
      for (const f of battle.playback.floats) {
        const [x, y] = projection.center(f.at)
        overlay.float([x, y - 70 - (now - f.since) * 26], f.text, TONE[f.tone])
      }
      frameId = requestAnimationFrame(draw)
    }
    resize()
    addEventListener("resize", resize)
    frameId = requestAnimationFrame(draw)
    onCleanup(() => {
      cancelAnimationFrame(frameId)
      removeEventListener("resize", resize)
    })
  })

  const tileAt = (e: MouseEvent): Point | null => {
    const r = canvas.getBoundingClientRect()
    return projection.tile([(e.clientX - r.left) / scale, (e.clientY - r.top) / scale])
  }

  return (
    <canvas
      ref={canvas}
      class="board"
      onMouseMove={(e) => battle.point(tileAt(e))}
      onMouseLeave={() => battle.point(null)}
      onClick={(e) => {
        const p = tileAt(e)
        if (p) battle.click(p)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        battle.cancel()
      }}
    />
  )
}
