import type { JSX } from "solid-js"
import { t } from "../../i18n/strings"
import { max } from "../../run/run"
import type { Recruit } from "../../units/unit"
import { css, SQUAD } from "../board/color"
import { UNITS } from "../board/glyphs"
import { Icon } from "../hud/icon"

/** A soldier of the roster as a button: portrait, name, class and HP. */
export function Soldier(props: { soldier: Recruit; on?: boolean; onClick?: () => void; children?: JSX.Element }) {
  const s = () => props.soldier
  return (
    <button type="button" class="soldier card" classList={{ on: props.on }} onClick={() => props.onClick?.()}>
      <Icon glyph={UNITS[s().kind]} color={css(SQUAD)} class="portrait" />
      <span class="who">
        <span class="name">{s().name}</span>
        <span class="small muted">{t(`kind.${s().kind}`)}</span>
      </span>
      <span class="hp">
        {t("ui.hp")} {s().hp}/{max(s())}
      </span>
      {props.children}
    </button>
  )
}
