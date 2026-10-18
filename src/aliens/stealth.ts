import { WEAPONS, type WeaponId } from "../combat/weapons"
import { distance, type Point, pointOf } from "../map/point"
import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"

export interface Group {
  id: string
  revealed: boolean
  target: Point | null
  alarmed?: boolean
  /** Round ends the group spent at its target without seeing a soldier. */
  searched?: number
  /** Where the squad landed; routes drift toward it after round 3. */
  landing?: Point
}

export interface Noise {
  at: Point
  radius: number
  round: number
}

export const DETECTION = { unaware: 2, investigating: 4, assassin: 2, rogue: 1 }

/** How far from its target an alien group searches. */
export const SEARCH = 3

/** How far a soldier hears an alien it does not see walk. */
export const STEPS = 12

/** How far an alarm calls other alien groups. */
export const HORN = 6

/** Concealment, alerts, noise and alarms of a game. */
export class Stealth {
  constructor(private readonly game: Game) {}

  /** True when the player can see an enemy unit now. */
  visible(e: Unit): boolean {
    const radius = e.kind === "assassin" && e.concealed ? DETECTION.assassin : undefined
    return this.eyes().some((s) =>
      this.game.sight.sees(s, e.pos, radius === undefined ? s.vision : Math.min(radius, s.vision)),
    )
  }

  /** Detection radius of an enemy against a concealed soldier on a tile, its own by default; -1 means it cannot detect it at all. Grass hides a soldier from all but next tiles. */
  detection(e: Unit, s: Unit, at: Point = s.pos): number {
    if (s.kind === "rogue" && e.alert === "unaware") return -1
    const radius = s.kind === "rogue" ? DETECTION.rogue : DETECTION[e.alert === "unaware" ? "unaware" : "investigating"]
    return this.game.tile(at) === "grass" ? Math.min(1, radius) : radius
  }

  /** The tiles where an alien would spot a concealed soldier. */
  spots(e: Unit, s: Unit): Set<number> {
    const out = new Set<number>()
    for (const k of this.game.sight.tiles(e)) {
      const p = pointOf(k)
      const radius = Math.min(this.detection(e, s, p), e.vision)
      if (radius >= 0 && distance(e.pos, p) <= radius) out.add(k)
    }
    return out
  }

  /** Turns a group Engaged; in the player phase a first reveal queues its reveal reaction. */
  engage(id: string | null, at: Point): void {
    const game = this.game
    const g = this.group(id)
    if (!g) return
    g.target = { ...at }
    const units = this.members(g.id)
    if (units.every((u) => u.alert === "engaged")) return
    for (const u of units) u.alert = "engaged"
    game.log.push({ key: "log.engaged", params: { group: g.id } })
    if (g.revealed) return
    g.revealed = true
    if (game.phase === "squad") game.reactions.push(...units.map((u) => u.id))
  }

  /** Checks who sees whom: concealed soldiers inside detection radii, open soldiers in plain sight. */
  scan(): void {
    const game = this.game
    for (const e of this.hostiles()) {
      for (const s of game.units) {
        if (!s.alive() || !e.foe(s) || s.side !== "squad" || !e.alive() || s.has("captive")) continue
        const radius = s.concealed ? Math.min(this.detection(e, s), e.vision) : e.vision
        if (radius < 0) continue
        if (!game.sight.sees(e, s.pos, radius)) continue
        if (s.concealed) game.log.push({ key: "log.detected", params: { unit: s.id, by: e.id } })
        s.concealed = false
        this.engage(e.group, s.pos)
      }
      if (e.concealed && e.kind === "assassin" && this.visible(e)) e.concealed = false
    }
  }

  /** Updates the player's fog: the tiles the squad has explored. */
  observe(): void {
    const w = this.game.board.width
    for (const s of this.eyes()) {
      for (const k of this.game.sight.tiles(s)) this.game.explored[Math.floor(k / 1000) * w + (k % 1000)] = true
    }
  }

  /** Alerts after an attack; a silent kill nobody sees alerts nobody. */
  attacked(u: Unit, t: Unit, w: WeaponId): void {
    const sight = this.game.sight
    if (u.kind === "assassin") u.concealed = false
    if (u.side === "enemy" || u.allegiance() === "enemy") {
      t.concealed = false
      this.engage(u.group, t.pos)
      this.noise(u.pos, WEAPONS[w].noise, null)
      return
    }
    const witnesses = this.hostiles().filter((e) => sight.sees(e, u.pos))
    if (t.alive()) this.engage(t.group, u.pos)
    for (const e of witnesses) this.engage(e.group, u.pos)
    for (const e of this.hostiles().filter((x) => sight.sees(x, t.pos))) this.investigate(e.group, u.pos)
    if (t.alive() || witnesses.length > 0) u.concealed = false
    this.noise(u.pos, WEAPONS[w].noise, u)
  }

  /**
   * Records a noise and sends hearing groups to investigate; a soldier that makes it loses concealment.
   * An engaged group that hears a soldier's noise hunts there.
   */
  noise(at: Point, radius: number, source: Unit | null): void {
    if (radius <= 0) return
    this.game.noises.push({ at: { ...at }, radius, round: this.game.round })
    if (source && source.side === "squad") source.concealed = false
    for (const e of this.hostiles()) {
      if (distance(e.pos, at) > radius) continue
      if (e.alert !== "engaged") this.investigate(e.group, at)
      else if (source?.allegiance() === "squad") {
        const g = this.group(e.group)
        if (g) g.target = { ...at }
      }
    }
  }

  /**
   * Records a silent noise up to 2 tiles from where an alien no soldier sees stops within hearing of a soldier,
   * unless a noise heard this round is already near it.
   */
  hear(u: Unit): void {
    const game = this.game
    if (u.allegiance() !== "enemy" || this.visible(u)) return
    if (!this.eyes().some((s) => distance(s.pos, u.pos) <= STEPS)) return
    if (game.noises.some((n) => n.radius === 0 && n.round === game.round && distance(n.at, u.pos) <= 4)) return
    const around: Point[] = []
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const p = { x: u.pos.x + dx, y: u.pos.y + dy }
        if (game.board.inside(p) && distance(p, u.pos) <= 2) around.push(p)
      }
    game.noises.push({ at: game.dice.pick(around), radius: 0, round: game.round })
  }

  /** True when any foe sees the unit. */
  seen(u: Unit): boolean {
    return this.game.units.some((x) => x.alive() && x.foe(u) && this.game.sight.sees(x, u.pos))
  }

  /** Round end: a group that just engaged sounds the alarm once and calls groups in range. */
  horn(): void {
    const game = this.game
    for (const g of game.groups) {
      const callers = this.members(g.id).filter((u) => u.alert === "engaged")
      if (callers.length === 0 || !g.target || g.alarmed) continue
      g.alarmed = true
      game.log.push({ key: "log.horn", params: { group: g.id } })
      game.noises.push({ at: { ...callers[0].pos }, radius: HORN, round: game.round })
      for (const other of game.groups) {
        if (other === g) continue
        const near = this.members(other.id).some((u) => callers.some((c) => distance(c.pos, u.pos) <= HORN))
        if (near) this.investigate(other.id, g.target)
      }
    }
  }

  /**
   * Round end: a group that searched its target for 2 rounds and saw no soldier patrols again, toward where the
   * squad landed when it has no route; beacon raiders do not.
   */
  calm(): void {
    const game = this.game
    for (const g of game.groups) {
      const units = this.members(g.id)
      const target = g.target
      if (!target || units.length === 0) continue
      if (game.goal.kind === "defend" && units.some((u) => u.alert === "engaged")) continue
      const soldiers = game.units.filter((s) => s.alive() && s.side === "squad" && !s.concealed)
      if (units.some((u) => soldiers.some((s) => game.sight.sees(u, s.pos)))) {
        g.searched = 0
        continue
      }
      if (!units.some((u) => distance(u.pos, target) <= SEARCH)) continue
      g.searched = (g.searched ?? 0) + 1
      if (g.searched < 2) continue
      g.target = null
      g.searched = 0
      for (const u of units) {
        u.alert = "unaware"
        if (u.patrol.length === 0 && g.landing) u.patrol = [{ ...u.pos }, { ...g.landing }]
      }
    }
  }

  /** Sends the calm group nearest to a soldier to search where that soldier stands. */
  hunt(): void {
    const soldiers = this.game.units.filter((s) => s.alive() && s.soldier())
    const calm = this.hostiles().filter((e) => e.alert !== "engaged" && e.group)
    const near = (e: Unit) => Math.min(...soldiers.map((s) => distance(s.pos, e.pos)))
    const e = calm.sort((a, b) => near(a) - near(b))[0]
    if (!e || soldiers.length === 0) return
    const s = soldiers.sort((a, b) => distance(a.pos, e.pos) - distance(b.pos, e.pos))[0]
    this.investigate(e.group, s.pos)
  }

  private investigate(id: string | null, at: Point): void {
    const g = this.group(id)
    if (!g) return
    const units = this.members(g.id)
    if (units.some((u) => u.alert === "engaged")) return
    g.target = { ...at }
    for (const u of units) u.alert = "investigating"
  }

  private group(id: string | null): Group | undefined {
    return id ? this.game.groups.find((g) => g.id === id) : undefined
  }

  private members(id: string): Unit[] {
    return this.game.units.filter((u) => u.alive() && u.group === id && u.side === "enemy")
  }

  private hostiles(): Unit[] {
    return this.game.units.filter((u) => u.alive() && u.side === "enemy")
  }

  /** Squad units that see for the player: soldiers that are not Dominated. */
  private eyes(): Unit[] {
    return this.game.units.filter((u) => u.alive() && u.allegiance() === "squad")
  }
}
