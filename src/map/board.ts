import type { Point } from "./point"
import { broken, type Tile } from "./tile"

const LEGEND: Record<string, Tile> = {
  ".": "grass",
  "=": "road",
  T: "forest",
  r: "rubble",
  "~": "water",
  f: "fire",
  l: "bags",
  t: "torn",
  h: "rock",
  c: "cracked",
  "#": "house",
  b: "barrel",
}

/** The tiles of a map, row by row; outside the map is a building. */
export class Board {
  constructor(
    readonly width: number,
    readonly height: number,
    public tiles: Tile[] = new Array(width * height).fill("grass"),
  ) {}

  /** Reads a board from text rows; any unknown symbol is grass. */
  static parse(rows: string[]): Board {
    return new Board(
      rows[0].length,
      rows.length,
      rows
        .join("")
        .split("")
        .map((c) => LEGEND[c] ?? "grass"),
    )
  }

  inside(p: Point): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height
  }

  at(p: Point): Tile {
    return this.inside(p) ? this.tiles[p.y * this.width + p.x] : "house"
  }

  /** Changes a tile; a point outside the map changes nothing. */
  set(p: Point, tile: Tile): void {
    if (this.inside(p)) this.tiles[p.y * this.width + p.x] = tile
  }

  /** Leaves on a tile what a blast leaves of it. */
  break(p: Point): void {
    this.set(p, broken(this.at(p)))
  }

  clone(): Board {
    return new Board(this.width, this.height, [...this.tiles])
  }
}
