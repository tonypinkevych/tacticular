import { type Accessor, batch, createSignal, type Setter } from "solid-js"
import { type Lang, locale, t } from "../i18n/strings"
import type { Game } from "../rules/game"
import { Illegal } from "../rules/orders"
import { AROUND, type Point, same } from "../rules/point"
import type { AbilityId, Action } from "../rules/types"
import type { Unit } from "../rules/unit"
import type { Session } from "../save/session"
import { type Armed, Kit, type Slot } from "./kit"
import { Playback, SPEEDS, type Speed } from "./motion"

const SPEED_KEY = "tacticular.speed"

/** Abilities that target an ally; Swap targets anyone; every other unit-target action targets a foe. */
const FRIENDLY: AbilityId[] = ["heal", "rally", "rouse", "guard"]
const ANY: AbilityId[] = ["swap"]

/** True in the squad phase when no soldier the player controls has AP left. */
export function spent(game: Game): boolean {
  return (
    game.phase === "squad" &&
    !game.units.some((u) => u.alive() && u.side === "squad" && u.allegiance() === "squad" && u.ap > 0)
  )
}

/** All UI state as signals, and the commands that change it. */
export class Model {
  readonly playback: Playback
  readonly game: Accessor<Game>
  readonly shown: Accessor<Game>
  readonly setShown: Setter<Game>
  readonly selected: Accessor<string | null>
  readonly armed: Accessor<Armed | null>
  readonly hover: Accessor<Point | null>
  readonly hint: Accessor<Slot | null>
  readonly setHint: Setter<Slot | null>
  readonly message: Accessor<string>
  readonly zones: Accessor<boolean>
  readonly setZones: Setter<boolean>
  readonly speed: Accessor<Speed>
  readonly lang: Accessor<Lang>
  readonly confirmNew: Accessor<boolean>
  readonly logOpen: Accessor<boolean>
  readonly setLogOpen: Setter<boolean>
  /** A tile the camera should bring into view. */
  readonly look: Accessor<Point | null>
  readonly help: Accessor<boolean>
  readonly setHelp: Setter<boolean>
  readonly menu: Accessor<boolean>
  readonly setMenu: Setter<boolean>
  readonly extended: Accessor<boolean>
  readonly setExtended: Setter<boolean>
  private readonly setGame: Setter<Game>
  private readonly setSelected: Setter<string | null>
  private readonly setArmed: Setter<Armed | null>
  private readonly setPointer: Setter<Point | null>
  private readonly setMessage: Setter<string>
  private readonly setSpeedSignal: Setter<Speed>
  private readonly setLang: Setter<Lang>
  private readonly setConfirmNew: Setter<boolean>
  private readonly setLook: Setter<Point | null>

  constructor(
    readonly session: Session,
    private readonly store: Storage,
  ) {
    const saved = Number(this.read(SPEED_KEY) ?? 1)
    this.playback = new Playback((SPEEDS as readonly number[]).includes(saved) ? (saved as Speed) : 1, session.game)
    ;[this.game, this.setGame] = createSignal(session.game, { equals: false })
    ;[this.shown, this.setShown] = createSignal(session.game, { equals: false })
    ;[this.selected, this.setSelected] = createSignal<string | null>(null)
    ;[this.armed, this.setArmed] = createSignal<Armed | null>(null)
    ;[this.hover, this.setPointer] = createSignal<Point | null>(null, { equals: (a, b) => !!a && !!b && same(a, b) })
    ;[this.hint, this.setHint] = createSignal<Slot | null>(null)
    ;[this.message, this.setMessage] = createSignal("")
    ;[this.zones, this.setZones] = createSignal(false)
    ;[this.speed, this.setSpeedSignal] = createSignal<Speed>(this.playback.speed)
    ;[this.lang, this.setLang] = createSignal<Lang>(locale.lang)
    ;[this.confirmNew, this.setConfirmNew] = createSignal(false)
    ;[this.logOpen, this.setLogOpen] = createSignal(true)
    ;[this.look, this.setLook] = createSignal<Point | null>(null, { equals: false })
    ;[this.help, this.setHelp] = createSignal(false)
    ;[this.menu, this.setMenu] = createSignal(false)
    ;[this.extended, this.setExtended] = createSignal(false)
  }

  /** The model with the first soldier selected. */
  static open(session: Session, store: Storage): Model {
    const m = new Model(session, store)
    m.selectNext(false)
    return m
  }

  /** The selected soldier, when it stands and fights for the squad. */
  unit(): Unit | null {
    const u = this.game().units.find((x) => x.id === this.selected())
    return u?.alive() && u.allegiance() === "squad" ? u : null
  }

  /** The kit of the selected soldier. */
  kit(): Kit | null {
    const u = this.unit()
    return u ? new Kit(this.game(), u) : null
  }

  /** A foe the player sees on a tile. */
  foeAt(p: Point): Unit | undefined {
    const g = this.game()
    const u = g.unitAt(p)
    if (u?.allegiance() !== "enemy") return undefined
    return u.side === "squad" || g.stealth.visible(u) ? u : undefined
  }

  inside(p: Point): boolean {
    return this.game().board.inside(p)
  }

  /** Selects the next soldier; with all set, any living soldier, else only those with AP left. */
  selectNext(all: boolean, back = false, fallback = true): void {
    const squad = this.game().units.filter((u) => u.alive() && u.allegiance() === "squad" && (all || u.ap > 0))
    if (squad.length === 0) {
      if (!all && fallback) this.selectNext(true)
      return
    }
    const at = squad.findIndex((u) => u.id === this.selected())
    const step = back ? squad.length - 1 : 1
    const next = squad[at < 0 ? 0 : (at + step) % squad.length]
    batch(() => {
      this.setSelected(next.id)
      this.setLook(next.pos)
      this.setArmed(null)
      this.setMessage("")
    })
  }

  act(a: Action): void {
    const { session, playback } = this
    const before = session.game
    try {
      playback.add(before, session.act(a))
      if (a.type !== "endTurn" && spent(session.game)) playback.add(session.game, session.act({ type: "endTurn" }))
      batch(() => {
        this.setGame(session.game)
        this.setArmed(null)
        this.setMessage("")
        const u = this.unit()
        if (!u || u.ap === 0) this.selectNext(false)
      })
    } catch (e) {
      if (!(e instanceof Illegal)) throw e
      this.setMessage(t(`illegal.${e.message}`))
    }
  }

  /** First press arms a slot with a default target; a second press of the same slot confirms it. */
  press(slot: Slot): void {
    const kit = this.kit()
    if (!kit || slot.disabled) return
    const current = this.armed()
    if (current?.slot === slot.id) {
      const a = kit.action(kit.aim(current, this.hover()))
      if (a) this.act(a)
      else this.setMessage(slot.aim === "tile" ? t("ui.pickTile") : t("ui.pickTarget"))
      return
    }
    batch(() => {
      const target = slot.aim === "unit" ? kit.target(slot.id) : null
      this.setArmed({ slot: slot.id, target, at: null })
      this.setMessage(
        slot.aim === "none" || target
          ? t("ui.pressAgain", { key: slot.key })
          : slot.aim === "tile"
            ? t("ui.pickTile")
            : t("ui.pickTarget"),
      )
    })
  }

  /** Aims the weapon at a foe; a second call on the same foe fires. */
  aimAt(id: string): void {
    const kit = this.kit()
    const weapon = kit?.slots().find((s) => s.group === "weapon")
    if (!kit || !weapon || weapon.disabled) return
    const current = this.armed()
    if (current?.slot === weapon.id && current.target === id) {
      const a = kit.action(current)
      if (a) this.act(a)
      return
    }
    const foe = this.game().units.find((u) => u.id === id)
    batch(() => {
      this.setArmed({ slot: weapon.id, target: id, at: null })
      this.setMessage(t("ui.pressAgain", { key: weapon.key }))
      if (foe) this.setLook(foe.pos)
    })
  }

  /** A click on the board: picks targets, selects soldiers, opens doors, or moves. */
  click(p: Point): void {
    const g = this.game()
    if (g.phase !== "squad") return
    const kit = this.kit()
    const u = kit?.unit
    const here = g.unitAt(p)
    const current = this.armed()
    const slot = current && kit ? kit.slots().find((s) => s.id === current.slot) : undefined
    if (kit && u && current && slot) {
      const friendly = FRIENDLY.includes(current.slot.slice(8) as AbilityId)
      const ally =
        here && (current.slot === "ability:rouse" ? here.side === u.side : here.allegiance() === u.allegiance())
      if (slot.aim === "unit" && here && (ally === friendly || ANY.includes(current.slot.slice(8) as AbilityId))) {
        if (current.target === here.id) this.act(kit.action(kit.aim(current, this.hover()))!)
        else this.setArmed({ ...current, target: here.id, at: null })
        return
      }
      const target = current.target ? g.units.find((x) => x.id === current.target) : undefined
      if (current.slot === "ability:charge" && target && g.orders.landings(u, target).some((q) => same(q, p))) {
        if (current.at && same(current.at, p)) this.act(kit.action(current)!)
        else this.setArmed({ ...current, at: p })
        return
      }
      if (slot.aim === "tile") {
        if (current.at && same(current.at, p)) this.act(kit.action(current)!)
        else this.setArmed({ ...current, at: p })
        return
      }
    }
    if (here && here.side === "squad" && here.allegiance() === "squad") {
      batch(() => {
        this.setSelected(here.id)
        this.setArmed(null)
        this.setMessage("")
      })
      return
    }
    if (!kit || !u) return
    const foe = this.foeAt(p)
    if (foe) {
      const s = kit.slots()[0]
      if (current?.slot === s.id && current.target === foe.id) this.act(kit.action(current)!)
      else this.setArmed({ slot: s.id, target: foe.id, at: null })
      return
    }
    if (current) {
      this.setArmed(null)
      return
    }
    if (g.tile(p) === "door" && AROUND.some((d) => u.pos.x + d.x === p.x && u.pos.y + d.y === p.y)) {
      this.act({ type: "door", unit: u.id, at: p })
      return
    }
    this.act({ type: "move", unit: u.id, to: p })
  }

  key(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === "Escape") {
      batch(() => {
        this.setArmed(null)
        this.setMessage("")
        this.setHelp(false)
        this.setMenu(false)
      })
      return
    }
    if (e.key === "?") {
      this.setHelp(!this.help())
      return
    }
    if (e.key === "F1") {
      e.preventDefault()
      this.setExtended(!this.extended())
      return
    }
    if (e.key === "Tab") {
      e.preventDefault()
      this.selectNext(false, e.shiftKey, false)
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (this.game().phase === "squad") this.act({ type: "endTurn" })
      return
    }
    if (e.code === "Space") {
      e.preventDefault()
      this.setShown(this.playback.skip(performance.now()))
      return
    }
    if (e.code === "KeyZ") {
      this.setZones(!this.zones())
      return
    }
    const digit = e.code.startsWith("Digit") ? e.code.slice(5) : e.code.startsWith("Key") ? e.code.slice(3) : ""
    const kit = this.kit()
    const slot = kit && digit ? kit.slotFor(digit) : undefined
    if (slot) {
      e.preventDefault()
      this.press(slot)
    }
  }

  setSpeed(s: Speed): void {
    this.playback.speed = s
    this.setSpeedSignal(s)
    try {
      this.store.setItem(SPEED_KEY, String(s))
    } catch {
      return
    }
  }

  setLanguage(l: Lang): void {
    locale.use(l)
    locale.remember(this.store)
    this.setLang(l)
    this.setGame(this.session.game)
    this.setShown(this.shown())
  }

  undo(): void {
    this.session.undo()
    this.playback.reset(this.session.game)
    batch(() => {
      this.setGame(this.session.game)
      this.setShown(this.session.game)
    })
  }

  /** Starts a new mission on the second press. */
  newMission(): void {
    if (!this.confirmNew()) {
      this.setConfirmNew(true)
      return
    }
    this.session.start(Math.floor(Math.random() * 2 ** 31))
    this.playback.reset(this.session.game)
    batch(() => {
      this.setConfirmNew(false)
      this.setGame(this.session.game)
      this.setShown(this.session.game)
      this.setSelected(null)
      this.selectNext(false)
    })
  }

  /** Moves the cursor; an armed action follows it onto a valid target. */
  setHover(p: Point | null): void {
    batch(() => {
      this.setPointer(p)
      const kit = this.kit()
      const current = this.armed()
      if (kit && current) this.setArmed(kit.retarget(current, p))
    })
  }

  private read(k: string): string | null {
    try {
      return this.store.getItem(k)
    } catch {
      return null
    }
  }
}
