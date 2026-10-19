import type { Group } from "../aliens/stealth"
import type { AbilityId } from "../combat/abilities"
import { Dice } from "../combat/dice"
import type { Biome, Board } from "../map/board"
import { area, distance, key, type Point } from "../map/point"
import { flood, map, SIZE, type Site } from "../map/terrain"
import { CLASSES, type EnemyKind } from "../units/profiles"
import { type Recruit, Unit } from "../units/unit"
import { Game, type Goal } from "./game"

export const NAMES = [
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

/** The run's soldiers, or 3 random ones, at the west edge. */
function squad(r: Dice, board: Board, taken: Set<number>, recruits?: Recruit[]): Unit[] {
  const classes = r.shuffle(CLASSES).slice(0, 3)
  const names = r.shuffle(NAMES)
  const mid = Math.floor(board.height / 2)
  const random = classes.map(
    (kind, i): Recruit => ({
      id: `s${i + 1}`,
      kind,
      name: names[i],
      spread: { hp: r.between(-1, 1), aim: r.between(-1, 1), will: r.between(-1, 1) },
      hp: Infinity,
    }),
  )
  const team = recruits ?? random
  const spots = [-2, 0, 2, 4].slice(0, team.length).map((dy) => free(board, { x: 1, y: mid + dy }, taken))
  return team.map((s, i) => {
    const u = Unit.of(s.id, s.kind, "squad", spots[i], s.name, null, s.spread, s.ranks)
    u.hp = Math.min(u.maxHp, s.hp)
    if (s.might) u.might = s.might
    if (s.level) u.level = s.level
    return u
  })
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

/** Special alien kinds and the Force Level from which they come. */
const SPECIALS: Partial<Record<EnemyKind, number>> = { ogre: 2, assassin: 3, whisperer: 4 }
const LINE: EnemyKind[] = ["orc", "orc", "orc", "bomber", "shieldwall"]

/** Kinds in one enemy group: a Warchief when 3 or more, at most one special the Force Level allows. */
export function composition(r: Dice, size: number, force?: number): EnemyKind[] {
  const out: EnemyKind[] = size >= 3 ? ["warchief"] : []
  const specials = (Object.keys(SPECIALS) as EnemyKind[]).filter((k) => force === undefined || SPECIALS[k]! <= force)
  if (r.random() < 0.6 && specials.length > 0) out.push(r.pick(specials))
  while (out.length < size) out.push(r.pick(LINE))
  return out
}

/** A new alien; at a Force Level its skills rank 2 from level 4 and 3 from level 7, and each 3 levels add 1 HP. */
export function alien(id: string, kind: EnemyKind, pos: Point, group: string, force?: number): Unit {
  const u = Unit.of(id, kind, "enemy", pos, kind, group)
  if (force === undefined) return u
  const rank = force >= 7 ? 3 : force >= 4 ? 2 : 1
  for (const a of Object.keys(u.ranks) as AbilityId[]) u.ranks[a] = rank
  u.maxHp += Math.floor((force - 1) / 3)
  u.hp = u.maxHp
  return u
}

/** The walking cost from the landing that a group starts at or beyond: two dashes, and room for its spread. */
const DASHES = 20

function enemies(
  r: Dice,
  board: Board,
  taken: Set<number>,
  reachable: Point[],
  walk: Map<number, number>,
  landing: Point,
  lead: Point | null,
  leader: number,
  count: number,
  size: number,
  force?: number,
): { units: Unit[]; groups: Group[] } {
  const far = reachable.filter((p) => (walk.get(key(p)) ?? Infinity) >= DASHES)
  const field = far.filter((p) => p.x >= Math.floor(board.width * 0.65))
  const anchors: Point[] = lead ? [lead] : []
  const way = halfway(far, board, landing, lead ?? { x: board.width - 2, y: landing.y })
  if (way.length > 0) anchors.push(r.pick(way))
  for (let tries = 0; anchors.length < count && tries < 400; tries++) {
    const p = r.pick(field)
    if (anchors.every((a) => distance(a, p) >= 6)) anchors.push(p)
  }
  const units: Unit[] = []
  const groups: Group[] = []
  anchors.forEach((anchor, g) => {
    const id = `g${g + 1}`
    groups.push({ id, revealed: false, target: null, landing: { ...landing } })
    const kinds = composition(r, lead && g === 0 ? leader : r.between(Math.min(2, size), size), force)
    const route = [anchor, r.pick(field), r.pick(field)]
    for (const kind of kinds) {
      const u = alien(`e${units.length + 1}`, kind, free(board, anchor, taken), id, force)
      u.patrol = route.map((p) => ({ ...p }))
      units.push(u)
    }
  })
  return { units, groups }
}

/** The tiles just past the middle of the map, within 4 rows of the line from the landing to the objective. */
function halfway(tiles: Point[], board: Board, from: Point, to: Point): Point[] {
  const band = tiles.filter((p) => p.x >= Math.floor(board.width * 0.55) && p.x < Math.floor(board.width * 0.7))
  const line = (x: number) => from.y + ((to.y - from.y) * (x - from.x)) / Math.max(1, to.x - from.x)
  const near = band.filter((p) => Math.abs(p.y - line(p.x)) <= 4)
  return near.length > 0 ? near : band
}

/** Sends every group, engaged, on the beacon from the start. */
function raid(units: Unit[], groups: Group[], beacon: Point): void {
  for (const g of groups) Object.assign(g, { revealed: true, alarmed: true, target: { ...beacon } })
  for (const u of units) u.alert = "engaged"
}

/**
 * The mission's goal on the map it was built with: the beacon on the hill, the terminal or relay in the post, the
 * captive, and an evac zone at the far edge. With no room for an evac zone it is Kill all.
 */
function goal(r: Dice, board: Board, reachable: Point[], kind: Kind, site: Site | null, captive: Unit | null): Goal {
  if (kind === "defend" && site) return { kind, at: site.at, rounds: 8, held: 0 }
  const floor = (p: Point) => board.tiles[p.y * board.width + p.x] === "floor"
  const open = reachable.filter(floor)
  const edge = open.filter((p) => p.x >= board.width - 2)
  if (edge.length === 0 && kind === "relay" && site)
    return { kind, at: site.at, planted: null, tiles: [], blown: false }
  if (edge.length === 0) return kind === "warchief" ? { kind, tiles: [], slain: false } : { kind: "kill" }
  const keys = new Set(open.map(key))
  const tiles = area(r.pick(edge), 1).filter((p) => keys.has(key(p)) && p.x >= board.width - 3)
  if (kind === "warchief") return { kind, tiles, slain: false }
  if (kind === "relay" && site) return { kind, at: site.at, planted: null, tiles, blown: false }
  if (kind === "intel" && site) return { kind, at: site.at, taken: false, tiles }
  if (kind === "vip" && captive) return { kind, captive: captive.id, tiles }
  return { kind: "evac", tiles }
}

/** The same goal on the map turned by a step. */
function moved(g: Goal, turn: (p: Point) => Point): Goal {
  return {
    ...g,
    ...("at" in g ? { at: turn(g.at) } : {}),
    ...("tiles" in g ? { tiles: g.tiles.map(turn) } : {}),
  } as Goal
}

/** A captive soldier of a class not in the squad, in the yard. */
function prisoner(r: Dice, board: Board, taken: Set<number>, team: Unit[], at: Point, given?: Recruit): Unit {
  const kind = r.pick(CLASSES.filter((c) => !team.some((u) => u.kind === c)))
  const name = r.pick(NAMES.filter((n) => !team.some((u) => u.name === n)))
  const s = given ?? { id: "v1", kind, name, spread: { hp: 0, aim: 0, will: 0 }, hp: Infinity }
  const u = Unit.of(s.id, s.kind, "squad", free(board, at, taken), s.name, null, s.spread)
  u.hp = Math.min(u.maxHp, s.hp)
  u.ap = 0
  u.give({ id: "captive", rounds: 99 })
  return u
}

type Kind = "warchief" | "evac" | "defend" | "intel" | "vip" | "relay"

/** What a run asks of a mission; whatever it leaves out is rolled from the seed. */
export interface Conditions {
  goal?: Kind
  squad?: Recruit[]
  /** The soldier a VIP mission holds captive. */
  captive?: Recruit
  groups?: number
  /** The most aliens in a group; the Warchief's group has 3. */
  size?: number
  pad?: boolean
  /** Each alien group starts marked by a heard noise. */
  scouted?: boolean
  alarm?: number
  biome?: Biome
  /** The alien Force Level: which kinds come, their skill ranks and their extra HP. */
  force?: number
}

/** A new mission from a seed: map, squad at one edge and alien groups toward the opposite edge. */
export function mission(seed: number, conditions: Conditions = {}): Game {
  const state = { rng: seed }
  const r = new Dice(state)
  const rolled = r.pick(["warchief", "evac", "defend"] as const)
  const kind = conditions.goal ?? rolled
  const site = place(r, kind)
  const rows = Array.from({ length: SIZE.height - 8 }, (_, i) => i + 4).filter(
    (y) => !site || Math.abs(y - site.at.y) >= 8,
  )
  const landing = r.random() < 0.35
  const pad: Site | null =
    (conditions.pad ?? landing) ? { kind: "pad", at: { x: Math.floor(SIZE.width * 0.86), y: r.pick(rows) } } : null
  let board = map(
    r,
    conditions.biome,
    [site, pad].filter((s): s is Site => !!s),
  )
  const taken = new Set<number>()
  const team = squad(r, board, taken, conditions.squad)
  const reachable = [...flood(board, team[0].pos)]
    .map((k) => ({ x: k % 1000, y: Math.floor(k / 1000) }))
    .filter((p) => board.tiles[p.y * board.width + p.x] !== "door")
  const scout = Unit.of("scout", team[0].kind, "squad", team[0].pos, "scout")
  const walk = Game.start({ seed, board, units: [scout] }).reach(scout, 999).cost
  const captive = kind === "vip" && site ? prisoner(r, board, taken, team, site.at, conditions.captive) : null
  const lead = site && site.kind !== "hill" ? site.at : null
  const leader = kind === "warchief" ? 3 : 2
  const { units, groups } = enemies(
    r,
    board,
    taken,
    reachable,
    walk,
    team[0].pos,
    lead,
    leader,
    conditions.groups ?? 4,
    conditions.size ?? 2,
    conditions.force,
  )
  if (captive) team.push(captive)
  let aim = goal(r, board, reachable, kind, site, captive)
  for (let turns = r.between(0, 3); turns > 0; turns--) {
    const from = board
    const turn = (p: Point): Point => from.turned(p)
    for (const u of [...team, ...units]) {
      u.pos = turn(u.pos)
      u.patrol = u.patrol.map(turn)
    }
    for (const g of groups) if (g.landing) g.landing = turn(g.landing)
    aim = moved(aim, turn)
    if (pad) pad.at = turn(pad.at)
    board = from.turn()
  }
  if (aim.kind === "defend") raid(units, groups, aim.at)
  const game = Game.start({ seed, board, units: [...team, ...units], groups })
  game.goal = aim
  game.pad = pad?.at ?? null
  game.rng = state.rng
  if (conditions.scouted)
    for (const g of groups) {
      const lead = game.units.find((u) => u.group === g.id)
      if (lead) game.noises.push({ at: { ...lead.pos }, radius: 0, round: 1 })
    }
  game.alarm = conditions.alarm ?? 0
  game.force = conditions.force
  return game
}

/**
 * Where the map builds the mission's site: a yard far on the aliens' side for the Warchief and the captive, a post
 * there for the terminal and the relay, a hill near the squad for Defend.
 */
function place(r: Dice, kind: Kind): Site | null {
  const y = r.between(6, SIZE.height - 7)
  const far = () => ({ x: r.between(Math.floor(SIZE.width * 0.75), Math.floor(SIZE.width * 0.8)), y })
  if (kind === "warchief" || kind === "vip") return { kind: "yard", at: far() }
  if (kind === "intel" || kind === "relay") return { kind: "post", at: far() }
  if (kind === "defend") return { kind: "hill", at: { x: Math.floor(SIZE.width * 0.28), y } }
  return null
}
