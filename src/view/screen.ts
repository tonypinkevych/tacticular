import { type Lang, language, remember, t, use } from "../i18n/strings"
import { canTarget, Illegal } from "../rules/actions"
import { odds } from "../rules/combat"
import { PROFILES, WEAPONS } from "../rules/data"
import { AROUND, area, inside, key, plus, reach, same, tileAt, unitAt } from "../rules/grid"
import { visibleToSquad } from "../rules/stealth"
import type { AbilityId, Action, Entry, Game, ItemId, Point, Unit, WeaponId } from "../rules/types"
import { alive, sideOf } from "../rules/units"
import type { Session } from "../save/session"
import { Playback, SPEEDS, type Speed } from "./motion"
import { draw, type Scene } from "./scene"

type Mode =
  | { kind: "move" }
  | { kind: "attack"; weapon: WeaponId; target: string | null }
  | { kind: "ability"; ability: AbilityId }
  | { kind: "item"; item: ItemId }

interface Slot {
  key: string
  label: string
  title: string
  info: string
  badge: string
  disabled: boolean
  active: boolean
  run: () => void
}

const KEYS = "QWERTYUIOP"
const UNIT_TARGETS: AbilityId[] = ["charge", "volley", "heal", "ward", "fear", "rouse"]
const TILE_TARGETS: AbilityId[] = ["bulwark", "blink"]
const SPEED_KEY = "tacticular.speed"
const BAR_ROOM = 150

const h = (tag: string, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElement => {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.append(...children)
  return el
}

const dice = (w: WeaponId): string => {
  const d = WEAPONS[w].dice
  return `${d.count}d${d.sides}${d.bonus ? `+${d.bonus}` : ""}`
}

/** The play screen: the board, the action bar, the side panel and the input that drives the session. */
export class Screen {
  private selected: string | null = null
  private mode: Mode = { kind: "move" }
  private hover: Point | null = null
  private hint: Slot | null = null
  private message = ""
  private zones = false
  private confirmNew = false
  private size = 28
  private readonly icons: Record<string, HTMLImageElement> = {}
  private readonly playback: Playback
  private running = false
  private wasBusy = false
  private barSign = ""
  private panelGame: Game | null = null

  constructor(
    private readonly session: Session,
    private readonly canvas: HTMLCanvasElement,
    private readonly panel: HTMLElement,
    private readonly bar: HTMLElement,
    private readonly tip: HTMLElement,
    private readonly store: Storage,
  ) {
    const saved = Number(this.read(SPEED_KEY) ?? 1)
    this.playback = new Playback((SPEEDS as readonly number[]).includes(saved) ? (saved as Speed) : 1, session.game)
    for (const kind of Object.keys(PROFILES)) {
      const img = new Image()
      img.src = `${import.meta.env.BASE_URL}icons/${kind}.svg`
      img.onload = () => this.render()
      this.icons[kind] = img
    }
    canvas.addEventListener("mousemove", (e) => this.onHover(e))
    canvas.addEventListener("mouseleave", () => {
      this.hover = null
      this.render()
    })
    canvas.addEventListener("click", (e) => this.onClick(e))
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault()
      this.cancel()
    })
    window.addEventListener("keydown", (e) => this.onKey(e))
    window.addEventListener("resize", () => this.render())
    this.selectNext(false)
    this.render()
  }

  private read(k: string): string | null {
    try {
      return this.store.getItem(k)
    } catch {
      return null
    }
  }

  private get game(): Game {
    return this.session.game
  }

  private unit(): Unit | null {
    const u = this.selected ? this.game.units.find((x) => x.id === this.selected) : undefined
    return u && alive(u) ? u : null
  }

  private name(game: Game, id: string | number | boolean | undefined): string {
    const u = game.units.find((x) => x.id === id)
    if (!u) return String(id ?? "")
    return u.side === "squad" ? `${u.name} (${t(`kind.${u.kind}`)})` : t(`kind.${u.kind}`)
  }

  private act(action: Action): void {
    if (this.playback.busy) this.playback.skip(performance.now())
    const before = this.game
    try {
      this.playback.add(before, this.session.act(action))
      this.message = ""
      this.mode = { kind: "move" }
      const u = this.unit()
      if (!u || u.ap === 0 || sideOf(u) !== "squad") this.selectNext(false)
    } catch (e) {
      if (!(e instanceof Illegal)) throw e
      this.message = t(`illegal.${e.message}`)
    }
    this.render()
  }

  /** Selects the next soldier; with all set, any living soldier, else only those with AP left. */
  private selectNext(all: boolean, back = false): void {
    const squad = this.game.units.filter((u) => alive(u) && sideOf(u) === "squad" && (all || u.ap > 0))
    if (squad.length === 0) {
      if (!all) this.selectNext(true)
      return
    }
    const at = squad.findIndex((u) => u.id === this.selected)
    const step = back ? squad.length - 1 : 1
    this.selected = squad[at < 0 ? 0 : (at + step) % squad.length].id
    this.mode = { kind: "move" }
  }

  private cancel(): void {
    this.mode = { kind: "move" }
    this.message = ""
    this.render()
  }

  private point(e: MouseEvent): Point | null {
    const r = this.canvas.getBoundingClientRect()
    const p = { x: Math.floor((e.clientX - r.left) / this.size), y: Math.floor((e.clientY - r.top) / this.size) }
    return inside(this.game.board, p) ? p : null
  }

  private onHover(e: MouseEvent): void {
    const p = this.point(e)
    if (p && this.hover && same(p, this.hover)) return
    this.hover = p
    this.render()
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === "Escape") this.cancel()
    if (e.key === "Tab") {
      e.preventDefault()
      this.selectNext(true, e.shiftKey)
      this.render()
      return
    }
    const letter = e.code.startsWith("Key") ? e.code.slice(3) : ""
    if (letter === "Z") {
      this.zones = !this.zones
      this.render()
      return
    }
    const slot = this.slots().find((s) => s.key === letter)
    if (slot && !slot.disabled) {
      e.preventDefault()
      slot.run()
    }
  }

  private foeAt(p: Point): Unit | undefined {
    const u = unitAt(this.game, p)
    if (!u || sideOf(u) !== "enemy") return undefined
    return u.side === "squad" || visibleToSquad(this.game, u) ? u : undefined
  }

  private onClick(e: MouseEvent): void {
    if (this.playback.busy) {
      this.playback.skip(performance.now())
      this.render()
      return
    }
    const p = this.point(e)
    if (!p || this.game.phase !== "squad") return
    const here = unitAt(this.game, p)
    const u = this.unit()
    const m = this.mode
    if (u && m.kind === "ability" && UNIT_TARGETS.includes(m.ability) && here) {
      this.act({ type: "ability", unit: u.id, ability: m.ability, target: here.id })
      return
    }
    if (u && m.kind === "ability" && TILE_TARGETS.includes(m.ability)) {
      this.act({ type: "ability", unit: u.id, ability: m.ability, at: p })
      return
    }
    if (u && m.kind === "item") {
      this.act({ type: "item", unit: u.id, item: m.item, at: p })
      return
    }
    if (here && here.side === "squad" && sideOf(here) === "squad") {
      this.selected = here.id
      this.mode = { kind: "move" }
      this.message = ""
      this.render()
      return
    }
    if (!u) return
    const foe = this.foeAt(p)
    if (foe) {
      const weapon = m.kind === "attack" ? m.weapon : u.weapon
      if (m.kind === "attack" && m.target === foe.id) {
        this.act({ type: "attack", unit: u.id, target: foe.id, weapon })
        return
      }
      this.mode = { kind: "attack", weapon, target: foe.id }
      this.render()
      return
    }
    if (tileAt(this.game, p) === "door" && AROUND.some((d) => same(plus(u.pos, d), p))) {
      this.act({ type: "door", unit: u.id, at: p })
      return
    }
    if (m.kind === "attack") {
      this.cancel()
      return
    }
    this.act({ type: "move", unit: u.id, to: p })
  }

  private cursor(): string {
    if (this.playback.busy) return "progress"
    const m = this.mode
    if (m.kind === "attack" || (m.kind === "ability" && UNIT_TARGETS.includes(m.ability))) return "crosshair"
    if (m.kind === "item" || m.kind === "ability") return "cell"
    if (this.hover && this.foeAt(this.hover)) return "crosshair"
    return "pointer"
  }

  private fit(): number {
    const { width, height } = this.game.board
    const room = Math.min((window.innerWidth - 400) / width, (window.innerHeight - BAR_ROOM) / height)
    this.size = Math.max(16, Math.min(44, Math.floor(room)))
    return this.size
  }

  private scene(now: number): Scene {
    const still = this.playback.at(now)
    const game = still.game
    const u = this.unit()
    const near = new Set<number>()
    const far = new Set<number>()
    let path: Point[] = []
    const targets = new Set<string>()
    let spot: Point[] = []
    const idle = !this.playback.busy
    if (idle && u && this.game.phase === "squad" && u.ap > 0 && sideOf(u) === "squad") {
      if (this.mode.kind === "move") {
        const r = reach(this.game, u, u.mobility * u.ap)
        for (const [k, c] of r.cost) {
          if (c === 0) continue
          far.add(k)
          if (u.ap === 2 && c <= u.mobility) near.add(k)
        }
        if (this.hover && r.cost.has(key(this.hover))) path = r.path(this.hover)
      }
      for (const e of this.game.units)
        if (e.side === "enemy" && visibleToSquad(this.game, e) && canTarget(this.game, u, e)) targets.add(e.id)
      const m = this.mode
      if (this.hover && m.kind === "item") spot = m.item === "stone" ? [this.hover] : area(this.hover, 1)
      if (this.hover && m.kind === "ability" && TILE_TARGETS.includes(m.ability)) spot = [this.hover]
    }
    return {
      game,
      size: this.fit(),
      icons: this.icons,
      selected: idle ? u : null,
      near,
      far,
      path,
      hover: this.hover,
      targets,
      area: spot.filter((p) => inside(game.board, p)),
      zones: this.zones,
      mover: still.mover,
      shot: still.shot,
      texts: this.playback.texts,
      now,
      life: 1100 / Math.max(1, this.playback.speed),
    }
  }

  /** Draws the board, and the panel and bar unless only an animation frame changed; keeps drawing while anything moves. */
  render(full = true): void {
    const now = performance.now()
    const sc = this.scene(now)
    const { width, height } = sc.game.board
    const dpr = window.devicePixelRatio || 1
    const w = width * sc.size
    const hgt = height * sc.size
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hgt * dpr)) {
      this.canvas.width = Math.round(w * dpr)
      this.canvas.height = Math.round(hgt * dpr)
      this.canvas.style.width = `${w}px`
      this.canvas.style.height = `${hgt}px`
    }
    const ctx = this.canvas.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw(ctx, sc)
    this.canvas.style.cursor = this.cursor()
    const shown = this.playback.busy ? sc.game : this.game
    if (full || shown !== this.panelGame) {
      this.panelGame = shown
      this.renderPanel(shown)
      this.renderBar()
    }
    if (this.playback.live && !this.running) {
      this.running = true
      requestAnimationFrame(() => {
        this.running = false
        this.render(this.wasBusy && !this.playback.busy)
        this.wasBusy = this.playback.busy
      })
    }
  }

  private button(
    label: string,
    onClick: () => void,
    opts: { disabled?: boolean; active?: boolean; title?: string } = {},
  ): HTMLElement {
    const b = h("button", { type: "button", title: opts.title ?? "" }, label) as HTMLButtonElement
    b.disabled = !!opts.disabled
    if (opts.active) b.classList.add("active")
    b.addEventListener("click", onClick)
    return b
  }

  private slots(): Slot[] {
    const u = this.unit()
    if (!u || this.game.phase !== "squad" || sideOf(u) !== "squad") return []
    const out: Omit<Slot, "key">[] = []
    const none = u.ap <= 0
    const p = PROFILES[u.kind]
    for (const w of [u.weapon, p.sidearm].filter((x): x is WeaponId => !!x)) {
      const weapon = WEAPONS[w]
      const range = weapon.melee ? t("ui.melee") : `${t("ui.range")} ${weapon.min}–${weapon.max}`
      const ammo = weapon.ammo !== null && w === u.weapon ? ` · ${t("ui.ammo")} ${u.ammo}/${weapon.ammo}` : ""
      out.push({
        label: t(`weapon.${w}`),
        title: t(`weapon.${w}`),
        info: `${t("ui.damage")} ${dice(w)} · ${range}${ammo}`,
        badge: w === "axes" ? `×${u.axes}` : weapon.ammo !== null && w === u.weapon ? `${u.ammo}` : "",
        disabled: none || (w === "axes" && u.axes <= 0),
        active: this.mode.kind === "attack" && this.mode.weapon === w,
        run: () => {
          this.mode = { kind: "attack", weapon: w, target: null }
          this.message = t("ui.pickTarget")
          this.render()
        },
      })
    }
    const dominated = this.game.units.some((x) => alive(x) && x.side === "squad" && sideOf(x) === "enemy")
    for (const a of p.abilities) {
      if (a === "rouse" && !dominated) continue
      const cd = u.cooldowns[a] ?? 0
      out.push({
        label: t(`ability.${a}`),
        title: t(`ability.${a}`),
        info: t(`info.${a}`),
        badge: cd ? `${cd}` : "",
        disabled: none || cd > 0,
        active: this.mode.kind === "ability" && this.mode.ability === a,
        run: () => this.pickAbility(u, a),
      })
    }
    for (const it of ["flask", "smoke", "stone"] as ItemId[]) {
      const n = u.items[it]
      if (n <= 0) continue
      out.push({
        label: t(`item.${it}`),
        title: t(`item.${it}`),
        info: t(`info.${it}`),
        badge: Number.isFinite(n) ? `×${n}` : "",
        disabled: none,
        active: this.mode.kind === "item" && this.mode.item === it,
        run: () => {
          this.mode = { kind: "item", item: it }
          this.message = t("ui.pickTile")
          this.render()
        },
      })
    }
    const plain = (id: "overwatch" | "hunker" | "reload") => ({
      label: t(`action.${id}`),
      title: t(`action.${id}`),
      info: t(`info.${id}`),
      badge: "",
      disabled: none,
      active: false,
      run: () => this.act({ type: id, unit: u.id }),
    })
    out.push(plain("overwatch"), plain("hunker"))
    if (WEAPONS[u.weapon].ammo !== null) out.push(plain("reload"))
    return out.map((s, i) => ({ ...s, key: KEYS[i] ?? "" }))
  }

  private renderBar(): void {
    const list = this.slots()
    const sign = JSON.stringify([
      list.map(({ run: _, ...rest }) => rest),
      this.playback.speed,
      this.game.phase,
      language(),
    ])
    if (sign === this.barSign) return
    this.barSign = sign
    const slots = list.map((s) => {
      const b = h(
        "button",
        { type: "button", class: `slot${s.active ? " active" : ""}` },
        h("span", { class: "key" }, s.key),
        h("span", { class: "label" }, s.label),
        s.badge ? h("span", { class: "badge" }, s.badge) : "",
      ) as HTMLButtonElement
      b.disabled = s.disabled
      b.addEventListener("click", () => s.run())
      b.addEventListener("mouseenter", () => {
        this.hint = s
        this.renderTip()
      })
      b.addEventListener("mouseleave", () => {
        this.hint = null
        this.renderTip()
      })
      return b
    })
    const speeds = h(
      "div",
      { class: "speeds" },
      h("span", { class: "muted small" }, t("ui.speed")),
      ...SPEEDS.map((sp) =>
        this.button(
          sp === 0 ? t("ui.instant") : `${sp}×`,
          () => {
            this.playback.speed = sp
            try {
              this.store.setItem(SPEED_KEY, String(sp))
            } catch {
              return
            }
            this.renderBar()
          },
          { active: this.playback.speed === sp },
        ),
      ),
    )
    const end = this.button(t("ui.endTurn"), () => this.act({ type: "endTurn" }), {
      disabled: this.game.phase !== "squad",
    })
    end.classList.add("end")
    this.bar.replaceChildren(h("div", { class: "slots" }, ...slots), h("div", { class: "side" }, end, speeds))
    this.renderTip()
  }

  private renderTip(): void {
    const s = this.hint
    if (s) {
      this.tip.replaceChildren(
        h("div", { class: "name" }, `${s.title} `, h("span", { class: "muted small" }, t("ui.key", { key: s.key }))),
        h("div", {}, s.info),
      )
      return
    }
    this.tip.replaceChildren(h("div", { class: this.message ? "message" : "muted" }, this.message || t("ui.help")))
  }

  private renderPanel(g: Game): void {
    const u = this.unit()
    const lang = language()
    const langs = h(
      "div",
      { class: "row" },
      ...(["en", "ru"] as Lang[]).map((l) =>
        this.button(
          l.toUpperCase(),
          () => {
            use(l)
            remember(this.store, l)
            this.panelGame = null
            this.render()
          },
          { active: l === lang },
        ),
      ),
    )
    const parts: HTMLElement[] = [
      h("header", {}, h("h1", {}, t("ui.title")), langs),
      h("div", { class: `phase ${g.phase}` }, `${t("ui.round", { round: g.round })} · ${t(`ui.phase.${g.phase}`)}`),
      h("div", { class: "muted" }, t("ui.seed", { seed: g.seed })),
    ]
    parts.push(u ? this.card(u) : h("p", { class: "muted" }, t("ui.pick")))
    const preview = this.preview(u)
    if (preview) parts.push(preview)
    const info = this.info()
    if (info) parts.push(info)
    parts.push(
      h(
        "div",
        { class: "row wrap" },
        this.button(
          t("ui.undo"),
          () => {
            this.session.undo()
            this.playback.reset(this.game)
            this.render()
          },
          { disabled: !this.session.canUndo() || this.playback.busy },
        ),
        this.button(
          t("ui.zones"),
          () => {
            this.zones = !this.zones
            this.render()
          },
          { active: this.zones },
        ),
        this.button(this.confirmNew ? t("ui.confirm") : t("ui.newMission"), () => this.newMission()),
      ),
    )
    parts.push(h("h2", {}, t("ui.log")), this.log(g))
    parts.push(
      h(
        "p",
        { class: "muted small" },
        t("ui.save", { count: this.session.events.length, key: `${this.session.author.slice(0, 12)}…` }),
      ),
    )
    parts.push(h("p", { class: "muted small" }, t("ui.credits")))
    this.panel.replaceChildren(...parts)
  }

  private newMission(): void {
    if (!this.confirmNew) {
      this.confirmNew = true
      this.render()
      return
    }
    this.confirmNew = false
    this.session.start(Math.floor(Math.random() * 2 ** 31))
    this.playback.reset(this.game)
    this.selected = null
    this.selectNext(false)
    this.render()
  }

  private card(u: Unit): HTMLElement {
    const w = WEAPONS[u.weapon]
    const stats = [
      `${t("ui.hp")} ${u.hp}/${u.maxHp}`,
      `${t("ui.ap")} ${u.ap}`,
      `${t("ui.aim")} +${u.aim}`,
      `${t("ui.defense")} ${u.defense}`,
      `${t("ui.armor")} ${u.armor}`,
      `${t("ui.mobility")} ${u.mobility}`,
      `${t("ui.will")} +${u.will}`,
      `${t("ui.vision")} ${u.vision}`,
    ]
    if (w.ammo !== null) stats.push(`${t("ui.ammo")} ${u.ammo}/${w.ammo}`)
    const status = [
      u.concealed ? t("ui.concealed") : t("ui.revealed"),
      ...u.statuses.map((s) => t(`status.${s.id}`)),
      u.stance !== "none" ? t(`action.${u.stance}`) : "",
    ]
      .filter(Boolean)
      .join(" · ")
    return h(
      "section",
      { class: "card" },
      h("div", { class: "name" }, this.name(this.game, u.id)),
      h("div", { class: "stats" }, ...stats.map((s) => h("span", {}, s))),
      h("div", { class: "muted" }, status),
    )
  }

  private pickAbility(u: Unit, a: AbilityId): void {
    if (!UNIT_TARGETS.includes(a) && !TILE_TARGETS.includes(a)) {
      this.act({ type: "ability", unit: u.id, ability: a })
      return
    }
    this.mode = { kind: "ability", ability: a }
    this.message = `${t(`ability.${a}`)}: ${UNIT_TARGETS.includes(a) ? t("ui.pickTarget") : t("ui.pickTile")}`
    this.render()
  }

  private preview(u: Unit | null): HTMLElement | null {
    const m = this.mode
    if (!u || m.kind !== "attack" || !m.target) return null
    const target = this.game.units.find((x) => x.id === m.target)
    if (!target) return null
    const o = odds(this.game, u, target, m.weapon)
    const lines = [
      h("div", { class: "name" }, `${t(`weapon.${m.weapon}`)} → ${this.name(this.game, target.id)}`),
      h("div", { class: "big" }, `${t("ui.chance")}: ${Math.round(o.chance * 100)}%`),
      h("div", {}, `${t("ui.damage")}: ${o.min}–${o.max}`),
      h("div", { class: "muted" }, `d20 +${o.aim} vs ${o.defense}`),
    ]
    if (o.advantages.length)
      lines.push(
        h("div", { class: "good" }, `${t("ui.advantage")}: ${o.advantages.map((r) => t(`reason.${r}`)).join(", ")}`),
      )
    if (o.disadvantages.length)
      lines.push(
        h(
          "div",
          { class: "bad" },
          `${t("ui.disadvantage")}: ${o.disadvantages.map((r) => t(`reason.${r}`)).join(", ")}`,
        ),
      )
    lines.push(
      h(
        "div",
        { class: "row" },
        this.button(t("ui.confirm"), () =>
          this.act({ type: "attack", unit: u.id, target: target.id, weapon: m.weapon }),
        ),
        this.button(t("ui.cancel"), () => this.cancel()),
      ),
    )
    return h("section", { class: "card preview" }, ...lines)
  }

  private info(): HTMLElement | null {
    if (!this.hover) return null
    const e = this.foeAt(this.hover)
    if (!e) return null
    const bits = [
      `${t("ui.hp")} ${e.hp}/${e.maxHp}`,
      t(`alert.${e.alert}`),
      ...e.statuses.map((s) => t(`status.${s.id}`)),
    ]
    if (e.stance !== "none") bits.push(t(`action.${e.stance}`))
    return h(
      "section",
      { class: "card enemy" },
      h("div", { class: "name" }, this.name(this.game, e.id)),
      h("div", { class: "muted" }, bits.join(" · ")),
    )
  }

  private line(g: Game, e: Entry): string {
    const p: Record<string, string | number | boolean> = { ...e.params }
    for (const k of ["unit", "target", "by"]) if (k in p) p[k] = this.name(g, p[k])
    if (typeof p.weapon === "string") p.weapon = t(`weapon.${p.weapon}`)
    if ("saved" in p) p.result = t(p.saved ? "ui.saved" : "ui.failed")
    return t(e.key, p)
  }

  private log(g: Game): HTMLElement {
    const entries = g.log.slice(-60).reverse()
    return h(
      "ol",
      { class: "log" },
      ...entries.map((e) => h("li", { class: e.key.replace(".", "-") }, this.line(g, e))),
    )
  }
}
