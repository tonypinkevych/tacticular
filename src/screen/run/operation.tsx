import { createSignal, For, Show } from "solid-js"
import { type Op, SCOUT_COST, SQUAD } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

/**
 * The orders for an operation. An open one takes a squad, the infiltration it gets after a week, and scouting. A sent
 * one shows its infiltration now and next week, with Launch once it is ready and Call back.
 */
export function Operation(props: { expedition: Expedition; op: Op; onDone: () => void }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const op = () => c().ops.find((o) => o.id === props.op.id) ?? props.op
  const ready = () => [...c().ready()].sort((a, b) => b.hp - a.hp)
  const [squad, setSquad] = createSignal<string[]>(
    ready()
      .slice(0, SQUAD)
      .map((s) => s.id),
  )
  const score = () => c().infiltration(squad().length, 1)
  const ok = () => squad().length >= c().fewest() && squad().length <= SQUAD
  const toggle = (id: string) =>
    setSquad((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < SQUAD ? [...d, id] : d))
  const say = (score: number) => t("world.infiltration", { score, effect: t(`infiltration.${score}`) })
  return (
    <Show
      when={op().sent === null}
      fallback={
        <div class="card orders">
          <p class="small">
            {c().launchable(op()) ? t("world.ready") : t("world.notReady", { week: op().sent! })} ·{" "}
            {say(c().score(op()))}
          </p>
          <Show when={c().score(op()) < 5 && c().week < op().expires}>
            <p class="small muted">{t("world.next", { score: c().score(op()) + 1 })}</p>
          </Show>
          <Show when={c().due() === op()}>
            <p class="small">{t("world.due")}</p>
          </Show>
          <div class="row">
            <button type="button" onClick={() => x.choose({ type: "cancel", op: op().id })}>
              {t("world.cancel")}
            </button>
            <button
              type="button"
              class="primary"
              disabled={!c().launchable(op())}
              onClick={() => x.choose({ type: "launch", op: op().id })}
            >
              {t("world.launch")}
            </button>
          </div>
        </div>
      }
    >
      <div class="card orders">
        <h3>{t("world.squad", { fewest: c().fewest() })}</h3>
        <div class="soldiers narrow">
          <For each={ready()}>
            {(s) => <Soldier soldier={s} on={squad().includes(s.id)} onClick={() => toggle(s.id)} />}
          </For>
        </div>
        <p class="small">{say(score())}</p>
        <p class="small muted">{t("world.tiers")}</p>
        <div class="row">
          <button
            type="button"
            disabled={op().scouted || c().intel < SCOUT_COST}
            onClick={() => x.choose({ type: "scout", op: op().id })}
          >
            {op().scouted ? t("world.scouted") : t("world.scout", { cost: SCOUT_COST })}
          </button>
          <button
            type="button"
            class="primary"
            disabled={!ok() || c().week >= op().expires}
            onClick={() => {
              x.choose({ type: "send", op: op().id, squad: squad() })
              props.onDone()
            }}
          >
            {t("world.send")}
          </button>
        </div>
      </div>
    </Show>
  )
}
