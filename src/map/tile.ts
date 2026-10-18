/** What stands on one board square. */
export type Tile =
  | "floor"
  | "low"
  | "high"
  | "wall"
  | "door"
  | "open"
  | "water"
  | "bridge"
  | "ridge"
  | "roof"
  | "ladder"
  | "grass"
  | "tree"
  | "rock"
  | "mud"
  | "barrel"

export const walkable = (tile: Tile): boolean =>
  tile === "floor" ||
  tile === "open" ||
  tile === "bridge" ||
  tile === "ridge" ||
  tile === "roof" ||
  tile === "ladder" ||
  tile === "grass" ||
  tile === "mud"

/** High ground: a ridge or a rooftop. */
export const high = (tile: Tile): boolean => tile === "ridge" || tile === "roof"

/** A step between two tiles that a roof allows: up onto a roof only by a ladder or another roof; down anywhere. */
export const climb = (from: Tile, to: Tile): boolean => to !== "roof" || from === "roof" || from === "ladder"

/** A tile a walk can pass: walkable ground, or a closed door that opens on the way. */
export const passable = (tile: Tile): boolean => walkable(tile) || tile === "door"

export const blocksSight = (tile: Tile): boolean =>
  tile === "wall" || tile === "high" || tile === "door" || tile === "tree" || tile === "rock"

/** Defense a tile gives to a unit behind it. */
export function coverOf(tile: Tile): number {
  if (tile === "low" || tile === "barrel") return 2
  if (tile === "high" || tile === "wall" || tile === "door" || tile === "roof" || tile === "tree" || tile === "rock")
    return 5
  return 0
}
