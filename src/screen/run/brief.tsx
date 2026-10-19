import { For, Show } from "solid-js"
import type { Campaign, Op, OpKind } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import { ALIEN, AMBER, BEACON, css, EVAC, SMOKE, SQUAD } from "../board/color"
import { ICONS, UNITS } from "../board/glyphs"
import { Icon } from "../hud/icon"
import { Pips } from "./pips"
import { Stat } from "./stat"

/** What each operation kind gives, as icon and amount. */
const REWARDS: Record<OpKind, [string, string][]> = {
  intel: [
    ["world:intel", "+4"],
    ["world:resistance", "+1"],
  ],
  vip: [
    ["world:recruit", "+1"],
    ["world:resistance", "+1"],
  ],
  relay: [
    ["world:project", "−2"],
    ["world:materials", "+3"],
    ["world:strength", "−1"],
    ["world:resistance", "+1"],
  ],
  captain: [
    ["world:strength", "−2"],
    ["world:materials", "+2"],
    ["world:resistance", "+1"],
  ],
  defend: [["world:vigilance", "0"]],
  liberation: [["world:freed", ""]],
}

const TONES: Record<string, ReturnType<typeof css>> = {
  "world:intel": css(BEACON),
  "world:resistance": css(BEACON),
  "world:recruit": css(SQUAD),
  "world:project": css(ALIEN),
  "world:materials": css(SMOKE),
  "world:strength": css(ALIEN),
  "world:vigilance": css(AMBER),
  "world:freed": css(EVAC),
}

/** An operation in the list: its kind, region, reward and last week; once sent, its infiltration and squad. */
export function Brief(props: { op: Op; campaign: Campaign; on: boolean; onClick: () => void }) {
  const o = () => props.op
  const c = () => props.campaign
  const squad = () =>
    o()
      .squad.map((id) => c().roster.find((s) => s.id === id))
      .filter((s) => s !== undefined)
  return (
    <button
      type="button"
      class="card brief"
      classList={{ on: props.on, [o().kind]: true }}
      data-tip={t(`op.${o().kind}`)}
      data-info={t(`op.info.${o().kind}`)}
      onClick={() => props.onClick()}
    >
      <span class="name">
        <Icon glyph={ICONS[`op:${o().kind}`]} color={css(AMBER)} class="icon" />
        {t(`op.${o().kind}`)}
        <span class="small muted">{t(`region.${o().region}`)}</span>
      </span>
      <span class="row">
        <For each={REWARDS[o().kind]}>
          {([icon, amount]) => (
            <span class="figure">
              <Icon glyph={ICONS[icon]} color={TONES[icon]} class="icon" />
              {amount}
            </span>
          )}
        </For>
        <Show when={o().event}>
          <Stat icon="world:event" color={ALIEN} tip={t("op.counter")} />
        </Show>
        <span class="spacer" />
        <Stat icon="world:week" color={SMOKE} tip={t("world.expires", { week: o().expires })}>
          {o().expires}
        </Stat>
      </span>
      <Show when={o().sent !== null}>
        <span class="row">
          <Stat
            icon="world:infiltration"
            color={BEACON}
            tip={c().launchable(o()) ? t("world.ready") : t("world.notReady", { week: o().sent! })}
            info={t("world.infiltration", { score: c().score(o()), effect: t(`infiltration.${c().score(o())}`) })}
          >
            <Pips on={c().score(o())} of={5} tone="good" />
          </Stat>
          <span class="spacer" />
          <For each={squad()}>{(s) => <Icon glyph={UNITS[s.kind]} color={css(SQUAD)} class="icon" />}</For>
        </span>
      </Show>
    </button>
  )
}
