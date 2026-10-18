import type { Roll } from "./dice"
import type { AbilityId, ClassId, EnemyKind, Kind, Weapon, WeaponId } from "./types"

const d = (count: number, sides: number, bonus = 0): Roll => ({ count, sides, bonus })

export const WEAPONS: Record<WeaponId, Weapon> = {
  shotgun: { id: "shotgun", dice: d(1, 3, 3), min: 1, max: 3, melee: false, noise: 8, ammo: 3 },
  axes: { id: "axes", dice: d(1, 2, 1), min: 1, max: 4, melee: false, noise: 4, ammo: null },
  longbow: { id: "longbow", dice: d(1, 3, 4), min: 4, max: 20, melee: false, noise: 8, ammo: 3, twoAp: true },
  repeater: { id: "repeater", dice: d(1, 2, 3), min: 1, max: 6, melee: false, noise: 8, ammo: 3 },
  crossbow: { id: "crossbow", dice: d(1, 2, 3), min: 1, max: 6, melee: false, noise: 8, ammo: 4 },
  knives: { id: "knives", dice: d(1, 2, 1), min: 1, max: 4, melee: false, noise: 0, ammo: null },
  bolt: { id: "bolt", dice: d(1, 2, 2), min: 1, max: 7, melee: false, noise: 8, ammo: null, ignoresCover: true },
  dagger: { id: "dagger", dice: d(1, 2, 3), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  heavyCrossbow: { id: "heavyCrossbow", dice: d(1, 2, 2), min: 1, max: 6, melee: false, noise: 8, ammo: 4 },
  club: { id: "club", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null, push: true },
  spear: { id: "spear", dice: d(1, 2, 2), min: 1, max: 1, melee: true, noise: 4, ammo: null },
  blades: { id: "blades", dice: d(1, 3, 2), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  greataxe: { id: "greataxe", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null },
  javelin: { id: "javelin", dice: d(1, 2, 2), min: 1, max: 4, melee: false, noise: 4, ammo: null },
  none: { id: "none", dice: d(0, 1, 0), min: 1, max: 0, melee: true, noise: 0, ammo: null },
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
  ultimate: AbilityId | null
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
    abilities: ["shove", "charge"],
    ultimate: "rampage",
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
    abilities: ["grapple", "guard"],
    ultimate: "killzone",
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
    abilities: ["rocket", "volley"],
    ultimate: "saturation",
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
    abilities: ["smoke", "heal"],
    ultimate: "hospital",
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
    abilities: ["hook", "tag"],
    ultimate: "ghost",
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
    abilities: ["swap", "fear"],
    ultimate: "dominate",
    axes: 0,
  },
  engineer: {
    hp: 8,
    aim: 4,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 1,
    weapon: "crossbow",
    sidearm: null,
    abilities: ["barricade", "mine"],
    ultimate: "turret",
    axes: 0,
  },
  turret: {
    hp: 4,
    aim: 3,
    defense: 12,
    mobility: 0,
    vision: 6,
    will: 0,
    weapon: "repeater",
    sidearm: null,
    abilities: [],
    ultimate: null,
    axes: 0,
  },
  orc: {
    hp: 6,
    aim: 3,
    defense: 11,
    mobility: 4,
    vision: 6,
    will: 0,
    weapon: "heavyCrossbow",
    sidearm: null,
    abilities: [],
    ultimate: null,
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
    ultimate: null,
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
    ultimate: null,
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
    ultimate: null,
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
    ultimate: null,
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
    ultimate: null,
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
    abilities: ["dread", "dominate", "ward", "mark"],
    ultimate: null,
    axes: 0,
  },
}

export const CLASSES: ClassId[] = ["vanguard", "ranger", "warden", "cleric", "rogue", "mage", "engineer"]

export const ENEMIES: EnemyKind[] = ["orc", "bomber", "ogre", "shieldwall", "assassin", "warchief", "whisperer"]

/** A skill's cooldown in rounds and its cost: it ends the turn, costs no AP (free), or else costs 1 AP. */
export interface AbilityRule {
  cooldown: number
  endsTurn: boolean
  free?: boolean
}

export const ABILITIES: Record<AbilityId, AbilityRule> = {
  charge: { cooldown: 3, endsTurn: true },
  volley: { cooldown: 2, endsTurn: true },
  heal: { cooldown: 2, endsTurn: false },
  ward: { cooldown: 3, endsTurn: false },
  fear: { cooldown: 3, endsTurn: true },
  rouse: { cooldown: 0, endsTurn: false },
  dread: { cooldown: 3, endsTurn: true },
  dominate: { cooldown: 4, endsTurn: true },
  mark: { cooldown: 0, endsTurn: true },
  shove: { cooldown: 2, endsTurn: true },
  rally: { cooldown: 4, endsTurn: false },
  blast: { cooldown: 0, endsTurn: true },
  grapple: { cooldown: 3, endsTurn: false, free: true },
  guard: { cooldown: 2, endsTurn: false },
  rocket: { cooldown: 3, endsTurn: true },
  smoke: { cooldown: 3, endsTurn: false },
  hook: { cooldown: 3, endsTurn: false },
  tag: { cooldown: 3, endsTurn: false },
  swap: { cooldown: 3, endsTurn: false },
  barricade: { cooldown: 3, endsTurn: false },
  mine: { cooldown: 3, endsTurn: false },
  rampage: { cooldown: 0, endsTurn: true },
  killzone: { cooldown: 0, endsTurn: true },
  saturation: { cooldown: 0, endsTurn: true },
  hospital: { cooldown: 0, endsTurn: false },
  ghost: { cooldown: 0, endsTurn: false, free: true },
  turret: { cooldown: 0, endsTurn: false },
}

/** Ultimate meter: a hit adds 1, a kill 2 more; the ultimate needs it full. */
export const ULT = 4

/** How far a Grenadier blast is heard. */
export const BLAST_NOISE = 10

export const RANGE = {
  blast: 5,
  ward: 4,
  fear: 6,
  dread: 6,
  dominate: 6,
  volley: 6,
  rally: 4,
  grapple: 4,
  guard: 7,
  rocket: 6,
  smoke: 6,
  hook: 4,
  tag: 7,
  swap: 5,
  mine: 3,
  saturation: 6,
  hospital: 3,
}

/** How far a Rocket is heard. */
export const ROCKET_NOISE = 10

export const DETECTION = { unaware: 2, investigating: 4, assassin: 2, rogue: 1 }

/** How far from its target an alien group searches. */
export const SEARCH = 3

/** How far a soldier hears an alien it does not see walk. */
export const STEPS = 5

/** How far an alarm calls other alien groups. */
export const HORN = 6
