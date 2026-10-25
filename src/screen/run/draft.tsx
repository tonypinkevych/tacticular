import { createSignal, For, Show } from "solid-js"
import { t } from "../../i18n/strings"
import type { Soldier } from "../../run/run"
import { PROFILES } from "../../units/profiles"
import { Portrait } from "../hud/portrait"

/** The squad pick at the start of a run: 3 of the 5 classes. */
export function Draft(props: { candidates: Soldier[]; onPick: (ids: string[]) => void }) {
  const [picked, setPicked] = createSignal<string[]>([])
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p))
  return (
    <section class="screen">
      <h1>{t("ui.run.draft")}</h1>
      <div class="offers">
        <For each={props.candidates}>
          {(c) => (
            <button
              type="button"
              class="offer"
              classList={{ on: picked().includes(c.id) }}
              onClick={() => toggle(c.id)}
            >
              <Portrait kind={c.kind} />
              <b>{t(`kind.${c.kind}`)}</b>
              <span>
                {t("ui.hp")} {c.max} · {t("ui.run.move", { tiles: PROFILES[c.kind].move })}
              </span>
              <span class="muted">
                {t(`skill.${PROFILES[c.kind].skill}`)}: {t(`skill.about.${PROFILES[c.kind].skill}`)}
              </span>
              <Show when={PROFILES[c.kind].ultimate}>
                {(u) => (
                  <span class="ult">
                    <b>{t(`ult.${u()}`)}</b>: {t(`ult.about.${u()}`)}
                  </span>
                )}
              </Show>
              <span class="combo">
                {t("ui.run.links", {
                  tactic: t(`tactic.${PROFILES[c.kind].tactic}`),
                  status: t(`status.${PROFILES[c.kind].combo}`),
                })}
              </span>
            </button>
          )}
        </For>
      </div>
      <button type="button" class="go" disabled={picked().length !== 3} onClick={() => props.onPick(picked())}>
        {t("ui.run.start")}
      </button>
    </section>
  )
}
