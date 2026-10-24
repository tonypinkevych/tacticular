import { distance, type Point } from "../map/point"
import { clear } from "../map/sight"
import type { Unit } from "../units/unit"
import type { Game } from "./game"

export type Action =
  | { type: "move"; unit: string; to: Point }
  | { type: "shoot"; unit: string; target?: string; at?: Point }
  | { type: "overwatch"; unit: string }
  | { type: "skill"; unit: string; target?: string; at?: Point; to?: Point }
  | { type: "tactic"; unit: string; target: string }
  | { type: "endTurn" }

/** An action the rules refuse. */
export class Illegal extends Error {}

export function check(ok: boolean, reason: string): asserts ok {
  if (!ok) throw new Illegal(reason)
}

/** The actions a unit carries out in a game, and the reactions they trigger. */
export class Orders {
  constructor(private readonly game: Game) {}

  /** Carries out one action in place, then checks the mission's end. */
  run(action: Action): void {
    const game = this.game
    check(game.phase === "squad" || game.phase === "enemy", "over")
    if (action.type === "endTurn") {
      game.turn.end()
      return
    }
    const u = game.unit(action.unit)
    check(u.alive(), "dead")
    check(u.side === game.phase, "not your turn")
    check(u.ap > 0, "no AP")
    if (action.type === "move") this.move(u, action.to)
    if (action.type === "shoot") this.shoot(u, action)
    if (action.type === "overwatch") {
      check(u.profile.range > 0 && !u.profile.melee, "ability")
      u.overwatch = true
      u.ap = 0
    }
    if (action.type === "skill") game.abilities.use(u, action)
    if (action.type === "tactic") game.tactics.use(u, game.unit(action.target))
    game.settle()
  }

  private move(u: Unit, to: Point): void {
    const one = this.game.reach(u, 1)
    const cost = one.has(to) ? 1 : 2
    const reach = cost === 1 ? one : this.game.reach(u, 2)
    check(reach.has(to) && u.ap >= cost, "unreachable")
    this.walk(u, reach.path(to))
    u.ap -= cost
    u.moved = true
  }

  /**
   * Walks a unit tile by tile: a Suppressed unit first draws a shot from its suppressor, fire burns it, and an
   * enemy on overwatch fires once when it comes in range.
   */
  walk(u: Unit, path: Point[]): void {
    this.game.tactics.pin(u)
    if (!u.alive()) return
    for (const p of path) {
      u.at = { ...p }
      if (this.game.board.at(p) === "fire") this.game.combat.burn(u)
      const watcher = this.game.foes(u).find((f) => f.overwatch && this.game.combat.canShoot(f, u))
      if (watcher) {
        watcher.overwatch = false
        this.game.log.push({ key: "log.overwatch", params: { unit: watcher.id, target: u.id } })
        this.game.combat.fire(watcher, u, { penalty: 20 })
      }
      if (!u.alive()) return
    }
  }

  private shoot(u: Unit, action: { target?: string; at?: Point }): void {
    const combat = this.game.combat
    if (action.at) {
      check(this.game.board.at(action.at) === "barrel", "target")
      check(distance(u.at, action.at) <= u.profile.range && clear(this.game.board, u.at, action.at), "range")
      combat.explode(action.at)
    } else {
      const t = this.game.unit(action.target ?? "")
      check(t.alive() && t.side !== u.side, "target")
      check(combat.canShoot(u, t), "range")
      combat.fire(u, t)
    }
    u.ap = 0
  }
}
