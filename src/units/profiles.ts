export type ClassId = "vanguard" | "ranger" | "warden" | "cleric"

export type AlienId = "grunt" | "brute" | "bomber" | "commander"

export type Kind = ClassId | AlienId

export type SkillId = "runGun" | "headshot" | "grenade" | "medkit" | "covering" | "charge" | "blast" | "warcry"

export type Passive = "pointBlank" | "steady" | "shred" | "aid"

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
  skill: SkillId
  /** Turns to wait after the skill. */
  cooldown: number
  /** Skill uses a mission; null means no limit. */
  uses: number | null
  passive?: Passive
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
  },
  warden: { hp: 7, aim: 65, move: 1, damage: 2, range: 4, skill: "grenade", cooldown: 0, uses: 1, passive: "shred" },
  cleric: { hp: 6, aim: 65, move: 2, damage: 2, range: 3, skill: "medkit", cooldown: 0, uses: 2, passive: "aid" },
  grunt: { hp: 3, aim: 65, move: 1, damage: 2, range: 4, skill: "covering", cooldown: 3, uses: null },
  brute: {
    hp: 5,
    aim: 100,
    move: 3,
    damage: 2,
    range: 1,
    melee: true,
    rough: true,
    skill: "charge",
    cooldown: 2,
    uses: null,
  },
  bomber: { hp: 2, aim: 0, move: 2, damage: 2, range: 0, skill: "blast", cooldown: 1, uses: null },
  commander: { hp: 8, aim: 70, move: 1, damage: 2, range: 5, skill: "warcry", cooldown: 3, uses: null },
}
