import { newGame, parseBoard } from "../src/rules/game";
import { makeUnit } from "../src/rules/units";
import type { Game, Kind, Point, Side, Unit } from "../src/rules/types";

export const open = (w = 12, h = 12): string[] => Array.from({ length: h }, () => ".".repeat(w));

export function setup(rows: string[], units: Unit[] = [], seed = 1): Game {
  const groups = [...new Set(units.map((u) => u.group).filter((g): g is string => !!g))]
    .map((id) => ({ id, revealed: false, target: null }));
  return newGame({ seed, board: parseBoard(rows), units, groups });
}

export function squad(id: string, kind: Kind, pos: Point): Unit {
  return makeUnit(id, kind, "squad", pos, id);
}

export function enemy(id: string, kind: Kind, pos: Point, alert: Unit["alert"] = "engaged", group = "g1", side: Side = "enemy"): Unit {
  const u = makeUnit(id, kind, side, pos, id, group);
  u.alert = alert;
  u.concealed = false;
  return u;
}

export function find(game: Game, id: string): Unit {
  return game.units.find((u) => u.id === id)!;
}
