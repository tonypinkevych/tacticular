import type { Dice, Game } from "./types";

/** Next random number in [0, 1) from the game's seeded stream (mulberry32). */
export function random(game: Game): number {
  game.rng = (game.rng + 0x6d2b79f5) | 0;
  let t = game.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function die(game: Game, sides: number): number {
  return 1 + Math.floor(random(game) * sides);
}

export function pick<T>(game: Game, items: readonly T[]): T {
  return items[Math.floor(random(game) * items.length)];
}

export function rollDice(game: Game, dice: Dice, times = 1): number {
  let sum = dice.bonus;
  for (let i = 0; i < dice.count * times; i++) sum += die(game, dice.sides);
  return sum;
}

/** Edge: positive is advantage, negative is disadvantage, zero is a plain roll. */
export interface D20 {
  rolls: number[];
  kept: number;
}

export function d20(game: Game, edge: number): D20 {
  if (edge === 0) {
    const kept = die(game, 20);
    return { rolls: [kept], kept };
  }
  const rolls = [die(game, 20), die(game, 20)];
  return { rolls, kept: edge > 0 ? Math.max(...rolls) : Math.min(...rolls) };
}

/** Chance that d20 + bonus meets the target: natural 1 misses, natural 20 hits. */
export function chance(bonus: number, target: number, edge: number): number {
  const need = Math.min(20, Math.max(2, target - bonus));
  const one = (21 - need) / 20;
  if (edge > 0) return 1 - (1 - one) ** 2;
  if (edge < 0) return one ** 2;
  return one;
}

/** Chance that a d20 save fails, where a save has no natural-roll rules. */
export function failChance(bonus: number, target: number, edge: number): number {
  const need = Math.min(21, Math.max(1, target - bonus));
  const pass = (21 - need) / 20;
  const passEdge = edge > 0 ? 1 - (1 - pass) ** 2 : edge < 0 ? pass ** 2 : pass;
  return 1 - passEdge;
}
