import { createSignal, For, type JSX, Show } from "solid-js"
import { READY } from "../../combat/ultimates"
import { t } from "../../i18n/strings"
import type { Unit } from "../../units/unit"
import type { Battle, Mode } from "../battle"
import { Board } from "../board/board"
import { Combos } from "../combos"
import { help } from "../help"
import { Restart } from "../run/restart"
import { charge } from "./card"
import { Portrait } from "./portrait"

/**
 * The battle screen: the board fills it, with floating cards on top. The objective sits top left, the turn
 * top centre, the alien plans top right, the selected soldier and the squad bottom left, the actions bottom
 * centre and End turn bottom right.
 */
export function Hud(props: { battle: Battle; onNext: () => void; onRestart: () => void }) {
  const b = props.battle
  const [muted, setMuted] = createSignal(b.sound.muted)
  const [log, setLog] = createSignal(false)
  const [tipped, setTipped] = createSignal<Mode | null>(null)
  const [peeked, setPeeked] = createSignal<Unit | null>(null)
  const g = () => b.game()
  const goal = () => {
    const x = g().goal
    if (x.kind === "evac") return t("ui.goal.evac")
    if (x.kind === "defend") return t("ui.goal.defend", { left: Math.max(0, x.rounds - g().round + 1) })
    return t("ui.goal.kill")
  }
  const drop = () => {
    if (g().landing.length) return t("ui.dropNow")
    if (!g().reinforcements.left()) return null
    const every = g().reinforcements.every()
    return t("ui.drop", { rounds: every - (g().round % every) })
  }
  const busy = () => b.banner() || g().phase === "enemy"
  const squad = () => g().units.filter((u) => u.side === "squad" && u.alive())
  const aliens = () => g().units.filter((u) => u.side === "enemy" && u.alive())
  const name = (id: unknown) => {
    const u = g().units.find((x) => x.id === id)
    return u ? t(`kind.${u.kind}`) : String(id ?? "")
  }
  const odds = (id: string) => {
    const m = g().marks.find((x) => x.unit === id && x.target)
    return m ? b.toll(m) : null
  }
  const aimedAt = (u: Unit) => g().marks.filter((m) => m.target === u.id).length
  const hint = () => {
    const o = b.hit()
    if (!o) return t("ui.hint")
    const damage = o.hit.damage >= o.target.hp ? t("ui.kill") : `−${o.hit.damage}`
    return t("ui.hintAim", { target: t(`kind.${o.target.kind}`), damage })
  }
  const action = (mode: Mode, key: string, label: string, icon: JSX.Element, sub?: string, off?: boolean) => (
    <button
      type="button"
      class="ability"
      classList={{ on: b.mode() === mode }}
      disabled={off}
      onClick={() => b.choose(mode)}
      onMouseEnter={() => setTipped(mode)}
      onMouseLeave={() => setTipped(null)}
    >
      <span class="ring">
        {icon}
        <kbd>{key}</kbd>
      </span>
      <b>{label}</b>
      <small>{sub ?? " "}</small>
    </button>
  )
  return (
    <div class="field">
      <main class="stage">
        <Board battle={b} />
      </main>

      <div class="left">
        <section class="float objective">
          <header>
            <Icon d="M5 21V4h11l-2 4 2 4H5" />
            <b>{t(`ui.task.${g().goal.kind}`)}</b>
            <span class="grow" />
            <span class="muted">{t("ui.round", { round: g().round })}</span>
            <button
              type="button"
              class="icon"
              aria-label={t(muted() ? "ui.soundOff" : "ui.soundOn")}
              onClick={() => setMuted(b.sound.toggle())}
            >
              <Icon
                d={muted() ? "M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6" : "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 010 6"}
              />
            </button>
          </header>
          <span>{goal()}</span>
          <button type="button" class="link" onClick={() => setLog((v) => !v)}>
            {t("ui.log")} {log() ? "▴" : "▾"}
          </button>
          <Show when={log()}>
            <ol class="log">
              <For each={g().log.slice(-8).reverse()}>
                {(e) => <li>{t(e.key, { ...e.params, unit: name(e.params.unit), target: name(e.params.target) })}</li>}
              </For>
            </ol>
          </Show>
        </section>

        <section class="float soldier">
          <header>
            <span>{t("ui.squad")}</span>
            <b>{squad().length}</b>
          </header>
          <For each={squad()}>
            {(u) => (
              <button
                type="button"
                class="sheet"
                classList={{ on: b.selected() === u.id, spent: u.ap === 0 }}
                onClick={() => b.pick(u.id)}
                onMouseEnter={() => setPeeked(u)}
                onMouseLeave={() => setPeeked(null)}
              >
                <Portrait kind={u.kind} />
                <div class="title">
                  <b>{t(`kind.${u.kind}`)}</b>
                  <span class="ap">
                    <For each={[0, 1]}>{(i) => <i classList={{ off: i >= u.ap }} />}</For>
                  </span>
                </div>
                <Pips unit={u} />
                <div class="tags">
                  <Show when={u.hunkered}>
                    <span class="status hunkered">{t("ui.hunker")}</span>
                  </Show>
                  <Show when={u.overwatch}>
                    <span class="status watching">{t("ui.overwatch")}</span>
                  </Show>
                  <Show when={aimedAt(u)}>{(n) => <span class="threat">{t("ui.aimedAt", { count: n() })}</span>}</Show>
                  <Show when={new Combos(g()).primed(u)}>
                    <span class="status combo">{t("ui.comboReady")}</span>
                  </Show>
                  <Show when={u.charge >= READY}>
                    <span class="status ult">{t("ui.ultimate")}</span>
                  </Show>
                  <Show when={b.selected() === u.id && u.profile.combo}>
                    {(c) => <span class="muted">{t("ui.gains", { status: t(`status.${c()}`) })}</span>}
                  </Show>
                </div>
              </button>
            )}
          </For>
        </section>
      </div>

      <div class="ribbon" classList={{ alien: busy() }}>
        <b>{busy() ? t("ui.alienActivity") : t(`ui.phase.${g().phase}`)}</b>
        <Show when={drop()}>{(d) => <span class="drop">{d()}</span>}</Show>
      </div>

      <section class="float incoming">
        <header>
          <span>{t("ui.incoming")}</span>
          <b>{g().marks.length}</b>
        </header>
        <For each={aliens()}>
          {(u) => (
            <button
              type="button"
              class="plan"
              classList={{ armed: !!b.intent(u.id) }}
              onMouseEnter={() => b.point(u.at)}
              onMouseLeave={() => b.point(null)}
              onClick={() => b.click(u.at)}
            >
              <Portrait kind={u.kind} face={-1} />
              <span class="who">
                <b>{t(`kind.${u.kind}`)}</b>
                <Pips unit={u} />
                <small>{b.intent(u.id) ?? (u.status ? t(`status.${u.status}`) : "—")}</small>
              </span>
              <b class="odds">{odds(u.id) ?? ""}</b>
            </button>
          )}
        </For>
      </section>

      <section class="abilities">
        <Show
          when={
            tipped() ? b.help(tipped() as Mode) : peeked() ? help(peeked() as Unit, "move", squad()) : b.help(b.mode())
          }
        >
          {(h) => (
            <div class="float tip">
              <b>{h().name}</b>
              <p>{h().about}</p>
              <small>{h().how}</small>
            </div>
          )}
        </Show>
        <div class="row">
          {action(
            "shoot",
            "1",
            t("ui.shoot"),
            <Icon d="M12 4a8 8 0 100 16 8 8 0 000-16zM12 2v5M12 17v5M2 12h5M17 12h5" />,
          )}
          {action(
            "skill",
            "2",
            b.unit() ? t(`skill.${b.unit()?.profile.skill}`) : "—",
            <Icon d="M4 18l6-6 3 3 7-9M15 6h5v5" />,
            b.unit() ? charge(b.unit() as Unit) : undefined,
            !b.unit() || (b.unit()?.cooldown ?? 0) > 0 || b.unit()?.uses === 0,
          )}
          {action(
            "tactic",
            "3",
            b.unit()?.profile.tactic ? t(`tactic.${b.unit()?.profile.tactic}`) : "—",
            <Icon d="M5 12h9M10 7l5 5-5 5M18 5v14" />,
            t("ui.oneAp"),
            !b.unit()?.profile.tactic,
          )}
          {action(
            "overwatch",
            "4",
            t("ui.overwatch"),
            <Icon d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z" />,
            undefined,
            !b.unit() || b.unit()?.profile.melee || !b.unit()?.profile.range,
          )}
          {action("hunker", "5", t("ui.hunker"), <Icon d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />)}
          {action(
            "ultimate",
            "6",
            b.unit()?.profile.ultimate ? t(`ult.${b.unit()?.profile.ultimate}`) : "—",
            <Icon d="M13 2L4 14h7l-1 8 9-12h-7z" />,
            b.unit() ? t("ui.charge", { charge: b.unit()?.charge ?? 0 }) : undefined,
            !b.unit()?.profile.ultimate || (b.unit()?.charge ?? 0) < READY,
          )}
        </div>
        <span class="hint">{hint()}</span>
      </section>

      <Show when={b.notice()}>{(n) => <div class="notice">{t(`illegal.${n()}`)}</div>}</Show>

      <div class="corner">
        <Restart onRestart={props.onRestart} />
        <button
          type="button"
          class="end-turn"
          classList={{ wait: busy() }}
          disabled={busy()}
          onClick={() => void b.endTurn()}
        >
          <svg viewBox="0 0 24 32" aria-hidden="true">
            <path d="M3 2h18M3 30h18M5 2c0 9 14 9 14 14S5 21 5 30M19 2c0 9-14 9-14 14s14 5 14 14" />
            <path class="sand" d="M8 7h8l-4 5zM7 28c1-4 9-4 10 0z" />
          </svg>
          <span>{busy() ? t("ui.phase.enemy") : t("ui.endTurn")}</span>
          <Show when={!busy()}>
            <kbd>⌫</kbd>
          </Show>
        </button>
      </div>

      <Show when={g().phase === "won" || g().phase === "lost"}>
        <div class="end">
          <div class="float">
            <h1>{t(`ui.phase.${g().phase}`)}</h1>
            <Show when={b.loss()}>{(r) => <p>{t(`ui.lost.${r()}`)}</p>}</Show>
            <button type="button" class="go" onClick={() => props.onNext()}>
              {t("ui.continue")}
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}

/** A unit's HP as pips, red for soldiers and teal for aliens. */
function Pips(props: { unit: Unit }) {
  return (
    <span class="pips" classList={{ alien: props.unit.side === "enemy" }}>
      <For each={Array.from({ length: props.unit.profile.hp }, (_, i) => i)}>
        {(i) => <i classList={{ off: i >= props.unit.hp }} />}
      </For>
    </span>
  )
}

/** A stroke icon of one path. */
function Icon(props: { d: string }) {
  return (
    <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d={props.d} />
    </svg>
  )
}
