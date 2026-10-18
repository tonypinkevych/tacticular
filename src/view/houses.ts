import type { Board } from "../rules/board"
import { AROUND, key, ORTHOGONAL, type Point, plus } from "../rules/point"

const SHELL = new Set(["wall", "door", "open"])
const LARGEST = 48

/** The rooms of a board: floor closed in by walls and doors, each under a roof until a unit walks in. */
export class Houses {
  private readonly rooms = new Map<number, number>()
  private readonly shells = new Map<number, Set<number>>()

  constructor(private readonly board: Board) {}

  /** The rooms of a board worked out in full. */
  static of(board: Board): Houses {
    return new Houses(board).survey()
  }

  /** The room a tile is in, if any. */
  room(p: Point): number | undefined {
    return this.rooms.get(key(p))
  }

  /** True when a tile is inside a room and no unit stands in that room. */
  roofed(p: Point, units: Point[]): boolean {
    const r = this.room(p)
    return r !== undefined && !this.entered(r, units)
  }

  /** True when a tile is a wall or door of a room that a unit stands in. */
  open(p: Point, units: Point[]): boolean {
    for (const [r, shell] of this.shells) if (shell.has(key(p)) && this.entered(r, units)) return true
    return false
  }

  private entered(r: number, units: Point[]): boolean {
    return units.some((u) => this.rooms.get(key({ x: Math.round(u.x), y: Math.round(u.y) })) === r)
  }

  private survey(): Houses {
    this.flood((p) => SHELL.has(this.board.at(p)))
    this.flood((p) => SHELL.has(this.board.at(p)) || this.doorway(p))
    return this
  }

  /** A gap in a wall line: walls or doors on both sides along one axis. */
  private doorway(p: Point): boolean {
    const solid = (d: Point) => SHELL.has(this.board.at(plus(p, d)))
    return (solid({ x: 1, y: 0 }) && solid({ x: -1, y: 0 })) || (solid({ x: 0, y: 1 }) && solid({ x: 0, y: -1 }))
  }

  /** Marks each closed region of ground that is not yet a room; the shell decides what closes it. */
  private flood(shellAt: (p: Point) => boolean): void {
    const { board } = this
    const seen = new Set<number>(this.rooms.keys())
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const start = { x, y }
        if (seen.has(key(start)) || shellAt(start)) continue
        const region: Point[] = []
        const shell = new Set<number>()
        let edge = false
        const queue = [start]
        seen.add(key(start))
        while (queue.length > 0) {
          const p = queue.pop()!
          region.push(p)
          for (const d of ORTHOGONAL) {
            const n = plus(p, d)
            if (!board.inside(n)) edge = true
            else if (shellAt(n)) shell.add(key(n))
            else if (!seen.has(key(n))) {
              seen.add(key(n))
              queue.push(n)
            }
          }
        }
        if (edge || region.length > LARGEST || shell.size === 0) continue
        const id = this.shells.size
        for (const p of region) this.rooms.set(key(p), id)
        for (const k of [...shell])
          for (const d of AROUND) {
            const corner = plus({ x: k % 1000, y: Math.floor(k / 1000) }, d)
            if (board.at(corner) === "wall") shell.add(key(corner))
          }
        this.shells.set(id, shell)
      }
    }
  }
}
