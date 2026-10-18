import type { Point } from "./point"
import type { Tile } from "./tile"

/** The kind of land a mission takes place in; it shapes the map and its look. */
export type Biome = "forest" | "village" | "town"

const LEGEND: Record<string, Tile> = {
  ".": "floor",
  ":": "low",
  H: "high",
  "#": "wall",
  "+": "door",
  "~": "water",
  "=": "bridge",
  ",": "floor",
  "^": "ridge",
  R: "roof",
  L: "ladder",
  g: "grass",
  T: "tree",
  o: "rock",
  m: "mud",
}

/** The tiles of a map, row by row; outside the map is wall. */
export class Board {
  constructor(
    readonly width: number,
    readonly height: number,
    public tiles: Tile[] = new Array(width * height).fill("floor"),
    readonly biome?: Biome,
  ) {}

  /** Reads a board from text rows; any unknown symbol is floor. */
  static parse(rows: string[]): Board {
    return new Board(
      rows[0].length,
      rows.length,
      rows
        .join("")
        .split("")
        .map((c) => LEGEND[c] ?? "floor"),
    )
  }

  inside(p: Point): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height
  }

  at(p: Point): Tile {
    return this.inside(p) ? this.tiles[p.y * this.width + p.x] : "wall"
  }

  /** Changes a tile; a point outside the map changes nothing. */
  set(p: Point, tile: Tile): void {
    if (this.inside(p)) this.tiles[p.y * this.width + p.x] = tile
  }

  /** Damages cover on a tile: high cover and trees become low, low cover is gone; walls, doors and rocks stay. */
  break(p: Point): void {
    const tile = this.at(p)
    if (tile === "low") this.set(p, "floor")
    if (tile === "high" || tile === "tree") this.set(p, "low")
  }

  /** The map turned a quarter clockwise. */
  turn(): Board {
    const out = new Board(this.height, this.width, undefined, this.biome)
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) out.set(this.turned({ x, y }), this.at({ x, y }))
    return out
  }

  /** Where a point of this map lands when the map turns a quarter clockwise. */
  turned(p: Point): Point {
    return { x: this.height - 1 - p.y, y: p.x }
  }

  /** The same map in a given biome. */
  in(biome: Biome): Board {
    return new Board(this.width, this.height, this.tiles, biome)
  }

  clone(): Board {
    return new Board(this.width, this.height, [...this.tiles], this.biome)
  }
}
