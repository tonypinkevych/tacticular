import { For, Show } from "solid-js"
import { kit, LEVELS, level, points, rankable, type Soldier } from "../../campaign/soldier"
import { ABILITIES, type AbilityId, growth, power, span } from "../../combat/abilities"
import { t } from "../../i18n/strings"
import { PROFILES } from "../../units/profiles"
import { Unit } from "../../units/unit"
import type { Expedition } from "../expedition"

/** A soldier's level, XP and kit, with the skills it can rank up now. */
export function Profile(props: { expedition: Expedition; soldier: Soldier }) {
  const s = () => props.soldier
  const goal = () => LEVELS[level(s())] ?? LEVELS[LEVELS.length - 1]
  const unit = () => Unit.of(s().id, s().kind, "squad", { x: 0, y: 0 }, s().name, null, s().spread, s().ranks)
  const next = (id: AbilityId) => {
    const rank = s().ranks?.[id] ?? 0
    const perk = ABILITIES[id].perks?.includes(rank + 1) ? [t(`perk.${id}.${rank + 1}`)] : []
    const changes = [...growth(id, rank).map((g) => `${t(`stat.${g.stat}`)} ${g.now} → ${g.next}`), ...perk].join(" · ")
    return changes ? t("soldier.next", { changes }) : ""
  }
  const tag = (id: AbilityId) =>
    id === PROFILES[s().kind].ultimate
      ? `· ${t("soldier.ultimate")}`
      : ABILITIES[id].passive
        ? `· ${t("soldier.passive")}`
        : ""
  const need = (id: string) => (id === PROFILES[s().kind].ultimate ? 6 : 2 * ((s().ranks?.[id as never] ?? 0) + 1) - 1)
  return (
    <div class="profile">
      <p class="small muted">
        {t("soldier.xp", { xp: s().xp, next: goal() })} · {t("soldier.points", { points: points(s()) })}
      </p>
      <For each={kit(s())}>
        {(id) => (
          <div class="skill">
            <span class="name">
              {t(`ability.${id}`)} {tag(id)}
            </span>
            <span class="small muted">
              {t("ui.rank", { rank: s().ranks?.[id] ?? 0 })} ·{" "}
              {t(`info.${id}`, { power: power(unit(), id), range: span(unit(), id) })}
            </span>
            <Show when={next(id)}>
              <span class="small">{next(id)}</span>
            </Show>
            <button
              type="button"
              disabled={!rankable(s(), id)}
              data-tip={rankable(s(), id) ? next(id) : t("soldier.locked", { level: need(id) })}
              onClick={() => props.expedition.choose({ type: "rank", soldier: s().id, skill: id })}
            >
              {t("soldier.rankUp")}
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
