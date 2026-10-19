import { adjacent, area, distance, type Point, same } from "../map/point"
import { climb, walkable } from "../map/tile"
import type { Game } from "../mission/game"
import { check } from "../mission/orders"
import { PROFILES } from "../units/profiles"
import { type StatusId, ULT, Unit } from "../units/unit"
import { BLAST_NOISE } from "./combat"
import { EDGE, failChance } from "./dice"
import { WEAPONS } from "./weapons"

export type AbilityId =
  | "charge"
  | "volley"
  | "heal"
  | "ward"
  | "fear"
  | "rouse"
  | "dread"
  | "dominate"
  | "mark"
  | "blast"
  | "grapple"
  | "rocket"
  | "hook"
  | "mine"
  | "rampage"
  | "killzone"
  | "saturation"
  | "hospital"
  | "ghost"
  | "turret"
  | "flash"
  | "close"
  | "run"
  | "breach"
  | "squadsight"
  | "headshot"
  | "shredder"
  | "medic"
  | "shadow"
  | "backstab"
  | "mindshield"
  | "stasis"
  | "tripwire"
  | "covering"
  | "knockback"
  | "poison"
  | "warcry"

/** Statuses a Medkit and a Field hospital clear. */
export const BAD: StatusId[] = ["shaken", "burning", "exposed", "poisoned"]

/** The class abilities and ultimates units use in a game. */
export class Abilities {
  constructor(private readonly game: Game) {}

  /**
   * Uses an ability or an ultimate, with its target or its place, then spends its AP, a use and starts its cooldown.
   * An ultimate's own hits do not charge the meter again.
   */
  use(u: Unit, id: AbilityId, targetId?: string, at?: Point): void {
    const game = this.game
    const rule = ABILITIES[id]
    const ultimate = PROFILES[u.kind].ultimate === id
    check((u.rank(id) > 0 || (id === "rouse" && u.side === "squad")) && !rule.passive, "ability")
    check(!u.cooldowns[id], "cooldown")
    check((u.used[id] ?? 0) < (rule.uses ? ranked(rule.uses, u.rank(id)) : Infinity), "uses")
    if (ultimate) {
      check(u.ult >= ULT, "ult")
      u.ult = 0
    }
    const t = targetId ? game.unit(targetId) : undefined
    switch (id) {
      case "charge": {
        check(!!t && game.orders.canTarget(u, t), "target")
        const spots = game.orders.landings(u, t!)
        if (at) check(adjacent(at, t!.pos) && spots.some((p) => same(p, at)), "place")
        const spot = at ?? spots[0]
        check(!!spot, "unreachable")
        const r = game.reach(u, u.mobility)
        u.intent = null
        if (!same(spot, u.pos)) game.orders.walk(u, r.path(spot))
        if (u.alive() && t!.alive()) {
          game.combat.attack(u, t!, { bonus: power(u, id) })
          game.stealth.attacked(u, t!, u.weapon)
        }
        break
      }
      case "run": {
        u.give({ id: "running", rounds: 1 })
        game.log.push({ key: "log.run", params: { unit: u.id } })
        break
      }
      case "breach": {
        check(!!at && !same(at, u.pos), "place")
        const cone = this.cone(u, at!, span(u, id))
        game.log.push({ key: "log.breach", params: { unit: u.id } })
        for (const p of area(u.pos, span(u, id)))
          if (game.board.inside(p) && cone(p) && game.tile(p) === "low") game.combat.smash(p)
        const hits = game.units.filter((x) => x.alive() && u.foe(x) && cone(x.pos))
        for (const x of hits) {
          if (power(u, id) > 0) {
            game.log.push({ key: "log.shrapnel", params: { target: x.id, dmg: power(u, id) } })
            if (game.combat.hurt(x, power(u, id))) continue
          }
          x.give({ id: "exposed", rounds: 1, source: u.id })
        }
        game.stealth.noise(u.pos, WEAPONS[u.weapon].noise, u)
        for (const x of hits) game.stealth.attacked(u, x, u.weapon)
        break
      }
      case "headshot": {
        check(!!t && game.orders.canTarget(u, t), "target")
        check(u.ammo > 0, "ammo")
        check(game.combat.odds(u, t!).advantages.includes("flanked"), "flank")
        game.combat.attack(u, t!, { certain: true, bonus: power(u, id) })
        game.stealth.attacked(u, t!, u.weapon)
        break
      }
      case "backstab": {
        check(!!t && game.orders.canTarget(u, t) && adjacent(u.pos, t.pos), "target")
        check(u.concealed || game.combat.odds(u, t!).advantages.includes("flanked"), "flank")
        game.combat.attack(u, t!, { double: true })
        game.stealth.attacked(u, t!, u.weapon)
        break
      }
      case "volley": {
        check(!!t && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= span(u, id), "target")
        check(u.ammo > 0, "ammo")
        u.ammo -= 1
        const near = u.rank(id) >= 2 ? game.units.filter((x) => x.alive() && u.foe(x) && adjacent(x.pos, t!.pos)) : []
        for (const x of [t!, ...near]) x.give({ id: "suppressed", rounds: 1, source: u.id })
        game.log.push({ key: "log.volley", params: { unit: u.id, target: t!.id } })
        game.stealth.attacked(u, t!, u.weapon)
        break
      }
      case "heal": {
        const near = !!t && (t === u || adjacent(u.pos, t.pos) || game.sight.sees(u, t.pos))
        check(!!t && !u.foe(t) && near && distance(u.pos, t.pos) <= span(u, id) && (t.alive() || t.down > 0), "target")
        const amount = Math.min(t!.maxHp - t!.hp, game.dice.roll({ count: 1, sides: 3, bonus: power(u, id) }))
        t!.hp += amount
        t!.statuses = t!.statuses.filter((s) => !BAD.includes(s.id))
        game.log.push({ key: t!.down > 0 ? "log.revive" : "log.heal", params: { unit: u.id, target: t!.id, amount } })
        t!.down = 0
        break
      }
      case "ward": {
        check(
          !!t && !u.foe(t) && distance(u.pos, t.pos) <= span(u, "ward") && (t === u || game.sight.sees(u, t.pos)),
          "target",
        )
        const shield = { id: "ward" as const, rounds: 2, source: u.id, amount: power(u, id) }
        t!.give(shield)
        if (u.rank(id) >= 3) u.give({ ...shield })
        game.log.push({ key: "log.ward", params: { unit: u.id, target: t!.id } })
        break
      }
      case "stasis": {
        check(
          !!t && t !== u && t.alive() && distance(u.pos, t.pos) <= span(u, id) && game.sight.sees(u, t.pos),
          "target",
        )
        t!.give({ id: "stasis", rounds: u.foe(t!) ? power(u, id) : 1, source: u.id })
        t!.stance = "none"
        t!.ap = 0
        game.log.push({ key: "log.stasis", params: { unit: u.id, target: t!.id } })
        if (u.foe(t!)) game.stealth.attacked(u, t!, u.weapon)
        break
      }
      case "fear":
      case "dread":
      case "dominate": {
        check(!!t && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= span(u, id), "target")
        if (id === "dominate") check(u.foe(t!), "target")
        const edge = this.resolve(t!)
        const roll = game.dice.d20()
        const dc = 10 + u.will + (id === "fear" ? power(u, id) : 0)
        const saved = this.immune(t!) || roll + t!.will + EDGE * edge >= dc
        game.log.push({
          key: `log.${id}`,
          params: {
            unit: u.id,
            target: t!.id,
            roll,
            total: roll + t!.will + EDGE * edge,
            dc,
            saved,
            chance: this.immune(t!) ? 0 : Math.round(failChance(t!.will, dc, edge) * 100),
          },
        })
        if (id === "dominate") u.intent = null
        if (!saved && id === "dominate") {
          t!.give({ id: "dominated", rounds: power(u, id), source: u.id })
          t!.stance = "none"
          t!.ap = 0
        } else if (!saved) {
          t!.give({ id: "shaken", rounds: 2, source: u.id })
        }
        game.stealth.attacked(u, t!, u.weapon)
        break
      }
      case "rouse": {
        check(!!t && t.side === u.side && adjacent(u.pos, t.pos) && t.has("dominated"), "target")
        t!.lift("dominated")
        game.log.push({ key: "log.rouse", params: { unit: u.id, target: t!.id } })
        break
      }
      case "mark": {
        if (u.kind === "ogre" || u.kind === "whisperer") {
          check(!!t && game.orders.canTarget(u, t), "target")
          u.intent = { type: u.kind === "ogre" ? "charge" : "psi", target: t!.id }
        } else {
          check(!!at && distance(u.pos, at) <= span(u, "blast"), "place")
          u.intent = { type: "bomb", at: { ...at! } }
        }
        game.log.push({ key: "log.mark", params: { unit: u.id } })
        break
      }
      case "warcry": {
        game.log.push({ key: "log.warcry", params: { unit: u.id } })
        for (const x of game.units) {
          if (x === u || !x.alive() || u.foe(x) || distance(u.pos, x.pos) > span(u, id)) continue
          x.ap = Math.min(3, x.ap + 1)
          game.stealth.engage(x.group, game.groups.find((g) => g.id === u.group)?.target ?? u.pos)
        }
        break
      }
      case "grapple": {
        check(!!at && (game.tile(at) === "roof" || game.tile(at) === "ridge") && !game.unitAt(at), "place")
        check(distance(u.pos, at!) <= span(u, "grapple") && game.sight.line(u.pos, at!, false), "range")
        u.pos = { ...at! }
        game.log.push({ key: "log.grapple", params: { unit: u.id } })
        game.stealth.scan()
        break
      }
      case "rocket": {
        check(!!at && distance(u.pos, at) <= span(u, "rocket") && game.sight.line(u.pos, at!, false), "range")
        this.rocket(u, at!, power(u, id))
        break
      }
      case "hook": {
        check(!!t && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= span(u, "hook"), "target")
        for (let i = 0; i < power(u, id); i++) {
          const next = { x: t!.pos.x + Math.sign(u.pos.x - t!.pos.x), y: t!.pos.y + Math.sign(u.pos.y - t!.pos.y) }
          const ok = walkable(game.tile(next)) && climb(game.tile(t!.pos), game.tile(next))
          if (!ok || game.unitAt(next)) break
          t!.pos = next
        }
        t!.give({ id: "shaken", rounds: 1, source: u.id })
        game.log.push({ key: "log.hook", params: { unit: u.id, target: t!.id } })
        game.fire.scorch(t!)
        game.stealth.attacked(u, t!, "dagger")
        break
      }
      case "mine": {
        check(!!at && distance(u.pos, at) <= span(u, "mine") && game.sight.line(u.pos, at!, false), "range")
        check(walkable(game.tile(at!)) && !game.unitAt(at!), "place")
        game.zones.push({ kind: "mine", tiles: [{ ...at! }], rounds: 99, power: power(u, id) })
        game.log.push({ key: "log.plant", params: { unit: u.id } })
        break
      }
      case "rampage": {
        check(!!t && game.orders.canTarget(u, t), "target")
        let next: Unit | undefined = t
        for (let i = 0; i < power(u, id) && next && u.alive(); i++) {
          const spot = same(next.pos, u.pos) ? undefined : game.orders.landings(u, next)[0]
          if (!spot) break
          if (!same(spot, u.pos)) game.orders.walk(u, game.reach(u, u.mobility).path(spot))
          if (!u.alive() || !next.alive()) break
          game.combat.attack(u, next)
          game.stealth.attacked(u, next, u.weapon)
          if (next.alive()) break
          next = game.units
            .filter((x) => game.orders.canTarget(u, x) && game.orders.landings(u, x).length > 0)
            .sort((a, b) => distance(u.pos, a.pos) - distance(u.pos, b.pos))[0]
        }
        game.log.push({ key: "log.rampage", params: { unit: u.id } })
        break
      }
      case "killzone": {
        check(u.ammo > 0, "ammo")
        u.stance = "overwatch"
        u.give({ id: "killzone", rounds: 1 })
        game.log.push({ key: "log.killzone", params: { unit: u.id } })
        break
      }
      case "saturation": {
        check(!!at && !same(at, u.pos), "place")
        this.saturate(u, at!, power(u, id))
        break
      }
      case "hospital": {
        for (const x of game.units) {
          if (x.side !== u.side || distance(u.pos, x.pos) > span(u, "hospital") || (!x.alive() && x.down === 0))
            continue
          x.hp = Math.min(x.maxHp, x.hp + power(u, id))
          x.down = 0
          x.statuses = x.statuses.filter((s) => !BAD.includes(s.id))
        }
        game.log.push({ key: "log.hospital", params: { unit: u.id } })
        break
      }
      case "ghost": {
        u.concealed = true
        u.ap += power(u, id)
        game.log.push({ key: "log.ghost", params: { unit: u.id } })
        break
      }
      case "turret": {
        check(!!at && adjacent(u.pos, at) && walkable(game.tile(at)) && !game.unitAt(at!), "place")
        const made = `${u.id}-turret`
        game.units = game.units.filter((x) => x.id !== made)
        const turret = Unit.of(made, "turret", "squad", at!, "turret")
        turret.ap = 0
        turret.concealed = false
        turret.stance = "overwatch"
        turret.give({ id: "deployed", rounds: power(u, id) })
        game.units.push(turret)
        game.log.push({ key: "log.turret", params: { unit: u.id } })
        break
      }
      case "blast": {
        check(!!at && game.board.inside(at) && distance(u.pos, at) <= span(u, "blast"), "range")
        check(game.sight.line(u.pos, at!, false), "place")
        u.intent = null
        this.blast(u, at!, power(u, id))
        break
      }
      case "flash": {
        check(!!at && distance(u.pos, at) <= span(u, id) && game.sight.line(u.pos, at!, false), "range")
        game.log.push({ key: "log.flash", params: { unit: u.id } })
        const hits = area(at!, 1)
          .map((p) => game.unitAt(p))
          .filter((x): x is Unit => !!x && x.alive() && u.foe(x))
        for (const x of hits) x.give({ id: "shaken", rounds: power(u, id), source: u.id })
        if (u.rank(id) >= 3) for (const x of hits) x.give({ id: "exposed", rounds: 1, source: u.id })
        game.stealth.noise(at!, FLASH_NOISE, u)
        for (const x of hits) game.stealth.attacked(u, x, u.weapon)
        break
      }
    }
    if (ultimate) u.ult = 0
    if (rule.uses) u.used[id] = (u.used[id] ?? 0) + 1
    u.cooldowns[id] = ranked(rule.cooldown, u.rank(id)) || undefined
    if (rule.endsTurn) u.ap = 0
    else if (!rule.free) u.ap -= 1
  }

  /** The edge a unit has on a Will save: hunkered, or next to an ally's Mind shield. */
  resolve(t: Unit): number {
    return (t.stance === "hunker" ? 1 : 0) + (this.minded(t) ? 1 : 0)
  }

  /** True when a Mind shield at rank 3 makes the unit pass every Will save. */
  immune(t: Unit): boolean {
    return this.minded(t, 3)
  }

  /** True when the unit stands in reach of an ally's Mind shield of at least a rank. */
  private minded(t: Unit, rank = 1): boolean {
    return this.game.units.some(
      (x) => x.alive() && !x.foe(t) && x.rank("mindshield") >= rank && distance(x.pos, t.pos) <= span(x, "mindshield"),
    )
  }

  /** The tiles of a 90° cone from the unit toward a point, up to a reach. */
  private cone(u: Unit, at: Point, reach: number): (p: Point) => boolean {
    const aim = Math.atan2(at.y - u.pos.y, at.x - u.pos.x)
    return (p: Point) => {
      if (same(p, u.pos) || distance(u.pos, p) > reach) return false
      const turn = Math.abs(Math.atan2(p.y - u.pos.y, p.x - u.pos.x) - aim)
      return Math.min(turn, 2 * Math.PI - turn) <= Math.PI / 4 + 1e-9
    }
  }

  /** Saturation fire: damage to every other unit in a 90° cone up to 6 tiles toward a point, and all cover in it breaks. */
  private saturate(u: Unit, at: Point, dmg: number): void {
    const game = this.game
    const cone = this.cone(u, at, span(u, "saturation"))
    game.log.push({ key: "log.saturation", params: { unit: u.id } })
    const hits = game.units.filter((x) => x !== u && x.alive() && cone(x.pos))
    for (const p of area(u.pos, span(u, "saturation"))) if (game.board.inside(p) && cone(p)) game.combat.smash(p)
    for (const x of hits) {
      game.log.push({ key: "log.shrapnel", params: { target: x.id, dmg } })
      game.combat.hurt(x, dmg)
    }
    game.stealth.noise(u.pos, WEAPONS[u.weapon].noise, u)
    for (const x of hits) if (u.foe(x)) game.stealth.attacked(u, x, u.weapon)
  }

  /** A Rocket: damage to everyone in 3×3, pushes them out from the center, sets grass and trees on fire and breaks cover. */
  private rocket(u: Unit, at: Point, dmg: number): void {
    const game = this.game
    game.log.push({ key: "log.rocket", params: { unit: u.id } })
    const hits = area(at, 1)
      .map((p) => game.unitAt(p))
      .filter((x): x is Unit => !!x && x.alive())
    for (const p of area(at, 1)) if (game.board.inside(p) && !game.fire.ignite(p)) game.combat.smash(p)
    for (const x of hits) {
      game.log.push({ key: "log.shrapnel", params: { target: x.id, dmg } })
      if (game.combat.hurt(x, dmg) || same(x.pos, at)) continue
      game.combat.push(at, x, u.id)
    }
    game.stealth.noise(at, BLAST_NOISE, u)
    for (const x of hits) if (u.foe(x)) game.stealth.attacked(u, x, u.weapon)
  }

  /** A Grenadier blast: sure damage to everyone in 3×3; it sets them burning, sets grass and trees on fire and breaks cover. */
  blast(u: Unit, at: Point, dmg = 3): void {
    const game = this.game
    game.log.push({ key: "log.flask", params: { unit: u.id } })
    for (const p of area(at, 1)) {
      if (!game.board.inside(p)) continue
      if (!game.fire.ignite(p)) game.combat.smash(p)
      const hit = game.unitAt(p)
      if (!hit) continue
      game.log.push({ key: "log.burn", params: { target: hit.id, dmg } })
      if (!game.combat.hurt(hit, dmg)) hit.give({ id: "burning", rounds: 2 })
    }
    game.stealth.noise(at, BLAST_NOISE, u)
  }
}

/**
 * A skill's numbers by rank, first rank first; a rank past the last row takes the last. Cooldown is in rounds; uses
 * are per mission. The skill ends the turn, costs no AP (free), or else costs 1 AP; a passive is never used. Power is
 * what the rank raises: damage, rounds or AP. Perks are the ranks that add an effect of their own.
 */
export interface AbilityRule {
  cooldown: number[]
  endsTurn: boolean
  free?: boolean
  passive?: boolean
  uses?: number[]
  range?: number[]
  power?: number[]
  perks?: number[]
}

const PASSIVE = { cooldown: [0], endsTurn: false, passive: true }

export const ABILITIES: Record<AbilityId, AbilityRule> = {
  charge: { cooldown: [3, 2, 2], endsTurn: true, power: [0, 0, 1] },
  volley: { cooldown: [2], endsTurn: false, range: [6], perks: [2] },
  heal: { cooldown: [0], endsTurn: false, free: true, uses: [2, 3, 3], range: [1, 1, 3], power: [2] },
  ward: { cooldown: [3], endsTurn: false, range: [5], power: [3, 4, 4], perks: [3] },
  fear: { cooldown: [3], endsTurn: false, range: [6], power: [0, 1, 2] },
  rouse: { cooldown: [0], endsTurn: false },
  dread: { cooldown: [3], endsTurn: true, range: [6] },
  dominate: { cooldown: [4], endsTurn: true, range: [6], power: [2, 3] },
  mark: { cooldown: [0], endsTurn: true },
  blast: { cooldown: [0], endsTurn: true, range: [5], power: [3, 3, 4] },
  grapple: { cooldown: [3], endsTurn: false, free: true, range: [4, 6, 8] },
  rocket: { cooldown: [0], endsTurn: false, uses: [2, 2, 3], range: [6], power: [2, 3, 3] },
  hook: { cooldown: [3], endsTurn: false, range: [4], power: [2, 2, 3] },
  mine: { cooldown: [3], endsTurn: false, free: true, range: [3], power: [2, 3, 4] },
  rampage: { cooldown: [0], endsTurn: true, power: [3, 5] },
  killzone: { cooldown: [0], endsTurn: true, power: [0, 1] },
  saturation: { cooldown: [0], endsTurn: true, range: [6], power: [2, 3] },
  hospital: { cooldown: [0], endsTurn: false, range: [3], power: [3, 5] },
  ghost: { cooldown: [0], endsTurn: false, free: true, power: [1, 2] },
  turret: { cooldown: [0], endsTurn: false, power: [3, 5] },
  flash: { cooldown: [3, 3, 2], endsTurn: false, range: [5], power: [1, 1, 2], perks: [3] },
  close: { ...PASSIVE, power: [2, 3, 3], perks: [3] },
  run: { cooldown: [3, 3, 2], endsTurn: false, free: true },
  breach: { cooldown: [3], endsTurn: false, range: [3, 3, 4], power: [0, 2, 2] },
  squadsight: { ...PASSIVE, power: [0, 1, 2] },
  headshot: { cooldown: [3, 3, 2], endsTurn: false, power: [0, 2, 2] },
  shredder: { ...PASSIVE, power: [1, 2, 2], perks: [3] },
  medic: { ...PASSIVE, range: [1, 1, 2], power: [1, 2, 2] },
  shadow: { ...PASSIVE, power: [0, 2, 2], perks: [3] },
  backstab: { cooldown: [3, 2, 2], endsTurn: false },
  mindshield: { ...PASSIVE, range: [1, 2, 2], perks: [3] },
  stasis: { cooldown: [4], endsTurn: false, range: [6], power: [1, 1, 2] },
  tripwire: { ...PASSIVE, power: [0, 0, 1], perks: [2] },
  covering: PASSIVE,
  knockback: PASSIVE,
  poison: { ...PASSIVE, power: [3] },
  warcry: { cooldown: [0], endsTurn: false, uses: [1], range: [6] },
}

/** How far a Flash is heard. */
const FLASH_NOISE = 6

/** The value of a row at a rank: the first for rank 1 or less, the last past its end. */
export const ranked = (values: number[], rank: number): number => values[Math.min(values.length, Math.max(1, rank)) - 1]

/** How far the unit's skill reaches at its rank. */
export const span = (u: Unit, id: AbilityId): number => ranked(ABILITIES[id].range ?? [0], u.rank(id))

/** What the unit's skill does at its rank: its damage, rounds or AP. */
export const power = (u: Unit, id: AbilityId): number => ranked(ABILITIES[id].power ?? [0], u.rank(id))

/** A number of a skill that a rank raises. */
export type Stat = "cooldown" | "uses" | "range" | "power"

/** Each number of the skill that differs between the rank and the next one, now and next. */
export function growth(id: AbilityId, rank: number): { stat: Stat; now: number; next: number }[] {
  const rule = ABILITIES[id]
  return (["cooldown", "uses", "range", "power"] as const)
    .map((stat) => ({ stat, now: ranked(rule[stat] ?? [0], rank), next: ranked(rule[stat] ?? [0], rank + 1) }))
    .filter((g) => g.now !== g.next)
}
