import { For } from "solid-js"
import { t } from "../../i18n/strings"
import type { Reward } from "../../run/run"
import type { Expedition } from "../expedition"

/** The pick of 3 rewards after a won mission. */
export function Rewards(props: { expedition: Expedition }) {
  const x = props.expedition
  const name = (id: string) => x.run().roster.find((s) => s.id === id)?.name ?? id
  const label = (r: Reward) =>
    r.kind === "heal"
      ? [t("run.reward.heal"), t("run.reward.healInfo")]
      : r.kind === "recruit"
        ? [t("run.reward.recruit", { name: r.recruit.name }), t(`kind.${r.recruit.kind}`)]
        : [t("run.reward.train", { name: name(r.id) }), t("run.reward.trainInfo")]
  return (
    <section class="run">
      <h2>{t("run.reward")}</h2>
      <div class="rewards">
        <For each={x.run().offers}>
          {(r, i) => (
            <button type="button" class="card reward" onClick={() => x.choose({ type: "take", pick: i() })}>
              <span class="name">{label(r)[0]}</span>
              <span class="small muted">{label(r)[1]}</span>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}
