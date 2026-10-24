import { cover } from "../map/cover"
import { adjacent, distance, ORTHOGONAL, type Point, plus } from "../map/point"
import type { Game } from "../mission/game"
import { type Action, check } from "../mission/orders"
import type { Unit } from "../units/unit"

type Skill = Extract<Action, { type: "skill" }>

/** The skill of each class and alien kind; a skill ends the unit's turn. */
export class Abilities {
  constructor(private readonly game: Game) {}

  use(u: Unit, a: Skill): void {
    const p = u.profile
    check(u.cooldown === 0, "cooldown")
    check(u.uses === null || u.uses > 0, "uses")
    const game = this.game,
      combat = game.combat
    switch (p.skill) {
      case "runGun": {
        check(u.ap === 2, "no AP")
        const reach = game.reach(u, 2),
          t = this.target(u, a)
        check(!!a.to && reach.has(a.to), "unreachable")
        check(combat.canShoot(u, t, a.to), "range")
        game.log.push({ key: "log.run", params: { unit: u.id } })
        game.orders.walk(u, reach.path(a.to))
        u.moved = true
        if (u.alive() && t.alive()) combat.fire(u, t)
        break
      }
      case "headshot": {
        const t = this.target(u, a)
        check(combat.canShoot(u, t), "range")
        check(cover(game.board, t.at, u.at) === 0, "flank")
        game.log.push({ key: "log.headshot", params: { unit: u.id, target: t.id } })
        combat.fire(u, t, { sureCrit: true })
        break
      }
      case "grenade": {
        const at = this.place(a)
        check(distance(u.at, at) <= 4, "range")
        game.log.push({ key: "log.grenade", params: { unit: u.id } })
        combat.blast(at, 2)
        break
      }
      case "medkit": {
        const t = game.unit(a.target ?? "")
        check(t.alive() && t.side === u.side && (t === u || adjacent(t.at, u.at)), "range")
        const amount = Math.min(2, t.profile.hp - t.hp)
        t.hp += amount
        game.log.push({ key: "log.heal", params: { unit: u.id, target: t.id, amount } })
        break
      }
      case "covering": {
        const t = this.target(u, a)
        check(combat.canShoot(u, t), "range")
        game.log.push({ key: "log.covering", params: { unit: u.id, target: t.id } })
        combat.fire(u, t, { penalty: 15 })
        if (t.alive()) combat.fire(u, t, { penalty: 15 })
        break
      }
      case "charge": {
        const at = this.place(a),
          dx = at.x - u.at.x,
          dy = at.y - u.at.y,
          n = distance(u.at, at)
        check(n >= 1 && n <= 4 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)), "place")
        const step = { x: Math.sign(dx), y: Math.sign(dy) }
        game.marks.push({
          kind: "charge",
          unit: u.id,
          tiles: Array.from({ length: n }, (_, i) => ({ x: u.at.x + step.x * (i + 1), y: u.at.y + step.y * (i + 1) })),
        })
        game.log.push({ key: "log.mark", params: { unit: u.id } })
        break
      }
      case "blast": {
        const at = this.place(a)
        check(distance(u.at, at) <= 3, "range")
        game.marks.push({
          kind: "blast",
          unit: u.id,
          tiles: [at, ...ORTHOGONAL.map((d) => plus(at, d)).filter((q) => game.board.inside(q))],
        })
        game.log.push({ key: "log.mark", params: { unit: u.id } })
        break
      }
      case "warcry":
        for (const x of game.allies(u)) x.rallied = true
        game.log.push({ key: "log.warcry", params: { unit: u.id } })
        break
    }
    u.cooldown = p.cooldown
    if (u.uses !== null) u.uses -= 1
    u.ap = 0
  }

  private target(u: Unit, a: Skill): Unit {
    const t = this.game.unit(a.target ?? "")
    check(t.alive() && t.side !== u.side, "target")
    return t
  }

  private place(a: Skill): Point {
    check(!!a.at && this.game.board.inside(a.at), "place")
    return a.at
  }
}
