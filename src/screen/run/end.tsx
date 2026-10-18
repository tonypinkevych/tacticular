import { For } from "solid-js"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

/** The end of a run, won or lost, with the soldiers left and a new run. */
export function End(props: { expedition: Expedition }) {
  const x = props.expedition
  const won = () => x.run().stage === "won"
  return (
    <section class="run">
      <h2>{won() ? t("run.won") : t("run.lost")}</h2>
      <p>{won() ? t("run.wonText") : t("run.lostText")}</p>
      <div class="soldiers">
        <For each={x.run().roster}>{(s) => <Soldier soldier={s} />}</For>
      </div>
      <button type="button" class="primary" onClick={() => x.restart()}>
        {t("run.new")}
      </button>
    </section>
  )
}
