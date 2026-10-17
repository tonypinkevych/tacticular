import { attack, canReach, hurt, push } from "./combat"
import { inCover } from "./cover"
import { ABILITIES, NOISE, PROFILES, RANGE, WEAPONS } from "./data"
import { d20, EDGE, failChance, rollDice } from "./dice"
import { AROUND, adjacent, area, distance, inside, key, plus, reach, same, tileAt, unitAt, walkable } from "./grid"
import { endPhase } from "./round"
import { lineOfSight, sees } from "./sight"
import { attacked, noise, observe, scan, seen, stepped } from "./stealth"
import type { AbilityId, Action, Game, ItemId, Point, Unit, WeaponId } from "./types"
import { addStatus, alive, foes, has, removeStatus, sideOf, unit } from "./units"

export class Illegal extends Error {}

function check(ok: boolean, reason: string): asserts ok {
  if (!ok) throw new Illegal(reason)
}

/** Applies one action and returns the next game; the given game is not changed. */
export function apply(game: Game, action: Action): Game {
  check(game.phase === "squad" || game.phase === "enemy", "over")
  const next = structuredClone(game)
  if (action.type === "endTurn") {
    endPhase(next)
    return next
  }
  const u = unit(next, action.unit)
  check(alive(u), "dead")
  check(sideOf(u) === next.phase || next.reactions.includes(u.id), "not your turn")
  check(u.ap > 0, "no AP")
  switch (action.type) {
    case "move":
      move(next, u, action.to)
      break
    case "attack":
      strike(next, u, unit(next, action.target), action.weapon ?? u.weapon)
      break
    case "ability":
      ability(next, u, action.ability, action.target, action.at)
      break
    case "item":
      item(next, u, action.item, action.at)
      break
    case "reload":
      reload(u)
      break
    case "door":
      door(next, u, action.at)
      break
    case "overwatch":
      overwatch(u)
      break
    case "hunker":
      hunker(next, u)
      break
  }
  scan(next)
  observe(next)
  settle(next)
  return next
}

/** Steps tile by tile; each step can trigger overwatch, suppression fire and zone of control. */
export function walk(game: Game, u: Unit, path: Point[]): void {
  for (const step of path) {
    const threats = game.units.filter(
      (x) =>
        alive(x) &&
        foes(x, u) &&
        WEAPONS[x.weapon].melee &&
        x.stance !== "hunker" &&
        !has(x, "staggered") &&
        adjacent(x.pos, u.pos) &&
        !adjacent(x.pos, step),
    )
    u.pos = { ...step }
    if (tileAt(game, step) === "door") game.board.tiles[step.y * game.board.width + step.x] = "open"
    stepped(game, u)
    for (const x of game.units) {
      if (!alive(u)) return
      if (!alive(x) || !foes(x, u) || x.stance !== "overwatch" || has(x, "staggered")) continue
      const w = WEAPONS[x.weapon]
      if (w.melee ? !adjacent(x.pos, u.pos) : !sees(game, x, u.pos) || (w.ammo !== null && x.ammo <= 0)) continue
      if (u.kind === "assassin" && u.concealed) continue
      x.stance = "none"
      attack(game, x, u, x.weapon, { reaction: true })
    }
    const pin = u.statuses.find((s) => s.id === "suppressed")
    const suppressor = pin?.source ? game.units.find((x) => x.id === pin.source) : undefined
    if (alive(u) && suppressor && alive(suppressor) && sees(game, suppressor, u.pos)) {
      removeStatus(u, "suppressed")
      attack(game, suppressor, u, suppressor.weapon, { reaction: true })
    }
    for (const x of threats) {
      if (alive(u) && alive(x)) attack(game, x, u, x.weapon)
    }
    if (!alive(u)) return
  }
}

function move(game: Game, u: Unit, to: Point): void {
  const budget = u.mobility * u.ap
  const r = reach(game, u, budget)
  const cost = r.cost.get(key(to))
  check(cost !== undefined && cost > 0, "unreachable")
  const fear = u.statuses.find((s) => s.id === "frightened")
  const source = fear?.source ? game.units.find((x) => x.id === fear.source) : undefined
  if (source && alive(source)) check(distance(to, source.pos) >= distance(u.pos, source.pos), "frightened")
  u.ap -= cost <= u.mobility ? 1 : 2
  u.moved = true
  walk(game, u, r.path(to))
}

/** Tiles next to a target that a unit can reach within one move, nearest first. */
export function landings(game: Game, u: Unit, t: Unit): Point[] {
  const r = reach(game, u, u.mobility)
  return AROUND.map((d) => plus(t.pos, d))
    .filter((p) => same(p, u.pos) || r.cost.has(key(p)))
    .sort((a, b) => (r.cost.get(key(a)) ?? 0) - (r.cost.get(key(b)) ?? 0))
}

export function canTarget(game: Game, u: Unit, t: Unit): boolean {
  if (!alive(t) || !foes(u, t)) return false
  if (t.kind === "assassin" && t.concealed && distance(u.pos, t.pos) > 3) return false
  if (sees(game, u, t.pos)) return true
  return u.kind === "ranger" && game.units.some((a) => alive(a) && a !== u && !foes(a, u) && sees(game, a, t.pos))
}

function strike(game: Game, u: Unit, t: Unit, weaponId: WeaponId): void {
  const p = PROFILES[u.kind]
  check(weaponId === u.weapon || weaponId === p.sidearm, "weapon")
  const w = WEAPONS[weaponId]
  check(canTarget(game, u, t), "target")
  check(canReach(u, t, w), "reach")
  if (w.twoAp) check(u.ap === 2 && !u.moved, "needs 2 AP")
  if (w.ammo !== null && weaponId === u.weapon) check(u.ammo > 0, "ammo")
  if (weaponId === "axes") check(u.axes > 0, "axes")
  attack(game, u, t, weaponId)
  attacked(game, u, t, weaponId)
  u.ap = 0
}

function ability(game: Game, u: Unit, id: AbilityId, targetId?: string, at?: Point): void {
  check(PROFILES[u.kind].abilities.includes(id), "ability")
  check(!u.cooldowns[id], "cooldown")
  const t = targetId ? unit(game, targetId) : undefined
  switch (id) {
    case "charge": {
      check(!!t && canTarget(game, u, t), "target")
      const spots = landings(game, u, t!)
      if (at) check(adjacent(at, t!.pos) && spots.some((p) => same(p, at)), "place")
      const spot = at ?? spots[0]
      check(!!spot, "unreachable")
      const r = reach(game, u, u.mobility)
      u.intent = null
      if (!same(spot, u.pos)) walk(game, u, r.path(spot))
      if (alive(u) && alive(t!)) {
        attack(game, u, t!, u.weapon)
        attacked(game, u, t!, u.weapon)
      }
      break
    }
    case "shove": {
      check(!!t && foes(u, t) && adjacent(u.pos, t.pos), "target")
      push(game, u, t!)
      game.log.push({ key: "log.shove", params: { unit: u.id, target: t!.id } })
      attacked(game, u, t!, u.weapon)
      break
    }
    case "spot": {
      check(!!t && canTarget(game, u, t), "target")
      addStatus(t!, { id: "exposed", rounds: 1, source: u.id })
      game.log.push({ key: "log.spot", params: { unit: u.id, target: t!.id } })
      break
    }
    case "rally": {
      check(!!t && t !== u && !foes(u, t) && distance(u.pos, t.pos) <= RANGE.rally && sees(game, u, t.pos), "target")
      t!.ap = Math.min(3, t!.ap + 1)
      game.log.push({ key: "log.rally", params: { unit: u.id, target: t!.id } })
      break
    }
    case "volley": {
      check(!!t && canTarget(game, u, t) && distance(u.pos, t.pos) <= RANGE.volley, "target")
      check(u.ammo >= 2, "ammo")
      u.ammo -= 2
      addStatus(t!, { id: "suppressed", rounds: 99, source: u.id })
      game.log.push({ key: "log.volley", params: { unit: u.id, target: t!.id } })
      noise(game, u.pos, WEAPONS[u.weapon].noise, u)
      break
    }
    case "bulwark": {
      check(!!at && adjacent(at, u.pos), "place")
      const d = { x: at!.x - u.pos.x, y: at!.y - u.pos.y }
      const side =
        d.x !== 0 && d.y !== 0
          ? [
              { x: d.x, y: 0 },
              { x: 0, y: d.y },
            ]
          : [
              { x: d.y, y: d.x },
              { x: -d.y, y: -d.x },
            ]
      const tiles = [at!, plus(at!, side[0]), plus(at!, side[1])].filter(
        (p) => walkable(tileAt(game, p)) && !unitAt(game, p),
      )
      check(tiles.length > 0, "place")
      game.zones.push({ kind: "bulwark", tiles, rounds: 2 })
      game.log.push({ key: "log.bulwark", params: { unit: u.id } })
      break
    }
    case "heal": {
      check(!!t && !foes(u, t) && (t === u || adjacent(u.pos, t.pos)) && alive(t), "target")
      const amount = Math.min(t!.maxHp - t!.hp, rollDice(game, { count: 1, sides: 3, bonus: 2 }))
      t!.hp += amount
      game.log.push({ key: "log.heal", params: { unit: u.id, target: t!.id, amount } })
      break
    }
    case "ward": {
      check(!!t && !foes(u, t) && distance(u.pos, t.pos) <= RANGE.ward && (t === u || sees(game, u, t.pos)), "target")
      addStatus(t!, { id: "ward", rounds: 2, source: u.id })
      game.log.push({ key: "log.ward", params: { unit: u.id, target: t!.id } })
      break
    }
    case "vanish": {
      check(!seen(game, u), "seen")
      u.concealed = true
      game.log.push({ key: "log.vanish", params: { unit: u.id } })
      break
    }
    case "fear":
    case "dread":
    case "dominate": {
      check(!!t && canTarget(game, u, t) && distance(u.pos, t.pos) <= RANGE[id], "target")
      if (id === "dominate") check(t!.side === "squad", "target")
      const edge = t!.stance === "hunker" ? 1 : 0
      const roll = d20(game)
      const dc = 10 + u.will
      const saved = roll + t!.will + EDGE * edge >= dc
      game.log.push({
        key: `log.${id}`,
        params: {
          unit: u.id,
          target: t!.id,
          roll,
          total: roll + t!.will + EDGE * edge,
          dc,
          saved,
          chance: Math.round(failChance(t!.will, dc, edge) * 100),
        },
      })
      if (!saved && id === "dominate") {
        addStatus(t!, { id: "dominated", rounds: 2, source: u.id })
        t!.stance = "none"
        t!.ap = 0
      } else if (!saved) {
        addStatus(t!, { id: "frightened", rounds: 2, source: u.id })
      }
      attacked(game, u, t!, u.weapon)
      break
    }
    case "blink": {
      check(!!at && walkable(tileAt(game, at)) && !unitAt(game, at), "place")
      check(distance(u.pos, at!) <= RANGE.blink && lineOfSight(game, u.pos, at!, false), "place")
      u.pos = { ...at! }
      game.log.push({ key: "log.blink", params: { unit: u.id } })
      stepped(game, u)
      break
    }
    case "rouse": {
      check(!!t && t.side === u.side && adjacent(u.pos, t.pos) && has(t, "dominated"), "target")
      removeStatus(t!, "dominated")
      game.log.push({ key: "log.rouse", params: { unit: u.id, target: t!.id } })
      break
    }
    case "mark": {
      if (u.kind === "ogre") {
        check(!!t && canTarget(game, u, t), "target")
        u.intent = { type: "charge", target: t!.id }
      } else {
        check(!!at && distance(u.pos, at) <= RANGE.flask, "place")
        u.intent = { type: "bomb", at: { ...at! } }
      }
      game.log.push({ key: "log.mark", params: { unit: u.id } })
      break
    }
  }
  u.cooldowns[id] = ABILITIES[id].cooldown || undefined
  if (ABILITIES[id].endsTurn) u.ap = 0
  else u.ap -= 1
}

function item(game: Game, u: Unit, id: ItemId, at: Point): void {
  check(u.items[id] > 0, "item")
  check(inside(game.board, at) && lineOfSight(game, u.pos, at, false), "place")
  const range = id === "stone" ? RANGE.stone : RANGE.flask
  check(distance(u.pos, at) <= range, "range")
  u.items[id] -= 1
  if (id === "stone") {
    game.log.push({ key: "log.stone", params: { unit: u.id } })
    noise(game, at, NOISE.stone, null)
    u.ap -= 1
    return
  }
  const tiles = area(at, 1).filter((p) => inside(game.board, p))
  if (id === "smoke") {
    game.zones.push({ kind: "smoke", tiles, rounds: 2 })
    game.log.push({ key: "log.smoke", params: { unit: u.id } })
    u.ap -= 1
    return
  }
  u.intent = null
  throwFlask(game, u, at)
  u.ap = 0
}

/** A fire flask: sure damage to everyone in 3×3, and it burns away cover. */
export function throwFlask(game: Game, u: Unit, at: Point): void {
  const bomber = u.kind === "bomber"
  game.log.push({ key: "log.flask", params: { unit: u.id } })
  for (const p of area(at, 1)) {
    if (!inside(game.board, p)) continue
    const i = p.y * game.board.width + p.x
    const tile = game.board.tiles[i]
    if (tile === "low") game.board.tiles[i] = "floor"
    if (tile === "high") game.board.tiles[i] = "low"
    const hit = unitAt(game, p)
    if (!hit) continue
    game.log.push({ key: "log.burn", params: { target: hit.id, dmg: bomber ? 3 : 4 } })
    const dead = hurt(game, hit, bomber ? 3 : 4)
    if (bomber && !dead) addStatus(hit, { id: "burning", rounds: 2 })
  }
  noise(game, at, NOISE.flask, u)
}

function reload(u: Unit): void {
  const max = WEAPONS[u.weapon].ammo
  check(max !== null && u.ammo < max, "full")
  u.ammo = max!
  u.ap -= 1
}

function door(game: Game, u: Unit, at: Point): void {
  check(adjacent(u.pos, at) && tileAt(game, at) === "door", "door")
  game.board.tiles[at.y * game.board.width + at.x] = "open"
  game.log.push({ key: "log.door", params: { unit: u.id } })
  stepped(game, u)
  u.ap -= 1
}

function overwatch(u: Unit): void {
  const w = WEAPONS[u.weapon]
  check(w.ammo === null || u.ammo > 0, "ammo")
  u.stance = "overwatch"
  u.ap = 0
}

function hunker(game: Game, u: Unit): void {
  check(inCover(game, u.pos), "cover")
  u.stance = "hunker"
  u.ap = 0
}

/** Checks the end of the mission after each action. */
export function settle(game: Game): void {
  if (!game.units.some((u) => alive(u) && u.side === "enemy")) game.phase = "won"
  else if (!game.units.some((u) => alive(u) && u.side === "squad")) game.phase = "lost"
}
