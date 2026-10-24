import { Dice } from "../combat/dice"
import type { Point } from "../map/point"
import { terrain } from "../map/terrain"
import { blocksMove } from "../map/tile"
import type { AlienId, ClassId } from "../units/profiles"
import { Unit } from "../units/unit"
import { Game, type Goal } from "./game"

export type GoalKind = "kill" | "evac" | "defend"

/** A soldier carried into a mission, with the HP it left the last one with. */
export interface Recruit {
  id: string
  kind: ClassId
  hp?: number
}

/** What a mission is built from besides its seed. */
export interface Conditions {
  goal: GoalKind
  squad: Recruit[]
  /** Each 2 threat adds an alien. */
  threat?: number
  /** The fortress: the Commander joins the aliens. */
  boss?: boolean
}

const ALIENS: AlienId[] = ["grunt", "grunt", "brute", "bomber"]

/** A new mission from a seed: its map, the squad on the bottom row, the aliens on the top two, and its goal. */
export function mission(seed: number, c: Conditions): Game {
  const board = terrain(seed),
    dice = new Dice({ rng: seed * 31 + 7 })
  const free = (rows: number[]) =>
    dice.shuffle(
      rows.flatMap((y) => Array.from({ length: 8 }, (_, x) => ({ x, y }))).filter((p) => !blocksMove(board.at(p))),
    )
  const bottom = free([7]).sort((a, b) => a.x - b.x)
  const step = bottom.length / c.squad.length
  const squad = c.squad.map((r, i) => {
    const u = Unit.of(r.id, r.kind, "squad", bottom[Math.floor(i * step + step / 2)])
    if (r.hp !== undefined) u.hp = r.hp
    return u
  })
  const kinds: AlienId[] = [
    ...ALIENS,
    ...Array.from({ length: Math.floor((c.threat ?? 0) / 2) }, () => dice.pick(ALIENS)),
  ]
  if (c.boss) kinds.push("commander")
  const top = free([0, 1])
  const aliens = kinds.map((k, i) => Unit.of(`a${i}`, k, "enemy", top[i]))
  return Game.start({
    seed,
    board,
    units: [...squad, ...aliens],
    goal: goal(
      c.goal,
      board.tiles.map((_, i) => ({ x: i % 8, y: Math.floor(i / 8) })).filter((p) => !blocksMove(board.at(p))),
    ),
  })
}

function goal(kind: GoalKind, open: Point[]): Goal {
  if (kind === "evac") return { kind, tiles: open.filter((p) => p.y === 0) }
  if (kind === "defend") {
    const middle = open.filter((p) => p.y >= 3 && p.y <= 4 && p.x >= 2 && p.x <= 5)
    return { kind, at: middle[0] ?? { x: 3, y: 3 }, rounds: 5, strikes: 0 }
  }
  return { kind: "kill" }
}
