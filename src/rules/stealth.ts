import { DETECTION, HORN, WEAPONS } from "./data"
import { distance, tileAt } from "./grid"
import { sees, visibleTiles } from "./sight"
import type { Game, Group, Point, Unit, WeaponId } from "./types"
import { alive, foes, sideOf } from "./units"

function group(game: Game, id: string | null): Group | undefined {
  return id ? game.groups.find((g) => g.id === id) : undefined
}

const members = (game: Game, id: string): Unit[] =>
  game.units.filter((u) => alive(u) && u.group === id && u.side === "enemy")

const hostiles = (game: Game): Unit[] => game.units.filter((u) => alive(u) && u.side === "enemy")

/** Squad units that see for the player: soldiers that are not Dominated. */
const eyes = (game: Game): Unit[] => game.units.filter((u) => alive(u) && sideOf(u) === "squad")

/** True when the player can see an enemy unit now. */
export function visibleToSquad(game: Game, e: Unit): boolean {
  const radius = e.kind === "assassin" && e.concealed ? DETECTION.assassin : undefined
  return eyes(game).some((s) => sees(game, s, e.pos, radius === undefined ? s.vision : Math.min(radius, s.vision)))
}

/** Detection radius of an enemy against a concealed soldier; -1 means it cannot detect it at all. Grass hides a soldier from all but next tiles. */
function detection(game: Game, e: Unit, s: Unit): number {
  if (s.kind === "rogue" && e.alert === "unaware") return -1
  const radius = s.kind === "rogue" ? DETECTION.rogue : DETECTION[e.alert === "unaware" ? "unaware" : "investigating"]
  return tileAt(game, s.pos) === "grass" ? Math.min(1, radius) : radius
}

/** Turns a group Engaged; in the player phase a first reveal queues its reveal reaction. */
export function engage(game: Game, id: string | null, at: Point): void {
  const g = group(game, id)
  if (!g) return
  g.target = { ...at }
  const units = members(game, g.id)
  if (units.every((u) => u.alert === "engaged")) return
  for (const u of units) u.alert = "engaged"
  game.log.push({ key: "log.engaged", params: { group: g.id } })
  if (g.revealed) return
  g.revealed = true
  if (game.phase === "squad") game.reactions.push(...units.map((u) => u.id))
}

function investigate(game: Game, id: string | null, at: Point): void {
  const g = group(game, id)
  if (!g) return
  const units = members(game, g.id)
  if (units.some((u) => u.alert === "engaged")) return
  g.target = { ...at }
  for (const u of units) u.alert = "investigating"
}

/** Checks who sees whom: concealed soldiers inside detection radii, open soldiers in plain sight. */
export function scan(game: Game): void {
  for (const e of hostiles(game)) {
    for (const s of game.units) {
      if (!alive(s) || !foes(e, s) || s.side !== "squad" || !alive(e)) continue
      const radius = s.concealed ? Math.min(detection(game, e, s), e.vision) : e.vision
      if (radius < 0) continue
      if (!sees(game, e, s.pos, radius)) continue
      if (s.concealed) game.log.push({ key: "log.detected", params: { unit: s.id, by: e.id } })
      s.concealed = false
      engage(game, e.group, s.pos)
    }
    if (e.concealed && e.kind === "assassin" && visibleToSquad(game, e)) e.concealed = false
  }
}

/** Updates the player's fog: the tiles the squad has explored. */
export function observe(game: Game): void {
  const w = game.board.width
  for (const s of eyes(game)) {
    for (const k of visibleTiles(game, s)) game.explored[Math.floor(k / 1000) * w + (k % 1000)] = true
  }
}

export function stepped(game: Game, _u: Unit): void {
  scan(game)
}

/** Alerts after an attack; a silent kill nobody sees alerts nobody. */
export function attacked(game: Game, u: Unit, t: Unit, w: WeaponId): void {
  if (u.kind === "assassin") u.concealed = false
  if (u.side === "enemy" || sideOf(u) === "enemy") {
    t.concealed = false
    engage(game, u.group, t.pos)
    noise(game, u.pos, loudness(w), null)
    return
  }
  const witnesses = hostiles(game).filter((e) => sees(game, e, u.pos))
  if (alive(t)) engage(game, t.group, u.pos)
  for (const e of witnesses) engage(game, e.group, u.pos)
  for (const e of hostiles(game).filter((x) => sees(game, x, t.pos))) investigate(game, e.group, u.pos)
  if (alive(t) || witnesses.length > 0) u.concealed = false
  noise(game, u.pos, loudness(w), u)
}

const loudness = (w: WeaponId): number => WEAPONS[w].noise

/** Records a noise and sends hearing groups to investigate; a soldier that makes it loses concealment. */
export function noise(game: Game, at: Point, radius: number, source: Unit | null): void {
  if (radius <= 0) return
  game.noises.push({ at: { ...at }, radius, round: game.round })
  if (source && source.side === "squad") source.concealed = false
  for (const e of hostiles(game)) {
    if (e.alert !== "engaged" && distance(e.pos, at) <= radius) investigate(game, e.group, at)
  }
}

/** True when any foe sees the unit. */
export function seen(game: Game, u: Unit): boolean {
  return game.units.some((x) => alive(x) && foes(x, u) && sees(game, x, u.pos))
}

/** Round end: a group that just engaged sounds the alarm once and calls groups in range. */
export function horn(game: Game): void {
  for (const g of game.groups) {
    const callers = members(game, g.id).filter((u) => u.alert === "engaged")
    if (callers.length === 0 || !g.target || g.alarmed) continue
    g.alarmed = true
    game.log.push({ key: "log.horn", params: { group: g.id } })
    game.noises.push({ at: { ...callers[0].pos }, radius: HORN, round: game.round })
    for (const other of game.groups) {
      if (other === g) continue
      const near = members(game, other.id).some((u) => callers.some((c) => distance(c.pos, u.pos) <= HORN))
      if (near) investigate(game, other.id, g.target)
    }
  }
}

/** Round end: a group that reached the place it investigated and found nobody goes back to patrol. */
export function calm(game: Game): void {
  for (const g of game.groups) {
    const units = members(game, g.id)
    if (!g.target || units.length === 0 || units.some((u) => u.alert !== "investigating")) continue
    if (!units.some((u) => distance(u.pos, g.target!) <= 2)) continue
    g.target = null
    for (const u of units) u.alert = "unaware"
  }
}
