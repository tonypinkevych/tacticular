import { newGame, parseBoard } from "../src/rules/game";
import { makeUnit } from "../src/rules/units";
import type { Game, Kind, Point, Side, Unit } from "../src/rules/types";

export const open = (w = 12, h = 12): string[] => Array.from({ length: h }, () => ".".repeat(w));

export function setup(rows: string[], units: Unit[] = [], seed = 1): Game {
  return newGame({ seed, board: parseBoard(rows), units });
}

export function squad(id: string, kind: Kind, pos: Point): Unit {
  return makeUnit(id, kind, "squad", pos, id);
}

export function enemy(id: string, kind: Kind, pos: Point, alert: Unit["alert"] = "engaged", side: Side = "enemy"): Unit {
  const u = makeUnit(id, kind, side, pos, id, "g1");
  u.alert = alert;
  u.concealed = false;
  return u;
}

export function find(game: Game, id: string): Unit {
  return game.units.find((u) => u.id === id)!;
}
