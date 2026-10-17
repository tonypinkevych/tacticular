import type { Dice, Game } from "./types"

/** Next random number in [0, 1) from the game's seeded stream (mulberry32). */
export function random(game: { rng: number }): number {
  game.rng = (game.rng + 0x6d2b79f5) | 0
  let t = game.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function die(game: { rng: number }, sides: number): number {
  return 1 + Math.floor(random(game) * sides)
}

export function pick<T>(game: { rng: number }, items: readonly T[]): T {
  return items[Math.floor(random(game) * items.length)]
}

export function rollDice(game: Game, dice: Dice, times = 1): number {
  let sum = dice.bonus
  for (let i = 0; i < dice.count * times; i++) sum += die(game, dice.sides)
  return sum
}

/** What advantage adds to a roll, and disadvantage takes away. */
export const EDGE = 4

export function d20(game: Game): number {
  return die(game, 20)
}

/** Chance that d20 + bonus + edge meets the target: natural 1 misses, natural 20 hits. */
export function chance(bonus: number, target: number, edge: number): number {
  const need = Math.min(20, Math.max(2, target - bonus - EDGE * edge))
  return (21 - need) / 20
}

/** Chance that a d20 save fails, where a save has no natural-roll rules. */
export function failChance(bonus: number, target: number, edge: number): number {
  const need = Math.min(21, Math.max(1, target - bonus - EDGE * edge))
  return 1 - (21 - need) / 20
}
