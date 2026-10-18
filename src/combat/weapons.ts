import type { Roll } from "./dice"

export type WeaponId =
  | "shotgun"
  | "longbow"
  | "repeater"
  | "crossbow"
  | "bolt"
  | "dagger"
  | "heavyCrossbow"
  | "club"
  | "spear"
  | "blades"
  | "greataxe"
  | "lash"

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

const d = (count: number, sides: number, bonus = 0): Roll => ({ count, sides, bonus })

export const WEAPONS: Record<WeaponId, Weapon> = {
  shotgun: { id: "shotgun", dice: d(1, 3, 3), min: 1, max: 3, melee: false, noise: 8, ammo: 3 },
  longbow: { id: "longbow", dice: d(1, 3, 4), min: 4, max: 20, melee: false, noise: 8, ammo: 3, twoAp: true },
  repeater: { id: "repeater", dice: d(1, 2, 3), min: 1, max: 6, melee: false, noise: 8, ammo: 3 },
  crossbow: { id: "crossbow", dice: d(1, 2, 3), min: 1, max: 6, melee: false, noise: 8, ammo: 4 },
  bolt: { id: "bolt", dice: d(1, 2, 2), min: 1, max: 7, melee: false, noise: 8, ammo: null, ignoresCover: true },
  dagger: { id: "dagger", dice: d(1, 2, 3), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  heavyCrossbow: { id: "heavyCrossbow", dice: d(1, 2, 2), min: 1, max: 6, melee: false, noise: 8, ammo: 4 },
  club: { id: "club", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null, push: true },
  spear: { id: "spear", dice: d(1, 2, 2), min: 1, max: 1, melee: true, noise: 4, ammo: null },
  blades: { id: "blades", dice: d(1, 3, 2), min: 1, max: 1, melee: true, noise: 0, ammo: null },
  greataxe: { id: "greataxe", dice: d(1, 3, 3), min: 1, max: 1, melee: true, noise: 4, ammo: null },
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
