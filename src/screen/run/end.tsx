import { For } from "solid-js"
import { GOALS } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

/** The end of a campaign, won or lost, with the soldiers left and a new campaign. */
export function End(props: { expedition: Expedition }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const won = () => c().stage === "won"
  const why = () =>
    won()
      ? t("campaign.wonText", { goal: c().goal })
      : c().project >= GOALS[c().goal].end
        ? t("campaign.lostProject")
        : t("campaign.lostRoster")
  return (
    <section class="run">
      <h2>{won() ? t("campaign.won") : t("campaign.lost")}</h2>
      <p>
        {why()} {t("campaign.weeks", { weeks: c().week })}
      </p>
      <div class="soldiers">
        <For each={c().roster}>{(s) => <Soldier soldier={s} />}</For>
      </div>
      <button type="button" class="primary" onClick={() => x.restart()}>
        {t("campaign.new")}
      </button>
    </section>
  )
}
