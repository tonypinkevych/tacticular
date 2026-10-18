import { attack, canReach, hurt, push } from "./combat"
import { breakCover, inCover } from "./cover"
import { ABILITIES, BLAST_NOISE, PROFILES, RANGE, ROCKET_NOISE, ULT, WEAPONS } from "./data"
import { d20, EDGE, failChance, rollDice } from "./dice"
import { ignite, scorch } from "./fire"
import {
  AROUND,
  adjacent,
  area,
  climb,
  distance,
  inside,
  key,
  plus,
  reach,
  same,
  tileAt,
  unitAt,
  walkable,
} from "./grid"
import { endPhase } from "./round"
import { lineOfSight, sees } from "./sight"
import { attacked, noise, observe, scan, seen, stepped } from "./stealth"
import type { AbilityId, Action, Game, Point, StatusId, Unit, WeaponId } from "./types"
import { addStatus, alive, foes, has, makeUnit, removeStatus, sideOf, soldier, unit } from "./units"

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

/**
 * Steps tile by tile; each step can trigger fire, a mine, a Guard, overwatch, suppression fire and zone of control.
 * Reaction shots lose their disadvantage against a dash or a vault; a Brute breaks the low cover it vaults.
 */
export function walk(game: Game, u: Unit, path: Point[], dash = false): void {
  for (const step of path) {
    const vault = distance(u.pos, step) === 2 && (u.pos.x === step.x || u.pos.y === step.y)
    const risky = dash || vault
    if (vault && u.kind === "ogre") breakCover(game, { x: (u.pos.x + step.x) / 2, y: (u.pos.y + step.y) / 2 })
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
    const from = u.pos
    u.pos = { ...step }
    if (tileAt(game, step) === "door") game.board.tiles[step.y * game.board.width + step.x] = "open"
    scorch(game, u)
    if (!alive(u)) return
    if (sideOf(u) === "enemy" && trip(game, u, from)) return
    stepped(game, u)
    guard(game, u, risky)
    for (const x of game.units) {
      if (!alive(u)) return
      if (!alive(x) || !foes(x, u) || x.stance !== "overwatch" || has(x, "staggered")) continue
      const w = WEAPONS[x.weapon]
      if (w.melee ? !adjacent(x.pos, u.pos) : !sees(game, x, u.pos) || (w.ammo !== null && x.ammo <= 0)) continue
      if (u.kind === "assassin" && u.concealed) continue
      if (!has(x, "killzone")) x.stance = "none"
      attack(game, x, u, x.weapon, { reaction: true, risky })
    }
    const pin = u.statuses.find((s) => s.id === "suppressed")
    const suppressor = pin?.source ? game.units.find((x) => x.id === pin.source) : undefined
    if (alive(u) && suppressor && alive(suppressor) && sees(game, suppressor, u.pos)) {
      removeStatus(u, "suppressed")
      attack(game, suppressor, u, suppressor.weapon, { reaction: true, risky })
    }
    for (const x of threats) {
      if (alive(u) && alive(x)) attack(game, x, u, x.weapon)
    }
    if (!alive(u)) return
  }
}

/** A mine under an alien goes off: 2 damage, a push onward and a stop; returns true when it went off. */
function trip(game: Game, u: Unit, from: Point): boolean {
  const mine = game.zones.find((z) => z.kind === "mine" && z.tiles.some((t) => same(t, u.pos)))
  if (!mine) return false
  game.zones = game.zones.filter((z) => z !== mine)
  game.log.push({ key: "log.mine", params: { target: u.id, dmg: 2 } })
  if (!hurt(game, u, 2)) push(game, from, u)
  return true
}

/** A Sniper fires at the first foe that steps next to the ally it guards. */
function guard(game: Game, u: Unit, risky: boolean): void {
  for (const x of game.units) {
    const g = x.statuses.find((s) => s.id === "guarded")
    if (!g || !alive(x) || !alive(u) || !foes(x, u) || !adjacent(x.pos, u.pos)) continue
    removeStatus(x, "guarded")
    const sniper = game.units.find((s) => s.id === g.source)
    if (!sniper || !alive(sniper) || !sees(game, sniper, u.pos) || sniper.ammo <= 0) continue
    attack(game, sniper, u, sniper.weapon, { reaction: true, risky })
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
  walk(game, u, r.path(to), cost > u.mobility)
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
  check((weaponId === u.weapon || weaponId === p.sidearm) && weaponId !== "none", "weapon")
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
  const p = PROFILES[u.kind]
  const ultimate = p.ultimate === id
  check(p.abilities.includes(id) || ultimate || (id === "rouse" && u.side === "squad"), "ability")
  check(!u.cooldowns[id], "cooldown")
  if (ultimate) {
    check(u.ult >= ULT, "ult")
    u.ult = 0
  }
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
      push(game, u.pos, t!, u.id)
      game.log.push({ key: "log.shove", params: { unit: u.id, target: t!.id } })
      attacked(game, u, t!, u.weapon)
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
    case "heal": {
      check(!!t && !foes(u, t) && (t === u || adjacent(u.pos, t.pos)) && (alive(t) || t.down > 0), "target")
      const amount = Math.min(t!.maxHp - t!.hp, rollDice(game, { count: 1, sides: 3, bonus: 2 }))
      t!.hp += amount
      game.log.push({ key: t!.down > 0 ? "log.revive" : "log.heal", params: { unit: u.id, target: t!.id, amount } })
      t!.down = 0
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
      if (id === "dominate") check(foes(u, t!), "target")
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
        check(!!at && distance(u.pos, at) <= RANGE.blast, "place")
        u.intent = { type: "bomb", at: { ...at! } }
      }
      game.log.push({ key: "log.mark", params: { unit: u.id } })
      break
    }
    case "breach": {
      check(!!at && adjacent(u.pos, at) && (tileAt(game, at) === "door" || tileAt(game, at) === "open"), "place")
      game.board.tiles[at!.y * game.board.width + at!.x] = "open"
      game.log.push({ key: "log.breach", params: { unit: u.id } })
      for (const x of game.units) {
        if (alive(x) && foes(u, x) && adjacent(x.pos, at!)) addStatus(x, { id: "staggered", rounds: 1, source: u.id })
      }
      noise(game, at!, 6, u)
      break
    }
    case "grapple": {
      check(!!at && (tileAt(game, at) === "roof" || tileAt(game, at) === "ridge") && !unitAt(game, at), "place")
      check(distance(u.pos, at!) <= RANGE.grapple && lineOfSight(game, u.pos, at!, false), "range")
      u.pos = { ...at! }
      game.log.push({ key: "log.grapple", params: { unit: u.id } })
      stepped(game, u)
      break
    }
    case "guard": {
      check(!!t && t !== u && !foes(u, t) && distance(u.pos, t.pos) <= RANGE.guard && sees(game, u, t.pos), "target")
      addStatus(t!, { id: "guarded", rounds: 1, source: u.id })
      game.log.push({ key: "log.guard", params: { unit: u.id, target: t!.id } })
      break
    }
    case "steady": {
      check(!u.moved, "moved")
      addStatus(u, { id: "steady", rounds: 1 })
      game.log.push({ key: "log.steady", params: { unit: u.id } })
      break
    }
    case "rocket": {
      check(!!at && distance(u.pos, at) <= RANGE.rocket && lineOfSight(game, u.pos, at!, false), "range")
      rocket(game, u, at!)
      break
    }
    case "brace": {
      check(WEAPONS[u.weapon].ammo === null || u.ammo > 0, "ammo")
      u.stance = "overwatch"
      addStatus(u, { id: "braced", rounds: 1 })
      game.log.push({ key: "log.brace", params: { unit: u.id } })
      break
    }
    case "smoke": {
      check(!!at && distance(u.pos, at) <= RANGE.smoke && lineOfSight(game, u.pos, at!, false), "range")
      game.zones.push({ kind: "smoke", tiles: area(at!, 1).filter((p) => inside(game.board, p)), rounds: 2 })
      game.log.push({ key: "log.smoke", params: { unit: u.id } })
      break
    }
    case "hook": {
      check(!!t && canTarget(game, u, t) && distance(u.pos, t.pos) <= RANGE.hook, "target")
      for (let i = 0; i < 2; i++) {
        const next = { x: t!.pos.x + Math.sign(u.pos.x - t!.pos.x), y: t!.pos.y + Math.sign(u.pos.y - t!.pos.y) }
        const ok = walkable(tileAt(game, next)) && climb(tileAt(game, t!.pos), tileAt(game, next))
        if (!ok || unitAt(game, next)) break
        t!.pos = next
      }
      game.log.push({ key: "log.hook", params: { unit: u.id, target: t!.id } })
      scorch(game, t!)
      attacked(game, u, t!, "dagger")
      break
    }
    case "tag": {
      check(!!t && canTarget(game, u, t) && distance(u.pos, t.pos) <= RANGE.tag, "target")
      addStatus(t!, { id: "exposed", rounds: 2, source: u.id })
      game.log.push({ key: "log.tag", params: { unit: u.id, target: t!.id } })
      break
    }
    case "swap": {
      check(!!t && t !== u && alive(t) && distance(u.pos, t.pos) <= RANGE.swap && sees(game, u, t.pos), "target")
      const here = u.pos
      u.pos = t!.pos
      t!.pos = here
      game.log.push({ key: "log.swap", params: { unit: u.id, target: t!.id } })
      if (foes(u, t!)) attacked(game, u, t!, u.weapon)
      stepped(game, u)
      break
    }
    case "barricade": {
      check(!!at && adjacent(u.pos, at) && tileAt(game, at) !== "roof" && walkable(tileAt(game, at)), "place")
      check(!unitAt(game, at!), "place")
      game.board.tiles[at!.y * game.board.width + at!.x] = "high"
      game.log.push({ key: "log.barricade", params: { unit: u.id } })
      break
    }
    case "drone": {
      check(!!at && adjacent(u.pos, at) && walkable(tileAt(game, at)) && !unitAt(game, at!), "place")
      const id = `${u.id}-drone`
      game.units = game.units.filter((x) => x.id !== id)
      game.units.push(makeUnit(id, "drone", "squad", at!, "drone"))
      game.log.push({ key: "log.drone", params: { unit: u.id } })
      break
    }
    case "mine": {
      check(!!at && distance(u.pos, at) <= RANGE.mine && lineOfSight(game, u.pos, at!, false), "range")
      check(walkable(tileAt(game, at!)) && !unitAt(game, at!), "place")
      game.zones.push({ kind: "mine", tiles: [{ ...at! }], rounds: 99 })
      game.log.push({ key: "log.plant", params: { unit: u.id } })
      break
    }
    case "rampage": {
      check(!!t && canTarget(game, u, t), "target")
      let next: Unit | undefined = t
      for (let i = 0; i < 3 && next && alive(u); i++) {
        const spot = same(next.pos, u.pos) ? undefined : landings(game, u, next)[0]
        if (!spot) break
        if (!same(spot, u.pos)) walk(game, u, reach(game, u, u.mobility).path(spot))
        if (!alive(u) || !alive(next)) break
        attack(game, u, next, u.weapon)
        attacked(game, u, next, u.weapon)
        if (alive(next)) break
        next = game.units
          .filter((x) => canTarget(game, u, x) && landings(game, u, x).length > 0)
          .sort((a, b) => distance(u.pos, a.pos) - distance(u.pos, b.pos))[0]
      }
      game.log.push({ key: "log.rampage", params: { unit: u.id } })
      break
    }
    case "killzone": {
      check(u.ammo > 0, "ammo")
      u.stance = "overwatch"
      addStatus(u, { id: "killzone", rounds: 1 })
      game.log.push({ key: "log.killzone", params: { unit: u.id } })
      break
    }
    case "saturation": {
      check(!!at && !same(at, u.pos), "place")
      saturate(game, u, at!)
      break
    }
    case "hospital": {
      for (const x of game.units) {
        if (x.side !== u.side || distance(u.pos, x.pos) > RANGE.hospital || (!alive(x) && x.down === 0)) continue
        x.hp = Math.min(x.maxHp, x.hp + 3)
        x.down = 0
        x.statuses = x.statuses.filter((s) => !BAD.includes(s.id))
      }
      game.log.push({ key: "log.hospital", params: { unit: u.id } })
      break
    }
    case "ghost": {
      u.concealed = true
      u.ap += 1
      game.log.push({ key: "log.ghost", params: { unit: u.id } })
      break
    }
    case "turret": {
      check(!!at && adjacent(u.pos, at) && walkable(tileAt(game, at)) && !unitAt(game, at!), "place")
      const id = `${u.id}-turret`
      game.units = game.units.filter((x) => x.id !== id)
      const turret = makeUnit(id, "turret", "squad", at!, "turret")
      turret.ap = 0
      turret.concealed = false
      turret.stance = "overwatch"
      addStatus(turret, { id: "deployed", rounds: 3 })
      game.units.push(turret)
      game.log.push({ key: "log.turret", params: { unit: u.id } })
      break
    }
    case "blast": {
      check(!!at && inside(game.board, at) && distance(u.pos, at) <= RANGE.blast, "range")
      check(lineOfSight(game, u.pos, at!, false), "place")
      u.intent = null
      blast(game, u, at!)
      break
    }
  }
  u.cooldowns[id] = ABILITIES[id].cooldown || undefined
  if (ABILITIES[id].endsTurn) u.ap = 0
  else if (!ABILITIES[id].free) u.ap -= 1
}

/** Statuses a Field hospital clears. */
const BAD: StatusId[] = ["suppressed", "frightened", "shaken", "burning", "staggered", "exposed"]

/** Saturation fire: 2 damage to every other unit in a 90° cone up to 6 tiles toward a point, and all cover in it breaks. */
function saturate(game: Game, u: Unit, at: Point): void {
  const aim = Math.atan2(at.y - u.pos.y, at.x - u.pos.x)
  const cone = (p: Point) => {
    if (same(p, u.pos) || distance(u.pos, p) > RANGE.saturation) return false
    const turn = Math.abs(Math.atan2(p.y - u.pos.y, p.x - u.pos.x) - aim)
    return Math.min(turn, 2 * Math.PI - turn) <= Math.PI / 4 + 1e-9
  }
  game.log.push({ key: "log.saturation", params: { unit: u.id } })
  const hits = game.units.filter((x) => x !== u && alive(x) && cone(x.pos))
  for (const p of area(u.pos, RANGE.saturation)) if (inside(game.board, p) && cone(p)) breakCover(game, p)
  for (const x of hits) {
    game.log.push({ key: "log.shrapnel", params: { target: x.id, dmg: 2 } })
    hurt(game, x, 2)
  }
  noise(game, u.pos, WEAPONS[u.weapon].noise, u)
  for (const x of hits) if (foes(u, x)) attacked(game, u, x, u.weapon)
}

/** A Rocket: 2 damage to everyone in 3×3, pushes them out from the center, sets grass and trees on fire and breaks cover. */
function rocket(game: Game, u: Unit, at: Point): void {
  game.log.push({ key: "log.rocket", params: { unit: u.id } })
  const hits = area(at, 1)
    .map((p) => unitAt(game, p))
    .filter((x): x is Unit => !!x && alive(x))
  for (const p of area(at, 1)) if (inside(game.board, p) && !ignite(game, p)) breakCover(game, p)
  for (const x of hits) {
    game.log.push({ key: "log.shrapnel", params: { target: x.id, dmg: 2 } })
    if (hurt(game, x, 2) || same(x.pos, at)) continue
    push(game, at, x, u.id)
  }
  noise(game, at, ROCKET_NOISE, u)
  for (const x of hits) if (foes(u, x)) attacked(game, u, x, u.weapon)
}

/** A Grenadier blast: sure damage to everyone in 3×3; it sets them burning, sets grass and trees on fire and breaks cover. */
export function blast(game: Game, u: Unit, at: Point): void {
  game.log.push({ key: "log.flask", params: { unit: u.id } })
  for (const p of area(at, 1)) {
    if (!inside(game.board, p)) continue
    if (!ignite(game, p)) breakCover(game, p)
    const hit = unitAt(game, p)
    if (!hit) continue
    game.log.push({ key: "log.burn", params: { target: hit.id, dmg: 3 } })
    if (!hurt(game, hit, 3)) addStatus(hit, { id: "burning", rounds: 2 })
  }
  noise(game, at, BLAST_NOISE, u)
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
  const standing = game.units.filter((u) => alive(u) && soldier(u))
  const goal = game.goal
  if (!game.units.some((u) => alive(u) && u.side === "enemy")) game.phase = "won"
  else if (standing.length === 0) game.phase = "lost"
  else if (goal.kind === "evac" && standing.every((u) => goal.tiles.some((p) => same(p, u.pos)))) game.phase = "won"
}
