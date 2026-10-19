import type { JSX } from "solid-js"
import { css, type Rgb } from "../board/color"
import { ICONS } from "../board/glyphs"
import { Icon } from "../hud/icon"

/** A value beside its icon; the pointer over it shows its name and details. */
export function Stat(props: { icon: string; color: Rgb; tip: string; info?: string; children?: JSX.Element }) {
  return (
    <span class="figure" data-tip={props.tip} data-info={props.info}>
      <Icon glyph={ICONS[props.icon]} color={css(props.color)} class="icon" />
      {props.children}
    </span>
  )
}
