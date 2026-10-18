import { key, type Point, same } from "../rules/point"
import type { Tile } from "../rules/tile"
import type { Unit } from "../rules/unit"
import { ALIEN, AMBER, BLACK, DOMINATED, EMBER, FLAME, mix, PSION, type Rgb, rgb, SMOKE, SQUAD, WHITE } from "./color"
import { FIRE, TILES, textWidth, UNITS } from "./glyphs"
import { Light, TERRAIN } from "./light"
import { Marks } from "./marks"
import type { Pixels } from "./pixels"
import { LIFT } from "./projection"
import type { Scene } from "./scene"

/** Tiles that stand up from the ground and can hide what is behind them. */
const TALL: Tile[] = ["roof", "wall", "door", "open", "high", "tree", "rock", "low", "ladder"]

/** A whole-number hash of a tile, for steady random looks. */
export const hash = (x: number, y: number, i: number): number => {
  let h = (x * 374761393 + y * 668265263 + i * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** The color a unit is drawn in: cream for the squad, red for aliens, teal for the Psion, violet when Dominated. */
export function tone(u: Unit): Rgb {
  if (u.has("dominated")) return DOMINATED
  if (u.side === "squad") return SQUAD
  return u.kind === "whisperer" ? PSION : ALIEN
}

/** How high a unit stands on a tile: a storey on a roof, a little on a ridge. */
export const height = (tile: Tile): number => (tile === "roof" ? LIFT : tile === "ridge" ? 2 : 0)

/** One frame of the board: ground, marks, then objects and units back to front, then effects. */
export class Picture {
  private readonly light: Light
  private readonly marks: Marks
  private readonly order: Point[] = []
  private readonly faded = new Set<number>()
  private readonly standing: Point[]

  constructor(
    private readonly px: Pixels,
    private readonly scene: Scene,
    private readonly t: number,
  ) {
    const { game } = scene
    const eyes = game.units.filter((u) => u.alive() && u.allegiance() === "squad").map((u) => u.pos)
    const flash = scene.shot && scene.shot.progress < 0.3 ? scene.shot.from : null
    this.light = Light.of(game, scene.daylight, scene.seen, eyes, t, flash)
    this.marks = new Marks(px, scene, t)
    this.standing = this.figures().map((u) => this.place(u))
  }

  draw(): void {
    const { game } = this.scene
    const { width, height } = game.board
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.order.push({ x, y })
    this.order.sort((a, b) => a.x + a.y - (b.x + b.y) || a.y - b.y)
    for (const p of [...this.standing, ...(this.scene.hover ? [this.scene.hover] : [])])
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        this.faded.add(key({ x: Math.round(p.x) + dx, y: Math.round(p.y) + dy }))
    for (const l of this.light.lamps) {
      if (l.strength <= 0.05) continue
      const a = this.px.projection.anchor(l.at)
      this.px.glow(a.x, a.y - 8, 38, l.color, 0.12 * l.strength)
    }
    for (const p of this.order) this.ground(p)
    this.marks.under()
    for (const p of this.order) {
      this.object(p)
      for (const u of this.figures()) if (same(this.cell(u), p)) this.figure(u)
    }
    this.effects()
    this.marks.over()
    this.ambient()
  }

  private explored(p: Point): boolean {
    const { board, explored } = this.scene.game
    return board.inside(p) && explored[p.y * board.width + p.x]
  }

  private ground(p: Point): void {
    if (!this.explored(p)) return
    const { game, houses } = this.scene
    const tile = game.tile(p)
    if (TALL.includes(tile) || this.burning(p)) return
    if (houses.roofed(p, this.standing)) return
    const a = this.px.projection.anchor(p)
    const c = this.light.shade(TERRAIN[tile], p)
    const r = hash(p.x, p.y, 1)
    const t = this.t
    if (tile === "water") {
      const frame = Math.floor(t / 650 + p.x * 0.5 + p.y * 0.3) % 2 ? TILES.water2 : TILES.water
      const glint = hash(p.x, p.y, Math.floor(t / 650)) < 0.08 ? 0.35 : 0
      this.px.glyph(frame, a.x, a.y, mix(c, WHITE, glint))
    } else if (tile === "grass") {
      if (r < 0.6) this.px.glyph(Math.sin(t / 900 + r * 9) > 0.7 ? TILES.grass2 : TILES.grass, a.x, a.y, c)
    } else if (tile === "mud" || tile === "ridge" || tile === "bridge") this.px.glyph(TILES[tile], a.x, a.y, c)
    else if (r < 0.5 && !this.marks.covers(p)) this.px.glyph(TILES.dot, a.x, a.y, c)
    if (game.zones.some((z) => z.kind === "mine" && z.tiles.some((m) => same(m, p))))
      this.px.glyph(TILES.mine, a.x, a.y, mix(ALIEN, c, 0.2))
  }

  private object(p: Point): void {
    if (!this.explored(p)) return
    const { game, houses } = this.scene
    const tile = game.tile(p)
    const a = this.px.projection.anchor(p)
    const c = this.light.shade(TERRAIN[tile], p)
    const open = houses.open(p, this.standing)
    const alpha = this.faded.has(key(p)) ? 0.28 : open ? 0.4 : 1
    const r = hash(p.x, p.y, 1)
    if (tile === "roof") {
      this.px.glyph(TILES.roof, a.x, a.y, c, alpha)
      this.px.glyph(TILES.roof, a.x, a.y - LIFT, mix(c, WHITE, 0.1), alpha)
    } else if (tile === "wall" || tile === "door" || tile === "open") {
      this.px.glyph(TILES[tile], a.x, a.y, c, alpha)
    } else if (tile === "tree") {
      const sway = Math.sin(this.t / 700 + r * 6) > 0.6 ? 1 : 0
      this.px.glyph(TILES.tree.slice(0, 3), a.x + sway, a.y - 6, c, alpha)
      this.px.glyph([[], [], [], ...TILES.tree.slice(3)], a.x, a.y, c, alpha)
    } else if (tile === "ladder" || tile === "rock" || tile === "low" || tile === "high")
      this.px.glyph(TILES[tile], a.x, a.y, c, alpha)
    if (houses.roofed(p, this.standing))
      this.px.glyph(TILES.roof, a.x, a.y, mix(this.light.shade(TERRAIN.roof, p), WHITE, 0.1))
    if (this.burning(p)) {
      const f = Math.floor(this.t / 110 + r * 3) % 3
      FIRE[f].forEach((row, j) => {
        row.forEach((on, i) => {
          if (on) this.px.dot(a.x - 3 + i, a.y - 9 + j, mix(FLAME, EMBER, j / 8))
        })
      })
      for (let k = 0; k < 4; k++) {
        const life = (this.t / 1600 + hash(p.x, k, 5)) % 1
        const sx = a.x - 2 + hash(p.x, k, 6) * 5 + Math.sin(this.t / 300 + k) * 2
        this.px.dot(sx, a.y - 12 - life * 26, [120, 112, 104], 0.5 * (1 - life))
      }
    }
  }

  /** Units the player sees: the squad, aliens in sight, downed soldiers, a unit walking and units that just died. */
  private figures(): Unit[] {
    const { game, mover, texts } = this.scene
    const shown = game.units.filter(
      (u) =>
        (u.alive() || u.down > 0) &&
        (u.side === "squad" || game.stealth.visible(u) || (mover?.id === u.id && this.seenAt(mover.at))),
    )
    const dying = texts.flatMap((f) => (f.unit && this.seenAt(f.at) ? [f.unit] : []))
    return [...shown, ...dying.filter((d) => !shown.some((u) => u.id === d.id))]
  }

  private seenAt(p: Point): boolean {
    return this.scene.seen.has(key({ x: Math.round(p.x), y: Math.round(p.y) }))
  }

  /** Where a unit stands this frame, walking or not. */
  private place(u: Unit): Point {
    const m = this.scene.mover
    return m?.id === u.id ? m.at : u.pos
  }

  private cell(u: Unit): Point {
    const p = this.place(u)
    return { x: Math.round(p.x), y: Math.round(p.y) }
  }

  private figure(u: Unit): void {
    const { game, texts, now, life, shot } = this.scene
    const at = this.place(u)
    const a = this.px.projection.anchor(at)
    const lift = height(game.tile(this.cell(u)))
    const fade = texts.find((f) => f.unit?.id === u.id)
    if (u.down > 0 && !u.alive()) {
      this.px.lying(UNITS[u.kind], a.x, a.y - 1 - lift, tone(u), 0.6)
      this.px.label(String(u.down), a.x + 6, a.y - 10 - lift, ALIEN, 0.9)
      return
    }
    const struck = texts.some((f) => f.hit && same(f.at, u.pos) && now - f.born < 220)
    const walking = at.x % 1 !== 0 || at.y % 1 !== 0
    const bob = walking
      ? -Math.round(Math.abs(Math.sin((at.x + at.y) * Math.PI * 2)))
      : Math.floor(this.t / 500 + hash(u.pos.x, u.pos.y, 2) * 4) % 4 === 0
        ? -1
        : 0
    const float = u.kind === "whisperer" || u.kind === "drone" ? Math.round(Math.sin(this.t / 400) * 1.5) - 2 : 0
    const firing = shot && shot.progress < 0.3 && same(shot.from, u.pos)
    const kick = firing ? -Math.sign(shot.to.x - shot.to.y - shot.from.x + shot.from.y || 1) : 0
    const shake = struck ? (Math.floor(now / 40) % 2 ? 1 : -1) : 0
    const spent = u.side === "squad" && u.allegiance() === "squad" && game.phase === "squad" && u.ap === 0
    const alpha = fade ? Math.max(0, 1 - (now - fade.born) / life) : spent ? 0.55 : u.concealed ? 0.75 : 1
    this.px.glyph(UNITS[u.kind], a.x + kick + shake, a.y - 2 - lift + bob + float, struck ? WHITE : tone(u), alpha)
  }

  private burning(p: Point): boolean {
    return this.scene.game.fire.burning(p)
  }

  /** The tracer of a shot, the muzzle flash and the sparks of the hit. */
  private effects(): void {
    const { shot, ghost, game } = this.scene
    if (ghost) {
      const a = this.px.projection.anchor(ghost.at)
      this.px.glyph(UNITS[ghost.unit.kind], a.x, a.y - 2 - height(game.tile(ghost.at)), tone(ghost.unit), 0.45)
    }
    if (!shot) return
    const A = this.px.projection.anchor(shot.from)
    const B = this.px.projection.anchor(shot.to)
    const la = height(game.tile(shot.from))
    const lb = height(game.tile(shot.to))
    const f = Math.min(1, shot.progress * 1.6)
    for (let k = 0; k < 4; k++) {
      const ff = Math.max(0, f - k * 0.05)
      this.px.dot(A.x + (B.x - A.x) * ff, A.y - 7 - la + (B.y - A.y - lb + la) * ff, FLAME, 1 - k * 0.22)
    }
    if (shot.progress < 0.25) this.px.glow(A.x + 3, A.y - 7 - la, 10, FLAME, 0.8)
    if (shot.progress > 0.55) {
      const s = (shot.progress - 0.55) / 0.45
      for (let k = 0; k < 10; k++) {
        const angle = hash(k, 8, 1) * 6.28
        const v = 5 + hash(k, 9, 1) * 10
        const x = B.x + Math.cos(angle) * v * s
        const y = B.y - 6 - lb + Math.sin(angle) * v * s * 0.6 + s * s * 8
        this.px.dot(x, y, k < 5 ? FLAME : mix(EMBER, BLACK, 0.4), 1 - s)
      }
    }
  }

  /** Smoke, lamp embers, floating dust by day and the rising texts. */
  private ambient(): void {
    const { game, daylight, texts, now, life } = this.scene
    const t = this.t
    for (const z of game.zones)
      if (z.kind === "smoke")
        for (const p of z.tiles) {
          if (!this.explored(p)) continue
          const a = this.px.projection.ground(p)
          this.px.glow(a.x, a.y - 4, 14, SMOKE, 0.12)
          for (let k = 0; k < 3; k++) {
            const life = (t / 2400 + hash(p.x, p.y, k)) % 1
            this.px.dot(
              a.x - 6 + hash(p.y, k, 3) * 12 + Math.sin(t / 600 + k) * 2,
              a.y - life * 14,
              SMOKE,
              0.5 * (1 - life),
              2,
            )
          }
        }
    if (daylight.lamps > 0)
      for (const l of this.light.lamps) {
        if (l.color !== AMBER) continue
        const a = this.px.projection.anchor(l.at)
        for (let k = 0; k < 3; k++) {
          const life = (t / 2600 + hash(l.at.x, k, 3)) % 1
          const x = a.x + (hash(l.at.x, k, 3) - 0.5) * 18 + Math.sin(t / 500 + k) * 2
          this.px.dot(x, a.y - 12 - life * 22, l.color, daylight.lamps * 0.6 * (1 - life))
        }
      }
    if (daylight.time === "day") {
      const size = this.px.projection.size()
      for (let k = 0; k < 10; k++) {
        const p = (t / 9000 + hash(k, 0, 4)) % 1
        const y = hash(k, 2, 4) * size.y + Math.sin(t / 700 + k) * 3
        this.px.dot(p * size.x, y, [230, 225, 200], 0.22)
      }
    }
    for (const f of texts) {
      if (!f.text || !this.seenAt(f.at)) continue
      const age = (now - f.born) / life
      if (age >= 1) continue
      const a = this.px.projection.anchor(f.at)
      const y = a.y - 26 - height(game.tile(f.at)) - age * 10
      const color = rgb(f.color)
      const text = f.text.toUpperCase()
      const w = textWidth(text)
      if (w > 0) this.px.label(text, a.x - w / 2, y, color, 1 - age * age)
      else this.text(f.text, a.x, y + 4, color, 1 - age * age)
    }
  }

  /** A word in the system font, for texts the pixel font has no letters for. */
  private text(s: string, x: number, y: number, color: Rgb, a: number): void {
    const ctx = this.px.ctx
    ctx.font = "bold 6px ui-monospace, Menlo, monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = `rgba(0,0,0,${a * 0.8})`
    ctx.fillText(s, x + 0.5, y + 0.5)
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${a})`
    ctx.fillText(s, x, y)
  }
}
