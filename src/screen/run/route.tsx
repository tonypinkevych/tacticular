import { createSignal, For, Show } from "solid-js"
import { t } from "../../i18n/strings"
import type { Node } from "../../run/chart"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

const W = 680
const H = 300

/** Where a node sits on the drawn chart. */
function spot(nodes: Node[], n: Node): { x: number; y: number } {
  const row = nodes.filter((m) => m.layer === n.layer)
  return { x: 50 + n.layer * 145, y: ((row.indexOf(n) + 1) * H) / (row.length + 1) }
}

/** The chart of the act with the missions the squad can go to, and the soldiers to send. */
export function Route(props: { expedition: Expedition }) {
  const x = props.expedition
  const run = () => x.run()
  const healthy = () => [...run().roster].sort((a, b) => b.hp - a.hp).slice(0, 4)
  const [deploy, setDeploy] = createSignal<string[]>(healthy().map((s) => s.id))
  const [hover, setHover] = createSignal<Node | null>(null)
  const open = (n: Node) =>
    run()
      .options()
      .some((o) => o.id === n.id)
  const toggle = (id: string) =>
    setDeploy((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < 4 ? [...d, id] : d))
  const go = (n: Node) => {
    if (open(n) && deploy().length > 0) x.choose({ type: "go", node: n.id, deploy: deploy() })
  }
  return (
    <section class="run">
      <h2>
        {t("run.act")} <span class="muted small">{t("run.threat", { threat: run().threat })}</span>
      </h2>
      <div class="chart">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <For each={run().chart.nodes}>
            {(n) => (
              <For each={n.next}>
                {(id) => {
                  const a = spot(run().chart.nodes, n)
                  const b = spot(run().chart.nodes, run().chart.node(id))
                  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="edge" />
                }}
              </For>
            )}
          </For>
        </svg>
        <For each={run().chart.nodes}>
          {(n) => {
            const p = spot(run().chart.nodes, n)
            return (
              <button
                type="button"
                class="node"
                classList={{ open: open(n), here: run().at === n.id, [n.kind]: true }}
                style={{ left: `${(100 * p.x) / W}%`, top: `${(100 * p.y) / H}%` }}
                aria-disabled={!open(n)}
                onClick={() => go(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
              >
                {t(`run.task.${n.kind}`)}
              </button>
            )
          }}
        </For>
      </div>
      <p class="info">
        <Show when={hover()} fallback={<span class="muted">{t("run.pick")}</span>}>
          {(n) => (
            <>
              <b>{t(`run.task.${n().kind}`)}</b> · {t(`run.effect.${n().kind}`)}
            </>
          )}
        </Show>
      </p>
      <h3>{t("run.deploy")}</h3>
      <div class="soldiers">
        <For each={run().roster}>
          {(s) => <Soldier soldier={s} on={deploy().includes(s.id)} onClick={() => toggle(s.id)} />}
        </For>
      </div>
    </section>
  )
}
