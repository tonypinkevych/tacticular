import { key, type Point, same } from "../../map/point"
import type { Tile } from "../../map/tile"
import type { Unit } from "../../units/unit"
import { ALIEN, AMBER, BLACK, DOMINATED, EMBER, FLAME, mix, PSION, type Rgb, rgb, SMOKE, SQUAD, WHITE } from "./color"
import { FIRE, TILES, textWidth, UNITS } from "./glyphs"
import { Light, TERRAIN } from "./light"
import { Marks } from "./marks"
import type { Pixels } from "./pixels"
import { LIFT } from "./projection"
import type { Scene } from "./scene"

/** Tiles that stand up from the ground and can hide what is behind them. */
const TALL: Tile[] = ["roof", "wall", "door", "open", "high", "tree", "rock", "low", "ladder", "barrel"]

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
    const { game, shot } = this.scene
    const quake = shot?.style === "arc" && shot.progress > 0.6 && shot.progress < 0.85
    this.px.ctx.save()
    if (quake) this.px.ctx.translate(Math.floor(this.t / 30) % 2 ? 2 : -2, Math.floor(this.t / 45) % 2 ? 1 : -1)
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
    this.px.ctx.restore()
  }

  private explored(p: Point): boolean {
    const { board, explored } = this.scene.game
    return board.inside(p) && explored[p.y * board.width + p.x]
  }

  /** A tile's lit color; a tile the squad never saw is dark, so the layout shows but nothing on it. */
  private shade(tile: Tile, p: Point): Rgb {
    const c = this.light.shade(TERRAIN[tile], p)
    return this.explored(p) ? c : mix(c, BLACK, 0.25)
  }

  private ground(p: Point): void {
    const { game, houses } = this.scene
    const tile = game.tile(p)
    if (TALL.includes(tile) || this.burning(p)) return
    if (houses.roofed(p, this.standing)) return
    const a = this.px.projection.anchor(p)
    const c = this.shade(tile, p)
    const r = hash(p.x, p.y, 1)
    const t = this.t
    if (tile === "water") {
      const frame = Math.floor(t / 650 + p.x * 0.5 + p.y * 0.3) % 2 ? TILES.water2 : TILES.water
      const glint = hash(p.x, p.y, Math.floor(t / 650)) < 0.08 ? 0.35 : 0
      this.px.glyph(frame, a.x, a.y, mix(c, WHITE, glint))
    } else if (tile === "grass") {
      if (r < 0.6) this.px.glyph(Math.sin(t / 900 + r * 9) > 0.7 ? TILES.grass2 : TILES.grass, a.x, a.y, c)
    } else if (tile === "mud" || tile === "ridge" || tile === "bridge") this.px.glyph(TILES[tile], a.x, a.y, c)
    if (this.explored(p) && game.zones.some((z) => z.kind === "mine" && z.tiles.some((m) => same(m, p))))
      this.px.glyph(TILES.mine, a.x, a.y, mix(ALIEN, c, 0.2))
  }

  private object(p: Point): void {
    const { game, houses } = this.scene
    const tile = game.tile(p)
    const a = this.px.projection.anchor(p)
    const c = this.shade(tile, p)
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
    } else if (tile === "ladder" || tile === "rock" || tile === "low" || tile === "high" || tile === "barrel")
      this.px.glyph(TILES[tile], a.x, a.y, c, alpha)
    if (houses.roofed(p, this.standing)) this.px.glyph(TILES.roof, a.x, a.y, mix(this.shade("roof", p), WHITE, 0.1))
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

  /** Where a unit stands this frame, walking, dragged by a Hook, or still. */
  private place(u: Unit): Point {
    const { mover: m, shot } = this.scene
    if (m?.id === u.id) return m.at
    if (shot?.style === "hook" && shot.land && same(shot.to, u.pos) && shot.progress > 0.5) {
      const k = (shot.progress - 0.5) / 0.5
      return { x: u.pos.x + (shot.land.x - u.pos.x) * k, y: u.pos.y + (shot.land.y - u.pos.y) * k }
    }
    return u.pos
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
    const float = u.kind === "whisperer" ? Math.round(Math.sin(this.t / 400) * 1.5) - 2 : 0
    const firing =
      shot && (shot.style === "bolt" || shot.style === "arc") && shot.progress < 0.3 && same(shot.from, u.pos)
    const kick = firing ? -Math.sign(shot.to.x - shot.to.y - shot.from.x + shot.from.y || 1) : 0
    const shake = struck ? (Math.floor(now / 40) % 2 ? 1 : -1) : 0
    const push = this.push(u)
    const spent = u.side === "squad" && u.allegiance() === "squad" && game.phase === "squad" && u.ap === 0
    const vanish = shot?.style === "ghost" && same(shot.from, u.pos) ? 1 - Math.sin(shot.progress * Math.PI) * 0.85 : 1
    const alpha = vanish * (fade ? Math.max(0, 1 - (now - fade.born) / life) : spent ? 0.55 : u.concealed ? 0.75 : 1)
    const x = a.x + kick + shake + push.x
    const y = a.y - 2 - lift + bob + float + push.y
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      this.px.glyph(UNITS[u.kind], x + dx, y + dy, BLACK, alpha * 0.85)
    const flash =
      struck || (shot?.style === "melee" && same(shot.to, u.pos) && shot.progress > 0.45 && shot.progress < 0.6)
    this.px.glyph(UNITS[u.kind], x, y, flash ? WHITE : mix(tone(u), WHITE, 0.15), alpha)
  }

  /** How far a melee strike moves a unit on screen: the striker lunges in, the struck one reels back. */
  private push(u: Unit): { x: number; y: number } {
    const shot = this.scene.shot
    if (shot?.style !== "melee") return { x: 0, y: 0 }
    const A = this.px.projection.anchor(shot.from)
    const B = this.px.projection.anchor(shot.to)
    const len = Math.hypot(B.x - A.x, B.y - A.y) || 1
    const [dx, dy] = [(B.x - A.x) / len, (B.y - A.y) / len]
    const p = shot.progress
    const k = same(shot.from, u.pos) ? Math.sin(Math.min(1, p / 0.9) * Math.PI) * 8 : 0
    const back = same(shot.to, u.pos) && p > 0.45 ? 3 * (1 - (p - 0.45) / 0.55) : 0
    return { x: Math.round(dx * (k + back)), y: Math.round(dy * (k + back)) }
  }

  private burning(p: Point): boolean {
    return this.explored(p) && this.scene.game.fire.burning(p)
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
    if (shot.style === "melee") {
      this.slash(B.x, B.y - 6 - lb, shot.progress)
      return
    }
    if (shot.style === "arc") {
      this.arc(A.x, A.y - 7 - la, B.x, B.y - 4 - lb, shot.progress)
      return
    }
    if (shot.style === "hook") {
      const p = shot.progress
      const reach = p < 0.5 ? p * 2 : 1 - ((p - 0.5) / 0.5) * (1 - this.drag(shot.from, shot.to, shot.land))
      this.hook(A.x, A.y - 7 - la, B.x, B.y - 6 - lb, reach)
      return
    }
    if (shot.style === "mark") {
      this.mark(B.x, B.y - 6 - lb, shot.progress)
      return
    }
    if (shot.style === "ghost") {
      this.puff(A.x, A.y - 4 - la, shot.progress)
      return
    }
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

  /** The share of the chain left out once the Hook's target lands: its landing distance over the throw. */
  private drag(from: Point, to: Point, land: Point | undefined): number {
    const out = Math.hypot(to.x - from.x, to.y - from.y) || 1
    return land ? Math.hypot(land.x - from.x, land.y - from.y) / out : 0
  }

  /** The Hook's chain, out to a share of the way to the target, with the hook at its head. */
  private hook(x0: number, y0: number, x1: number, y1: number, reach: number): void {
    const hx = x0 + (x1 - x0) * reach
    const hy = y0 + (y1 - y0) * reach
    const links = Math.max(1, Math.floor(Math.hypot(hx - x0, hy - y0) / 3))
    for (let k = 0; k <= links; k++) this.px.dot(x0 + ((hx - x0) * k) / links, y0 + ((hy - y0) * k) / links, SMOKE, 0.9)
    this.px.dot(hx - 1, hy - 1, WHITE, 1, 3, 3)
  }

  /** Mark: red corner brackets that close on the target, then blink. */
  private mark(x: number, y: number, progress: number): void {
    const r = Math.round(12 - 7 * Math.min(1, progress / 0.6))
    const a = progress < 0.6 || Math.floor(progress * 12) % 2 === 0 ? 0.95 : 0.3
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      this.px.dot(x + sx * r - (sx > 0 ? 2 : 0), y + sy * r, ALIEN, a, 3, 1)
      this.px.dot(x + sx * r, y + sy * r - (sy > 0 ? 2 : 0), ALIEN, a, 1, 3)
    }
  }

  /** Ghost: a ring of grey smoke that spreads and fades around the Scout. */
  private puff(x: number, y: number, progress: number): void {
    for (let k = 0; k < 14; k++) {
      const angle = hash(k, 3, 7) * 6.28
      const v = 4 + progress * 12 * (0.6 + hash(k, 5, 7) * 0.4)
      this.px.dot(
        x + Math.cos(angle) * v,
        y + Math.sin(angle) * v * 0.5 - progress * 4,
        SMOKE,
        0.8 * (1 - progress),
        2,
        2,
      )
    }
  }

  /** A melee hit: a white slash across the target and a few sparks. */
  private slash(x: number, y: number, progress: number): void {
    if (progress < 0.4 || progress > 0.75) return
    const s = (progress - 0.4) / 0.35
    for (let k = 0; k < 7; k++) this.px.dot(x - 6 + k * 2, y - 5 + k * 1.5, WHITE, (1 - s) * (0.5 + k / 14), 2, 1)
    for (let k = 0; k < 6; k++) {
      const angle = hash(k, 4, 2) * 6.28
      this.px.dot(x + Math.cos(angle) * 9 * s, y + Math.sin(angle) * 5 * s, FLAME, 1 - s)
    }
  }

  /** A fired or thrown charge: it flies on a high arc with a smoke trail, then bursts in fire and debris. */
  private arc(x0: number, y0: number, x1: number, y1: number, progress: number): void {
    const rise = 16 + Math.hypot(x1 - x0, y1 - y0) * 0.2
    const at = (f: number) => ({ x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * rise })
    const f = Math.min(1, progress / 0.6)
    if (f < 1) {
      for (let k = 1; k <= 6; k++) {
        const p = at(Math.max(0, f - k * 0.05))
        this.px.dot(p.x, p.y, SMOKE, 0.5 - k * 0.07, 2, 2)
      }
      const p = at(f)
      this.px.dot(p.x - 1, p.y - 1, FLAME, 1, 3, 3)
      return
    }
    const s = (progress - 0.6) / 0.4
    this.px.glow(x1, y1, 8 + s * 24, FLAME, 0.85 * (1 - s))
    this.px.glow(x1, y1, 4 + s * 10, WHITE, 0.6 * (1 - s * 2))
    for (let k = 0; k < 18; k++) {
      const angle = hash(k, 7, 3) * 6.28
      const v = 8 + hash(k, 11, 3) * 18
      const x = x1 + Math.cos(angle) * v * s
      const y = y1 + Math.sin(angle) * v * s * 0.6 - (1 - s) * s * 20 + s * s * 10
      this.px.dot(x, y, k % 3 === 0 ? FLAME : mix(EMBER, BLACK, 0.3), 1 - s, 2, 2)
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
