import { adjacent, distance, ORTHOGONAL, type Point, plus, same } from "../map/point"
import { clear } from "../map/sight"
import { blocksMove } from "../map/tile"
import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"

/** The tiles an action sweeps on a board: fire, a barrel's blast and each ultimate. */
export class Sweep {
  constructor(private readonly game: Game) {}

  /** Whether a soldier's ultimate acts from where it stands, with no target to click. */
  static self(u: Unit): boolean {
    const k = u.profile.ultimate
    return k === "lockdown" || k === "barrage" || k === "whirlwind"
  }

  all(): Point[] {
    const b = this.game.board
    return b.tiles.map((_, i) => ({ x: i % b.width, y: Math.floor(i / b.width) }))
  }

  /** The tiles a unit can fire at from a tile: next to it in melee, else in its range and sight. */
  fire(u: Unit, from: Point): Point[] {
    return this.all().filter((p) =>
      u.profile.melee ? adjacent(p, from) : distance(p, from) <= u.profile.range && clear(this.game.board, from, p),
    )
  }

  /** The tiles a barrel's blast hits, with the blasts of the barrels it sets off. */
  blast(at: Point): Point[] {
    const board = this.game.board,
      hit: Point[] = [],
      blown: Point[] = [at]
    for (let i = 0; i < blown.length; i++)
      for (const p of [blown[i], ...ORTHOGONAL.map((d) => plus(blown[i], d))].filter((q) => board.inside(q))) {
        if (!hit.some((q) => same(p, q))) hit.push(p)
        if (board.at(p) === "barrel" && !blown.some((q) => same(p, q))) blown.push(p)
      }
    return hit
  }

  /** The tiles an ultimate reaches, the aliens it hits, and for Breach the line to the pointed tile. */
  ultimate(u: Unit, hover: Point | null): { reach: Point[]; targets: Point[]; area: Point[] } {
    const g = this.game,
      foes = g.foes(u)
    const within = (reach: Point[]) => ({
      reach,
      targets: foes.filter((f) => reach.some((p) => same(p, f.at))).map((f) => f.at),
      area: [] as Point[],
    })
    switch (u.profile.ultimate) {
      case "killshot":
        return within(this.fire(u, u.at))
      case "lockdown":
        return within(this.all().filter((p) => distance(p, u.at) <= u.profile.range && clear(g.board, u.at, p)))
      case "barrage":
        return within(this.all().filter((p) => distance(p, u.at) <= 2))
      case "whirlwind":
        return within(this.all().filter((p) => distance(p, u.at) === 1))
      default: {
        const ends: Point[] = []
        for (const d of ORTHOGONAL)
          for (let n = 1; n <= 3; n++) {
            const p = { x: u.at.x + d.x * n, y: u.at.y + d.y * n }
            if (!g.board.inside(p) || blocksMove(g.board.at(p)) || g.unitAt(p)) break
            ends.push(p)
          }
        const end = hover && ends.find((p) => same(p, hover))
        if (!end) return { reach: ends, targets: [], area: [] }
        const n = distance(u.at, end),
          d = { x: Math.sign(end.x - u.at.x), y: Math.sign(end.y - u.at.y) }
        const path = Array.from({ length: n }, (_, i) => ({ x: u.at.x + d.x * (i + 1), y: u.at.y + d.y * (i + 1) }))
        const hit = foes.filter((f) => path.some((p) => ORTHOGONAL.some((o) => same(plus(p, o), f.at))))
        return { reach: ends, targets: hit.map((f) => f.at), area: path }
      }
    }
  }
}
