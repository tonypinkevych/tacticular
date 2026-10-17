import { CLASSES } from "./data";
import { die, pick, random } from "./dice";
import { AROUND, distance, inside, key } from "./grid";
import { newGame } from "./game";
import { makeUnit } from "./units";
import type { Board, EnemyKind, Game, Group, Point, Tile, Unit } from "./types";

type Rng = { rng: number };

const NAMES = [
  "Aldric", "Brenna", "Corin", "Dagny", "Edric", "Fenna", "Garrick", "Hilde", "Ivo", "Jora", "Kestrel",
  "Lysa", "Merek", "Nessa", "Orrin", "Pella", "Quill", "Rhosyn", "Sorrel", "Tamsin", "Ulric", "Vela",
  "Wren", "Yarrow",
];

export const SIZE = { width: 32, height: 20 };

const START = 4;

const between = (r: Rng, lo: number, hi: number): number => lo + die(r, hi - lo + 1) - 1;

function shuffle<T>(r: Rng, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(r) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const passable = (t: Tile): boolean => t === "floor" || t === "open" || t === "bridge" || t === "door";

class Draft {
  tiles: Tile[];
  constructor(readonly width: number, readonly height: number) {
    this.tiles = new Array(width * height).fill("floor");
  }
  get(p: Point): Tile {
    return inside(this.board(), p) ? this.tiles[p.y * this.width + p.x] : "wall";
  }
  set(p: Point, t: Tile): void {
    if (inside(this.board(), p)) this.tiles[p.y * this.width + p.x] = t;
  }
  board(): Board {
    return { width: this.width, height: this.height, tiles: this.tiles };
  }
}

function river(r: Rng, d: Draft): void {
  let x = between(r, Math.floor(d.width * 0.4), Math.floor(d.width * 0.6));
  const crossings = [between(r, 2, Math.floor(d.height / 2) - 2), between(r, Math.floor(d.height / 2) + 1, d.height - 3)];
  for (let y = 0; y < d.height; y++) {
    if (y > 0 && random(r) < 0.3) x = Math.min(d.width - 8, Math.max(8, x + pick(r, [-1, 1])));
    const tile: Tile = crossings.includes(y) ? "bridge" : "water";
    d.set({ x, y }, tile);
    d.set({ x: x + 1, y }, tile);
  }
}

function building(r: Rng, d: Draft): void {
  const w = between(r, 5, 8);
  const h = between(r, 4, 6);
  for (let tries = 0; tries < 30; tries++) {
    const x0 = between(r, START + 3, d.width - w - 1);
    const y0 = between(r, 1, d.height - h - 1);
    let free = true;
    for (let y = y0 - 1; y <= y0 + h && free; y++) {
      for (let x = x0 - 1; x <= x0 + w && free; x++) if (d.get({ x, y }) !== "floor") free = false;
    }
    if (!free) continue;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        d.set({ x, y }, edge ? "wall" : "floor");
      }
    }
    const sides = shuffle(r, [
      { x: x0, y: between(r, y0 + 1, y0 + h - 2) },
      { x: x0 + w - 1, y: between(r, y0 + 1, y0 + h - 2) },
      { x: between(r, x0 + 1, x0 + w - 2), y: y0 },
      { x: between(r, x0 + 1, x0 + w - 2), y: y0 + h - 1 },
    ]);
    d.set(sides[0], "door");
    d.set(sides[1], random(r) < 0.5 ? "door" : "floor");
    if (random(r) < 0.6) d.set({ x: between(r, x0 + 1, x0 + w - 2), y: between(r, y0 + 1, y0 + h - 2) }, "low");
    return;
  }
}

function clutter(r: Rng, d: Draft): void {
  const count = Math.floor((d.width * d.height) / 22);
  for (let i = 0; i < count; i++) {
    const at = { x: between(r, 1, d.width - 2), y: between(r, 0, d.height - 1) };
    const kind = random(r);
    const tile: Tile = kind < 0.45 ? "low" : "high";
    const length = kind < 0.25 ? between(r, 2, 4) : kind < 0.8 ? 1 : 2;
    const step = pick(r, [{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    for (let j = 0; j < length; j++) {
      const p = { x: at.x + step.x * j, y: at.y + step.y * j };
      const near = AROUND.map((s) => d.get({ x: p.x + s.x, y: p.y + s.y }));
      if (d.get(p) === "floor" && !near.includes("door") && !near.includes("bridge")) d.set(p, tile);
    }
  }
}

function flood(d: Draft, from: Point): Set<number> {
  const seen = new Set([key(from)]);
  const queue = [from];
  while (queue.length > 0) {
    const p = queue.pop()!;
    for (const s of AROUND.slice(0, 4)) {
      const n = { x: p.x + s.x, y: p.y + s.y };
      if (!inside(d.board(), n) || seen.has(key(n)) || !passable(d.get(n))) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return seen;
}

function walkables(d: Draft): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) if (passable(d.get({ x, y }))) out.push({ x, y });
  return out;
}

/** Builds a map where every passable tile can be reached from the squad's start. */
export function map(r: Rng, width = SIZE.width, height = SIZE.height): Board {
  for (let attempt = 0; ; attempt++) {
    const d = new Draft(width, height);
    if (random(r) < 0.6) river(r, d);
    const houses = between(r, 2, 4);
    for (let i = 0; i < houses; i++) building(r, d);
    clutter(r, d);
    for (let y = 0; y < height; y++) for (let x = 0; x < START; x++) if (d.get({ x, y }) === "high") d.set({ x, y }, "low");
    const start = { x: 1, y: Math.floor(height / 2) };
    d.set(start, "floor");
    const all = walkables(d);
    const reached = flood(d, start);
    if (reached.size < all.length * 0.95 && attempt < 20) continue;
    for (const p of all) if (!reached.has(key(p))) d.set(p, "high");
    return d.board();
  }
}

function squad(r: Rng, board: Board, taken: Set<number>): Unit[] {
  const classes = shuffle(r, CLASSES).slice(0, 4);
  const names = shuffle(r, NAMES);
  const mid = Math.floor(board.height / 2);
  const spots = [-3, -1, 1, 3].map((dy) => free(board, { x: 1, y: mid + dy }, taken));
  return classes.map((kind, i) => makeUnit(`s${i + 1}`, kind, "squad", spots[i], names[i], null, {
    hp: between(r, -2, 2), aim: between(r, -1, 1), will: between(r, -1, 1),
  }));
}

function free(board: Board, near: Point, taken: Set<number>): Point {
  for (let radius = 0; radius < 10; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const p = { x: near.x + dx, y: near.y + dy };
        if (!inside(board, p) || taken.has(key(p))) continue;
        const t = board.tiles[p.y * board.width + p.x];
        if (t !== "floor" && t !== "bridge") continue;
        taken.add(key(p));
        return p;
      }
    }
  }
  throw new Error("no free tile");
}

const SPECIALS: EnemyKind[] = ["ogre", "assassin", "whisperer"];
const LINE: EnemyKind[] = ["orc", "orc", "orc", "bomber", "shieldwall"];

/** Kinds in one enemy group: a Warchief when 3 or more, at most one special. */
export function composition(r: Rng, size: number): EnemyKind[] {
  const out: EnemyKind[] = size >= 3 ? ["warchief"] : [];
  if (random(r) < 0.6) out.push(pick(r, SPECIALS));
  while (out.length < size) out.push(pick(r, LINE));
  return out;
}

function enemies(r: Rng, board: Board, taken: Set<number>, reachable: Point[]): { units: Unit[]; groups: Group[] } {
  const count = between(r, 3, 4);
  const field = reachable.filter((p) => p.x >= Math.floor(board.width * 0.4));
  const anchors: Point[] = [];
  for (let tries = 0; anchors.length < count && tries < 200; tries++) {
    const p = pick(r, field);
    if (anchors.every((a) => distance(a, p) >= 7)) anchors.push(p);
  }
  const units: Unit[] = [];
  const groups: Group[] = [];
  anchors.forEach((anchor, g) => {
    const id = `g${g + 1}`;
    groups.push({ id, revealed: false, target: null });
    const kinds = composition(r, between(r, 2, 4));
    const route = random(r) < 0.6 ? [anchor, pick(r, field), pick(r, field)] : [];
    for (const kind of kinds) {
      const u = makeUnit(`e${units.length + 1}`, kind, "enemy", free(board, anchor, taken), kind, id);
      u.patrol = route.map((p) => ({ ...p }));
      units.push(u);
    }
  });
  return { units, groups };
}

/** A new random mission from a seed: map, squad of 4 and 3–4 enemy groups. */
export function mission(seed: number): Game {
  const r = { rng: seed };
  const board = map(r);
  const taken = new Set<number>();
  const team = squad(r, board, taken);
  const draft = new Draft(board.width, board.height);
  draft.tiles = board.tiles;
  const reachable = [...flood(draft, team[0].pos)].map((k) => ({ x: k % 1000, y: Math.floor(k / 1000) }))
    .filter((p) => board.tiles[p.y * board.width + p.x] !== "door");
  const { units, groups } = enemies(r, board, taken, reachable);
  const game = newGame({ seed, board, units: [...team, ...units], groups });
  game.rng = r.rng;
  return game;
}
