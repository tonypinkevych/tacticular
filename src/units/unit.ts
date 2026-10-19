import type { AbilityId } from "../combat/abilities"
import { WEAPONS, type Weapon, type WeaponId } from "../combat/weapons"
import type { Point } from "../map/point"
import { climb, passable, type Tile } from "../map/tile"
import { type ClassId, type Kind, PROFILES } from "./profiles"

export type Side = "squad" | "enemy"

export type StatusId =
  | "shaken"
  | "burning"
  | "dominated"
  | "ward"
  | "exposed"
  | "killzone"
  | "deployed"
  | "captive"
  | "suppressed"
  | "stasis"
  | "poisoned"
  | "running"

export interface Status {
  id: StatusId
  rounds: number
  source?: string
  /** The damage a Shield still absorbs. */
  amount?: number
}

export type Stance = "none" | "overwatch" | "hunker"

export type Alert = "unaware" | "investigating" | "engaged"

export type Intent =
  | { type: "charge"; target: string }
  | { type: "bomb"; at: Point }
  | { type: "psi"; target: string }
  | { type: "shot"; target: string; from?: Point }

/** Ultimate meter: a hit adds 1, a kill 2 more; the ultimate needs it full. */
export const ULT = 4

/** How far a soldier's stats stray from its class profile. */
export interface Spread {
  hp: number
  aim: number
  will: number
}

/** A soldier of a run's roster, as a mission takes it in. */
export interface Recruit {
  id: string
  kind: ClassId
  name: string
  spread: Spread
  hp: number
  /** The rank of each skill; with none, every skill of the kit is at rank 1. */
  ranks?: Partial<Record<AbilityId, number>>
  /** Extra damage of its weapon. */
  might?: number
}

/** The saved fields of a unit. */
export interface UnitData {
  id: string
  kind: Kind
  side: Side
  name: string
  group: string | null
  pos: Point
  hp: number
  maxHp: number
  down: number
  aim: number
  defense: number
  mobility: number
  vision: number
  will: number
  weapon: WeaponId
  ammo: number
  ap: number
  moved: boolean
  stance: Stance
  statuses: Status[]
  cooldowns: Partial<Record<AbilityId, number>>
  /** The uses of each skill spent in this mission. */
  used: Partial<Record<AbilityId, number>>
  /** The rank of each skill; a skill at rank 0 cannot be used. */
  ranks: Partial<Record<AbilityId, number>>
  ult: number
  concealed: boolean
  alert: Alert
  patrol: Point[]
  patrolIndex: number
  intent: Intent | null
  /** True when the unit's last turn ended on overwatch or hunker. */
  waited?: boolean
  /** Extra damage of its weapon. */
  might?: number
}

/** A soldier, an alien or a gadget on the board, with its stats and its state in the fight. */
export class Unit implements UnitData {
  id!: string
  kind!: Kind
  side!: Side
  name!: string
  group!: string | null
  pos!: Point
  hp!: number
  maxHp!: number
  down!: number
  aim!: number
  defense!: number
  mobility!: number
  vision!: number
  will!: number
  weapon!: WeaponId
  ammo!: number
  ap!: number
  moved!: boolean
  stance!: Stance
  statuses!: Status[]
  cooldowns!: Partial<Record<AbilityId, number>>
  used!: Partial<Record<AbilityId, number>>
  ranks!: Partial<Record<AbilityId, number>>
  ult!: number
  concealed!: boolean
  alert!: Alert
  patrol!: Point[]
  patrolIndex!: number
  intent!: Intent | null
  waited?: boolean
  might?: number

  constructor(data: UnitData) {
    Object.assign(this, data)
  }

  /** A fresh unit of a kind, with its class profile, a spread, and its ranks or rank 1 in each skill of its kit. */
  static of(
    id: string,
    kind: Kind,
    side: Side,
    pos: Point,
    name: string,
    group: string | null = null,
    spread: Spread = { hp: 0, aim: 0, will: 0 },
    ranks?: Partial<Record<AbilityId, number>>,
  ): Unit {
    const p = PROFILES[kind]
    const kit = [...p.abilities, ...(p.ultimate ? [p.ultimate] : [])]
    return new Unit({
      id,
      kind,
      side,
      name,
      group,
      pos: { ...pos },
      hp: p.hp + spread.hp,
      maxHp: p.hp + spread.hp,
      down: 0,
      aim: p.aim + spread.aim,
      defense: p.defense,
      mobility: p.mobility,
      vision: p.vision,
      will: p.will + spread.will,
      weapon: p.weapon,
      ammo: WEAPONS[p.weapon].ammo ?? 0,
      ap: side === "squad" ? 2 : 0,
      moved: false,
      stance: "none",
      statuses: [],
      cooldowns: {},
      used: {},
      ranks: ranks ? { ...ranks } : Object.fromEntries(kit.map((a) => [a, 1])),
      ult: 0,
      concealed: side === "squad" || kind === "assassin",
      alert: "unaware",
      patrol: [],
      patrolIndex: 0,
      intent: null,
    })
  }

  alive(): boolean {
    return this.hp > 0
  }

  /** At half its HP or less: it attacks shaken and cannot dash. */
  wounded(): boolean {
    return this.alive() && this.hp * 2 <= this.maxHp
  }

  /** How far the unit can walk with the AP it has: one move when wounded. */
  stride(): number {
    return this.mobility * (this.wounded() ? Math.min(1, this.ap) : this.ap)
  }

  /** A squad member that is a soldier, not a gadget. */
  soldier(): boolean {
    return this.side === "squad" && this.kind !== "turret"
  }

  rank(id: AbilityId): number {
    return this.ranks[id] ?? 0
  }

  has(id: StatusId): boolean {
    return this.statuses.some((s) => s.id === id)
  }

  /** The side the unit fights for now: a Dominated unit fights for the other side. */
  allegiance(): Side {
    return this.has("dominated") ? (this.side === "squad" ? "enemy" : "squad") : this.side
  }

  foe(other: Unit): boolean {
    return this.allegiance() !== other.allegiance()
  }

  arms(): Weapon {
    return WEAPONS[this.weapon]
  }

  /** Adds a status, replacing one with the same id. */
  give(status: Status): void {
    this.statuses = this.statuses.filter((s) => s.id !== status.id)
    this.statuses.push(status)
  }

  lift(id: StatusId): void {
    this.statuses = this.statuses.filter((s) => s.id !== id)
  }

  /** A tile the unit can step onto: passable ground, plus trees and low cover for the Heavy and water for the Engineer. */
  enters(tile: Tile): boolean {
    if (passable(tile)) return true
    if (this.kind === "warden") return tile === "tree" || tile === "low"
    return this.kind === "engineer" && tile === "water"
  }

  /** A step the unit's class allows: the Scout climbs onto a roof from any side, the Heavy never climbs onto one. */
  climbs(from: Tile, to: Tile): boolean {
    if (this.kind === "rogue") return true
    if (this.kind === "warden") return to !== "roof" || from === "roof"
    return climb(from, to)
  }

  /** The same unit standing on another tile, for a look ahead. */
  at(pos: Point): Unit {
    const out = this.clone()
    out.pos = { ...pos }
    return out
  }

  clone(): Unit {
    return new Unit(structuredClone({ ...this }))
  }
}
