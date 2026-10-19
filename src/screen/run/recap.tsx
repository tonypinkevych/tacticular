import { createSignal, onCleanup, Show } from "solid-js"
import type { Note } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import { css, type Rgb } from "../board/color"
import { ICONS } from "../board/glyphs"
import { Icon } from "../hud/icon"
import type { Cue } from "../playback/cues"
import type { Speed } from "../playback/motion"
import type { Beat } from "./beat"
import { BLUE, OCHRE, RED } from "./ink"

/** One line of the week's report in the active language, its regions, operation, event, tech and penalty by name. */
export function say(n: Note): string {
  const p: Record<string, string | number> = { ...n.params }
  if (p.region !== undefined) p.region = t(`region.${p.region}`)
  if (p.from !== undefined) p.from = t(`region.${p.from}`)
  if (p.op !== undefined) p.op = t(`op.${p.op}`)
  if (p.event !== undefined) p.event = t(`event.${p.event}`)
  if (p.tech !== undefined) p.tech = t(`tech.${p.tech}`)
  if (p.penalty !== undefined) p.penalty = t(`cost.${p.penalty}`)
  return t(n.key, p)
}

/**
 * The playback of a week or a mission: a banner with its title, then each beat in turn at the playback speed. A click
 * ends it; at instant speed only the banner shows, briefly.
 */
export function Recap(props: {
  title: string
  beats: Beat[]
  speed: Speed
  play: (cue: Cue) => void
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
    props.play(cue(props.beats[at()].icon))
    timer = setTimeout(next, 2000 / props.speed)
  }
  props.play("week")
  let timer = setTimeout(next, props.speed === 0 ? 800 : 2200 / props.speed)
  onCleanup(() => clearTimeout(timer))
  return (
    <button type="button" class="recap" onClick={done}>
      <Show
        when={at() >= 0}
        fallback={
          <span class="banner">
            <Icon glyph={ICONS["world:week"]} color={css(OCHRE)} class="icon" />
            {props.title}
            <Icon glyph={ICONS["world:week"]} color={css(OCHRE)} class="icon" />
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

const THREATS = ["world:force", "world:project", "world:strength", "world:event", "world:resistance"]

/** Amber for an operation, red for the aliens, blue for the rest. */
function tone(icon: string): Rgb {
  if (icon.startsWith("op:")) return OCHRE
  return THREATS.includes(icon) ? RED : BLUE
}

/** A chime for an operation, a low drone for the aliens, a coin for the rest. */
function cue(icon: string): Cue {
  if (icon.startsWith("op:")) return "spotted"
  return THREATS.includes(icon) ? "threat" : "gain"
}
