import { t } from "../../i18n/strings"
import { key, type Point, same } from "../../map/point"
import type { Entry, Game } from "../../mission/game"
import type { Frame } from "../../mission/match"
import type { Unit } from "../../units/unit"
import { type Cue, cues } from "./cues"

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

/** What the board shows at one moment of playback. */
export interface Still {
  game: Game
  mover: { id: string; at: Point } | null
  shot: { from: Point; to: Point; progress: number } | null
  /** Where a visible enemy acts, for the camera to follow. */
  focus: Point | null
}

interface Clip {
  before: Game
  frame: Frame
  start: number
  length: number
  path: Point[]
  visible: boolean
}

const TILE_MS = 110
const SHOT_MS = 420
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

/** Log entries that hurt a target by a set amount. */
const HURTS = ["log.hit", "log.lash", "log.burn", "log.shrapnel", "log.slam", "log.fall", "log.fire", "log.mine"]

/** Floating texts for the log entries a step added. */
export function floats(before: Game, after: Game, now: number): Float[] {
  const out: Float[] = []
  const pos = (id: unknown): Point | null => after.units.find((u) => u.id === id)?.pos ?? null
  const add = (e: Entry, text: string, color: string, who = e.params.target, hit = false) => {
    const at = pos(who)
    if (at) out.push({ text, color, at, born: now, hit })
  }
  for (const e of after.log.slice(before.log.length)) {
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
      this.texts.push(...floats(this.clip.before, this.clip.frame.game, now))
      if (!instant) this.sounds.push(...heard(cues(this.clip.before, this.clip.frame).end, this.clip.visible))
      this.shownGame = this.clip.frame.game
      this.clip = null
    }
    const item = this.queue.shift()
    if (!item) return
    const { before, frame } = item
    const path = walkPath(before, frame)
    const visible = shown(before, frame)
    const shotAt = target(before, frame)
    const scale = this.speed === 0 || instant || !visible ? 0 : 1 / this.speed
    let length = scale * (span(before, frame, path) * TILE_MS + (shotAt ? SHOT_MS : 0) + STEP_MS)
    this.activity = before.phase === "enemy" ? (this.activity ?? now) : null
    if (this.activity !== null && frame.game.phase !== "enemy" && !instant && this.speed > 0)
      length = Math.max(length, ACTIVITY_MS / this.speed - (now - this.activity))
    this.clip = { before, frame, start: now, length, path, visible }
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
    const total = walk + (target(c.before, c.frame) ? SHOT_MS : 0) + STEP_MS
    const walkEnd = walk / total
    let mover: Still["mover"] = null
    if (id && c.path.length > 0) {
      const u = c.before.units.find((x) => x.id === id)!
      mover = { id, at: along([u.pos, ...c.path], Math.min(1, t / walkEnd)) }
    }
    let shot: Still["shot"] = null
    const to = target(c.before, c.frame)
    if (id && to && t >= walkEnd) {
      const from = mover?.at ?? c.before.units.find((x) => x.id === id)!.pos
      shot = { from, to, progress: Math.min(1, (t - walkEnd) / (SHOT_MS / total)) }
    }
    const u = id ? c.before.units.find((x) => x.id === id) : undefined
    const focus = u && c.visible && u.allegiance() === "enemy" ? (mover?.at ?? u.pos) : null
    return { game: c.before, mover, shot, focus }
  }
}
