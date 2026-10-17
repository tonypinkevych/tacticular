import type { AbilityId, ClassId, Dice, EnemyKind, ItemId, Kind, Weapon, WeaponId } from "./types"

const d = (count: number, sides: number, bonus = 0): Dice => ({ count, sides, bonus })

export const WEAPONS: Record<WeaponId, Weapon> = {
  shotgun: { id: "shotgun", dice: d(1, 3, 3), min: 1, max: 4, melee: false, noise: 8, ammo: 3 },
  axes: { id: "axes", dice: d(1, 2, 1), min: 1, max: 4, melee: false, noise: 4, ammo: null },
  longbow: { id: "longbow", dice: d(1, 3, 4), min: 6, max: 20, melee: false, noise: 8, ammo: null, twoAp: true },
  repeater: { id: "repeater", dice: d(1, 2, 3), min: 1, max: 8, melee: false, noise: 8, ammo: 3 },
  crossbow: { id: "crossbow", dice: d(1, 2, 2), min: 1, max: 8, melee: false, noise: 8, ammo: 4 },
  knives: { id: "knives", dice: d(1, 2, 1), min: 1, max: 6, melee: false, noise: 0, ammo: null },
  bolt: { id: "bolt", dice: d(1, 2, 2), min: 1, max: 10, melee: false, noise: 8, ammo: null },
  dagger: { id: "dagger", dice: d(1, 2, 2), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  heavyCrossbow: { id: "heavyCrossbow", dice: d(1, 2, 2), min: 1, max: 10, melee: false, noise: 8, ammo: 4 },
  club: { id: "club", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null, push: true },
  spear: { id: "spear", dice: d(1, 2, 2), min: 1, max: 1, melee: true, noise: 4, ammo: null },
  blades: { id: "blades", dice: d(1, 3, 2), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  greataxe: { id: "greataxe", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null },
  javelin: { id: "javelin", dice: d(1, 2, 2), min: 1, max: 6, melee: false, noise: 4, ammo: null },
  lash: {
    id: "lash",
    dice: d(1, 2, 2),
    min: 1,
    max: 8,
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
  items: Record<ItemId, number>
  axes: number
}

const kit = (flask: number, smoke = 0): Record<ItemId, number> => ({ flask, smoke, stone: Infinity })

export const PROFILES: Record<Kind, Profile> = {
  vanguard: {
    hp: 9,
    aim: 4,
    defense: 12,
    mobility: 6,
    vision: 8,
    will: 1,
    weapon: "shotgun",
    sidearm: null,
    abilities: ["charge", "shove", "rouse"],
    items: kit(1),
    axes: 0,
  },
  ranger: {
    hp: 7,
    aim: 6,
    defense: 11,
    mobility: 5,
    vision: 9,
    will: 1,
    weapon: "longbow",
    sidearm: null,
    abilities: ["spot", "rouse"],
    items: kit(1),
    axes: 0,
  },
  warden: {
    hp: 10,
    aim: 3,
    defense: 12,
    mobility: 5,
    vision: 8,
    will: 2,
    weapon: "repeater",
    sidearm: null,
    abilities: ["volley", "bulwark", "rouse"],
    items: kit(1),
    axes: 0,
  },
  cleric: {
    hp: 8,
    aim: 3,
    defense: 11,
    mobility: 6,
    vision: 8,
    will: 3,
    weapon: "crossbow",
    sidearm: null,
    abilities: ["heal", "ward", "rally", "rouse"],
    items: kit(1),
    axes: 0,
  },
  rogue: {
    hp: 7,
    aim: 4,
    defense: 12,
    mobility: 7,
    vision: 10,
    will: 1,
    weapon: "dagger",
    sidearm: null,
    abilities: ["vanish", "rouse"],
    items: kit(1, 2),
    axes: 0,
  },
  mage: {
    hp: 6,
    aim: 4,
    defense: 10,
    mobility: 5,
    vision: 8,
    will: 4,
    weapon: "bolt",
    sidearm: null,
    abilities: ["fear", "blink", "rouse"],
    items: kit(1),
    axes: 0,
  },
  orc: {
    hp: 7,
    aim: 3,
    defense: 11,
    mobility: 5,
    vision: 8,
    will: 0,
    weapon: "heavyCrossbow",
    sidearm: null,
    abilities: [],
    items: kit(0),
    axes: 0,
  },
  bomber: {
    hp: 5,
    aim: 2,
    defense: 12,
    mobility: 6,
    vision: 8,
    will: 0,
    weapon: "dagger",
    sidearm: null,
    abilities: ["mark"],
    items: kit(Infinity),
    axes: 0,
  },
  ogre: {
    hp: 12,
    aim: 4,
    defense: 10,
    mobility: 7,
    vision: 8,
    will: -1,
    weapon: "club",
    sidearm: null,
    abilities: ["mark", "charge"],
    items: kit(0),
    axes: 0,
  },
  shieldwall: {
    hp: 9,
    aim: 2,
    defense: 14,
    mobility: 4,
    vision: 8,
    will: 1,
    weapon: "spear",
    sidearm: null,
    abilities: [],
    items: kit(0),
    axes: 0,
  },
  assassin: {
    hp: 6,
    aim: 5,
    defense: 13,
    mobility: 6,
    vision: 8,
    will: 2,
    weapon: "blades",
    sidearm: null,
    abilities: [],
    items: kit(0),
    axes: 0,
  },
  warchief: {
    hp: 10,
    aim: 4,
    defense: 13,
    mobility: 5,
    vision: 8,
    will: 2,
    weapon: "greataxe",
    sidearm: null,
    abilities: ["rally"],
    items: kit(0),
    axes: 0,
  },
  whisperer: {
    hp: 6,
    aim: 3,
    defense: 11,
    mobility: 5,
    vision: 8,
    will: 4,
    weapon: "lash",
    sidearm: null,
    abilities: ["dread", "dominate", "ward"],
    items: kit(0),
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
}

export const NOISE = { stone: 5, flask: 16 }

export const RANGE = { stone: 6, flask: 7, ward: 6, blink: 5, fear: 10, dread: 8, dominate: 8, volley: 8, rally: 6 }

export const DETECTION = { unaware: 4, investigating: 6, assassin: 3, rogue: 2 }

export const HORN = { range: 10, warchief: 16 }
