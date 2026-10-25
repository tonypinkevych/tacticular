import { Show } from "solid-js"
import { t } from "../../i18n/strings"
import { type ClassId, PROFILES } from "../../units/profiles"
import { Links } from "./badge"

/** What a class brings: its skill, its ultimate, and the status it puts on and turns into a combo. */
export function Kit(props: { kind: ClassId }) {
  const p = () => PROFILES[props.kind]
  return (
    <div class="kit">
      <span class="muted">
        {t(`skill.${p().skill}`)}: {t(`skill.about.${p().skill}`)}
      </span>
      <Show when={p().ultimate}>
        {(u) => (
          <span class="ult">
            <b>{t(`ult.${u()}`)}</b>: {t(`ult.about.${u()}`)}
          </span>
        )}
      </Show>
      <span class="combo">
        {t(`tactic.${p().tactic}`)}: <Links put={p().tactic} combo={p().combo} />
      </span>
    </div>
  )
}
