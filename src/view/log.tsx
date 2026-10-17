import { createMemo, For, Show } from "solid-js"
import { t } from "../i18n/strings"
import type { Entry, Game } from "../rules/types"

/** A unit's display name: a soldier's own name with its class, else the enemy kind. */
function name(game: Game, id: unknown): string {
  const u = game.units.find((x) => x.id === id)
  if (!u) return String(id ?? "")
  return u.side === "squad" ? `${u.name} (${t(`kind.${u.kind}`)})` : t(`kind.${u.kind}`)
}

const short = (game: Game, id: unknown): string => {
  const u = game.units.find((x) => x.id === id)
  return u?.side === "squad" ? u.name : name(game, id)
}

const BRIEF = ["log.miss", "log.hit", "log.crit", "log.lash", "log.fear", "log.dread", "log.dominate"]

const MARK: Record<string, string> = { "log.hit": "✓", "log.crit": "✦", "log.miss": "✗", "log.dies": "☠" }

function line(game: Game, e: Entry, brief: boolean): string {
  const p: Record<string, string | number | boolean> = { ...e.params }
  for (const k of ["unit", "target", "by"]) if (k in p) p[k] = brief ? short(game, p[k]) : name(game, p[k])
  if (typeof p.weapon === "string") p.weapon = t(`weapon.${p.weapon}`)
  if ("saved" in p) p.result = t(p.saved ? "ui.saved" : "ui.failed")
  return t(brief && BRIEF.includes(e.key) ? e.key.replace("log.", "brief.") : e.key, p)
}

/** One log line; equal lines in a row become one with a count. */
interface Line {
  key: string
  text: string
  full: string
  side: string
  count: number
}

/** The lines of the last rounds, newest round and newest line first. */
function rounds(game: Game): { round: number; lines: Line[] }[] {
  const out = [{ round: 1, lines: [] as Line[] }]
  for (const e of game.log) {
    if (e.key === "log.round") {
      out.push({ round: Number(e.params.round), lines: [] })
      continue
    }
    const lines = out[out.length - 1].lines
    const text = line(game, e, true)
    const full = line(game, e, false)
    const last = lines[lines.length - 1]
    if (last && last.full === full) {
      last.count += 1
      continue
    }
    const u = game.units.find((x) => x.id === e.params.unit)
    lines.push({ key: e.key, text, full, side: u ? u.side : "", count: 1 })
  }
  return out
    .slice(-8)
    .reverse()
    .map((r) => ({ ...r, lines: r.lines.reverse() }))
}

/** The battle log by round, newest first; a line shows its full rolls on hover. */
export function Log(props: { game: Game }) {
  const list = createMemo(() => rounds(props.game))
  const latest = () => list().findIndex((r) => r.lines.length > 0)
  return (
    <div class="log">
      <For each={list()}>
        {(r, i) => (
          <details open={i() === 0 || i() === latest()}>
            <summary>{t("ui.round", { round: r.round })}</summary>
            <ol>
              <For each={r.lines}>
                {(l) => (
                  <li class={`${l.key.replace(".", "-")} ${l.side}`}>
                    <span class="mark">{MARK[l.key] ?? "·"}</span>
                    <span class="text">{l.text}</span>
                    <span class="full">{l.full}</span>
                    <Show when={l.count > 1}>
                      <span class="times">×{l.count}</span>
                    </Show>
                  </li>
                )}
              </For>
            </ol>
          </details>
        )}
      </For>
    </div>
  )
}
