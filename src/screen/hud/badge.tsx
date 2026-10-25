import { t } from "../../i18n/strings"
import type { Status } from "../../units/unit"
import { GLYPH, label } from "../glyph"

/** A status as a coloured tag with its icon. */
export function Badge(props: { status: Status }) {
  return (
    <span class="stamp" style={{ background: GLYPH[props.status].color }}>
      {label(props.status)}
    </span>
  )
}

/** The status a class puts on and the status it turns into a combo, as two tags with an arrow between. */
export function Links(props: { put?: Status; combo?: Status }) {
  return (
    <span class="links">
      {props.put && <Badge status={props.put} />}
      <span>{t("ui.links")}</span>
      {props.combo && <Badge status={props.combo} />}
    </span>
  )
}
