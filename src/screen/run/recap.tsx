import { createSignal, onCleanup, Show } from "solid-js"
import type { Note } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import { ALIEN, AMBER, BEACON, css, DASH, type Rgb } from "../board/color"
import { ICONS } from "../board/glyphs"
import { Icon } from "../hud/icon"
import type { Speed } from "../playback/motion"
import type { Beat } from "./beat"

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
 * The playback of a week: a banner with its number, then each beat in turn at the playback speed. A click ends it;
 * at instant speed only the banner shows, briefly.
 */
export function Recap(props: {
  week: number
  beats: Beat[]
  speed: Speed
  onBeat: (b: Beat | null) => void
  onDone: () => void
}) {
  const [at, setAt] = createSignal(-1)
  const last = props.speed === 0 ? -1 : props.beats.length - 1
  const done = () => {
    props.onBeat(null)
    props.onDone()
  }
  const next = () => {
    if (at() >= last) return done()
    setAt(at() + 1)
    props.onBeat(props.beats[at()])
    timer = setTimeout(next, 1100 / props.speed)
  }
  let timer = setTimeout(next, props.speed === 0 ? 600 : 1400 / props.speed)
  onCleanup(() => clearTimeout(timer))
  return (
    <button type="button" class="recap" onClick={done}>
      <Show
        when={at() >= 0}
        fallback={
          <span class="banner">
            <Icon glyph={ICONS["world:week"]} color={css(DASH)} class="icon" />
            {t("world.week", { week: props.week })}
            <Icon glyph={ICONS["world:week"]} color={css(DASH)} class="icon" />
          </span>
        }
      >
        <span class="beat">
          <Icon glyph={ICONS[props.beats[at()].icon]} color={css(tone(props.beats[at()].icon))} class="icon" />
          {say(props.beats[at()].note)}
        </span>
      </Show>
      <span class="small muted">{t("recap.skip")}</span>
    </button>
  )
}

/** Amber for an operation, red for the aliens, blue for the rest. */
function tone(icon: string): Rgb {
  if (icon.startsWith("op:")) return AMBER
  return ["world:force", "world:project", "world:strength", "world:event"].includes(icon) ? ALIEN : BEACON
}
