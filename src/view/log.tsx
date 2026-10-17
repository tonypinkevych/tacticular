import { For } from "solid-js"
import { t } from "../i18n/strings"
import type { Entry, Game } from "../rules/types"

/** A unit's display name: a soldier's own name with its class, else the enemy kind. */
export function name(game: Game, id: unknown): string {
  const u = game.units.find((x) => x.id === id)
  if (!u) return String(id ?? "")
  return u.side === "squad" ? `${u.name} (${t(`kind.${u.kind}`)})` : t(`kind.${u.kind}`)
}

function line(game: Game, e: Entry): string {
  const p: Record<string, string | number | boolean> = { ...e.params }
  for (const k of ["unit", "target", "by"]) if (k in p) p[k] = name(game, p[k])
  if (typeof p.weapon === "string") p.weapon = t(`weapon.${p.weapon}`)
  if ("saved" in p) p.result = t(p.saved ? "ui.saved" : "ui.failed")
  return t(e.key, p)
}

/** The battle log, newest first, with every roll written out. */
export function Log(props: { game: Game }) {
  return (
    <section class="logbox">
      <h2>{t("ui.log")}</h2>
      <ol class="log">
        <For each={props.game.log.slice(-60).reverse()}>
          {(e) => <li class={e.key.replace(".", "-")}>{line(props.game, e)}</li>}
        </For>
      </ol>
    </section>
  )
}
