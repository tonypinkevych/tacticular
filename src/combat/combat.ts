import { cover, shelter } from "../map/cover"
import { adjacent, distance, ORTHOGONAL, type Point, plus } from "../map/point"
import { clear } from "../map/sight"
import { blocksMove } from "../map/tile"
import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"

/** What a player sees before a shot: the hit chance, the crit chance, the damage and the cover. */
export interface Odds {
  chance: number
  crit: number
  damage: number
  cover: number
  /** The shot turns the target's status into a combo. */
  combo?: boolean
}

/** A shot's changes to its chance and its crit. */
export interface Fire {
  from?: Point
  penalty?: number
  sureCrit?: boolean
}

/** Shots, damage, blasts and pushes in a game. */
export class Combat {
  constructor(private readonly game: Game) {}

  canShoot(shooter: Unit, target: Unit, from: Point = shooter.at): boolean {
    const p = shooter.profile
    return (
      p.range > 0 && target.alive() && distance(from, target.at) <= p.range && clear(this.game.board, from, target.at)
    )
  }

  odds(shooter: Unit, target: Unit, fire: Fire = {}): Odds {
    const p = shooter.profile,
      from = fire.from ?? shooter.at
    if (p.melee) return { chance: 100, crit: 0, damage: p.damage, cover: 0 }
    const c = (target.status === "exposed" ? 0 : cover(this.game.board, target.at, from)) * (target.hunkered ? 2 : 1)
    let aim = p.aim - c - (fire.penalty ?? 0) + (c === 0 ? 10 : 0)
    if (target.status === "marked") aim += 10
    if (shooter.status === "suppressed") aim -= 20
    if (p.passive === "pointBlank" && adjacent(from, target.at)) aim += 20
    if (p.passive === "steady" && !shooter.moved) aim += 20
    if (this.game.allies(target).some((a) => a.profile.passive === "aid" && a !== target && adjacent(a.at, target.at)))
      aim -= 10
    const odds = {
      chance: Math.max(5, Math.min(95, aim)),
      crit: c === 0 && !target.hunkered ? 50 : 0,
      damage: p.damage,
      cover: c,
    }
    if (!target.status || p.combo !== target.status) return odds
    if (target.status === "exposed") return { ...odds, crit: 100, combo: true }
    if (target.status === "marked") return { ...odds, combo: true }
    return { ...odds, damage: odds.damage + 1, combo: true }
  }

  /** Rolls a shot: a hit takes the damage, a crit 1 more; a melee hit or a point blank hit pushes the target back. */
  fire(shooter: Unit, target: Unit, fire: Fire = {}): void {
    const o = this.odds(shooter, target, fire),
      dice = this.game.dice
    const hit = dice.random() * 100 < o.chance
    const crit = hit && (fire.sureCrit || dice.random() * 100 < o.crit)
    const params = { unit: shooter.id, target: target.id, chance: o.chance }
    if (!hit) {
      this.game.log.push({ key: "log.miss", params })
      return
    }
    const dmg = o.damage + (crit ? 1 : 0)
    if (crit) this.game.log.push({ key: "log.crit", params: { ...params, dmg } })
    else this.game.log.push({ key: "log.hit", params: { ...params, dmg } })
    const guard = shelter(this.game.board, target.at, fire.from ?? shooter.at)
    if (shooter.profile.passive === "shred" && guard && ["bags", "torn"].includes(this.game.board.at(guard)))
      this.game.board.break(guard)
    this.hurt(target, dmg)
    const from = fire.from ?? shooter.at
    if (
      target.alive() &&
      (shooter.profile.melee || (shooter.profile.passive === "pointBlank" && adjacent(from, target.at)))
    )
      this.push(target, from)
    if (o.combo) this.game.tactics.follow(shooter, target)
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
      if (u) this.hurt(u, dmg)
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
      if (u) this.hurt(u, 2)
      if (this.game.board.at(p) === "barrel") this.explode(p)
      else this.game.board.break(p)
    }
  }
}
