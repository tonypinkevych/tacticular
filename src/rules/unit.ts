import { PROFILES, WEAPONS } from "./data"
import type { Point } from "./point"
import type { Tile } from "./tile"
import { climb, passable } from "./tile"
import type { AbilityId, Alert, Intent, Kind, Side, Stance, Status, StatusId, Weapon, WeaponId } from "./types"

/** How far a soldier's stats stray from its class profile. */
export interface Spread {
  hp: number
  aim: number
  will: number
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
  ult: number
  axes: number
  concealed: boolean
  alert: Alert
  patrol: Point[]
  patrolIndex: number
  intent: Intent | null
  /** True when the unit's last turn ended on overwatch or hunker. */
  waited?: boolean
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
  ult!: number
  axes!: number
  concealed!: boolean
  alert!: Alert
  patrol!: Point[]
  patrolIndex!: number
  intent!: Intent | null
  waited?: boolean

  constructor(data: UnitData) {
    Object.assign(this, data)
  }

  /** A fresh unit of a kind, with its class profile and a spread. */
  static of(
    id: string,
    kind: Kind,
    side: Side,
    pos: Point,
    name: string,
    group: string | null = null,
    spread: Spread = { hp: 0, aim: 0, will: 0 },
  ): Unit {
    const p = PROFILES[kind]
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
      ult: 0,
      axes: p.axes,
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

  /** A squad member that is a soldier, not a gadget. */
  soldier(): boolean {
    return this.side === "squad" && this.kind !== "drone" && this.kind !== "turret"
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
