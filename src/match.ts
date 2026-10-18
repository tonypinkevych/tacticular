import { Mind } from "./ai/mind"
import type { Game } from "./rules/game"
import { Illegal } from "./rules/orders"
import { distance, key } from "./rules/point"
import type { Action } from "./rules/types"
import type { Unit } from "./rules/unit"

/** One step of play: an action and the game right after it. */
export interface Frame {
  action: Action
  game: Game
}

/** A mission in play: the current game, moved on by player actions and the alien side's answers. */
export class Match {
  constructor(public game: Game) {}

  /**
   * Plays one player action, then every reaction and, after End turn, the whole enemy phase. The match moves on
   * to the last game; the steps are returned so the view can show them one by one.
   */
  play(action: Action): Frame[] {
    const out: Frame[] = [{ action, game: this.game.apply(action) }]
    this.react(out)
    if (action.type === "endTurn" && last(out).phase === "enemy") this.enemyPhase(out)
    this.game = last(out)
    return out
  }

  /** Plays on with the AI on both sides until the mission ends or the rounds run out; used for balance runs. */
  simulate(rounds = 30): Game {
    while ((this.game.phase === "squad" || this.game.phase === "enemy") && this.game.round <= rounds) {
      for (const { id } of this.game.units.filter((u) => u.alive() && u.allegiance() === "squad")) {
        for (let i = 0; i < 4 && this.game.phase === "squad"; i++) {
          const u = this.game.unit(id)
          if (!u.alive() || u.allegiance() !== "squad") break
          const mind = new Mind(this.game)
          const action = mind.known(u).length === 0 ? this.explore(u) : mind.decide(u)
          if (!action) break
          try {
            this.play(action)
          } catch (e) {
            if (!(e instanceof Illegal)) throw e
            break
          }
        }
      }
      if (this.game.phase === "squad") this.play({ type: "endTurn" })
    }
    return this.game
  }

  /** Each unit in the reveal queue takes one AI action, surprised. */
  private react(out: Frame[]): void {
    while (last(out).reactions.length > 0 && (last(out).phase === "squad" || last(out).phase === "enemy")) {
      const id = last(out).reactions[0]
      const ready = last(out).clone()
      const u = ready.unit(id)
      u.ap = u.alive() ? 1 : 0
      const action = new Mind(ready).decide(u)
      let after = ready
      if (action) {
        try {
          after = ready.apply(action)
        } catch (e) {
          if (!(e instanceof Illegal)) throw e
        }
      }
      after.unit(id).ap = 0
      after.reactions = after.reactions.filter((x) => x !== id)
      out.push({ action: action ?? { type: "endTurn" }, game: after })
    }
  }

  /** Runs the AI for every enemy-side unit, nearest to the squad first, then ends the round. */
  private enemyPhase(out: Frame[]): void {
    for (const { id } of order(last(out))) {
      for (let i = 0; i < 4 && last(out).phase === "enemy"; i++) {
        const u = last(out).unit(id)
        if (u.allegiance() !== "enemy") break
        const action = new Mind(last(out)).decide(u)
        if (!action) break
        try {
          out.push({ action, game: last(out).apply(action) })
        } catch (e) {
          if (!(e instanceof Illegal)) throw e
          break
        }
      }
    }
    for (const { id } of order(last(out))) {
      const aim = last(out).phase === "enemy" ? new Mind(last(out)).aim(last(out).unit(id)) : null
      if (aim) out.push({ action: aim, game: last(out).apply(aim) })
    }
    if (last(out).phase === "enemy")
      out.push({ action: { type: "endTurn" }, game: last(out).apply({ type: "endTurn" }) })
  }

  /** Squad policy with no enemy in sight: walk to the nearest unexplored tile. */
  private explore(u: Unit): Action | null {
    const game = this.game
    if (u.moved && u.ap < 2) return null
    const w = game.board.width
    const open = game.reach(u, 400).cost
    const fog = game.explored.flatMap((seen, i) =>
      seen || !open.has(key({ x: i % w, y: Math.floor(i / w) })) ? [] : [{ x: i % w, y: Math.floor(i / w) }],
    )
    const goal = fog.sort((a, b) => distance(u.pos, a) - distance(u.pos, b))[0]
    return goal ? new Mind(game).toward(u, goal) : null
  }
}

const last = (out: Frame[]): Game => out[out.length - 1].game

function order(game: Game): Unit[] {
  const squad = game.units.filter((u) => u.alive() && u.allegiance() === "squad")
  const near = (u: Unit) => Math.min(...squad.map((s) => distance(s.pos, u.pos)), 999)
  return game.units.filter((u) => u.alive() && u.allegiance() === "enemy").sort((a, b) => near(a) - near(b))
}
