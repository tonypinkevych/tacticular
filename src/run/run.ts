import { Dice } from "../combat/dice"
import { same } from "../map/point"
import type { Game } from "../mission/game"
import { type Conditions, NAMES } from "../mission/mission"
import { CLASSES, type ClassId, PROFILES } from "../units/profiles"
import type { Recruit, Unit } from "../units/unit"
import { Chart, type Node, type Task } from "./chart"

/** Where a run stands: picking the squad, on the chart, in a mission, picking a reward, or over. */
export type Stage = "draft" | "chart" | "mission" | "reward" | "won" | "lost"

/** A reward after a won mission: heal everyone, a named recruit, or training for a named soldier. */
export type Reward = { kind: "heal" } | { kind: "recruit"; recruit: Recruit } | { kind: "train"; id: string }

/** How a mission ended for the run: won or not, and the HP each soldier in it left with; 0 is dead. */
export interface Result {
  won: boolean
  hp: Record<string, number>
}

/** One choice of the player in a run; the run replays from its seed and its choices. */
export type Choice =
  | { type: "draft"; picks: string[] }
  | { type: "go"; node: number; deploy: string[] }
  | { type: "finish"; result: Result }
  | { type: "take"; pick: number }

const DRAFT = 3

const SQUAD = 4

const ROSTER = 5

/**
 * One act of a roguelike run: a drafted squad crosses a chart of missions to the fortress. HP, recruits and
 * training carry from mission to mission, and each won mission changes the fortress.
 */
export class Run {
  stage: Stage = "draft"
  candidates: Recruit[] = []
  roster: Recruit[] = []
  at: number | null = null
  threat = 0
  done: Task[] = []
  failed: number[] = []
  deployed: string[] = []
  offers: Reward[] = []
  captive: Recruit | null = null
  recruits = 0
  rng: number
  readonly chart: Chart
  private readonly dice: Dice

  constructor(readonly seed: number) {
    this.rng = seed
    this.dice = new Dice(this)
    this.chart = Chart.of(seed)
  }

  /** A new run that offers one soldier of each class. */
  static start(seed: number): Run {
    const run = new Run(seed)
    const names = run.dice.shuffle(NAMES)
    run.candidates = CLASSES.map((kind, i) => run.soldier(`c${i + 1}`, kind, names[i]))
    return run
  }

  play(choice: Choice): void {
    if (choice.type === "draft") this.draft(choice.picks)
    if (choice.type === "go") this.go(choice.node, choice.deploy)
    if (choice.type === "finish") this.finish(choice.result)
    if (choice.type === "take") this.take(choice.pick)
  }

  /** Takes 3 of the candidates as the roster. */
  draft(picks: string[]): void {
    must(this.stage === "draft" && new Set(picks).size === DRAFT, "draft")
    this.roster = picks.map((id) => {
      const c = this.candidates.find((x) => x.id === id)
      must(!!c, "draft")
      return structuredClone(c!)
    })
    this.stage = "chart"
  }

  /** The missions the squad can go to now. */
  options(): Node[] {
    return this.at === null ? this.chart.layer(0) : this.chart.node(this.at).next.map((id) => this.chart.node(id))
  }

  /** The fewest soldiers a mission takes: 3, or the whole roster when it is smaller. */
  fewest(): number {
    return Math.min(DRAFT, this.roster.length)
  }

  /** Goes to a mission with the fewest to 4 soldiers of the roster; the threat rises, twice for the captain. */
  go(node: number, deploy: string[]): void {
    must(this.stage === "chart" && this.options().some((n) => n.id === node), "node")
    must(deploy.length >= this.fewest() && deploy.length <= SQUAD && new Set(deploy).size === deploy.length, "deploy")
    must(
      deploy.every((id) => this.roster.some((s) => s.id === id)),
      "deploy",
    )
    this.at = node
    this.deployed = [...deploy]
    const kind = this.chart.node(node).kind
    this.threat += kind === "captain" ? 2 : 1
    this.captive = kind === "vip" ? this.newcomer() : null
    this.stage = "mission"
  }

  /** The mission seed of the current node. */
  mission(): number {
    return (Math.imul(this.seed ^ 0x9e3779b9, (this.at ?? 0) + 1) >>> 1) % 2 ** 31
  }

  /** What the current mission holds: its goal, the deployed soldiers, and aliens that grow with the threat. */
  conditions(): Conditions {
    const t = this.threat
    const node = this.chart.node(this.at ?? 0)
    const base: Conditions = {
      squad: this.deployed.map((id) => this.roster.find((s) => s.id === id)!),
      groups: 2 + Math.floor(t / 2),
      size: t >= 6 ? 3 : 2,
      alarm: Math.min(3, Math.floor(t / 2)),
      biome: node.biome,
    }
    if (node.kind === "captain") return { ...base, goal: "warchief", pad: false }
    if (node.kind === "vip") return { ...base, goal: "vip", captive: this.captive ?? undefined }
    if (node.kind !== "fortress") return { ...base, goal: node.kind }
    return {
      ...base,
      goal: "warchief",
      groups: 4 - (this.done.includes("captain") ? 1 : 0),
      size: 2,
      pad: !this.done.includes("relay"),
      scouted: this.done.includes("intel"),
    }
  }

  /**
   * Ends the mission: soldiers keep the HP they left with and heal 1, those who stayed out heal 3, the dead
   * leave. A win records what it changes and offers rewards; a loss raises the threat.
   */
  finish(result: Result): void {
    must(this.stage === "mission", "finish")
    const node = this.chart.node(this.at ?? 0)
    for (const s of this.roster) {
      const out = !this.deployed.includes(s.id)
      if (!out) s.hp = result.hp[s.id] ?? 0
      if (s.hp > 0) s.hp = Math.min(max(s), s.hp + (out ? 3 : 1))
    }
    this.roster = this.roster.filter((s) => s.hp > 0)
    const freed = this.captive && result.hp[this.captive.id]
    if (result.won && freed) this.roster.push({ ...this.captive!, hp: Math.min(max(this.captive!), freed + 1) })
    if (result.won) this.done.push(node.kind)
    if (result.won && node.kind === "defend") this.heal(3)
    this.deployed = []
    if (this.roster.length === 0) this.stage = "lost"
    else if (node.kind === "fortress") this.stage = result.won ? "won" : "lost"
    else if (result.won) {
      this.offers = this.offer()
      this.stage = "reward"
    } else {
      this.failed.push(node.id)
      this.threat += 1
      this.stage = "chart"
    }
  }

  /** Takes one of the offered rewards. */
  take(pick: number): void {
    must(this.stage === "reward" && !!this.offers[pick], "reward")
    const r = this.offers[pick]
    if (r.kind === "heal") this.heal(3)
    if (r.kind === "recruit") this.roster.push(r.recruit)
    if (r.kind === "train") {
      const s = this.roster.find((x) => x.id === r.id)!
      s.spread = { ...s.spread, hp: s.spread.hp + 1, aim: s.spread.aim + 1 }
      s.hp += 1
    }
    this.offers = []
    this.stage = "chart"
  }

  private heal(n: number): void {
    for (const s of this.roster) s.hp = Math.min(max(s), s.hp + n)
  }

  private offer(): Reward[] {
    const out: Reward[] = [{ kind: "heal" }]
    if (this.roster.length < ROSTER) out.push({ kind: "recruit", recruit: this.newcomer() })
    for (const s of this.dice.shuffle(this.roster)) if (out.length < 3) out.push({ kind: "train", id: s.id })
    return out
  }

  /** A new soldier of a class the roster lacks when it can, with a name no one has. */
  private newcomer(): Recruit {
    const lacking = CLASSES.filter((c) => !this.roster.some((s) => s.kind === c))
    const kind = this.dice.pick(lacking.length > 0 ? lacking : CLASSES)
    const names = NAMES.filter((n) => !this.roster.some((s) => s.name === n))
    this.recruits += 1
    return this.soldier(`r${this.recruits}`, kind, this.dice.pick(names))
  }

  private soldier(id: string, kind: ClassId, name: string): Recruit {
    const r = this.dice
    const spread = { hp: r.between(-1, 1), aim: r.between(-1, 1), will: r.between(-1, 1) }
    return { id, kind, name, spread, hp: PROFILES[kind].hp + spread.hp }
  }
}

/**
 * The result of a finished mission: a downed soldier counts 1 HP after a win and 0 after a loss, or when it was
 * left outside the evac zone while aliens still live.
 */
export function outcome(game: Game): Result {
  const won = game.phase === "won"
  const goal = game.goal
  const clear = !game.units.some((u) => u.alive() && u.side === "enemy")
  const carried = (u: Unit) => clear || !("tiles" in goal) || goal.tiles.some((p) => same(p, u.pos))
  const hp: Record<string, number> = {}
  for (const u of game.units)
    if (u.side === "squad" && u.kind !== "turret") hp[u.id] = u.alive() ? u.hp : won && u.down > 0 && carried(u) ? 1 : 0
  return { won, hp }
}

/** The most HP a soldier of the roster can have. */
export const max = (s: Recruit): number => PROFILES[s.kind].hp + s.spread.hp

function must(ok: boolean, what: string): void {
  if (!ok) throw new Error(`bad ${what}`)
}
