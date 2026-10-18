import { DETECTION } from "../rules/data"
import { distance, key, ORTHOGONAL, type Point, plus, pointOf } from "../rules/point"
import type { Unit } from "../rules/unit"
import { ALIEN, AMBER, BEACON, DOMINATED, EVAC, type Rgb, rgb, SQUAD } from "./color"
import { height, tone } from "./picture"
import type { Pixels } from "./pixels"
import type { Scene } from "./scene"

const BORDER = rgb("#94806e")

/** The information marks of a frame: ranges, paths, zones and rings under the units; cover, aim and moods over them. */
export class Marks {
  private readonly dots = new Map<number, Rgb>()
  private readonly danger = new Set<number>()

  constructor(
    private readonly px: Pixels,
    private readonly scene: Scene,
    private readonly t: number,
  ) {
    const { hover, near, far, range, game } = scene
    if (this.planning()) {
      for (const e of this.aliens())
        if (e.stance === "overwatch") for (const k of game.sight.tiles(e)) if (far.has(k)) this.danger.add(k)
      for (const k of far)
        if (this.explored(pointOf(k))) this.dots.set(k, this.danger.has(k) ? ALIEN : near.has(k) ? SQUAD : AMBER)
      for (const p of scene.path) this.dots.delete(key(p))
      if (hover) this.dots.delete(key(hover))
    }
    for (const k of range) if (this.explored(pointOf(k))) this.dots.set(k, AMBER)
  }

  /** True when a tile carries a dot, so the ground dot under it is left out. */
  covers(p: Point): boolean {
    return this.dots.has(key(p))
  }

  under(): void {
    this.borders()
    this.goal()
    if (this.scene.zones) this.zones()
    for (const [k, c] of this.dots) {
      const g = this.px.projection.ground(pointOf(k))
      this.px.dot(g.x - 1, g.y, c, 0.55, 2)
    }
    this.plan()
    this.rings()
  }

  over(): void {
    const { selected, hover, game, aim } = this.scene
    this.intents()
    if (selected && !this.scene.mover) {
      this.shields(selected.pos, height(game.tile(selected.pos)))
      if (!this.planning()) this.flanks(selected.pos, selected)
    }
    if (this.planning() && hover && selected) {
      this.shields(hover, height(game.tile(hover)))
      this.flanks(hover, selected)
      const radius = (e: Unit) => game.stealth.detection(e, selected.at(hover))
      if (selected.concealed && this.aliens().some((e) => radius(e) >= 0 && game.sight.sees(e, hover, radius(e)))) {
        const a = this.px.projection.anchor(hover)
        this.px.label("@", a.x - 2, a.y - 16, ALIEN, 0.6 + 0.4 * Math.abs(Math.sin(this.t / 250)))
      }
    }
    if (aim) this.aim()
    this.moods()
    this.noises()
    if (selected && !this.scene.mover) this.bar(selected)
    const hovered = hover && game.unitAt(hover)
    if (hovered && hovered !== selected && hovered.id !== aim?.target.id && this.shown(hovered)) this.bar(hovered)
  }

  private planning(): boolean {
    const { hover, near, far, selected } = this.scene
    return !!hover && !!selected && (near.has(key(hover)) || far.has(key(hover)))
  }

  private aliens(): Unit[] {
    const { game } = this.scene
    return game.units.filter((u) => u.alive() && u.allegiance() === "enemy" && this.shown(u))
  }

  private shown(u: Unit): boolean {
    return u.side === "squad" || this.scene.game.stealth.visible(u)
  }

  private explored(p: Point): boolean {
    const { board, explored } = this.scene.game
    return board.inside(p) && explored[p.y * board.width + p.x]
  }

  /** Dim dotted lines around rooftops and houses. */
  private borders(): void {
    const { game, houses } = this.scene
    const built = new Set<number>()
    for (let y = 0; y < game.board.height; y++)
      for (let x = 0; x < game.board.width; x++) {
        const p = { x, y }
        const tile = game.tile(p)
        if (!this.explored(p)) continue
        if (tile === "roof" || tile === "wall" || tile === "door" || tile === "open" || houses.room(p) !== undefined)
          built.add(key(p))
      }
    this.px.outline(built, BORDER, 0.35, true)
  }

  /** The evac zone, the beacon to hold and the next alien landing. */
  private goal(): void {
    const { game } = this.scene
    const g = game.goal
    const pulse = 0.55 + 0.3 * Math.sin(this.t / 400)
    if (g.kind === "evac") this.px.outline(new Set(g.tiles.map(key)), EVAC, pulse, true)
    if (g.kind === "defend") {
      this.px.ring(g.at, BEACON, pulse)
      const a = this.px.projection.ground(g.at)
      this.px.dot(a.x - 1, a.y - 1, BEACON, 0.9, 3, 3)
    }
    const d = game.drop
    if (d && d.round - game.round <= 1) {
      const area = new Set<number>()
      for (const o of [{ x: 0, y: 0 }, ...ORTHOGONAL]) area.add(key(plus(d.at, o)))
      this.px.outline(area, ALIEN, pulse, true)
    }
  }

  /** Dots on every tile a visible alien would spot a soldier on, or fire on from overwatch. */
  private zones(): void {
    const { game } = this.scene
    for (const e of this.aliens()) {
      const radius =
        e.stance === "overwatch" ? e.vision : e.alert === "unaware" ? DETECTION.unaware : DETECTION.investigating
      for (const k of game.sight.tiles(e)) {
        const p = pointOf(k)
        if (distance(e.pos, p) > radius || this.dots.has(k) || !this.explored(p)) continue
        const g = this.px.projection.ground(p)
        this.px.dot(g.x, g.y + 1, ALIEN, 0.45)
      }
    }
  }

  /** The path to the cursor and the cursor's tile, while a move is planned; the area of an armed action. */
  private plan(): void {
    const { path, hover, near, area } = this.scene
    if (this.planning()) {
      for (const p of path.slice(0, -1)) {
        const g = this.px.projection.ground(p)
        const c = this.danger.has(key(p)) ? ALIEN : SQUAD
        this.px.dot(g.x - 2, g.y, c, 0.95, 4)
        this.px.dot(g.x - 1, g.y + 1, c, 0.5, 2)
      }
      if (hover)
        this.px.outline(new Set([key(hover)]), near.has(key(hover)) ? SQUAD : AMBER, 0.6 + 0.3 * Math.sin(this.t / 250))
    }
    if (area.length > 0) {
      const keys = new Set<number>()
      for (const p of area)
        for (const o of [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: -1, y: 1 },
          ...ORTHOGONAL,
        ])
          keys.add(key(plus(p, o)))
      this.px.outline(keys, AMBER, 0.6 + 0.3 * Math.sin(this.t / 250))
    }
  }

  /** Thin rings under units: cream for the squad, red for aliens, dotted for concealed soldiers. */
  private rings(): void {
    const { game, selected, targets, aim, mover } = this.scene
    const pulse = 0.6 + 0.35 * Math.sin(this.t / 300)
    for (const u of game.units) {
      if (!u.alive() || !this.shown(u) || mover?.id === u.id) continue
      const lift = height(game.tile(u.pos))
      let a = u.side === "squad" ? 0.45 : 0.8
      if (u === selected || u.id === selected?.id) a = pulse
      if (targets.has(u.id) || u.id === aim?.target.id) a = 0.5 + 0.45 * Math.abs(Math.sin(this.t / 250))
      this.px.ring(u.pos, tone(u), a, u.side === "squad" && u.concealed, lift)
    }
  }

  /** Cover shields on the tile edges that touch cover. */
  private shields(p: Point, lift: number): void {
    const { game } = this.scene
    const g = this.px.projection.ground(p)
    const spots = [
      [g.x + 7, g.y + 3],
      [g.x - 7, g.y - 3],
      [g.x - 7, g.y + 3],
      [g.x + 7, g.y - 3],
    ]
    ORTHOGONAL.forEach((d, i) => {
      const c = game.cover.shelter(p, plus(p, d))
      if (c > 0) this.px.shield(spots[i][0], spots[i][1] - 10 - lift, c >= 5 ? 2 : 1, SQUAD, 0.9)
    })
  }

  /** Lines from a tile to each alien: red when it flanks a soldier there, cream when the soldier flanks it. */
  private flanks(p: Point, soldier: Unit): void {
    const { game } = this.scene
    const from = this.px.projection.ground(p)
    const lift = height(game.tile(p))
    for (const e of this.aliens()) {
      const exposed = game.sight.sees(e, p) && game.cover.against(p, e.pos) === 0
      const open = game.sight.sees(soldier.at(p), e.pos) && game.cover.against(e.pos, p) === 0
      if (!exposed && !open) continue
      const to = this.px.projection.ground(e.pos)
      this.px.trace(from.x, from.y - 4 - lift, to.x, to.y - 4 - height(game.tile(e.pos)), exposed ? ALIEN : SQUAD, 0.6)
    }
  }

  /** The aim line, the hit chance, the target's cover and its health. */
  private aim(): void {
    const aim = this.scene.aim!
    const { game, shot } = this.scene
    const A = this.px.projection.anchor(aim.from)
    const B = this.px.projection.anchor(aim.target.pos)
    const la = height(game.tile(aim.from))
    const lb = height(game.tile(aim.target.pos))
    const color = aim.cover ? SQUAD : AMBER
    if (!shot) this.px.trace(A.x, A.y - 7 - la, B.x, B.y - 7 - lb, color, 0.6)
    const text = `${aim.chance}%`
    this.px.label(text, B.x + 9, B.y - 9 - lb, color, 0.95)
    if (aim.cover) this.px.shield(B.x + 10 + text.length * 4, B.y - 9 - lb, aim.cover >= 5 ? 2 : 1, ALIEN)
    this.bar(aim.target)
  }

  /** Marks over aliens: ! engaged, ? searching, the eye on overwatch; the eye on a soldier on overwatch too. */
  private moods(): void {
    const { game, aim, selected } = this.scene
    for (const u of game.units) {
      if (!u.alive() || !this.shown(u)) continue
      const mood =
        u.stance === "overwatch"
          ? "@"
          : u.side === "enemy" && u.alert === "engaged"
            ? "!"
            : u.side === "enemy" && u.alert === "investigating"
              ? "?"
              : ""
      if (!mood) continue
      const a = this.px.projection.anchor(u.pos)
      const raised = u.id === aim?.target.id || u.id === selected?.id ? 29 : 22
      const color = u.side === "squad" ? SQUAD : AMBER
      const x = a.x - (mood === "@" ? 2 : 1)
      this.px.label(
        mood,
        x,
        a.y - raised - height(game.tile(u.pos)),
        color,
        0.6 + 0.4 * Math.abs(Math.sin(this.t / 400)),
      )
    }
  }

  /** Noises the squad heard but did not see: a dotted ring with a question mark. */
  private noises(): void {
    const { game, seen } = this.scene
    for (const n of game.noises) {
      if (n.round < game.round - 1 || seen.has(key(n.at))) continue
      this.px.ring(n.at, ALIEN, 0.6, true)
      const a = this.px.projection.anchor(n.at)
      this.px.label("?", a.x - 1, a.y - 12, ALIEN, 0.6)
    }
  }

  /** Telegraphs: the Psion's mark and the Brute's charge as dotted lines, the bomb's blast area. */
  private intents(): void {
    const { game } = this.scene
    for (const e of this.aliens()) {
      const intent = e.intent
      if (!intent) continue
      if (intent.type === "bomb") {
        const keys = new Set<number>()
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) keys.add(key(plus(intent.at, { x: dx, y: dy })))
        this.px.outline(keys, ALIEN, 0.5 + 0.4 * Math.abs(Math.sin(this.t / 200)), true)
        continue
      }
      const t = game.units.find((x) => x.id === intent.target)
      if (!t?.alive()) continue
      const a = this.px.projection.ground(e.pos)
      const b = this.px.projection.ground(t.pos)
      const color = intent.type === "psi" ? DOMINATED : ALIEN
      this.px.trace(a.x, a.y - 6 - height(game.tile(e.pos)), b.x, b.y - 6 - height(game.tile(t.pos)), color, 0.7, 6)
    }
  }

  private bar(u: Unit): void {
    const { game } = this.scene
    const a = this.px.projection.anchor(u.pos)
    const ap = u.side === "squad" && u.allegiance() === "squad" ? u.ap : 0
    this.px.bar(a.x, a.y - 21 - height(game.tile(u.pos)), u.hp, u.maxHp, ap, tone(u), AMBER)
  }
}
