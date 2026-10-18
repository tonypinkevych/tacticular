import { createEffect, createMemo, For, Show } from "solid-js"
import { t } from "../../i18n/strings"
import type { Entry, Game } from "../../mission/game"

/** A unit's display name: a soldier's own name, else the alien kind. */
function name(game: Game, id: unknown): string {
  const u = game.units.find((x) => x.id === id)
  if (!u) return String(id ?? "")
  return u.side === "squad" ? u.name : t(`kind.${u.kind}`)
}

function line(game: Game, e: Entry): string {
  const p: Record<string, string | number | boolean> = { ...e.params }
  for (const k of ["unit", "target", "by"]) if (k in p) p[k] = name(game, p[k])
  if (typeof p.weapon === "string") p.weapon = t(`weapon.${p.weapon}`)
  if ("saved" in p) p.result = t(p.saved ? "ui.saved" : "ui.failed")
  return t(e.key, p)
}

/** One log line; equal lines in a row become one with a count. */
interface Line {
  key: string
  text: string
  side: string
  count: number
}

/** Every round's lines in the order they happened. */
function rounds(game: Game): { round: number; lines: Line[] }[] {
  const out = [{ round: 1, lines: [] as Line[] }]
  for (const e of game.log) {
    if (e.key === "log.round") {
      out.push({ round: Number(e.params.round), lines: [] })
      continue
    }
    const lines = out[out.length - 1].lines
    const text = line(game, e)
    const last = lines[lines.length - 1]
    if (last && last.text === text) {
      last.count += 1
      continue
    }
    const u = game.units.find((x) => x.id === e.params.unit)
    lines.push({ key: e.key, text, side: u ? u.side : "", count: 1 })
  }
  return out.filter((r) => r.lines.length > 0)
}

/** The battle log by round in time order, in full, kept scrolled to the newest line. */
export function Log(props: { game: Game }) {
  let box!: HTMLDivElement
  const list = createMemo(() => rounds(props.game))
  createEffect(() => {
    list()
    box.scrollTop = box.scrollHeight
  })
  return (
    <div class="log" ref={box}>
      <For each={list()}>
        {(r) => (
          <section>
            <h3>{t("ui.round", { round: r.round })}</h3>
            <ol>
              <For each={r.lines}>
                {(l) => (
                  <li class={`${l.key.replace(".", "-")} ${l.side}`}>
                    <span class="mark" />
                    <span class="text">{l.text}</span>
                    <Show when={l.count > 1}>
                      <span class="times">×{l.count}</span>
                    </Show>
                  </li>
                )}
              </For>
            </ol>
          </section>
        )}
      </For>
    </div>
  )
}
