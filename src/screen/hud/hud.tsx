import { For, Index, type JSX, onCleanup, onMount, Show } from "solid-js"
import type { Part } from "../../combat/combat"
import { chance, EDGE } from "../../combat/dice"
import { WEAPONS } from "../../combat/weapons"
import { t } from "../../i18n/strings"
import { key } from "../../map/point"
import type { Game } from "../../mission/game"
import type { Unit } from "../../units/unit"
import { Board } from "../board/board"
import { css } from "../board/color"
import { ICONS, UNITS } from "../board/glyphs"
import { tone } from "../board/picture"
import type { Model } from "../model"
import { SPEEDS } from "../playback/motion"
import { Icon } from "./icon"
import { type Forecast, Kit } from "./kit"
import { Log } from "./log"

const Portrait = (props: { unit: Unit }) => (
  <Icon glyph={UNITS[props.unit.kind]} color={css(tone(props.unit))} class="portrait" />
)

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

function Hp(props: { unit: Unit }) {
  return (
    <div class="hp">
      <div class="segments">
        <Index each={Array.from({ length: props.unit.maxHp })}>
          {(_, i) => <span classList={{ full: i < props.unit.hp }} />}
        </Index>
      </div>
      <span class="num">
        {props.unit.hp}/{props.unit.maxHp}
      </span>
    </div>
  )
}

/** A unit at a glance: who, health, actions, weapon and what affects it; stats show on hover. */
function Card(props: { unit: Unit; game: Game; model: Model; children?: JSX.Element }) {
  const u = () => props.unit
  const soldier = () => u().side === "squad"
  const flanked = () => {
    const g = props.game
    const enemies = g.units.filter((x) => x.alive() && x.foe(u()) && (x.side === "squad" || g.stealth.visible(x)))
    return g.cover.flankers(u(), enemies).length > 0
  }
  const w = () => WEAPONS[u().weapon]
  const stat = (label: string, value: string | number) => (
    <div class="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
  return (
    <section class="card" classList={{ foe: !soldier() }}>
      <button
        type="button"
        class="more-mark"
        title={t("ui.extended")}
        onClick={() => props.model.setExtended(!props.model.extended())}
      >
        F1
      </button>
      <div class="head">
        <Portrait unit={u()} />
        <div class="who">
          <div class="name">{soldier() ? u().name : t(`kind.${u().kind}`)}</div>
          <div class="small">{soldier() ? t(`kind.${u().kind}`) : t(`alert.${u().alert}`)}</div>
        </div>
        <Show when={soldier()}>
          <div class="ap" title={t("ui.ap")}>
            <Index each={[0, 1]}>{(_, i) => <span class="pip" classList={{ full: i < u().ap }} />}</Index>
          </div>
        </Show>
      </div>
      <Hp unit={u()} />
      <div class="weapon">
        <span>{t(`weapon.${u().weapon}`)}</span>
        <span class="muted">
          {w().dice.count + w().dice.bonus}–{w().dice.count * w().dice.sides + w().dice.bonus}
        </span>
        <Show when={w().ammo !== null}>
          <span class="ammo">
            <Index each={Array.from({ length: w().ammo ?? 0 })}>
              {(_, i) => <span classList={{ full: i < u().ammo }} />}
            </Index>
          </span>
        </Show>
      </div>
      <div class="chips">
        <Show when={soldier() && u().concealed}>
          <span class="chip hidden">{t("ui.concealed")}</span>
        </Show>
        <Show when={flanked()}>
          <span class="chip danger">{t("ui.flanked")}</span>
        </Show>
        <Show when={u().intent}>
          <span class="chip danger">{t("ui.telegraph")}</span>
        </Show>
        <Show when={u().wounded()}>
          <span class="chip status" title={t("about.wounded")}>
            {t("ui.wounded")}
          </span>
        </Show>
        <Show when={u().stance !== "none"}>
          <span class="chip">{t(`action.${u().stance}`)}</span>
        </Show>
        <For each={u().statuses}>
          {(st) => (
            <span class="chip status" title={t(`about.${st.id}`)}>
              {t(`status.${st.id}`)}
              <Show when={st.rounds < 99}> {st.rounds}</Show>
            </span>
          )}
        </For>
      </div>
      <div class="stats">
        {stat(t("ui.aim"), signed(u().aim))}
        {stat(t("ui.defense"), u().defense)}
        {stat(t("ui.mobility"), u().mobility)}
        {stat(t("ui.vision"), u().vision)}
        {stat(t("ui.will"), signed(u().will))}
      </div>
      {props.children}
    </section>
  )
}

function Parts(props: { parts: Part[] }) {
  return (
    <span class="muted">
      {" ("}
      {props.parts.map((p, i) => `${i ? ", " : ""}${t(`part.${p.key}`)} ${i ? signed(p.value) : p.value}`).join("")}
      {")"}
    </span>
  )
}

/** The 20 faces of the d20: red misses, green hits, gold is a critical; all gold for a sure critical. */
function Strip(props: { need: number; sure: boolean }) {
  return (
    <div class="strip">
      <Index each={Array.from({ length: 20 }, (_, i) => i + 1)}>
        {(face) => (
          <span
            classList={{
              crit: props.sure || face() === 20,
              hit: !props.sure && face() >= props.need && face() < 20,
              miss: !props.sure && face() < props.need,
            }}
          />
        )}
      </Index>
    </div>
  )
}

function Edge(props: { edge: number; advantages: string[]; disadvantages: string[]; before: number; after: number }) {
  const why = (list: string[]) => list.map((r) => t(`reason.${r}`)).join(", ")
  const both = () =>
    [
      ...props.advantages.map((r) => `+${t(`reason.${r}`)}`),
      ...props.disadvantages.map((r) => `−${t(`reason.${r}`)}`),
    ].join(", ")
  const pct = () => ({
    before: Math.round(props.before * 100),
    after: Math.round(props.after * 100),
    value: Math.abs(props.edge) * EDGE,
    why: both(),
  })
  return (
    <div classList={{ good: props.edge > 0, bad: props.edge < 0, muted: props.edge === 0 }}>
      {props.edge > 0
        ? t("ui.edge.advantage", pct())
        : props.edge < 0
          ? t("ui.edge.disadvantage", pct())
          : props.advantages.length || props.disadvantages.length
            ? t("ui.edge.cancel", { good: why(props.advantages), bad: why(props.disadvantages) })
            : t("ui.edge.none")}
    </div>
  )
}

/** The chance of an armed action in big type, with how it is built on hover. */
function Odds(props: { forecast: Forecast }) {
  const d = () => props.forecast
  return (
    <div class="odds">
      <div class="label">{d().label}</div>
      <Show when={d().kind === "attack" && (d() as Extract<Forecast, { kind: "attack" }>)}>
        {(a) => (
          <>
            <div class="big">
              {Math.round(a().odds.chance * 100)}%
              <span class="dmg">
                {a().odds.min}–{a().odds.max} {t("ui.damage")}
              </span>
            </div>
            <Strip need={a().odds.need} sure={a().odds.sure} />
            <div class="more">
              <div>{a().odds.sure ? t("ui.sure") : t("ui.need", { need: a().odds.need })}</div>
              <div>
                {t("ui.yourAim")} {signed(a().odds.aim)}
                <Parts parts={a().odds.aimParts} />
              </div>
              <div>
                {t("ui.theirDefense")} {a().odds.defense}
                <Parts parts={a().odds.defenseParts} />
              </div>
              <Edge
                edge={a().odds.edge}
                advantages={a().odds.advantages}
                disadvantages={a().odds.disadvantages}
                before={chance(a().odds.aim, a().odds.defense, 0)}
                after={a().odds.chance}
              />
              <div class="muted small">{t("ui.naturals")}</div>
            </div>
          </>
        )}
      </Show>
      <Show when={d().kind === "save" && (d() as Extract<Forecast, { kind: "save" }>)}>
        {(s) => (
          <>
            <div class="big">{Math.round(s().chance * 100)}%</div>
            <div class="more">
              <div>{t("ui.saveRule", { will: signed(s().will), dc: s().dc })}</div>
              <Show when={s().edge > 0}>
                <div class="bad">{t("ui.saveHunker")}</div>
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

/** The armed action's target with its odds, else the unit under the cursor. */
function Target(props: { model: Model }) {
  const m = props.model
  const g = () => m.game()
  const armed = () => {
    const u = m.unit()
    const a = m.armed()
    return u && a ? { u, a } : null
  }
  const shown = (): Unit | undefined => {
    const a = m.armed()
    if (a?.target) return g().units.find((x) => x.id === a.target && x.alive())
    const h = m.hover()
    const x = h ? g().unitAt(h) : undefined
    if (!x || x.id === m.unit()?.id) return undefined
    return x.side === "squad" || g().stealth.visible(x) ? x : undefined
  }
  const odds = () => {
    const x = armed()
    return x ? new Kit(g(), x.u).forecast(x.a, m.hover()) : null
  }
  return (
    <Show when={shown()}>
      {(x) => (
        <Card unit={x()} game={g()} model={m}>
          <Show when={odds()}>{(f) => <Odds forecast={f()} />}</Show>
        </Card>
      )}
    </Show>
  )
}

/** Round and phase, the log toggle and a menu with everything that is not an action. */
/** The mission goal in a few words, with the rounds left to hold a beacon. */
function goal(g: Game): string {
  const k = g.goal.kind
  return k === "defend" ? t("ui.goal.defend", { left: g.goal.rounds - g.round + 1 }) : t(`ui.goal.${k}`)
}

function Top(props: { model: Model }) {
  const m = props.model
  const canUndo = () => {
    m.game()
    return m.session.canUndo()
  }
  return (
    <header id="top">
      <h1>{t("ui.title")}</h1>
      <span class={`phase ${m.shown().phase}`}>
        {t("ui.round", { round: m.shown().round })} · {t(`ui.phase.${m.shown().phase}`)}
      </span>
      <span class="goal">{goal(m.shown())}</span>
      <Show when={m.shown().drop}>
        {(d) => <span class="drop">{t("ui.drop", { left: d().round - m.shown().round + 1 })}</span>}
      </Show>
      <span class="grow" />
      <button type="button" classList={{ active: m.help() }} onClick={() => m.setHelp(!m.help())}>
        ?
      </button>
      <button type="button" classList={{ active: m.logOpen() }} onClick={() => m.setLogOpen(!m.logOpen())}>
        {t("ui.log")}
      </button>
      <button type="button" classList={{ active: m.menu() }} onClick={() => m.setMenu(!m.menu())}>
        {t("ui.menu")}
      </button>
      <Show when={m.menu()}>
        <div id="menu">
          <span class="muted small">{t("ui.seed", { seed: m.game().seed })}</span>
          <button type="button" disabled={!canUndo()} onClick={() => m.undo()}>
            {t("ui.undo")}
          </button>
          <button type="button" classList={{ active: m.zones() }} onClick={() => m.setZones(!m.zones())}>
            {t("ui.zones")}
          </button>
          <button type="button" onClick={() => m.newMission()}>
            {m.confirmNew() ? t("ui.confirm") : t("ui.newMission")}
          </button>
          <div class="row" title={t("ui.speed")}>
            <For each={SPEEDS}>
              {(sp) => (
                <button type="button" classList={{ active: m.speed() === sp }} onClick={() => m.setSpeed(sp)}>
                  {sp === 0 ? t("ui.instant") : `${sp}×`}
                </button>
              )}
            </For>
          </div>
          <div class="row">
            <For each={["en", "ru"] as const}>
              {(l) => (
                <button type="button" classList={{ active: m.lang() === l }} onClick={() => m.setLanguage(l)}>
                  {l.toUpperCase()}
                </button>
              )}
            </For>
          </div>
          <p class="muted small">
            {t("ui.save", { count: m.session.events.length, key: `${m.session.author.slice(0, 12)}…` })}
          </p>
          <p class="muted small">{t("ui.credits")}</p>
        </div>
      </Show>
    </header>
  )
}

/** The log panel, which the player can hide. */
function Panel(props: { model: Model }) {
  const m = props.model
  return (
    <aside id="panel">
      <header>
        <h2>{t("ui.log")}</h2>
        <button type="button" class="close" aria-label="×" onClick={() => m.setLogOpen(false)}>
          ×
        </button>
      </header>
      <Log game={m.shown()} />
    </aside>
  )
}

const GROUPS = ["weapon", "skill", "ult", "stance"] as const
const FAMILY = { weapon: "#efe4cc", skill: "#7fc8e8", ult: "#ffb347", stance: "#a8c49a" } as const

/** Action slots grouped as weapon, skills, ultimate and stances, then End turn. */
function Bar(props: { model: Model }) {
  const m = props.model
  const list = () => {
    const u = m.unit()
    return u ? new Kit(m.game(), u).slots() : []
  }
  return (
    <nav id="bar">
      <For each={GROUPS.filter((k) => list().some((s) => s.group === k))}>
        {(k) => (
          <div class="slots">
            <Index each={list().filter((s) => s.group === k)}>
              {(s) => (
                <button
                  type="button"
                  class="slot"
                  aria-label={s().label}
                  classList={{ active: m.armed()?.slot === s().id, ready: s().group === "ult" && !s().disabled }}
                  disabled={s().disabled}
                  onClick={() => m.press(s())}
                  onMouseEnter={() => m.setHint(s())}
                  onMouseLeave={() => m.setHint(null)}
                >
                  <span class="face">
                    <span class="key">{s().key}</span>
                    <Show when={s().badge}>
                      <span class="badge">{s().badge}</span>
                    </Show>
                    <Icon glyph={ICONS[s().id] ?? ICONS.unknown} color={FAMILY[s().group]} class="glyph" />
                  </span>
                </button>
              )}
            </Index>
          </div>
        )}
      </For>
      <button
        type="button"
        class="end"
        disabled={m.game().phase !== "squad"}
        onClick={() => m.act({ type: "endTurn" })}
      >
        {t("ui.endTurn")}
      </button>
    </nav>
  )
}

/**
 * The aliens the selected soldier can target, as XCOM shows them: hit chance, amber when flanked. While the
 * cursor plans a move it shows who the soldier would see from there. Pointing shows the alien; a click aims.
 */
function Contacts(props: { model: Model }) {
  const m = props.model
  const list = () => {
    const u = m.unit()
    if (!u || m.game().phase !== "squad") return []
    const g = m.game()
    const h = m.hover()
    const planned = h && u.ap > 0 && !m.armed() && g.reach(u, u.stride()).cost.has(key(h)) ? h : u.pos
    return new Kit(g, u).sights(planned)
  }
  return (
    <Show when={list().length > 0}>
      <div id="contacts">
        <For each={list()}>
          {(c) => (
            <button
              type="button"
              class="contact"
              classList={{ flanked: c.flanked, aimed: m.armed()?.target === c.unit.id }}
              title={c.unit.name}
              onClick={() => m.aimAt(c.unit.id)}
            >
              <Icon glyph={UNITS[c.unit.kind]} color={css(tone(c.unit))} class="who" />
              <span class="chance">{c.chance}%</span>
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}

/** The hovered or armed action's name and effect, or a message; hidden when there is nothing to say. */
function Tip(props: { model: Model }) {
  const m = props.model
  const shown = () => {
    const h = m.hint()
    if (h) return h
    const a = m.armed()
    const u = m.unit()
    return a && u ? new Kit(m.game(), u).slots().find((s) => s.id === a.slot) : undefined
  }
  return (
    <Show when={shown() || m.message()}>
      <div id="tip">
        <Show when={shown()}>
          {(s) => (
            <div>
              <span class="name">{s().label}</span> <span class="muted">{s().info}</span>
            </div>
          )}
        </Show>
        <Show when={!m.hint() && m.message()}>
          <div class="message">{m.message()}</div>
        </Show>
      </div>
    </Show>
  )
}

/** The keys and clicks, shown while the player asks for them. */
function Help(props: { model: Model }) {
  return (
    <Show when={props.model.help()}>
      <div id="help" class="card">
        <For each={t("ui.help").split(" · ")}>{(line) => <div>{line}</div>}</For>
      </div>
    </Show>
  )
}

/** The whole screen; it renders again from scratch when the language changes. */
export function App(props: { model: Model }): JSX.Element {
  const m = props.model
  const key = (e: KeyboardEvent) => m.key(e)
  onMount(() => window.addEventListener("keydown", key))
  onCleanup(() => window.removeEventListener("keydown", key))
  return (
    <Show when={m.lang()} keyed>
      <main classList={{ logged: m.logOpen(), alien: m.shown().phase === "enemy", extended: m.extended() }}>
        <Board model={m} />
        <Top model={m} />
        <Show when={m.shown().phase === "enemy"}>
          <div id="banner">{t("ui.activity")}</div>
        </Show>
        <Help model={m} />
        <div class="corner left">
          <Show when={m.unit()}>{(u) => <Card unit={u()} game={m.game()} model={m} />}</Show>
        </div>
        <div class="corner right">
          <Target model={m} />
        </div>
        <div id="dock">
          <Tip model={m} />
          <Contacts model={m} />
          <Bar model={m} />
        </div>
        <Show when={m.logOpen()}>
          <Panel model={m} />
        </Show>
      </main>
    </Show>
  )
}
