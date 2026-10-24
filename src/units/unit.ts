import type { Point } from "../map/point"
import { type Kind, PROFILES, type Profile } from "./profiles"

export type Side = "squad" | "enemy"

/** A state a soldier's tactic puts on an alien until the next squad turn. */
export type Status = "suppressed" | "staggered" | "exposed" | "marked"

/** What a soldier gained in a run: HP, aim, and skill upgrades (a use more, or a turn less to wait). */
export interface Training {
  hp: number
  aim: number
  upgrades: number
}

const UNTRAINED: Training = { hp: 0, aim: 0, upgrades: 0 }

/** One soldier or alien on the board, with what its turn has left. */
export class Unit {
  constructor(
    readonly id: string,
    readonly kind: Kind,
    readonly side: Side,
    public at: Point,
    public hp: number,
    public ap = 2,
    public moved = false,
    public cooldown = 0,
    public uses: number | null = null,
    public overwatch = false,
    public rallied = false,
    public out = false,
    readonly extra: Training = UNTRAINED,
    public status: Status | null = null,
    /** The unit that put the status on. */
    public by: string | null = null,
    /** Hunkered down until its next turn: cover counts double and shots at it cannot crit. */
    public hunkered = false,
  ) {}

  /** A fresh unit of a kind with full HP and its skill uses. */
  static of(id: string, kind: Kind, side: Side, at: Point, extra: Training = UNTRAINED): Unit {
    const u = new Unit(id, kind, side, { ...at }, 0, 2, false, 0, null, false, false, false, extra)
    u.hp = u.profile.hp
    u.uses = u.profile.uses
    return u
  }

  /** The profile of the unit's kind with its training. */
  get profile(): Profile {
    const p = PROFILES[this.kind],
      e = this.extra
    if (e === UNTRAINED) return p
    const limited = p.uses !== null
    return {
      ...p,
      hp: p.hp + e.hp,
      aim: p.aim + e.aim,
      cooldown: limited ? p.cooldown : Math.max(1, p.cooldown - e.upgrades),
      uses: limited ? (p.uses ?? 0) + e.upgrades : null,
    }
  }

  /** Standing on the board: not dead and not gone by the evac. */
  alive(): boolean {
    return this.hp > 0 && !this.out
  }

  /** Tiles one move goes now. */
  steps(): number {
    return this.profile.move + (this.rallied ? 1 : 0)
  }

  clone(): Unit {
    return new Unit(
      this.id,
      this.kind,
      this.side,
      { ...this.at },
      this.hp,
      this.ap,
      this.moved,
      this.cooldown,
      this.uses,
      this.overwatch,
      this.rallied,
      this.out,
      this.extra,
      this.status,
      this.by,
      this.hunkered,
    )
  }
}
