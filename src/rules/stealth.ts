import { DETECTION, HORN, STEPS, WEAPONS } from "./data"
import type { Game } from "./game"
import { distance, type Point } from "./point"
import type { Group, WeaponId } from "./types"
import type { Unit } from "./unit"

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

  /** Detection radius of an enemy against a concealed soldier; -1 means it cannot detect it at all. Grass hides a soldier from all but next tiles. */
  detection(e: Unit, s: Unit): number {
    if (s.kind === "rogue" && e.alert === "unaware") return -1
    const radius = s.kind === "rogue" ? DETECTION.rogue : DETECTION[e.alert === "unaware" ? "unaware" : "investigating"]
    return this.game.tile(s.pos) === "grass" ? Math.min(1, radius) : radius
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
        if (!s.alive() || !e.foe(s) || s.side !== "squad" || !e.alive()) continue
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

  /** Records a noise and sends hearing groups to investigate; a soldier that makes it loses concealment. */
  noise(at: Point, radius: number, source: Unit | null): void {
    if (radius <= 0) return
    this.game.noises.push({ at: { ...at }, radius, round: this.game.round })
    if (source && source.side === "squad") source.concealed = false
    for (const e of this.hostiles()) {
      if (e.alert !== "engaged" && distance(e.pos, at) <= radius) this.investigate(e.group, at)
    }
  }

  /** Records a silent noise where an alien no soldier sees stops within hearing of a soldier. */
  hear(u: Unit): void {
    const game = this.game
    if (u.allegiance() !== "enemy" || this.visible(u)) return
    if (this.eyes().some((s) => distance(s.pos, u.pos) <= STEPS))
      game.noises.push({ at: { ...u.pos }, radius: 0, round: game.round })
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

  /** Round end: a group that reached the place it investigated and found nobody goes back to patrol. */
  calm(): void {
    for (const g of this.game.groups) {
      const units = this.members(g.id)
      const target = g.target
      if (!target || units.length === 0 || units.some((u) => u.alert !== "investigating")) continue
      if (!units.some((u) => distance(u.pos, target) <= 2)) continue
      g.target = null
      for (const u of units) u.alert = "unaware"
    }
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
