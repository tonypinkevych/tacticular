import { type Accessor, createSignal, type Setter } from "solid-js"
import { Mind } from "../aliens/mind"
import type { Odds } from "../combat/combat"
import { cover } from "../map/cover"
import { adjacent, distance, ORTHOGONAL, type Point, plus, same } from "../map/point"
import type { Game } from "../mission/game"
import { type Action, Illegal } from "../mission/orders"
import type { Unit } from "../units/unit"
import { Playback } from "./playback/playback"

/** The tiles the board marks for the selected soldier. */
export interface Zones {
  move: Point[]
  dash: Point[]
  reach: Point[]
  targets: Point[]
  area: Point[]
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
  readonly banner: Accessor<boolean>
  readonly notice: Accessor<string | null>
  readonly playback = new Playback()
  private readonly setGame: Setter<Game>
  private readonly select: Setter<string | null>
  private readonly arm: Setter<boolean>
  private readonly hover: Setter<Point | null>
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
    ;[this.banner, this.setBanner] = createSignal(false)
    ;[this.notice, this.notify] = createSignal<string | null>(null)
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
  }

  overwatch(): void {
    const u = this.unit()
    if (u && this.ready()) this.act({ type: "overwatch", unit: u.id })
  }

  /** A click on a tile: select, move, shoot, or aim the armed skill. */
  click(p: Point): void {
    if (!this.ready()) return
    const g = this.game(),
      u = this.unit(),
      there = g.unitAt(p)
    if (there?.side === "squad" && !this.armed()) this.pick(there.id)
    else if (!u) return
    else if (this.armed()) this.aim(u, p, there)
    else if (there && there.side !== u.side) this.act({ type: "shoot", unit: u.id, target: there.id })
    else if (g.board.at(p) === "barrel") this.act({ type: "shoot", unit: u.id, at: p })
    else this.act({ type: "move", unit: u.id, to: p })
  }

  private aim(u: Unit, p: Point, there: Unit | undefined): void {
    switch (u.profile.skill) {
      case "runGun":
        if (!this.runTo) {
          if (this.game().reach(u, 2).has(p)) {
            this.runTo = p
            this.setGame(this.game())
          }
          return
        }
        if (there && there.side !== u.side) this.act({ type: "skill", unit: u.id, to: this.runTo, target: there.id })
        return
      case "grenade":
        this.act({ type: "skill", unit: u.id, at: p })
        return
      default:
        if (there) this.act({ type: "skill", unit: u.id, target: there.id })
    }
  }

  /** Ends the squad turn and plays the alien turn. */
  async endTurn(): Promise<void> {
    if (!this.ready()) return
    this.thinking = true
    this.setBanner(true)
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
      none: Zones = { move: [], dash: [], reach: [], targets: [], area: [] }
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

  private act(action: Action): void {
    const before = this.game()
    try {
      const after = before.apply(action)
      this.record(action, after)
      this.playback.play(before, action, after)
      this.disarm()
      this.setGame(after)
      if (after.phase === "squad" && !this.unit()?.ap) this.next()
    } catch (e) {
      if (!(e instanceof Illegal)) throw e
      this.notify(e.message)
      setTimeout(() => this.notify(null), 1600)
    }
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
