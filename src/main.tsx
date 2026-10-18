import { render } from "solid-js/web"
import { Locale, locale } from "./i18n/strings"
import { Campaign } from "./save/campaign"
import { Expedition } from "./screen/expedition"
import { Shell } from "./screen/run/shell"

const store = window.localStorage
const lang = Locale.detect(store, navigator.languages ?? [navigator.language])
locale.use(lang)
document.documentElement.lang = lang
const campaign = Campaign.open(store, () => Math.floor(Math.random() * 2 ** 31))
render(() => <Shell expedition={Expedition.open(campaign, store)} />, document.getElementById("root")!)
