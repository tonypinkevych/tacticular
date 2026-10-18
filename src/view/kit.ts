import { t } from "../i18n/strings"
import { canReach, type Odds } from "../rules/combat"
import { PROFILES, RANGE, ULT, WEAPONS } from "../rules/data"
import { failChance } from "../rules/dice"
import type { Game } from "../rules/game"
import { AROUND, adjacent, distance, key, type Point, pointOf, same } from "../rules/point"
import { walkable } from "../rules/tile"
import type { AbilityId, Action, WeaponId } from "../rules/types"
import type { Unit } from "../rules/unit"

/** Keys of the bar: weapons on digits, skills on Q W E, the ultimate on R, stances on T Y U. */
const SKILL_KEYS = "QWE"
const STANCE_KEYS = { reload: "T", overwatch: "Y", hunker: "U" } as const

/** What an action needs before it can be confirmed. */
export type Aim = "unit" | "tile" | "none"

/** One button of the action bar. */
export interface Slot {
  id: string
  group: "weapon" | "skill" | "ult" | "stance"
  key: string
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
]
const TILE_ABILITIES: AbilityId[] = [
  "blink",
  "breach",
  "grapple",
  "rocket",
  "smoke",
  "barricade",
  "drone",
  "mine",
  "saturation",
  "turret",
]
/** Abilities that target an ally; Swap targets anyone; every other unit-target action targets a foe. */
const FRIENDLY: AbilityId[] = ["heal", "rally", "rouse", "guard"]
const ANY: AbilityId[] = ["swap"]

const dice = (w: WeaponId): string => {
  const d = WEAPONS[w].dice
  return `${d.count + d.bonus}–${d.count * d.sides + d.bonus}`
}

/** What an armed action would do to its target: hit odds for attacks and Charge, save odds for mind spells. */
export type Forecast =
  | { kind: "attack"; label: string; target: Unit; odds: Odds }
  | { kind: "save"; label: string; target: Unit; will: number; dc: number; edge: number; chance: number }

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
    const weapons = [u.weapon, p.sidearm].filter((x): x is WeaponId => !!x && x !== "none")
    weapons.forEach((w, i) => {
      const weapon = WEAPONS[w]
      const range = weapon.melee ? t("ui.melee") : `${t("ui.range")} ${weapon.min}–${weapon.max}`
      const ammo = weapon.ammo !== null && w === u.weapon ? ` · ${t("ui.ammo")} ${u.ammo}/${weapon.ammo}` : ""
      out.push({
        id: `weapon:${w}`,
        group: "weapon",
        key: String(i + 1),
        label: t(`weapon.${w}`),
        info: `${t("ui.damage")} ${dice(w)} · ${range}${ammo}`,
        badge: w === "axes" ? `×${u.axes}` : weapon.ammo !== null && w === u.weapon ? `${u.ammo}` : "",
        disabled: none || (w === "axes" && u.axes <= 0) || (weapon.twoAp === true && (u.ap < 2 || u.moved)),
        aim: "unit",
      })
    })
    const skill = (a: AbilityId, group: Slot["group"], key: string, badge: string, blocked: boolean) =>
      out.push({
        id: `ability:${a}`,
        group,
        key,
        label: t(`ability.${a}`),
        info: t(`info.${a}`),
        badge,
        disabled: none || blocked,
        aim: UNIT_ABILITIES.includes(a) ? "unit" : TILE_ABILITIES.includes(a) ? "tile" : "none",
      })
    p.abilities.forEach((a, i) => {
      const cd = u.cooldowns[a] ?? 0
      skill(a, "skill", SKILL_KEYS[i] ?? "", cd ? `⟳${cd}` : "", cd > 0)
    })
    if (game.units.some((x) => x.alive() && x.side === "squad" && x.allegiance() === "enemy") && u.side === "squad")
      skill("rouse", "skill", String(weapons.length + 1), "", false)
    if (p.ultimate) skill(p.ultimate, "ult", "R", u.ult >= ULT ? "★" : `${u.ult}/${ULT}`, u.ult < ULT)
    if (u.kind === "drone") return out
    for (const id of ["reload", "overwatch", "hunker"] as const) {
      if (id === "reload" && WEAPONS[u.weapon].ammo === null) continue
      const s = { id, label: t(`action.${id}`), info: t(`info.${id}`), badge: "", disabled: none, aim: "none" as const }
      out.push({ ...s, group: "stance", key: STANCE_KEYS[id] })
    }
    return out
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
    if (kind !== "ability") return new Set()
    switch (id as AbilityId) {
      case "charge":
      case "rampage":
        return new Set(game.reach(u, u.mobility).cost.keys())
      case "dominate":
        return within(0, RANGE.dominate)
      case "saturation":
        return within(1, RANGE.saturation)
      case "hospital":
        return within(0, RANGE.hospital)
      case "turret":
      case "heal":
      case "rouse":
      case "shove":
      case "breach":
      case "barricade":
      case "drone":
        return around()
      case "tag":
        return within(1, RANGE.tag)
      case "guard":
        return within(1, RANGE.guard)
      case "hook":
        return within(1, RANGE.hook)
      case "swap":
        return within(1, RANGE.swap)
      case "rocket":
        return within(0, RANGE.rocket)
      case "smoke":
        return within(0, RANGE.smoke)
      case "mine":
        return within(1, RANGE.mine)
      case "grapple":
        return new Set([...within(1, RANGE.grapple)].filter((k) => ["roof", "ridge"].includes(game.tile(pointOf(k)))))
      case "rally":
        return within(1, RANGE.rally)
      case "fear":
        return within(0, RANGE.fear)
      case "volley":
        return within(0, RANGE.volley)
      case "blink":
        return new Set([...within(1, RANGE.blink)].filter((k) => walkable(game.tile(pointOf(k)))))
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
      const w = id as WeaponId
      const ok = foes.filter((e) => game.orders.canTarget(u, e) && (!WEAPONS[w].melee || distance(u.pos, e.pos) <= 1))
      return ok.sort((a, b) => game.combat.odds(u, b, w).chance - game.combat.odds(u, a, w).chance)[0]?.id ?? null
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
      const near = friends.filter((x) => x !== u && distance(u.pos, x.pos) <= RANGE.rally && x.ap < 3)
      return near.sort((x, y) => x.ap - y.ap)[0]?.id ?? null
    }
    if (a === "shove") return foes.find((e) => adjacent(u.pos, e.pos))?.id ?? null
    if (a === "rouse")
      return game.units.find((x) => x.side === "squad" && x.has("dominated") && distance(u.pos, x.pos) <= 1)?.id ?? null
    const reachable = foes.filter((e) => game.orders.canTarget(u, e))
    return reachable.sort((x, y) => distance(u.pos, x.pos) - distance(u.pos, y.pos))[0]?.id ?? null
  }

  /** The action an armed slot stands for, or null when it still needs a target. */
  action(armed: Armed): Action | null {
    const u = this.unit
    const [kind, id] = armed.slot.split(":")
    if (kind === "weapon")
      return armed.target ? { type: "attack", unit: u.id, target: armed.target, weapon: id as WeaponId } : null
    if (kind === "ability") {
      const a = id as AbilityId
      if (a === "charge" && armed.target)
        return { type: "ability", unit: u.id, ability: a, target: armed.target, ...(armed.at ? { at: armed.at } : {}) }
      if (UNIT_ABILITIES.includes(a))
        return armed.target ? { type: "ability", unit: u.id, ability: a, target: armed.target } : null
      if (TILE_ABILITIES.includes(a)) return armed.at ? { type: "ability", unit: u.id, ability: a, at: armed.at } : null
      return { type: "ability", unit: u.id, ability: a }
    }
    return { type: kind as "overwatch" | "hunker" | "reload", unit: u.id }
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
    const tile = TILE_ABILITIES.includes(armed.slot.slice(8) as AbilityId)
    if (!tile) return armed
    return { ...armed, at: hover && this.range(armed.slot).has(key(hover)) ? hover : armed.at }
  }

  /** The armed action aimed at the unit under the cursor when it is a valid target, else unchanged. */
  retarget(armed: Armed, hover: Point | null): Armed {
    const { game, unit: u } = this
    const [kind, id] = armed.slot.split(":")
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

  forecast(armed: Armed, hover: Point | null): Forecast | null {
    const { game, unit: u } = this
    const aimed = this.aim(armed, hover)
    const target = game.units.find((x) => x.id === aimed.target)
    if (!target?.alive()) return null
    const [kind, id] = aimed.slot.split(":")
    if (kind === "weapon" && target.allegiance() !== u.allegiance()) {
      return { kind: "attack", label: t(`weapon.${id}`), target, odds: game.combat.odds(u, target, id as WeaponId) }
    }
    if (aimed.slot === "ability:charge" && aimed.at) {
      const from = u.at(aimed.at)
      return { kind: "attack", label: t("ability.charge"), target, odds: game.combat.odds(from, target, u.weapon) }
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
}
