import { createSignal, For, Show } from "solid-js"
import { t } from "../../i18n/strings"
import type { Prize as PrizeKind } from "../../run/chart"
import type { Run } from "../../run/run"
import { Unit } from "../../units/unit"
import { Card } from "../hud/card"

const W = 640,
  H = 300

/** The chart of the act: the missions in layers, the ones the squad can go to, and the soldiers to send. */
export function ChartView(props: { run: Run; onGo: (node: number, deploy: string[]) => void }) {
  const run = props.run
  const [node, setNode] = createSignal<number | null>(null)
  const [deploy, setDeploy] = createSignal(run.roster.slice(0, 3).map((s) => s.id))
  const where = (id: number) => {
    const n = run.chart.node(id),
      row = run.chart.layer(n.layer),
      i = row.indexOf(n)
    return [40 + (n.layer * (W - 80)) / 4, ((i + 1) * H) / (row.length + 1)]
  }
  const brief = () => {
    const id = node()
    if (id === null) return null
    const n = run.chart.node(id)
    return { ...run.preview(id), kind: n.kind, prize: n.prize }
  }
  const open = (id: number) => run.options().some((n) => n.id === id)
  const toggle = (id: string) =>
    setDeploy((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < 3 ? [...d, id] : d))
  return (
    <section class="screen">
      <h1>{t("ui.run.chart")}</h1>
      <p class="muted">{t("ui.run.threat", { threat: run.threat })}</p>
      <div class="chart" style={{ width: `${W}px`, height: `${H}px` }}>
        <svg width={W} height={H} aria-hidden="true">
          <For each={run.chart.nodes}>
            {(n) => (
              <For each={n.next}>
                {(m) => <line x1={where(n.id)[0]} y1={where(n.id)[1]} x2={where(m)[0]} y2={where(m)[1]} />}
              </For>
            )}
          </For>
        </svg>
        <For each={run.chart.nodes}>
          {(n) => (
            <button
              type="button"
              class={`node ${n.kind}`}
              classList={{ open: open(n.id), on: node() === n.id, here: run.at === n.id }}
              style={{ left: `${where(n.id)[0]}px`, top: `${where(n.id)[1]}px` }}
              disabled={!open(n.id)}
              onClick={() => setNode(n.id)}
            >
              <Show when={n.prize}>{(p) => <Prize kind={p()} />}</Show>
              {t(`ui.task.${n.kind}`)}
            </button>
          )}
        </For>
      </div>
      <div class="brief">
        <Show when={brief()} fallback={<span class="muted">{t("ui.brief.pick")}</span>}>
          {(b) => (
            <>
              <h2>{t(`ui.task.${b().kind}`)}</h2>
              <p>{t(`ui.brief.${b().kind}`)}</p>
              <p>
                <b>{t(`ui.goal.${b().goal}`, { left: 5 })}</b>
              </p>
              <p>{t("ui.brief.aliens", { count: b().aliens })}</p>
              <Show when={b().prize}>
                {(p) => (
                  <p>
                    <Prize kind={p()} /> {t("ui.brief.prize", { prize: t(`ui.prize.${p()}`) })}
                  </p>
                )}
              </Show>
            </>
          )}
        </Show>
      </div>
      <h2>{t("ui.run.deploy")}</h2>
      <div class="roster">
        <For each={run.roster}>
          {(s) => <Card unit={unitOf(s)} selected={deploy().includes(s.id)} onPick={() => toggle(s.id)} />}
        </For>
      </div>
      <button
        type="button"
        class="go"
        disabled={node() === null || !deploy().length}
        onClick={() => props.onGo(node() as number, deploy())}
      >
        {t("ui.run.go")}
      </button>
    </section>
  )
}

const ICONS: Record<PrizeKind, string> = {
  heal: "M6 2h4v4h4v4h-4v4H6v-4H2V6h4z",
  recruit: "M8 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 15c0-4 3-6 6-6s6 2 6 6z",
  train: "M8 1l6 7h-4v7H6V8H2z",
  upgrade: "M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z",
}

/** The icon of a prize. */
function Prize(props: { kind: PrizeKind }) {
  return (
    <svg class="prize" viewBox="0 0 16 16" aria-hidden="true">
      <path d={ICONS[props.kind]} />
    </svg>
  )
}

function unitOf(s: Run["roster"][number]): Unit {
  const u = Unit.of(s.id, s.kind, "squad", { x: 0, y: 0 }, s.extra)
  u.hp = s.hp
  return u
}
