export interface Point {
  x: number
  y: number
}

export type Tile = "floor" | "low" | "high" | "wall" | "door" | "open" | "water" | "bridge"

export interface Board {
  width: number
  height: number
  tiles: Tile[]
}

export type Side = "squad" | "enemy"

export type ClassId = "vanguard" | "ranger" | "warden" | "cleric" | "rogue" | "mage"

export type EnemyKind = "orc" | "bomber" | "ogre" | "shieldwall" | "assassin" | "warchief" | "whisperer"

export type Kind = ClassId | EnemyKind

export interface Dice {
  count: number
  sides: number
  bonus: number
}

export type WeaponId =
  | "warblade"
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

export interface Weapon {
  id: WeaponId
  dice: Dice
  min: number
  max: number
  melee: boolean
  noise: number
  ammo: number | null
  twoAp?: boolean
  ignoresArmor?: boolean
  ignoresCover?: boolean
  saveHalf?: boolean
  push?: boolean
}

export type AbilityId =
  | "charge"
  | "volley"
  | "bulwark"
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
  | "spot"
  | "rally"

export type ItemId = "flask" | "smoke" | "stone"

export type StatusId =
  | "suppressed"
  | "frightened"
  | "shaken"
  | "burning"
  | "dominated"
  | "ward"
  | "exposed"
  | "staggered"

export interface Status {
  id: StatusId
  rounds: number
  source?: string
}

export type Stance = "none" | "overwatch" | "hunker"

export type Alert = "unaware" | "investigating" | "engaged"

export type Intent = { type: "charge"; target: string } | { type: "bomb"; at: Point }

export interface Unit {
  id: string
  kind: Kind
  side: Side
  name: string
  group: string | null
  pos: Point
  hp: number
  maxHp: number
  aim: number
  defense: number
  armor: number
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
  items: Record<ItemId, number>
  axes: number
  concealed: boolean
  alert: Alert
  patrol: Point[]
  patrolIndex: number
  intent: Intent | null
}

export interface Zone {
  kind: "smoke" | "bulwark"
  tiles: Point[]
  rounds: number
}

export interface Group {
  id: string
  revealed: boolean
  target: Point | null
}

export interface Noise {
  at: Point
  radius: number
  round: number
}

export interface Ghost {
  unit: string
  at: Point
  round: number
}

export interface Entry {
  key: string
  params: Record<string, string | number | boolean>
}

export type Phase = "squad" | "enemy" | "won" | "lost"

export interface Game {
  seed: number
  rng: number
  round: number
  phase: Phase
  board: Board
  units: Unit[]
  zones: Zone[]
  groups: Group[]
  explored: boolean[]
  ghosts: Ghost[]
  noises: Noise[]
  reactions: string[]
  log: Entry[]
}

export type Action =
  | { type: "move"; unit: string; to: Point }
  | { type: "attack"; unit: string; target: string; weapon?: WeaponId }
  | { type: "ability"; unit: string; ability: AbilityId; target?: string; at?: Point }
  | { type: "item"; unit: string; item: ItemId; at: Point }
  | { type: "reload"; unit: string }
  | { type: "door"; unit: string; at: Point }
  | { type: "overwatch"; unit: string }
  | { type: "hunker"; unit: string }
  | { type: "endTurn" }
