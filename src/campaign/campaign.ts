import type { AbilityId } from "../combat/abilities"
import { Dice } from "../combat/dice"
import { same } from "../map/point"
import type { Game } from "../mission/game"
import { type Conditions, NAMES } from "../mission/mission"
import { CLASSES, type ClassId, PROFILES } from "../units/profiles"
import type { Recruit, Unit } from "../units/unit"
import { kit, level, rankable, type Soldier } from "./soldier"
import { PLACES, place, type Region, type RegionId } from "./world"

/** How many regions the player must free to win. */
export type Goal = 3 | 5 | 8

/** Where a campaign stands: on the world map, in a mission, or over. */
export type Stage = "world" | "mission" | "won" | "lost"

export type Tech = "weapons2" | "weapons3" | "armor2" | "armor3" | "squad"

export type OpKind = "intel" | "vip" | "relay" | "captain" | "defend" | "liberation"

/** A timed alien effect on every mission: +1 group, +2 Force Level, or alien drops 1 round sooner. */
export type DarkEvent = "reinforced" | "elite" | "vigilant"

/** What an ignored operation costs at the week's end: Project +2, the region's Strength +1, or its Resistance −1. */
export type Penalty = "project" | "strength" | "resistance"

/** 1 Easy, 2 Moderate, 3 Hard, 4 Very hard: the pods of an operation and the size of its reward. */
export type Difficulty = 1 | 2 | 3 | 4

/**
 * An operation posted this week: it launches with a squad or expires at the week's end. A launched operation waits
 * for its squad's infiltration and plays in the week it arrives.
 */
export interface Op {
  id: number
  kind: OpKind
  region: RegionId
  difficulty: Difficulty
  penalty: Penalty | null
  /** The squad of a launched operation. */
  squad: string[]
  /** The week the mission of a launched operation plays. */
  arrives?: number
  scouted: boolean
  /** The Dark Event a win ends. */
  event?: DarkEvent
  captive?: Recruit
}

/** The kinds posted by chance; a Relay only where the aliens have a site. */
const KINDS: OpKind[] = ["intel", "vip", "relay", "captain"]

/** The penalty of each kind left unplayed; Intel and VIP draw one, a Liberation has none. */
const PENALTIES: Partial<Record<OpKind, Penalty | null>> = {
  defend: "resistance",
  relay: "project",
  captain: "strength",
  liberation: null,
}

/**
 * How a mission ended for the campaign: won or not, the HP each soldier in it left with (0 is dead), and the ranks
 * of each soldier who ranked up in it.
 */
export interface Result {
  won: boolean
  hp: Record<string, number>
  ranks?: Record<string, Partial<Record<AbilityId, number>>>
}

/** One line of the week's report. */
export interface Note {
  key: string
  params: Record<string, string | number>
}

/** One choice of the player; a campaign replays from its seed, its goal and its choices. */
export type Choice =
  | { type: "contact"; region: RegionId }
  | { type: "recruit"; kind: ClassId }
  | { type: "research"; tech: Tech }
  | { type: "rank"; soldier: string; skill: AbilityId }
  | { type: "scout"; op: number }
  | { type: "launch"; op: number; squad: string[] }
  | { type: "deploy" }
  | { type: "week" }
  | { type: "finish"; result: Result }

/** The pace of each goal: the Project's end, the weeks per Force Level, and the XP of a won mission. */
export const GOALS: Record<Goal, { end: number; pace: number; xp: number }> = {
  3: { end: 36, pace: 3, xp: 32 },
  5: { end: 96, pace: 5, xp: 26 },
  8: { end: 200, pace: 9, xp: 16 },
}

/** Research: its cost, the tech it needs first, and its weeks. */
export const TECHS: Record<Tech, { supplies: number; materials: number; needs?: Tech }> = {
  weapons2: { supplies: 12, materials: 4 },
  weapons3: { supplies: 20, materials: 8, needs: "weapons2" },
  armor2: { supplies: 10, materials: 4 },
  armor3: { supplies: 18, materials: 8, needs: "armor2" },
  squad: { supplies: 16, materials: 6 },
}

/** The weeks a squad infiltrates before the mission of each difficulty plays. */
export const INFILTRATION: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 1, 4: 2 }

export const RESEARCH_WEEKS = 2
export const RECRUIT_COST = 6
export const CONTACT_COST = 4
export const SCOUT_COST = 2
export const ROSTER = 10
const FEWEST = 3
const START = 4
export const RESISTANCE = 2
const SITES = 2
const MOST_SITES = 3
const SITE_COST = 4

/**
 * A campaign to free the Earth, played in weeks. The player spends Supplies, Intel and Materials and sends squads
 * to operations; the aliens spend what their regions give on Strength, Dark Events and the Project, whose end
 * loses the campaign.
 */
export class Campaign {
  stage: Stage = "world"
  week = 1
  supplies = 10
  intel = 4
  materials = 0
  regions: Region[] = []
  /** The region the war started from, where squads fly out. */
  home: RegionId = PLACES[0].id
  ops: Op[] = []
  roster: Soldier[] = []
  techs: Tech[] = []
  research: { tech: Tech; ready: number } | null = null
  force = 1
  project = 0
  event: { id: DarkEvent; until: number } | null = null
  at: number | null = null
  report: Note[] = []
  made = 0
  /** True once an operation launched this week. */
  launched = false
  rng: number
  private readonly dice: Dice

  constructor(
    readonly seed: number,
    readonly goal: Goal,
  ) {
    this.rng = seed
    this.dice = new Dice(this)
  }

  /**
   * A new campaign: a home region in contact, alien Strength 4–7 elsewhere, 2 alien sites away from home, 4 soldiers
   * of 4 classes, and the first week's operations.
   */
  static start(seed: number, goal: Goal): Campaign {
    const c = new Campaign(seed, goal)
    const home = c.dice.pick(PLACES).id
    c.home = home
    const sites = c.dice
      .shuffle(PLACES.filter((p) => p.id !== home))
      .slice(0, SITES)
      .map((p) => p.id)
    c.regions = PLACES.map((p) => ({
      id: p.id,
      strength: p.id === home ? 4 : c.dice.between(4, 7),
      vigilance: 0,
      resistance: p.id === home ? 1 : 0,
      free: false,
      site: sites.includes(p.id),
    }))
    for (const kind of c.dice.shuffle(CLASSES).slice(0, START)) c.roster.push(c.soldier(kind))
    c.post()
    return c
  }

  play(choice: Choice): void {
    if (choice.type === "contact") this.contact(choice.region)
    if (choice.type === "recruit") this.recruit(choice.kind)
    if (choice.type === "research") this.study(choice.tech)
    if (choice.type === "rank") this.rank(choice.soldier, choice.skill)
    if (choice.type === "scout") this.scout(choice.op)
    if (choice.type === "launch") this.launch(choice.op, choice.squad)
    if (choice.type === "deploy") this.deploy()
    if (choice.type === "week") this.end()
    if (choice.type === "finish") this.finish(choice.result)
  }

  region(id: RegionId): Region {
    return this.regions.find((r) => r.id === id)!
  }

  op(id: number): Op {
    const o = this.ops.find((x) => x.id === id)
    must(!!o, "op")
    return o!
  }

  /** Regions the player can contact: no contact yet, next to a region in contact or free. */
  reachable(): Region[] {
    const held = (r: Region) => r.resistance > 0 || r.free
    return this.regions.filter((r) => !held(r) && place(r.id).next.some((n) => held(this.region(n))))
  }

  /** Soldiers who can go now: alive, rested and not away on an operation. */
  ready(): Soldier[] {
    return this.roster.filter((s) => s.hp > 0 && s.rest === 0 && !this.away(s.id))
  }

  away(id: string): boolean {
    return this.ops.some((o) => o.squad.includes(id))
  }

  /** The fewest soldiers an operation takes: 3, or the whole roster when it is smaller. */
  fewest(): number {
    return Math.min(FEWEST, this.roster.length)
  }

  /** The most soldiers an operation takes: 3, or 4 after the Squad size research. */
  most(): number {
    return this.techs.includes("squad") ? 4 : 3
  }

  /** The launched operation whose squad has arrived and whose mission waits to play, or null. */
  due(): Op | null {
    return this.ops.find((o) => o.arrives !== undefined && o.arrives <= this.week && o.id !== this.at) ?? null
  }

  freed(): number {
    return this.regions.filter((r) => r.free).length
  }

  /** The mission seed of the operation in play. */
  mission(): number {
    return (Math.imul(this.seed ^ 0x9e3779b9, (this.at ?? 0) + 1) >>> 1) % 2 ** 31
  }

  /** What the operation in play holds: its goal, the squad with its gear, and aliens by its difficulty. */
  conditions(): Conditions {
    const op = this.op(this.at ?? -1)
    const r = this.region(op.region)
    const d = op.difficulty
    const event = this.event?.id
    const base: Conditions = {
      squad: op.squad.map((id) => this.gear(this.roster.find((s) => s.id === id)!)),
      groups: 1 + d + (event === "reinforced" ? 1 : 0),
      size: d >= 3 ? 3 : 2,
      alarm: (d === 4 ? 1 : 0) + (event === "vigilant" ? 1 : 0),
      scouted: op.scouted,
      force: Math.min(10, this.force + (event === "elite" ? 2 : 0)),
      biome: place(r.id).biome,
    }
    if (op.kind === "captain") return { ...base, goal: "warchief", pad: false }
    if (op.kind === "liberation") return { ...base, goal: "warchief", size: 3, pad: false }
    if (op.kind === "vip") return { ...base, goal: "vip", captive: op.captive }
    return { ...base, goal: op.kind }
  }

  /** Spends Intel to contact a region next to the player's. */
  contact(id: RegionId): void {
    must(this.stage === "world" && this.reachable().some((r) => r.id === id) && this.intel >= CONTACT_COST, "contact")
    this.intel -= CONTACT_COST
    this.region(id).resistance = 1
  }

  /** Spends Supplies on a new soldier of a class. */
  recruit(kind: ClassId): void {
    must(this.stage === "world" && this.supplies >= RECRUIT_COST && this.roster.length < ROSTER, "recruit")
    this.supplies -= RECRUIT_COST
    this.roster.push(this.soldier(kind))
  }

  /** Starts research when none runs and its cost and the tech it needs are there. */
  study(tech: Tech): void {
    const t = TECHS[tech]
    must(this.stage === "world" && !this.research && !this.techs.includes(tech), "research")
    must(
      this.supplies >= t.supplies && this.materials >= t.materials && (!t.needs || this.techs.includes(t.needs)),
      "research",
    )
    this.supplies -= t.supplies
    this.materials -= t.materials
    this.research = { tech, ready: this.week + RESEARCH_WEEKS }
  }

  /** Puts a rank point in a skill; a skill outside the kit, as an old save may name, is skipped. */
  rank(id: string, skill: AbilityId): void {
    const s = this.roster.find((x) => x.id === id)
    if (s && !kit(s).includes(skill)) return
    must(!!s && rankable(s, skill), "rank")
    s!.ranks = { ...s!.ranks, [skill]: (s!.ranks?.[skill] ?? 0) + 1 }
  }

  /** Spends Intel to mark the alien groups of a posted operation. */
  scout(id: number): void {
    const op = this.op(id)
    must(this.stage === "world" && op.squad.length === 0 && !op.scouted && this.intel >= SCOUT_COST, "scout")
    this.intel -= SCOUT_COST
    op.scouted = true
  }

  /**
   * Sends a squad of ready soldiers to a posted operation; one operation launches each week. Its mission plays at
   * once, or after the infiltration weeks of its difficulty.
   */
  launch(id: number, squad: string[]): void {
    const op = this.op(id)
    const ready = this.ready()
    must(this.stage === "world" && !this.launched && op.squad.length === 0, "launch")
    must(squad.length >= this.fewest() && squad.length <= this.most() && new Set(squad).size === squad.length, "squad")
    must(
      squad.every((s) => ready.some((x) => x.id === s)),
      "squad",
    )
    op.squad = [...squad]
    op.arrives = this.week + INFILTRATION[op.difficulty]
    this.launched = true
    if (op.arrives === this.week) this.deploy()
  }

  /** Plays the mission of the operation whose squad has arrived. */
  deploy(): void {
    const op = this.due()
    must(this.stage === "world" && !!op, "deploy")
    this.at = op!.id
    this.stage = "mission"
  }

  /** Ends the week and moves the world on; a squad that has arrived must deploy first. */
  end(): void {
    must(this.stage === "world" && !this.due(), "week")
    this.report = []
    this.turn()
  }

  /**
   * Ends the mission in play: the dead leave, survivors gain the goal's XP (half after a loss),
   * soldiers at home gain a quarter of a win's XP, and a win pays the operation's reward.
   */
  finish(result: Result): void {
    must(this.stage === "mission", "finish")
    const op = this.op(this.at ?? -1)
    const r = this.region(op.region)
    const xp = GOALS[this.goal].xp
    const home = xp / (this.bonus("drills") ? 2 : 4)
    for (const s of this.roster) {
      if (op.squad.includes(s.id)) {
        s.hp = result.hp[s.id] ?? 0
        s.ranks = result.ranks?.[s.id] ?? s.ranks
        s.xp += result.won ? xp : xp / 2
      } else if (!this.away(s.id)) s.xp += result.won ? home : 0
    }
    const dead = this.roster.filter((s) => s.hp <= 0)
    for (const s of dead) this.note("week.dead", { name: s.name })
    this.roster = this.roster.filter((s) => s.hp > 0)
    r.vigilance = Math.min(10, r.vigilance + 1)
    this.note(result.won ? "week.won" : "week.lost", { op: op.kind, region: r.id })
    if (result.won) this.reward(op, result)
    else if (op.kind === "defend") r.resistance = Math.max(0, r.resistance - 1)
    this.ops = this.ops.filter((o) => o !== op)
    this.at = null
    if (this.freed() >= this.goal) this.stage = "won"
    else if (this.roster.length === 0) this.stage = "lost"
    else this.stage = "world"
  }

  /** Pays a won operation: Supplies by its difficulty and what its kind gives; a Relay or Captain opens Liberation. */
  private reward(op: Op, result: Result): void {
    const r = this.region(op.region)
    const d = op.difficulty
    this.supplies += 2 * d
    if (op.kind === "relay" || op.kind === "captain") r.resistance = RESISTANCE
    if (op.kind === "intel") this.intel += 2 + d
    if (op.kind === "relay") {
      this.project = Math.max(0, this.project - 2)
      this.materials += 1 + d
      r.strength = Math.max(0, r.strength - 1)
      r.site = false
    }
    if (op.kind === "captain") {
      this.materials += d
      r.strength = Math.max(0, r.strength - 2)
    }
    if (op.kind === "defend") r.vigilance = 0
    if (op.kind === "liberation") {
      r.free = true
      this.note("week.free", { region: r.id })
    }
    if (op.event && this.event?.id === op.event) {
      this.event = null
      this.note("week.eventEnds", { event: op.event })
    }
    const captive = op.captive && result.hp[op.captive.id]
    if (captive && this.roster.length < ROSTER)
      this.roster.push({ ...op.captive!, hp: Math.min(maxHp(op.captive!), captive), xp: 0, rest: 1 })
  }

  /** A new week: ignored operations pay, rest and healing, research, monthly income, the aliens' moves, new operations. */
  private turn(): void {
    const posted = this.ops.filter((o) => o.squad.length === 0)
    for (const op of posted) this.ignore(op)
    this.ops = this.ops.filter((o) => !posted.includes(o))
    this.launched = false
    this.week += 1
    for (const s of this.roster) {
      s.rest = Math.max(0, s.rest - 1)
      s.hp = Math.min(maxHp(s), s.hp + 2 + (this.bonus("healing") ? 1 : 0))
    }
    if (this.research && this.week >= this.research.ready) {
      this.techs.push(this.research.tech)
      this.note("week.research", { tech: this.research.tech })
      this.research = null
    }
    if ((this.week - 1) % 4 === 0) this.month()
    this.project += 1
    this.force = Math.min(10, 1 + Math.floor((this.week - 1) / GOALS[this.goal].pace))
    if (this.event && this.week > this.event.until) this.event = null
    this.post()
    if (this.project >= GOALS[this.goal].end) this.stage = "lost"
  }

  /** The penalty of an operation left at the week's end. */
  private ignore(op: Op): void {
    const r = this.region(op.region)
    if (!op.penalty) return
    if (op.penalty === "project") this.project += 2
    if (op.penalty === "strength") r.strength = Math.min(10, r.strength + 1)
    if (op.penalty === "resistance") r.resistance = Math.max(0, r.resistance - 1)
    this.note("week.ignored", { op: op.kind, region: r.id, penalty: op.penalty })
  }

  /** Monthly income on both sides; the aliens spend theirs on Strength, a Dark Event, and the Project. */
  private month(): void {
    const contacted = this.regions.filter((r) => r.resistance > 0 || r.free).length
    this.supplies += 10 + 2 * contacted + (this.bonus("supplies") ? 6 : 0)
    this.intel += 2 + (this.bonus("intel") ? 3 : 0)
    if (this.bonus("materials")) this.materials += 2
    if (this.bonus("recruits") && this.roster.length < ROSTER) this.roster.push(this.newcomer())
    if (this.bonus("delay")) this.project = Math.max(0, this.project - 1)
    const held = this.regions.filter((r) => !r.free)
    let points = held.length
    this.project += held.filter((r) => r.site).length
    this.spread()
    const bare = held.filter((r) => !r.site)
    if (points >= SITE_COST && bare.length > 0 && held.length - bare.length < MOST_SITES) {
      points -= SITE_COST
      const r = this.dice.pick(bare)
      r.site = true
      this.note("week.site", { region: r.id })
    }
    if (!this.event && points >= 3) {
      const id = this.dice.pick(["reinforced", "elite", "vigilant"] as const)
      this.event = { id, until: this.week + 3 }
      this.note("week.event", { event: id })
    }
  }

  /** The strongest alien region gives 1 Strength to its weakest neighbour that is weaker and not free. */
  private spread(): void {
    const held = this.regions.filter((r) => !r.free)
    const from = held.reduce<Region | null>((a, r) => (!a || r.strength > a.strength ? r : a), null)
    if (!from) return
    const to = place(from.id)
      .next.map((id) => this.region(id))
      .filter((r) => !r.free && r.strength < from.strength)
      .reduce<Region | null>((a, r) => (!a || r.strength < a.strength ? r : a), null)
    if (!to) return
    to.strength = Math.min(10, to.strength + 1)
    this.note("week.spread", { from: from.id, region: to.id })
  }

  /**
   * Posts the week's operations in regions in contact: a Defend where Vigilance is 5 or more, a Liberation where it is
   * open, then others by chance up to 3, or 2 while one region is in contact, never two of a kind in one region. A
   * Dark Event marks the first of them.
   */
  private post(): void {
    const open = this.regions.filter((r) => r.resistance > 0 && !r.free)
    if (open.length === 0) return
    for (const r of open.filter((x) => x.vigilance >= 5)) {
      this.open(r.id, "defend")
      r.vigilance = Math.max(0, r.vigilance - 3)
    }
    for (const r of open.filter((x) => x.resistance >= RESISTANCE)) this.open(r.id, "liberation")
    const posted = () => this.ops.filter((o) => o.squad.length === 0).length
    for (let tries = 0; tries < 20 && posted() < (open.length > 1 ? 3 : 2); tries++) {
      const r = this.dice.pick(open)
      const kind = this.dice.pick(r.site ? KINDS : KINDS.filter((k) => k !== "relay"))
      this.open(r.id, kind)
    }
    const marked = this.ops.find((o) => o.squad.length === 0 && o.kind !== "defend" && o.kind !== "liberation")
    if (this.event && marked) marked.event = this.event.id
  }

  /** Posts an operation of a kind in a region, unless one of that kind is there already. */
  private open(region: RegionId, kind: OpKind): void {
    if (this.ops.some((o) => o.region === region && o.kind === kind)) return
    this.made += 1
    const r = this.region(region)
    const raw =
      Math.floor(r.strength / 3) +
      (kind === "captain" || kind === "liberation" ? 1 : 0) +
      this.dice.between(0, 1) -
      (this.bonus("stealth") ? 1 : 0)
    const captive = kind === "vip" ? this.newcomer(`v${this.made}`) : undefined
    this.ops.push({
      id: this.made,
      kind,
      region,
      difficulty: Math.min(4, Math.max(1, raw)) as Difficulty,
      penalty: PENALTIES[kind] ?? this.dice.pick(["project", "strength"] as const),
      squad: [],
      scouted: false,
      ...(captive ? { captive } : {}),
    })
  }

  /** The soldier as a mission takes it in, with the gear research gave the squad. */
  private gear(s: Soldier): Recruit {
    const armor = this.techs.filter((t) => t.startsWith("armor")).length * 2
    const weapons = this.techs.filter((t) => t.startsWith("weapons")).length
    return {
      id: s.id,
      kind: s.kind,
      name: s.name,
      spread: { ...s.spread, hp: s.spread.hp + armor },
      hp: s.hp + armor,
      ranks: { ...s.ranks },
      might: weapons,
      level: level(s),
    }
  }

  private bonus(b: (typeof PLACES)[number]["bonus"]): boolean {
    return this.regions.some((r) => r.free && place(r.id).bonus === b)
  }

  private note(key: string, params: Record<string, string | number> = {}): void {
    this.report.push({ key, params })
  }

  private newcomer(id?: string): Soldier {
    const lacking = CLASSES.filter((c) => !this.roster.some((s) => s.kind === c))
    return this.soldier(this.dice.pick(lacking.length > 0 ? lacking : CLASSES), id)
  }

  private soldier(kind: ClassId, id?: string): Soldier {
    const r = this.dice
    const names = NAMES.filter((n) => !this.roster.some((s) => s.name === n))
    this.made += 1
    const spread = { hp: r.between(-1, 1), aim: r.between(-1, 1), will: r.between(-1, 1) }
    return {
      id: id ?? `s${this.made}`,
      kind,
      name: r.pick(names),
      spread,
      hp: PROFILES[kind].hp + spread.hp,
      ranks: {},
      xp: 0,
      rest: 0,
    }
  }
}

/**
 * The result of a finished mission, with each soldier's ranks: a downed soldier counts 1 HP after a win and 0 after
 * a loss, or when it was left outside the evac zone while aliens still live.
 */
export function outcome(game: Game): Result {
  const won = game.phase === "won"
  const goal = game.goal
  const clear = !game.units.some((u) => u.alive() && u.side === "enemy")
  const carried = (u: Unit) => clear || !("tiles" in goal) || goal.tiles.some((p) => same(p, u.pos))
  const hp: Record<string, number> = {}
  const ranks: Record<string, Partial<Record<AbilityId, number>>> = {}
  for (const u of game.units) {
    if (u.side !== "squad" || u.kind === "turret") continue
    hp[u.id] = u.alive() ? u.hp : won && u.down > 0 && carried(u) ? 1 : 0
    if (u.level !== undefined) ranks[u.id] = { ...u.ranks }
  }
  return { won, hp, ranks }
}

/** The most HP a soldier can have without armor. */
export const maxHp = (s: Recruit): number => PROFILES[s.kind].hp + s.spread.hp

function must(ok: boolean, what: string): void {
  if (!ok) throw new Error(`bad ${what}`)
}
