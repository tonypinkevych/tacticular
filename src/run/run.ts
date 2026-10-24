import { Dice } from "../combat/dice"
import type { Game } from "../mission/game"
import { aliens, type Conditions } from "../mission/mission"
import { BRANCHES, type Branch, type ClassId, PROFILES } from "../units/profiles"
import type { Training } from "../units/unit"
import { Chart, type Node, type Prize } from "./chart"

/** Where a run stands: picking the squad, on the chart, in a mission, picking a reward, or over. */
export type Stage = "draft" | "chart" | "mission" | "reward" | "won" | "lost"

/** A soldier of the roster, with the HP it carries and what it trained. */
export interface Soldier {
  id: string
  kind: ClassId
  hp: number
  max: number
  extra: Training
}

/** A reward after a won mission. */
export type Reward =
  | { kind: "heal" }
  | { kind: "recruit"; soldier: Soldier }
  | { kind: "train"; id: string }
  | { kind: "upgrade"; id: string; branch?: Branch }

/** How a mission ended for the run: won or not, the HP each soldier in it left with (0 is dead), and its combos. */
export interface Result {
  won: boolean
  hp: Record<string, number>
  combos?: Record<string, number>
}

/** One choice of the player in a run; the run replays from its seed and its choices. */
export type Choice =
  | { type: "draft"; picks: string[] }
  | { type: "go"; node: number; deploy: string[] }
  | { type: "finish"; result: Result }
  | { type: "take"; pick: number }

const CLASSES: ClassId[] = ["vanguard", "ranger", "warden", "cleric"]
const SQUAD = 3
const ROSTER = 6

/** One act of a roguelike run: a drafted squad crosses a chart of missions to the Commander's fortress. */
export class Run {
  stage: Stage = "draft"
  candidates: Soldier[] = []
  roster: Soldier[] = []
  at: number | null = null
  threat = 0
  deployed: string[] = []
  offers: Reward[] = []
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
    run.candidates = CLASSES.map((kind, i) => soldier(`c${i + 1}`, kind))
    return run
  }

  play(choice: Choice): void {
    if (choice.type === "draft") this.draft(choice.picks)
    if (choice.type === "go") this.go(choice.node, choice.deploy)
    if (choice.type === "finish") this.finish(choice.result)
    if (choice.type === "take") this.take(choice.pick)
  }

  /** The missions the squad can go to now. */
  options(): Node[] {
    return this.at === null ? this.chart.layer(0) : this.chart.node(this.at).next.map((id) => this.chart.node(id))
  }

  /** The mission seed of the current node. */
  mission(): number {
    return (Math.imul(this.seed ^ 0x9e3779b9, (this.at ?? 0) + 1) >>> 1) % 2 ** 31
  }

  /** What the current mission holds: its goal, the deployed soldiers, and aliens that grow with the threat. */
  conditions(): Conditions {
    const squad = this.deployed
      .map((id) => this.roster.find((s) => s.id === id) as Soldier)
      .map(({ id, kind, hp, extra }) => ({ id, kind, hp, extra }))
    return { ...this.brief(this.chart.node(this.at ?? 0), this.threat), squad }
  }

  /** The goal, threat and alien count of the mission on a node, if the squad went there now. */
  preview(node: number): Omit<Conditions, "squad"> & { aliens: number } {
    const brief = this.brief(this.chart.node(node), this.threat + 1)
    return { ...brief, aliens: aliens(brief) }
  }

  private brief({ kind, biome, foe }: Node, threat: number): Omit<Conditions, "squad"> {
    if (kind === "fortress") return { goal: "kill", threat: 2, boss: true, biome }
    if (kind === "elite") return { goal: "kill", threat: threat + 2, biome, foe }
    return { goal: kind, threat, biome, foe }
  }

  /** Gives a soldier +1 HP and +5 aim for good. */
  train(id: string): void {
    const s = this.soldier(id)
    s.extra = { ...s.extra, hp: s.extra.hp + 1, aim: s.extra.aim + 5 }
    s.max += 1
    s.hp += 1
  }

  /** Gives a soldier a branch of its class, or once it has one, a use more or a turn less to wait. */
  upgrade(id: string, branch?: Branch): void {
    const s = this.soldier(id)
    if (branch && !s.extra.branch && BRANCHES[s.kind].includes(branch)) s.extra = { ...s.extra, branch }
    else s.extra = { ...s.extra, upgrades: s.extra.upgrades + 1 }
  }

  private draft(picks: string[]): void {
    must(this.stage === "draft" && new Set(picks).size === SQUAD, "draft")
    this.roster = picks.map((id) => structuredClone(this.candidates.find((x) => x.id === id) ?? fail("draft")))
    this.stage = "chart"
  }

  private go(node: number, deploy: string[]): void {
    must(this.stage === "chart" && this.options().some((n) => n.id === node), "node")
    must(deploy.length > 0 && deploy.length <= SQUAD && new Set(deploy).size === deploy.length, "deploy")
    must(
      deploy.every((id) => this.roster.some((s) => s.id === id)),
      "deploy",
    )
    this.at = node
    this.deployed = [...deploy]
    this.threat += 1
    this.stage = "mission"
  }

  /**
   * Soldiers keep the HP they left with and heal 3, those who stayed out heal 5; after a win the fallen come back
   * with 1 HP, after a loss they are dead. A soldier with 2 combos becomes a Partner.
   */
  private finish(result: Result): void {
    must(this.stage === "mission", "finish")
    const node = this.chart.node(this.at ?? 0)
    for (const s of this.roster) {
      if ((result.combos?.[s.id] ?? 0) >= 2) s.extra = { ...s.extra, partner: true }
      const out = !this.deployed.includes(s.id)
      if (!out) s.hp = result.hp[s.id] ?? 0
      if (!out && result.won && s.hp <= 0) s.hp = 1
      if (s.hp > 0) s.hp = Math.min(s.max, s.hp + (out ? 5 : 3))
    }
    this.roster = this.roster.filter((s) => s.hp > 0)
    this.deployed = []
    if (result.won && node.kind === "defend") this.heal(2)
    if (this.roster.length === 0) this.stage = "lost"
    else if (node.kind === "fortress") this.stage = result.won ? "won" : "lost"
    else if (result.won) {
      this.offers = this.offer(node.prize ?? "heal")
      this.stage = "reward"
    } else {
      this.threat += 1
      this.stage = "chart"
    }
  }

  private take(pick: number): void {
    must(this.stage === "reward" && !!this.offers[pick], "reward")
    const r = this.offers[pick]
    if (r.kind === "heal") this.heal(3)
    if (r.kind === "recruit") this.roster.push(r.soldier)
    if (r.kind === "train") this.train(r.id)
    if (r.kind === "upgrade") this.upgrade(r.id, r.branch)
    this.offers = []
    this.stage = "chart"
  }

  private heal(n: number): void {
    for (const s of this.roster) s.hp = Math.min(s.max, s.hp + n)
  }

  /**
   * The choices of a prize: heal all; a recruit of up to 3 classes while the roster has room, else a heal; training
   * for up to 3 soldiers; up to 3 upgrades, both branches of a soldier that has none.
   */
  private offer(prize: Prize): Reward[] {
    if (prize === "recruit" && this.roster.length < ROSTER) {
      const lacking = CLASSES.filter((c) => !this.roster.some((s) => s.kind === c))
      return this.dice
        .shuffle(lacking.length ? lacking : CLASSES)
        .slice(0, 3)
        .map((kind) => {
          this.recruits += 1
          return { kind: "recruit", soldier: soldier(`r${this.recruits}`, kind) }
        })
    }
    if (prize === "train")
      return this.dice
        .shuffle(this.roster)
        .slice(0, 3)
        .map((s) => ({ kind: prize, id: s.id }))
    if (prize === "upgrade") {
      const out: Reward[] = []
      for (const s of this.dice.shuffle(this.roster)) {
        const choices: Reward[] = s.extra.branch
          ? [{ kind: "upgrade", id: s.id }]
          : BRANCHES[s.kind].map((branch) => ({ kind: "upgrade", id: s.id, branch }))
        if (out.length + choices.length <= 3) out.push(...choices)
      }
      return out
    }
    return [{ kind: "heal" }]
  }

  private soldier(id: string): Soldier {
    return this.roster.find((x) => x.id === id) ?? fail("soldier")
  }
}

/** The result of a finished mission: a soldier who left by the evac keeps its HP; each soldier's combos are counted. */
export function outcome(game: Game): Result {
  const hp: Record<string, number> = {},
    combos: Record<string, number> = {}
  for (const u of game.units) if (u.side === "squad") hp[u.id] = u.hp
  for (const e of game.log)
    if (e.key === "log.combo") combos[String(e.params.unit)] = (combos[String(e.params.unit)] ?? 0) + 1
  return { won: game.phase === "won", hp, combos }
}

function soldier(id: string, kind: ClassId): Soldier {
  return { id, kind, hp: PROFILES[kind].hp, max: PROFILES[kind].hp, extra: { hp: 0, aim: 0, upgrades: 0 } }
}

function must(ok: boolean, what: string): void {
  if (!ok) fail(what)
}

function fail(what: string): never {
  throw new Error(`bad ${what}`)
}
