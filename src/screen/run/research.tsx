import { For, Show } from "solid-js"
import { TECHS, type Tech } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import type { Expedition } from "../expedition"

/** Research to start and the one running. */
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
    <div class="research">
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
    </div>
  )
}
