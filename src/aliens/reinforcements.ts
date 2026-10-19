import { distance, key, type Point } from "../map/point"
import { walkable } from "../map/tile"
import type { Game } from "../mission/game"
import { alien, composition, free } from "../mission/mission"

/** Rounds between alien drops, and the most drops a mission gets. */
const EVERY = 4
const DROPS = 3

/** Defend: the rounds whose end brings a wave, and its size. */
const WAVES: Record<number, number> = { 2: 2, 4: 3, 6: 4 }

/** The drop clock of a game and the help it brings the aliens. */
export class Reinforcements {
  constructor(private readonly game: Game) {}

  /**
   * Round end: every 4 rounds, at most 3 times, 2 aliens land on the pad; with no pad, at the edge farthest from the
   * squad, except in Defend. The head start of the game brings each drop that many rounds sooner. In Defend, waves
   * land at the edge farthest from the beacon.
   */
  land(): void {
    const game = this.game
    const goal = game.goal
    if (goal.kind === "defend" && WAVES[game.round]) this.drop("w", this.edge(goal.at), WAVES[game.round], goal.at)
    if (!this.due(game.round)) return
    const squad = game.units.find((u) => u.alive() && u.side === "squad")?.pos ?? null
    const at = this.pad()
    if (at) this.drop("d", at, 2, squad)
  }

  /** The rounds left before the next drop, 0 when it lands at the end of this round, or null when no more comes. */
  next(): number | null {
    const round = this.game.round
    for (let r = round; r <= round + EVERY; r++) if (this.due(r)) return r - round
    return null
  }

  /** Where aliens land at the end of this round, or null. */
  coming(): Point | null {
    const game = this.game
    const goal = game.goal
    if (goal.kind === "defend" && WAVES[game.round]) return this.edge(goal.at)
    return this.due(game.round) ? this.pad() : null
  }

  /** How many aliens landed at the end of the last round. */
  landed(): number {
    const game = this.game
    return game.log
      .filter((e) => (e.key === "log.drop" || e.key === "log.wave") && e.params.round === game.round - 1)
      .reduce((n, e) => n + Number(e.params.count), 0)
  }

  /** True when a drop comes at the end of a round. */
  private due(round: number): boolean {
    const r = round + this.game.alarm
    return r % EVERY === 0 && r / EVERY <= DROPS
  }

  /** Where a drop lands: the pad, else the edge farthest from the squad, and nowhere in Defend. */
  private pad(): Point | null {
    const game = this.game
    if (game.pad) return game.pad
    const squad = game.units.find((u) => u.alive() && u.side === "squad")
    return squad && game.goal.kind !== "defend" ? this.edge(squad.pos) : null
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
    game.log.push({ key: prefix === "w" ? "log.wave" : "log.drop", params: { count, round: game.round } })
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
