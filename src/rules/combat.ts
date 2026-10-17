import { coverAgainst } from "./cover"
import { WEAPONS } from "./data"
import { chance, d20, die, failChance, rollDice } from "./dice"
import { AROUND, adjacent, distance, plus, same, tileAt, unitAt, walkable } from "./grid"
import type { Game, Unit, Weapon, WeaponId } from "./types"
import { addStatus, alive, armorOf, foes, groupAim, has, sideOf } from "./units"

export type Reason =
  | "flanked"
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

export interface Odds {
  weapon: Weapon
  aim: number
  defense: number
  cover: number
  edge: number
  advantages: Reason[]
  disadvantages: Reason[]
  chance: number
  min: number
  max: number
}

export interface Shot {
  reaction?: boolean
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
  const facing = weapon.ignoresCover ? 0 : coverAgainst(game, target.pos, attacker.pos)
  const cover = weapon.melee ? 0 : facing
  if (!weapon.ignoresCover && facing === 0) adv.push("flanked")
  if (target.side === "enemy" && target.alert === "unaware") adv.push("unaware")
  if (surprised(game, target)) adv.push("surprised")
  if (attacker.kind === "assassin" && isolated(game, target)) adv.push("isolated")
  if (shot.reaction && attacker.kind !== "ranger") dis.push("reaction")
  if (surprised(game, attacker)) dis.push("surprised")
  if (inSmoke(game, target)) dis.push("smoke")
  if (target.stance === "hunker") dis.push("hunkered")
  for (const s of ["suppressed", "frightened", "shaken"] as const) if (has(attacker, s)) dis.push(s)
  const range = distance(attacker.pos, target.pos)
  const over = weapon.melee ? 0 : Math.max(0, range - weapon.max, weapon.min - range)
  if (over > 0) dis.push("range")
  const edge = adv.length > 0 && dis.length === 0 ? 1 : dis.length > 0 && adv.length === 0 ? -1 : 0
  const aim = attacker.aim + groupAim(game, attacker) - over
  const defense = target.defense + cover + (has(target, "ward") ? 2 : 0)
  const armor = weapon.ignoresArmor ? 0 : armorOf(game, target)
  const sneak = attacker.kind === "rogue" && (adv.includes("flanked") || adv.includes("unaware")) ? 6 : 0
  const lo = weapon.dice.count + weapon.dice.bonus + (sneak ? 1 : 0)
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
    min: Math.max(1, lo - armor),
    max: Math.max(1, hi - armor),
  }
}

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
  if (w.ammo !== null && weaponId === attacker.weapon) attacker.ammo -= 1
  if (weaponId === "axes") attacker.axes -= 1
  if (w.saveHalf) {
    const save = d20(game, target.stance === "hunker" ? 1 : 0)
    const dc = 10 + attacker.will
    const saved = save.kept + target.will >= dc
    const raw = rollDice(game, w.dice)
    const dmg = Math.max(1, saved ? Math.floor(raw / 2) : raw)
    game.log.push({
      key: "log.lash",
      params: {
        unit: attacker.id,
        target: target.id,
        rolls: save.rolls.join("/"),
        total: save.kept + target.will,
        dc,
        saved,
        dmg,
        chance: Math.round(failChance(target.will, dc, target.stance === "hunker" ? 1 : 0) * 100),
      },
    })
    hurt(game, target, dmg)
    return
  }
  const roll = d20(game, o.edge)
  const crit = roll.kept === 20
  const hit = crit || (roll.kept !== 1 && roll.kept + o.aim >= o.defense)
  const params: Record<string, string | number | boolean> = {
    unit: attacker.id,
    target: target.id,
    weapon: weaponId,
    rolls: roll.rolls.join("/"),
    total: roll.kept + o.aim,
    defense: o.defense,
    hit,
    crit,
    reaction: !!shot.reaction,
    chance: Math.round(o.chance * 100),
  }
  if (!hit) {
    game.log.push({ key: "log.miss", params })
    return
  }
  const sneak = attacker.kind === "rogue" && (o.advantages.includes("flanked") || o.advantages.includes("unaware"))
  const raw = rollDice(game, w.dice, crit ? 2 : 1) + (sneak ? die(game, 6) : 0)
  const armor = w.ignoresArmor ? 0 : armorOf(game, target)
  const dmg = Math.max(1, raw - armor)
  game.log.push({ key: crit ? "log.crit" : "log.hit", params: { ...params, dmg } })
  const killed = hurt(game, target, dmg)
  if (w.push && !killed) push(game, attacker, target)
  if (killed && attacker.kind === "vanguard" && weaponId === "warblade") cleave(game, attacker)
}

function push(game: Game, from: Unit, target: Unit): void {
  const to = {
    x: target.pos.x + Math.sign(target.pos.x - from.pos.x),
    y: target.pos.y + Math.sign(target.pos.y - from.pos.y),
  }
  if (!walkable(tileAt(game, to)) || unitAt(game, to)) return
  target.pos = to
  game.log.push({ key: "log.push", params: { target: target.id } })
}

function cleave(game: Game, attacker: Unit): void {
  const next = AROUND.map((d) => unitAt(game, plus(attacker.pos, d))).find((u) => u && foes(u, attacker))
  if (!next) return
  const dmg = Math.max(1, die(game, 6) - armorOf(game, next))
  game.log.push({ key: "log.cleave", params: { unit: attacker.id, target: next.id, dmg } })
  hurt(game, next, dmg)
}

/** Applies damage and the effects of a death; returns true when the target dies. */
export function hurt(game: Game, target: Unit, dmg: number): boolean {
  target.hp = Math.max(0, target.hp - dmg)
  if (target.hp > 0) return false
  target.stance = "none"
  target.intent = null
  game.log.push({ key: "log.dies", params: { unit: target.id } })
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
