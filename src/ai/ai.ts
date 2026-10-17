import { canTarget } from "../rules/actions";
import { canReach, odds } from "../rules/combat";
import { coverAgainst, inCover } from "../rules/cover";
import { failChance } from "../rules/dice";
import { PROFILES, RANGE, WEAPONS } from "../rules/data";
import { area, distance, inside, key, reach, same, unitAt } from "../rules/grid";
import { lineOfSight, sees } from "../rules/sight";
import { alive, foes, sideOf } from "../rules/units";
import type { Action, Game, Point, Unit, WeaponId } from "../rules/types";

interface Choice {
  action: Action;
  value: number;
}

const average = (w: WeaponId): number => {
  const d = WEAPONS[w].dice;
  return (d.count * (d.sides + 1)) / 2 + d.bonus;
};

/** Foes the unit's side knows about: not concealed and seen by any unit of its side. */
export function known(game: Game, u: Unit): Unit[] {
  const side = game.units.filter((x) => alive(x) && sideOf(x) === sideOf(u));
  return game.units.filter((t) => alive(t) && foes(u, t) && !t.concealed && side.some((x) => sees(game, x, t.pos)));
}

function jitter(game: Game, u: Unit, p: Point): number {
  let h = (game.rng ^ (p.x * 73856093) ^ (p.y * 19349663)) + u.id.length * 83492791;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h >>> 0) % 1000) / 2000;
}

function weapons(u: Unit): WeaponId[] {
  const side = PROFILES[u.kind].sidearm;
  return side ? [u.weapon, side] : [u.weapon];
}

/** Best attack from the unit's current tile, by expected damage, kills and target value. */
function bestAttack(game: Game, u: Unit, targets: Unit[]): Choice | null {
  let best: Choice | null = null;
  for (const t of targets) {
    if (!canTarget(game, u, t)) continue;
    for (const w of weapons(u)) {
      const weapon = WEAPONS[w];
      if (!canReach(u, t, weapon)) continue;
      if (weapon.twoAp && (u.ap < 2 || u.moved)) continue;
      if (w === u.weapon && weapon.ammo !== null && u.ammo <= 0) continue;
      if (w === "axes" && u.axes <= 0) continue;
      const o = odds(game, u, t, w);
      const dmg = (o.min + o.max) / 2 || average(w);
      const value = o.chance * dmg * (dmg >= t.hp ? 2 : 1) + (t.kind === "mage" || t.kind === "cleric" ? 0.5 : 0);
      if (!best || value > best.value) best = { action: { type: "attack", unit: u.id, target: t.id, weapon: w }, value };
    }
  }
  return best;
}

/** How good a tile is to stand on: cover against known foes, attacks it opens, danger it holds. */
function tileValue(game: Game, u: Unit, p: Point, foesKnown: Unit[]): number {
  const from = u.pos;
  u.pos = p;
  let value = jitter(game, u, p);
  for (const f of foesKnown) {
    const exposed = sees(game, f, p);
    if (!exposed) continue;
    const cover = coverAgainst(game, p, f.pos);
    value += cover === 0 ? -4 : cover / 2;
    if (f.stance === "overwatch") value -= 3;
  }
  const attack = bestAttack(game, u, foesKnown);
  value += attack ? attack.value : 0;
  if (WEAPONS[u.weapon].melee && foesKnown.length > 0) {
    value -= Math.min(...foesKnown.map((f) => distance(p, f.pos))) * 0.3;
  }
  u.pos = from;
  return value;
}

function allowed(game: Game, u: Unit, p: Point): boolean {
  const fear = u.statuses.find((s) => s.id === "frightened");
  const source = fear?.source ? game.units.find((x) => x.id === fear.source && alive(x)) : undefined;
  return !source || distance(p, source.pos) >= distance(u.pos, source.pos);
}

/** Best tile within one move, or null when staying is as good. */
function bestMove(game: Game, u: Unit, score: (p: Point) => number): Choice | null {
  const r = reach(game, u, u.mobility);
  let best: Choice | null = null;
  const stay = score(u.pos);
  for (const k of r.cost.keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) };
    if (same(p, u.pos) || !allowed(game, u, p)) continue;
    const value = score(p);
    if (value > stay + 0.5 && (!best || value > best.value)) best = { action: { type: "move", unit: u.id, to: p }, value };
  }
  return best;
}

/** One move along the walking path to a goal, or to the reachable tile nearest it. */
export function toward(game: Game, u: Unit, target: Point): Action | null {
  const r = reach(game, u, 400, sideOf(u));
  let goal = target;
  if (!r.cost.has(key(goal))) {
    let best = Infinity;
    for (const k of r.cost.keys()) {
      const p = { x: k % 1000, y: Math.floor(k / 1000) };
      const d = distance(p, target);
      if (d < best) [best, goal] = [d, p];
    }
  }
  const path = r.path(goal).filter((p) => (r.cost.get(key(p)) ?? Infinity) <= u.mobility);
  const to = path.reverse().find((p) => !unitAt(game, p) && allowed(game, u, p));
  return to ? { type: "move", unit: u.id, to } : null;
}

function patrol(game: Game, u: Unit): Action | null {
  if (u.moved || u.patrol.length === 0) return null;
  const goal = u.patrol[u.patrolIndex % u.patrol.length];
  return toward(game, u, goal);
}

function ready(u: Unit, id: "dominate" | "dread" | "charge" | "mark"): boolean {
  return PROFILES[u.kind].abilities.includes(id) && !u.cooldowns[id];
}

/** Special moves of the enemy types: telegraphs, then the strike they promised. */
function special(game: Game, u: Unit, targets: Unit[]): Choice | null {
  if (u.intent?.type === "charge") {
    const t = game.units.find((x) => x.id === (u.intent as { target: string }).target);
    if (t && alive(t) && ready(u, "charge") && canTarget(game, u, t) && distance(u.pos, t.pos) <= u.mobility + 1) {
      return { action: { type: "ability", unit: u.id, ability: "charge", target: t.id }, value: 100 };
    }
  }
  if (u.intent?.type === "bomb") {
    const at = u.intent.at;
    if (distance(u.pos, at) <= RANGE.flask && lineOfSight(game, u.pos, at, false)) {
      return { action: { type: "item", unit: u.id, item: "flask", at }, value: 100 };
    }
  }
  if (u.kind === "ogre" && !u.intent && ready(u, "mark") && (u.cooldowns.charge ?? 0) <= 1) {
    const t = targets.filter((x) => canTarget(game, u, x)).sort((a, b) => distance(u.pos, a.pos) - distance(u.pos, b.pos))[0];
    if (t && distance(u.pos, t.pos) <= u.mobility * 2) {
      return { action: { type: "ability", unit: u.id, ability: "mark", target: t.id }, value: 6 };
    }
  }
  if (u.kind === "bomber" && !u.intent) {
    let best: Choice | null = null;
    for (const t of targets) {
      for (const c of area(t.pos, 1)) {
        if (!inside(game.board, c) || distance(u.pos, c) > RANGE.flask || !lineOfSight(game, u.pos, c, false)) continue;
        const hit = area(c, 1).map((p) => unitAt(game, p)).filter((x): x is Unit => !!x);
        const value = hit.filter((x) => foes(u, x)).length * 4 - hit.filter((x) => !foes(u, x)).length * 5;
        if (value > 0 && (!best || value > best.value)) best = { action: { type: "ability", unit: u.id, ability: "mark", at: c }, value };
      }
    }
    if (best) return best;
  }
  if (u.kind === "whisperer") {
    for (const id of ["dominate", "dread"] as const) {
      if (!ready(u, id)) continue;
      const t = targets
        .filter((x) => canTarget(game, u, x) && distance(u.pos, x.pos) <= RANGE[id] && (id === "dread" || x.side === "squad"))
        .sort((a, b) => b.hp - a.hp)[0];
      if (t) {
        const value = failChance(t.will, 10 + u.will, t.stance === "hunker" ? 1 : 0) * (id === "dominate" ? 12 : 5);
        return { action: { type: "ability", unit: u.id, ability: id, target: t.id }, value };
      }
    }
  }
  return null;
}

function engaged(game: Game, u: Unit): Action | null {
  const targets = known(game, u);
  const group = game.groups.find((g) => g.id === u.group);
  const sp = special(game, u, targets);
  if (sp && sp.value >= 100) return sp.action;
  if (targets.length === 0) {
    const goal = group?.target;
    if (goal && distance(u.pos, goal) > 1) return toward(game, u, goal);
    if (u.ap > 0 && (WEAPONS[u.weapon].ammo === null || u.ammo > 0)) return { type: "overwatch", unit: u.id };
    return null;
  }
  const attack = bestAttack(game, u, targets);
  const options = [attack, sp].filter((c): c is Choice => !!c);
  const now = options.sort((a, b) => b.value - a.value)[0];
  if (u.ap >= 2 || game.reactions.includes(u.id)) {
    const move = bestMove(game, u, (p) => tileValue(game, u, p, targets));
    const here = tileValue(game, u, u.pos, targets);
    const exposed = targets.some((f) => sees(game, f, u.pos) && coverAgainst(game, u.pos, f.pos) === 0);
    if (move && (move.value > here + 1 || (exposed && !now) || (exposed && (now?.value ?? 0) < 2))) return move.action;
  }
  if (now && now.value > 0.4) return now.action;
  if (WEAPONS[u.weapon].ammo !== null && u.ammo <= 0) return { type: "reload", unit: u.id };
  if (inCover(game, u.pos)) return { type: "hunker", unit: u.id };
  return { type: "overwatch", unit: u.id };
}

/** The next action of an enemy-side unit, or null when it is done for the phase. */
export function decide(game: Game, u: Unit): Action | null {
  if (!alive(u) || u.ap <= 0) return null;
  const mode = u.side === "squad" ? "engaged" : u.alert;
  if (mode === "unaware") return patrol(game, u);
  if (mode === "investigating") {
    const goal = game.groups.find((g) => g.id === u.group)?.target;
    if (!goal) return patrol(game, u);
    if (!u.moved && distance(u.pos, goal) > 1) return toward(game, u, goal);
    if (WEAPONS[u.weapon].ammo === null || u.ammo > 0) return { type: "overwatch", unit: u.id };
    return null;
  }
  return engaged(game, u);
}
