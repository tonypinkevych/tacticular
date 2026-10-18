import { WEAPONS } from "../../combat/weapons"
import { t } from "../../i18n/strings"
import { key, type Point, same } from "../../map/point"
import type { Entry, Game } from "../../mission/game"
import type { Frame } from "../../mission/match"
import type { Unit } from "../../units/unit"
import { type Cue, cues, fire } from "./cues"

export const SPEEDS = [1, 2, 4, 0] as const

export type Speed = (typeof SPEEDS)[number]

/** A short text that rises over a tile: damage, a miss, a heal, an alarm. */
export interface Float {
  text: string
  color: string
  at: Point
  born: number
  /** The unit at this tile took damage and flashes. */
  hit?: boolean
  /** A unit that died here and fades out. */
  unit?: Unit
}

/** How an attack travels: a bolt for guns and spells, a strike for melee, an arc for thrown and fired charges. */
export type Style = "bolt" | "melee" | "arc"

const ARCS = ["rocket", "smoke", "mine", "blast"]

/** What the board shows at one moment of playback. */
export interface Still {
  game: Game
  mover: { id: string; at: Point } | null
  shot: { from: Point; to: Point; progress: number; style: Style } | null
  /** Where a visible enemy acts, for the camera to follow. */
  focus: Point | null
}

interface Clip {
  before: Game
  frame: Frame
  start: number
  length: number
  path: Point[]
  stops: Stop[]
  visible: boolean
}

/** An overwatch shot during a walk: the step it hits, the watcher's tile, and the log entries it adds. */
interface Stop {
  step: number
  from: Point
  to: Point
  style: Style
  entries: Entry[]
  fired: boolean
  landed: boolean
}

const TILE_MS = 110
const SHOT_MS = 420
const ARC_MS = 700
const STEP_MS = 260
const FLOAT_MS = 1100
const ACTIVITY_MS = 1500

function walkPath(before: Game, frame: Frame): Point[] {
  const a = frame.action
  if (a.type !== "move" && !(a.type === "ability" && a.ability === "charge")) return []
  const u = before.units.find((x) => x.id === a.unit)
  const after = frame.game.units.find((x) => x.id === a.unit)
  if (!u || !after || same(u.pos, after.pos)) return []
  const r = before.reach(u, 400)
  const goal = a.type === "move" && r.cost.has(key(a.to)) ? a.to : after.pos
  const path = r.path(goal)
  const stop = path.findIndex((p) => same(p, after.pos))
  return stop >= 0 ? path.slice(0, stop + 1) : [...path, after.pos]
}

/** The overwatch shots of a walk, in order, each with the log entries up to the next one. */
function stops(before: Game, frame: Frame, path: Point[]): Stop[] {
  const added = frame.game.log.slice(before.log.length)
  const marks = added.flatMap((e, i) => (e.key === "log.overwatch" ? [i] : []))
  return marks.flatMap((m, k) => {
    const e = added[m]
    const step = path.findIndex((p) => p.x === e.params.x && p.y === e.params.y)
    const watcher = before.units.find((u) => u.id === e.params.unit)
    if (step < 0 || !watcher) return []
    const entries = added.slice(m + 1, marks[k + 1] ?? added.length)
    const style: Style = watcher.arms().melee ? "melee" : "bolt"
    return [{ step, from: watcher.pos, to: path[step], style, entries, fired: false, landed: false }]
  })
}

const step = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)

/** Length of a walk in tiles, with diagonal steps as long as they look. */
function span(before: Game, frame: Frame, path: Point[]): number {
  const id = actor(frame)
  const start = before.units.find((x) => x.id === id)?.pos
  if (!start) return 0
  return path.reduce((sum, p, i) => sum + step(i === 0 ? start : path[i - 1], p), 0)
}

/** The point at a share of a walk's length, so the speed stays even on diagonals. */
function along(points: Point[], share: number): Point {
  const total = points.slice(1).reduce((sum, p, i) => sum + step(points[i], p), 0)
  let left = share * total
  for (let i = 1; i < points.length; i++) {
    const d = step(points[i - 1], points[i])
    if (left <= d) {
      const f = d === 0 ? 1 : left / d
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * f,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * f,
      }
    }
    left -= d
  }
  return points[points.length - 1]
}

function style(before: Game, frame: Frame): Style {
  const a = frame.action
  if (a.type === "attack") return WEAPONS[before.unit(a.unit).weapon].melee ? "melee" : "bolt"
  return a.type === "ability" && ARCS.includes(a.ability) ? "arc" : "bolt"
}

function flight(before: Game, frame: Frame): number {
  return style(before, frame) === "arc" ? ARC_MS : SHOT_MS
}

function target(before: Game, frame: Frame): Point | null {
  const a = frame.action
  if (a.type === "attack" || (a.type === "ability" && a.target && a.ability !== "charge")) {
    const t = before.units.find((x) => x.id === (a as { target: string }).target)
    return t ? t.pos : null
  }
  if (a.type === "ability" && a.at) return a.at
  return null
}

/** The sounds the player hears of a step: all of a step in sight, else only the alarms and the heard steps. */
function heard(sounds: Cue[], visible: boolean): Cue[] {
  return visible ? sounds : sounds.filter((c) => c === "heard" || c === "spotted")
}

function actor(frame: Frame): string | null {
  return frame.action.type === "endTurn" ? null : frame.action.unit
}

/** True when the player would see this step: one of its units or tiles is in sight. */
function shown(before: Game, frame: Frame): boolean {
  const id = actor(frame)
  if (!id) return false
  const u = before.units.find((x) => x.id === id)
  const after = frame.game.units.find((x) => x.id === id)
  if (!u || !after) return false
  if (u.side === "squad") return true
  return before.stealth.visible(u) || frame.game.stealth.visible(after)
}

/** The name of the skill or stance a visible alien takes in a step, for a text over it; null for other steps. */
function deed(before: Game, frame: Frame): string | null {
  const a = frame.action
  const u = a.type === "endTurn" ? undefined : before.units.find((x) => x.id === a.unit)
  if (u?.allegiance() !== "enemy") return null
  if (a.type === "ability") return t(`ability.${a.ability}`)
  if (a.type === "overwatch" || a.type === "hunker" || a.type === "reload") return t(`action.${a.type}`)
  return null
}

/** Log entries that hurt a target by a set amount. */
const HURTS = ["log.hit", "log.lash", "log.burn", "log.shrapnel", "log.slam", "log.fall", "log.fire", "log.mine"]

/** Floating texts for the log entries a step added, or for some of them. */
export function floats(
  before: Game,
  after: Game,
  now: number,
  entries: Entry[] = after.log.slice(before.log.length),
): Float[] {
  const out: Float[] = []
  const pos = (id: unknown): Point | null => after.units.find((u) => u.id === id)?.pos ?? null
  const add = (e: Entry, text: string, color: string, who = e.params.target, hit = false) => {
    const at = pos(who)
    if (at) out.push({ text, color, at, born: now, hit })
  }
  for (const e of entries) {
    const p = e.params
    const spell = e.key === "log.fear" || e.key === "log.dread" || e.key === "log.dominate"
    if (HURTS.includes(e.key)) add(e, `−${p.dmg}`, "#ff6a5a", p.target, true)
    if (e.key === "log.crit") add(e, `${t("ui.crit")} −${p.dmg}`, "#ffb02e", p.target, true)
    if (e.key === "log.miss") add(e, t("ui.miss"), "#d9dde3")
    if (e.key === "log.heal") add(e, `+${p.amount}`, "#5fd35f")
    if (e.key === "log.burning") add(e, `−${p.dmg}`, "#ff8a3c", p.unit, true)
    if (e.key === "log.detected") add(e, "!", "#ffd84a", p.unit)
    if (spell) add(e, t(p.saved ? "ui.saved" : "ui.failed"), p.saved ? "#d9dde3" : "#c38bff")
    const dead = e.key === "log.dies" ? after.units.find((u) => u.id === p.unit) : undefined
    if (dead) out.push({ text: "", color: "", at: dead.pos, born: now, unit: dead })
  }
  return out
}

/** Plays frames one after another: walks, shots and rising numbers, at a chosen speed. An alien turn lasts 1.5 s at least. */
export class Playback {
  private queue: { before: Game; frame: Frame }[] = []
  private clip: Clip | null = null
  private activity: number | null = null
  texts: Float[] = []
  /** Sounds due now, for the board to play and clear. */
  sounds: Cue[] = []

  constructor(
    public speed: Speed,
    private shownGame: Game,
  ) {}

  get busy(): boolean {
    return this.clip !== null || this.queue.length > 0
  }

  get live(): boolean {
    return this.busy || this.texts.length > 0
  }

  /** Queues the steps of one action, starting from the game the board shows now. */
  add(start: Game, steps: Frame[]): void {
    let before = start
    for (const frame of steps) {
      this.queue.push({ before, frame })
      before = frame.game
    }
  }

  /** Jumps to the end of the queue. */
  skip(now: number): Game {
    while (this.busy) this.next(now, true)
    return this.shownGame
  }

  reset(game: Game): void {
    this.queue = []
    this.clip = null
    this.activity = null
    this.texts = []
    this.sounds = []
    this.shownGame = game
  }

  private next(now: number, instant = false): void {
    if (this.clip) {
      const { before, frame } = this.clip
      const landed = new Set(this.clip.stops.filter((s) => s.landed).flatMap((s) => s.entries))
      const rest = frame.game.log.slice(before.log.length).filter((e) => !landed.has(e))
      this.texts.push(...floats(before, frame.game, now, rest))
      if (!instant) this.sounds.push(...heard(cues(this.clip.before, this.clip.frame).end, this.clip.visible))
      this.shownGame = this.clip.frame.game
      this.clip = null
    }
    const item = this.queue.shift()
    if (!item) return
    const { before, frame } = item
    const path = walkPath(before, frame)
    const halts = stops(before, frame, path)
    const visible = shown(before, frame)
    const shotAt = target(before, frame)
    const scale = this.speed === 0 || instant || !visible ? 0 : 1 / this.speed
    const pause = halts.length * SHOT_MS
    let length = scale * (span(before, frame, path) * TILE_MS + pause + (shotAt ? flight(before, frame) : 0) + STEP_MS)
    this.activity = before.phase === "enemy" ? (this.activity ?? now) : null
    if (this.activity !== null && frame.game.phase !== "enemy" && !instant && this.speed > 0)
      length = Math.max(length, ACTIVITY_MS / this.speed - (now - this.activity))
    this.clip = { before, frame, start: now, length, path, stops: halts, visible }
    const name = visible && !instant ? deed(before, frame) : null
    const u = name ? before.units.find((x) => x.id === actor(frame)) : undefined
    if (name && u) this.texts.push({ text: name, color: "#ff8a7a", at: u.pos, born: now })
    if (!instant) this.sounds.push(...heard(cues(before, frame).start, visible))
  }

  /** The picture at a moment; advances through finished steps. */
  at(now: number): Still {
    this.texts = this.texts.filter((f) => now - f.born < FLOAT_MS / Math.max(1, this.speed))
    while (this.busy && (!this.clip || now - this.clip.start >= this.clip.length)) {
      this.next(now)
      if (this.clip && this.clip.length > 0) break
    }
    const c = this.clip
    if (!c) return { game: this.shownGame, mover: null, shot: null, focus: null }
    const id = actor(c.frame)
    const t = c.length > 0 ? (now - c.start) / c.length : 1
    const walk = span(c.before, c.frame, c.path) * TILE_MS
    const pause = c.stops.length * SHOT_MS
    const total = walk + pause + (target(c.before, c.frame) ? flight(c.before, c.frame) : 0) + STEP_MS
    const walkEnd = (walk + pause) / total
    const elapsed = t * total
    let walked = elapsed
    let shot: Still["shot"] = null
    for (const [k, s] of c.stops.entries()) {
      const arrive = span(c.before, c.frame, c.path.slice(0, s.step + 1)) * TILE_MS + k * SHOT_MS
      walked = elapsed - k * SHOT_MS
      if (elapsed < arrive) break
      this.fire(c, s, now)
      if (elapsed < arrive + SHOT_MS) {
        walked = arrive - k * SHOT_MS
        shot = { from: s.from, to: s.to, progress: (elapsed - arrive) / SHOT_MS, style: s.style }
        break
      }
      this.land(c, s, now)
      walked = elapsed - (k + 1) * SHOT_MS
    }
    let mover: Still["mover"] = null
    if (id && c.path.length > 0) {
      const u = c.before.units.find((x) => x.id === id)!
      mover = { id, at: along([u.pos, ...c.path], walk > 0 ? Math.min(1, walked / walk) : 1) }
    }
    const to = target(c.before, c.frame)
    if (id && to && t >= walkEnd) {
      const from = mover?.at ?? c.before.units.find((x) => x.id === id)!.pos
      const progress = Math.min(1, (t - walkEnd) / (flight(c.before, c.frame) / total))
      shot = { from, to, progress, style: style(c.before, c.frame) }
    }
    const u = id ? c.before.units.find((x) => x.id === id) : undefined
    const focus = u && c.visible && u.allegiance() === "enemy" ? (mover?.at ?? u.pos) : null
    return { game: c.before, mover, shot, focus }
  }

  /** Shows an overwatch shot as it is fired: its sound and a text over the watcher. */
  private fire(c: Clip, s: Stop, now: number): void {
    if (s.fired) return
    s.fired = true
    const watcher = c.before.units.find((u) => same(u.pos, s.from))
    if (c.visible && watcher) this.sounds.push(fire(c.before, watcher.id))
    this.texts.push({ text: t("action.overwatch"), color: "#ffb02e", at: s.from, born: now })
  }

  /** Shows what an overwatch shot did, at the tile where it hit the walker. */
  private land(c: Clip, s: Stop, now: number): void {
    if (s.landed) return
    s.landed = true
    const end = c.path[c.path.length - 1]
    for (const f of floats(c.before, c.frame.game, now, s.entries))
      this.texts.push(same(f.at, end) ? { ...f, at: s.to } : f)
  }
}
