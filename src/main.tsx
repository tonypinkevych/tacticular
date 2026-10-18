import { render } from "solid-js/web"
import { Locale, locale } from "./i18n/strings"
import { Session } from "./save/session"
import { App } from "./screen/hud/hud"
import { Model } from "./screen/model"

const store = window.localStorage
const lang = Locale.detect(store, navigator.languages ?? [navigator.language])
locale.use(lang)
document.documentElement.lang = lang
const session = Session.open(store, () => Math.floor(Math.random() * 2 ** 31))
render(() => <App model={Model.open(session, store)} />, document.getElementById("root")!)
