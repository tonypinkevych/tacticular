import { t } from "../i18n/strings"
import type { Unit } from "../units/unit"
import type { Mode } from "./battle"

/** What an ability is, what it does and how to use it, as the player reads it. */
export interface Help {
  name: string
  about: string
  how: string
}

/** The help of an ability of a soldier, or of its combo with its squad while it moves; null for an ability it lacks. */
export function help(u: Unit, mode: Mode, team: Unit[] = []): Help | null {
  const p = u.profile
  if (mode === "move") {
    if (!p.tactic || !p.combo) return null
    const who = (match: (q: Unit["profile"]) => boolean) =>
      team
        .filter((x) => x.id !== u.id && match(x.profile))
        .map((x) => t(`kind.${x.kind}`))
        .join(t("help.combo.or"))
    const setter = who((q) => q.tactic === p.combo),
      taker = who((q) => q.combo === p.tactic)
    return {
      name: t("ui.combo"),
      about: [
        t(taker ? "help.combo.setup" : "help.combo.setup.none", {
          tactic: t(`tactic.${p.tactic}`),
          put: t(`status.${p.tactic}`),
          who: taker,
        }),
        t(setter ? "help.combo.cash" : "help.combo.cash.none", {
          status: t(`status.${p.combo}`),
          who: setter,
          effect: t(`combo.${u.kind}`),
        }),
      ].join("\n"),
      how: t("help.combo.how"),
    }
  }
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
