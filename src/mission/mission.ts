import { Dice } from "../combat/dice"
import type { Point } from "../map/point"
import { BIOMES, type Biome, terrain } from "../map/terrain"
import { blocksMove } from "../map/tile"
import type { AlienId, ClassId } from "../units/profiles"
import { type Training, Unit } from "../units/unit"
import { Game, type Goal } from "./game"

export type GoalKind = "kill" | "evac" | "defend"

/** A soldier carried into a mission, with the HP it left the last one with. */
export interface Recruit {
  id: string
  kind: ClassId
  hp?: number
  extra?: Training
}

/** What a mission is built from besides its seed. */
export interface Conditions {
  goal: GoalKind
  squad: Recruit[]
  /** Each 3 threat adds an alien. */
  threat?: number
  /** The fortress: the Commander joins the aliens. */
  boss?: boolean
  /** The land of the map; the seed picks one when unset. */
  biome?: Biome
}

const ALIENS: AlienId[] = ["grunt", "grunt", "brute", "bomber"]

/** A new mission from a seed: its map, the squad on the bottom row, 5 aliens and more with threat on the top two, one drop, and its goal. */
export function mission(seed: number, c: Conditions): Game {
  const board = terrain(seed, c.biome ?? BIOMES[seed % BIOMES.length]),
    dice = new Dice({ rng: seed * 31 + 7 })
  const free = (rows: number[]) =>
    dice.shuffle(
      rows.flatMap((y) => Array.from({ length: 8 }, (_, x) => ({ x, y }))).filter((p) => !blocksMove(board.at(p))),
    )
  const bottom = free([7]).sort((a, b) => a.x - b.x)
  const step = bottom.length / c.squad.length
  const squad = c.squad.map((r, i) => {
    const u = Unit.of(r.id, r.kind, "squad", bottom[Math.floor(i * step + step / 2)], r.extra)
    if (r.hp !== undefined) u.hp = r.hp
    return u
  })
  const kinds: AlienId[] = [
    ...ALIENS.slice(0, 3),
    ...Array.from({ length: aliens({ threat: c.threat }) - 3 }, () => dice.pick(ALIENS)),
  ]
  if (c.boss) kinds.push("commander")
  const top = free([0, 1])
  const foes = kinds.map((k, i) => Unit.of(`a${i}`, k, "enemy", top[i]))
  return Game.start({
    seed,
    board,
    drops: 1,
    units: [...squad, ...foes],
    goal: goal(
      c.goal,
      board.tiles.map((_, i) => ({ x: i % 8, y: Math.floor(i / 8) })).filter((p) => !blocksMove(board.at(p))),
    ),
  })
}

/** How many aliens a mission starts with: 5, one more for each 3 threat, and the Commander at the fortress. */
export function aliens(c: Pick<Conditions, "threat" | "boss">): number {
  return 5 + Math.floor((c.threat ?? 0) / 3) + (c.boss ? 1 : 0)
}

function goal(kind: GoalKind, open: Point[]): Goal {
  if (kind === "evac") return { kind, tiles: open.filter((p) => p.y === 0) }
  if (kind === "defend") {
    const middle = open.filter((p) => p.y === 5 && p.x >= 2 && p.x <= 5)
    return { kind, at: middle[0] ?? { x: 3, y: 3 }, rounds: 5, strikes: 0 }
  }
  return { kind: "kill" }
}
