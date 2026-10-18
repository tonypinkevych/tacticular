import { For, type JSX, onCleanup, onMount, Show } from "solid-js"
import { t } from "../../i18n/strings"
import type { Game } from "../../mission/game"
import { Board } from "../board/board"
import type { Model } from "../model"
import { SPEEDS } from "../playback/motion"
import { Card } from "./card"
import { Dock } from "./dock"
import { Log } from "./log"
import { Target } from "./odds"

/** The mission goal in a few words, with the rounds left to hold a beacon and the step an objective is at. */
function goal(g: Game): string {
  const goal = g.goal
  if (goal.kind === "defend") return t("ui.goal.defend", { left: goal.rounds - g.round + 1 })
  if (goal.kind === "intel" && goal.taken) return t("ui.goal.intelTaken")
  if (goal.kind === "relay" && goal.planted !== null) return t("ui.goal.relayPlanted")
  return t(`ui.goal.${goal.kind}`)
}

/** Round and phase, the log toggle and a menu with everything that is not an action. */
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
      <span class="alarm" classList={{ coming: !!m.shown().reinforcements.coming() }}>
        {t("ui.alarm", { alarm: m.shown().alarm, next: m.shown().reinforcements.next() ?? "—" })}
      </span>
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

/** The end of a mission in a run, once its last step has played: won or failed, and Continue. */
function Ending(props: { model: Model }) {
  const m = props.model
  const phase = () => m.shown().phase
  return (
    <Show when={m.expedition && (phase() === "won" || phase() === "lost")}>
      <div id="ending" class="card">
        <h2>{phase() === "won" ? t("run.missionWon") : t("run.missionLost")}</h2>
        <button type="button" class="primary" onClick={() => m.expedition?.finish()}>
          {t("run.continue")}
        </button>
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
        <Dock model={m} />
        <Show when={m.logOpen()}>
          <Panel model={m} />
        </Show>
        <Ending model={m} />
      </main>
    </Show>
  )
}
