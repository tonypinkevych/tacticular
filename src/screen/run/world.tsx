import { createSignal, For, Show } from "solid-js"
import { type Campaign, CONTACT_COST, GOALS, type Note, type Op } from "../../campaign/campaign"
import { place, type RegionId } from "../../campaign/world"
import { t } from "../../i18n/strings"
import { ALIEN, AMBER, BEACON, css, DASH, EVAC, SMOKE, SQUAD } from "../board/color"
import { ICONS } from "../board/glyphs"
import type { Expedition } from "../expedition"
import { Icon } from "../hud/icon"
import { SPEEDS } from "../playback/motion"
import { Earth } from "./earth"
import { Operation } from "./operation"
import { Pips } from "./pips"
import { Profile } from "./profile"
import { Research } from "./research"
import { Soldier } from "./soldier"
import { Stat } from "./stat"
import { Tip } from "./tip"

/** One line of the week's report in the active language, its region, operation, event and tech by name. */
export function say(n: Note): string {
  const p: Record<string, string | number> = { ...n.params }
  if (p.region !== undefined) p.region = t(`region.${p.region}`)
  if (p.op !== undefined) p.op = t(`op.${p.op}`)
  if (p.event !== undefined) p.event = t(`event.${p.event}`)
  if (p.tech !== undefined) p.tech = t(`tech.${p.tech}`)
  return t(n.key, p)
}

/** The world map of a campaign: resources, the alien clock, regions, operations, soldiers and research. */
export function World(props: { expedition: Expedition }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const [chosen, setChosen] = createSignal<RegionId | null>(null)
  const [op, setOp] = createSignal<number | null>(null)
  const [soldier, setSoldier] = createSignal<string | null>(null)
  const region = () => c().region(chosen() ?? home(c()))
  const ops = () => [...c().ops].sort((a, b) => a.expires - b.expires).map((o) => ({ ...o }))
  const picked = () => c().ops.find((o) => o.id === op()) ?? null
  const roster = () => c().roster.map((s) => ({ ...s }))
  const member = () => roster().find((s) => s.id === soldier()) ?? null
  const end = () => {
    const due = c().due()
    if (due) {
      setOp(due.id)
      document.querySelector("#world .orders")?.scrollIntoView({ block: "nearest" })
    } else x.choose({ type: "week" })
  }
  const [menu, setMenu] = createSignal(false)
  const [help, setHelp] = createSignal(false)
  return (
    <Show when={x.lang()} keyed>
      <section class="run" id="world">
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
          <button type="button" class="primary" onClick={end}>
            {t("world.endWeek")}
          </button>
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
        <div class="map">
          <Earth campaign={c()} chosen={region().id} onPick={setChosen} />
        </div>
        <div class="columns">
          <div class="column">
            <div class="card">
              <h3>{t(`region.${region().id}`)}</h3>
              <p class="small">
                {region().free
                  ? t("world.free")
                  : `${t("world.strength", { value: region().strength })} · ${t("world.vigilance", { value: region().vigilance })} · ${t("world.resistance", { value: region().resistance })}`}
              </p>
              <p class="small muted">{t("world.bonus", { bonus: t(`bonus.${place(region().id).bonus}`) })}</p>
              <Show when={!region().free && region().resistance > 0}>
                <p class="small muted">{t("world.liberate")}</p>
              </Show>
              <Show
                when={c()
                  .reachable()
                  .some((r) => r.id === region().id)}
              >
                <button
                  type="button"
                  disabled={c().intel < CONTACT_COST}
                  onClick={() => x.choose({ type: "contact", region: region().id })}
                >
                  {t("world.contact", { cost: CONTACT_COST })}
                </button>
              </Show>
            </div>
            <h3>{t("world.ops")}</h3>
            <Show when={ops().length > 0} fallback={<p class="small muted">{t("world.noOps")}</p>}>
              <For each={ops()}>
                {(o) => (
                  <Card op={o} campaign={c()} on={op() === o.id} onClick={() => setOp(o.id === op() ? null : o.id)} />
                )}
              </For>
            </Show>
            <Show when={picked()} keyed>
              {(o) => <Operation expedition={x} op={o} onDone={() => setOp(null)} />}
            </Show>
          </div>
          <div class="column">
            <h3>{t("world.soldiers")}</h3>
            <div class="soldiers narrow">
              <For each={roster()}>
                {(s) => (
                  <Soldier
                    soldier={s}
                    on={soldier() === s.id}
                    onClick={() => setSoldier(s.id === soldier() ? null : s.id)}
                  >
                    <Show when={c().away(s.id) || s.rest > 0}>
                      <span class="tag small muted">{c().away(s.id) ? t("soldier.away") : t("soldier.rest")}</span>
                    </Show>
                  </Soldier>
                )}
              </For>
            </div>
            <Show when={member()} keyed>
              {(s) => <Profile expedition={x} soldier={s} />}
            </Show>
            <Research expedition={x} />
            <h3>{t("world.report")}</h3>
            <Show when={c().report.length > 0} fallback={<p class="small muted">{t("world.quiet")}</p>}>
              <ul class="report small">
                <For each={c().report}>{(n) => <li>{say(n)}</li>}</For>
              </ul>
            </Show>
          </div>
        </div>
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

/** An operation in the list: its kind, region, reward and when it expires or launches. */
function Card(props: { op: Op; campaign: Campaign; on: boolean; onClick: () => void }) {
  const o = () => props.op
  const names = () => o().squad.map((id) => props.campaign.roster.find((s) => s.id === id)?.name ?? id)
  return (
    <button type="button" class="card reward op" classList={{ on: props.on, [o().kind]: true }} onClick={props.onClick}>
      <span class="name">
        {t(`op.${o().kind}`)} · {t(`region.${o().region}`)}
      </span>
      <span class="small">{t(`op.info.${o().kind}`)}</span>
      <Show when={o().event}>
        <span class="small">{t("op.counter")}</span>
      </Show>
      <span class="small muted">{t("world.expires", { week: o().expires })}</span>
      <Show when={o().sent !== null}>
        <span class="small">
          {props.campaign.launchable(o()) ? t("world.ready") : t("world.notReady", { week: o().sent! })} ·{" "}
          {names().join(", ")}
        </span>
      </Show>
    </button>
  )
}

function home(c: Campaign): RegionId {
  return (c.regions.find((r) => r.resistance > 0 && !r.free) ?? c.regions[0]).id
}
