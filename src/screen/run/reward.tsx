import { For } from "solid-js"
import { t } from "../../i18n/strings"
import type { Reward, Run } from "../../run/run"
import { PROFILES } from "../../units/profiles"

/** The pick of one reward after a won mission. */
export function RewardView(props: { run: Run; onTake: (pick: number) => void }) {
  const name = (id: string) => {
    const s = props.run.roster.find((x) => x.id === id)
    return s ? t(`kind.${s.kind}`) : id
  }
  const text = (r: Reward) => {
    if (r.kind === "heal") return t("ui.reward.heal")
    if (r.kind === "recruit") return t("ui.reward.recruit", { kind: t(`kind.${r.soldier.kind}`) })
    if (r.kind === "train") return t("ui.reward.train", { unit: name(r.id) })
    const s = props.run.roster.find((x) => x.id === r.id)
    if (r.branch)
      return t("ui.reward.branch", {
        unit: name(r.id),
        branch: t(`branch.${r.branch}`),
        about: t(`branch.about.${r.branch}`),
      })
    return t("ui.reward.upgrade", { unit: name(r.id), skill: s ? t(`skill.${PROFILES[s.kind].skill}`) : "" })
  }
  return (
    <section class="screen">
      <h1>{t("ui.run.reward")}</h1>
      <div class="offers">
        <For each={props.run.offers}>
          {(r, i) => (
            <button type="button" class="offer" onClick={() => props.onTake(i())}>
              <b>{text(r)}</b>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}
