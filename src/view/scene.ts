import type { Game } from "../rules/game"
import type { Point } from "../rules/point"
import type { Unit } from "../rules/unit"
import type { Daylight } from "./daylight"
import type { Houses } from "./houses"
import type { Float } from "./motion"

/** What the board shows at one moment: the game, the player's focus and the playback around it. */
export interface Scene {
  game: Game
  daylight: Daylight
  /** Keys of the tiles the squad sees now. */
  seen: Set<number>
  houses: Houses
  selected: Unit | null
  /** Tiles the selected soldier reaches for 1 AP and for 2 AP, shown while the cursor plans a move. */
  near: Set<number>
  far: Set<number>
  path: Point[]
  hover: Point | null
  /** Ids of the units an armed action can target. */
  targets: Set<string>
  /** Tiles an armed area action hits. */
  area: Point[]
  /** Tiles an armed action can reach. */
  range: Set<number>
  /** The unit an attack or a spell points at, with its hit chance in percent and its cover against the shooter. */
  aim: { target: Unit; chance: number; cover: number; from: Point } | null
  /** A soldier shown where Charge would land. */
  ghost: { unit: Unit; at: Point } | null
  zones: boolean
  mover: { id: string; at: Point } | null
  shot: { from: Point; to: Point; progress: number } | null
  texts: Float[]
  now: number
  life: number
}
