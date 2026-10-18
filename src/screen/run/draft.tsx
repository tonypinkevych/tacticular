import { createSignal, For } from "solid-js"
import { t } from "../../i18n/strings"
import { type ClassId, PROFILES } from "../../units/profiles"
import type { Expedition } from "../expedition"
import { Soldier } from "./soldier"

/** A class's skills and ultimate, by name. */
const skills = (kind: ClassId): string => {
  const p = PROFILES[kind]
  return [...p.abilities, ...(p.ultimate ? [p.ultimate] : [])].map((a) => t(`ability.${a}`)).join(" · ")
}

/** The start of a run: pick 3 of the 7 candidates. */
export function Draft(props: { expedition: Expedition }) {
  const x = props.expedition
  const [picks, setPicks] = createSignal<string[]>([])
  const toggle = (id: string) =>
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p))
  return (
    <section class="run">
      <h2>{t("run.draft")}</h2>
      <div class="soldiers">
        <For each={x.run().candidates}>
          {(c) => (
            <Soldier soldier={c} on={picks().includes(c.id)} onClick={() => toggle(c.id)}>
              <span class="skills small muted">{skills(c.kind)}</span>
            </Soldier>
          )}
        </For>
      </div>
      <button
        type="button"
        class="primary"
        disabled={picks().length !== 3}
        onClick={() => x.choose({ type: "draft", picks: picks() })}
      >
        {t("run.begin")}
      </button>
    </section>
  )
}
