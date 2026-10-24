import { adjacent, distance, ORTHOGONAL, plus } from "../map/point"
import { clear } from "../map/sight"
import { coverOf } from "../map/tile"
import type { Game } from "../mission/game"
import { check } from "../mission/orders"
import type { Status, Unit } from "../units/unit"

/** The statuses soldiers put on aliens, and the combos their hits make of them. */
export class Tactics {
  constructor(private readonly game: Game) {}

  /** Puts the soldier's status on an alien in its range for 1 AP; Shove pushes an adjacent alien first. */
  use(u: Unit, target: Unit): void {
    const status = u.profile.tactic
    check(!!status, "ability")
    check(target.alive() && target.side !== u.side, "target")
    if (status === "staggered") check(adjacent(u.at, target.at), "range")
    else check(distance(u.at, target.at) <= u.profile.range && clear(this.game.board, u.at, target.at), "range")
    this.game.log.push({ key: `log.${status}`, params: { unit: u.id, target: target.id } })
    if (status === "staggered") this.game.combat.push(target, u.at)
    if (target.alive()) this.put(target, status, u)
    u.ap -= 1
  }

  /** A status on a unit in place of the one it had; a Staggered unit loses its marked attack. */
  put(target: Unit, status: Status, by: Unit): void {
    target.status = status
    target.by = by.id
    if (status === "staggered") this.game.marks = this.game.marks.filter((m) => m.unit !== target.id)
  }

  /** What a combo hit does after its damage: the status is used up and the next link of the chain is put on. */
  follow(shooter: Unit, target: Unit): void {
    const game = this.game,
      status = target.status
    game.log.push({ key: "log.combo", params: { unit: shooter.id, target: target.id } })
    target.status = null
    target.by = null
    if (status === "marked")
      for (const a of game.allies(shooter))
        if (adjacent(a.at, shooter.at, true)) a.hp = Math.min(a.profile.hp, a.hp + 1)
    if (!target.alive()) return
    if (status === "suppressed") this.put(target, "staggered", shooter)
    if (status === "exposed") this.put(target, "marked", shooter)
    if (status === "staggered") {
      for (const d of ORTHOGONAL) {
        const p = plus(target.at, d)
        if (coverOf(game.board.at(p)) > 0 && game.board.at(p) !== "barrel") game.board.break(p)
      }
      this.put(target, "exposed", shooter)
    }
  }

  /** A Suppressed unit about to move draws a shot from the unit that suppressed it, and the status ends. */
  pin(u: Unit): void {
    if (u.status !== "suppressed") return
    const by = this.game.units.find((x) => x.id === u.by)
    u.status = null
    u.by = null
    if (!by?.alive() || !this.game.combat.canShoot(by, u)) return
    this.game.log.push({ key: "log.pinned", params: { unit: by.id, target: u.id } })
    this.game.combat.fire(by, u)
  }
}
