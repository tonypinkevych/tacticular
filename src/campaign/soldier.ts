import type { AbilityId } from "../combat/abilities"
import { learnable, PROFILES } from "../units/profiles"
import type { Recruit } from "../units/unit"

/** A soldier of the campaign roster: a recruit with XP and the weeks of rest it still needs. */
export interface Soldier extends Recruit {
  xp: number
  rest: number
}

/** XP a soldier needs for each level, level 1 first. */
export const LEVELS = [0, 16, 32, 52, 72, 96, 120, 148, 176, 208, 240]

export function level(s: Soldier): number {
  return LEVELS.filter((x) => s.xp >= x).length
}

/** Rank points the soldier has not spent: one per level. */
export function points(s: Soldier): number {
  return level(s) - Object.values(s.ranks ?? {}).reduce((sum, r) => sum + (r ?? 0), 0)
}

/** The skills of the soldier's kit and the ultimate last. */
export function kit(s: Recruit): AbilityId[] {
  const p = PROFILES[s.kind]
  return [...p.abilities, ...(p.ultimate ? [p.ultimate] : [])]
}

/** True when the soldier can put a point in a skill. */
export function rankable(s: Soldier, id: AbilityId): boolean {
  return learnable(s.kind, level(s), s.ranks ?? {}, id)
}
