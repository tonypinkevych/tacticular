import type { Game } from "./game"
import { composition, free } from "./mission"
import { key, type Point } from "./point"
import { Unit } from "./unit"

const DROPS = 3
const EVERY = 3

/** The alien landings of a game after the alarm. */
export class Reinforcements {
  constructor(private readonly game: Game) {}

  /** Round end: after the alarm, 2 aliens land at the planned spot every 3 rounds, at most 3 times. */
  land(): void {
    const game = this.game
    if (game.drop && game.drop.round === game.round) {
      const id = `d${game.drops + 1}`
      const taken = new Set(game.units.filter((u) => u.alive() || u.down > 0).map((u) => key(u.pos)))
      const target = game.units.find((u) => u.alive() && u.side === "squad")?.pos ?? null
      const landing = game.groups.find((g) => g.landing)?.landing
      game.groups.push({ id, revealed: true, target: target && { ...target }, alarmed: true, landing })
      for (const [i, kind] of composition(game.dice, 2).entries()) {
        const u = Unit.of(`${id}-${i + 1}`, kind, "enemy", free(game.board, game.drop.at, taken), kind, id)
        u.alert = "engaged"
        game.units.push(u)
      }
      game.log.push({ key: "log.drop", params: { count: 2 } })
      game.drops += 1
      game.drop = null
      if (game.drops >= DROPS) return
    }
    if (!game.drop && game.drops < DROPS && game.groups.some((g) => g.alarmed))
      game.drop = { at: this.spot(), round: game.round + EVERY }
  }

  /** An edge tile in the far half of the map that no soldier sees. */
  private spot(): Point {
    const game = this.game
    const { width, height } = game.board
    const seen = new Set<number>()
    for (const u of game.units) if (u.alive() && u.side === "squad") for (const k of game.sight.tiles(u)) seen.add(k)
    const edge: Point[] = []
    for (let y = 0; y < height; y++) {
      for (let x = Math.floor(width / 2); x < width; x++) {
        const p = { x, y }
        if (x !== width - 1 && y !== 0 && y !== height - 1) continue
        if (game.board.inside(p) && game.tile(p) === "floor" && !seen.has(key(p))) edge.push(p)
      }
    }
    return edge.length > 0 ? game.dice.pick(edge) : { x: width - 1, y: Math.floor(height / 2) }
  }
}
