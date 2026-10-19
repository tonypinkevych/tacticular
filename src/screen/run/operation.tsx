import { createSignal, For, Show } from "solid-js"
import { INFILTRATION, type Op, SCOUT_COST } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

/**
 * The orders for an operation: its difficulty, infiltration and what leaving it costs, the squad, scouting and
 * Launch; for a launched one, its squad and the week it arrives, and Deploy once it has. Only one operation launches
 * each week.
 */
export function Operation(props: {
  expedition: Expedition
  op: Op
  onLaunch: (squad: string[]) => void
  onDone: () => void
}) {
  const x = props.expedition
  const c = () => x.campaign()!
  const op = () => c().ops.find((o) => o.id === props.op.id) ?? props.op
  const ready = () => [...c().ready()].sort((a, b) => b.hp - a.hp)
  const [squad, setSquad] = createSignal<string[]>(
    ready()
      .slice(0, c().most())
      .map((s) => s.id),
  )
  const ok = () => squad().length >= c().fewest() && squad().length <= c().most() && !c().launched
  const toggle = (id: string) =>
    setSquad((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < c().most() ? [...d, id] : d))
  const weeks = () => INFILTRATION[op().difficulty]
  return (
    <div class="orders">
      <p class="small">
        {t("world.difficulty", { level: t(`difficulty.${op().difficulty}`), pods: 1 + op().difficulty })} ·{" "}
        {t(`penalty.${op().penalty ?? "none"}`)}
      </p>
      <Show
        when={op().squad.length === 0}
        fallback={
          <>
            <div class="squad">
              <For each={c().roster.filter((s) => op().squad.includes(s.id))}>{(s) => <Soldier soldier={s} />}</For>
            </div>
            <div class="row">
              <p class="small">
                {c().due()?.id === op().id ? t("world.arrived") : t("world.infiltrating", { week: op().arrives ?? 0 })}
              </p>
              <span class="spacer" />
              <Show when={c().due()?.id === op().id}>
                <button
                  type="button"
                  class="primary"
                  onClick={() => {
                    props.onDone()
                    x.choose({ type: "deploy" })
                  }}
                >
                  {t("world.deploy")}
                </button>
              </Show>
            </div>
          </>
        }
      >
        <p class="small muted">{weeks() > 0 ? t("world.infiltration", { weeks: weeks() }) : t("world.direct")}</p>
        <div class="row">
          <h3>{t("world.squad", { fewest: c().fewest(), most: c().most() })}</h3>
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
            disabled={op().scouted || c().intel < SCOUT_COST}
            onClick={() => x.choose({ type: "scout", op: op().id })}
          >
            {op().scouted ? t("world.scouted") : t("world.scout", { cost: SCOUT_COST })}
          </button>
          <button
            type="button"
            class="primary"
            disabled={!ok()}
            onClick={() => {
              props.onDone()
              props.onLaunch(squad())
            }}
          >
            {t("world.launch")}
          </button>
        </div>
      </Show>
    </div>
  )
}
