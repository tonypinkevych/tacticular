import { distance } from "./grid";
import { sees } from "./sight";
import { alive, foes } from "./units";
import type { Game, Point, Unit, WeaponId } from "./types";

/** Called after a unit enters a tile. */
export function stepped(_game: Game, _u: Unit): void {}

/** Called after an attack or a mind spell. */
export function attacked(_game: Game, _u: Unit, _t: Unit, _w: WeaponId): void {}

/** Records a noise of a radius at a point. */
export function noise(game: Game, at: Point, radius: number, _source: Unit | null): void {
  if (radius > 0) game.noises.push({ at: { ...at }, radius, round: game.round });
}

/** True when any foe sees the unit. */
export function seen(game: Game, u: Unit): boolean {
  return game.units.some((x) => alive(x) && foes(x, u) && distance(x.pos, u.pos) <= x.vision && sees(game, x, u.pos));
}
