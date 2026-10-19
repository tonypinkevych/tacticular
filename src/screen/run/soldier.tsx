import { Show } from "solid-js"
import { maxHp } from "../../campaign/campaign"
import { level, type Soldier as Member, points } from "../../campaign/soldier"
import { t } from "../../i18n/strings"
import { css } from "../board/color"
import { ICONS, UNITS } from "../board/glyphs"
import { Icon } from "../hud/icon"
import { GREY, INK } from "./ink"

/**
 * A soldier as a portrait button: class glyph, HP bar and name, a badge for rank points to spend, and a mark when
 * away or resting. The pointer over it shows the class, level and HP.
 */
export function Soldier(props: { soldier: Member; on?: boolean; state?: "away" | "rest"; onClick?: () => void }) {
  const s = () => props.soldier
  const info = () =>
    [
      t(`kind.${s().kind}`),
      t("soldier.level", { level: level(s()) }),
      `${t("ui.hp")} ${s().hp}/${maxHp(s())}`,
      points(s()) > 0 ? t("soldier.points", { points: points(s()) }) : "",
      props.state ? t(`soldier.${props.state}`) : "",
    ]
      .filter(Boolean)
      .join(" · ")
  return (
    <button
      type="button"
      class="soldier"
      classList={{ on: props.on, dim: !!props.state }}
      data-tip={s().name}
      data-info={info()}
      onClick={() => props.onClick?.()}
    >
      <Show when={props.state}>{(st) => <Icon glyph={ICONS[`world:${st()}`]} color={css(GREY)} class="state" />}</Show>
      <Show when={points(s()) > 0}>
        <span class="badge">+{points(s())}</span>
      </Show>
      <Icon glyph={UNITS[s().kind]} color={css(INK)} class="portrait" />
      <span class="health">
        <i style={{ width: `${(100 * s().hp) / maxHp(s())}%` }} />
      </span>
      <span class="name">{s().name}</span>
    </button>
  )
}
