import type { Board } from "./board"
import { CLASSES } from "./data"
import { Dice } from "./dice"
import { Game } from "./game"
import { area, distance, key, type Point } from "./point"
import { flood, map } from "./terrain"
import type { EnemyKind, Goal, Group } from "./types"
import { Unit } from "./unit"

const NAMES = [
  "Voss",
  "Reyes",
  "Okafor",
  "Novak",
  "Ivanova",
  "Tanaka",
  "Brandt",
  "Mercer",
  "Haddad",
  "Lindqvist",
  "Petrov",
  "Santos",
  "Kim",
  "Moreau",
  "Byrne",
  "Duarte",
  "Falk",
  "Grant",
  "Hale",
  "Ortiz",
  "Sato",
  "Kane",
  "Weber",
  "Ruiz",
]

function squad(r: Dice, board: Board, taken: Set<number>): Unit[] {
  const classes = r.shuffle(CLASSES).slice(0, 3)
  const names = r.shuffle(NAMES)
  const mid = Math.floor(board.height / 2)
  const spots = [-2, 0, 2].map((dy) => free(board, { x: 1, y: mid + dy }, taken))
  return classes.map((kind, i) =>
    Unit.of(`s${i + 1}`, kind, "squad", spots[i], names[i], null, {
      hp: r.between(-1, 1),
      aim: r.between(-1, 1),
      will: r.between(-1, 1),
    }),
  )
}

export function free(board: Board, near: Point, taken: Set<number>): Point {
  for (let radius = 0; radius < 10; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const p = { x: near.x + dx, y: near.y + dy }
        if (!board.inside(p) || taken.has(key(p))) continue
        const t = board.tiles[p.y * board.width + p.x]
        if (t !== "floor" && t !== "bridge") continue
        taken.add(key(p))
        return p
      }
    }
  }
  throw new Error("no free tile")
}

const SPECIALS: EnemyKind[] = ["ogre", "assassin", "whisperer"]
const LINE: EnemyKind[] = ["orc", "orc", "orc", "bomber", "shieldwall"]

/** Kinds in one enemy group: a Warchief when 3 or more, at most one special. */
export function composition(r: Dice, size: number): EnemyKind[] {
  const out: EnemyKind[] = size >= 3 ? ["warchief"] : []
  if (r.random() < 0.6) out.push(r.pick(SPECIALS))
  while (out.length < size) out.push(r.pick(LINE))
  return out
}

function enemies(
  r: Dice,
  board: Board,
  taken: Set<number>,
  reachable: Point[],
  landing: Point,
): { units: Unit[]; groups: Group[] } {
  const count = 4
  const field = reachable.filter((p) => p.x >= Math.floor(board.width * 0.6))
  const anchors: Point[] = []
  for (let tries = 0; anchors.length < count && tries < 400; tries++) {
    const p = r.pick(field)
    if (anchors.every((a) => distance(a, p) >= 6)) anchors.push(p)
  }
  const units: Unit[] = []
  const groups: Group[] = []
  anchors.forEach((anchor, g) => {
    const id = `g${g + 1}`
    groups.push({ id, revealed: false, target: null, landing: { ...landing } })
    const kinds = composition(r, r.between(2, 3))
    const route = [anchor, r.pick(field), r.pick(field)]
    for (const kind of kinds) {
      const u = Unit.of(`e${units.length + 1}`, kind, "enemy", free(board, anchor, taken), kind, id)
      u.patrol = route.map((p) => ({ ...p }))
      units.push(u)
    }
  })
  return { units, groups }
}

/** One of Kill all, Evac (a zone at the far edge) or Defend (a beacon between the squad and the aliens). */
function goal(r: Dice, board: Board, reachable: Point[]): Goal {
  const kind = r.pick(["kill", "evac", "defend"] as const)
  const floor = (p: Point) => board.tiles[p.y * board.width + p.x] === "floor"
  const open = reachable.filter(floor)
  if (kind === "evac") {
    const edge = open.filter((p) => p.x >= board.width - 2)
    if (edge.length === 0) return { kind: "kill" }
    const keys = new Set(open.map(key))
    const tiles = area(r.pick(edge), 1).filter((p) => keys.has(key(p)) && p.x >= board.width - 3)
    return { kind, tiles }
  }
  if (kind === "defend") {
    const mid = { x: Math.floor(board.width * 0.4), y: Math.floor(board.height / 2) }
    const at = [...open].sort((a, b) => distance(a, mid) - distance(b, mid))[0]
    return at ? { kind, at, rounds: 6 } : { kind: "kill" }
  }
  return { kind }
}

/** A new random mission from a seed: map, squad of 3 at one edge and 4 enemy groups toward the opposite edge. */
export function mission(seed: number): Game {
  const state = { rng: seed }
  const r = new Dice(state)
  let board = map(r)
  const taken = new Set<number>()
  const team = squad(r, board, taken)
  const reachable = [...flood(board, team[0].pos)]
    .map((k) => ({ x: k % 1000, y: Math.floor(k / 1000) }))
    .filter((p) => board.tiles[p.y * board.width + p.x] !== "door")
  const { units, groups } = enemies(r, board, taken, reachable, team[0].pos)
  let aim = goal(r, board, reachable)
  for (let turns = r.between(0, 3); turns > 0; turns--) {
    const from = board
    const turn = (p: Point): Point => from.turned(p)
    for (const u of [...team, ...units]) {
      u.pos = turn(u.pos)
      u.patrol = u.patrol.map(turn)
    }
    for (const g of groups) if (g.landing) g.landing = turn(g.landing)
    if (aim.kind === "evac") aim = { ...aim, tiles: aim.tiles.map(turn) }
    if (aim.kind === "defend") aim = { ...aim, at: turn(aim.at) }
    board = from.turn()
  }
  const game = Game.start({ seed, board, units: [...team, ...units], groups })
  game.goal = aim
  game.rng = state.rng
  return game
}
