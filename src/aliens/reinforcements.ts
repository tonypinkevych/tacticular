import { distance, key, type Point } from "../map/point"
import { walkable } from "../map/tile"
import type { Game } from "../mission/game"
import { alien, composition, free } from "../mission/mission"

/** Alarm values at which the aliens get help. */
const STEPS = [4, 7, 10]

/** Defend: the rounds whose end brings a wave, and its size. */
const WAVES: Record<number, number> = { 2: 2, 4: 3, 6: 4 }

/** The alarm clock of a game and the help it brings the aliens. */
export class Reinforcements {
  constructor(private readonly game: Game) {}

  /**
   * Round end: the alarm rises by 1 after each even round, and by 1 more after a round with a loud squad noise.
   * Passing 4, 7 or 10, 2 aliens land on the pad; with no pad, the nearest calm group hunts the squad. In Defend,
   * waves land at the edge farthest from the beacon and head for it.
   */
  land(): void {
    const game = this.game
    const goal = game.goal
    if (goal.kind === "defend" && WAVES[game.round]) this.drop("w", this.edge(goal.at), WAVES[game.round], goal.at)
    const before = game.alarm
    game.alarm += this.rise()
    if (!STEPS.some((s) => s > before && s <= game.alarm)) return
    if (game.pad) this.drop("d", game.pad, 2, game.units.find((u) => u.alive() && u.side === "squad")?.pos ?? null)
    else game.stealth.hunt()
  }

  /** The alarm value of the next help, or null when no more comes. */
  next(): number | null {
    return STEPS.find((s) => s > this.game.alarm) ?? null
  }

  /** Where aliens land at the end of this round, or null. */
  coming(): Point | null {
    const game = this.game
    const goal = game.goal
    if (goal.kind === "defend" && WAVES[game.round]) return this.edge(goal.at)
    const after = game.alarm + this.rise()
    return game.pad && STEPS.some((s) => s > game.alarm && s <= after) ? game.pad : null
  }

  /** How much the alarm rises at the end of this round, from what happened so far. */
  private rise(): number {
    const game = this.game
    const loud = game.noises.some((n) => n.loud && n.round === game.round)
    return (game.round % 2 === 0 ? 1 : 0) + (loud ? 1 : 0)
  }

  private drop(prefix: string, at: Point, count: number, target: Point | null): void {
    const game = this.game
    const id = `${prefix}${game.groups.filter((g) => g.id.startsWith(prefix)).length + 1}`
    const taken = new Set(game.units.filter((u) => u.alive() || u.down > 0).map((u) => key(u.pos)))
    const landing = game.groups.find((g) => g.landing)?.landing
    game.groups.push({ id, revealed: true, target: target && { ...target }, alarmed: true, landing })
    const kinds = Array.from({ length: Math.ceil(count / 2) }, () => composition(game.dice, 2, game.force)).flat()
    for (const [i, kind] of kinds.slice(0, count).entries()) {
      const u = alien(`${id}-${i + 1}`, kind, free(game.board, at, taken), id, game.force)
      u.alert = "engaged"
      game.units.push(u)
    }
    game.log.push({ key: prefix === "w" ? "log.wave" : "log.drop", params: { count } })
  }

  /** The walkable edge tile farthest from a point. */
  private edge(from: Point): Point {
    const { board } = this.game
    let best = from
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++) {
        const p = { x, y }
        const rim = x === 0 || y === 0 || x === board.width - 1 || y === board.height - 1
        if (rim && walkable(board.at(p)) && distance(p, from) > distance(best, from)) best = p
      }
    return best
  }
}
