import { adjacent, ORTHOGONAL, plus, same } from "../map/point"
import { blocksMove } from "../map/tile"
import type { Side } from "../units/unit"
import type { Game, Mark } from "./game"

/** The change of sides: what ends with a turn, what ends with a round, and what starts a turn. */
export class Turn {
  constructor(private readonly game: Game) {}

  end(): void {
    const game = this.game
    if (game.phase === "squad") {
      this.evacuate()
      game.phase = "enemy"
      this.begin("enemy")
    } else {
      for (const u of game.units) u.rallied = false
      this.close()
      if (game.phase === "lost") return
      game.round += 1
      if (game.goal.kind === "defend" && game.round > game.goal.rounds) {
        game.phase = "won"
        return
      }
      game.phase = "squad"
      game.log.push({ key: "log.round", params: { round: game.round } })
      this.begin("squad")
    }
    game.settle()
  }

  /** Soldiers on an evac tile leave the board at the end of the squad turn. */
  private evacuate(): void {
    const game = this.game,
      goal = game.goal
    if (goal.kind !== "evac") return
    for (const u of game.units)
      if (u.side === "squad" && u.alive() && goal.tiles.some((p) => same(p, u.at))) {
        u.out = true
        game.log.push({ key: "log.evac", params: { unit: u.id } })
      }
  }

  /** The end of a round: fire burns and spreads, the beacon is counted, and the next drop is marked. */
  private close(): void {
    const game = this.game
    this.hold()
    for (const u of game.units) if (u.alive() && game.board.at(u.at) === "fire") game.combat.burn(u)
    const fires = game.board.tiles.flatMap((t, i) =>
      t === "fire" ? [{ x: i % game.board.width, y: Math.floor(i / game.board.width) }] : [],
    )
    for (const f of fires)
      for (const d of ORTHOGONAL) if (game.board.at(plus(f, d)) === "forest") game.board.set(plus(f, d), "fire")
    game.reinforcements.mark()
  }

  /** Defend: aliens that outnumber soldiers around the beacon 2 round ends in a row win. */
  private hold(): void {
    const game = this.game,
      goal = game.goal
    if (goal.kind !== "defend") return
    const near = (side: Side) =>
      game.units.filter((u) => u.side === side && u.alive() && adjacent(u.at, goal.at, true)).length
    goal.strikes = near("enemy") > near("squad") ? goal.strikes + 1 : 0
    if (goal.strikes === 0) return
    game.log.push({ key: "log.beacon", params: {} })
    if (goal.strikes >= 2) game.phase = "lost"
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
