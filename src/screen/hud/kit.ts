import { type AbilityId, power, span } from "../../combat/abilities"
import { canReach, type Odds } from "../../combat/combat"
import { failChance } from "../../combat/dice"
import { WEAPONS, type WeaponId } from "../../combat/weapons"
import { t } from "../../i18n/strings"
import { AROUND, adjacent, distance, key, type Point, pointOf, same } from "../../map/point"
import type { Game } from "../../mission/game"
import type { Action } from "../../mission/orders"
import { PROFILES } from "../../units/profiles"
import { ULT, type Unit } from "../../units/unit"

/** Keys of the bar: the weapon on 1, skills on 2 3 4, the ultimate on 5, then Reload, Overwatch, Hunker, Use and Door with letter aliases. */
const SKILL_KEYS = "234"
const ULT_KEY = "5"
const ROUSE_KEY = "-"
const STANCE_KEYS = {
  reload: ["6", "R"],
  overwatch: ["7", "Y"],
  hunker: ["8", "H"],
  use: ["9", "U"],
  door: ["0", "O"],
} as const

/** What an action needs before it can be confirmed. */
export type Aim = "unit" | "tile" | "none"

/** One button of the action bar. */
export interface Slot {
  id: string
  group: "weapon" | "skill" | "ult" | "stance"
  key: string
  /** A second key that presses the slot. */
  alias?: string
  label: string
  info: string
  badge: string
  disabled: boolean
  aim: Aim
}

/** The action the player has picked and not yet confirmed. */
export interface Armed {
  slot: string
  target: string | null
  at: Point | null
}

const UNIT_ABILITIES: AbilityId[] = [
  "charge",
  "rampage",
  "dominate",
  "volley",
  "heal",
  "fear",
  "rouse",
  "shove",
  "rally",
  "guard",
  "hook",
  "tag",
  "swap",
  "ward",
  "cripple",
]
const TILE_ABILITIES: AbilityId[] = ["grapple", "rocket", "smoke", "barricade", "mine", "saturation", "turret", "flash"]
/** Abilities that target an ally; Swap targets anyone; every other unit-target action targets a foe. */
const FRIENDLY: AbilityId[] = ["heal", "rally", "rouse", "guard", "ward"]
const ANY: AbilityId[] = ["swap"]

const dice = (w: WeaponId): string => {
  const d = WEAPONS[w].dice
  return `${d.count + d.bonus}–${d.count * d.sides + d.bonus}`
}

/** What an armed action would do to its target: hit odds for attacks and Charge, save odds for mind spells. */
export type Forecast =
  | { kind: "attack"; label: string; target: Unit; odds: Odds }
  | { kind: "save"; label: string; target: Unit; will: number; dc: number; edge: number; chance: number }

/** An alien a soldier can target: its hit chance in percent and whether it stands flanked. */
export interface Contact {
  unit: Unit | null
  at: Point
  chance: number
  flanked: boolean
}

/** The actions a soldier has in a game: its bar, the reach of each action, its targets and their odds. */
export class Kit {
  constructor(
    readonly game: Game,
    readonly unit: Unit,
  ) {}

  /** The action bar of a soldier, in bar order. */
  slots(): Slot[] {
    const { game, unit: u } = this
    const out: Slot[] = []
    const none = u.ap <= 0 || game.phase !== "squad"
    const p = PROFILES[u.kind]
    const w = u.weapon
    const weapon = WEAPONS[w]
    const range = weapon.melee ? t("ui.melee") : `${t("ui.range")} ${weapon.min}–${weapon.max}`
    const ammo = weapon.ammo !== null ? ` · ${t("ui.ammo")} ${u.ammo}/${weapon.ammo}` : ""
    out.push({
      id: `weapon:${w}`,
      group: "weapon",
      key: "1",
      label: t(`weapon.${w}`),
      info: `${t("ui.damage")} ${dice(w)} · ${range}${ammo}`,
      badge: weapon.ammo !== null ? `${u.ammo}` : "",
      disabled: none || (weapon.twoAp === true && (u.ap < 2 || u.moved)),
      aim: "unit",
    })
    const skill = (a: AbilityId, group: Slot["group"], key: string, badge: string, blocked: boolean) =>
      out.push({
        id: `ability:${a}`,
        group,
        key,
        label: t(`ability.${a}`),
        info: `${t("ui.rank", { rank: u.rank(a) })} · ${t(`info.${a}`, { power: power(u, a), range: span(u, a) })}`,
        badge,
        disabled: none || blocked,
        aim: UNIT_ABILITIES.includes(a) ? "unit" : TILE_ABILITIES.includes(a) ? "tile" : "none",
      })
    p.abilities.forEach((a, i) => {
      if (u.rank(a) === 0) return
      const cd = u.cooldowns[a] ?? 0
      skill(a, "skill", SKILL_KEYS[i] ?? "", cd ? `⟳${cd}` : "", cd > 0)
    })
    if (game.units.some((x) => x.alive() && x.side === "squad" && x.allegiance() === "enemy") && u.side === "squad")
      skill("rouse", "skill", ROUSE_KEY, "", false)
    if (p.ultimate && u.rank(p.ultimate) > 0)
      skill(p.ultimate, "ult", ULT_KEY, u.ult >= ULT ? "★" : `${u.ult}/${ULT}`, u.ult < ULT)
    for (const id of ["reload", "overwatch", "hunker", "use", "door"] as const) {
      if (id === "reload" && WEAPONS[u.weapon].ammo === null) continue
      if (id === "use" && !game.orders.usable(u)) continue
      if (id === "door" && game.orders.doors(u).length === 0) continue
      const aim = id === "door" ? ("tile" as const) : ("none" as const)
      const s = { id, label: t(`action.${id}`), info: t(`info.${id}`), badge: "", disabled: none, aim }
      out.push({ ...s, group: "stance", key: STANCE_KEYS[id][0], alias: STANCE_KEYS[id][1] })
    }
    return out
  }

  /** The foes the soldier could target from a tile, its own by default, best chance first, then the barrels its gun reaches. */
  sights(from: Point = this.unit.pos): Contact[] {
    const { game } = this
    const viewer = this.unit.at(from)
    const w = viewer.arms()
    const foes = game.units
      .filter((e) => e.allegiance() !== viewer.allegiance() && (e.side === "squad" || game.stealth.visible(e)))
      .filter((e) => game.orders.canTarget(viewer, e))
      .map((e) => {
        const o = game.combat.odds(viewer, e)
        return { unit: e, at: e.pos, chance: Math.round(o.chance * 100), flanked: o.advantages.includes("flanked") }
      })
      .sort((a, b) => b.chance - a.chance)
    const barrels = this.barrels()
      .filter((p) => !w.melee && distance(from, p) <= w.max && game.sight.sees(viewer, p))
      .map((p) => ({ unit: null, at: p, chance: 100, flanked: false }))
    return [...foes, ...barrels]
  }

  /** The slot a key presses, by its key or its alias. */
  slotFor(key: string): Slot | undefined {
    return this.slots().find((s) => s.key === key || s.alias === key)
  }

  /** Tiles an armed action can reach, for the range outline on the board. */
  range(slot: string): Set<number> {
    const { game, unit: u } = this
    const [kind, id] = slot.split(":")
    const seen = game.sight.tiles(u)
    const within = (lo: number, hi: number) =>
      new Set([...seen].filter((k) => distance(u.pos, pointOf(k)) >= lo && distance(u.pos, pointOf(k)) <= hi))
    const around = () => new Set([key(u.pos), ...AROUND.map((d) => key({ x: u.pos.x + d.x, y: u.pos.y + d.y }))])
    if (kind === "weapon") {
      const w = WEAPONS[id as WeaponId]
      return w.melee ? around() : within(w.min, w.max)
    }
    if (kind === "overwatch") return seen
    if (kind === "door") return new Set(game.orders.doors(u).map(key))
    if (kind !== "ability") return new Set()
    switch (id as AbilityId) {
      case "charge":
      case "rampage":
        return new Set(game.reach(u, u.mobility).cost.keys())
      case "dominate":
        return within(0, span(u, "dominate"))
      case "saturation":
        return within(1, span(u, "saturation"))
      case "hospital":
        return within(0, span(u, "hospital"))
      case "turret":
      case "heal":
      case "rouse":
      case "shove":
      case "barricade":
      case "cripple":
        return around()
      case "ward":
        return within(0, span(u, "ward"))
      case "flash":
        return within(1, span(u, "flash"))
      case "tag":
        return within(1, span(u, "tag"))
      case "guard":
        return within(1, span(u, "guard"))
      case "hook":
        return within(1, span(u, "hook"))
      case "swap":
        return within(1, span(u, "swap"))
      case "rocket":
        return within(0, span(u, "rocket"))
      case "smoke":
        return within(0, span(u, "smoke"))
      case "mine":
        return within(1, span(u, "mine"))
      case "grapple":
        return new Set(
          [...within(1, span(u, "grapple"))].filter((k) => ["roof", "ridge"].includes(game.tile(pointOf(k)))),
        )
      case "rally":
        return within(1, span(u, "rally"))
      case "fear":
        return within(0, span(u, "fear"))
      case "volley":
        return within(0, span(u, "volley"))
      default:
        return new Set()
    }
  }

  /** A sensible first target, so a second press can confirm at once. */
  target(slot: string): string | null {
    const { game, unit: u } = this
    const [kind, id] = slot.split(":")
    const foes = game.units.filter((e) => e.allegiance() === "enemy" && (e.side === "squad" || game.stealth.visible(e)))
    const friends = game.units.filter((x) => x.alive() && x.allegiance() === "squad")
    if (kind === "weapon") {
      const ok = foes.filter((e) => game.orders.canTarget(u, e) && (!u.arms().melee || distance(u.pos, e.pos) <= 1))
      return ok.sort((a, b) => game.combat.odds(u, b).chance - game.combat.odds(u, a).chance)[0]?.id ?? null
    }
    if (kind !== "ability") return null
    const a = id as AbilityId
    if (a === "heal") {
      const near = game.units.filter(
        (x) =>
          (x.down > 0 || (x.alive() && x.hp < x.maxHp)) && x.allegiance() === "squad" && distance(u.pos, x.pos) <= 1,
      )
      return near.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]?.id ?? null
    }
    if (a === "guard") return friends.filter((x) => x !== u).sort((x, y) => x.hp - y.hp)[0]?.id ?? null
    if (a === "rally") {
      const near = friends.filter((x) => x !== u && distance(u.pos, x.pos) <= span(u, "rally") && x.ap < 3)
      return near.sort((x, y) => x.ap - y.ap)[0]?.id ?? null
    }
    if (a === "ward") {
      const near = friends.filter((x) => distance(u.pos, x.pos) <= span(u, "ward") && !x.has("ward"))
      return near.sort((x, y) => x.hp - y.hp)[0]?.id ?? null
    }
    if (a === "shove" || a === "cripple") return foes.find((e) => adjacent(u.pos, e.pos))?.id ?? null
    if (a === "rouse")
      return game.units.find((x) => x.side === "squad" && x.has("dominated") && distance(u.pos, x.pos) <= 1)?.id ?? null
    const reachable = foes.filter((e) => game.orders.canTarget(u, e))
    return reachable.sort((x, y) => distance(u.pos, x.pos) - distance(u.pos, y.pos))[0]?.id ?? null
  }

  /** A sensible first tile, so a second press can confirm at once: the first door for the Door slot. */
  spot(slot: string): Point | null {
    return slot === "door" ? (this.game.orders.doors(this.unit)[0] ?? null) : null
  }

  /** The action an armed slot stands for, or null when it still needs a target. */
  action(armed: Armed): Action | null {
    const u = this.unit
    const [kind, id] = armed.slot.split(":")
    if (kind === "weapon" && armed.at) return { type: "shoot", unit: u.id, at: armed.at }
    if (kind === "weapon") return armed.target ? { type: "attack", unit: u.id, target: armed.target } : null
    if (kind === "ability") {
      const a = id as AbilityId
      if (a === "charge" && armed.target)
        return { type: "ability", unit: u.id, ability: a, target: armed.target, ...(armed.at ? { at: armed.at } : {}) }
      if (UNIT_ABILITIES.includes(a))
        return armed.target ? { type: "ability", unit: u.id, ability: a, target: armed.target } : null
      if (TILE_ABILITIES.includes(a)) return armed.at ? { type: "ability", unit: u.id, ability: a, at: armed.at } : null
      return { type: "ability", unit: u.id, ability: a }
    }
    if (kind === "door") return armed.at ? { type: "door", unit: u.id, at: armed.at } : null
    return { type: kind as "overwatch" | "hunker" | "reload" | "use", unit: u.id }
  }

  /** The armed action with its tile filled in from the cursor: tile actions follow it, Charge lands where it points. */
  aim(armed: Armed, hover: Point | null): Armed {
    const { game, unit: u } = this
    if (armed.slot === "ability:charge") {
      const target = game.units.find((x) => x.id === armed.target)
      if (!target) return armed
      const spots = game.orders.landings(u, target)
      const at = hover && spots.some((p) => same(p, hover)) ? hover : (armed.at ?? spots[0] ?? null)
      return { ...armed, at }
    }
    const tile = armed.slot === "door" || TILE_ABILITIES.includes(armed.slot.slice(8) as AbilityId)
    if (!tile) return armed
    return { ...armed, at: hover && this.range(armed.slot).has(key(hover)) ? hover : armed.at }
  }

  /** The armed action aimed at the unit, or for a gun the barrel, under the cursor when it is valid, else unchanged. */
  retarget(armed: Armed, hover: Point | null): Armed {
    const { game, unit: u } = this
    const [kind, id] = armed.slot.split(":")
    if (kind === "weapon" && hover && game.tile(hover) === "barrel") {
      const w = WEAPONS[id as WeaponId]
      const ok = !w.melee && distance(u.pos, hover) <= w.max && game.sight.sees(u, hover)
      return ok ? { ...armed, target: null, at: hover } : armed
    }
    const unitAim = kind === "weapon" || UNIT_ABILITIES.includes(id as AbilityId)
    const t = hover && unitAim ? game.unitAt(hover) : undefined
    if (!t?.alive() || t.id === armed.target) return armed
    const friendly = FRIENDLY.includes(id as AbilityId)
    const ok = ANY.includes(id as AbilityId)
      ? t !== u && this.range(armed.slot).has(key(t.pos))
      : friendly
        ? (id === "rouse" ? t.side === u.side && t.has("dominated") : t.allegiance() === u.allegiance()) &&
          this.range(armed.slot).has(key(t.pos))
        : game.orders.canTarget(u, t) &&
          (kind === "weapon"
            ? canReach(u, t, WEAPONS[id as WeaponId])
            : id === "charge" || id === "rampage"
              ? game.orders.landings(u, t).length > 0
              : this.range(armed.slot).has(key(t.pos)))
    return ok ? { ...armed, target: t.id, at: null } : armed
  }

  /** Every target an armed action can take, a unit or a barrel, nearest first. */
  targets(armed: Armed): Armed[] {
    const { game, unit: u } = this
    const empty = { ...armed, target: null, at: null }
    const spots = [...game.units.filter((x) => x.alive()).map((x) => x.pos), ...this.barrels()]
    return spots
      .sort((a, b) => distance(u.pos, a) - distance(u.pos, b))
      .map((p) => this.retarget(empty, p))
      .filter((x) => x.target !== null || x.at !== null)
  }

  forecast(armed: Armed, hover: Point | null): Forecast | null {
    const { game, unit: u } = this
    const aimed = this.aim(armed, hover)
    const target = game.units.find((x) => x.id === aimed.target)
    if (!target?.alive()) return null
    const [kind, id] = aimed.slot.split(":")
    if (kind === "weapon") {
      return { kind: "attack", label: t(`weapon.${id}`), target, odds: game.combat.odds(u, target) }
    }
    if (aimed.slot === "ability:charge" && aimed.at) {
      const from = u.at(aimed.at)
      return { kind: "attack", label: t("ability.charge"), target, odds: game.combat.odds(from, target) }
    }
    if (kind === "ability" && (id === "fear" || id === "dread" || id === "dominate")) {
      const dc = 10 + u.will
      const edge = target.stance === "hunker" ? 1 : 0
      return {
        kind: "save",
        label: t(`ability.${id}`),
        target,
        will: target.will,
        dc,
        edge,
        chance: failChance(target.will, dc, edge),
      }
    }
    return null
  }

  private barrels(): Point[] {
    const { width, tiles } = this.game.board
    return tiles.flatMap((t, i) => (t === "barrel" ? [{ x: i % width, y: Math.floor(i / width) }] : []))
  }
}
