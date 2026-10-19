import { adjacent, area, distance, type Point, same } from "../map/point"
import { climb, high, walkable } from "../map/tile"
import type { Game } from "../mission/game"
import { ULT, type Unit } from "../units/unit"
import { power } from "./abilities"
import { chance, EDGE, failChance } from "./dice"
import type { Weapon } from "./weapons"

/** How far a blast or a Rocket is heard. */
export const BLAST_NOISE = 10

export type Reason = "flanked" | "unaware" | "range" | "reaction" | "hunkered" | "shaken" | "suppressed"

/** Everything a player sees before an attack: modifiers, the edge, the hit chance and whether it is a sure critical. */
export interface Odds {
  weapon: Weapon
  aim: number
  defense: number
  cover: number
  edge: number
  sure: boolean
  advantages: Reason[]
  disadvantages: Reason[]
  chance: number
  need: number
  aimParts: Part[]
  defenseParts: Part[]
  min: number
  max: number
}

/** One named number that adds up to Aim or Defense, for the chance breakdown. */
export interface Part {
  key: "aim" | "warchief" | "height" | "defense" | "low" | "high" | "wall"
  value: number
}

/** How a shot is fired: as a reaction, against a dash or a vault, with extra damage, sure to hit, or for double damage. */
export interface Shot {
  reaction?: boolean
  risky?: boolean
  bonus?: number
  certain?: boolean
  double?: boolean
}

/** Damage of a critical hit: half again, rounded up. */
export const crit = (raw: number): number => Math.ceil(raw * 1.5)

export function canReach(attacker: Unit, target: Unit, weapon: Weapon): boolean {
  return weapon.melee ? adjacent(attacker.pos, target.pos) : true
}

/** Attacks, damage and falls in a game. */
export class Combat {
  constructor(private readonly game: Game) {}

  /** +1 Aim while a living Warchief leads the unit's group. */
  groupAim(u: Unit): number {
    if (!u.group) return 0
    return this.game.units.some((x) => x.alive() && x.kind === "warchief" && x.group === u.group) ? 1 : 0
  }

  /** +3 Defense when a Shield trooper ally stands next to the unit. */
  wall(u: Unit): number {
    const wall = this.game.units.some(
      (x) => x.alive() && x !== u && x.kind === "shieldwall" && !x.foe(u) && adjacent(x.pos, u.pos),
    )
    return wall ? 3 : 0
  }

  /** Damage the attacker's passive skills add: Close quarters, Squadsight at long range, Shadow and Tripwire. */
  extra(attacker: Unit, target: Unit, shot: Shot = {}): number {
    const range = distance(attacker.pos, target.pos)
    return (
      (attacker.rank("close") > 0 && range <= 2 ? power(attacker, "close") : 0) +
      (range > 8 ? power(attacker, "squadsight") : 0) +
      (attacker.concealed ? power(attacker, "shadow") : 0) +
      (shot.reaction ? power(attacker, "tripwire") : 0)
    )
  }

  /** True when the shot cannot miss: a Headshot, or an attack from concealment with Shadow at rank 3. */
  private certain(attacker: Unit, shot: Shot): boolean {
    return !!shot.certain || (attacker.concealed && attacker.rank("shadow") >= 3)
  }

  odds(attacker: Unit, target: Unit, shot: Shot = {}): Odds {
    const game = this.game
    const weapon = attacker.arms()
    const adv: Reason[] = []
    const dis: Reason[] = []
    const exposed = target.has("exposed")
    const facing = weapon.ignoresCover || exposed ? 0 : game.cover.against(target.pos, attacker.pos)
    const above = !weapon.melee && high(game.tile(attacker.pos)) && !high(game.tile(target.pos))
    const cover = weapon.melee || (above && facing < 5) ? 0 : facing
    const open = weapon.melee ? this.pincer(attacker, target) : !weapon.ignoresCover && facing === 0
    if (exposed || open) adv.push("flanked")
    const caught = target.side === "enemy" && target.alert === "unaware" && !game.stealth.wary(target)
    if (caught || this.surprised(target)) adv.push("unaware")
    if (shot.reaction && !shot.risky && attacker.kind !== "ranger" && attacker.rank("tripwire") === 0)
      dis.push("reaction")
    if (target.stance === "hunker") dis.push("hunkered")
    if (attacker.has("suppressed")) dis.push("suppressed")
    if (attacker.has("shaken") || attacker.wounded() || this.surprised(attacker)) dis.push("shaken")
    const range = distance(attacker.pos, target.pos)
    if (!weapon.melee && (range > weapon.max || range < weapon.min)) dis.push("range")
    const guarded = target.stance === "hunker" || (target.side === "enemy" && target.arms().melee)
    const sure = adv.length > dis.length && !guarded
    const certain = this.certain(attacker, shot)
    const more = this.extra(attacker, target, shot) + (shot.bonus ?? 0) + (attacker.might ?? 0)
    const scale = (n: number) => (shot.double ? 2 : 1) * (sure ? crit(n) : n)
    const edge = Math.max(-2, Math.min(guarded ? 1 : 0, adv.length - dis.length))
    const aimParts: Part[] = [{ key: "aim", value: attacker.aim }]
    if (this.groupAim(attacker)) aimParts.push({ key: "warchief", value: this.groupAim(attacker) })
    if (above) aimParts.push({ key: "height", value: 2 })
    const defenseParts: Part[] = [{ key: "defense", value: target.defense }]
    if (cover) defenseParts.push({ key: cover >= 5 ? "high" : "low", value: cover })
    if (this.wall(target)) defenseParts.push({ key: "wall", value: this.wall(target) })
    const aim = aimParts.reduce((sum, p) => sum + p.value, 0)
    const defense = defenseParts.reduce((sum, p) => sum + p.value, 0)
    return {
      weapon,
      aim,
      defense,
      cover,
      edge,
      sure,
      advantages: adv,
      disadvantages: dis,
      chance: weapon.saveHalf || sure || certain ? 1 : chance(aim, defense, edge),
      need: sure || certain ? 1 : Math.min(20, Math.max(2, defense - aim - EDGE * edge)),
      aimParts,
      defenseParts,
      min: scale(weapon.dice.count + weapon.dice.bonus + more),
      max: scale(weapon.dice.count * weapon.dice.sides + weapon.dice.bonus + more),
    }
  }

  /**
   * Rolls an attack, logs it in full and applies the damage and what the attacker's passive skills add on a hit; a
   * soldier's hit fills its ultimate meter.
   */
  attack(attacker: Unit, target: Unit, shot: Shot = {}): void {
    const game = this.game
    const o = this.odds(attacker, target, shot)
    const w = o.weapon
    if (w.ammo !== null) attacker.ammo -= 1
    if (w.saveHalf) {
      const edge = target.stance === "hunker" ? 1 : 0
      const roll = game.dice.d20()
      const dc = 10 + attacker.will
      const saved = roll + target.will + EDGE * edge >= dc
      const raw = game.dice.roll(w.dice)
      const dmg = Math.max(1, saved ? Math.floor(raw / 2) : raw)
      game.log.push({
        key: "log.lash",
        params: {
          unit: attacker.id,
          target: target.id,
          roll,
          total: roll + target.will + EDGE * edge,
          dc,
          saved,
          dmg,
          chance: Math.round(failChance(target.will, dc, edge) * 100),
        },
      })
      this.hurt(target, dmg)
      return
    }
    const roll = game.dice.d20()
    const critical = o.sure || (roll === 20 && !shot.certain)
    const hit = critical || this.certain(attacker, shot) || (roll !== 1 && roll + o.aim + EDGE * o.edge >= o.defense)
    const params: Record<string, string | number | boolean> = {
      unit: attacker.id,
      target: target.id,
      weapon: w.id,
      roll,
      total: roll + o.aim + EDGE * o.edge,
      defense: o.defense,
      hit,
      crit: critical,
      reaction: !!shot.reaction,
      chance: Math.round(o.chance * 100),
      need: o.need,
    }
    if (!hit) {
      game.log.push({ key: "log.miss", params })
      return
    }
    const raw = game.dice.roll(w.dice) + (shot.bonus ?? 0) + (attacker.might ?? 0) + this.extra(attacker, target, shot)
    const dmg = (shot.double ? 2 : 1) * (critical ? crit(raw) : raw)
    game.log.push({ key: critical ? "log.crit" : "log.hit", params: { ...params, dmg } })
    if (o.sure) target.lift("exposed")
    if ((critical || attacker.rank("shredder") >= 3) && !w.melee) {
      const p = game.cover.tile(target.pos, attacker.pos)
      if (p) this.smash(p)
    }
    const killed = this.hurt(target, dmg)
    if (attacker.soldier()) attacker.ult = Math.min(ULT, attacker.ult + (killed ? 3 : 1))
    if (killed) return
    if (attacker.rank("shredder") > 0)
      target.give({ id: "exposed", rounds: power(attacker, "shredder"), source: attacker.id })
    if (shot.reaction && attacker.rank("tripwire") >= 2) target.give({ id: "exposed", rounds: 1, source: attacker.id })
    if (attacker.rank("poison") > 0) target.give({ id: "poisoned", rounds: power(attacker, "poison") })
    if (w.push) this.push(attacker.pos, target, attacker.id)
    if (w.push && attacker.rank("knockback") > 0 && target.alive()) this.push(attacker.pos, target, attacker.id)
  }

  /**
   * Pushes a target 1 tile away and exposes it for 1 round. A push into anything solid or a unit does 2 damage instead of
   * a move; a push off a roof does 2 damage; a push into fire burns.
   */
  push(from: Point, target: Unit, source?: string): void {
    const game = this.game
    target.give({ id: "exposed", rounds: 1, source })
    const to = {
      x: target.pos.x + Math.sign(target.pos.x - from.x),
      y: target.pos.y + Math.sign(target.pos.y - from.y),
    }
    const here = game.tile(target.pos)
    const there = game.tile(to)
    if (!walkable(there) || !climb(here, there) || game.unitAt(to)) {
      game.log.push({ key: "log.slam", params: { target: target.id, dmg: 2 } })
      this.hurt(target, 2)
      return
    }
    target.pos = to
    game.log.push({ key: "log.push", params: { target: target.id } })
    if (here === "roof" && there !== "roof") {
      game.log.push({ key: "log.fall", params: { target: target.id, dmg: 2 } })
      if (this.hurt(target, 2)) return
    }
    game.fire.scorch(target)
  }

  /**
   * Applies damage and the effects of a fall; returns true when the target falls. Stasis takes no damage and a Shield
   * absorbs what it can. A soldier goes down for 2 rounds, 3 while a Medic stands.
   */
  hurt(target: Unit, dmg: number): boolean {
    const game = this.game
    if (target.has("stasis")) return false
    const shield = target.statuses.find((s) => s.id === "ward")
    const soak = Math.min(dmg, shield?.amount ?? 0)
    if (shield && soak > 0) {
      shield.amount = (shield.amount ?? 0) - soak
      if (shield.amount === 0) target.lift("ward")
      game.log.push({ key: "log.absorb", params: { target: target.id, dmg: soak } })
    }
    target.hp = Math.max(0, target.hp - (dmg - soak))
    if (target.hp > 0) return false
    target.stance = "none"
    target.intent = null
    target.statuses = []
    const medic = game.units.some((u) => u.alive() && u.kind === "cleric" && u.side === "squad")
    if (target.soldier()) target.down = medic ? 3 : 2
    game.log.push({ key: target.soldier() ? "log.down" : "log.dies", params: { unit: target.id } })
    if (target.kind === "warchief" && target.group) {
      for (const u of game.units) {
        if (u.alive() && u.group === target.group) u.give({ id: "shaken", rounds: 1 })
      }
    }
    for (const u of game.units) {
      if (u.statuses.some((s) => s.source === target.id && s.id !== "ward")) {
        u.statuses = u.statuses.filter((s) => s.source !== target.id || s.id === "ward")
      }
    }
    return true
  }

  /** Damages cover on a tile; a barrel there blows up. */
  smash(p: Point): void {
    const game = this.game
    if (game.tile(p) !== "barrel") {
      game.board.break(p)
      return
    }
    game.board.set(p, "floor")
    game.log.push({ key: "log.barrel", params: {} })
    this.explode(p)
  }

  /** A blast: 3 damage to everyone in 3×3; it sets grass and trees on fire, smashes the tiles around and is heard far. */
  explode(p: Point): void {
    const game = this.game
    for (const q of area(p, 1)) {
      const hit = game.unitAt(q)
      if (hit?.alive()) {
        game.log.push({ key: "log.shrapnel", params: { target: hit.id, dmg: 3 } })
        this.hurt(hit, 3)
      }
    }
    for (const q of area(p, 1)) if (!same(q, p) && game.board.inside(q) && !game.fire.ignite(q)) this.smash(q)
    game.stealth.noise(p, BLAST_NOISE, null)
  }

  /** True when an ally of the attacker stands on the far side of the target. */
  private pincer(attacker: Unit, target: Unit): boolean {
    const far = { x: 2 * target.pos.x - attacker.pos.x, y: 2 * target.pos.y - attacker.pos.y }
    const ally = this.game.unitAt(far)
    return !!ally && ally !== attacker && !ally.foe(attacker)
  }

  private surprised(u: Unit): boolean {
    return this.game.reactions.includes(u.id)
  }
}
