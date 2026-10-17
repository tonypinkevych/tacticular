import { For, Index, type JSX, onCleanup, onMount, Show } from "solid-js"
import { t } from "../i18n/strings"
import { odds } from "../rules/combat"
import { WEAPONS } from "../rules/data"
import type { Entry, Game, Unit, WeaponId } from "../rules/types"
import { sideOf } from "../rules/units"
import { Board } from "./board"
import { type Model, slots } from "./model"
import { SPEEDS } from "./motion"

const icon = (kind: string) => `${import.meta.env.BASE_URL}icons/${kind}.svg`

function name(game: Game, id: unknown): string {
  const u = game.units.find((x) => x.id === id)
  if (!u) return String(id ?? "")
  return u.side === "squad" ? `${u.name} (${t(`kind.${u.kind}`)})` : t(`kind.${u.kind}`)
}

function line(game: Game, e: Entry): string {
  const p: Record<string, string | number | boolean> = { ...e.params }
  for (const k of ["unit", "target", "by"]) if (k in p) p[k] = name(game, p[k])
  if (typeof p.weapon === "string") p.weapon = t(`weapon.${p.weapon}`)
  if ("saved" in p) p.result = t(p.saved ? "ui.saved" : "ui.failed")
  return t(e.key, p)
}

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

/** The selected soldier: who, how healthy, how many actions left, what it carries. */
function Card(props: { unit: Unit }) {
  const u = () => props.unit
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
        <img class="portrait" src={icon(u().kind)} alt="" />
        <div class="who">
          <div class="name">{u().name}</div>
          <div class="muted">{t(`kind.${u().kind}`)}</div>
        </div>
        <span class="chip" classList={{ hidden: u().concealed }}>
          {u().concealed ? t("ui.concealed") : t("ui.revealed")}
        </span>
      </div>
      <Hp unit={u()} />
      <div class="ap">
        <span class="muted">{t("ui.ap")}</span>
        <Index each={[0, 1]}>{(_, i) => <span class="pip" classList={{ full: i < u().ap }} />}</Index>
      </div>
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
        {stat(t("ui.aim"), `+${u().aim}`)}
        {stat(t("ui.defense"), u().defense)}
        {stat(t("ui.armor"), u().armor)}
        {stat(t("ui.mobility"), u().mobility)}
        {stat(t("ui.vision"), u().vision)}
        {stat(t("ui.will"), `+${u().will}`)}
      </div>
      <Show when={u().statuses.length > 0 || u().stance !== "none"}>
        <div class="chips">
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

function Preview(props: { model: Model }) {
  const m = props.model
  const data = () => {
    const u = m.unit()
    const a = m.armed()
    if (!u || !a?.target || !a.slot.startsWith("weapon:")) return null
    const target = m.game().units.find((x) => x.id === a.target)
    if (!target || sideOf(target) === "squad") return null
    const weapon = a.slot.slice(7) as WeaponId
    return { target, weapon, o: odds(m.game(), u, target, weapon) }
  }
  return (
    <Show when={data()}>
      {(d) => (
        <section class="card preview">
          <div class="name">
            {t(`weapon.${d().weapon}`)} → {name(m.game(), d().target.id)}
          </div>
          <div class="big">
            {t("ui.chance")}: {Math.round(d().o.chance * 100)}%
          </div>
          <div>
            {t("ui.damage")}: {d().o.min}–{d().o.max}
          </div>
          <div class="muted">
            d20 +{d().o.aim} vs {d().o.defense}
          </div>
          <Show when={d().o.advantages.length}>
            <div class="good">
              {t("ui.advantage")}:{" "}
              {d()
                .o.advantages.map((r) => t(`reason.${r}`))
                .join(", ")}
            </div>
          </Show>
          <Show when={d().o.disadvantages.length}>
            <div class="bad">
              {t("ui.disadvantage")}:{" "}
              {d()
                .o.disadvantages.map((r) => t(`reason.${r}`))
                .join(", ")}
            </div>
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
  return (
    <Show when={foe()}>
      {(e) => (
        <section class="card enemy">
          <div class="head">
            <img class="portrait foe" src={icon(e().kind)} alt="" />
            <div class="who">
              <div class="name">{name(m.game(), e().id)}</div>
              <div class="muted">{t(`alert.${e().alert}`)}</div>
            </div>
          </div>
          <Hp unit={e()} />
        </section>
      )}
    </Show>
  )
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
        {(u) => <Card unit={u()} />}
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
      <h2>{t("ui.log")}</h2>
      <ol class="log">
        <For each={m.shown().log.slice(-60).reverse()}>
          {(e) => <li class={e.key.replace(".", "-")}>{line(m.shown(), e)}</li>}
        </For>
      </ol>
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
              <span class="label" lang={m.lang()}>
                {s().label}
              </span>
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

function Tip(props: { model: Model }) {
  const m = props.model
  return (
    <div id="tip">
      <Show
        when={m.hint()}
        fallback={<div classList={{ message: !!m.message(), muted: !m.message() }}>{m.message() || t("ui.help")}</div>}
      >
        {(s) => (
          <>
            <div class="name">
              {s().label} <span class="muted small">{t("ui.key", { key: s().key })}</span>
            </div>
            <div>{s().info}</div>
          </>
        )}
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
