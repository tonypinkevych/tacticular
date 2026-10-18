import { WEAPONS } from "./data"
import type { Game } from "./game"
import { distance, pointOf, same } from "./point"
import type { Side } from "./types"
import type { Unit } from "./unit"

/** The phases and rounds of a game. */
export class Turn {
  constructor(private readonly game: Game) {}

  /** Ends the active side's phase; the enemy phase ends the round. */
  end(): void {
    const game = this.game
    if (game.phase === "squad") {
      this.start("enemy")
      return
    }
    this.hide()
    this.close()
    if (game.phase === "enemy") this.start("squad")
  }

  start(side: Side): void {
    const game = this.game
    game.phase = side
    if (side === "enemy") this.drift()
    for (const u of game.units) {
      if (!u.alive()) continue
      if (u.allegiance() !== side) {
        u.ap = 0
        continue
      }
      u.ap = 2
      u.moved = false
      u.waited = u.stance === "overwatch" || u.stance === "hunker"
      u.stance = "none"
      if (u.kind === "turret") {
        u.ap = 0
        u.stance = "overwatch"
        u.ammo = WEAPONS[u.weapon].ammo ?? 0
      }
      advance(u)
    }
    game.stealth.observe()
  }

  /** Defend: an alien on the beacon at round end loses the mission; holding it to the last round wins. */
  private hold(): void {
    const game = this.game
    const goal = game.goal
    if (goal.kind !== "defend") return
    if (game.units.some((u) => u.alive() && u.side === "enemy" && same(u.pos, goal.at))) {
      game.log.push({ key: "log.beacon", params: {} })
      game.phase = "lost"
    } else if (game.round >= goal.rounds) game.phase = "won"
  }

  /** After round 3, an unaware group at a route point gets its next point nearer to where the squad landed. */
  private drift(): void {
    const game = this.game
    if (game.round <= 3) return
    for (const g of game.groups) {
      const members = game.units.filter((u) => u.alive() && u.group === g.id && u.side === "enemy")
      const lead = members[0]
      const landing = g.landing
      if (!landing || !lead || lead.patrol.length === 0 || members.some((u) => u.alert !== "unaware")) continue
      if (distance(lead.pos, lead.patrol[lead.patrolIndex % lead.patrol.length]) > 1) continue
      const closer = [...game.reach(lead, lead.mobility * 4).cost.keys()]
        .map(pointOf)
        .filter((p) => distance(p, landing) < distance(lead.pos, landing) - 2)
      if (closer.length === 0) continue
      const next = game.dice.pick(closer)
      for (const u of members) u.patrol[(u.patrolIndex + 1) % u.patrol.length] = { ...next }
    }
  }

  /** Stalkers that no soldier sees take cover in the shadows again. */
  private hide(): void {
    for (const u of this.game.units) {
      if (!u.alive() || u.kind !== "assassin" || u.side !== "enemy") continue
      u.concealed = false
      u.concealed = !this.game.stealth.visible(u)
    }
  }

  private close(): void {
    const game = this.game
    game.stealth.horn()
    game.stealth.calm()
    for (const u of game.units) {
      if (u.down === 0) continue
      u.down -= 1
      if (u.down === 0) game.log.push({ key: "log.dies", params: { unit: u.id } })
    }
    for (const u of game.units) {
      if (!u.alive()) continue
      if (u.statuses.some((s) => s.id === "burning")) {
        game.log.push({ key: "log.burning", params: { unit: u.id, dmg: 2 } })
        game.combat.hurt(u, 2)
      }
      u.statuses = u.statuses.map((s) => ({ ...s, rounds: s.rounds - 1 })).filter((s) => s.rounds > 0)
      for (const id of Object.keys(u.cooldowns) as (keyof typeof u.cooldowns)[]) {
        const left = (u.cooldowns[id] ?? 0) - 1
        u.cooldowns[id] = left > 0 ? left : undefined
      }
    }
    game.fire.spread()
    for (const u of game.units) {
      if (u.kind !== "turret" || !u.alive() || u.has("deployed")) continue
      u.hp = 0
      game.log.push({ key: "log.dies", params: { unit: u.id } })
    }
    game.zones = game.zones.map((z) => ({ ...z, rounds: z.rounds - 1 })).filter((z) => z.rounds > 0)
    game.reinforcements.land()
    this.hold()
    game.round += 1
    game.log.push({ key: "log.round", params: { round: game.round } })
  }
}

/** Moves a patrol on to its next point when the unit already stands at the current one. */
function advance(u: Unit): void {
  for (let i = 0; i < u.patrol.length; i++) {
    if (distance(u.pos, u.patrol[u.patrolIndex % u.patrol.length]) > 1) return
    u.patrolIndex = (u.patrolIndex + 1) % u.patrol.length
  }
}
