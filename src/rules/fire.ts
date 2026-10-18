import { hurt } from "./combat"
import { inside, ORTHOGONAL, plus, same, tileAt } from "./grid"
import type { Game, Point, Tile, Unit } from "./types"
import { alive } from "./units"

const flammable = (t: Tile): boolean => t === "grass" || t === "tree"

export function burning(game: Game, p: Point): boolean {
  return game.zones.some((z) => z.kind === "fire" && z.tiles.some((t) => same(t, p)))
}

/** Sets grass or a tree on fire for 2 rounds; returns false when the tile does not catch. */
export function ignite(game: Game, p: Point): boolean {
  if (!inside(game.board, p) || !flammable(tileAt(game, p)) || burning(game, p)) return false
  game.zones.push({ kind: "fire", tiles: [{ ...p }], rounds: 2 })
  return true
}

/** A unit in fire takes 1 damage. */
export function scorch(game: Game, u: Unit): void {
  if (!alive(u) || !burning(game, u.pos)) return
  game.log.push({ key: "log.fire", params: { target: u.id, dmg: 1 } })
  hurt(game, u, 1)
}

/** Round end: fire burns the units in it, catches the next grass and trees, and burnt tiles turn to ash or stumps. */
export function spread(game: Game): void {
  const fires = game.zones.filter((z) => z.kind === "fire")
  for (const u of game.units) scorch(game, u)
  for (const z of fires) for (const t of z.tiles) for (const d of ORTHOGONAL) ignite(game, plus(t, d))
  for (const z of fires) {
    if (z.rounds > 1) continue
    for (const t of z.tiles) {
      const i = t.y * game.board.width + t.x
      if (game.board.tiles[i] === "grass") game.board.tiles[i] = "floor"
      if (game.board.tiles[i] === "tree") game.board.tiles[i] = "low"
    }
  }
}
