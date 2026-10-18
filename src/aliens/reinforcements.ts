import { key, type Point } from "../map/point"
import type { Game } from "../mission/game"
import { composition, free } from "../mission/mission"
import { Unit } from "../units/unit"

/** Alarm values at which the aliens get help. */
const STEPS = [4, 7, 10]

/** The alarm clock of a game and the help it brings the aliens. */
export class Reinforcements {
  constructor(private readonly game: Game) {}

  /**
   * Round end: the alarm rises by 1. At 4, 7 and 10, 2 aliens land on the pad; with no pad, the nearest calm
   * group hunts the squad.
   */
  land(): void {
    const game = this.game
    game.alarm += 1
    if (!STEPS.includes(game.alarm)) return
    if (game.pad) this.drop(game.pad)
    else game.stealth.hunt()
  }

  /** The alarm value of the next help, or null when no more comes. */
  next(): number | null {
    return STEPS.find((s) => s > this.game.alarm) ?? null
  }

  /** Where aliens land at the end of this round, or null. */
  coming(): Point | null {
    const game = this.game
    return game.pad && STEPS.includes(game.alarm + 1) ? game.pad : null
  }

  private drop(at: Point): void {
    const game = this.game
    const id = `d${game.groups.filter((g) => g.id.startsWith("d")).length + 1}`
    const taken = new Set(game.units.filter((u) => u.alive() || u.down > 0).map((u) => key(u.pos)))
    const target = game.units.find((u) => u.alive() && u.side === "squad")?.pos ?? null
    const landing = game.groups.find((g) => g.landing)?.landing
    game.groups.push({ id, revealed: true, target: target && { ...target }, alarmed: true, landing })
    for (const [i, kind] of composition(game.dice, 2).entries()) {
      const u = Unit.of(`${id}-${i + 1}`, kind, "enemy", free(game.board, at, taken), kind, id)
      u.alert = "engaged"
      game.units.push(u)
    }
    game.log.push({ key: "log.drop", params: { count: 2 } })
  }
}
