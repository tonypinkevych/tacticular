import type { AbilityId } from "../combat/abilities"
import type { WeaponId } from "../combat/weapons"

export type ClassId = "vanguard" | "ranger" | "warden" | "cleric" | "rogue" | "mage" | "engineer"

/** Squad units an Engineer deploys; they are not soldiers. */
export type Gadget = "turret"

export type EnemyKind = "orc" | "bomber" | "ogre" | "shieldwall" | "assassin" | "warchief" | "whisperer"

export type Kind = ClassId | EnemyKind | Gadget

export interface Profile {
  hp: number
  aim: number
  defense: number
  mobility: number
  vision: number
  will: number
  weapon: WeaponId
  abilities: AbilityId[]
  ultimate: AbilityId | null
}

export const PROFILES: Record<Kind, Profile> = {
  vanguard: {
    hp: 9,
    aim: 4,
    defense: 12,
    mobility: 4,
    vision: 6,
    will: 1,
    weapon: "shotgun",
    abilities: ["shove", "charge"],
    ultimate: "rampage",
  },
  ranger: {
    hp: 7,
    aim: 6,
    defense: 11,
    mobility: 3,
    vision: 7,
    will: 1,
    weapon: "longbow",
    abilities: ["grapple", "guard"],
    ultimate: "killzone",
  },
  warden: {
    hp: 10,
    aim: 3,
    defense: 12,
    mobility: 3,
    vision: 6,
    will: 2,
    weapon: "repeater",
    abilities: ["rocket", "volley"],
    ultimate: "saturation",
  },
  cleric: {
    hp: 8,
    aim: 3,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 3,
    weapon: "crossbow",
    abilities: ["smoke", "heal"],
    ultimate: "hospital",
  },
  rogue: {
    hp: 7,
    aim: 4,
    defense: 12,
    mobility: 5,
    vision: 6,
    will: 1,
    weapon: "dagger",
    abilities: ["hook", "tag"],
    ultimate: "ghost",
  },
  mage: {
    hp: 6,
    aim: 4,
    defense: 10,
    mobility: 4,
    vision: 6,
    will: 4,
    weapon: "bolt",
    abilities: ["swap", "fear"],
    ultimate: "dominate",
  },
  engineer: {
    hp: 8,
    aim: 4,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 1,
    weapon: "crossbow",
    abilities: ["barricade", "mine"],
    ultimate: "turret",
  },
  turret: {
    hp: 4,
    aim: 3,
    defense: 12,
    mobility: 0,
    vision: 6,
    will: 0,
    weapon: "repeater",
    abilities: [],
    ultimate: null,
  },
  orc: {
    hp: 6,
    aim: 3,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 0,
    weapon: "heavyCrossbow",
    abilities: [],
    ultimate: null,
  },
  bomber: {
    hp: 5,
    aim: 2,
    defense: 12,
    mobility: 4,
    vision: 6,
    will: 0,
    weapon: "dagger",
    abilities: ["mark", "blast"],
    ultimate: null,
  },
  ogre: {
    hp: 12,
    aim: 4,
    defense: 10,
    mobility: 5,
    vision: 6,
    will: -1,
    weapon: "club",
    abilities: ["mark", "charge"],
    ultimate: null,
  },
  shieldwall: {
    hp: 9,
    aim: 2,
    defense: 14,
    mobility: 3,
    vision: 6,
    will: 1,
    weapon: "spear",
    abilities: [],
    ultimate: null,
  },
  assassin: {
    hp: 6,
    aim: 5,
    defense: 13,
    mobility: 4,
    vision: 6,
    will: 2,
    weapon: "blades",
    abilities: [],
    ultimate: null,
  },
  warchief: {
    hp: 10,
    aim: 4,
    defense: 13,
    mobility: 4,
    vision: 6,
    will: 2,
    weapon: "greataxe",
    abilities: ["rally"],
    ultimate: null,
  },
  whisperer: {
    hp: 6,
    aim: 3,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 4,
    weapon: "lash",
    abilities: ["dread", "dominate", "ward", "mark"],
    ultimate: null,
  },
}

export const CLASSES: ClassId[] = ["vanguard", "ranger", "warden", "cleric", "rogue", "mage", "engineer"]
