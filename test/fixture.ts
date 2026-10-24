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
