import type { Status } from "./unit"

export type ClassId = "vanguard" | "ranger" | "warden" | "cleric"

export type AlienId = "grunt" | "brute" | "bomber" | "commander" | FoeId

/** The aliens a mission names as its special foe. */
export type FoeId = "guard" | "sniper" | "pod"

export type Kind = ClassId | AlienId

export type SkillId = "runGun" | "headshot" | "grenade" | "medkit" | "covering" | "charge" | "blast" | "warcry"

export type Passive = "pointBlank" | "steady" | "shred" | "aid" | "shell" | "keen" | "nest"

export interface Profile {
  hp: number
  aim: number
  /** Tiles one move goes. */
  move: number
  damage: number
  /** Shot range in tiles; 0 means no shot, 1 with `melee` means claws. */
  range: number
  melee?: boolean
  /** Walks through rough ground. */
  rough?: boolean
  skill?: SkillId
  /** Turns to wait after the skill. */
  cooldown: number
  /** Skill uses a mission; null means no limit. */
  uses: number | null
  passive?: Passive
  /** The status the class's tactic puts on an alien. */
  tactic?: Status
  /** The status a hit of the class turns into a combo. */
  combo?: Status
}

const ALL = 99

export const PROFILES: Record<Kind, Profile> = {
  vanguard: {
    hp: 7,
    aim: 70,
    move: 2,
    damage: 3,
    range: 2,
    skill: "runGun",
    cooldown: 3,
    uses: null,
    passive: "pointBlank",
    tactic: "staggered",
    combo: "suppressed",
  },
  ranger: {
    hp: 5,
    aim: 80,
    move: 1,
    damage: 2,
    range: ALL,
    skill: "headshot",
    cooldown: 3,
    uses: null,
    passive: "steady",
    tactic: "marked",
    combo: "exposed",
  },
  warden: {
    hp: 7,
    aim: 65,
    move: 1,
    damage: 2,
    range: 4,
    skill: "grenade",
    cooldown: 0,
    uses: 1,
    passive: "shred",
    tactic: "suppressed",
    combo: "staggered",
  },
  cleric: {
    hp: 6,
    aim: 65,
    move: 2,
    damage: 2,
    range: 3,
    skill: "medkit",
    cooldown: 0,
    uses: 2,
    passive: "aid",
    tactic: "exposed",
    combo: "marked",
  },
  grunt: { hp: 4, aim: 85, move: 1, damage: 3, range: 4, skill: "covering", cooldown: 3, uses: null },
  brute: {
    hp: 5,
    aim: 100,
    move: 3,
    damage: 3,
    range: 1,
    melee: true,
    rough: true,
    skill: "charge",
    cooldown: 2,
    uses: null,
  },
  bomber: { hp: 2, aim: 0, move: 2, damage: 2, range: 0, skill: "blast", cooldown: 1, uses: null },
  guard: { hp: 5, aim: 70, move: 1, damage: 2, range: 3, skill: "covering", cooldown: 3, uses: null, passive: "shell" },
  sniper: { hp: 3, aim: 80, move: 1, damage: 3, range: ALL, cooldown: 0, uses: null, passive: "keen" },
  pod: { hp: 5, aim: 0, move: 0, damage: 0, range: 0, cooldown: 0, uses: null, passive: "nest" },
  commander: { hp: 6, aim: 70, move: 1, damage: 3, range: 5, skill: "warcry", cooldown: 3, uses: null },
}
