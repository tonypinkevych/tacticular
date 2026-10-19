import { Show } from "solid-js"
import { CONTACT_COST, RESISTANCE } from "../../campaign/campaign"
import { place, type RegionId } from "../../campaign/world"
import { t } from "../../i18n/strings"
import { css } from "../board/color"
import { ICONS } from "../board/glyphs"
import type { Expedition } from "../expedition"
import { Icon } from "../hud/icon"
import { BLUE, GREEN, OCHRE, RED } from "./ink"
import { Pips } from "./pips"
import { Stat } from "./stat"

/** The picked region: Strength, Vigilance and Resistance as pips, its bonus once free, and Contact when it is reachable. */
export function Region(props: { expedition: Expedition; id: RegionId }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const r = () => c().region(props.id)
  const bonus = () => t("world.bonus", { bonus: t(`bonus.${place(r().id).bonus}`) })
  return (
    <div class="card region">
      <h3 style={{ color: css(r().free ? GREEN : r().resistance > 0 ? BLUE : RED) }}>{t(`region.${r().id}`)}</h3>
      <Show when={!r().free} fallback={<p class="small">{t("world.free")}</p>}>
        <Stat
          icon="world:strength"
          color={RED}
          tip={t("world.strength", { value: r().strength })}
          info={t("world.strengthInfo")}
        >
          <Pips on={r().strength} of={10} tone="bad" />
        </Stat>
        <Stat
          icon="world:vigilance"
          color={OCHRE}
          tip={t("world.vigilance", { value: r().vigilance })}
          info={t("world.vigilanceInfo")}
        >
          <Pips on={r().vigilance} of={10} tone="bad" />
        </Stat>
        <Stat
          icon="world:resistance"
          color={BLUE}
          tip={t("world.resistance", { value: r().resistance })}
          info={t("world.liberate")}
        >
          <Pips on={r().resistance} of={RESISTANCE} tone="good" />
        </Stat>
      </Show>
      <Stat icon={`bonus:${place(r().id).bonus}`} color={GREEN} tip={bonus()} />
      <Show
        when={c()
          .reachable()
          .some((n) => n.id === r().id)}
      >
        <button
          type="button"
          disabled={c().intel < CONTACT_COST}
          data-tip={t("world.contact", { cost: CONTACT_COST })}
          onClick={() => x.choose({ type: "contact", region: r().id })}
        >
          <Icon glyph={ICONS["world:contact"]} color={css(BLUE)} class="icon" />
          <Icon glyph={ICONS["world:intel"]} color={css(BLUE)} class="icon" />
          {CONTACT_COST}
        </button>
      </Show>
    </div>
  )
}
