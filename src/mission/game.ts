import { Reinforcements } from "../aliens/reinforcements"
import { Abilities } from "../combat/abilities"
import { Combat } from "../combat/combat"
import { Dice } from "../combat/dice"
import type { Board } from "../map/board"
import { type Point, same } from "../map/point"
import { Reach } from "../map/reach"
import type { Unit } from "../units/unit"
import { type Action, Orders } from "./orders"
import { Turn } from "./turn"

export interface Entry {
  key: string
  params: Record<string, string | number | boolean>
}

export type Phase = "squad" | "enemy" | "won" | "lost"

/** What wins the mission besides killing every alien. */
export type Goal =
  | { kind: "kill" }
  | { kind: "evac"; tiles: Point[] }
  | { kind: "defend"; at: Point; rounds: number; strikes: number }

/** An alien attack shown a turn before it lands: a Bomber's blast or a Brute's charge. */
export interface Mark {
  kind: "blast" | "charge"
  unit: string
  tiles: Point[]
}

/** The saved fields of a game. */
export interface GameData {
  seed: number
  rng: number
  round: number
  phase: Phase
  board: Board
  units: Unit[]
  marks: Mark[]
  /** Tiles where the next alien drop lands. */
  landing: Point[]
  /** Alien drops left in the mission. */
  drops: number
  goal: Goal
  log: Entry[]
}

/** What a new game starts from. */
export interface Setup {
  seed: number
  board: Board
  units: Unit[]
  drops?: number
  goal?: Goal
}

/**
 * One moment of a mission: the board, the units and everything the rules track. An action makes a new game
 * and leaves this one as it is.
 */
export class Game implements GameData {
  seed!: number
  rng!: number
  round!: number
  phase!: Phase
  board!: Board
  units!: Unit[]
  marks!: Mark[]
  landing!: Point[]
  drops!: number
  goal!: Goal
  log!: Entry[]
  readonly dice = new Dice(this)
  readonly combat = new Combat(this)
  readonly abilities = new Abilities(this)
  readonly turn = new Turn(this)
  readonly reinforcements = new Reinforcements(this)
  readonly orders = new Orders(this)

  constructor(data: GameData) {
    Object.assign(this, data)
  }

  /** A new game in the squad's first turn. */
  static start({ seed, board, units, drops = 2, goal = { kind: "kill" } }: Setup): Game {
    return new Game({
      seed,
      rng: seed,
      round: 1,
      phase: "squad",
      board,
      units,
      marks: [],
      landing: [],
      drops,
      goal,
      log: [],
    })
  }

  /** Applies one action and returns the next game; this game is not changed. */
  apply(action: Action): Game {
    const next = this.clone()
    next.orders.run(action)
    return next
  }

  clone(): Game {
    const plain = structuredClone({
      seed: this.seed,
      rng: this.rng,
      round: this.round,
      phase: this.phase,
      marks: this.marks,
      landing: this.landing,
      drops: this.drops,
      goal: this.goal,
      log: this.log,
    })
    return new Game({ ...plain, board: this.board.clone(), units: this.units.map((u) => u.clone()) })
  }

  unit(id: string): Unit {
    const u = this.units.find((x) => x.id === id)
    if (!u) throw new Error(`unknown unit ${id}`)
    return u
  }

  /** The living unit on a tile. */
  unitAt(p: Point): Unit | undefined {
    return this.units.find((u) => u.alive() && same(u.at, p))
  }

  foes(u: Unit): Unit[] {
    return this.units.filter((x) => x.alive() && x.side !== u.side)
  }

  allies(u: Unit): Unit[] {
    return this.units.filter((x) => x.alive() && x.side === u.side)
  }

  /** Tiles a unit can walk to with one move or two. */
  reach(unit: Unit, moves: number): Reach {
    return Reach.of(this, unit, moves)
  }

  /** Ends the mission when one side has no unit standing, or every living soldier has left by the evac. */
  settle(): void {
    if (this.phase === "won" || this.phase === "lost") return
    const squad = this.units.filter((u) => u.side === "squad")
    if (!this.units.some((u) => u.side === "enemy" && u.alive())) this.phase = "won"
    else if (squad.some((u) => u.alive())) return
    else this.phase = squad.some((u) => u.out && u.hp > 0) ? "won" : "lost"
  }
}
