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
    abilities: ["close", "run", "breach"],
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
    abilities: ["squadsight", "headshot", "grapple"],
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
    abilities: ["shredder", "volley", "rocket"],
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
    abilities: ["medic", "heal", "ward"],
    ultimate: "hospital",
  },
  rogue: {
    hp: 7,
    aim: 4,
    defense: 13,
    mobility: 5,
    vision: 6,
    will: 1,
    weapon: "dagger",
    abilities: ["shadow", "backstab", "hook"],
    ultimate: "ghost",
  },
  mage: {
    hp: 7,
    aim: 4,
    defense: 10,
    mobility: 4,
    vision: 6,
    will: 4,
    weapon: "bolt",
    abilities: ["mindshield", "stasis", "fear"],
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
    abilities: ["tripwire", "mine", "flash"],
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
    abilities: ["covering"],
    ultimate: null,
  },
  bomber: {
    hp: 4,
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
    hp: 9,
    aim: 4,
    defense: 10,
    mobility: 5,
    vision: 6,
    will: -1,
    weapon: "club",
    abilities: ["mark", "charge", "knockback"],
    ultimate: null,
  },
  shieldwall: {
    hp: 7,
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
    hp: 5,
    aim: 5,
    defense: 13,
    mobility: 4,
    vision: 6,
    will: 2,
    weapon: "blades",
    abilities: ["poison"],
    ultimate: null,
  },
  warchief: {
    hp: 8,
    aim: 4,
    defense: 13,
    mobility: 4,
    vision: 6,
    will: 2,
    weapon: "greataxe",
    abilities: ["warcry"],
    ultimate: null,
  },
  whisperer: {
    hp: 5,
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

/**
 * True when a unit of a kind at a level, with these ranks, can put a point in a skill: it has a point left, a basic
 * skill at rank n needs level 2n−1 and stops at 3, and the ultimate needs level 6 for rank 1 and 11 for rank 2.
 */
export function learnable(
  kind: Kind,
  level: number,
  ranks: Partial<Record<AbilityId, number>>,
  id: AbilityId,
): boolean {
  const p = PROFILES[kind]
  const spent = Object.values(ranks).reduce((sum, r) => sum + (r ?? 0), 0)
  if (level - spent <= 0 || ![...p.abilities, p.ultimate].includes(id)) return false
  const next = (ranks[id] ?? 0) + 1
  if (id === p.ultimate) return next <= 2 && level >= (next === 1 ? 6 : 11)
  return next <= 3 && level >= 2 * next - 1
}
