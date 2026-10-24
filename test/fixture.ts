import { Board } from "../src/map/board"
import type { Point } from "../src/map/point"
import { Game } from "../src/mission/game"
import type { Kind } from "../src/units/profiles"
import { Unit } from "../src/units/unit"

export const open = (): string[] => Array.from({ length: 8 }, () => "........")

export function setup(rows: string[], units: Unit[] = [], seed = 1): Game {
  return Game.start({ seed, board: Board.parse(rows), units })
}

export const squad = (id: string, kind: Kind, at: Point): Unit => Unit.of(id, kind, "squad", at)

export const enemy = (id: string, kind: Kind, at: Point): Unit => Unit.of(id, kind, "enemy", at)

/** The same game with another state of its random stream. */
export function reseed(game: Game, rng: number): Game {
  const next = game.clone()
  next.rng = rng
  return next
}

/** A seed whose first roll in a game is below or above a percent. */
export function seedFor(game: Game, below: number, hit = true): number {
  for (let s = 1; s < 10000; s++) {
    const roll = reseed(game, s).dice.random() * 100
    if (hit ? roll < below : roll >= below) return s
  }
  throw new Error("no seed")
}
