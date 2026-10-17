import { render } from "solid-js/web"
import { detect, use } from "./i18n/strings"
import { Session } from "./save/session"
import { App } from "./view/hud"
import { createModel } from "./view/model"

const store = window.localStorage
const lang = detect(store, navigator.languages ?? [navigator.language])
use(lang)
document.documentElement.lang = lang
const session = Session.open(store, () => Math.floor(Math.random() * 2 ** 31))
render(() => <App model={createModel(session, store)} />, document.getElementById("root")!)
