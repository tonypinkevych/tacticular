import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"
import { ORTHOGONAL, type Point, plus, same } from "./point"
import type { Tile } from "./tile"

const flammable = (t: Tile): boolean => t === "grass" || t === "tree"

/** The fires burning on a game's board. */
export class Fire {
  constructor(private readonly game: Game) {}

  burning(p: Point): boolean {
    return this.game.zones.some((z) => z.kind === "fire" && z.tiles.some((t) => same(t, p)))
  }

  /** Sets grass or a tree on fire for 2 rounds; returns false when the tile does not catch. */
  ignite(p: Point): boolean {
    if (!this.game.board.inside(p) || !flammable(this.game.tile(p)) || this.burning(p)) return false
    this.game.zones.push({ kind: "fire", tiles: [{ ...p }], rounds: 2 })
    return true
  }

  /** A unit in fire takes 1 damage. */
  scorch(u: Unit): void {
    if (!u.alive() || !this.burning(u.pos)) return
    this.game.log.push({ key: "log.fire", params: { target: u.id, dmg: 1 } })
    this.game.combat.hurt(u, 1)
  }

  /** Round end: fire burns the units in it, catches the next grass and trees, and burnt tiles turn to ash or stumps. */
  spread(): void {
    const { board, units, zones } = this.game
    const fires = zones.filter((z) => z.kind === "fire")
    for (const u of units) this.scorch(u)
    for (const z of fires) for (const t of z.tiles) for (const d of ORTHOGONAL) this.ignite(plus(t, d))
    for (const z of fires) {
      if (z.rounds > 1) continue
      for (const t of z.tiles) {
        if (board.at(t) === "grass") board.set(t, "floor")
        if (board.at(t) === "tree") board.set(t, "low")
      }
    }
  }
}
