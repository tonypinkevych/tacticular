import { cover, shelter } from "../map/cover"
import { adjacent, distance, ORTHOGONAL, type Point, plus } from "../map/point"
import { clear } from "../map/sight"
import { blocksMove } from "../map/tile"
import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"

/** What a player sees before an attack: the damage it deals and what the cover cuts from it. */
export interface Hit {
  damage: number
  cover: number
  /** The attack turns the target's status into a combo. */
  combo?: boolean
  /** The attack gains 1 from a status a teammate put on, without a combo. */
  link?: boolean
}

/** Changes to one attack: where it comes from and damage taken off or added. */
export interface Fire {
  from?: Point
  less?: number
  more?: number
  /** The shot ignores cover, with no flank bonus. */
  pierce?: boolean
}

/** Attacks, damage, blasts and pushes in a game. */
export class Combat {
  constructor(private readonly game: Game) {}

  canShoot(shooter: Unit, target: Unit, from: Point = shooter.at): boolean {
    const p = shooter.profile
    return (
      p.range > 0 && target.alive() && distance(from, target.at) <= p.range && clear(this.game.board, from, target.at)
    )
  }

  /**
   * The damage of an attack: the weapon damage with the statuses, and for a shot less the cover cut (1 low, 2 high,
   * doubled on a hunkered target), 1 more on a flank, and the passives; never below 0. A Guard behind cover takes 0.
   */
  hit(shooter: Unit, target: Unit, fire: Fire = {}): Hit {
    const p = shooter.profile,
      from = fire.from ?? shooter.at
    let status = (fire.more ?? 0) - (fire.less ?? 0)
    if (target.status === "marked") status += this.spotted(target) ? 2 : 1
    if (shooter.status === "suppressed") status -= 1
    if (p.melee)
      return this.combo(shooter, target, {
        damage: Math.max(0, p.damage - (target.profile.passive === "parry" ? 1 : 0) + status),
        cover: 0,
      })
    const base = cover(this.game.board, target.at, from)
    const c = fire.pierce || target.status === "exposed" ? 0 : target.hunkered ? Math.max(base, 1) * 2 : base
    let dmg = p.damage - c + (c === 0 && !fire.pierce ? 1 : 0) + status
    if (p.passive === "pointBlank" && adjacent(from, target.at)) dmg += 1
    if (p.passive === "steady" && !shooter.moved) dmg += 1
    if (this.game.allies(target).some((a) => a.profile.passive === "aid" && a !== target && adjacent(a.at, target.at)))
      dmg -= 1
    return this.combo(shooter, target, {
      damage: target.profile.passive === "shell" && c > 0 ? 0 : Math.max(0, dmg),
      cover: c,
    })
  }

  /** The hit with the combo the shooter makes of the target's status, or 1 more from a teammate's status. */
  private combo(shooter: Unit, target: Unit, hit: Hit): Hit {
    if (!target.status) return hit
    if (shooter.profile.combo !== target.status)
      return target.by && target.by !== shooter.id && hit.damage > 0
        ? { ...hit, damage: hit.damage + 1, link: true }
        : hit
    if (shooter.kind === "blade") return { ...hit, damage: hit.damage + 3, combo: true }
    if (target.status === "marked") return { ...hit, combo: true }
    return { ...hit, damage: hit.damage + (shooter.extra.branch === "brawler" ? 3 : 2), combo: true }
  }

  /**
   * Lands an attack for its damage; one cut to 0 is blocked. A melee hit or a point blank hit pushes the target back,
   * and claws at a Blade with Riposte cost the alien 2. A combo or a link charges the shooter and the teammate whose
   * status it used.
   */
  fire(shooter: Unit, target: Unit, fire: Fire = {}): void {
    const h = this.hit(shooter, target, fire),
      from = fire.from ?? shooter.at,
      params = { unit: shooter.id, target: target.id, dmg: h.damage }
    this.game.log.push({ key: h.damage > 0 ? "log.hit" : "log.block", params })
    if (target.extra.branch === "riposte" && shooter.profile.melee && adjacent(shooter.at, target.at)) {
      this.game.log.push({ key: "log.riposte", params: { unit: target.id, target: shooter.id } })
      this.hurt(shooter, 2)
    }
    if (h.damage === 0) return
    if (h.combo || h.link) this.game.ultimates.charge(shooter, target.by)
    const guard = shelter(this.game.board, target.at, from)
    if (shooter.profile.passive === "shred" && guard && ["bags", "torn"].includes(this.game.board.at(guard)))
      this.game.board.break(guard)
    this.hurt(target, h.damage)
    if (
      target.alive() &&
      (shooter.profile.knock || (shooter.profile.passive === "pointBlank" && adjacent(from, target.at)))
    )
      this.push(target, from)
    if (h.combo) this.game.tactics.follow(shooter, target)
    else if (shooter.extra.branch === "wrecker" && target.alive()) this.game.tactics.wreck(target)
  }

  private spotted(target: Unit): boolean {
    return this.game.units.find((u) => u.id === target.by)?.extra.branch === "spotter"
  }

  hurt(target: Unit, dmg: number): void {
    if (!target.alive()) return
    target.hp = Math.max(0, target.hp - dmg)
    if (target.alive()) return
    this.game.log.push({ key: "log.dies", params: { unit: target.id } })
    this.game.marks = this.game.marks.filter((m) => m.unit !== target.id)
  }

  /** Moves a unit one tile away from a point: water drowns it, fire burns it, anything solid stops it. */
  push(target: Unit, from: Point): void {
    const to = { x: target.at.x + Math.sign(target.at.x - from.x), y: target.at.y + Math.sign(target.at.y - from.y) }
    const tile = this.game.board.at(to)
    if (tile === "water" && this.game.board.inside(to)) {
      target.at = to
      this.game.log.push({ key: "log.drown", params: { target: target.id } })
      this.hurt(target, target.hp)
      return
    }
    if (blocksMove(tile) || this.game.unitAt(to)) return
    target.at = to
    this.game.log.push({ key: "log.push", params: { target: target.id } })
    if (tile === "fire") this.burn(target)
  }

  burn(u: Unit): void {
    this.game.log.push({ key: "log.fire", params: { target: u.id, dmg: 1 } })
    this.hurt(u, 1)
  }

  /** Hits a tile and the 4 around it: units take the damage, cover breaks, barrels blow. */
  blast(center: Point, dmg: number): void {
    for (const p of [center, ...ORTHOGONAL.map((d) => plus(center, d))]) {
      const u = this.game.unitAt(p)
      if (u) this.burst(u, dmg)
      if (this.game.board.at(p) === "barrel") this.explode(p)
      else this.game.board.break(p)
    }
  }

  /** A barrel blows: fire on its tile, 2 to every unit around it, and the next barrel blows too. */
  explode(at: Point): void {
    if (this.game.board.at(at) !== "barrel") return
    this.game.board.set(at, "fire")
    this.game.log.push({ key: "log.barrel", params: {} })
    for (const d of ORTHOGONAL) {
      const p = plus(at, d)
      const u = this.game.unitAt(p)
      if (u) this.burst(u, 2)
      if (this.game.board.at(p) === "barrel") this.explode(p)
      else this.game.board.break(p)
    }
  }

  private burst(u: Unit, dmg: number): void {
    if (!u.alive()) return
    this.game.log.push({ key: "log.burst", params: { target: u.id, dmg } })
    this.hurt(u, dmg)
  }
}
