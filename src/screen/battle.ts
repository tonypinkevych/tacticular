import { type Accessor, createSignal, type Setter } from "solid-js"
import { Mind } from "../aliens/mind"
import type { Odds } from "../combat/combat"
import { cover } from "../map/cover"
import { adjacent, distance, ORTHOGONAL, type Point, plus, same } from "../map/point"
import { clear } from "../map/sight"
import type { Game } from "../mission/game"
import { type Action, Illegal } from "../mission/orders"
import type { Unit } from "../units/unit"
import { Playback } from "./playback/playback"
import { Sound } from "./playback/sound"

/** The tiles the board marks for the selected soldier. */
export interface Zones {
  move: Point[]
  dash: Point[]
  reach: Point[]
  targets: Point[]
  area: Point[]
  /** Where the alien under the cursor can walk with its two moves. */
  foeMove: Point[]
  /** The tiles the alien under the cursor can hit after one move. */
  foeShot: Point[]
}

/** A danger on the way of a planned move: fire that burns, or an alien on overwatch that fires. */
export interface Peril {
  at: Point
  kind: "fire" | "watch"
}

/** Seconds the alien turn banner stays at least. */
const BANNER = 1.5

/**
 * One mission on screen: the game, the soldier the player selected, an armed skill, and the alien turn
 * played by the mind with its playback. The game changes only through actions.
 */
export class Battle {
  readonly game: Accessor<Game>
  readonly selected: Accessor<string | null>
  readonly armed: Accessor<boolean>
  readonly hovered: Accessor<Point | null>
  /** The tile of the action a first click planned; a second click on it carries the action out. */
  readonly planned: Accessor<Point | null>
  readonly banner: Accessor<boolean>
  readonly notice: Accessor<string | null>
  readonly playback: Playback
  readonly sound = new Sound()
  private readonly setGame: Setter<Game>
  private readonly select: Setter<string | null>
  private readonly arm: Setter<boolean>
  private readonly hover: Setter<Point | null>
  private readonly plan: Setter<Point | null>
  private readonly setBanner: Setter<boolean>
  private readonly notify: Setter<string | null>
  private runTo: Point | null = null
  private thinking = false

  constructor(
    start: Game,
    private readonly record: (action: Action, after: Game) => void = () => {},
  ) {
    ;[this.game, this.setGame] = createSignal(start, { equals: false })
    ;[this.selected, this.select] = createSignal<string | null>(null)
    ;[this.armed, this.arm] = createSignal(false)
    ;[this.hovered, this.hover] = createSignal<Point | null>(null)
    ;[this.planned, this.plan] = createSignal<Point | null>(null)
    ;[this.banner, this.setBanner] = createSignal(false)
    ;[this.notice, this.notify] = createSignal<string | null>(null)
    this.playback = new Playback((cue) => this.sound.play(cue))
  }

  /** Shows the game at rest and selects the first soldier. */
  begin(now: number): void {
    this.playback.sync(this.game(), now)
    this.next()
  }

  unit(): Unit | null {
    const id = this.selected()
    const u = id ? this.game().units.find((x) => x.id === id) : undefined
    return u?.alive() ? u : null
  }

  ready(): boolean {
    return this.game().phase === "squad" && !this.thinking && !this.playback.busy(performance.now() / 1000)
  }

  point(p: Point | null): void {
    const was = this.hovered()
    if (was === p || (was && p && same(was, p))) return
    this.hover(p)
  }

  pick(id: string): void {
    if (!this.ready()) return
    const u = this.game().units.find((x) => x.id === id)
    if (u?.side !== "squad" || !u.alive()) return
    this.select(id)
    this.disarm()
  }

  /** The next soldier with AP left, forward or back. */
  cycle(back = false): void {
    const squad = this.game().units.filter((u) => u.side === "squad" && u.alive() && u.ap > 0)
    if (!squad.length) return
    const i = squad.findIndex((u) => u.id === this.selected())
    this.pick(squad[(i + (back ? squad.length - 1 : 1) + squad.length) % squad.length].id)
  }

  toggleSkill(): void {
    const u = this.unit()
    if (!u || !this.ready()) return
    this.runTo = null
    this.arm(!this.armed())
  }

  disarm(): void {
    this.runTo = null
    this.arm(false)
    this.plan(null)
  }

  overwatch(): void {
    const u = this.unit()
    if (u && this.ready()) this.act({ type: "overwatch", unit: u.id })
  }

  /**
   * A click on a tile selects a soldier at once. Else the first click plans a move, a shot or the armed skill
   * there, and a second click on the same tile carries it out.
   */
  click(p: Point): void {
    if (!this.ready()) return
    const g = this.game(),
      u = this.unit(),
      there = g.unitAt(p)
    if (there?.side === "squad" && !this.armed()) {
      this.pick(there.id)
      return
    }
    if (!u) return
    const action = this.armed()
      ? this.aim(u, p, there)
      : there && there.side !== u.side
        ? ({ type: "shoot", unit: u.id, target: there.id } as const)
        : g.board.at(p) === "barrel"
          ? ({ type: "shoot", unit: u.id, at: p } as const)
          : ({ type: "move", unit: u.id, to: p } as const)
    if (!action) return
    const was = this.planned()
    if (was && same(was, p)) {
      this.act(action)
      return
    }
    try {
      g.apply(action)
      this.plan(p)
    } catch (e) {
      if (!(e instanceof Illegal)) throw e
      this.refuse(e.message)
    }
  }

  private aim(u: Unit, p: Point, there: Unit | undefined): Action | null {
    switch (u.profile.skill) {
      case "runGun":
        if (!this.runTo) {
          if (this.game().reach(u, 2).has(p)) {
            this.runTo = p
            this.setGame(this.game())
          }
          return null
        }
        return there && there.side !== u.side ? { type: "skill", unit: u.id, to: this.runTo, target: there.id } : null
      case "grenade":
        return { type: "skill", unit: u.id, at: p }
      default:
        return there ? { type: "skill", unit: u.id, target: there.id } : null
    }
  }

  /** The way to the planned tile, or to the tile under the cursor, and the perils on it. */
  route(): { path: Point[]; perils: Peril[] } | null {
    const g = this.game(),
      u = this.unit(),
      to = this.planned() ?? this.hovered()
    if (!u || !to || this.armed() || g.unitAt(to) || g.phase !== "squad") return null
    const one = g.reach(u, 1),
      reach = one.has(to) ? one : u.ap > 1 ? g.reach(u, 2) : one
    if (!reach.has(to)) return null
    const path = reach.path(to),
      ghost = u.clone(),
      watchers = g.foes(u).filter((f) => f.overwatch)
    const perils: Peril[] = []
    for (const at of path) {
      ghost.at = at
      if (g.board.at(at) === "fire") perils.push({ at, kind: "fire" })
      const w = watchers.findIndex((f) => g.combat.canShoot(f, ghost))
      if (w >= 0) {
        watchers.splice(w, 1)
        perils.push({ at, kind: "watch" })
      }
    }
    return { path, perils }
  }

  /** Ends the squad turn and plays the alien turn. */
  async endTurn(): Promise<void> {
    if (!this.ready()) return
    this.thinking = true
    this.setBanner(true)
    this.sound.play("turn")
    const start = performance.now()
    this.act({ type: "endTurn" })
    while (this.game().phase === "enemy") {
      await this.idle()
      this.act(new Mind(this.game()).next())
    }
    await this.idle()
    const wait = BANNER * 1000 - (performance.now() - start)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.setBanner(false)
    this.thinking = false
    this.next()
  }

  /** The tiles to mark for the selected soldier and the armed skill. */
  zones(): Zones {
    const g = this.game(),
      u = this.unit(),
      none: Zones = { move: [], dash: [], reach: [], targets: [], area: [], foeMove: [], foeShot: [] }
    const hovered = this.hovered() ? g.unitAt(this.hovered() as Point) : undefined
    if (hovered?.side === "enemy" && !this.armed()) return { ...none, ...this.threat(hovered) }
    if (!u || g.phase !== "squad" || u.ap === 0) return none
    const foes = g.foes(u)
    if (!this.armed()) {
      const one = g.reach(u, 1).tiles(),
        two = u.ap > 1 ? g.reach(u, 2).tiles() : []
      return {
        ...none,
        move: one,
        dash: two.filter((p) => !one.some((q) => same(p, q))),
        targets: foes.filter((f) => g.combat.canShoot(u, f)).map((f) => f.at),
      }
    }
    const hover = this.hovered()
    switch (u.profile.skill) {
      case "runGun":
        if (!this.runTo) return { ...none, reach: g.reach(u, 2).tiles() }
        return {
          ...none,
          area: [this.runTo],
          targets: foes.filter((f) => g.combat.canShoot(u, f, this.runTo as Point)).map((f) => f.at),
        }
      case "grenade": {
        const reach = all(g).filter((p) => distance(p, u.at) <= 4)
        const area =
          hover && distance(hover, u.at) <= 4
            ? [hover, ...ORTHOGONAL.map((d) => plus(hover, d))].filter((p) => g.board.inside(p))
            : []
        return { ...none, reach, area }
      }
      case "headshot":
        return {
          ...none,
          targets: foes.filter((f) => g.combat.canShoot(u, f) && cover(g.board, f.at, u.at) === 0).map((f) => f.at),
        }
      case "medkit":
        return {
          ...none,
          reach: g
            .allies(u)
            .filter((a) => a === u || adjacent(a.at, u.at))
            .map((a) => a.at),
        }
      default:
        return none
    }
  }

  private threat(foe: Unit): Pick<Zones, "foeMove" | "foeShot"> {
    const g = this.game(),
      p = foe.profile
    const from = [foe.at, ...g.reach(foe, 1).tiles()]
    const hits = (q: Point, t: Point) =>
      p.melee || p.range === 0 ? adjacent(q, t) : distance(q, t) <= p.range && clear(g.board, q, t)
    return {
      foeMove: g.reach(foe, 2).tiles(),
      foeShot: all(g).filter((t) => from.some((q) => hits(q, t))),
    }
  }

  /** The odds of the selected soldier against the hovered alien. */
  odds(): { target: Unit; odds: Odds } | null {
    const g = this.game(),
      u = this.unit(),
      p = this.hovered()
    const target = p ? g.unitAt(p) : undefined
    if (!u || !target || target.side === u.side) return null
    const from = this.armed() && this.runTo ? this.runTo : u.at
    if (!g.combat.canShoot(u, target, from) && !(u.profile.melee && adjacent(from, target.at))) return null
    const odds = g.combat.odds(u, target, { from })
    if (this.armed() && u.profile.skill === "headshot") return { target, odds: { ...odds, crit: 100 } }
    return { target, odds }
  }

  /** Carries out an action; the squad turn ends on its own once no soldier has AP. */
  private act(action: Action): void {
    const before = this.game()
    try {
      const after = before.apply(action)
      this.record(action, after)
      this.playback.play(before, action, after)
      this.disarm()
      this.setGame(after)
      if (after.phase === "squad" && !this.unit()?.ap) this.next()
      if (after.phase === "squad" && !after.units.some((x) => x.side === "squad" && x.alive() && x.ap > 0))
        void this.idle().then(() => this.endTurn())
    } catch (e) {
      if (!(e instanceof Illegal)) throw e
      this.refuse(e.message)
    }
  }

  private refuse(reason: string): void {
    this.notify(reason)
    setTimeout(() => this.notify(null), 1600)
  }

  private next(): void {
    const g = this.game()
    const keep = this.unit()
    if (keep && keep.ap > 0) return
    this.select(g.units.find((u) => u.side === "squad" && u.alive() && u.ap > 0)?.id ?? null)
  }

  private idle(): Promise<void> {
    return new Promise((done) => {
      const wait = () => (this.playback.busy(performance.now() / 1000) ? requestAnimationFrame(wait) : done())
      requestAnimationFrame(wait)
    })
  }
}

function all(g: Game): Point[] {
  return g.board.tiles.map((_, i) => ({ x: i % g.board.width, y: Math.floor(i / g.board.width) }))
}
