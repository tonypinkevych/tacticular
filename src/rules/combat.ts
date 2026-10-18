import { ULT, WEAPONS } from "./data"
import { chance, EDGE, failChance } from "./dice"
import type { Game } from "./game"
import { adjacent, distance, type Point, same } from "./point"
import { climb, high, walkable } from "./tile"
import type { Weapon, WeaponId } from "./types"
import type { Unit } from "./unit"

export type Reason = "flanked" | "unaware" | "range" | "reaction" | "hunkered" | "shaken"

/** Everything a player sees before an attack: modifiers, the edge and the hit chance. */
export interface Odds {
  weapon: Weapon
  aim: number
  defense: number
  cover: number
  edge: number
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
  key: "aim" | "warchief" | "height" | "defense" | "low" | "high" | "ward" | "wall"
  value: number
}

/** How a shot is fired: as a reaction, and against a dash or a vault. */
export interface Shot {
  reaction?: boolean
  risky?: boolean
}

/** Damage of a critical hit: half again, rounded up. */
export const crit = (raw: number): number => Math.ceil(raw * 1.5)

export function canReach(attacker: Unit, target: Unit, weapon: Weapon): boolean {
  return weapon.melee ? adjacent(attacker.pos, target.pos) : true
}

/** Attacks, damage and falls in a game. */
export class Combat {
  constructor(private readonly game: Game) {}

  smoke(u: Unit): boolean {
    return this.game.zones.some((z) => z.kind === "smoke" && z.tiles.some((t) => same(t, u.pos)))
  }

  /** +1 Aim while a living Warchief leads the unit's group. */
  groupAim(u: Unit): number {
    if (!u.group) return 0
    return this.game.units.some((x) => x.alive() && x.kind === "warchief" && x.group === u.group) ? 1 : 0
  }

  /** +1 Defense when a Shield trooper ally stands next to the unit. */
  wall(u: Unit): number {
    const wall = this.game.units.some(
      (x) => x.alive() && x !== u && x.kind === "shieldwall" && !x.foe(u) && adjacent(x.pos, u.pos),
    )
    return wall ? 1 : 0
  }

  odds(attacker: Unit, target: Unit, weaponId: WeaponId = attacker.weapon, shot: Shot = {}): Odds {
    const game = this.game
    const weapon = WEAPONS[weaponId]
    const adv: Reason[] = []
    const dis: Reason[] = []
    const exposed = target.has("exposed")
    const smoke = this.smoke(target) ? 2 : 0
    const facing = weapon.ignoresCover || exposed ? 0 : Math.max(smoke, game.cover.against(target.pos, attacker.pos))
    const above = !weapon.melee && high(game.tile(attacker.pos)) && !high(game.tile(target.pos))
    const cover = weapon.melee || (above && facing < 5) ? 0 : facing
    const open = weapon.melee ? this.pincer(attacker, target) : !weapon.ignoresCover && facing === 0
    if (exposed || open) adv.push("flanked")
    if ((target.side === "enemy" && target.alert === "unaware") || this.surprised(target)) adv.push("unaware")
    if (shot.reaction && !shot.risky && attacker.kind !== "ranger") dis.push("reaction")
    if (target.stance === "hunker") dis.push("hunkered")
    if (attacker.has("shaken") || this.surprised(attacker)) dis.push("shaken")
    const range = distance(attacker.pos, target.pos)
    if (!weapon.melee && (range > weapon.max || range < weapon.min)) dis.push("range")
    const edge = Math.max(-2, Math.min(2, adv.length - dis.length))
    const aimParts: Part[] = [{ key: "aim", value: attacker.aim }]
    if (this.groupAim(attacker)) aimParts.push({ key: "warchief", value: this.groupAim(attacker) })
    if (above) aimParts.push({ key: "height", value: 2 })
    const defenseParts: Part[] = [{ key: "defense", value: target.defense }]
    if (cover) defenseParts.push({ key: cover >= 5 ? "high" : "low", value: cover })
    if (target.has("ward")) defenseParts.push({ key: "ward", value: 2 })
    if (this.wall(target)) defenseParts.push({ key: "wall", value: 1 })
    const aim = aimParts.reduce((sum, p) => sum + p.value, 0)
    const defense = defenseParts.reduce((sum, p) => sum + p.value, 0)
    return {
      weapon,
      aim,
      defense,
      cover,
      edge,
      advantages: adv,
      disadvantages: dis,
      chance: weapon.saveHalf ? 1 : chance(aim, defense, edge),
      need: Math.min(20, Math.max(2, defense - aim - EDGE * edge)),
      aimParts,
      defenseParts,
      min: weapon.dice.count + weapon.dice.bonus,
      max: weapon.dice.count * weapon.dice.sides + weapon.dice.bonus,
    }
  }

  /** Rolls an attack, logs it in full and applies the damage; a soldier's hit fills its ultimate meter. */
  attack(attacker: Unit, target: Unit, weaponId: WeaponId = attacker.weapon, shot: Shot = {}): void {
    const game = this.game
    const o = this.odds(attacker, target, weaponId, shot)
    const w = o.weapon
    if (w.ammo !== null && weaponId === attacker.weapon) attacker.ammo -= 1
    if (weaponId === "axes") attacker.axes -= 1
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
    const critical = roll === 20
    const hit = critical || (roll !== 1 && roll + o.aim + EDGE * o.edge >= o.defense)
    const params: Record<string, string | number | boolean> = {
      unit: attacker.id,
      target: target.id,
      weapon: weaponId,
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
    const raw = game.dice.roll(w.dice)
    const dmg = critical ? crit(raw) : raw
    game.log.push({ key: critical ? "log.crit" : "log.hit", params: { ...params, dmg } })
    if (critical && !w.melee) {
      const p = game.cover.tile(target.pos, attacker.pos)
      if (p) game.board.break(p)
    }
    const killed = this.hurt(target, dmg)
    if (attacker.soldier()) attacker.ult = Math.min(ULT, attacker.ult + (killed ? 3 : 1))
    if (w.push && !killed) this.push(attacker.pos, target, attacker.id)
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
   * Applies damage and the effects of a fall; returns true when the target falls. A soldier goes down for 2
   * rounds, 3 while a Medic stands.
   */
  hurt(target: Unit, dmg: number): boolean {
    const game = this.game
    target.hp = Math.max(0, target.hp - dmg)
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
