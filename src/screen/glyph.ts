import { t } from "../i18n/strings"
import type { Status } from "../units/unit"
import { ORANGE, RED, TEAL } from "./board/ink"

/** The icon and colour each status shows with everywhere on screen. */
export const GLYPH: Record<Status, { icon: string; color: string }> = {
  suppressed: { icon: "⊘", color: ORANGE },
  staggered: { icon: "≈", color: "#8a6d10" },
  exposed: { icon: "◎", color: RED },
  marked: { icon: "✛", color: TEAL },
  taunted: { icon: "!", color: "#7a3fa0" },
}

/** The name of a status with its icon in front. */
export function label(s: Status): string {
  return `${GLYPH[s].icon} ${t(`status.${s}`)}`
}
