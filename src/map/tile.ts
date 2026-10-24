/** What stands on one board square. */
export type Tile =
  | "grass"
  | "road"
  | "forest"
  | "rubble"
  | "water"
  | "fire"
  | "bags"
  | "torn"
  | "rock"
  | "cracked"
  | "house"
  | "barrel"

export const blocksMove = (tile: Tile): boolean =>
  tile === "water" ||
  tile === "bags" ||
  tile === "torn" ||
  tile === "rock" ||
  tile === "cracked" ||
  tile === "house" ||
  tile === "barrel"

export const blocksShot = (tile: Tile): boolean => tile === "rock" || tile === "cracked" || tile === "house"

/** Ground that ends a move on entry. */
export const rough = (tile: Tile): boolean => tile === "forest" || tile === "rubble"

/** The percent a tile takes from shots at a unit behind it or, for a forest, in it. */
export function coverOf(tile: Tile): number {
  if (tile === "rock" || tile === "cracked" || tile === "house") return 40
  if (tile === "bags" || tile === "torn" || tile === "barrel" || tile === "forest") return 20
  return 0
}

/** What a blast leaves of a tile; a barrel blows up on its own. */
export function broken(tile: Tile): Tile {
  if (tile === "bags") return "torn"
  if (tile === "rock") return "cracked"
  if (tile === "torn" || tile === "cracked") return "rubble"
  if (tile === "forest") return "fire"
  return tile
}
