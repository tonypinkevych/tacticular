import { ORTHOGONAL, plus } from "../map/point"
import { blocksMove } from "../map/tile"
import type { Side } from "../units/unit"
import type { Game, Mark } from "./game"

/** The change of sides: what ends with a turn, what ends with a round, and what starts a turn. */
export class Turn {
  constructor(private readonly game: Game) {}

  end(): void {
    const game = this.game
    if (game.phase === "squad") {
      game.phase = "enemy"
      this.begin("enemy")
    } else {
      for (const u of game.units) u.rallied = false
      this.close()
      game.round += 1
      game.phase = "squad"
      game.log.push({ key: "log.round", params: { round: game.round } })
      this.begin("squad")
    }
    game.settle()
  }

  /** The end of a round: units in fire burn, fire spreads to the next forest, and the next drop is marked. */
  private close(): void {
    const game = this.game
    for (const u of game.units) if (u.alive() && game.board.at(u.at) === "fire") game.combat.burn(u)
    const fires = game.board.tiles.flatMap((t, i) =>
      t === "fire" ? [{ x: i % game.board.width, y: Math.floor(i / game.board.width) }] : [],
    )
    for (const f of fires)
      for (const d of ORTHOGONAL) if (game.board.at(plus(f, d)) === "forest") game.board.set(plus(f, d), "fire")
    game.reinforcements.mark()
  }

  /** A side's turn starts: 2 AP, cooldowns count down, overwatch ends, then a drop and marked attacks land. */
  private begin(side: Side): void {
    const game = this.game
    for (const u of game.units.filter((x) => x.side === side && x.alive())) {
      u.ap = 2
      u.moved = false
      u.overwatch = false
      u.cooldown = Math.max(0, u.cooldown - 1)
    }
    if (side === "enemy") game.reinforcements.land()
    const marks = game.marks.filter((m) => game.unit(m.unit).side === side)
    game.marks = game.marks.filter((m) => !marks.includes(m))
    for (const m of marks) if (game.unit(m.unit).alive()) this.land(m)
  }

  private land(m: Mark): void {
    const game = this.game,
      u = game.unit(m.unit)
    if (m.kind === "blast") {
      game.log.push({ key: "log.blast", params: { unit: u.id } })
      game.combat.blast(m.tiles[0], u.profile.damage)
      return
    }
    game.log.push({ key: "log.rush", params: { unit: u.id } })
    for (const p of m.tiles) {
      const hit = game.unitAt(p)
      if (hit) {
        game.combat.fire(u, hit)
        return
      }
      if (blocksMove(game.board.at(p))) return
      u.at = { ...p }
      if (game.board.at(p) === "fire") game.combat.burn(u)
      if (!u.alive()) return
    }
  }
}
