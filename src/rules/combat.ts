import { breakCover, coverAgainst, coverTile } from "./cover"
import { WEAPONS } from "./data"
import { chance, d20, EDGE, failChance, rollDice } from "./dice"
import { scorch } from "./fire"
import { adjacent, climb, distance, same, tileAt, unitAt, up, walkable } from "./grid"
import type { Game, Point, Unit, Weapon, WeaponId } from "./types"
import { addStatus, alive, foes, groupAim, has, removeStatus, sideOf, soldier, wallOf } from "./units"

/** Advantages that let the Scout's Sneak Attack add 2 damage. */
const SNEAK: Reason[] = ["flanked", "unaware", "exposed", "staggered", "pincer"]

/** True when an ally of the attacker stands on the far side of the target. */
function pincer(game: Game, attacker: Unit, target: Unit): boolean {
  const far = { x: 2 * target.pos.x - attacker.pos.x, y: 2 * target.pos.y - attacker.pos.y }
  const ally = unitAt(game, far)
  return !!ally && ally !== attacker && !foes(ally, attacker)
}

export type Reason =
  | "flanked"
  | "exposed"
  | "staggered"
  | "pincer"
  | "close"
  | "unaware"
  | "surprised"
  | "isolated"
  | "reaction"
  | "smoke"
  | "hunkered"
  | "suppressed"
  | "frightened"
  | "shaken"
  | "range"
  | "point"
  | "steady"

export interface Odds {
  weapon: Weapon
  aim: number
  defense: number
  cover: number
  edge: number
  advantages: Reason[]
  disadvantages: Reason[]
  chance: number
  need: number
  aimParts: Part[]
  defenseParts: Part[]
  min: number
  max: number
}

/** One named number that adds up to Aim or Defense, for the chance breakdown. */
export interface Part {
  key: "aim" | "warchief" | "height" | "defense" | "low" | "high" | "ward" | "wall"
  value: number
}

export interface Shot {
  reaction?: boolean
  risky?: boolean
}

export function inSmoke(game: Game, u: Unit): boolean {
  return game.zones.some((z) => z.kind === "smoke" && z.tiles.some((t) => same(t, u.pos)))
}

const surprised = (game: Game, u: Unit): boolean => game.reactions.includes(u.id)

function isolated(game: Game, u: Unit): boolean {
  return !game.units.some((x) => x !== u && alive(x) && !foes(x, u) && distance(x.pos, u.pos) <= 3)
}

/** Everything a player sees before an attack: modifiers, the edge and the hit chance. */
export function odds(
  game: Game,
  attacker: Unit,
  target: Unit,
  weaponId: WeaponId = attacker.weapon,
  shot: Shot = {},
): Odds {
  const weapon = WEAPONS[weaponId]
  const adv: Reason[] = []
  const dis: Reason[] = []
  const exposed = has(target, "exposed")
  const facing = weapon.ignoresCover || exposed ? 0 : coverAgainst(game, target.pos, attacker.pos)
  const above = !weapon.melee && up(tileAt(game, attacker.pos)) && !up(tileAt(game, target.pos))
  const cover = weapon.melee || (above && facing < 5) ? 0 : facing
  if (exposed) adv.push("exposed")
  else if (!weapon.ignoresCover && !weapon.melee && facing === 0) adv.push("flanked")
  if (has(target, "staggered")) adv.push("staggered")
  if (weapon.melee && pincer(game, attacker, target)) adv.push("pincer")
  if (target.side === "enemy" && target.alert === "unaware") adv.push("unaware")
  if (surprised(game, target)) adv.push("surprised")
  if (attacker.kind === "assassin" && isolated(game, target)) adv.push("isolated")
  if (shot.reaction && !shot.risky && attacker.kind !== "ranger") dis.push("reaction")
  if (surprised(game, attacker)) dis.push("surprised")
  if (inSmoke(game, target)) dis.push("smoke")
  if (target.stance === "hunker" || has(target, "braced")) dis.push("hunkered")
  for (const s of ["suppressed", "frightened", "shaken"] as const) if (has(attacker, s)) dis.push(s)
  const range = distance(attacker.pos, target.pos)
  if (!weapon.melee && range > weapon.max) dis.push("range")
  if (!weapon.melee && range < weapon.min) dis.push("close")
  if (attacker.kind === "vanguard" && !weapon.melee && range <= 2) adv.push("point")
  if (has(attacker, "steady")) adv.push("steady")
  const edge = Math.max(-2, Math.min(2, adv.length - dis.length))
  const aimParts: Part[] = [{ key: "aim", value: attacker.aim }]
  if (groupAim(game, attacker)) aimParts.push({ key: "warchief", value: groupAim(game, attacker) })
  if (above) aimParts.push({ key: "height", value: 2 })
  const defenseParts: Part[] = [{ key: "defense", value: target.defense }]
  if (cover) defenseParts.push({ key: cover >= 5 ? "high" : "low", value: cover })
  if (has(target, "ward")) defenseParts.push({ key: "ward", value: 2 })
  if (wallOf(game, target)) defenseParts.push({ key: "wall", value: 1 })
  const aim = aimParts.reduce((sum, p) => sum + p.value, 0)
  const defense = defenseParts.reduce((sum, p) => sum + p.value, 0)
  const sneak = attacker.kind === "rogue" && adv.some((r) => SNEAK.includes(r)) ? 2 : 0
  const lo = weapon.dice.count + weapon.dice.bonus + sneak
  const hi = weapon.dice.count * weapon.dice.sides + weapon.dice.bonus + sneak
  return {
    weapon,
    aim,
    defense,
    cover,
    edge,
    advantages: adv,
    disadvantages: dis,
    chance: weapon.saveHalf ? 1 : chance(aim, defense, edge),
    need: Math.min(20, Math.max(2, defense - aim - EDGE * edge)),
    aimParts,
    defenseParts,
    min: lo,
    max: hi,
  }
}

/** Damage of a critical hit: half again, rounded up. */
export const crit = (raw: number): number => Math.ceil(raw * 1.5)

export function canReach(attacker: Unit, target: Unit, weapon: Weapon): boolean {
  return weapon.melee ? adjacent(attacker.pos, target.pos) : true
}

/** Rolls an attack, logs it in full and applies the damage. */
export function attack(
  game: Game,
  attacker: Unit,
  target: Unit,
  weaponId: WeaponId = attacker.weapon,
  shot: Shot = {},
): void {
  const o = odds(game, attacker, target, weaponId, shot)
  const w = o.weapon
  removeStatus(attacker, "steady")
  if (w.ammo !== null && weaponId === attacker.weapon) attacker.ammo -= 1
  if (weaponId === "axes") attacker.axes -= 1
  if (w.saveHalf) {
    const edge = target.stance === "hunker" ? 1 : 0
    const roll = d20(game)
    const dc = 10 + attacker.will
    const saved = roll + target.will + EDGE * edge >= dc
    const raw = rollDice(game, w.dice)
    const dmg = Math.max(1, saved ? Math.floor(raw / 2) : raw)
    game.log.push({
      key: "log.lash",
      params: {
        unit: attacker.id,
        target: target.id,
        roll,
        total: roll + target.will + EDGE * edge,
        dc,
        saved,
        dmg,
        chance: Math.round(failChance(target.will, dc, edge) * 100),
      },
    })
    hurt(game, target, dmg)
    return
  }
  const roll = d20(game)
  const critical = roll === 20
  const hit = critical || (roll !== 1 && roll + o.aim + EDGE * o.edge >= o.defense)
  const params: Record<string, string | number | boolean> = {
    unit: attacker.id,
    target: target.id,
    weapon: weaponId,
    roll,
    total: roll + o.aim + EDGE * o.edge,
    defense: o.defense,
    hit,
    crit: critical,
    reaction: !!shot.reaction,
    chance: Math.round(o.chance * 100),
    need: o.need,
  }
  if (!hit) {
    game.log.push({ key: "log.miss", params })
    return
  }
  const sneak = attacker.kind === "rogue" && o.advantages.some((r) => SNEAK.includes(r))
  const raw = rollDice(game, w.dice) + (sneak ? 2 : 0)
  const dmg = critical ? crit(raw) : raw
  game.log.push({ key: critical ? "log.crit" : "log.hit", params: { ...params, dmg } })
  if (critical && !w.melee) {
    const p = coverTile(game, target.pos, attacker.pos)
    if (p) breakCover(game, p)
  }
  const killed = hurt(game, target, dmg)
  if (w.push && !killed) push(game, attacker.pos, target, attacker.id)
}

/**
 * Pushes a target 1 tile away and staggers it. A push into anything solid or a unit does 2 damage instead of a
 * move; a push off a roof does 2 damage; a push into fire burns.
 */
export function push(game: Game, from: Point, target: Unit, source?: string): void {
  addStatus(target, { id: "staggered", rounds: 1, source })
  const to = {
    x: target.pos.x + Math.sign(target.pos.x - from.x),
    y: target.pos.y + Math.sign(target.pos.y - from.y),
  }
  const here = tileAt(game, target.pos)
  const there = tileAt(game, to)
  if (!walkable(there) || !climb(here, there) || unitAt(game, to)) {
    game.log.push({ key: "log.slam", params: { target: target.id, dmg: 2 } })
    hurt(game, target, 2)
    return
  }
  target.pos = to
  game.log.push({ key: "log.push", params: { target: target.id } })
  if (here === "roof" && there !== "roof") {
    game.log.push({ key: "log.fall", params: { target: target.id, dmg: 2 } })
    if (hurt(game, target, 2)) return
  }
  scorch(game, target)
}

/**
 * Applies damage and the effects of a fall; returns true when the target falls. Heavy plating takes 1 off the first
 * hit each round. A soldier goes down for 2 rounds, 3 while a Medic stands.
 */
export function hurt(game: Game, target: Unit, dmg: number): boolean {
  if (has(target, "plated") && dmg > 0) {
    removeStatus(target, "plated")
    dmg -= 1
  }
  target.hp = Math.max(0, target.hp - dmg)
  if (target.hp > 0) return false
  target.stance = "none"
  target.intent = null
  target.statuses = []
  const medic = game.units.some((u) => alive(u) && u.kind === "cleric" && u.side === "squad")
  if (soldier(target)) target.down = medic ? 3 : 2
  game.log.push({ key: soldier(target) ? "log.down" : "log.dies", params: { unit: target.id } })
  if (target.kind === "warchief" && target.group) {
    for (const u of game.units) {
      if (alive(u) && u.group === target.group) addStatus(u, { id: "shaken", rounds: 1 })
    }
  }
  for (const u of game.units) {
    if (u.statuses.some((s) => s.source === target.id && s.id !== "ward")) {
      u.statuses = u.statuses.filter((s) => s.source !== target.id || s.id === "ward")
    }
  }
  return true
}

export function enemiesOf(game: Game, u: Unit): Unit[] {
  return game.units.filter((x) => alive(x) && sideOf(x) !== sideOf(u))
}
