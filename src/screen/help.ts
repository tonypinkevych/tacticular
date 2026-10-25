import { t } from "../i18n/strings"
import type { Unit } from "../units/unit"
import type { Mode } from "./battle"

/** What an ability is, what it does and how to use it, as the player reads it. */
export interface Help {
  name: string
  about: string
  how: string
}

/** The help of an ability of a soldier, or of its combo while it moves; null for an ability it does not have. */
export function help(u: Unit, mode: Mode): Help | null {
  const p = u.profile
  if (mode === "move")
    return p.tactic && p.combo
      ? {
          name: t("ui.combo"),
          about: t("help.combo.about", {
            tactic: t(`tactic.${p.tactic}`),
            put: t(`status.${p.tactic}`),
            status: t(`status.${p.combo}`),
            effect: t(`combo.${u.kind}`),
          }),
          how: t("help.combo.how"),
        }
      : null
  if (mode === "skill")
    return { name: t(`skill.${p.skill}`), about: t(`skill.about.${p.skill}`), how: t(`skill.how.${p.skill}`) }
  if (mode === "ultimate") {
    const k = p.ultimate
    if (!k) return null
    const how = k === "breach" || k === "killshot" ? t(`ult.how.${k}`) : t("ult.how.self")
    return { name: t(`ult.${k}`), about: t(`ult.about.${k}`), how: `${how} ${t("help.ultimate")}` }
  }
  if (mode === "tactic")
    return p.tactic
      ? { name: t(`tactic.${p.tactic}`), about: t(`tactic.about.${p.tactic}`), how: t(`tactic.how.${p.tactic}`) }
      : null
  const key = mode === "shoot" && p.melee ? "strike" : mode
  return { name: t(`ui.${mode}`), about: t(`help.${key}.about`), how: t(`help.${key}.how`) }
}
