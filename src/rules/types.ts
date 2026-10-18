import type { Roll } from "./dice"
import type { Point } from "./point"

export type Side = "squad" | "enemy"

export type ClassId = "vanguard" | "ranger" | "warden" | "cleric" | "rogue" | "mage" | "engineer"

/** Squad units an Engineer deploys; they are not soldiers. */
export type Gadget = "drone" | "turret"

export type EnemyKind = "orc" | "bomber" | "ogre" | "shieldwall" | "assassin" | "warchief" | "whisperer"

export type Kind = ClassId | EnemyKind | Gadget

export type WeaponId =
  | "shotgun"
  | "axes"
  | "longbow"
  | "repeater"
  | "crossbow"
  | "knives"
  | "bolt"
  | "dagger"
  | "heavyCrossbow"
  | "club"
  | "spear"
  | "blades"
  | "greataxe"
  | "javelin"
  | "lash"
  | "none"

export interface Weapon {
  id: WeaponId
  dice: Roll
  min: number
  max: number
  melee: boolean
  noise: number
  ammo: number | null
  twoAp?: boolean
  ignoresCover?: boolean
  saveHalf?: boolean
  push?: boolean
}

export type AbilityId =
  | "charge"
  | "volley"
  | "heal"
  | "ward"
  | "vanish"
  | "fear"
  | "blink"
  | "rouse"
  | "dread"
  | "dominate"
  | "mark"
  | "shove"
  | "rally"
  | "blast"
  | "breach"
  | "grapple"
  | "guard"
  | "steady"
  | "rocket"
  | "brace"
  | "smoke"
  | "hook"
  | "tag"
  | "swap"
  | "barricade"
  | "drone"
  | "mine"
  | "rampage"
  | "killzone"
  | "saturation"
  | "hospital"
  | "ghost"
  | "turret"

export type StatusId =
  | "suppressed"
  | "frightened"
  | "shaken"
  | "burning"
  | "dominated"
  | "ward"
  | "exposed"
  | "staggered"
  | "guarded"
  | "steady"
  | "plated"
  | "braced"
  | "killzone"
  | "deployed"

export interface Status {
  id: StatusId
  rounds: number
  source?: string
}

export type Stance = "none" | "overwatch" | "hunker"

export type Alert = "unaware" | "investigating" | "engaged"

export type Intent = { type: "charge"; target: string } | { type: "bomb"; at: Point } | { type: "psi"; target: string }

export interface Zone {
  kind: "smoke" | "fire" | "mine"
  tiles: Point[]
  rounds: number
}

export interface Group {
  id: string
  revealed: boolean
  target: Point | null
  alarmed?: boolean
  /** Where the squad landed; routes drift toward it after round 3. */
  landing?: Point
}

export interface Noise {
  at: Point
  radius: number
  round: number
}

export interface Entry {
  key: string
  params: Record<string, string | number | boolean>
}

export type Phase = "squad" | "enemy" | "won" | "lost"

/** What wins the mission besides killing every alien: reach the evac zone, or hold the beacon. */
export type Goal = { kind: "kill" } | { kind: "evac"; tiles: Point[] } | { kind: "defend"; at: Point; rounds: number }

/** Where and at the end of which round the next alien reinforcements land. */
export interface Drop {
  at: Point
  round: number
}

export type Action =
  | { type: "move"; unit: string; to: Point }
  | { type: "attack"; unit: string; target: string; weapon?: WeaponId }
  | { type: "ability"; unit: string; ability: AbilityId; target?: string; at?: Point }
  | { type: "reload"; unit: string }
  | { type: "door"; unit: string; at: Point }
  | { type: "overwatch"; unit: string }
  | { type: "hunker"; unit: string }
  | { type: "endTurn" }
