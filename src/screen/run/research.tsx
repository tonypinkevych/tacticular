import { For, Show } from "solid-js"
import { RECRUIT_COST, ROSTER, TECHS, type Tech } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"

/** Research to start, the one running, and the recruit button. */
export function Research(props: { expedition: Expedition }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const open = () =>
    (Object.keys(TECHS) as Tech[]).filter(
      (k) => !c().techs.includes(k) && (!TECHS[k].needs || c().techs.includes(TECHS[k].needs!)),
    )
  const affordable = (k: Tech) =>
    !c().research && c().supplies >= TECHS[k].supplies && c().materials >= TECHS[k].materials
  return (
    <div class="card">
      <h3>{t("world.research")}</h3>
      <Show when={c().research}>
        {(r) => <p class="small">{t("world.researching", { tech: t(`tech.${r().tech}`), week: r().ready })}</p>}
      </Show>
      <For each={open()}>
        {(k) => (
          <button
            type="button"
            class="reward"
            disabled={!affordable(k)}
            onClick={() => x.choose({ type: "research", tech: k })}
          >
            <span class="name">{t(`tech.${k}`)}</span>
            <span class="small muted">
              {t(`tech.info.${k.replace(/\d$/, "")}`)} · {t("tech.cost", TECHS[k] as unknown as Record<string, number>)}
            </span>
          </button>
        )}
      </For>
      <button
        type="button"
        disabled={c().supplies < RECRUIT_COST || c().roster.length >= ROSTER}
        onClick={() => x.choose({ type: "recruit" })}
      >
        {t("world.recruit", { cost: RECRUIT_COST })}
      </button>
    </div>
  )
}
