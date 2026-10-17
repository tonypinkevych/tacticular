import { For, Index, type JSX, onCleanup, onMount, Show } from "solid-js"
import { t } from "../i18n/strings"
import type { Part } from "../rules/combat"
import { flankers } from "../rules/cover"
import { WEAPONS } from "../rules/data"
import { chance } from "../rules/dice"
import { visibleToSquad } from "../rules/stealth"
import type { Game, Unit } from "../rules/types"
import { alive, foes } from "../rules/units"
import { Board } from "./board"
import { Log, name } from "./log"
import { type Forecast, forecast, type Model, slots } from "./model"
import { SPEEDS } from "./motion"

const icon = (kind: string) => `${import.meta.env.BASE_URL}icons/${kind}.svg`

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

/** A unit at a glance: who, how healthy, how many actions left, what it carries, what threatens it. */
function Card(props: { unit: Unit; game: Game }) {
  const u = () => props.unit
  const soldier = () => u().side === "squad"
  const flanked = () => {
    const g = props.game
    const enemies = g.units.filter((x) => alive(x) && foes(x, u()) && (x.side === "squad" || visibleToSquad(g, x)))
    return flankers(g, u(), enemies).length > 0
  }
  const w = () => WEAPONS[u().weapon]
  const stat = (label: string, value: string | number) => (
    <div class="stat">
      <span class="muted">{label}</span>
      <b>{value}</b>
    </div>
  )
  return (
    <section class="card unit">
      <div class="head">
        <img class="portrait" classList={{ foe: !soldier() }} src={icon(u().kind)} alt="" />
        <div class="who">
          <div class="name">{soldier() ? u().name : t(`kind.${u().kind}`)}</div>
          <div class="muted">{soldier() ? t(`kind.${u().kind}`) : t(`alert.${u().alert}`)}</div>
        </div>
        <Show when={soldier()} fallback={<span class={`chip alert ${u().alert}`}>{t(`alert.${u().alert}`)}</span>}>
          <span class="chip" classList={{ hidden: u().concealed }}>
            {u().concealed ? t("ui.concealed") : t("ui.revealed")}
          </span>
        </Show>
      </div>
      <Hp unit={u()} />
      <Show when={soldier()}>
        <div class="ap">
          <span class="muted">{t("ui.ap")}</span>
          <Index each={[0, 1]}>{(_, i) => <span class="pip" classList={{ full: i < u().ap }} />}</Index>
        </div>
      </Show>
      <div class="weapon">
        <b>{t(`weapon.${u().weapon}`)}</b>
        <span class="muted">
          {" "}
          {w().dice.count}d{w().dice.sides}
          {w().dice.bonus ? `+${w().dice.bonus}` : ""} · {w().melee ? t("ui.melee") : `${w().min}–${w().max}`}
        </span>
        <Show when={w().ammo !== null}>
          <span class="ammo">
            <Index each={Array.from({ length: w().ammo ?? 0 })}>
              {(_, i) => <span classList={{ full: i < u().ammo }} />}
            </Index>
          </span>
        </Show>
      </div>
      <div class="stats">
        {stat(t("ui.aim"), signed(u().aim))}
        {stat(t("ui.defense"), u().defense)}
        {stat(t("ui.armor"), u().armor)}
        {stat(t("ui.mobility"), u().mobility)}
        {stat(t("ui.vision"), u().vision)}
        {stat(t("ui.will"), signed(u().will))}
      </div>
      <Show
        when={
          u().statuses.length > 0 || u().stance !== "none" || flanked() || u().intent || (soldier() && u().ap === 0)
        }
      >
        <div class="chips">
          <Show when={flanked()}>
            <span class="chip danger">{t("ui.flanked")}</span>
          </Show>
          <Show when={soldier() && u().ap === 0}>
            <span class="chip spent">{t("ui.noAp")}</span>
          </Show>
          <Show when={u().intent}>
            <span class="chip danger">{t("ui.telegraph")}</span>
          </Show>
          <For each={u().statuses}>
            {(s) => (
              <span class={`chip status ${s.id}`}>
                {t(`status.${s.id}`)} {s.rounds < 99 ? s.rounds : ""}
              </span>
            )}
          </For>
          <Show when={u().stance !== "none"}>
            <span class="chip">{t(`action.${u().stance}`)}</span>
          </Show>
        </div>
      </Show>
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

/** The 20 faces of the d20: red misses, green hits, gold 20 is a critical. */
function Strip(props: { need: number }) {
  return (
    <div class="strip">
      <Index each={Array.from({ length: 20 }, (_, i) => i + 1)}>
        {(face) => (
          <span
            classList={{ crit: face() === 20, hit: face() >= props.need && face() < 20, miss: face() < props.need }}
          >
            {face()}
          </span>
        )}
      </Index>
    </div>
  )
}

function Edge(props: { edge: number; advantages: string[]; disadvantages: string[]; before: number; after: number }) {
  const why = (list: string[]) => list.map((r) => t(`reason.${r}`)).join(", ")
  const pct = { before: Math.round(props.before * 100), after: Math.round(props.after * 100) }
  return (
    <div classList={{ good: props.edge > 0, bad: props.edge < 0, muted: props.edge === 0 }}>
      {props.edge > 0
        ? t("ui.edge.advantage", { why: why(props.advantages), ...pct })
        : props.edge < 0
          ? t("ui.edge.disadvantage", { why: why(props.disadvantages), ...pct })
          : props.advantages.length || props.disadvantages.length
            ? t("ui.edge.cancel", { good: why(props.advantages), bad: why(props.disadvantages) })
            : t("ui.edge.none")}
    </div>
  )
}

/** How the chance of the armed action is built, step by step. */
function Preview(props: { model: Model }) {
  const m = props.model
  const data = () => {
    const u = m.unit()
    const a = m.armed()
    return u && a ? forecast(m.game(), u, a, m.hover()) : null
  }
  return (
    <Show when={data()}>
      {(d) => (
        <section class="card preview">
          <div class="name">
            {d().label} → {name(m.game(), d().target.id)}
          </div>
          <Show when={d().kind === "attack" && (d() as Extract<Forecast, { kind: "attack" }>)}>
            {(a) => (
              <>
                <div class="big">
                  {t("ui.need", { need: a().odds.need })}{" "}
                  <span class="pct">· {Math.round(a().odds.chance * 100)}%</span>
                </div>
                <Strip need={a().odds.need} />
                <div>
                  {t("ui.yourAim")}: {signed(a().odds.aim)}
                  <Parts parts={a().odds.aimParts} />
                </div>
                <div>
                  {t("ui.theirDefense")}: {a().odds.defense}
                  <Parts parts={a().odds.defenseParts} />
                </div>
                <Edge
                  edge={a().odds.edge}
                  advantages={a().odds.advantages}
                  disadvantages={a().odds.disadvantages}
                  before={chance(a().odds.aim, a().odds.defense, 0)}
                  after={a().odds.chance}
                />
                <div>
                  {t("ui.damage")}: {a().odds.min}–{a().odds.max}
                  <Show when={a().odds.armor}>
                    <span class="muted"> ({t("ui.armorCut", { armor: a().odds.armor })})</span>
                  </Show>
                </div>
                <div class="muted small">{t("ui.naturals")}</div>
              </>
            )}
          </Show>
          <Show when={d().kind === "save" && (d() as Extract<Forecast, { kind: "save" }>)}>
            {(s) => (
              <>
                <div class="big">
                  {t("ui.works")}: {Math.round(s().chance * 100)}%
                </div>
                <div>{t("ui.saveRule", { will: signed(s().will), dc: s().dc })}</div>
                <Show when={s().edge > 0}>
                  <div class="bad">{t("ui.saveHunker")}</div>
                </Show>
              </>
            )}
          </Show>
        </section>
      )}
    </Show>
  )
}

function Enemy(props: { model: Model }) {
  const m = props.model
  const foe = () => {
    const h = m.hover()
    return h ? m.foeAt(h) : undefined
  }
  return <Show when={foe()}>{(e) => <Card unit={e()} game={m.game()} />}</Show>
}

function Panel(props: { model: Model }) {
  const m = props.model
  const g = () => m.game()
  const canUndo = () => {
    m.game()
    return m.session.canUndo()
  }
  const events = () => {
    m.game()
    return m.session.events.length
  }
  return (
    <aside id="panel">
      <header>
        <h1>{t("ui.title")}</h1>
        <div class="row">
          <For each={["en", "ru"] as const}>
            {(l) => (
              <button type="button" classList={{ active: m.lang() === l }} onClick={() => m.setLanguage(l)}>
                {l.toUpperCase()}
              </button>
            )}
          </For>
        </div>
      </header>
      <div class={`phase ${m.shown().phase}`}>
        {t("ui.round", { round: m.shown().round })} · {t(`ui.phase.${m.shown().phase}`)}
      </div>
      <div class="muted small">{t("ui.seed", { seed: g().seed })}</div>
      <Show when={m.unit()} fallback={<p class="muted">{t("ui.pick")}</p>}>
        {(u) => <Card unit={u()} game={m.game()} />}
      </Show>
      <Preview model={m} />
      <Enemy model={m} />
      <div class="row wrap">
        <button type="button" disabled={!canUndo()} onClick={() => m.undo()}>
          {t("ui.undo")}
        </button>
        <button type="button" classList={{ active: m.zones() }} onClick={() => m.setZones(!m.zones())}>
          {t("ui.zones")}
        </button>
        <button type="button" onClick={() => m.newMission()}>
          {m.confirmNew() ? t("ui.confirm") : t("ui.newMission")}
        </button>
      </div>
      <Log game={m.shown()} />
      <p class="muted small">{t("ui.save", { count: events(), key: `${m.session.author.slice(0, 12)}…` })}</p>
      <p class="muted small">{t("ui.credits")}</p>
    </aside>
  )
}

function Bar(props: { model: Model }) {
  const m = props.model
  const list = () => {
    const u = m.unit()
    return u ? slots(m.game(), u) : []
  }
  return (
    <nav id="bar">
      <div class="slots">
        <Index each={list()}>
          {(s) => (
            <button
              type="button"
              class="slot"
              aria-label={s().label}
              classList={{ active: m.armed()?.slot === s().id }}
              disabled={s().disabled}
              onClick={() => m.press(s())}
              onMouseEnter={() => m.setHint(s())}
              onMouseLeave={() => m.setHint(null)}
            >
              <span class="key">{s().key}</span>
              <Show when={s().badge}>
                <span class="badge">{s().badge}</span>
              </Show>
              <img
                class="glyph"
                src={`${import.meta.env.BASE_URL}icons/actions/${s().id.replace(":", "-")}.svg`}
                alt={s().label}
              />
            </button>
          )}
        </Index>
      </div>
      <div class="side">
        <button
          type="button"
          class="end"
          disabled={m.game().phase !== "squad"}
          onClick={() => m.act({ type: "endTurn" })}
        >
          {t("ui.endTurn")} <span class="muted small">Enter</span>
        </button>
        <div class="speeds">
          <span class="muted small">{t("ui.speed")}</span>
          <For each={SPEEDS}>
            {(sp) => (
              <button type="button" classList={{ active: m.speed() === sp }} onClick={() => m.setSpeed(sp)}>
                {sp === 0 ? t("ui.instant") : `${sp}×`}
              </button>
            )}
          </For>
        </div>
      </div>
    </nav>
  )
}

/** The description of the hovered action, else of the armed one, else the message or the help. */
function Tip(props: { model: Model }) {
  const m = props.model
  const shown = () => {
    const h = m.hint()
    if (h) return h
    const a = m.armed()
    const u = m.unit()
    return a && u ? slots(m.game(), u).find((s) => s.id === a.slot) : undefined
  }
  return (
    <div id="tip">
      <Show when={shown()}>
        {(s) => (
          <>
            <div class="name">
              {s().label} <span class="muted small">{t("ui.key", { key: s().key })}</span>
            </div>
            <div>{s().info}</div>
          </>
        )}
      </Show>
      <Show when={!m.hint()}>
        <div classList={{ message: !!m.message(), muted: !m.message() }}>
          {m.message() || (shown() ? "" : t("ui.help"))}
        </div>
      </Show>
    </div>
  )
}

/** The whole screen; it renders again from scratch when the language changes. */
export function App(props: { model: Model }): JSX.Element {
  const m = props.model
  onMount(() => window.addEventListener("keydown", m.key))
  onCleanup(() => window.removeEventListener("keydown", m.key))
  return (
    <Show when={m.lang()} keyed>
      <main>
        <section id="stage">
          <Board model={m} />
          <Tip model={m} />
          <Bar model={m} />
        </section>
        <Panel model={m} />
      </main>
    </Show>
  )
}
