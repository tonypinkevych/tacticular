import { ABILITIES, type AbilityId, ranked, span } from "../combat/abilities"
import { WEAPONS } from "../combat/weapons"
import { area, distance, key, type Point, pointOf } from "../map/point"
import type { Game } from "../mission/game"
import { type Action, Illegal } from "../mission/orders"
import { PROFILES } from "../units/profiles"
import { ULT, type Unit } from "../units/unit"

/** A skill the unit can use now and what it is worth. */
export interface Option {
  action: Action
  value: number
  /** The part of the value that is the attack the unit can still make after the skill. */
  follow: number
}

/** Skills an alien uses only through its marked intent. */
const TELEGRAPHED: AbilityId[] = ["mark", "blast", "charge", "dominate"]

/** Skills aimed at a unit; the others are aimed at a tile or at nothing. */
const AIMED: AbilityId[] = [
  "charge",
  "rampage",
  "dominate",
  "volley",
  "heal",
  "fear",
  "dread",
  "rouse",
  "hook",
  "ward",
  "headshot",
  "backstab",
  "stasis",
]
const PLACED: AbilityId[] = ["grapple", "rocket", "mine", "saturation", "turret", "flash", "breach"]

/** Dice streams a skill is tried with when it rolls. */
const SAMPLES = 3

/** What a status on a unit is worth to its own side; a status that hurts is worth less than 0. */
const STATUS: Partial<Record<string, number>> = {
  exposed: -1,
  dominated: -5,
  burning: -1,
  poisoned: -1,
  suppressed: -1.5,
  stasis: -2,
  ward: 1,
  running: 1,
  killzone: 1.5,
}

/** What Shaken takes from a unit each round, as a share of its weapon's mean damage. */
const SHAKEN = 0.4

/** Statuses worth more on a unit the more foes see it. */
const GUARDS = ["ward"]

/**
 * The look ahead of a unit at its skills: it tries each ready skill on each target in reach on copies of the game,
 * with other dice than the game's own, and scores what changes for both sides, with the attack the unit can still
 * make after a skill that leaves it AP.
 */
export class Foresight {
  constructor(
    private readonly game: Game,
    private readonly ground: (u: Unit, p: Point) => number,
    private readonly strike: (after: Game, u: Unit) => number,
  ) {}

  /** The skill worth the most to the unit now, or null when none is legal. */
  best(u: Unit): Option | null {
    let best: Option | null = null
    for (const action of this.actions(u)) {
      const w = this.worth(u, action)
      if (w && (!best || w.value > best.value)) best = { action, ...w }
    }
    return best
  }

  /** Every skill action the unit could try now. */
  private actions(u: Unit): Action[] {
    const game = this.game
    const p = PROFILES[u.kind]
    const kit = [...p.abilities, ...(p.ultimate ? [p.ultimate] : [])].filter(
      (id) =>
        u.rank(id) > 0 &&
        !u.cooldowns[id] &&
        !ABILITIES[id].passive &&
        (u.used[id] ?? 0) < ranked(ABILITIES[id].uses ?? [Infinity], u.rank(id)) &&
        (id !== p.ultimate || u.ult >= ULT) &&
        !(u.side === "enemy" && TELEGRAPHED.includes(id)),
    )
    if (u.side === "squad" && game.units.some((x) => x.side === "squad" && x.has("dominated"))) kit.push("rouse")
    const out: Action[] = []
    for (const id of kit) {
      const reach = Math.max(span(u, id), id === "charge" || id === "rampage" ? u.mobility + 1 : 1)
      if (AIMED.includes(id)) {
        for (const t of game.units)
          if ((t.alive() || t.down > 0) && distance(u.pos, t.pos) <= reach)
            out.push({ type: "ability", unit: u.id, ability: id, target: t.id })
      } else if (PLACED.includes(id)) {
        for (const at of this.tiles(u, id)) out.push({ type: "ability", unit: u.id, ability: id, at })
      } else out.push({ type: "ability", unit: u.id, ability: id })
    }
    return out
  }

  /** Tiles worth trying for a placed skill: next to the unit, and on and around the units in its reach. */
  private tiles(u: Unit, id: AbilityId): Point[] {
    const game = this.game
    const reach = Math.max(1, span(u, id))
    const seen = new Set<number>()
    const out: Point[] = []
    const add = (p: Point) => {
      if (!game.board.inside(p) || seen.has(key(p)) || distance(u.pos, p) > reach) return
      seen.add(key(p))
      out.push(p)
    }
    for (const p of area(u.pos, 1)) add(p)
    if (id === "grapple") {
      for (const k of game.sight.tiles(u)) if (["roof", "ridge"].includes(game.tile(pointOf(k)))) add(pointOf(k))
      return out
    }
    for (const x of game.units) if (x.alive() && x !== u) for (const p of area(x.pos, 1)) add(p)
    return out
  }

  /** The mean worth of an action over a few dice streams, or null when it is not legal. */
  private worth(u: Unit, action: Action): { value: number; follow: number } | null {
    let sum = 0
    let follow = 0
    let n = 0
    for (let k = 0; k < SAMPLES; k++) {
      const trial = this.game.clone()
      trial.rng = (this.game.rng + (k + 1) * 7919) | 0
      if (!trial.reactions.includes(u.id) && (trial.phase === "squad" || trial.phase === "enemy"))
        trial.phase = u.allegiance()
      let after: Game
      try {
        after = trial.apply(action)
      } catch (e) {
        if (!(e instanceof Illegal)) throw e
        return null
      }
      const self = after.units.find((x) => x.id === u.id)
      const strike = self?.alive() && self.ap > 0 && after.phase === self.allegiance() ? this.strike(after, self) : 0
      sum += this.score(u, after) + strike
      follow += strike
      n += 1
      if (after.rng === trial.rng) break
    }
    return { value: sum / n, follow: follow / n }
  }

  /** What changed between this game and a later one, for the unit's side. */
  private score(u: Unit, after: Game): number {
    const game = this.game
    let value = 0
    for (const x of after.units) {
      const before = game.units.find((y) => y.id === x.id)
      const sign = before ? (u.foe(before) ? -1 : 1) : u.foe(x) ? -1 : 1
      if (!before) {
        value += sign * 3
        continue
      }
      let worth = (x.hp - before.hp) * (x.soldier() ? 1.5 : 1)
      if (before.alive() && !x.alive()) worth -= 4
      if (!before.alive() && before.down > 0 && x.alive()) worth += 4
      const watched = 1 + after.units.filter((f) => f.alive() && f.foe(x) && after.sight.sees(f, x.pos)).length
      for (const s of x.statuses) {
        if (s.id === "shaken" && !before.has(s.id)) worth -= SHAKEN * s.rounds * mean(x)
        else if (!before.has(s.id)) worth += (STATUS[s.id] ?? 0) * (GUARDS.includes(s.id) ? watched : 1)
      }
      for (const s of before.statuses) if (!x.has(s.id)) worth -= STATUS[s.id] ?? 0
      if (x.side === "squad" && before.concealed !== x.concealed) worth += x.concealed ? 2 : -2
      if (x === after.unit(u.id)) worth += (x.ap - Math.max(0, before.ap - 1)) * 1.5
      else if (!u.foe(before)) worth += Math.max(0, x.ap - before.ap) * 1.5
      if (x.alive()) worth += this.exposure(game, before) - this.exposure(after, x)
      value += sign * worth
    }
    const mine =
      after.zones.filter((z) => z.kind === "mine").length - game.zones.filter((z) => z.kind === "mine").length
    if (mine > 0) value += u.side === "squad" ? 1 : 0
    const self = after.units.find((x) => x.id === u.id)
    if (self?.alive()) value += this.ground(self, self.pos) - this.ground(u, u.pos)
    return value
  }

  /** How many foes see a unit with no cover against them. */
  private exposure(game: Game, x: Unit): number {
    return game.units.filter(
      (f) => f.alive() && f.foe(x) && game.sight.sees(f, x.pos) && game.cover.against(x.pos, f.pos) === 0,
    ).length
  }
}

/** The mean damage of a hit with the unit's weapon. */
function mean(u: Unit): number {
  const d = WEAPONS[u.weapon].dice
  return (d.count * (d.sides + 1)) / 2 + d.bonus
}
