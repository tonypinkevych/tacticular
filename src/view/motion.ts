import { key, reach, same } from "../rules/grid";
import { visibleToSquad } from "../rules/stealth";
import type { Entry, Game, Point } from "../rules/types";
import type { Frame } from "../play";

export const SPEEDS = [1, 2, 4, 0] as const;

export type Speed = (typeof SPEEDS)[number];

/** A short text that rises over a tile: damage, a miss, a heal, an alarm. */
export interface Float {
  text: string;
  color: string;
  at: Point;
  born: number;
}

/** What the board shows at one moment of playback. */
export interface Still {
  game: Game;
  mover: { id: string; at: Point } | null;
  shot: { from: Point; to: Point; progress: number } | null;
}

interface Clip {
  before: Game;
  frame: Frame;
  start: number;
  length: number;
  path: Point[];
}

const TILE_MS = 110;
const SHOT_MS = 420;
const STEP_MS = 260;
const FLOAT_MS = 1100;

function walkPath(before: Game, frame: Frame): Point[] {
  const a = frame.action;
  if (a.type !== "move" && !(a.type === "ability" && a.ability === "charge")) return [];
  const u = before.units.find((x) => x.id === a.unit);
  const after = frame.game.units.find((x) => x.id === a.unit);
  if (!u || !after || same(u.pos, after.pos)) return [];
  const r = reach(before, u, 400);
  const goal = a.type === "move" && r.cost.has(key(a.to)) ? a.to : after.pos;
  const path = r.path(goal);
  const stop = path.findIndex((p) => same(p, after.pos));
  return stop >= 0 ? path.slice(0, stop + 1) : [...path, after.pos];
}

function target(before: Game, frame: Frame): Point | null {
  const a = frame.action;
  if (a.type === "attack" || (a.type === "ability" && a.target && a.ability !== "charge")) {
    const t = before.units.find((x) => x.id === (a as { target: string }).target);
    return t ? t.pos : null;
  }
  if (a.type === "item" || (a.type === "ability" && a.at)) return (a as { at: Point }).at;
  return null;
}

function actor(frame: Frame): string | null {
  return frame.action.type === "endTurn" ? null : frame.action.unit;
}

/** True when the player would see this step: one of its units or tiles is in sight. */
function shown(before: Game, frame: Frame): boolean {
  const id = actor(frame);
  if (!id) return false;
  const u = before.units.find((x) => x.id === id);
  const after = frame.game.units.find((x) => x.id === id);
  if (!u || !after) return false;
  if (u.side === "squad") return true;
  return visibleToSquad(before, u) || visibleToSquad(frame.game, after);
}

/** Floating texts for the log entries a step added. */
export function floats(before: Game, after: Game, now: number): Float[] {
  const out: Float[] = [];
  const pos = (id: unknown): Point | null => after.units.find((u) => u.id === id)?.pos ?? null;
  const add = (e: Entry, text: string, color: string, who = e.params.target) => {
    const at = pos(who);
    if (at) out.push({ text, color, at, born: now });
  };
  for (const e of after.log.slice(before.log.length)) {
    const p = e.params;
    if (e.key === "log.hit" || e.key === "log.cleave" || e.key === "log.burn" || e.key === "log.lash") add(e, `-${p.dmg}`, "#ff6a5a");
    if (e.key === "log.crit") add(e, `-${p.dmg}!`, "#ffb02e");
    if (e.key === "log.miss") add(e, "✕", "#d9dde3");
    if (e.key === "log.heal") add(e, `+${p.amount}`, "#5fd35f");
    if (e.key === "log.burning") add(e, `-${p.dmg}`, "#ff8a3c", p.unit);
    if (e.key === "log.detected") add(e, "!", "#ffd84a", p.unit);
    if ((e.key === "log.fear" || e.key === "log.dread" || e.key === "log.dominate") && !p.saved) add(e, "☠", "#c38bff");
    if ((e.key === "log.fear" || e.key === "log.dread" || e.key === "log.dominate") && p.saved) add(e, "✓", "#d9dde3");
  }
  return out;
}

/** Plays frames one after another: walks, shots and rising numbers, at a chosen speed. */
export class Playback {
  private queue: { before: Game; frame: Frame }[] = [];
  private clip: Clip | null = null;
  texts: Float[] = [];

  constructor(public speed: Speed, private shownGame: Game) {}

  get busy(): boolean {
    return this.clip !== null || this.queue.length > 0;
  }

  get live(): boolean {
    return this.busy || this.texts.length > 0;
  }

  /** Queues the steps of one action, starting from the game the board shows now. */
  add(start: Game, steps: Frame[]): void {
    let before = start;
    for (const frame of steps) {
      this.queue.push({ before, frame });
      before = frame.game;
    }
  }

  /** Jumps to the end of the queue. */
  skip(now: number): Game {
    while (this.busy) this.next(now, true);
    return this.shownGame;
  }

  reset(game: Game): void {
    this.queue = [];
    this.clip = null;
    this.texts = [];
    this.shownGame = game;
  }

  private next(now: number, instant = false): void {
    if (this.clip) {
      this.texts.push(...floats(this.clip.before, this.clip.frame.game, now));
      this.shownGame = this.clip.frame.game;
      this.clip = null;
    }
    const item = this.queue.shift();
    if (!item) return;
    const { before, frame } = item;
    const path = walkPath(before, frame);
    const visible = shown(before, frame);
    const shotAt = target(before, frame);
    const scale = this.speed === 0 || instant || !visible ? 0 : 1 / this.speed;
    const length = scale * (path.length * TILE_MS + (shotAt ? SHOT_MS : 0) + STEP_MS);
    this.clip = { before, frame, start: now, length, path };
  }

  /** The picture at a moment; advances through finished steps. */
  at(now: number): Still {
    this.texts = this.texts.filter((f) => now - f.born < FLOAT_MS / Math.max(1, this.speed));
    while (this.busy && (!this.clip || now - this.clip.start >= this.clip.length)) {
      this.next(now);
      if (this.clip && this.clip.length > 0) break;
    }
    const c = this.clip;
    if (!c) return { game: this.shownGame, mover: null, shot: null };
    const id = actor(c.frame);
    const t = c.length > 0 ? (now - c.start) / c.length : 1;
    const walk = c.path.length * TILE_MS;
    const total = walk + (target(c.before, c.frame) ? SHOT_MS : 0) + STEP_MS;
    const walkEnd = walk / total;
    let mover: Still["mover"] = null;
    if (id && c.path.length > 0) {
      const u = c.before.units.find((x) => x.id === id)!;
      const steps = [u.pos, ...c.path];
      const k = Math.min(1, t / walkEnd) * (steps.length - 1);
      const i = Math.min(steps.length - 2, Math.floor(k));
      const f = k - i;
      mover = { id, at: { x: steps[i].x + (steps[i + 1].x - steps[i].x) * f, y: steps[i].y + (steps[i + 1].y - steps[i].y) * f } };
    }
    let shot: Still["shot"] = null;
    const to = target(c.before, c.frame);
    if (id && to && t >= walkEnd) {
      const from = mover?.at ?? c.before.units.find((x) => x.id === id)!.pos;
      shot = { from, to, progress: Math.min(1, (t - walkEnd) / (SHOT_MS / total)) };
    }
    return { game: c.before, mover, shot };
  }
}
