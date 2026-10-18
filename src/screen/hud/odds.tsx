import { Index, Show } from "solid-js"
import type { Part } from "../../combat/combat"
import { chance, EDGE } from "../../combat/dice"
import { t } from "../../i18n/strings"
import type { Unit } from "../../units/unit"
import type { Model } from "../model"
import { Card, signed } from "./card"
import { type Forecast, Kit } from "./kit"

function Parts(props: { parts: Part[] }) {
  return (
    <span class="muted">
      {" ("}
      {props.parts.map((p, i) => `${i ? ", " : ""}${t(`part.${p.key}`)} ${i ? signed(p.value) : p.value}`).join("")}
      {")"}
    </span>
  )
}

/** The 20 faces of the d20: red misses, green hits, gold is a critical; all gold for a sure critical. */
function Strip(props: { need: number; sure: boolean }) {
  return (
    <div class="strip">
      <Index each={Array.from({ length: 20 }, (_, i) => i + 1)}>
        {(face) => (
          <span
            classList={{
              crit: props.sure || face() === 20,
              hit: !props.sure && face() >= props.need && face() < 20,
              miss: !props.sure && face() < props.need,
            }}
          />
        )}
      </Index>
    </div>
  )
}

function Edge(props: { edge: number; advantages: string[]; disadvantages: string[]; before: number; after: number }) {
  const why = (list: string[]) => list.map((r) => t(`reason.${r}`)).join(", ")
  const both = () =>
    [
      ...props.advantages.map((r) => `+${t(`reason.${r}`)}`),
      ...props.disadvantages.map((r) => `−${t(`reason.${r}`)}`),
    ].join(", ")
  const pct = () => ({
    before: Math.round(props.before * 100),
    after: Math.round(props.after * 100),
    value: Math.abs(props.edge) * EDGE,
    why: both(),
  })
  return (
    <div classList={{ good: props.edge > 0, bad: props.edge < 0, muted: props.edge === 0 }}>
      {props.edge > 0
        ? t("ui.edge.advantage", pct())
        : props.edge < 0
          ? t("ui.edge.disadvantage", pct())
          : props.advantages.length || props.disadvantages.length
            ? t("ui.edge.cancel", { good: why(props.advantages), bad: why(props.disadvantages) })
            : t("ui.edge.none")}
    </div>
  )
}

/** The chance of an armed action in big type, with how it is built on hover. */
function Odds(props: { forecast: Forecast }) {
  const d = () => props.forecast
  return (
    <div class="odds">
      <div class="label">{d().label}</div>
      <Show when={d().kind === "attack" && (d() as Extract<Forecast, { kind: "attack" }>)}>
        {(a) => (
          <>
            <div class="big">
              {Math.round(a().odds.chance * 100)}%
              <span class="dmg">
                {a().odds.min}–{a().odds.max} {t("ui.damage")}
              </span>
            </div>
            <Strip need={a().odds.need} sure={a().odds.sure} />
            <div class="more">
              <div>{a().odds.sure ? t("ui.sure") : t("ui.need", { need: a().odds.need })}</div>
              <div>
                {t("ui.yourAim")} {signed(a().odds.aim)}
                <Parts parts={a().odds.aimParts} />
              </div>
              <div>
                {t("ui.theirDefense")} {a().odds.defense}
                <Parts parts={a().odds.defenseParts} />
              </div>
              <Edge
                edge={a().odds.edge}
                advantages={a().odds.advantages}
                disadvantages={a().odds.disadvantages}
                before={chance(a().odds.aim, a().odds.defense, 0)}
                after={a().odds.chance}
              />
              <div class="muted small">{t("ui.naturals")}</div>
            </div>
          </>
        )}
      </Show>
      <Show when={d().kind === "save" && (d() as Extract<Forecast, { kind: "save" }>)}>
        {(s) => (
          <>
            <div class="big">{Math.round(s().chance * 100)}%</div>
            <div class="more">
              <div>{t("ui.saveRule", { will: signed(s().will), dc: s().dc })}</div>
              <Show when={s().edge > 0}>
                <div class="bad">{t("ui.saveHunker")}</div>
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

/** The armed action's target with its odds, else the unit under the cursor. */
export function Target(props: { model: Model }) {
  const m = props.model
  const g = () => m.game()
  const armed = () => {
    const u = m.unit()
    const a = m.armed()
    return u && a ? { u, a } : null
  }
  const shown = (): Unit | undefined => {
    const a = m.armed()
    if (a?.target) return g().units.find((x) => x.id === a.target && x.alive())
    const h = m.hover()
    const x = h ? g().unitAt(h) : undefined
    if (!x || x.id === m.unit()?.id) return undefined
    return x.side === "squad" || g().stealth.visible(x) ? x : undefined
  }
  const odds = () => {
    const x = armed()
    return x ? new Kit(g(), x.u).forecast(x.a, m.hover()) : null
  }
  return (
    <Show when={shown()}>
      {(x) => (
        <Card unit={x()} game={g()} model={m}>
          <Show when={odds()}>{(f) => <Odds forecast={f()} />}</Show>
        </Card>
      )}
    </Show>
  )
}
