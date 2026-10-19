import { createSignal, For, Show } from "solid-js"
import { type Campaign, GOALS, type Note, RECRUIT_COST, ROSTER } from "../../campaign/campaign"
import { level } from "../../campaign/soldier"
import type { RegionId } from "../../campaign/world"
import { t } from "../../i18n/strings"
import { ALIEN, AMBER, BEACON, css, DASH, EVAC, SMOKE, SQUAD } from "../board/color"
import { ICONS } from "../board/glyphs"
import type { Expedition } from "../expedition"
import { Icon } from "../hud/icon"
import { SPEEDS } from "../playback/motion"
import { Brief } from "./brief"
import { Earth } from "./earth"
import { Operation } from "./operation"
import { Pips } from "./pips"
import { Popup } from "./popup"
import { Profile } from "./profile"
import { Region } from "./region"
import { Research } from "./research"
import { Soldier } from "./soldier"
import { Stat } from "./stat"
import { Tip } from "./tip"

/** The popup open over the map, if any. */
type Pane = { kind: "op"; id: number } | { kind: "soldier"; id: string } | { kind: "research" } | { kind: "log" } | null

/** One line of the week's report in the active language, its region, operation, event and tech by name. */
export function say(n: Note): string {
  const p: Record<string, string | number> = { ...n.params }
  if (p.region !== undefined) p.region = t(`region.${p.region}`)
  if (p.op !== undefined) p.op = t(`op.${p.op}`)
  if (p.event !== undefined) p.event = t(`event.${p.event}`)
  if (p.tech !== undefined) p.tech = t(`tech.${p.tech}`)
  return t(n.key, p)
}

/**
 * The world map of a campaign: resources and the alien clock on top, the Earth with the picked region and the
 * operations beside it, the roster and the week's actions below, and details in popups.
 */
export function World(props: { expedition: Expedition }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const [chosen, setChosen] = createSignal<RegionId | null>(null)
  const [pane, setPane] = createSignal<Pane>(null)
  const close = () => setPane(null)
  const region = () => chosen() ?? home(c())
  const ops = () =>
    [...c().ops]
      .sort((a, b) => Number(b.region === region()) - Number(a.region === region()) || a.expires - b.expires)
      .map((o) => ({ ...o }))
  const roster = () => c().roster.map((s) => ({ ...s }))
  const open = () => {
    const p = pane()
    return p?.kind === "op" ? (ops().find((o) => o.id === p.id) ?? null) : null
  }
  const member = () => {
    const p = pane()
    return p?.kind === "soldier" ? (roster().find((s) => s.id === p.id) ?? null) : null
  }
  const end = () => {
    const due = c().due()
    if (due) setPane({ kind: "op", id: due.id })
    else x.choose({ type: "week" })
  }
  const [menu, setMenu] = createSignal(false)
  const [help, setHelp] = createSignal(false)
  return (
    <Show when={x.lang()} keyed>
      <section id="world">
        <header class="bar">
          <Stat icon="world:week" color={DASH} tip={t("world.week", { week: c().week })} info={t("world.weekInfo")}>
            {c().week}
          </Stat>
          <Stat icon="world:supplies" color={AMBER} tip={t("world.supplies")} info={t("world.suppliesInfo")}>
            {c().supplies}
          </Stat>
          <Stat icon="world:intel" color={BEACON} tip={t("world.intel")} info={t("world.intelInfo")}>
            {c().intel}
          </Stat>
          <Stat icon="world:materials" color={SMOKE} tip={t("world.materials")} info={t("world.materialsInfo")}>
            {c().materials}
          </Stat>
          <Stat
            icon="world:freed"
            color={EVAC}
            tip={t("world.goal", { freed: c().freed(), goal: c().goal })}
            info={t("world.goalInfo")}
          >
            {c().freed()}/{c().goal}
          </Stat>
          <span class="spacer" />
          <Stat
            icon="world:force"
            color={ALIEN}
            tip={t("world.force", { force: c().force })}
            info={t("world.forceInfo")}
          >
            <Pips on={c().force} of={10} tone="bad" />
          </Stat>
          <Stat
            icon="world:project"
            color={ALIEN}
            tip={t("world.project", { project: c().project, end: GOALS[c().goal].end })}
            info={t("world.projectInfo")}
          >
            <span class="clock">
              <i style={{ width: `${(100 * c().project) / GOALS[c().goal].end}%` }} />
            </span>
            {c().project}/{GOALS[c().goal].end}
          </Stat>
          <Show when={c().event}>
            {(e) => (
              <Stat
                icon="world:event"
                color={ALIEN}
                tip={t(`event.${e().id}`)}
                info={t("world.eventInfo", { info: t(`event.info.${e().id}`), week: e().until })}
              >
                {e().until}
              </Stat>
            )}
          </Show>
          <button type="button" classList={{ active: menu() }} data-tip={t("ui.menu")} onClick={() => setMenu(!menu())}>
            <Icon glyph={ICONS["world:menu"]} color={css(SQUAD)} class="icon" />
          </button>
          <Show when={menu()}>
            <Menu expedition={x} help={help()} onHelp={() => setHelp(!help())} />
          </Show>
        </header>
        <Show when={help()}>
          <div id="help" class="card">
            <For each={t("world.helpText").split(" · ")}>{(line) => <div>{line}</div>}</For>
          </div>
        </Show>
        <div class="middle">
          <div class="map">
            <Earth campaign={c()} chosen={region()} onPick={setChosen} />
          </div>
          <aside class="side">
            <Region expedition={x} id={region()} />
            <Show when={ops().length > 0} fallback={<p class="small muted">{t("world.noOps")}</p>}>
              <For each={ops()}>
                {(o) => (
                  <Brief
                    op={o}
                    campaign={c()}
                    on={o.region === region()}
                    onClick={() => {
                      setChosen(o.region)
                      setPane({ kind: "op", id: o.id })
                    }}
                  />
                )}
              </For>
            </Show>
          </aside>
        </div>
        <footer class="bar">
          <div class="roster">
            <For each={roster()}>
              {(s) => (
                <Soldier
                  soldier={s}
                  state={c().away(s.id) ? "away" : s.rest > 0 ? "rest" : undefined}
                  onClick={() => setPane({ kind: "soldier", id: s.id })}
                />
              )}
            </For>
          </div>
          <span class="spacer" />
          <button
            type="button"
            class="big"
            data-tip={t("world.research")}
            data-info={
              c().research
                ? t("world.researching", { tech: t(`tech.${c().research!.tech}`), week: c().research!.ready })
                : ""
            }
            onClick={() => setPane({ kind: "research" })}
          >
            <Icon glyph={ICONS["world:research"]} color={css(BEACON)} class="icon" />
            <Show when={!c().research}>
              <span class="badge">!</span>
            </Show>
          </button>
          <button
            type="button"
            class="big"
            disabled={c().supplies < RECRUIT_COST || c().roster.length >= ROSTER}
            data-tip={t("world.recruit", { cost: RECRUIT_COST })}
            onClick={() => x.choose({ type: "recruit" })}
          >
            <Icon glyph={ICONS["world:recruit"]} color={css(SQUAD)} class="icon" />
            <Icon glyph={ICONS["world:supplies"]} color={css(AMBER)} class="icon" />
            {RECRUIT_COST}
          </button>
          <button type="button" class="big" data-tip={t("world.report")} onClick={() => setPane({ kind: "log" })}>
            <Icon glyph={ICONS["world:log"]} color={css(SQUAD)} class="icon" />
          </button>
          <button type="button" class="big primary" data-tip={c().due() ? t("world.due") : ""} onClick={end}>
            <Icon glyph={ICONS["world:week"]} color={css(DASH)} class="icon" />
            {t("world.endWeek")}
          </button>
        </footer>
        <Show when={open()} keyed>
          {(o) => (
            <Popup title={`${t(`op.${o.kind}`)} · ${t(`region.${o.region}`)}`} onClose={close}>
              <p class="small muted">{t(`op.info.${o.kind}`)}</p>
              <Operation expedition={x} op={o} onDone={close} />
            </Popup>
          )}
        </Show>
        <Show when={member()} keyed>
          {(s) => (
            <Popup title={`${s.name} · ${t("soldier.level", { level: level(s) })}`} onClose={close}>
              <Profile expedition={x} soldier={s} />
            </Popup>
          )}
        </Show>
        <Show when={pane()?.kind === "research"}>
          <Popup title={t("world.research")} onClose={close}>
            <Research expedition={x} />
          </Popup>
        </Show>
        <Show when={pane()?.kind === "log"}>
          <Popup title={t("world.report")} onClose={close}>
            <Show when={c().report.length > 0} fallback={<p class="small muted">{t("world.quiet")}</p>}>
              <ul class="report small">
                <For each={c().report}>{(n) => <li>{say(n)}</li>}</For>
              </ul>
            </Show>
          </Popup>
        </Show>
        <Tip />
      </section>
    </Show>
  )
}

/** The menu of the world map: language, playback speed, sound, help, and abandoning the campaign. */
function Menu(props: { expedition: Expedition; help: boolean; onHelp: () => void }) {
  const x = props.expedition
  const [sure, setSure] = createSignal(false)
  return (
    <div id="menu">
      <div class="row">
        <For each={["en", "ru"] as const}>
          {(l) => (
            <button type="button" classList={{ active: x.lang() === l }} onClick={() => x.setLanguage(l)}>
              {l.toUpperCase()}
            </button>
          )}
        </For>
      </div>
      <div class="row" title={t("ui.speed")}>
        <For each={SPEEDS}>
          {(sp) => (
            <button type="button" classList={{ active: x.speed() === sp }} onClick={() => x.setSpeed(sp)}>
              {sp === 0 ? t("ui.instant") : `${sp}×`}
            </button>
          )}
        </For>
      </div>
      <button type="button" onClick={() => x.toggleSound()}>
        {x.muted() ? t("ui.soundOff") : t("ui.soundOn")}
      </button>
      <button type="button" classList={{ active: props.help }} onClick={() => props.onHelp()}>
        {t("world.help")}
      </button>
      <button type="button" onClick={() => (sure() ? x.restart() : setSure(true))}>
        {sure() ? t("ui.confirm") : t("world.abandon")}
      </button>
    </div>
  )
}

function home(c: Campaign): RegionId {
  return (c.regions.find((r) => r.resistance > 0 && !r.free) ?? c.regions[0]).id
}
