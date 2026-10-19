import type { AbilityId } from "../combat/abilities"
import { Dice } from "../combat/dice"
import { same } from "../map/point"
import type { Game } from "../mission/game"
import { type Conditions, NAMES } from "../mission/mission"
import { CLASSES, type ClassId, PROFILES } from "../units/profiles"
import type { Recruit, Unit } from "../units/unit"
import { kit, rankable, type Soldier } from "./soldier"
import { PLACES, place, type Region, type RegionId } from "./world"

/** How many regions the player must free to win. */
export type Goal = 1 | 3 | 8

/** Where a campaign stands: on the world map, in a mission, or over. */
export type Stage = "world" | "mission" | "won" | "lost"

export type Tech = "weapons2" | "weapons3" | "armor2" | "armor3"

export type OpKind = "intel" | "vip" | "relay" | "captain" | "defend" | "liberation"

/** A timed alien effect on every mission: +1 group, +2 Force Level, or +1 alarm. */
export type DarkEvent = "reinforced" | "elite" | "vigilant"

/** An operation on the world map: open until it expires; a squad sent to it infiltrates until it is launched. */
export interface Op {
  id: number
  kind: OpKind
  region: RegionId
  /** The last week it can launch. */
  expires: number
  squad: string[]
  /** The week its squad was sent. */
  sent: number | null
  scouted: boolean
  /** The Dark Event a win ends. */
  event?: DarkEvent
  captive?: Recruit
}

/** How a mission ended for the campaign: won or not, and the HP each soldier in it left with; 0 is dead. */
export interface Result {
  won: boolean
  hp: Record<string, number>
}

/** One line of the week's report. */
export interface Note {
  key: string
  params: Record<string, string | number>
}

/** One choice of the player; a campaign replays from its seed, its goal and its choices. */
export type Choice =
  | { type: "contact"; region: RegionId }
  | { type: "recruit" }
  | { type: "research"; tech: Tech }
  | { type: "rank"; soldier: string; skill: AbilityId }
  | { type: "scout"; op: number }
  | { type: "send"; op: number; squad: string[] }
  | { type: "cancel"; op: number }
  | { type: "launch"; op: number }
  | { type: "week" }
  | { type: "finish"; result: Result }

/** The pace of each goal: the Project's end, the weeks per Force Level, and the XP of a won mission. */
export const GOALS: Record<Goal, { end: number; pace: number; xp: number }> = {
  1: { end: 36, pace: 3, xp: 32 },
  3: { end: 96, pace: 5, xp: 26 },
  8: { end: 200, pace: 9, xp: 16 },
}

/** Research: its cost, the tech it needs first, and its weeks. */
export const TECHS: Record<Tech, { supplies: number; materials: number; needs?: Tech }> = {
  weapons2: { supplies: 12, materials: 4 },
  weapons3: { supplies: 20, materials: 8, needs: "weapons2" },
  armor2: { supplies: 10, materials: 4 },
  armor3: { supplies: 18, materials: 8, needs: "armor2" },
}

export const RESEARCH_WEEKS = 2
export const RECRUIT_COST = 6
export const CONTACT_COST = 4
export const SCOUT_COST = 2
export const ROSTER = 10
export const SQUAD = 4
const FEWEST = 3
const START = 6
export const RESISTANCE = 6
export const LIBERATION = 2

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
  rng: number
  private readonly dice: Dice

  constructor(
    readonly seed: number,
    readonly goal: Goal,
  ) {
    this.rng = seed
    this.dice = new Dice(this)
  }

  /** A new campaign: a home region in contact, alien Strength 5–8 elsewhere, and 6 soldiers of 6 classes. */
  static start(seed: number, goal: Goal): Campaign {
    const c = new Campaign(seed, goal)
    const home = c.dice.pick(PLACES).id
    c.regions = PLACES.map((p) => ({
      id: p.id,
      strength: p.id === home ? 4 : c.dice.between(4, 7),
      vigilance: 0,
      resistance: p.id === home ? 1 : 0,
      free: false,
    }))
    for (const kind of c.dice.shuffle(CLASSES).slice(0, START)) c.roster.push(c.soldier(kind))
    c.open(home, "intel", 3)
    c.open(home, c.dice.pick(["vip", "relay", "captain"] as const), 3)
    return c
  }

  play(choice: Choice): void {
    if (choice.type === "contact") this.contact(choice.region)
    if (choice.type === "recruit") this.recruit()
    if (choice.type === "research") this.study(choice.tech)
    if (choice.type === "rank") this.rank(choice.soldier, choice.skill)
    if (choice.type === "scout") this.scout(choice.op)
    if (choice.type === "send") this.send(choice.op, choice.squad)
    if (choice.type === "cancel") this.cancel(choice.op)
    if (choice.type === "launch") this.launch(choice.op)
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

  /** How well a squad infiltrates, 2–5: 1 plus its weeks in, plus 1 for each soldier under 4 and the South Asia bonus. */
  infiltration(squad: number, weeks: number): number {
    return Math.min(5, Math.max(2, 1 + weeks + SQUAD - squad + (this.bonus("stealth") ? 1 : 0)))
  }

  /** The infiltration a sent operation has reached this week. */
  score(op: Op): number {
    return this.infiltration(op.squad.length, this.week - (op.sent ?? this.week))
  }

  /** True when the operation's squad has been in a week or more, so it can launch. */
  launchable(op: Op): boolean {
    return op.sent !== null && this.week > op.sent
  }

  /** A ready operation at its last week, which must launch or be called back before the week ends. */
  due(): Op | null {
    return this.ops.find((o) => this.launchable(o) && this.week >= o.expires) ?? null
  }

  freed(): number {
    return this.regions.filter((r) => r.free).length
  }

  /** The mission seed of the operation in play. */
  mission(): number {
    return (Math.imul(this.seed ^ 0x9e3779b9, (this.at ?? 0) + 1) >>> 1) % 2 ** 31
  }

  /** What the operation in play holds: its goal, the squad with its gear, and aliens by Strength and infiltration. */
  conditions(): Conditions {
    const op = this.op(this.at ?? -1)
    const r = this.region(op.region)
    const score = this.score(op)
    const event = this.event?.id
    const base: Conditions = {
      squad: op.squad.map((id) => this.gear(this.roster.find((s) => s.id === id)!)),
      groups:
        Math.max(1, 1 + Math.floor(r.strength / 3) + (score <= 2 ? 1 : score >= 5 ? -1 : 0)) +
        (event === "reinforced" ? 1 : 0),
      size: r.strength >= 6 ? 3 : 2,
      alarm: (score <= 2 ? 1 : 0) + (event === "vigilant" ? 1 : 0),
      scouted: op.scouted || score >= 4,
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

  /** Spends Supplies on a new soldier of a class the roster lacks when it can. */
  recruit(): void {
    must(this.stage === "world" && this.supplies >= RECRUIT_COST && this.roster.length < ROSTER, "recruit")
    this.supplies -= RECRUIT_COST
    this.roster.push(this.newcomer())
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

  /** Spends Intel to mark the alien groups of an operation before it is sent. */
  scout(id: number): void {
    const op = this.op(id)
    must(this.stage === "world" && op.sent === null && !op.scouted && this.intel >= SCOUT_COST, "scout")
    this.intel -= SCOUT_COST
    op.scouted = true
  }

  /** Sends 3 or 4 ready soldiers to an operation before its last week; they infiltrate until it launches. */
  send(id: number, squad: string[]): void {
    const op = this.op(id)
    const ready = this.ready()
    must(this.stage === "world" && op.sent === null && this.week < op.expires, "send")
    must(squad.length >= this.fewest() && squad.length <= SQUAD && new Set(squad).size === squad.length, "squad")
    must(
      squad.every((s) => ready.some((x) => x.id === s)),
      "squad",
    )
    op.squad = [...squad]
    op.sent = this.week
  }

  /** Calls a squad back home; the operation is open again. */
  cancel(id: number): void {
    const op = this.op(id)
    must(this.stage === "world" && op.sent !== null, "cancel")
    op.squad = []
    op.sent = null
  }

  /** Plays a ready operation now. */
  launch(id: number): void {
    const op = this.op(id)
    must(this.stage === "world" && this.launchable(op), "launch")
    this.at = id
    this.stage = "mission"
  }

  /** Ends the week and moves the world on, unless a ready operation is at its last week. */
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

  private reward(op: Op, result: Result): void {
    const r = this.region(op.region)
    this.supplies += 2
    if (["intel", "vip", "relay", "captain"].includes(op.kind)) r.resistance = Math.min(RESISTANCE, r.resistance + 1)
    if (op.kind === "intel") this.intel += 4
    if (op.kind === "relay") {
      this.project = Math.max(0, this.project - 2)
      this.materials += 3
      r.strength = Math.max(0, r.strength - 1)
    }
    if (op.kind === "captain") {
      this.materials += 2
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

  /** A new week: rest and healing, research, monthly income, the aliens' moves, expiries and new operations. */
  private turn(): void {
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
    for (const op of this.ops.filter((o) => o.sent === null && o.expires < this.week)) {
      if (op.kind === "defend") {
        const r = this.region(op.region)
        r.resistance = Math.max(0, r.resistance - 1)
        this.note("week.haven", { region: r.id })
      }
    }
    this.ops = this.ops.filter((o) => o.sent !== null || o.expires >= this.week)
    this.spawn()
    if (this.project >= GOALS[this.goal].end) this.stage = "lost"
  }

  /** Monthly income on both sides; the aliens spend theirs on Strength, a Dark Event, and the Project. */
  private month(): void {
    const contacted = this.regions.filter((r) => r.resistance > 0 || r.free).length
    this.supplies += 10 + 2 * contacted + (this.bonus("supplies") ? 6 : 0)
    this.intel += 2 + (this.bonus("intel") ? 3 : 0)
    if (this.bonus("materials")) this.materials += 2
    for (let i = this.bonus("recruits") ? 2 : 1; i > 0 && this.roster.length < ROSTER; i--)
      this.roster.push(this.newcomer())
    if (this.bonus("delay")) this.project = Math.max(0, this.project - 1)
    let points = this.regions.filter((r) => !r.free).length
    const watched = this.regions.filter((r) => !r.free && r.vigilance >= 3).sort((a, b) => b.vigilance - a.vigilance)[0]
    if (watched && points >= 2) {
      points -= 2
      watched.strength = Math.min(10, watched.strength + 1)
      watched.vigilance = Math.max(0, watched.vigilance - 2)
      this.note("week.reinforced", { region: watched.id })
    }
    if (!this.event && points >= 3) {
      points -= 3
      const id = this.dice.pick(["reinforced", "elite", "vigilant"] as const)
      this.event = { id, until: this.week + 3 }
      this.note("week.event", { event: id })
      const open = this.regions.filter((r) => r.resistance > 0 && !r.free)
      if (open.length > 0) this.open(this.dice.pick(open).id, "intel", 3, id)
    }
    this.project += Math.floor(points / 2)
  }

  /** New operations in contacted regions: retaliations where Vigilance is high, Liberations, and others by chance. */
  private spawn(): void {
    for (const r of this.regions) {
      if (r.resistance === 0 || r.free) continue
      const here = this.ops.filter((o) => o.region === r.id)
      if (r.vigilance >= 5 && !here.some((o) => o.kind === "defend") && this.dice.random() < 0.5) {
        this.open(r.id, "defend", 1)
        r.vigilance = Math.max(0, r.vigilance - 3)
        continue
      }
      if (r.resistance >= RESISTANCE && r.strength <= LIBERATION && !here.some((o) => o.kind === "liberation"))
        this.open(r.id, "liberation", 4)
      else if (here.length < 2 && this.dice.random() < 0.5)
        this.open(
          r.id,
          this.dice.pick(["intel", "vip", "vip", "relay", "captain", "intel"] as const),
          this.dice.between(2, 3),
        )
    }
  }

  private open(region: RegionId, kind: OpKind, weeks: number, event?: DarkEvent): void {
    this.made += 1
    const captive = kind === "vip" ? this.newcomer(`v${this.made}`) : undefined
    this.ops.push({
      id: this.made,
      kind,
      region,
      expires: this.week + weeks,
      squad: [],
      sent: null,
      scouted: false,
      ...(event ? { event } : {}),
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

/** The most HP a soldier can have without armor. */
export const maxHp = (s: Recruit): number => PROFILES[s.kind].hp + s.spread.hp

function must(ok: boolean, what: string): void {
  if (!ok) throw new Error(`bad ${what}`)
}
