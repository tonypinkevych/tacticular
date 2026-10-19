import { createSignal, For } from "solid-js"
import { type Op, SCOUT_COST, SQUAD } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

/** The orders for an open operation: the squad, the weeks of prep with the infiltration they give, and scouting. */
export function Operation(props: { expedition: Expedition; op: Op; onDone: () => void }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const ready = () => [...c().ready()].sort((a, b) => b.hp - a.hp)
  const [squad, setSquad] = createSignal<string[]>(
    ready()
      .slice(0, SQUAD)
      .map((s) => s.id),
  )
  const longest = () => Math.min(3, props.op.expires - c().week + 1)
  const [prep, setPrep] = createSignal(1)
  const score = () => c().infiltration(squad().length, prep())
  const ok = () => squad().length >= c().fewest() && squad().length <= SQUAD
  const toggle = (id: string) =>
    setSquad((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < SQUAD ? [...d, id] : d))
  const send = () => {
    x.choose({ type: "send", op: props.op.id, squad: squad(), prep: prep() })
    props.onDone()
  }
  return (
    <div class="card orders">
      <h3>{t("world.squad", { fewest: c().fewest() })}</h3>
      <div class="soldiers narrow">
        <For each={ready()}>
          {(s) => <Soldier soldier={s} on={squad().includes(s.id)} onClick={() => toggle(s.id)} />}
        </For>
      </div>
      <div class="row">
        <For each={[1, 2, 3].filter((w) => w <= longest())}>
          {(w) => (
            <button type="button" classList={{ on: prep() === w }} onClick={() => setPrep(w)}>
              {t("world.prep", { weeks: w })}
            </button>
          )}
        </For>
      </div>
      <p class="small">{t("world.infiltration", { score: score(), effect: t(`infiltration.${score()}`) })}</p>
      <div class="row">
        <button
          type="button"
          disabled={props.op.scouted || c().intel < SCOUT_COST}
          onClick={() => x.choose({ type: "scout", op: props.op.id })}
        >
          {props.op.scouted ? t("world.scouted") : t("world.scout", { cost: SCOUT_COST })}
        </button>
        <button type="button" class="primary" disabled={!ok()} onClick={send}>
          {t("world.send")}
        </button>
      </div>
    </div>
  )
}
