import type { AbilityId, ClassId, Dice, EnemyKind, Kind, Weapon, WeaponId } from "./types"

const d = (count: number, sides: number, bonus = 0): Dice => ({ count, sides, bonus })

export const WEAPONS: Record<WeaponId, Weapon> = {
  shotgun: { id: "shotgun", dice: d(1, 3, 3), min: 1, max: 3, melee: false, noise: 8, ammo: 3 },
  axes: { id: "axes", dice: d(1, 2, 1), min: 1, max: 4, melee: false, noise: 4, ammo: null },
  longbow: { id: "longbow", dice: d(1, 3, 4), min: 4, max: 20, melee: false, noise: 8, ammo: 3, twoAp: true },
  repeater: { id: "repeater", dice: d(1, 2, 3), min: 1, max: 6, melee: false, noise: 8, ammo: 3 },
  crossbow: { id: "crossbow", dice: d(1, 2, 2), min: 1, max: 6, melee: false, noise: 8, ammo: 4 },
  knives: { id: "knives", dice: d(1, 2, 1), min: 1, max: 4, melee: false, noise: 0, ammo: null },
  bolt: { id: "bolt", dice: d(1, 2, 2), min: 1, max: 7, melee: false, noise: 8, ammo: null },
  dagger: { id: "dagger", dice: d(1, 2, 2), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  heavyCrossbow: { id: "heavyCrossbow", dice: d(1, 2, 2), min: 1, max: 6, melee: false, noise: 8, ammo: 4 },
  club: { id: "club", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null, push: true },
  spear: { id: "spear", dice: d(1, 2, 2), min: 1, max: 1, melee: true, noise: 4, ammo: null },
  blades: { id: "blades", dice: d(1, 3, 2), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  greataxe: { id: "greataxe", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null },
  javelin: { id: "javelin", dice: d(1, 2, 2), min: 1, max: 4, melee: false, noise: 4, ammo: null },
  lash: {
    id: "lash",
    dice: d(1, 2, 2),
    min: 1,
    max: 6,
    melee: false,
    noise: 0,
    ammo: null,
    ignoresCover: true,
    saveHalf: true,
  },
}

export interface Profile {
  hp: number
  aim: number
  defense: number
  mobility: number
  vision: number
  will: number
  weapon: WeaponId
  sidearm: WeaponId | null
  abilities: AbilityId[]
  axes: number
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
    sidearm: null,
    abilities: ["charge", "shove", "rouse"],
    axes: 0,
  },
  ranger: {
    hp: 7,
    aim: 6,
    defense: 11,
    mobility: 3,
    vision: 7,
    will: 1,
    weapon: "longbow",
    sidearm: null,
    abilities: ["spot", "rouse"],
    axes: 0,
  },
  warden: {
    hp: 10,
    aim: 3,
    defense: 12,
    mobility: 3,
    vision: 6,
    will: 2,
    weapon: "repeater",
    sidearm: null,
    abilities: ["volley", "bulwark", "rouse"],
    axes: 0,
  },
  cleric: {
    hp: 8,
    aim: 3,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 3,
    weapon: "crossbow",
    sidearm: null,
    abilities: ["heal", "ward", "rally", "rouse"],
    axes: 0,
  },
  rogue: {
    hp: 7,
    aim: 4,
    defense: 12,
    mobility: 5,
    vision: 6,
    will: 1,
    weapon: "dagger",
    sidearm: null,
    abilities: ["vanish", "rouse"],
    axes: 0,
  },
  mage: {
    hp: 6,
    aim: 4,
    defense: 10,
    mobility: 4,
    vision: 6,
    will: 4,
    weapon: "bolt",
    sidearm: null,
    abilities: ["fear", "blink", "rouse"],
    axes: 0,
  },
  orc: {
    hp: 7,
    aim: 3,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 0,
    weapon: "heavyCrossbow",
    sidearm: null,
    abilities: [],
    axes: 0,
  },
  bomber: {
    hp: 5,
    aim: 2,
    defense: 12,
    mobility: 4,
    vision: 6,
    will: 0,
    weapon: "dagger",
    sidearm: null,
    abilities: ["mark", "blast"],
    axes: 0,
  },
  ogre: {
    hp: 12,
    aim: 4,
    defense: 10,
    mobility: 5,
    vision: 6,
    will: -1,
    weapon: "club",
    sidearm: null,
    abilities: ["mark", "charge"],
    axes: 0,
  },
  shieldwall: {
    hp: 9,
    aim: 2,
    defense: 14,
    mobility: 3,
    vision: 6,
    will: 1,
    weapon: "spear",
    sidearm: null,
    abilities: [],
    axes: 0,
  },
  assassin: {
    hp: 6,
    aim: 5,
    defense: 13,
    mobility: 4,
    vision: 6,
    will: 2,
    weapon: "blades",
    sidearm: null,
    abilities: [],
    axes: 0,
  },
  warchief: {
    hp: 10,
    aim: 4,
    defense: 13,
    mobility: 4,
    vision: 6,
    will: 2,
    weapon: "greataxe",
    sidearm: null,
    abilities: ["rally"],
    axes: 0,
  },
  whisperer: {
    hp: 6,
    aim: 3,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 4,
    weapon: "lash",
    sidearm: null,
    abilities: ["dread", "dominate", "ward"],
    axes: 0,
  },
}

export const CLASSES: ClassId[] = ["vanguard", "ranger", "warden", "cleric", "rogue", "mage"]

export const ENEMIES: EnemyKind[] = ["orc", "bomber", "ogre", "shieldwall", "assassin", "warchief", "whisperer"]

export interface AbilityRule {
  cooldown: number
  endsTurn: boolean
}

export const ABILITIES: Record<AbilityId, AbilityRule> = {
  charge: { cooldown: 3, endsTurn: true },
  volley: { cooldown: 2, endsTurn: true },
  bulwark: { cooldown: 4, endsTurn: false },
  heal: { cooldown: 2, endsTurn: false },
  ward: { cooldown: 3, endsTurn: false },
  vanish: { cooldown: 4, endsTurn: false },
  fear: { cooldown: 3, endsTurn: true },
  blink: { cooldown: 4, endsTurn: false },
  rouse: { cooldown: 0, endsTurn: false },
  dread: { cooldown: 3, endsTurn: true },
  dominate: { cooldown: 4, endsTurn: true },
  mark: { cooldown: 0, endsTurn: true },
  shove: { cooldown: 2, endsTurn: true },
  spot: { cooldown: 2, endsTurn: false },
  rally: { cooldown: 4, endsTurn: false },
  blast: { cooldown: 0, endsTurn: true },
}

/** How far a Grenadier blast is heard. */
export const BLAST_NOISE = 10

export const RANGE = { blast: 5, ward: 4, blink: 4, fear: 6, dread: 6, dominate: 6, volley: 6, rally: 4 }

export const DETECTION = { unaware: 2, investigating: 4, assassin: 2, rogue: 1 }

/** How far an alarm calls other alien groups. */
export const HORN = 6
