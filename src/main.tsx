import { render } from "solid-js/web"
import { Locale, locale, t } from "./i18n/strings"

const store = window.localStorage
const lang = Locale.detect(store, navigator.languages ?? [navigator.language])
locale.use(lang)
document.documentElement.lang = lang
render(() => <p class="rebuild">{t("ui.rebuild")}</p>, document.getElementById("root")!)
