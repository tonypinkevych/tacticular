import { For, Show } from "solid-js"
import { t } from "../../i18n/strings"
import type { Unit } from "../../units/unit"
import { Portrait } from "./portrait"

/** A unit's card: its portrait, name, HP, AP and skill. */
export function Card(props: { unit: Unit; selected?: boolean; onPick?: () => void }) {
  const u = () => props.unit
  const skill = () => {
    const x = u()
    if (x.uses !== null) return t("ui.uses", { left: x.uses })
    return x.cooldown > 0 ? t("ui.cooldown", { left: x.cooldown }) : t("ui.ready")
  }
  return (
    <button
      type="button"
      class="card"
      classList={{ on: props.selected, alien: u().side === "enemy", down: !u().alive() }}
      onClick={() => props.onPick?.()}
    >
      <Portrait kind={u().kind} face={u().side === "enemy" ? -1 : 1} />
      <div class="name">
        {t(`kind.${u().kind}`)}
        <Show when={u().side === "squad" && u().alive()}>
          <span class="ap">
            <For each={[0, 1]}>{(i) => <i classList={{ off: i >= u().ap }} />}</For>
          </span>
        </Show>
      </div>
      <div class="pips">
        <For each={Array.from({ length: u().profile.hp }, (_, i) => i)}>
          {(i) => <i classList={{ off: i >= u().hp }} />}
        </For>
      </div>
      <Show when={u().profile.skill}>
        {(s) => (
          <div class="meta">
            {t(`skill.${s()}`)} · {skill()}
          </div>
        )}
      </Show>
      <Show when={u().status}>{(s) => <div class={`status ${s()}`}>{t(`status.${s()}`)}</div>}</Show>
      <Show when={u().extra.branch || u().extra.partner}>
        <div class="meta">
          {[u().extra.branch && t(`branch.${u().extra.branch}`), u().extra.partner && t("ui.partner")]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </Show>
      <Show when={u().hunkered}>
        <div class="status hunkered">{t("ui.hunker")}</div>
      </Show>
    </button>
  )
}
