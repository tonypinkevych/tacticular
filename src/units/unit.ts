import type { Point } from "../map/point"
import { type Kind, PROFILES, type Profile } from "./profiles"

export type Side = "squad" | "enemy"

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
  ) {}

  /** A fresh unit of a kind with full HP and its skill uses. */
  static of(id: string, kind: Kind, side: Side, at: Point): Unit {
    const p = PROFILES[kind]
    return new Unit(id, kind, side, { ...at }, p.hp, 2, false, 0, p.uses)
  }

  get profile(): Profile {
    return PROFILES[this.kind]
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
    )
  }
}
