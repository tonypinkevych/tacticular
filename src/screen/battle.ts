import { type Accessor, createSignal, type Setter } from "solid-js"
import { Mind } from "../aliens/mind"
import type { Hit } from "../combat/combat"
import { READY } from "../combat/ultimates"
import { t } from "../i18n/strings"
import { cover } from "../map/cover"
import { adjacent, distance, ORTHOGONAL, type Point, plus, same } from "../map/point"
import { clear } from "../map/sight"
import type { Game, Mark } from "../mission/game"
import { type Action, Illegal } from "../mission/orders"
import type { Unit } from "../units/unit"
import { type Help, help } from "./help"
import { Playback } from "./playback/playback"
import { Sound } from "./playback/sound"
import { Sweep } from "./sweep"

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
  /** The alien on overwatch that fires there. */
  by?: string
}

/** What a click does now: move, shoot, use the skill, the tactic or the ultimate, set Overwatch, or Hunker down. */
export type Mode = "move" | "shoot" | "skill" | "tactic" | "overwatch" | "hunker" | "ultimate"

/** Seconds the alien turn banner stays at least. */
const BANNER = 1.5

/**
 * One mission on screen: the game, the soldier the player selected, the chosen action, and the alien turn
 * played by the mind with its playback. The game changes only through actions.
 */
export class Battle {
  readonly game: Accessor<Game>
  readonly selected: Accessor<string | null>
  readonly mode: Accessor<Mode>
  readonly hovered: Accessor<Point | null>
  /** The tile Shoot, the skill or Overwatch aims at; Confirm or a click on it carries the action out. */
  readonly planned: Accessor<Point | null>
  readonly banner: Accessor<boolean>
  readonly notice: Accessor<string | null>
  readonly playback: Playback
  readonly sound = new Sound()
  private readonly setGame: Setter<Game>
  private readonly select: Setter<string | null>
  private readonly setMode: Setter<Mode>
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
    ;[this.mode, this.setMode] = createSignal<Mode>("move")
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
    this.cancel()
  }

  /** The next soldier with AP left, forward or back. */
  cycle(back = false): void {
    const squad = this.game().units.filter((u) => u.side === "squad" && u.alive() && u.ap > 0)
    if (!squad.length) return
    const i = squad.findIndex((u) => u.id === this.selected())
    this.pick(squad[(i + (back ? squad.length - 1 : 1) + squad.length) % squad.length].id)
  }

  /**
   * Picks an action of the bar. Shoot and the skill aim at the first target, and Overwatch at the soldier. Picking
   * the chosen action again carries out what is aimed, or goes back to moving when nothing is.
   */
  choose(mode: Mode): void {
    const u = this.unit()
    if (!u || !this.ready() || (mode === "tactic" && !u.profile.tactic)) return
    if (mode === "skill" && (u.cooldown > 0 || u.uses === 0)) {
      this.refuse(u.cooldown > 0 ? "cooldown" : "uses")
      return
    }
    if (mode === "ultimate" && (!u.profile.ultimate || u.charge < READY)) {
      this.refuse("charge")
      return
    }
    if (this.mode() === mode) {
      if (this.planned()) this.confirm()
      else this.cancel()
      return
    }
    this.cancel()
    this.setMode(mode)
    if (mode === "shoot" || mode === "skill" || mode === "tactic") this.plan(this.zones().targets[0] ?? null)
    if (mode === "overwatch" || mode === "hunker" || (mode === "ultimate" && Sweep.self(u))) this.plan(u.at)
    else if (mode === "ultimate" && u.profile.ultimate === "killshot") this.plan(this.zones().targets[0] ?? null)
  }

  /** Back to moving, with nothing planned. */
  cancel(): void {
    this.runTo = null
    this.setMode("move")
    this.plan(null)
  }

  /** Carries out what is aimed. */
  confirm(): void {
    const u = this.unit(),
      p = this.planned()
    if (!u || !p || !this.ready()) return
    const mode = this.mode()
    const still = mode === "overwatch" || mode === "hunker" || (mode === "ultimate" && Sweep.self(u))
    const action = still ? ({ type: mode, unit: u.id } as Action) : this.action(u, p)
    if (action) this.act(action)
  }

  /** In Shoot, the skill or the tactic, moves the aim to the next target; else selects the next soldier with AP. */
  tab(back = false): void {
    if (this.mode() === "move" || this.mode() === "overwatch" || this.mode() === "hunker") {
      this.cycle(back)
      return
    }
    const targets = this.zones().targets,
      was = this.planned()
    if (!targets.length) return
    const i = targets.findIndex((t) => was !== null && same(t, was))
    this.plan(targets[(i + (back ? targets.length - 1 : 1) + targets.length) % targets.length])
  }

  /**
   * A click on a soldier selects it, and a click on a tile moves there. A click on an alien or a barrel while
   * moving aims at it; in Shoot, the skill or the tactic, a click on a target carries the action out.
   */
  click(p: Point): void {
    if (!this.ready()) return
    const g = this.game(),
      u = this.unit(),
      there = g.unitAt(p)
    if (there?.side === "squad" && this.mode() !== "skill") {
      this.pick(there.id)
      return
    }
    if (!u) return
    const mark = (!!there && there.side !== u.side) || g.board.at(p) === "barrel"
    const still =
      this.mode() === "overwatch" || this.mode() === "hunker" || (this.mode() === "ultimate" && Sweep.self(u))
    if (still || (this.mode() === "shoot" && !mark)) this.cancel()
    const action = this.action(u, p)
    if (!action) return
    if (this.mode() !== "move" || !mark) {
      this.act(action)
      return
    }
    try {
      g.apply(action)
      this.setMode("shoot")
      this.plan(p)
    } catch (e) {
      if (!(e instanceof Illegal)) throw e
      this.refuse(e.message)
    }
  }

  /** The action the chosen mode takes on a tile: the skill, the tactic, a shot at an alien or a barrel, or a move. */
  private action(u: Unit, p: Point): Action | null {
    const g = this.game(),
      there = g.unitAt(p)
    if (this.mode() === "skill") return this.aim(u, p, there)
    if (this.mode() === "ultimate") {
      if (u.profile.ultimate === "breach") return { type: "ultimate", unit: u.id, to: p }
      return there && there.side !== u.side ? { type: "ultimate", unit: u.id, target: there.id } : null
    }
    if (this.mode() === "tactic")
      return there && there.side !== u.side ? { type: "tactic", unit: u.id, target: there.id } : null
    if (there && there.side !== u.side) return { type: "shoot", unit: u.id, target: there.id }
    if (g.board.at(p) === "barrel") return { type: "shoot", unit: u.id, at: p }
    return { type: "move", unit: u.id, to: p }
  }

  private aim(u: Unit, p: Point, there: Unit | undefined): Action | null {
    switch (u.profile.skill) {
      case "runGun":
      case "lunge":
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
    if (!u || !to || this.mode() !== "move" || g.unitAt(to) || g.phase !== "squad") return null
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
        perils.push({ at, kind: "watch", by: watchers[w].id })
        watchers.splice(w, 1)
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

  /** The tiles to mark for the selected soldier and the chosen action, and the blast of a pointed or aimed barrel. */
  zones(): Zones {
    const g = this.game(),
      zones = this.base(),
      p = (this.mode() === "shoot" && this.planned()) || this.hovered()
    if (this.mode() === "skill" || !p || g.board.at(p) !== "barrel") return zones
    return { ...zones, area: new Sweep(g).blast(p) }
  }

  private base(): Zones {
    const g = this.game(),
      u = this.unit(),
      none: Zones = { move: [], dash: [], reach: [], targets: [], area: [], foeMove: [], foeShot: [] }
    const hovered = this.hovered() ? g.unitAt(this.hovered() as Point) : undefined
    if (hovered?.side === "enemy" && this.mode() === "move") return { ...none, ...this.threat(hovered) }
    if (!u || g.phase !== "squad" || u.ap === 0) return none
    const foes = g.foes(u),
      targets = foes.filter((f) => g.combat.canShoot(u, f)).map((f) => f.at)
    if (this.mode() === "shoot") return { ...none, reach: new Sweep(g).fire(u, u.at), targets }
    if (this.mode() === "tactic")
      return {
        ...none,
        reach: new Sweep(g).all().filter((p) => g.tactics.reaches(u, p)),
        targets: foes
          .filter((f) => {
            try {
              g.apply({ type: "tactic", unit: u.id, target: f.id })
              return true
            } catch (e) {
              if (!(e instanceof Illegal)) throw e
              return false
            }
          })
          .map((f) => f.at),
      }
    if (this.mode() === "overwatch") return { ...none, reach: new Sweep(g).fire(u, u.at) }
    if (this.mode() === "ultimate") return { ...none, ...new Sweep(g).ultimate(u, this.hovered()) }
    if (this.mode() === "move") {
      const one = g.reach(u, 1).tiles(),
        two = u.ap > 1 ? g.reach(u, 2).tiles() : []
      return { ...none, move: one, dash: two.filter((p) => !one.some((q) => same(p, q))), targets }
    }
    const hover = this.hovered()
    switch (u.profile.skill) {
      case "runGun":
      case "lunge":
        if (!this.runTo) return { ...none, reach: g.reach(u, 2).tiles() }
        return {
          ...none,
          reach: new Sweep(g).fire(u, this.runTo),
          area: [this.runTo],
          targets: foes.filter((f) => g.combat.canShoot(u, f, this.runTo as Point)).map((f) => f.at),
        }
      case "grenade": {
        const reach = new Sweep(g).all().filter((p) => distance(p, u.at) <= 4)
        const area =
          hover && distance(hover, u.at) <= 4
            ? [hover, ...ORTHOGONAL.map((d) => plus(hover, d))].filter((p) => g.board.inside(p))
            : []
        return { ...none, reach, area }
      }
      case "headshot":
        return {
          ...none,
          reach: new Sweep(g).fire(u, u.at),
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
      foeShot: new Sweep(g).all().filter((t) => from.some((q) => hits(q, t))),
    }
  }

  /** The help of an ability of the selected soldier, or of its combo while moving; null with none selected. */
  help(mode: Mode): Help | null {
    const u = this.unit()
    return u ? help(u, mode) : null
  }

  /** What an alien plans for its next turn and at whom, as the player reads it; null when it plans nothing. */
  intent(id: string): string | null {
    const g = this.game(),
      m = g.marks.find((x) => x.unit === id)
    if (!m) return null
    const target = g.units.find((x) => x.id === m.target),
      attack = t(`ui.attack.${m.kind}`)
    return target ? t("ui.intent", { attack, target: t(`kind.${target.kind}`) }) : t("ui.intent.area", { attack })
  }

  /** The damage of an attack an alien aimed, as the board stands now; null when the target is out of its reach. */
  aimed(m: Mark): number | null {
    const g = this.game(),
      u = g.unit(m.unit),
      t = g.units.find((x) => x.id === m.target)
    if (!t?.alive() || !u.alive()) return null
    if (m.kind === "claw" ? !adjacent(u.at, t.at) : !g.combat.canShoot(u, t)) return null
    return g.combat.hit(u, t, { less: m.kind === "volley" ? 1 : 0 }).damage
  }

  /** An aimed attack's damage as the board shows it: "−2", "2×−1", KILL when it would kill, or "—" out of reach. */
  toll(m: Mark): string {
    const d = this.aimed(m),
      target = this.game().units.find((x) => x.id === m.target)
    if (d === null || !target) return "—"
    const n = m.kind === "volley" ? 2 : 1
    if (d > 0 && d * n >= target.hp) return t("ui.kill")
    return `${n > 1 ? "2×" : ""}−${d}`
  }

  /** The hit of the selected soldier on the aimed alien in Shoot, else on the hovered one. */
  hit(): { target: Unit; hit: Hit } | null {
    const g = this.game(),
      u = this.unit(),
      p = (this.mode() === "shoot" && this.planned()) || this.hovered()
    const target = p ? g.unitAt(p) : undefined
    if (!u || !target || target.side === u.side) return null
    const from = this.mode() === "skill" && this.runTo ? this.runTo : u.at
    if (!g.combat.canShoot(u, target, from) && !(u.profile.melee && adjacent(from, target.at))) return null
    const headshot = this.mode() === "skill" && u.profile.skill === "headshot"
    return { target, hit: g.combat.hit(u, target, { from, more: headshot ? 2 : 0 }) }
  }

  /** Why the mission was lost: the aliens held the beacon, or the squad died. */
  loss(): "beacon" | "squad" | null {
    const g = this.game()
    if (g.phase !== "lost") return null
    return g.goal.kind === "defend" && g.goal.strikes >= 2 ? "beacon" : "squad"
  }

  /** Carries out an action; the squad turn ends on its own once no soldier has AP. */
  private act(action: Action): void {
    const before = this.game()
    try {
      const after = before.apply(action)
      this.record(action, after)
      this.playback.play(before, action, after)
      this.cancel()
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
