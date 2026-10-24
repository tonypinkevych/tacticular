import { render } from "solid-js/web"
import { Locale, locale } from "./i18n/strings"
import { Chronicle } from "./save/chronicle"
import { Shell, shell } from "./screen/run/shell"

const store = window.localStorage
const lang = Locale.detect(store, navigator.languages ?? [navigator.language])
locale.use(lang)
document.documentElement.lang = lang

addEventListener("keydown", (e) => {
  const b = shell.battle
  if (!b) return
  if (e.key === "Tab") {
    e.preventDefault()
    b.cycle(e.shiftKey)
  } else if (e.key === "Enter") void b.endTurn()
  else if (e.key === "3") b.toggleSkill()
  else if (e.key === "4") b.overwatch()
  else if (e.key === "Escape") b.disarm()
})

const chronicle = Chronicle.open(store, () => Math.floor(Math.random() * 2 ** 31))
render(() => <Shell chronicle={chronicle} />, document.getElementById("root") as HTMLElement)
