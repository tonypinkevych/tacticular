import { Reinforcements } from "../aliens/reinforcements"
import { type Group, type Noise, Stealth } from "../aliens/stealth"
import { Abilities } from "../combat/abilities"
import { Combat } from "../combat/combat"
import { Dice } from "../combat/dice"
import type { Board } from "../map/board"
import { Cover } from "../map/cover"
import { Fire } from "../map/fire"
import { type Point, same } from "../map/point"
import { Reach } from "../map/reach"
import { Sight } from "../map/sight"
import type { Tile } from "../map/tile"
import type { Side, Unit } from "../units/unit"
import { type Action, Orders } from "./orders"
import { Turn } from "./turn"

export interface Zone {
  kind: "smoke" | "fire" | "mine"
  tiles: Point[]
  rounds: number
}

export interface Entry {
  key: string
  params: Record<string, string | number | boolean>
}

export type Phase = "squad" | "enemy" | "won" | "lost"

/** What wins the mission besides killing every alien. */
export type Goal =
  | { kind: "kill" }
  | { kind: "warchief"; tiles: Point[]; slain: boolean }
  | { kind: "evac"; tiles: Point[] }
  | { kind: "defend"; at: Point; rounds: number }
  | { kind: "intel"; at: Point; taken: boolean; tiles: Point[] }
  | { kind: "vip"; captive: string; tiles: Point[] }
  | { kind: "relay"; at: Point; planted: number | null }

/** The saved fields of a game. */
export interface GameData {
  seed: number
  rng: number
  round: number
  phase: Phase
  board: Board
  units: Unit[]
  zones: Zone[]
  groups: Group[]
  explored: boolean[]
  noises: Noise[]
  reactions: string[]
  log: Entry[]
  goal: Goal
  /** Where alien reinforcements land; a map with no pad gets none. */
  pad: Point | null
  /** Rises each round; at some values the aliens get help. */
  alarm: number
}

/** What a new game starts from. */
export interface Setup {
  seed: number
  board: Board
  units: Unit[]
  groups?: Group[]
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
  zones!: Zone[]
  groups!: Group[]
  explored!: boolean[]
  noises!: Noise[]
  reactions!: string[]
  log!: Entry[]
  goal!: Goal
  pad!: Point | null
  alarm!: number
  readonly dice = new Dice(this)
  readonly sight = new Sight(this)
  readonly cover = new Cover(this)
  readonly stealth = new Stealth(this)
  readonly fire = new Fire(this)
  readonly combat = new Combat(this)
  readonly reinforcements = new Reinforcements(this)
  readonly turn = new Turn(this)
  readonly orders = new Orders(this)
  readonly abilities = new Abilities(this)

  constructor(data: GameData) {
    Object.assign(this, data)
  }

  /** A new game in the squad phase, with the squad's first view of the board explored. */
  static start({ seed, board, units, groups = [] }: Setup): Game {
    const game = new Game({
      seed,
      rng: seed,
      round: 1,
      phase: "squad",
      board,
      units,
      zones: [],
      groups,
      explored: new Array(board.width * board.height).fill(false),
      noises: [],
      reactions: [],
      log: [],
      goal: { kind: "kill" },
      pad: null,
      alarm: 0,
    })
    game.stealth.observe()
    return game
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
      zones: this.zones,
      groups: this.groups,
      explored: this.explored,
      noises: this.noises,
      reactions: this.reactions,
      log: this.log,
      goal: this.goal,
      pad: this.pad,
      alarm: this.alarm,
    })
    return new Game({ ...plain, board: this.board.clone(), units: this.units.map((u) => u.clone()) })
  }

  tile(p: Point): Tile {
    return this.board.at(p)
  }

  unit(id: string): Unit {
    const u = this.units.find((x) => x.id === id)
    if (!u) throw new Error(`unknown unit ${id}`)
    return u
  }

  /** The unit on a tile: a living one, or a downed soldier. */
  unitAt(p: Point): Unit | undefined {
    return this.units.find((u) => (u.hp > 0 || u.down > 0) && same(u.pos, p))
  }

  /** Living units that fight against a unit now. */
  foesOf(u: Unit): Unit[] {
    return this.units.filter((x) => x.alive() && x.allegiance() !== u.allegiance())
  }

  /** Tiles a unit can walk to within a budget, with the way to each. */
  reach(unit: Unit, budget: number, side: Side = unit.side): Reach {
    return Reach.of(this, unit, budget, side)
  }
}
