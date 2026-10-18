import { For, Index, Show } from "solid-js"
import { t } from "../../i18n/strings"
import { key } from "../../map/point"
import { css } from "../board/color"
import { ICONS, UNITS } from "../board/glyphs"
import { tone } from "../board/picture"
import type { Model } from "../model"
import { Icon } from "./icon"
import { Kit } from "./kit"

const GROUPS = ["weapon", "skill", "ult", "stance"] as const
const FAMILY = { weapon: "#efe4cc", skill: "#7fc8e8", ult: "#ffb347", stance: "#a8c49a" } as const

/** Action slots grouped as weapon, skills, ultimate and stances, then End turn. */
function Bar(props: { model: Model }) {
  const m = props.model
  const list = () => {
    const u = m.unit()
    return u ? new Kit(m.game(), u).slots() : []
  }
  return (
    <nav id="bar">
      <For each={GROUPS.filter((k) => list().some((s) => s.group === k))}>
        {(k) => (
          <div class="slots">
            <Index each={list().filter((s) => s.group === k)}>
              {(s) => (
                <button
                  type="button"
                  class="slot"
                  aria-label={s().label}
                  classList={{ active: m.armed()?.slot === s().id, ready: s().group === "ult" && !s().disabled }}
                  disabled={s().disabled}
                  onClick={() => m.press(s())}
                  onMouseEnter={() => m.setHint(s())}
                  onMouseLeave={() => m.setHint(null)}
                >
                  <span class="face">
                    <span class="key">{s().key}</span>
                    <Show when={s().badge}>
                      <span class="badge">{s().badge}</span>
                    </Show>
                    <Icon glyph={ICONS[s().id] ?? ICONS.unknown} color={FAMILY[s().group]} class="glyph" />
                  </span>
                </button>
              )}
            </Index>
          </div>
        )}
      </For>
      <button
        type="button"
        class="end"
        disabled={m.game().phase !== "squad"}
        onClick={() => m.act({ type: "endTurn" })}
      >
        {t("ui.endTurn")}
      </button>
    </nav>
  )
}

/**
 * The aliens the selected soldier can target, as XCOM shows them: hit chance, amber when flanked. While the
 * cursor plans a move it shows who the soldier would see from there. Pointing shows the alien; a click aims.
 */
function Contacts(props: { model: Model }) {
  const m = props.model
  const list = () => {
    const u = m.unit()
    if (!u || m.game().phase !== "squad") return []
    const g = m.game()
    const h = m.hover()
    const planned = h && u.ap > 0 && !m.armed() && g.reach(u, u.stride()).cost.has(key(h)) ? h : u.pos
    return new Kit(g, u).sights(planned)
  }
  return (
    <Show when={list().length > 0}>
      <div id="contacts">
        <For each={list()}>
          {(c) => (
            <button
              type="button"
              class="contact"
              classList={{ flanked: c.flanked, aimed: m.armed()?.target === c.unit.id }}
              title={c.unit.name}
              onClick={() => m.aimAt(c.unit.id)}
            >
              <Icon glyph={UNITS[c.unit.kind]} color={css(tone(c.unit))} class="who" />
              <span class="chance">{c.chance}%</span>
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}

/** The hovered or armed action's name and effect, or a message; hidden when there is nothing to say. */
function Tip(props: { model: Model }) {
  const m = props.model
  const shown = () => {
    const h = m.hint()
    if (h) return h
    const a = m.armed()
    const u = m.unit()
    return a && u ? new Kit(m.game(), u).slots().find((s) => s.id === a.slot) : undefined
  }
  return (
    <Show when={shown() || m.message()}>
      <div id="tip">
        <Show when={shown()}>
          {(s) => (
            <div>
              <span class="name">{s().label}</span> <span class="muted">{s().info}</span>
            </div>
          )}
        </Show>
        <Show when={!m.hint() && m.message()}>
          <div class="message">{m.message()}</div>
        </Show>
      </div>
    </Show>
  )
}

/** The bottom of the screen: the tip, the contacts and the action bar. */
export function Dock(props: { model: Model }) {
  return (
    <div id="dock">
      <Tip model={props.model} />
      <Contacts model={props.model} />
      <Bar model={props.model} />
    </div>
  )
}
