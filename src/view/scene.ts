import { coverAgainst, coverAt, flankers } from "../rules/cover"
import { DETECTION, WEAPONS } from "../rules/data"
import { AROUND, distance, inside, key, ORTHOGONAL, plus, same, tileAt } from "../rules/grid"
import { sees, visibleTiles } from "../rules/sight"
import { visibleToSquad } from "../rules/stealth"
import type { Game, Point, Unit } from "../rules/types"
import { alive, sideOf } from "../rules/units"
import type { Float } from "./motion"
import { figures, gear, glyph, PALETTES, sprites, tone, UNIT_CELLS } from "./sprites"

/** What the board shows besides the game: selection, reach, hover and overlays. */
export interface Scene {
  game: Game
  size: number
  selected: Unit | null
  near: Set<number>
  far: Set<number>
  path: Point[]
  hover: Point | null
  targets: Set<string>
  area: Point[]
  range: Set<number>
  aimed: Point | null
  ghost: { unit: Unit; at: Point } | null
  zones: boolean
  mover: { id: string; at: Point } | null
  shot: { from: Point; to: Point; progress: number } | null
  texts: Float[]
  now: number
  life: number
}

/** Tiles the squad sees now. */
export function sight(game: Game): Set<number> {
  const out = new Set<number>()
  for (const u of game.units) {
    if (alive(u) && sideOf(u) === "squad") for (const k of visibleTiles(game, u)) out.add(k)
  }
  return out
}

function tile(ctx: CanvasRenderingContext2D, s: number, game: Game, p: Point): void {
  const biome = game.board.biome ?? "forest"
  const x = p.x * s
  const y = p.y * s
  const t = tileAt(game, p)
  const palette = PALETTES[biome]
  ctx.fillStyle = t === "water" ? palette.water : palette.ground
  ctx.fillRect(x, y, s, s)
  const g = glyph(biome, t, p)
  if (g === "dot") {
    const d = Math.max(2, Math.round(s / 16) * 2)
    ctx.fillStyle = palette.dot
    ctx.fillRect(x + (s - d) / 2, y + (s - d) / 2, d, d)
  } else if (g) sprites.draw(ctx, g.cell, g.color, x, y, s)
}

const phase = (id: string): number => [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0)

/**
 * A unit's sprite on a base disc in its side's color; aliens face left. It bobs at rest and while walking,
 * hops over low cover, kicks back when it fires and flashes and shakes when hit. Concealed units get a
 * dashed ring.
 */
function figure(ctx: CanvasRenderingContext2D, sc: Scene, u: Unit, alpha = 1, at: Point = u.pos): void {
  const s = sc.size
  const px = s / 16
  const x = at.x * s
  const y = at.y * s
  const walking = at.x % 1 !== 0 || at.y % 1 !== 0
  const below = { x: Math.round(at.x), y: Math.round(at.y) }
  const lift = 1 - 2 * Math.max(Math.abs(at.x - below.x), Math.abs(at.y - below.y))
  const bob = walking
    ? tileAt(sc.game, below) === "low"
      ? -Math.round(5 * lift)
      : -Math.round(Math.abs(Math.sin((at.x + at.y) * Math.PI * 2)))
    : Math.sin(sc.now / 450 + phase(u.id)) > 0.4
      ? -1
      : 0
  const firing = sc.shot && sc.shot.progress < 0.3 && sc.shot.from.x === at.x && sc.shot.from.y === at.y
  const kick = firing ? -Math.sign(sc.shot!.to.x - sc.shot!.from.x || 1) : 0
  const struck = sc.texts.some((f) => f.hit && same(f.at, u.pos) && sc.now - f.born < 220)
  const shake = struck ? (Math.floor(sc.now / 40) % 2 ? 1 : -1) : 0
  ctx.globalAlpha = alpha
  ctx.fillStyle = "rgba(0,0,0,0.55)"
  ctx.strokeStyle = tone(u)
  ctx.lineWidth = Math.max(1, px)
  ctx.beginPath()
  ctx.ellipse(x + s / 2, y + s * 0.88, s * 0.36, s * 0.11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.6
  ctx.stroke()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1
  ctx.save()
  ctx.translate(x + (kick + shake) * px, y + bob * px)
  if (sideOf(u) === "enemy") {
    ctx.translate(s, 0)
    ctx.scale(-1, 1)
  }
  figures.draw(ctx, UNIT_CELLS[u.kind], struck ? "#ffffff" : tone(u), 0, 0, s)
  if (!struck) gear.draw(ctx, UNIT_CELLS[u.kind], null, 0, 0, s)
  if (firing) {
    ctx.fillStyle = "#fff4c2"
    ctx.fillRect(s - 2 * px, s * 0.5, 2 * px, 2 * px)
  }
  ctx.restore()
  if (u.concealed) {
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = "rgba(232,241,255,0.8)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x + s / 2, y + s / 2, s * 0.46, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineWidth = 1
  }
  ctx.globalAlpha = 1
}

/** HP as one segment per point, AP dots, stances and statuses. */
function badges(ctx: CanvasRenderingContext2D, s: number, u: Unit, at: Point = u.pos): void {
  const x = at.x * s
  const y = at.y * s
  const seg = Math.min(6, Math.floor((s - 4) / u.maxHp) - 1)
  const width = seg >= 2 ? u.maxHp * (seg + 1) - 1 : s - 4
  const left = x + (s - width) / 2
  ctx.fillStyle = "rgba(0,0,0,0.85)"
  ctx.fillRect(left - 1, y + s - 7, width + 2, 6)
  const color = u.hp / u.maxHp > 0.5 ? "#5fd35f" : u.hp / u.maxHp > 0.25 ? "#e3c13b" : "#e3503b"
  if (seg < 2) {
    ctx.fillStyle = "#4a2222"
    ctx.fillRect(left, y + s - 6, width, 4)
    ctx.fillStyle = color
    ctx.fillRect(left, y + s - 6, (width * u.hp) / u.maxHp, 4)
  } else
    for (let i = 0; i < u.maxHp; i++) {
      ctx.fillStyle = i < u.hp ? color : "#4a2222"
      ctx.fillRect(left + i * (seg + 1), y + s - 6, seg, 4)
    }
  if (u.side === "squad" && sideOf(u) === "squad") {
    for (let i = 0; i < u.ap; i++) {
      ctx.fillStyle = "#ffd84a"
      ctx.beginPath()
      ctx.arc(x + 5 + i * 6, y + 5, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const marks = [
    u.stance === "overwatch" ? "◉" : "",
    u.stance === "hunker" ? "▼" : "",
    ...u.statuses.map(
      (st) =>
        ({
          suppressed: "S",
          frightened: "F",
          shaken: "K",
          burning: "B",
          dominated: "D",
          ward: "",
          exposed: "X",
          staggered: "≈",
        })[st.id],
    ),
  ]
    .filter(Boolean)
    .join("")
  if (marks) {
    ctx.fillStyle = "#fff"
    ctx.font = `bold ${Math.max(9, Math.floor(s * 0.3))}px system-ui`
    ctx.textAlign = "right"
    ctx.textBaseline = "top"
    ctx.fillText(marks, x + s - 2, y + 1)
  }
  if (u.statuses.some((st) => st.id === "ward")) {
    const r = Math.max(4, s * 0.14)
    shield(ctx, x + s - r - 2, y + (marks ? s * 0.5 : r + 2), r, true, "#b98cff")
  }
}

/** Draws the border of a set of tiles: edges where the set ends. */
function outline(ctx: CanvasRenderingContext2D, s: number, keys: Set<number>, color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const k of keys) {
    const x = (k % 1000) * s
    const y = Math.floor(k / 1000) * s
    if (!keys.has(k - 1000)) {
      ctx.moveTo(x, y)
      ctx.lineTo(x + s, y)
    }
    if (!keys.has(k + 1000)) {
      ctx.moveTo(x, y + s)
      ctx.lineTo(x + s, y + s)
    }
    if (!keys.has(k - 1)) {
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + s)
    }
    if (!keys.has(k + 1)) {
      ctx.moveTo(x + s, y)
      ctx.lineTo(x + s, y + s)
    }
  }
  ctx.stroke()
  ctx.lineWidth = 1
}

function tint(ctx: CanvasRenderingContext2D, s: number, keys: Iterable<number>, color: string): void {
  ctx.fillStyle = color
  for (const k of keys) ctx.fillRect((k % 1000) * s, Math.floor(k / 1000) * s, s, s)
}

function ring(ctx: CanvasRenderingContext2D, s: number, p: Point, color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(p.x * s + s / 2, p.y * s + s / 2, s * 0.48, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1
}

function arrow(ctx: CanvasRenderingContext2D, s: number, from: Point, to: Point, color: string, dashed = false): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  if (dashed) ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.moveTo(from.x * s + s / 2, from.y * s + s / 2)
  ctx.lineTo(to.x * s + s / 2, to.y * s + s / 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineWidth = 1
}

function zones(ctx: CanvasRenderingContext2D, s: number, game: Game, enemies: Unit[]): void {
  for (const e of enemies) {
    const radius =
      e.stance === "overwatch" ? e.vision : e.alert === "unaware" ? DETECTION.unaware : DETECTION.investigating
    const color = e.stance === "overwatch" ? "rgba(255,150,40,0.22)" : "rgba(255,40,40,0.18)"
    const keys: number[] = []
    for (let y = e.pos.y - radius; y <= e.pos.y + radius; y++) {
      for (let x = e.pos.x - radius; x <= e.pos.x + radius; x++) {
        const p = { x, y }
        if (inside(game.board, p) && distance(e.pos, p) <= radius && sees(game, e, p, radius)) keys.push(key(p))
      }
    }
    tint(ctx, s, keys, color)
    if (WEAPONS[e.weapon].melee) {
      tint(
        ctx,
        s,
        AROUND.map((d) => key(plus(e.pos, d))),
        "rgba(170,60,220,0.25)",
      )
    }
  }
}

function shield(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  full: boolean,
  color = "#4fc3ff",
): void {
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r * 0.85, cy - r * 0.6)
  ctx.lineTo(cx + r * 0.75, cy + r * 0.25)
  ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.8, cx, cy + r)
  ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.8, cx - r * 0.75, cy + r * 0.25)
  ctx.lineTo(cx - r * 0.85, cy - r * 0.6)
  ctx.closePath()
  ctx.fillStyle = "rgba(10,20,30,0.85)"
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = color
  if (full) ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  else ctx.fillRect(cx - r, cy, r * 2, r)
  ctx.restore()
  ctx.strokeStyle = "#bfe9ff"
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.lineWidth = 1
}

/** Shield icons on the tile edges that give cover: full for high cover, half for low. */
function cover(ctx: CanvasRenderingContext2D, s: number, game: Game, p: Point): void {
  for (const d of ORTHOGONAL) {
    const c = coverAt(game, plus(p, d))
    if (c === 0) continue
    const cx = p.x * s + s / 2 + d.x * s * 0.42
    const cy = p.y * s + s / 2 + d.y * s * 0.42
    shield(ctx, cx, cy, Math.max(5, s * 0.2), c >= 5)
  }
}

/** A red triangle with "!" on a soldier that an enemy flanks. */
function warn(ctx: CanvasRenderingContext2D, s: number, at: Point): void {
  const x = at.x * s + 2
  const y = at.y * s + s * 0.55
  const r = Math.max(6, s * 0.2)
  ctx.fillStyle = "#ff3b3b"
  ctx.beginPath()
  ctx.moveTo(x + r, y - r)
  ctx.lineTo(x + 2 * r, y + r * 0.7)
  ctx.lineTo(x, y + r * 0.7)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = `bold ${Math.floor(r * 1.3)}px system-ui`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("!", x + r, y + r * 0.05)
}

function shot(ctx: CanvasRenderingContext2D, s: number, sh: NonNullable<Scene["shot"]>): void {
  const ax = sh.from.x * s + s / 2
  const ay = sh.from.y * s + s / 2
  const bx = sh.to.x * s + s / 2
  const by = sh.to.y * s + s / 2
  const head = Math.min(1, sh.progress * 1.4)
  const tail = Math.max(0, sh.progress * 1.4 - 0.4)
  ctx.strokeStyle = "#fff4c2"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(ax + (bx - ax) * tail, ay + (by - ay) * tail)
  ctx.lineTo(ax + (bx - ax) * head, ay + (by - ay) * head)
  ctx.stroke()
  ctx.lineWidth = 1
}

/** Draws the whole board for the player: only what the squad sees, knows or remembers. */
export function draw(ctx: CanvasRenderingContext2D, sc: Scene): void {
  const { game, size: s } = sc
  const { width, height } = game.board
  const seen = sight(game)
  const palette = PALETTES[game.board.biome ?? "forest"]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = { x, y }
      if (!game.explored[y * width + x]) {
        ctx.fillStyle = palette.void
        ctx.fillRect(x * s, y * s, s, s)
        continue
      }
      tile(ctx, s, game, p)
      if (!seen.has(key(p))) {
        ctx.fillStyle = "rgba(8,6,12,0.6)"
        ctx.fillRect(x * s, y * s, s, s)
      }
    }
  }
  for (const z of game.zones) {
    if (z.kind === "smoke")
      tint(ctx, s, z.tiles.filter((p) => game.explored[p.y * width + p.x]).map(key), "rgba(200,200,210,0.35)")
  }
  const enemies = game.units.filter((u) => alive(u) && u.side === "enemy" && visibleToSquad(game, u))
  if (sc.zones) zones(ctx, s, game, enemies)
  outline(ctx, s, sc.range, "#ff8a3c")
  outline(ctx, s, sc.far, "#f2c94c")
  outline(ctx, s, sc.near, "#4aa3ff")
  tint(ctx, s, sc.area.map(key), "rgba(255,120,40,0.35)")
  if (sc.path.length > 0 && sc.selected) {
    ctx.lineWidth = 2
    let from = sc.selected.pos
    for (const p of sc.path) {
      ctx.strokeStyle = sc.near.has(key(p)) ? "#4aa3ff" : "#f2c94c"
      ctx.beginPath()
      ctx.moveTo(from.x * s + s / 2, from.y * s + s / 2)
      ctx.lineTo(p.x * s + s / 2, p.y * s + s / 2)
      ctx.stroke()
      from = p
    }
    ctx.lineWidth = 1
  }
  for (const g of game.ghosts) {
    const u = game.units.find((x) => x.id === g.unit)
    if (!u || enemies.includes(u)) continue
    figure(ctx, sc, { ...u, pos: g.at, concealed: false }, 0.35)
    ctx.fillStyle = "#fff"
    ctx.font = `${Math.floor(s * 0.3)}px system-ui`
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillText(`R${g.round}`, g.at.x * s + 2, g.at.y * s + 1)
  }
  for (const n of game.noises) {
    if (n.round < game.round - 1 || seen.has(key(n.at))) continue
    ctx.fillStyle = "rgba(255,220,80,0.9)"
    ctx.font = `bold ${Math.floor(s * 0.7)}px system-ui`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("?", n.at.x * s + s / 2, n.at.y * s + s / 2)
  }
  for (const e of enemies) {
    const intent = e.intent
    if (intent?.type === "bomb")
      tint(
        ctx,
        s,
        AROUND.concat({ x: 0, y: 0 }).map((d) => key(plus(intent.at, d))),
        "rgba(255,60,0,0.35)",
      )
    if (intent?.type === "charge") {
      const t = game.units.find((x) => x.id === intent.target)
      if (t && alive(t)) arrow(ctx, s, e.pos, t.pos, "#ff5a3c", true)
    }
    if (e.alert === "unaware" && e.patrol.length > 0) {
      const goal = e.patrol[e.patrolIndex % e.patrol.length]
      const dx = Math.sign(goal.x - e.pos.x)
      const dy = Math.sign(goal.y - e.pos.y)
      if (dx || dy) arrow(ctx, s, e.pos, { x: e.pos.x + dx * 0.9, y: e.pos.y + dy * 0.9 }, "#ffd84a")
    }
  }
  for (const u of game.units) {
    if (!alive(u) || (u.side === "enemy" && !enemies.includes(u))) continue
    const at = sc.mover?.id === u.id ? sc.mover.at : u.pos
    const spent = u.side === "squad" && sideOf(u) === "squad" && game.phase === "squad" && u.ap === 0
    figure(ctx, sc, u, spent ? 0.45 : 1, at)
    badges(ctx, s, u, at)
    if (u.side === "squad" && sideOf(u) === "squad" && flankers(game, u, enemies).length > 0) warn(ctx, s, at)
  }
  if (sc.ghost) {
    figure(ctx, sc, sc.ghost.unit, 0.5, sc.ghost.at)
    cover(ctx, s, game, sc.ghost.at)
  }
  if (sc.mover && !game.units.some((u) => u.id === sc.mover!.id && (u.side === "squad" || enemies.includes(u)))) {
    const u = game.units.find((x) => x.id === sc.mover!.id)
    if (u && seen.has(key({ x: Math.round(sc.mover.at.x), y: Math.round(sc.mover.at.y) })))
      figure(ctx, sc, u, 1, sc.mover.at)
  }
  for (const f of sc.texts) {
    if (f.unit && seen.has(key(f.at))) figure(ctx, sc, f.unit, Math.max(0, 1 - (sc.now - f.born) / sc.life), f.at)
  }
  if (sc.selected) {
    const id = sc.selected.id
    const at = sc.mover?.id === id ? sc.mover.at : (game.units.find((x) => x.id === id)?.pos ?? sc.selected.pos)
    ring(ctx, s, at, "#ffffff")
    if (!sc.mover) cover(ctx, s, game, at)
  }
  if (sc.aimed) {
    ring(ctx, s, sc.aimed, "#ff3b3b")
    ring(ctx, s, sc.aimed, "rgba(255,255,255,0.35)")
  }
  if (sc.shot) shot(ctx, s, sc.shot)
  for (const f of sc.texts) {
    const age = (sc.now - f.born) / sc.life
    ctx.globalAlpha = Math.max(0, 1 - age)
    ctx.fillStyle = f.color
    ctx.strokeStyle = "rgba(0,0,0,0.8)"
    ctx.lineWidth = 3
    ctx.font = `bold ${Math.floor(s * 0.6)}px system-ui`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const y = f.at.y * s + s / 2 - age * s * 0.9
    ctx.strokeText(f.text, f.at.x * s + s / 2, y)
    ctx.fillText(f.text, f.at.x * s + s / 2, y)
    ctx.globalAlpha = 1
    ctx.lineWidth = 1
  }
  for (const e of enemies) if (sc.targets.has(e.id)) ring(ctx, s, e.pos, "rgba(255,255,255,0.55)")
  const hover = sc.hover
  const sel = sc.selected
  if (hover && sel && (sc.near.has(key(hover)) || sc.far.has(key(hover)))) {
    cover(ctx, s, game, hover)
    for (const e of enemies) {
      if (sees(game, e, hover) && coverAgainst(game, hover, e.pos) === 0) ring(ctx, s, e.pos, "#ff3b3b")
      else if (sees(game, { ...sel, pos: hover }, e.pos) && coverAgainst(game, e.pos, hover) === 0)
        ring(ctx, s, e.pos, "#3bff6a")
    }
    const radius = (e: Unit) => (e.alert === "unaware" ? DETECTION.unaware : DETECTION.investigating)
    if (sel.concealed && enemies.some((e) => sees(game, e, hover, radius(e)))) {
      sprites.draw(ctx, [36, 13], "#ff3b3b", hover.x * s + s / 4, hover.y * s + s / 4, s / 2)
    }
  }
  if (hover && !same(hover, sc.selected?.pos ?? { x: -1, y: -1 })) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)"
    ctx.strokeRect(hover.x * s + 1, hover.y * s + 1, s - 2, s - 2)
  }
}
