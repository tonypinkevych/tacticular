import { distance, type Point } from "../map/point"
import { blocksMove } from "../map/tile"
import type { Game } from "../mission/game"
import type { Kind } from "../units/profiles"
import { Unit } from "../units/unit"

/** Rounds between alien drops. */
export const EVERY = 3

/** Alien drops: 2 aliens every 3 rounds on tiles marked a round before, as long as drops are left. */
export class Reinforcements {
  constructor(private readonly game: Game) {}

  /** Marks the 2 free tiles farthest from the squad when the next round brings a drop. */
  mark(): void {
    const game = this.game
    if (game.drops <= 0 || (game.round + 1) % EVERY !== 0) return
    const squad = game.units.filter((u) => u.side === "squad" && u.alive())
    const free: Point[] = []
    for (let y = 0; y < game.board.height; y++)
      for (let x = 0; x < game.board.width; x++) {
        const p = { x, y }
        if (!blocksMove(game.board.at(p)) && game.board.at(p) !== "fire" && !game.unitAt(p)) free.push(p)
      }
    const far = (p: Point) => Math.min(99, ...squad.map((s) => distance(s.at, p)))
    game.landing = game.dice
      .shuffle(free)
      .sort((a, b) => far(b) - far(a))
      .slice(0, 2)
  }

  /** Lands the drop on its marked tiles; a tile taken since is skipped. The new aliens act next turn. */
  land(): void {
    const game = this.game
    if (!game.landing.length) return
    const kinds: Kind[] = ["grunt", game.dice.pick(["brute", "bomber", "grunt"] as const)]
    const landed = game.landing
      .filter((p) => !game.unitAt(p))
      .map((p, i) => {
        const u = Unit.of(`d${game.round}${i}`, kinds[i], "enemy", p)
        u.ap = 0
        return u
      })
    game.units.push(...landed)
    game.drops -= 1
    game.landing = []
    game.log.push({ key: "log.drop", params: { count: landed.length } })
  }
}
