import type { Board } from "./board"
import { CLASSES } from "./data"
import { Dice } from "./dice"
import { Game } from "./game"
import { area, distance, key, type Point } from "./point"
import { flood, map, SIZE, type Site } from "./terrain"
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
  lead: Point | null,
): { units: Unit[]; groups: Group[] } {
  const count = 4
  const field = reachable.filter((p) => p.x >= Math.floor(board.width * 0.65))
  const anchors: Point[] = lead ? [lead] : []
  for (let tries = 0; anchors.length < count && tries < 400; tries++) {
    const p = r.pick(field)
    if (anchors.every((a) => distance(a, p) >= 6)) anchors.push(p)
  }
  const units: Unit[] = []
  const groups: Group[] = []
  anchors.forEach((anchor, g) => {
    const id = `g${g + 1}`
    groups.push({ id, revealed: false, target: null, landing: { ...landing } })
    const kinds = composition(r, lead && g === 0 ? 3 : r.between(2, 3))
    const route = [anchor, r.pick(field), r.pick(field)]
    for (const kind of kinds) {
      const u = Unit.of(`e${units.length + 1}`, kind, "enemy", free(board, anchor, taken), kind, id)
      u.patrol = route.map((p) => ({ ...p }))
      units.push(u)
    }
  })
  return { units, groups }
}

/** Kill all, Evac (a zone at the far edge) or Defend (the beacon on the hill the map was built with). */
function goal(r: Dice, board: Board, reachable: Point[], kind: Goal["kind"], site: Site | null): Goal {
  const floor = (p: Point) => board.tiles[p.y * board.width + p.x] === "floor"
  const open = reachable.filter(floor)
  if (kind === "evac") {
    const edge = open.filter((p) => p.x >= board.width - 2)
    if (edge.length === 0) return { kind: "kill" }
    const keys = new Set(open.map(key))
    const tiles = area(r.pick(edge), 1).filter((p) => keys.has(key(p)) && p.x >= board.width - 3)
    return { kind, tiles }
  }
  if (kind === "defend" && site) return { kind, at: site.at, rounds: 6 }
  return { kind: "kill" }
}

/** A new random mission from a seed: map, squad of 3 at one edge and 4 enemy groups toward the opposite edge. */
export function mission(seed: number): Game {
  const state = { rng: seed }
  const r = new Dice(state)
  const kind = r.pick(["kill", "evac", "defend"] as const)
  const site = place(r, kind)
  const rows = Array.from({ length: SIZE.height - 8 }, (_, i) => i + 4).filter(
    (y) => !site || Math.abs(y - site.at.y) >= 8,
  )
  const pad: Site | null =
    r.random() < 0.35 ? { kind: "pad", at: { x: Math.floor(SIZE.width * 0.86), y: r.pick(rows) } } : null
  let board = map(
    r,
    undefined,
    [site, pad].filter((s): s is Site => !!s),
  )
  const taken = new Set<number>()
  const team = squad(r, board, taken)
  const reachable = [...flood(board, team[0].pos)]
    .map((k) => ({ x: k % 1000, y: Math.floor(k / 1000) }))
    .filter((p) => board.tiles[p.y * board.width + p.x] !== "door")
  const { units, groups } = enemies(r, board, taken, reachable, team[0].pos, site?.kind === "yard" ? site.at : null)
  let aim = goal(r, board, reachable, kind, site)
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
    if (pad) pad.at = turn(pad.at)
    board = from.turn()
  }
  const game = Game.start({ seed, board, units: [...team, ...units], groups })
  game.goal = aim
  game.pad = pad?.at ?? null
  game.rng = state.rng
  return game
}

/** Where the map builds the mission's site: a yard far on the aliens' side for Kill all, a hill near the squad for Defend. */
function place(r: Dice, kind: Goal["kind"]): Site | null {
  const y = r.between(6, SIZE.height - 7)
  if (kind === "kill")
    return { kind: "yard", at: { x: r.between(Math.floor(SIZE.width * 0.75), Math.floor(SIZE.width * 0.8)), y } }
  if (kind === "defend") return { kind: "hill", at: { x: Math.floor(SIZE.width * 0.28), y } }
  return null
}
