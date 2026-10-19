import { For } from "solid-js"
import type { Goal } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"

const GOALS: Goal[] = [1, 3, 8]

/** The start of a campaign: pick how many regions to free. */
export function Goals(props: { expedition: Expedition }) {
  return (
    <section class="run">
      <h2>{t("goal.title")}</h2>
      <div class="rewards">
        <For each={GOALS}>
          {(g) => (
            <button type="button" class="card reward" onClick={() => props.expedition.begin(g)}>
              <span class="name">{t(`goal.${g}`)}</span>
              <span class="small muted">{t(`goal.${g}Info`)}</span>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}
