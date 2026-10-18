import { Board } from "../src/map/board"
import type { Point } from "../src/map/point"
import { Game } from "../src/mission/game"
import type { Kind } from "../src/units/profiles"
import { type Side, Unit } from "../src/units/unit"

export const open = (w = 12, h = 12): string[] => Array.from({ length: h }, () => ".".repeat(w))

export function setup(rows: string[], units: Unit[] = [], seed = 1): Game {
  const groups = [...new Set(units.map((u) => u.group).filter((g): g is string => !!g))].map((id) => ({
    id,
    revealed: false,
    target: null,
  }))
  return Game.start({ seed, board: Board.parse(rows), units, groups })
}

export function squad(id: string, kind: Kind, pos: Point): Unit {
  return Unit.of(id, kind, "squad", pos, id)
}

export function enemy(
  id: string,
  kind: Kind,
  pos: Point,
  alert: Unit["alert"] = "engaged",
  group = "g1",
  side: Side = "enemy",
): Unit {
  const u = Unit.of(id, kind, side, pos, id, group)
  u.alert = alert
  u.concealed = false
  return u
}

/** The same game with another state of its random stream. */
export function reseed(game: Game, rng: number): Game {
  const next = game.clone()
  next.rng = rng
  return next
}

export function find(game: Game, id: string): Unit {
  return game.units.find((u) => u.id === id)!
}
