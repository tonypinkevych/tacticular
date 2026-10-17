import { pick } from "./dice"
import { inside, key, tileAt } from "./grid"
import { composition, free } from "./mission"
import { visibleTiles } from "./sight"
import type { Game, Point } from "./types"
import { alive, makeUnit } from "./units"

const DROPS = 3
const EVERY = 3

/** An edge tile in the far half of the map that no soldier sees. */
function spot(game: Game): Point {
  const { width, height } = game.board
  const seen = new Set<number>()
  for (const u of game.units) if (alive(u) && u.side === "squad") for (const k of visibleTiles(game, u)) seen.add(k)
  const edge: Point[] = []
  for (let y = 0; y < height; y++) {
    for (let x = Math.floor(width / 2); x < width; x++) {
      const p = { x, y }
      if (x !== width - 1 && y !== 0 && y !== height - 1) continue
      if (inside(game.board, p) && tileAt(game, p) === "floor" && !seen.has(key(p))) edge.push(p)
    }
  }
  return edge.length > 0 ? pick(game, edge) : { x: width - 1, y: Math.floor(height / 2) }
}

/** Round end: after the alarm, 2 aliens land at the planned spot every 3 rounds, at most 3 times. */
export function reinforce(game: Game): void {
  if (game.drop && game.drop.round === game.round) {
    const id = `d${game.drops + 1}`
    const taken = new Set(game.units.filter((u) => alive(u) || u.down > 0).map((u) => key(u.pos)))
    const target = game.units.find((u) => alive(u) && u.side === "squad")?.pos ?? null
    game.groups.push({ id, revealed: true, target: target && { ...target }, alarmed: true })
    for (const [i, kind] of composition(game, 2).entries()) {
      const u = makeUnit(`${id}-${i + 1}`, kind, "enemy", free(game.board, game.drop.at, taken), kind, id)
      u.alert = "engaged"
      game.units.push(u)
    }
    game.log.push({ key: "log.drop", params: { count: 2 } })
    game.drops += 1
    game.drop = null
    if (game.drops >= DROPS) return
  }
  if (!game.drop && game.drops < DROPS && game.groups.some((g) => g.alarmed))
    game.drop = { at: spot(game), round: game.round + EVERY }
}
