import { decide, known, toward } from "./ai/ai"
import { play } from "./play"
import { Illegal } from "./rules/actions"
import { distance, key, reach } from "./rules/grid"
import type { Action, Game, Unit } from "./rules/types"
import { alive, sideOf } from "./rules/units"

/** Plays a whole mission with the AI on both sides; used for balance runs. */
export function simulate(game: Game, rounds = 30): Game {
  let g = game
  while ((g.phase === "squad" || g.phase === "enemy") && g.round <= rounds) {
    for (const { id } of g.units.filter((u) => alive(u) && sideOf(u) === "squad")) {
      for (let i = 0; i < 4 && g.phase === "squad"; i++) {
        const u = g.units.find((x) => x.id === id)!
        if (!alive(u) || sideOf(u) !== "squad") break
        const action = known(g, u).length === 0 ? explore(g, u) : decide(g, u)
        if (!action) break
        try {
          g = play(g, action)
        } catch (e) {
          if (!(e instanceof Illegal)) throw e
          break
        }
      }
    }
    if (g.phase === "squad") g = play(g, { type: "endTurn" })
  }
  return g
}

/** Squad policy with no enemy in sight: walk to the nearest unexplored tile. */
function explore(game: Game, u: Unit): Action | null {
  if (u.moved && u.ap < 2) return null
  const w = game.board.width
  const open = reach(game, u, 400).cost
  const fog = game.explored.flatMap((seen, i) =>
    seen || !open.has(key({ x: i % w, y: Math.floor(i / w) })) ? [] : [{ x: i % w, y: Math.floor(i / w) }],
  )
  const goal = fog.sort((a, b) => distance(u.pos, a) - distance(u.pos, b))[0]
  return goal ? toward(game, u, goal) : null
}
