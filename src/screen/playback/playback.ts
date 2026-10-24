import { t } from "../../i18n/strings"
import { cover } from "../../map/cover"
import { distance, type Point, same } from "../../map/point"
import type { Game } from "../../mission/game"
import type { Action } from "../../mission/orders"
import type { Kind } from "../../units/profiles"
import type { Side, Unit } from "../../units/unit"
import { FRAMES, type State } from "../board/pose"
import type { Cue } from "./sound"

/** A unit as the board shows it now: where it stands between tiles, its sprite state and its facing. */
export interface Shown {
  id: string
  kind: Kind
  side: Side
  x: number
  y: number
  state: State
  since: number
  face: 1 | -1
  walk?: { from: Point; path: Point[]; start: number }
}

export interface Float {
  at: Point
  text: string
  tone: "hit" | "crit" | "miss" | "note"
  since: number
}

export interface Burst {
  at: Point
  since: number
}

interface Beat {
  length: number
  start: (now: number) => void
}

/** Seconds a walk takes for each tile. */
const STEP = 0.16
const FLOAT = 1.1

/** What the board plays after each action: walks, shots, hits, deaths, blasts and texts, one beat after another. */
export class Playback {
  readonly units = new Map<string, Shown>()
  floats: Float[] = []
  bursts: Burst[] = []
  private beats: Beat[] = []
  private until = 0

  constructor(private readonly cue: (cue: Cue) => void = () => {}) {}

  /** Shows a game at rest: every unit on its tile in its resting pose. */
  sync(game: Game, now: number): void {
    for (const id of [...this.units.keys()])
      if (!game.units.some((u) => u.id === id && u.alive())) this.units.delete(id)
    for (const u of game.units.filter((x) => x.alive())) {
      const known = this.units.get(u.id)
      const state = rest(game, u)
      const face = facing(game, u, known?.face)
      if (known && known.x === u.at.x && known.y === u.at.y && known.state === state && known.face === face) continue
      this.units.set(u.id, {
        id: u.id,
        kind: u.kind,
        side: u.side,
        x: u.at.x,
        y: u.at.y,
        state,
        since: known?.state === state ? known.since : now,
        face,
      })
    }
  }

  busy(now: number): boolean {
    return this.beats.length > 0 || now < this.until
  }

  /** Queues the beats of one action, from the game before it to the game after it. */
  play(before: Game, action: Action, after: Game): void {
    const entries = after.log.slice(before.log.length)
    if (action.type === "move" || (action.type === "skill" && action.to)) {
      const u = before.unit(action.unit),
        to = action.type === "move" ? action.to : (action.to as Point)
      const one = before.reach(u, 1)
      const path = (one.has(to) ? one : before.reach(u, 2)).path(to)
      this.walk(u.id, path, action.type === "skill" ? "skill" : "walk")
    }
    for (const e of entries) this.entry(e.key, e.params, before, after)
    this.beats.push({ length: 0.05, start: (now) => this.sync(after, now) })
  }

  /** Advances the beats; returns whether anything still plays. */
  tick(now: number): boolean {
    for (const s of this.units.values()) {
      const w = s.walk
      if (!w) continue
      const t = (now - w.start) / STEP
      if (t >= w.path.length) {
        const end = w.path[w.path.length - 1]
        s.x = end.x
        s.y = end.y
        s.walk = undefined
        continue
      }
      const i = Math.floor(t),
        a = i === 0 ? w.from : w.path[i - 1],
        b = w.path[i]
      s.x = a.x + (b.x - a.x) * (t - i)
      s.y = a.y + (b.y - a.y) * (t - i)
    }
    this.floats = this.floats.filter((f) => now - f.since < FLOAT)
    this.bursts = this.bursts.filter((b) => now - b.since < 0.6)
    while (now >= this.until && this.beats.length) {
      const beat = this.beats.shift() as Beat
      beat.start(now)
      this.until = now + beat.length
    }
    return this.busy(now)
  }

  /** The sprite frame a shown unit is on. */
  frame(s: Shown, now: number): number {
    const i = Math.floor((now - s.since) * 8)
    return s.state === "death" ? Math.min(i, FRAMES.death - 1) : i % FRAMES[s.state]
  }

  private walk(id: string, path: Point[], state: State): void {
    if (!path.length) return
    this.beats.push({
      length: path.length * STEP,
      start: (now) => {
        const s = this.units.get(id)
        if (!s) return
        const end = path[path.length - 1]
        s.face = screen(end) >= screen(s) ? 1 : -1
        s.state = state
        s.since = now
        s.walk = { from: { x: s.x, y: s.y }, path, start: now }
        this.cue("step")
      },
    })
  }

  private pose(id: string, state: State, length: number, face?: Point): void {
    this.beats.push({
      length,
      start: (now) => {
        const s = this.units.get(id)
        if (!s) return
        if (face) s.face = screen(face) >= screen(s) ? 1 : -1
        s.state = state
        s.since = now
      },
    })
  }

  private note(at: () => Point | undefined, text: string, tone: Float["tone"], length = 0.05, cue?: Cue): void {
    this.beats.push({
      length,
      start: (now) => {
        if (cue) this.cue(cue)
        const p = at()
        if (p) this.floats.push({ at: p, text, tone, since: now })
      },
    })
  }

  private entry(key: string, params: Record<string, string | number | boolean>, before: Game, after: Game): void {
    const id = String(params.unit ?? ""),
      target = String(params.target ?? "")
    const where = (u: string) => () => {
      const s = this.units.get(u)
      return s ? { x: Math.round(s.x), y: Math.round(s.y) } : undefined
    }
    const alien = (u: string) => after.units.find((x) => x.id === u)?.side === "enemy"
    switch (key) {
      case "log.hit":
      case "log.block": {
        const victim = after.units.find((x) => x.id === target)
        const shooter = after.units.find((x) => x.id === id)
        this.beats.push({ length: 0, start: () => this.cue(WEAPON[shooter?.kind ?? "grunt"]) })
        this.pose(
          id,
          alien(id) ? "attack" : this.units.get(id)?.state === "low" ? "lowShoot" : "shoot",
          0.4,
          victim?.at,
        )
        const tone = key === "log.block" ? "miss" : "hit"
        this.note(where(target), tone === "miss" ? t("ui.float.block") : `−${params.dmg}`, tone, 0.05, tone)
        if (tone === "hit") this.pose(target, "hit", 0.3)
        break
      }
      case "log.dies":
        this.beats.push({ length: 0, start: () => this.cue("death") })
        this.pose(id, "death", 0.6)
        break
      case "log.overwatch":
      case "log.pinned":
        this.note(where(id), t("ui.overwatch").toUpperCase(), "note")
        break
      case "log.suppressed":
      case "log.staggered":
      case "log.exposed":
      case "log.marked":
        this.note(where(id), t(`tactic.${key.slice(4)}`).toUpperCase(), "note", 0.05, "skill")
        this.pose(id, key === "log.suppressed" ? "shoot" : "skill", 0.4, after.units.find((x) => x.id === target)?.at)
        break
      case "log.aim":
        this.pose(id, "attack", 0.3, after.units.find((x) => x.id === target)?.at)
        break
      case "log.dodge":
        this.note(where(target), t("ui.float.dodge"), "miss", 0.3)
        break
      case "log.combo":
        this.note(where(target), t("ui.combo").toUpperCase(), "crit", 0.3, "crit")
        break
      case "log.fire":
        this.note(where(target), "−1", "hit")
        break
      case "log.burst":
        this.note(where(target), `−${params.dmg}`, "hit")
        this.pose(target, "hit", 0.3)
        break
      case "log.headshot":
      case "log.grenade":
      case "log.covering":
      case "log.heal":
      case "log.warcry":
      case "log.mark":
      case "log.run":
        this.note(where(id), t(NAMES[key]).toUpperCase(), "note", 0.05, "skill")
        if (key !== "log.run") this.pose(id, "skill", 0.5)
        if (key === "log.grenade") this.blasts(before, after)
        break
      case "log.blast": {
        const mark = before.marks.find((m) => m.unit === id)
        this.pose(id, "skill", 0.3)
        this.beats.push({
          length: 0.4,
          start: (now) => {
            this.cue("blast")
            for (const at of mark?.tiles ?? []) this.bursts.push({ at, since: now })
          },
        })
        break
      }
      case "log.barrel":
        this.blasts(before, after)
        break
      case "log.rush": {
        const from = before.units.find((u) => u.id === id),
          to = after.units.find((u) => u.id === id)
        if (from && to && !same(from.at, to.at)) this.walk(id, line(from.at, to.at), "skill")
        break
      }
      case "log.push":
      case "log.drown": {
        const to = after.units.find((u) => u.id === target)
        if (to) this.walk(target, [to.at], "hit")
        break
      }
      case "log.drop":
        this.beats.push({
          length: 0.6,
          start: (now) => {
            this.cue("drop")
            for (const u of after.units.filter((x) => !before.units.some((y) => y.id === x.id))) {
              this.units.set(u.id, {
                id: u.id,
                kind: u.kind,
                side: u.side,
                x: u.at.x,
                y: u.at.y,
                state: "idle",
                since: now,
                face: -1,
              })
              this.bursts.push({ at: u.at, since: now })
            }
          },
        })
        break
      case "log.evac":
        this.beats.push({ length: 0.3, start: () => this.units.delete(id) })
        break
    }
  }

  private blasts(before: Game, after: Game): void {
    const changed = after.board.tiles.flatMap((t, i) =>
      t !== before.board.tiles[i] ? [{ x: i % 8, y: Math.floor(i / 8) }] : [],
    )
    this.beats.push({
      length: 0.4,
      start: (now) => {
        this.cue("blast")
        for (const at of changed) this.bursts.push({ at, since: now })
      },
    })
  }
}

const WEAPON: Record<Kind, Cue> = {
  vanguard: "shotgun",
  ranger: "rifle",
  warden: "minigun",
  cleric: "pistol",
  blade: "melee",
  grunt: "plasma",
  commander: "plasma",
  brute: "melee",
  bomber: "blast",
  guard: "plasma",
  sniper: "rifle",
  pod: "blast",
}

const NAMES: Record<string, string> = {
  "log.headshot": "skill.headshot",
  "log.grenade": "skill.grenade",
  "log.covering": "skill.covering",
  "log.heal": "skill.medkit",
  "log.warcry": "skill.warcry",
  "log.mark": "ui.float.mark",
  "log.run": "skill.runGun",
}

const screen = (p: { x: number; y: number }): number => p.x - p.y

function line(from: Point, to: Point): Point[] {
  const n = distance(from, to),
    dx = Math.sign(to.x - from.x),
    dy = Math.sign(to.y - from.y)
  return Array.from({ length: n }, (_, i) => ({ x: from.x + dx * (i + 1), y: from.y + dy * (i + 1) }))
}

/** A unit's resting pose: crouched behind low cover or pressed to high cover toward the nearest foe. */
function rest(game: Game, u: Unit): State {
  const foe = nearest(game, u)
  if (!foe) return "idle"
  const c = cover(game.board, u.at, foe.at)
  if (c >= 2) return u.side === "squad" ? "high" : "idle"
  if (c >= 1) return u.side === "squad" ? "low" : "idle"
  return "idle"
}

function facing(game: Game, u: Unit, was?: 1 | -1): 1 | -1 {
  const foe = nearest(game, u)
  if (!foe || screen(foe.at) === screen(u.at)) return was ?? (u.side === "squad" ? 1 : -1)
  return screen(foe.at) > screen(u.at) ? 1 : -1
}

function nearest(game: Game, u: Unit): Unit | undefined {
  return game.foes(u).sort((a, b) => distance(a.at, u.at) - distance(b.at, u.at))[0]
}
