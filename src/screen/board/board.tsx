import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { t } from "../../i18n/strings"
import { adjacent, ORTHOGONAL, type Point, plus, same } from "../../map/point"
import { coverOf } from "../../map/tile"
import type { Battle } from "../battle"
import { Combos } from "../combos"
import { label } from "../glyph"
import { INK, Ink, RED, YELLOW } from "./ink"
import { Overlay } from "./overlay"
import { Projection } from "./projection"
import { Scenery } from "./scenery"
import { FEET, SH, Sprites, SW } from "./sprites"

const TONE = { hit: RED, crit: YELLOW, miss: "#6f6b62", note: INK }
const COMBO = "#2c7a69"

/**
 * The whole ink board of a battle on one canvas: ground, overlays, props and units in depth order, and texts,
 * with the card of the aimed alien beside it.
 */
export function Board(props: { battle: Battle }) {
  let canvas!: HTMLCanvasElement
  let wrap!: HTMLDivElement
  const [zoom, setZoom] = createSignal(1)
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
      scale = Math.min(wrap.clientWidth / bw, wrap.clientHeight / bh)
      setZoom(scale)
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
      for (const m of g.marks) {
        const shooter = g.unit(m.unit),
          target = g.units.find((x) => x.id === m.target)
        if (target) {
          overlay.aim(shooter.at, target.at, battle.aimed(m) !== null)
          continue
        }
        for (const [i, p] of m.tiles.entries())
          overlay.danger(p, frame, i === (m.kind === "blast" ? 0 : m.tiles.length - 1))
      }
      for (const m of g.marks)
        if (!m.target) {
          const [x, y] = projection.center(m.kind === "blast" ? m.tiles[0] : m.tiles[m.tiles.length - 1])
          overlay.float([x, y - 34], t(`ui.attack.${m.kind}`).toUpperCase(), RED)
        }
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
            if (c > 0) overlay.shield(p, d, c >= 2)
          }
        }
        if (u) overlay.selected(u.at)
        if (hover) overlay.hover(hover)
        const planned = battle.planned()
        if (planned) overlay.planned(planned)
      }
      if (goal.kind === "defend") {
        for (const p of g.board.tiles.map((_, i) => ({ x: i % g.board.width, y: Math.floor(i / g.board.width) })))
          if (adjacent(p, goal.at, true) || same(p, goal.at)) overlay.hold(p)
        overlay.beacon(goal.at, frame)
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
      if (goal.kind === "defend") {
        const [x, y] = projection.center(goal.at)
        overlay.float([x, y - 46], goal.strikes ? t("ui.float.falling") : t("ui.float.hold"), goal.strikes ? RED : INK)
      }
      for (const m of g.marks) {
        const target = g.units.find((x) => x.id === m.target)
        if (!target) continue
        const live = battle.aimed(m) !== null
        const name = m.kind === "claw" && live ? `${t("ui.attack.claw").toUpperCase()} ` : ""
        overlay.odds(g.unit(m.unit).at, target.at, `${name}${battle.toll(m)}`, live)
      }
      const combos = new Combos(g)
      for (const x of g.units) {
        if (!x.alive()) continue
        const tags = [
          ...(x.status ? [overlay.status(x.status)] : []),
          ...(x.hunkered ? [{ text: t("ui.hunker").toUpperCase(), color: INK }] : []),
          ...(x.overwatch ? [{ text: t("ui.overwatch").toUpperCase(), color: x.side === "enemy" ? RED : INK }] : []),
          ...combos.hints(x.id, battle.unit()).map((text) => ({ text, color: COMBO })),
        ]
        overlay.tags(x.at, tags)
      }
      if (ready) for (const p of zones.targets) overlay.target(p, frame)
      if (route && u) overlay.path([u.at, ...route.path])
      for (const peril of route?.perils ?? [])
        overlay.peril(peril.at, peril.kind, peril.by ? g.unit(peril.by).at : undefined)
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

  const aimed = () => {
    const o = battle.hit()
    if (!o) return null
    const [x, y] = projection.center(o.target.at)
    return { ...o, left: (x + 34) * zoom(), top: (y - 96) * zoom() }
  }

  return (
    <div ref={wrap} class="boardwrap">
      <div class="plate" style={{ width: `${bw * zoom()}px`, height: `${bh * zoom()}px` }}>
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
        <Show when={aimed()}>
          {(a) => (
            <div class="aimcard" style={{ left: `${a().left}px`, top: `${a().top}px` }}>
              <div class="head">
                <b>{t(`kind.${a().target.kind}`)}</b>
                <span class="hp">
                  {a().target.hp}/{a().target.profile.hp}
                </span>
                <b class="big">{a().hit.damage >= a().target.hp ? t("ui.kill") : `−${a().hit.damage}`}</b>
              </div>
              <span class="muted">
                {t("ui.cover")} −{a().hit.cover}
              </span>
              <Show when={a().hit.combo && a().target.status}>
                {(s) => <span class="combo">{t("ui.comboOn", { status: label(s()) })}</span>}
              </Show>
              <Show when={battle.intent(a().target.id)}>{(i) => <span class="plan">{i()}</span>}</Show>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
