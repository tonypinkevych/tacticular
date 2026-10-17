import { hurt } from "./combat"
import { calm, horn, observe } from "./stealth"
import type { Game, Side } from "./types"
import { alive, sideOf } from "./units"

/** Ends the active side's phase; the enemy phase ends the round. */
export function endPhase(game: Game): void {
  if (game.phase === "squad") {
    startPhase(game, "enemy")
    return
  }
  endRound(game)
  startPhase(game, "squad")
}

export function startPhase(game: Game, side: Side): void {
  game.phase = side
  for (const u of game.units) {
    if (!alive(u)) continue
    u.statuses = u.statuses.filter((s) => {
      const source = game.units.find((x) => x.id === s.source)
      return !(s.id === "suppressed" && source && sideOf(source) === side)
    })
    if (sideOf(u) !== side) {
      u.ap = 0
      continue
    }
    u.ap = 2
    u.moved = false
    u.stance = "none"
  }
  observe(game)
}

function endRound(game: Game): void {
  horn(game)
  calm(game)
  for (const u of game.units) {
    if (!alive(u)) continue
    if (u.statuses.some((s) => s.id === "burning")) {
      game.log.push({ key: "log.burning", params: { unit: u.id, dmg: 2 } })
      hurt(game, u, 2)
    }
    u.statuses = u.statuses
      .map((s) => (s.id === "suppressed" ? s : { ...s, rounds: s.rounds - 1 }))
      .filter((s) => s.rounds > 0)
    for (const id of Object.keys(u.cooldowns) as (keyof typeof u.cooldowns)[]) {
      const left = (u.cooldowns[id] ?? 0) - 1
      u.cooldowns[id] = left > 0 ? left : undefined
    }
  }
  game.zones = game.zones.map((z) => ({ ...z, rounds: z.rounds - 1 })).filter((z) => z.rounds > 0)
  game.round += 1
  game.log.push({ key: "log.round", params: { round: game.round } })
}
