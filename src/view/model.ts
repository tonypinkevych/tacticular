import { batch, createSignal } from "solid-js"
import { type Lang, language, remember, t, use } from "../i18n/strings"
import { canTarget, Illegal, landings } from "../rules/actions"
import { canReach, type Odds, odds } from "../rules/combat"
import { PROFILES, RANGE, WEAPONS } from "../rules/data"
import { failChance } from "../rules/dice"
import { AROUND, adjacent, distance, inside, key, reach, same, tileAt, unitAt, walkable } from "../rules/grid"
import { visibleTiles } from "../rules/sight"
import { visibleToSquad } from "../rules/stealth"
import type { AbilityId, Action, Game, ItemId, Point, Unit, WeaponId } from "../rules/types"
import { alive, has, sideOf } from "../rules/units"
import type { Session } from "../save/session"
import { Playback, SPEEDS, type Speed } from "./motion"

export const KEYS = "1234567890"
const LETTERS: Record<string, string> = { overwatch: "Y", reload: "R" }

/** What an action needs before it can be confirmed. */
export type Aim = "unit" | "tile" | "none"

/** One button of the action bar. */
export interface Slot {
  id: string
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

const UNIT_ABILITIES: AbilityId[] = ["charge", "volley", "heal", "ward", "fear", "rouse", "shove", "spot", "rally"]
const TILE_ABILITIES: AbilityId[] = ["bulwark", "blink"]
/** Abilities that target an ally; every other unit-target action targets a foe. */
const FRIENDLY: AbilityId[] = ["heal", "ward", "rally", "rouse"]
const SPEED_KEY = "tacticular.speed"

const dice = (w: WeaponId): string => {
  const d = WEAPONS[w].dice
  return `${d.count + d.bonus}–${d.count * d.sides + d.bonus}`
}

const point = (k: number): Point => ({ x: k % 1000, y: Math.floor(k / 1000) })

/** The action bar of a soldier, in bar order. */
export function slots(game: Game, u: Unit): Slot[] {
  const out: Omit<Slot, "key">[] = []
  const none = u.ap <= 0 || game.phase !== "squad"
  const p = PROFILES[u.kind]
  for (const w of [u.weapon, p.sidearm].filter((x): x is WeaponId => !!x)) {
    const weapon = WEAPONS[w]
    const range = weapon.melee ? t("ui.melee") : `${t("ui.range")} ${weapon.min}–${weapon.max}`
    const ammo = weapon.ammo !== null && w === u.weapon ? ` · ${t("ui.ammo")} ${u.ammo}/${weapon.ammo}` : ""
    out.push({
      id: `weapon:${w}`,
      label: t(`weapon.${w}`),
      info: `${t("ui.damage")} ${dice(w)} · ${range}${ammo}`,
      badge: w === "axes" ? `×${u.axes}` : weapon.ammo !== null && w === u.weapon ? `${u.ammo}` : "",
      disabled: none || (w === "axes" && u.axes <= 0) || (weapon.twoAp === true && (u.ap < 2 || u.moved)),
      aim: "unit",
    })
  }
  const dominated = game.units.some((x) => alive(x) && x.side === "squad" && sideOf(x) === "enemy")
  for (const a of p.abilities) {
    if (a === "rouse" && !dominated) continue
    const cd = u.cooldowns[a] ?? 0
    out.push({
      id: `ability:${a}`,
      label: t(`ability.${a}`),
      info: t(`info.${a}`),
      badge: cd ? `⟳${cd}` : "",
      disabled: none || cd > 0,
      aim: UNIT_ABILITIES.includes(a) ? "unit" : TILE_ABILITIES.includes(a) ? "tile" : "none",
    })
  }
  for (const it of ["flask", "smoke", "stone"] as ItemId[]) {
    const n = u.items[it]
    if (n <= 0) continue
    out.push({
      id: `item:${it}`,
      label: t(`item.${it}`),
      info: t(`info.${it}`),
      badge: Number.isFinite(n) ? `×${n}` : "",
      disabled: none,
      aim: "tile",
    })
  }
  for (const id of ["overwatch", "hunker", "reload"] as const) {
    if (id === "reload" && WEAPONS[u.weapon].ammo === null) continue
    out.push({ id, label: t(`action.${id}`), info: t(`info.${id}`), badge: "", disabled: none, aim: "none" })
  }
  let i = 0
  return out.map((s) => ({ ...s, key: LETTERS[s.id] ?? KEYS[i++] ?? "" }))
}

/** True in the squad phase when no soldier the player controls has AP left. */
export function spent(game: Game): boolean {
  return (
    game.phase === "squad" &&
    !game.units.some((u) => alive(u) && u.side === "squad" && sideOf(u) === "squad" && u.ap > 0)
  )
}

/** Tiles an armed action can reach, for the range outline on the board. */
export function range(game: Game, u: Unit, slot: string): Set<number> {
  const [kind, id] = slot.split(":")
  const seen = visibleTiles(game, u)
  const within = (lo: number, hi: number) =>
    new Set([...seen].filter((k) => distance(u.pos, point(k)) >= lo && distance(u.pos, point(k)) <= hi))
  const around = () => new Set([key(u.pos), ...AROUND.map((d) => key({ x: u.pos.x + d.x, y: u.pos.y + d.y }))])
  if (kind === "weapon") {
    const w = WEAPONS[id as WeaponId]
    return w.melee ? around() : within(w.min, w.max)
  }
  if (kind === "item") return within(0, id === "stone" ? RANGE.stone : RANGE.flask)
  if (kind === "overwatch") return seen
  if (kind !== "ability") return new Set()
  switch (id as AbilityId) {
    case "charge":
      return new Set(reach(game, u, u.mobility).cost.keys())
    case "heal":
    case "rouse":
    case "bulwark":
    case "shove":
      return around()
    case "spot":
      return seen
    case "rally":
      return within(1, RANGE.rally)
    case "ward":
      return within(0, RANGE.ward)
    case "fear":
      return within(0, RANGE.fear)
    case "volley":
      return within(0, RANGE.volley)
    case "blink":
      return new Set([...within(1, RANGE.blink)].filter((k) => walkable(tileAt(game, point(k)))))
    default:
      return new Set()
  }
}

/** A sensible first target, so a second press can confirm at once. */
function defaultTarget(game: Game, u: Unit, slot: string): string | null {
  const [kind, id] = slot.split(":")
  const foes = game.units.filter((e) => sideOf(e) === "enemy" && (e.side === "squad" || visibleToSquad(game, e)))
  const friends = game.units.filter((x) => alive(x) && sideOf(x) === "squad")
  if (kind === "weapon") {
    const w = id as WeaponId
    const ok = foes.filter((e) => canTarget(game, u, e) && (!WEAPONS[w].melee || distance(u.pos, e.pos) <= 1))
    return ok.sort((a, b) => odds(game, u, b, w).chance - odds(game, u, a, w).chance)[0]?.id ?? null
  }
  if (kind !== "ability") return null
  const a = id as AbilityId
  if (a === "heal") {
    const near = game.units.filter(
      (x) => (x.down > 0 || (alive(x) && x.hp < x.maxHp)) && sideOf(x) === "squad" && distance(u.pos, x.pos) <= 1,
    )
    return near.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]?.id ?? null
  }
  if (a === "ward") return friends.sort((x, y) => x.hp - y.hp)[0]?.id ?? null
  if (a === "rally") {
    const near = friends.filter((x) => x !== u && distance(u.pos, x.pos) <= RANGE.rally && x.ap < 3)
    return near.sort((x, y) => x.ap - y.ap)[0]?.id ?? null
  }
  if (a === "shove") return foes.find((e) => adjacent(u.pos, e.pos))?.id ?? null
  if (a === "rouse")
    return game.units.find((x) => x.side === "squad" && has(x, "dominated") && distance(u.pos, x.pos) <= 1)?.id ?? null
  const reachable = foes.filter((e) => canTarget(game, u, e))
  return reachable.sort((x, y) => distance(u.pos, x.pos) - distance(u.pos, y.pos))[0]?.id ?? null
}

/** The action an armed slot stands for, or null when it still needs a target. */
export function action(u: Unit, armed: Armed): Action | null {
  const [kind, id] = armed.slot.split(":")
  if (kind === "weapon")
    return armed.target ? { type: "attack", unit: u.id, target: armed.target, weapon: id as WeaponId } : null
  if (kind === "item") return armed.at ? { type: "item", unit: u.id, item: id as ItemId, at: armed.at } : null
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
export function aimFor(game: Game, u: Unit, armed: Armed, hover: Point | null): Armed {
  if (armed.slot === "ability:charge") {
    const target = game.units.find((x) => x.id === armed.target)
    if (!target) return armed
    const spots = landings(game, u, target)
    const at = hover && spots.some((p) => same(p, hover)) ? hover : (armed.at ?? spots[0] ?? null)
    return { ...armed, at }
  }
  const tile = armed.slot.startsWith("item:") || TILE_ABILITIES.includes(armed.slot.slice(8) as AbilityId)
  if (!tile) return armed
  return { ...armed, at: hover && range(game, u, armed.slot).has(key(hover)) ? hover : armed.at }
}

/** The armed action aimed at the unit under the cursor when it is a valid target, else unchanged. */
export function retarget(game: Game, u: Unit, armed: Armed, hover: Point | null): Armed {
  const [kind, id] = armed.slot.split(":")
  const unitAim = kind === "weapon" || UNIT_ABILITIES.includes(id as AbilityId)
  const t = hover && unitAim ? unitAt(game, hover) : undefined
  if (!t || !alive(t) || t.id === armed.target) return armed
  const friendly = FRIENDLY.includes(id as AbilityId)
  const ok = friendly
    ? (id === "rouse" ? t.side === u.side && has(t, "dominated") : sideOf(t) === sideOf(u)) &&
      range(game, u, armed.slot).has(key(t.pos))
    : canTarget(game, u, t) &&
      (kind === "weapon"
        ? canReach(u, t, WEAPONS[id as WeaponId])
        : id === "charge"
          ? landings(game, u, t).length > 0
          : id === "spot" || range(game, u, armed.slot).has(key(t.pos)))
  return ok ? { ...armed, target: t.id, at: null } : armed
}

/** What an armed action would do to its target: hit odds for attacks and Charge, save odds for mind spells. */
export type Forecast =
  | { kind: "attack"; label: string; target: Unit; odds: Odds }
  | { kind: "save"; label: string; target: Unit; will: number; dc: number; edge: number; chance: number }

export function forecast(game: Game, u: Unit, armed: Armed, hover: Point | null): Forecast | null {
  const aimed = aimFor(game, u, armed, hover)
  const target = game.units.find((x) => x.id === aimed.target)
  if (!target || !alive(target)) return null
  const [kind, id] = aimed.slot.split(":")
  if (kind === "weapon" && sideOf(target) !== sideOf(u)) {
    return { kind: "attack", label: t(`weapon.${id}`), target, odds: odds(game, u, target, id as WeaponId) }
  }
  if (aimed.slot === "ability:charge" && aimed.at) {
    const from = { ...u, pos: aimed.at }
    return { kind: "attack", label: t("ability.charge"), target, odds: odds(game, from, target, u.weapon) }
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

/** All UI state as signals, and the commands that change it. */
export function createModel(session: Session, store: Storage) {
  const read = (k: string) => {
    try {
      return store.getItem(k)
    } catch {
      return null
    }
  }
  const saved = Number(read(SPEED_KEY) ?? 1)
  const playback = new Playback((SPEEDS as readonly number[]).includes(saved) ? (saved as Speed) : 1, session.game)
  const [game, setGame] = createSignal(session.game, { equals: false })
  const [shown, setShown] = createSignal(session.game, { equals: false })
  const [selected, setSelected] = createSignal<string | null>(null)
  const [armed, setArmed] = createSignal<Armed | null>(null)
  const [hover, setHover] = createSignal<Point | null>(null, { equals: (a, b) => !!a && !!b && same(a, b) })
  const [hint, setHint] = createSignal<Slot | null>(null)
  const [message, setMessage] = createSignal("")
  const [zones, setZones] = createSignal(false)
  const [speed, setSpeedSignal] = createSignal<Speed>(playback.speed)
  const [lang, setLang] = createSignal<Lang>(language())
  const [confirmNew, setConfirmNew] = createSignal(false)
  const [logOpen, setLogOpen] = createSignal(true)
  const [look, setLook] = createSignal<Point | null>(null, { equals: false })
  const [help, setHelp] = createSignal(false)
  const [menu, setMenu] = createSignal(false)
  const [extended, setExtended] = createSignal(false)

  const unit = (): Unit | null => {
    const u = game().units.find((x) => x.id === selected())
    return u && alive(u) && sideOf(u) === "squad" ? u : null
  }

  const foeAt = (p: Point): Unit | undefined => {
    const g = game()
    const u = unitAt(g, p)
    if (!u || sideOf(u) !== "enemy") return undefined
    return u.side === "squad" || visibleToSquad(g, u) ? u : undefined
  }

  /** Selects the next soldier; with all set, any living soldier, else only those with AP left. */
  const selectNext = (all: boolean, back = false, fallback = true) => {
    const squad = game().units.filter((u) => alive(u) && sideOf(u) === "squad" && (all || u.ap > 0))
    if (squad.length === 0) {
      if (!all && fallback) selectNext(true)
      return
    }
    const at = squad.findIndex((u) => u.id === selected())
    const step = back ? squad.length - 1 : 1
    const next = squad[at < 0 ? 0 : (at + step) % squad.length]
    batch(() => {
      setSelected(next.id)
      setLook(next.pos)
      setArmed(null)
      setMessage("")
    })
  }

  const act = (a: Action) => {
    const before = session.game
    try {
      playback.add(before, session.act(a))
      if (a.type !== "endTurn" && spent(session.game)) playback.add(session.game, session.act({ type: "endTurn" }))
      batch(() => {
        setGame(session.game)
        setArmed(null)
        setMessage("")
        const u = unit()
        if (!u || u.ap === 0) selectNext(false)
      })
    } catch (e) {
      if (!(e instanceof Illegal)) throw e
      setMessage(t(`illegal.${e.message}`))
    }
  }

  /** First press arms a slot with a default target; a second press of the same slot confirms it. */
  const press = (slot: Slot) => {
    const u = unit()
    if (!u || slot.disabled) return
    const current = armed()
    if (current?.slot === slot.id) {
      const a = action(u, aimFor(game(), u, current, hover()))
      if (a) act(a)
      else setMessage(slot.aim === "tile" ? t("ui.pickTile") : t("ui.pickTarget"))
      return
    }
    batch(() => {
      const target = slot.aim === "unit" ? defaultTarget(game(), u, slot.id) : null
      setArmed({ slot: slot.id, target, at: null })
      setMessage(
        slot.aim === "none" || target
          ? t("ui.pressAgain", { key: slot.key })
          : slot.aim === "tile"
            ? t("ui.pickTile")
            : t("ui.pickTarget"),
      )
    })
  }

  /** A click on the board: picks targets, selects soldiers, opens doors, or moves. */
  const click = (p: Point) => {
    const g = game()
    if (g.phase !== "squad") return
    const u = unit()
    const here = unitAt(g, p)
    const current = armed()
    const slot = current && u ? slots(g, u).find((s) => s.id === current.slot) : undefined
    if (u && current && slot) {
      const friendly = FRIENDLY.includes(current.slot.slice(8) as AbilityId)
      const ally = here && (current.slot === "ability:rouse" ? here.side === u.side : sideOf(here) === sideOf(u))
      if (slot.aim === "unit" && here && ally === friendly) {
        if (current.target === here.id) act(action(u, aimFor(g, u, current, hover()))!)
        else setArmed({ ...current, target: here.id, at: null })
        return
      }
      const target = current.target ? g.units.find((x) => x.id === current.target) : undefined
      if (current.slot === "ability:charge" && target && landings(g, u, target).some((q) => same(q, p))) {
        if (current.at && same(current.at, p)) act(action(u, current)!)
        else setArmed({ ...current, at: p })
        return
      }
      if (slot.aim === "tile") {
        if (current.at && same(current.at, p)) act(action(u, current)!)
        else setArmed({ ...current, at: p })
        return
      }
    }
    if (here && here.side === "squad" && sideOf(here) === "squad") {
      batch(() => {
        setSelected(here.id)
        setArmed(null)
        setMessage("")
      })
      return
    }
    if (!u) return
    const foe = foeAt(p)
    if (foe) {
      const s = slots(g, u)[0]
      if (current?.slot === s.id && current.target === foe.id) act(action(u, current)!)
      else setArmed({ slot: s.id, target: foe.id, at: null })
      return
    }
    if (current) {
      setArmed(null)
      return
    }
    if (tileAt(g, p) === "door" && AROUND.some((d) => u.pos.x + d.x === p.x && u.pos.y + d.y === p.y)) {
      act({ type: "door", unit: u.id, at: p })
      return
    }
    act({ type: "move", unit: u.id, to: p })
  }

  const key2 = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === "Escape") {
      batch(() => {
        setArmed(null)
        setMessage("")
        setHelp(false)
        setMenu(false)
      })
      return
    }
    if (e.key === "?") {
      setHelp(!help())
      return
    }
    if (e.key === "F1") {
      e.preventDefault()
      setExtended(!extended())
      return
    }
    if (e.key === "Tab") {
      e.preventDefault()
      selectNext(false, e.shiftKey, false)
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (game().phase === "squad") act({ type: "endTurn" })
      return
    }
    if (e.code === "Space") {
      e.preventDefault()
      setShown(playback.skip(performance.now()))
      return
    }
    if (e.code === "KeyZ") {
      setZones(!zones())
      return
    }
    const digit = e.code.startsWith("Digit") ? e.code.slice(5) : e.code.startsWith("Key") ? e.code.slice(3) : ""
    const u = unit()
    const slot = u && digit ? slots(game(), u).find((s) => s.key === digit) : undefined
    if (slot) {
      e.preventDefault()
      press(slot)
    }
  }

  const setSpeed = (s: Speed) => {
    playback.speed = s
    setSpeedSignal(s)
    try {
      store.setItem(SPEED_KEY, String(s))
    } catch {
      return
    }
  }

  const setLanguage = (l: Lang) => {
    use(l)
    remember(store, l)
    setLang(l)
    setGame(session.game)
    setShown(shown())
  }

  const undo = () => {
    session.undo()
    playback.reset(session.game)
    batch(() => {
      setGame(session.game)
      setShown(session.game)
    })
  }

  const newMission = () => {
    if (!confirmNew()) {
      setConfirmNew(true)
      return
    }
    session.start(Math.floor(Math.random() * 2 ** 31))
    playback.reset(session.game)
    batch(() => {
      setConfirmNew(false)
      setGame(session.game)
      setShown(session.game)
      setSelected(null)
      selectNext(false)
    })
  }

  /** Moves the cursor; an armed action follows it onto a valid target. */
  const point = (p: Point | null) => {
    batch(() => {
      setHover(p)
      const u = unit()
      const current = armed()
      if (u && current) setArmed(retarget(game(), u, current, p))
    })
  }

  selectNext(false)

  return {
    session,
    playback,
    game,
    shown,
    setShown,
    selected,
    look,
    armed,
    hover,
    setHover: point,
    logOpen,
    setLogOpen,
    help,
    setHelp,
    menu,
    setMenu,
    extended,
    setExtended,
    hint,
    setHint,
    message,
    zones,
    setZones,
    speed,
    setSpeed,
    lang,
    setLanguage,
    confirmNew,
    unit,
    foeAt,
    act,
    press,
    click,
    key: key2,
    undo,
    newMission,
    inside: (p: Point) => inside(game().board, p),
  }
}

export type Model = ReturnType<typeof createModel>
