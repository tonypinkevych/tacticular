import { createSignal, For } from "solid-js"
import { t } from "../../i18n/strings"
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
              class="node"
              classList={{ open: open(n.id), on: node() === n.id, here: run.at === n.id }}
              style={{ left: `${where(n.id)[0]}px`, top: `${where(n.id)[1]}px` }}
              disabled={!open(n.id)}
              onClick={() => setNode(n.id)}
            >
              {t(`ui.task.${n.kind}`)}
            </button>
          )}
        </For>
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

function unitOf(s: Run["roster"][number]): Unit {
  const u = Unit.of(s.id, s.kind, "squad", { x: 0, y: 0 }, s.extra)
  u.hp = s.hp
  return u
}
