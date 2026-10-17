import type { Board, Game, Point, Tile, Unit } from "./types";

export const key = (p: Point): number => p.y * 1000 + p.x;

export const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export function inside(board: Board, p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < board.width && p.y < board.height;
}

/** Tile at a point, with Bulwark barriers counted as high cover; outside the board is wall. */
export function tileAt(game: Game, p: Point): Tile {
  if (!inside(game.board, p)) return "wall";
  for (const zone of game.zones) {
    if (zone.kind === "bulwark" && zone.tiles.some((t) => same(t, p))) return "high";
  }
  return game.board.tiles[p.y * game.board.width + p.x];
}

export const walkable = (tile: Tile): boolean => tile === "floor" || tile === "open" || tile === "bridge";

export const blocksSight = (tile: Tile): boolean => tile === "wall" || tile === "high" || tile === "door";

export function coverOf(tile: Tile): number {
  if (tile === "low") return 2;
  if (tile === "high" || tile === "wall" || tile === "door") return 5;
  return 0;
}

/** Grid distance where diagonal steps cost 1, then 2, then 1, and so on. */
export function distance(a: Point, b: Point): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
}

export const adjacent = (a: Point, b: Point): boolean =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;

export const ORTHOGONAL: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export const AROUND: Point[] = [
  ...ORTHOGONAL,
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

export const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

export function unitAt(game: Game, p: Point): Unit | undefined {
  return game.units.find((u) => u.hp > 0 && same(u.pos, p));
}

export function area(center: Point, radius: number): Point[] {
  const out: Point[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) out.push({ x, y });
  }
  return out;
}

export interface Reach {
  cost: Map<number, number>;
  path(to: Point): Point[];
}

/** Tiles a unit can walk to within a budget; allies can be passed, nobody can be stood on. */
export function reach(game: Game, unit: Unit, budget: number, side = unit.side): Reach {
  const best = new Map<number, number>();
  const prev = new Map<number, number>();
  const state = (p: Point, parity: number) => key(p) * 2 + parity;
  const point = (s: number): Point => {
    const k = Math.floor(s / 2);
    return { x: k % 1000, y: Math.floor(k / 1000) };
  };
  const buckets: number[][] = [[state(unit.pos, 0)]];
  best.set(state(unit.pos, 0), 0);
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const s of buckets[cost] ?? []) {
      if (best.get(s) !== cost) continue;
      const p = point(s);
      const parity = s % 2;
      for (const step of AROUND) {
        const next = plus(p, step);
        const diagonal = step.x !== 0 && step.y !== 0;
        if (!walkable(tileAt(game, next))) continue;
        if (diagonal && (!walkable(tileAt(game, { x: next.x, y: p.y })) || !walkable(tileAt(game, { x: p.x, y: next.y })))) continue;
        const other = unitAt(game, next);
        if (other && other.side !== side) continue;
        const nextCost = cost + (diagonal ? (parity ? 2 : 1) : 1);
        if (nextCost > budget) continue;
        const ns = state(next, diagonal ? 1 - parity : parity);
        if ((best.get(ns) ?? Infinity) <= nextCost) continue;
        best.set(ns, nextCost);
        prev.set(ns, s);
        (buckets[nextCost] ??= []).push(ns);
      }
    }
  }
  const cost = new Map<number, number>();
  const end = new Map<number, number>();
  for (const [s, c] of best) {
    const k = Math.floor(s / 2);
    if (c < (cost.get(k) ?? Infinity)) {
      cost.set(k, c);
      end.set(k, s);
    }
  }
  for (const k of [...cost.keys()]) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) };
    const other = unitAt(game, p);
    if (other && other !== unit) cost.delete(k);
  }
  return {
    cost,
    path(to: Point): Point[] {
      let s = end.get(key(to));
      const out: Point[] = [];
      while (s !== undefined && s !== state(unit.pos, 0)) {
        out.unshift(point(s));
        s = prev.get(s);
      }
      return out;
    },
  };
}
