import { For, Index, type JSX, Show } from "solid-js"
import { WEAPONS } from "../../combat/weapons"
import { t } from "../../i18n/strings"
import type { Game } from "../../mission/game"
import type { Unit } from "../../units/unit"
import { css } from "../board/color"
import { UNITS } from "../board/glyphs"
import { tone } from "../board/picture"
import type { Model } from "../model"
import { Icon } from "./icon"

export const Portrait = (props: { unit: Unit }) => (
  <Icon glyph={UNITS[props.unit.kind]} color={css(tone(props.unit))} class="portrait" />
)

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

function Hp(props: { unit: Unit }) {
  return (
    <div class="hp">
      <div class="segments">
        <Index each={Array.from({ length: props.unit.maxHp })}>
          {(_, i) => <span classList={{ full: i < props.unit.hp }} />}
        </Index>
      </div>
      <span class="num">
        {props.unit.hp}/{props.unit.maxHp}
      </span>
    </div>
  )
}

/** A unit at a glance: who, health, actions, weapon and what affects it; stats show on hover. */
export function Card(props: { unit: Unit; game: Game; model: Model; children?: JSX.Element }) {
  const u = () => props.unit
  const soldier = () => u().side === "squad"
  const flanked = () => {
    const g = props.game
    const enemies = g.units.filter((x) => x.alive() && x.foe(u()) && (x.side === "squad" || g.stealth.visible(x)))
    return g.cover.flankers(u(), enemies).length > 0
  }
  const w = () => WEAPONS[u().weapon]
  const stat = (label: string, value: string | number) => (
    <div class="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
  return (
    <section class="card" classList={{ foe: !soldier() }}>
      <button
        type="button"
        class="more-mark"
        title={t("ui.extended")}
        onClick={() => props.model.setExtended(!props.model.extended())}
      >
        F1
      </button>
      <div class="head">
        <Portrait unit={u()} />
        <div class="who">
          <div class="name">{soldier() ? u().name : t(`kind.${u().kind}`)}</div>
          <div class="small">{soldier() ? t(`kind.${u().kind}`) : t(`alert.${u().alert}`)}</div>
        </div>
        <Show when={soldier()}>
          <div class="ap" title={t("ui.ap")}>
            <Index each={[0, 1]}>{(_, i) => <span class="pip" classList={{ full: i < u().ap }} />}</Index>
          </div>
        </Show>
      </div>
      <Hp unit={u()} />
      <div class="weapon">
        <span>{t(`weapon.${u().weapon}`)}</span>
        <span class="muted">
          {w().dice.count + w().dice.bonus}–{w().dice.count * w().dice.sides + w().dice.bonus}
        </span>
        <Show when={w().ammo !== null}>
          <span class="ammo">
            <Index each={Array.from({ length: w().ammo ?? 0 })}>
              {(_, i) => <span classList={{ full: i < u().ammo }} />}
            </Index>
          </span>
        </Show>
      </div>
      <div class="chips">
        <Show when={soldier() && u().concealed}>
          <span class="chip hidden">{t("ui.concealed")}</span>
        </Show>
        <Show when={flanked()}>
          <span class="chip danger">{t("ui.flanked")}</span>
        </Show>
        <Show when={u().intent}>
          <span class="chip danger">{t("ui.telegraph")}</span>
        </Show>
        <Show when={u().wounded()}>
          <span class="chip status" title={t("about.wounded")}>
            {t("ui.wounded")}
          </span>
        </Show>
        <Show when={u().stance !== "none"}>
          <span class="chip">{t(`action.${u().stance}`)}</span>
        </Show>
        <For each={u().statuses}>
          {(st) => (
            <span class="chip status" title={t(`about.${st.id}`)}>
              {t(`status.${st.id}`)}
              <Show when={st.rounds < 99}> {st.rounds}</Show>
            </span>
          )}
        </For>
      </div>
      <div class="stats">
        {stat(t("ui.aim"), signed(u().aim))}
        {stat(t("ui.defense"), u().defense)}
        {stat(t("ui.mobility"), u().mobility)}
        {stat(t("ui.vision"), u().vision)}
        {stat(t("ui.will"), signed(u().will))}
      </div>
      {props.children}
    </section>
  )
}
