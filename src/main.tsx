import { render } from "solid-js/web"
import { Locale, locale } from "./i18n/strings"
import { Chronicle } from "./save/chronicle"
import { Expedition } from "./screen/expedition"
import { Shell } from "./screen/run/shell"

const store = window.localStorage
const lang = Locale.detect(store, navigator.languages ?? [navigator.language])
locale.use(lang)
document.documentElement.lang = lang
render(() => <Shell expedition={Expedition.open(Chronicle.open(store), store)} />, document.getElementById("root")!)
