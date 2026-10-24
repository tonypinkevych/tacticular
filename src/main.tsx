import { createSignal, Show } from "solid-js"
import { render } from "solid-js/web"
import { Locale, locale } from "./i18n/strings"
import { mission } from "./mission/mission"
import { Battle } from "./screen/battle"
import { Hud } from "./screen/hud/hud"
import type { ClassId } from "./units/profiles"

const store = window.localStorage
const lang = Locale.detect(store, navigator.languages ?? [navigator.language])
locale.use(lang)
document.documentElement.lang = lang

const CLASSES: ClassId[] = ["vanguard", "ranger", "warden", "cleric"]
const GOALS = ["kill", "evac", "defend"] as const

function battle(): Battle {
  const seed = Math.floor(Math.random() * 1e9)
  const skip = seed % 4
  const b = new Battle(
    mission(seed, {
      goal: GOALS[seed % 3],
      squad: CLASSES.filter((_, i) => i !== skip).map((kind, i) => ({ id: `s${i}`, kind })),
    }),
  )
  b.begin(performance.now() / 1000)
  return b
}

function App() {
  const [current, setCurrent] = createSignal(battle())
  addEventListener("keydown", (e) => {
    const b = current()
    if (e.key === "Tab") {
      e.preventDefault()
      b.cycle(e.shiftKey)
    } else if (e.key === "Enter") void b.endTurn()
    else if (e.key === "3") b.toggleSkill()
    else if (e.key === "4") b.overwatch()
    else if (e.key === "Escape") b.disarm()
  })
  return (
    <Show keyed when={current()}>
      {(b) => <Hud battle={b} onNext={() => setCurrent(battle())} />}
    </Show>
  )
}

render(() => <App />, document.getElementById("root") as HTMLElement)
