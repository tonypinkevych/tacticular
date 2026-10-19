import { createSignal, For, Show } from "solid-js"
import { type Op, SCOUT_COST, SQUAD } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

/**
 * The orders for a posted operation: its difficulty and what leaving it costs, the squad, scouting and Launch. Only
 * one operation launches each week.
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
  const ok = () => squad().length >= c().fewest() && squad().length <= SQUAD && !c().launched
  const toggle = (id: string) =>
    setSquad((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < SQUAD ? [...d, id] : d))
  return (
    <div class="orders">
      <p class="small">
        {t("world.difficulty", { level: t(`difficulty.${op().difficulty}`), pods: 1 + op().difficulty })} ·{" "}
        {t(`penalty.${op().penalty ?? "none"}`)}
      </p>
      <div class="row">
        <h3>{t("world.squad", { fewest: c().fewest() })}</h3>
        <button type="button" disabled={squad().length === 0} onClick={() => setSquad([])}>
          {t("world.deselect")}
        </button>
      </div>
      <div class="squad">
        <For each={ready()}>
          {(s) => <Soldier soldier={s} on={squad().includes(s.id)} onClick={() => toggle(s.id)} />}
        </For>
      </div>
      <Show when={c().launched}>
        <p class="small muted">{t("world.launched")}</p>
      </Show>
      <div class="row">
        <button
          type="button"
          disabled={op().scouted || c().intel < SCOUT_COST || c().launched}
          onClick={() => x.choose({ type: "scout", op: op().id })}
        >
          {op().scouted ? t("world.scouted") : t("world.scout", { cost: SCOUT_COST })}
        </button>
        <button
          type="button"
          class="primary"
          disabled={!ok()}
          onClick={() => {
            x.choose({ type: "launch", op: op().id, squad: squad() })
            props.onDone()
          }}
        >
          {t("world.launch")}
        </button>
      </div>
    </div>
  )
}
