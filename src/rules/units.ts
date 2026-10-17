import { PROFILES, WEAPONS } from "./data";
import { adjacent } from "./grid";
import type { Game, Kind, Point, Side, Status, StatusId, Unit, Weapon } from "./types";

export interface Spread {
  hp: number;
  aim: number;
  will: number;
}

export function makeUnit(
  id: string, kind: Kind, side: Side, pos: Point, name: string, group: string | null = null,
  spread: Spread = { hp: 0, aim: 0, will: 0 },
): Unit {
  const p = PROFILES[kind];
  return {
    id, kind, side, name, group, pos: { ...pos },
    hp: p.hp + spread.hp, maxHp: p.hp + spread.hp, aim: p.aim + spread.aim, defense: p.defense,
    armor: p.armor, mobility: p.mobility, vision: p.vision, will: p.will + spread.will,
    weapon: p.weapon, ammo: WEAPONS[p.weapon].ammo ?? 0, ap: side === "squad" ? 2 : 0, moved: false,
    stance: "none", statuses: [], cooldowns: {}, items: { ...p.items }, axes: p.axes,
    concealed: side === "squad" || kind === "assassin", alert: "unaware", patrol: [], patrolIndex: 0,
    intent: null,
  };
}

export const alive = (u: Unit): boolean => u.hp > 0;

export const has = (u: Unit, id: StatusId): boolean => u.statuses.some((s) => s.id === id);

/** The side a unit fights for now: a Dominated soldier fights for the enemy. */
export const sideOf = (u: Unit): Side => (has(u, "dominated") ? "enemy" : u.side);

export const foes = (a: Unit, b: Unit): boolean => sideOf(a) !== sideOf(b);

export const weaponOf = (u: Unit): Weapon => WEAPONS[u.weapon];

export function unit(game: Game, id: string): Unit {
  const u = game.units.find((x) => x.id === id);
  if (!u) throw new Error(`unknown unit ${id}`);
  return u;
}

export function addStatus(u: Unit, status: Status): void {
  u.statuses = u.statuses.filter((s) => s.id !== status.id);
  u.statuses.push(status);
}

export function removeStatus(u: Unit, id: StatusId): void {
  u.statuses = u.statuses.filter((s) => s.id !== id);
}

export function groupAim(game: Game, u: Unit): number {
  if (!u.group) return 0;
  return game.units.some((x) => alive(x) && x.kind === "warchief" && x.group === u.group) ? 1 : 0;
}

export function armorOf(game: Game, u: Unit): number {
  const wall = game.units.some(
    (x) => alive(x) && x !== u && x.kind === "shieldwall" && !foes(x, u) && adjacent(x.pos, u.pos),
  );
  return u.armor + (wall ? 1 : 0);
}
