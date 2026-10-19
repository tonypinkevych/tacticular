import type { JSX } from "solid-js"
import { maxHp } from "../../campaign/campaign"
import { level, type Soldier as Member, points } from "../../campaign/soldier"
import { t } from "../../i18n/strings"
import { css, SQUAD } from "../board/color"
import { UNITS } from "../board/glyphs"
import { Icon } from "../hud/icon"

/** A soldier of the roster as a button: portrait, name, class, level, HP and unspent rank points. */
export function Soldier(props: { soldier: Member; on?: boolean; onClick?: () => void; children?: JSX.Element }) {
  const s = () => props.soldier
  return (
    <button type="button" class="soldier card" classList={{ on: props.on }} onClick={() => props.onClick?.()}>
      <Icon glyph={UNITS[s().kind]} color={css(SQUAD)} class="portrait" />
      <span class="who">
        <span class="name">{s().name}</span>
        <span class="small muted">
          {t(`kind.${s().kind}`)} · {t("soldier.level", { level: level(s()) })}
        </span>
      </span>
      <span class="hp">
        {t("ui.hp")} {s().hp}/{maxHp(s())}
        {points(s()) > 0 ? <span class="points"> +{points(s())}</span> : null}
      </span>
      {props.children}
    </button>
  )
}
