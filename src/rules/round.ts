import { hurt } from "./combat"
import { reinforce } from "./drop"
import { distance, same } from "./grid"
import { calm, horn, observe, visibleToSquad } from "./stealth"
import type { Game, Side, Unit } from "./types"
import { alive, sideOf } from "./units"

/** Ends the active side's phase; the enemy phase ends the round. */
export function endPhase(game: Game): void {
  if (game.phase === "squad") {
    startPhase(game, "enemy")
    return
  }
  hide(game)
  endRound(game)
  if (game.phase === "enemy") startPhase(game, "squad")
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
    advance(u)
  }
  observe(game)
}

/** Defend: an alien on the beacon at round end loses the mission; holding it to the last round wins. */
function hold(game: Game): void {
  const goal = game.goal
  if (goal.kind !== "defend") return
  if (game.units.some((u) => alive(u) && u.side === "enemy" && same(u.pos, goal.at))) {
    game.log.push({ key: "log.beacon", params: {} })
    game.phase = "lost"
  } else if (game.round >= goal.rounds) game.phase = "won"
}

/** Stalkers that no soldier sees take cover in the shadows again. */
function hide(game: Game): void {
  for (const u of game.units) {
    if (!alive(u) || u.kind !== "assassin" || u.side !== "enemy") continue
    u.concealed = false
    u.concealed = !visibleToSquad(game, u)
  }
}

/** Moves a patrol on to its next point when the unit already stands at the current one. */
function advance(u: Unit): void {
  for (let i = 0; i < u.patrol.length; i++) {
    if (distance(u.pos, u.patrol[u.patrolIndex % u.patrol.length]) > 1) return
    u.patrolIndex = (u.patrolIndex + 1) % u.patrol.length
  }
}

function endRound(game: Game): void {
  horn(game)
  calm(game)
  for (const u of game.units) {
    if (u.down === 0) continue
    u.down -= 1
    if (u.down === 0) game.log.push({ key: "log.dies", params: { unit: u.id } })
  }
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
  reinforce(game)
  hold(game)
  game.round += 1
  game.log.push({ key: "log.round", params: { round: game.round } })
}
