import { createSignal, For, Show } from "solid-js"
import { EVERY } from "../../aliens/reinforcements"
import { t } from "../../i18n/strings"
import type { Battle } from "../battle"
import { Board } from "../board/board"
import { Card } from "./card"

/** The battle screen: the board in the middle, the squad left, the target and aliens right, actions below. */
export function Hud(props: { battle: Battle; onNext: () => void }) {
  const b = props.battle
  const [muted, setMuted] = createSignal(b.sound.muted)
  const g = () => b.game()
  const goal = () => {
    const x = g().goal
    if (x.kind === "evac") return t("ui.goal.evac")
    if (x.kind === "defend") return t("ui.goal.defend", { left: Math.max(0, x.rounds - g().round + 1) })
    return t("ui.goal.kill")
  }
  const drop = () => {
    if (g().landing.length) return t("ui.dropNow")
    if (g().drops <= 0) return t("ui.dropNone")
    return t("ui.drop", { rounds: EVERY - (g().round % EVERY) })
  }
  const skill = () => {
    const u = b.unit()
    return u ? t(`skill.${u.profile.skill}`) : "—"
  }
  const log = () => g().log.slice(-8).reverse()
  const name = (id: unknown) => {
    const u = g().units.find((x) => x.id === id)
    return u ? t(`kind.${u.kind}`) : String(id ?? "")
  }
  return (
    <div class="battle">
      <header class="top">
        <b>TACTICULAR</b>
        <span>{t("ui.round", { round: g().round })}</span>
        <span>{goal()}</span>
        <span class="warn">{drop()}</span>
        <span class="grow" />
        <span>{t(`ui.phase.${g().phase}`)}</span>
        <button type="button" class="mute" onClick={() => setMuted(b.sound.toggle())}>
          {t(muted() ? "ui.soundOff" : "ui.soundOn")}
        </button>
      </header>
      <aside class="left">
        <h2>{t("ui.squad")}</h2>
        <For each={g().units.filter((u) => u.side === "squad")}>
          {(u) => <Card unit={u} selected={b.selected() === u.id} onPick={() => b.pick(u.id)} />}
        </For>
      </aside>
      <main class="stage">
        <Board battle={b} />
        <Show when={b.banner()}>
          <div class="banner">{t("ui.phase.enemy")}</div>
        </Show>
        <Show when={b.notice()}>{(n) => <div class="notice">{t(`illegal.${n()}`)}</div>}</Show>
        <Show when={g().phase === "won" || g().phase === "lost"}>
          <div class="end">
            <h1>{t(`ui.phase.${g().phase}`)}</h1>
            <button type="button" onClick={() => props.onNext()}>
              {t("ui.continue")}
            </button>
          </div>
        </Show>
      </main>
      <aside class="right">
        <h2>{t("ui.target")}</h2>
        <div class="odds">
          <Show when={b.odds()} fallback={<span class="muted">{t("ui.pickTarget")}</span>}>
            {(o) => (
              <>
                <div class="row">
                  <span>{t(`kind.${o().target.kind}`)}</span>
                  <span>
                    {t("ui.hp")} {o().target.hp}/{o().target.profile.hp}
                  </span>
                </div>
                <div class="big">{o().odds.chance}%</div>
                <div class="row">
                  <span>{t("ui.cover")}</span>
                  <span>−{o().odds.cover}</span>
                </div>
                <div class="row">
                  <span>{t("ui.damage")}</span>
                  <span>{o().odds.damage}</span>
                </div>
                <div class="row">
                  <span>{t("ui.crit")}</span>
                  <span>{o().odds.crit}%</span>
                </div>
              </>
            )}
          </Show>
        </div>
        <h2>{t("ui.aliens")}</h2>
        <For each={g().units.filter((u) => u.side === "enemy" && u.alive())}>{(u) => <Card unit={u} />}</For>
        <h2>{t("ui.log")}</h2>
        <ol class="log">
          <For each={log()}>
            {(e) => <li>{t(e.key, { ...e.params, unit: name(e.params.unit), target: name(e.params.target) })}</li>}
          </For>
        </ol>
      </aside>
      <footer class="bar">
        <button type="button" classList={{ on: b.armed() }} onClick={() => b.toggleSkill()}>
          <kbd>3</kbd> {skill()}
        </button>
        <button type="button" onClick={() => b.overwatch()}>
          <kbd>4</kbd> {t("ui.overwatch")}
        </button>
        <span class="hint">{t("ui.hint")}</span>
        <button type="button" class="end-turn" onClick={() => void b.endTurn()}>
          <svg viewBox="0 0 24 32" aria-hidden="true">
            <path d="M3 2h18M3 30h18M5 2c0 9 14 9 14 14S5 21 5 30M19 2c0 9-14 9-14 14s14 5 14 14" />
            <path class="sand" d="M8 7h8l-4 5zM7 28c1-4 9-4 10 0z" />
          </svg>
          <span>{t("ui.endTurn")}</span>
          <kbd>⏎</kbd>
        </button>
      </footer>
    </div>
  )
}
