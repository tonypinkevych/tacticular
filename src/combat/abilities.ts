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
  | "shove"
  | "rally"
  | "blast"
  | "grapple"
  | "guard"
  | "rocket"
  | "smoke"
  | "hook"
  | "tag"
  | "swap"
  | "barricade"
  | "mine"
  | "rampage"
  | "killzone"
  | "saturation"
  | "hospital"
  | "ghost"
  | "turret"

/** Statuses a Field hospital clears. */
const BAD: StatusId[] = ["shaken", "burning", "exposed"]

/** The class abilities and ultimates units use in a game. */
export class Abilities {
  constructor(private readonly game: Game) {}

  /** Uses an ability or an ultimate, with its target or its place, then spends its AP and starts its cooldown. */
  use(u: Unit, id: AbilityId, targetId?: string, at?: Point): void {
    const game = this.game
    const p = PROFILES[u.kind]
    const ultimate = p.ultimate === id
    check(p.abilities.includes(id) || ultimate || (id === "rouse" && u.side === "squad"), "ability")
    check(!u.cooldowns[id], "cooldown")
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
          game.combat.attack(u, t!)
          game.stealth.attacked(u, t!, u.weapon)
        }
        break
      }
      case "shove": {
        check(!!t && u.foe(t) && adjacent(u.pos, t.pos), "target")
        game.combat.push(u.pos, t!, u.id)
        game.log.push({ key: "log.shove", params: { unit: u.id, target: t!.id } })
        game.stealth.attacked(u, t!, u.weapon)
        break
      }
      case "rally": {
        check(
          !!t && t !== u && !u.foe(t) && distance(u.pos, t.pos) <= RANGE.rally && game.sight.sees(u, t.pos),
          "target",
        )
        t!.ap = Math.min(3, t!.ap + 1)
        game.log.push({ key: "log.rally", params: { unit: u.id, target: t!.id } })
        break
      }
      case "volley": {
        check(!!t && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= RANGE.volley, "target")
        check(u.ammo >= 2, "ammo")
        u.ammo -= 2
        t!.give({ id: "shaken", rounds: 2, source: u.id })
        game.log.push({ key: "log.volley", params: { unit: u.id, target: t!.id } })
        game.stealth.noise(u.pos, WEAPONS[u.weapon].noise, u)
        break
      }
      case "heal": {
        check(!!t && !u.foe(t) && (t === u || adjacent(u.pos, t.pos)) && (t.alive() || t.down > 0), "target")
        const amount = Math.min(t!.maxHp - t!.hp, game.dice.roll({ count: 1, sides: 3, bonus: 2 }))
        t!.hp += amount
        game.log.push({ key: t!.down > 0 ? "log.revive" : "log.heal", params: { unit: u.id, target: t!.id, amount } })
        t!.down = 0
        break
      }
      case "ward": {
        check(
          !!t && !u.foe(t) && distance(u.pos, t.pos) <= RANGE.ward && (t === u || game.sight.sees(u, t.pos)),
          "target",
        )
        t!.give({ id: "ward", rounds: 2, source: u.id })
        game.log.push({ key: "log.ward", params: { unit: u.id, target: t!.id } })
        break
      }
      case "fear":
      case "dread":
      case "dominate": {
        check(!!t && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= RANGE[id], "target")
        if (id === "dominate") check(u.foe(t!), "target")
        const edge = t!.stance === "hunker" ? 1 : 0
        const roll = game.dice.d20()
        const dc = 10 + u.will
        const saved = roll + t!.will + EDGE * edge >= dc
        game.log.push({
          key: `log.${id}`,
          params: {
            unit: u.id,
            target: t!.id,
            roll,
            total: roll + t!.will + EDGE * edge,
            dc,
            saved,
            chance: Math.round(failChance(t!.will, dc, edge) * 100),
          },
        })
        if (id === "dominate") u.intent = null
        if (!saved && id === "dominate") {
          t!.give({ id: "dominated", rounds: 2, source: u.id })
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
          check(!!at && distance(u.pos, at) <= RANGE.blast, "place")
          u.intent = { type: "bomb", at: { ...at! } }
        }
        game.log.push({ key: "log.mark", params: { unit: u.id } })
        break
      }
      case "grapple": {
        check(!!at && (game.tile(at) === "roof" || game.tile(at) === "ridge") && !game.unitAt(at), "place")
        check(distance(u.pos, at!) <= RANGE.grapple && game.sight.line(u.pos, at!, false), "range")
        u.pos = { ...at! }
        game.log.push({ key: "log.grapple", params: { unit: u.id } })
        game.stealth.scan()
        break
      }
      case "guard": {
        check(
          !!t && t !== u && !u.foe(t) && distance(u.pos, t.pos) <= RANGE.guard && game.sight.sees(u, t.pos),
          "target",
        )
        t!.give({ id: "guarded", rounds: 1, source: u.id })
        game.log.push({ key: "log.guard", params: { unit: u.id, target: t!.id } })
        break
      }
      case "rocket": {
        check(!!at && distance(u.pos, at) <= RANGE.rocket && game.sight.line(u.pos, at!, false), "range")
        this.rocket(u, at!)
        break
      }
      case "smoke": {
        check(!!at && distance(u.pos, at) <= RANGE.smoke && game.sight.line(u.pos, at!, false), "range")
        game.zones.push({ kind: "smoke", tiles: area(at!, 1).filter((p) => game.board.inside(p)), rounds: 2 })
        game.log.push({ key: "log.smoke", params: { unit: u.id } })
        break
      }
      case "hook": {
        check(!!t && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= RANGE.hook, "target")
        for (let i = 0; i < 2; i++) {
          const next = { x: t!.pos.x + Math.sign(u.pos.x - t!.pos.x), y: t!.pos.y + Math.sign(u.pos.y - t!.pos.y) }
          const ok = walkable(game.tile(next)) && climb(game.tile(t!.pos), game.tile(next))
          if (!ok || game.unitAt(next)) break
          t!.pos = next
        }
        game.log.push({ key: "log.hook", params: { unit: u.id, target: t!.id } })
        game.fire.scorch(t!)
        game.stealth.attacked(u, t!, "dagger")
        break
      }
      case "tag": {
        check(!!t && game.orders.canTarget(u, t) && distance(u.pos, t.pos) <= RANGE.tag, "target")
        t!.give({ id: "exposed", rounds: 1, source: u.id })
        game.log.push({ key: "log.tag", params: { unit: u.id, target: t!.id } })
        break
      }
      case "swap": {
        check(
          !!t && t !== u && t.alive() && distance(u.pos, t.pos) <= RANGE.swap && game.sight.sees(u, t.pos),
          "target",
        )
        const here = u.pos
        u.pos = t!.pos
        t!.pos = here
        game.log.push({ key: "log.swap", params: { unit: u.id, target: t!.id } })
        if (u.foe(t!)) game.stealth.attacked(u, t!, u.weapon)
        game.stealth.scan()
        break
      }
      case "barricade": {
        check(!!at && adjacent(u.pos, at) && game.tile(at) !== "roof" && walkable(game.tile(at)), "place")
        check(!game.unitAt(at!), "place")
        game.board.set(at!, "high")
        game.log.push({ key: "log.barricade", params: { unit: u.id } })
        break
      }
      case "mine": {
        check(!!at && distance(u.pos, at) <= RANGE.mine && game.sight.line(u.pos, at!, false), "range")
        check(walkable(game.tile(at!)) && !game.unitAt(at!), "place")
        game.zones.push({ kind: "mine", tiles: [{ ...at! }], rounds: 99 })
        game.log.push({ key: "log.plant", params: { unit: u.id } })
        break
      }
      case "rampage": {
        check(!!t && game.orders.canTarget(u, t), "target")
        let next: Unit | undefined = t
        for (let i = 0; i < 3 && next && u.alive(); i++) {
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
        this.saturate(u, at!)
        break
      }
      case "hospital": {
        for (const x of game.units) {
          if (x.side !== u.side || distance(u.pos, x.pos) > RANGE.hospital || (!x.alive() && x.down === 0)) continue
          x.hp = Math.min(x.maxHp, x.hp + 3)
          x.down = 0
          x.statuses = x.statuses.filter((s) => !BAD.includes(s.id))
        }
        game.log.push({ key: "log.hospital", params: { unit: u.id } })
        break
      }
      case "ghost": {
        u.concealed = true
        u.ap += 1
        game.log.push({ key: "log.ghost", params: { unit: u.id } })
        break
      }
      case "turret": {
        check(!!at && adjacent(u.pos, at) && walkable(game.tile(at)) && !game.unitAt(at!), "place")
        const id = `${u.id}-turret`
        game.units = game.units.filter((x) => x.id !== id)
        const turret = Unit.of(id, "turret", "squad", at!, "turret")
        turret.ap = 0
        turret.concealed = false
        turret.stance = "overwatch"
        turret.give({ id: "deployed", rounds: 3 })
        game.units.push(turret)
        game.log.push({ key: "log.turret", params: { unit: u.id } })
        break
      }
      case "blast": {
        check(!!at && game.board.inside(at) && distance(u.pos, at) <= RANGE.blast, "range")
        check(game.sight.line(u.pos, at!, false), "place")
        u.intent = null
        this.blast(u, at!)
        break
      }
    }
    u.cooldowns[id] = ABILITIES[id].cooldown || undefined
    if (ABILITIES[id].endsTurn) u.ap = 0
    else if (!ABILITIES[id].free) u.ap -= 1
  }

  /** Saturation fire: 2 damage to every other unit in a 90° cone up to 6 tiles toward a point, and all cover in it breaks. */
  private saturate(u: Unit, at: Point): void {
    const game = this.game
    const aim = Math.atan2(at.y - u.pos.y, at.x - u.pos.x)
    const cone = (p: Point) => {
      if (same(p, u.pos) || distance(u.pos, p) > RANGE.saturation) return false
      const turn = Math.abs(Math.atan2(p.y - u.pos.y, p.x - u.pos.x) - aim)
      return Math.min(turn, 2 * Math.PI - turn) <= Math.PI / 4 + 1e-9
    }
    game.log.push({ key: "log.saturation", params: { unit: u.id } })
    const hits = game.units.filter((x) => x !== u && x.alive() && cone(x.pos))
    for (const p of area(u.pos, RANGE.saturation)) if (game.board.inside(p) && cone(p)) game.combat.smash(p)
    for (const x of hits) {
      game.log.push({ key: "log.shrapnel", params: { target: x.id, dmg: 2 } })
      game.combat.hurt(x, 2)
    }
    game.stealth.noise(u.pos, WEAPONS[u.weapon].noise, u)
    for (const x of hits) if (u.foe(x)) game.stealth.attacked(u, x, u.weapon)
  }

  /** A Rocket: 2 damage to everyone in 3×3, pushes them out from the center, sets grass and trees on fire and breaks cover. */
  private rocket(u: Unit, at: Point): void {
    const game = this.game
    game.log.push({ key: "log.rocket", params: { unit: u.id } })
    const hits = area(at, 1)
      .map((p) => game.unitAt(p))
      .filter((x): x is Unit => !!x && x.alive())
    for (const p of area(at, 1)) if (game.board.inside(p) && !game.fire.ignite(p)) game.combat.smash(p)
    for (const x of hits) {
      game.log.push({ key: "log.shrapnel", params: { target: x.id, dmg: 2 } })
      if (game.combat.hurt(x, 2) || same(x.pos, at)) continue
      game.combat.push(at, x, u.id)
    }
    game.stealth.noise(at, BLAST_NOISE, u)
    for (const x of hits) if (u.foe(x)) game.stealth.attacked(u, x, u.weapon)
  }

  /** A Grenadier blast: sure damage to everyone in 3×3; it sets them burning, sets grass and trees on fire and breaks cover. */
  blast(u: Unit, at: Point): void {
    const game = this.game
    game.log.push({ key: "log.flask", params: { unit: u.id } })
    for (const p of area(at, 1)) {
      if (!game.board.inside(p)) continue
      if (!game.fire.ignite(p)) game.combat.smash(p)
      const hit = game.unitAt(p)
      if (!hit) continue
      game.log.push({ key: "log.burn", params: { target: hit.id, dmg: 3 } })
      if (!game.combat.hurt(hit, 3)) hit.give({ id: "burning", rounds: 2 })
    }
    game.stealth.noise(at, BLAST_NOISE, u)
  }
}

/** A skill's cooldown in rounds and its cost: it ends the turn, costs no AP (free), or else costs 1 AP. */
export interface AbilityRule {
  cooldown: number
  endsTurn: boolean
  free?: boolean
}

export const ABILITIES: Record<AbilityId, AbilityRule> = {
  charge: { cooldown: 3, endsTurn: true },
  volley: { cooldown: 2, endsTurn: true },
  heal: { cooldown: 2, endsTurn: false },
  ward: { cooldown: 3, endsTurn: false },
  fear: { cooldown: 3, endsTurn: true },
  rouse: { cooldown: 0, endsTurn: false },
  dread: { cooldown: 3, endsTurn: true },
  dominate: { cooldown: 4, endsTurn: true },
  mark: { cooldown: 0, endsTurn: true },
  shove: { cooldown: 2, endsTurn: true },
  rally: { cooldown: 4, endsTurn: false },
  blast: { cooldown: 0, endsTurn: true },
  grapple: { cooldown: 3, endsTurn: false, free: true },
  guard: { cooldown: 2, endsTurn: false },
  rocket: { cooldown: 3, endsTurn: true },
  smoke: { cooldown: 3, endsTurn: false },
  hook: { cooldown: 3, endsTurn: false },
  tag: { cooldown: 3, endsTurn: false },
  swap: { cooldown: 3, endsTurn: false },
  barricade: { cooldown: 3, endsTurn: false },
  mine: { cooldown: 3, endsTurn: false },
  rampage: { cooldown: 0, endsTurn: true },
  killzone: { cooldown: 0, endsTurn: true },
  saturation: { cooldown: 0, endsTurn: true },
  hospital: { cooldown: 0, endsTurn: false },
  ghost: { cooldown: 0, endsTurn: false, free: true },
  turret: { cooldown: 0, endsTurn: false },
}

export const RANGE = {
  blast: 5,
  ward: 4,
  fear: 6,
  dread: 6,
  dominate: 6,
  volley: 6,
  rally: 4,
  grapple: 4,
  guard: 7,
  rocket: 6,
  smoke: 6,
  hook: 4,
  tag: 7,
  swap: 5,
  mine: 3,
  saturation: 6,
  hospital: 3,
}
