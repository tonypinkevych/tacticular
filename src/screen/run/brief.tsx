import { For, Show } from "solid-js"
import type { Op, Penalty } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import { ALIEN, AMBER, BEACON, css, EVAC, SMOKE, SQUAD } from "../board/color"
import { ICONS } from "../board/glyphs"
import { Icon } from "../hud/icon"
import { Pips } from "./pips"
import { Stat } from "./stat"

/** What an operation gives when won, as icon and amount, by its kind and difficulty. */
function rewards(o: Op): [string, string][] {
  const d = o.difficulty
  const supplies: [string, string] = ["world:supplies", `+${2 * d}`]
  if (o.kind === "intel") return [supplies, ["world:intel", `+${2 + d}`]]
  if (o.kind === "vip") return [supplies, ["world:recruit", "+1"]]
  if (o.kind === "relay")
    return [supplies, ["world:project", "−2"], ["world:materials", `+${1 + d}`], ["world:resistance", "+1"]]
  if (o.kind === "captain")
    return [supplies, ["world:strength", "−2"], ["world:materials", `+${d}`], ["world:resistance", "+1"]]
  if (o.kind === "defend") return [supplies, ["world:vigilance", "0"]]
  return [["world:freed", ""]]
}

/** What leaving an operation costs, as icon and amount. */
const PENALTIES: Record<Penalty, [string, string]> = {
  project: ["world:project", "+2"],
  strength: ["world:strength", "+1"],
  resistance: ["world:resistance", "−1"],
}

const TONES: Record<string, ReturnType<typeof css>> = {
  "world:intel": css(BEACON),
  "world:resistance": css(BEACON),
  "world:recruit": css(SQUAD),
  "world:supplies": css(AMBER),
  "world:project": css(ALIEN),
  "world:materials": css(SMOKE),
  "world:strength": css(ALIEN),
  "world:vigilance": css(AMBER),
  "world:freed": css(EVAC),
}

/** A posted operation in the list: its kind, region, reward, difficulty and what leaving it costs. */
export function Brief(props: { op: Op; on: boolean; onClick: () => void }) {
  const o = () => props.op
  const penalty = () => o().penalty
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
        <span class="spacer" />
        <span
          class="figure"
          data-tip={t("world.difficulty", { level: t(`difficulty.${o().difficulty}`), pods: 1 + o().difficulty })}
        >
          <Pips on={o().difficulty} of={4} tone="bad" />
        </span>
      </span>
      <span class="row">
        <For each={rewards(o())}>
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
        <span class="figure penalty" data-tip={t(`penalty.${penalty() ?? "none"}`)}>
          <Show when={penalty()} fallback="—">
            {(p) => (
              <>
                <Icon glyph={ICONS[PENALTIES[p()][0]]} color={css(ALIEN)} class="icon" />
                {PENALTIES[p()][1]}
              </>
            )}
          </Show>
        </span>
      </span>
    </button>
  )
}
