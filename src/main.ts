import { detect, use } from "./i18n/strings";
import { Session } from "./save/session";
import { Screen } from "./view/screen";

const store = window.localStorage;
const lang = detect(store, navigator.languages ?? [navigator.language]);
use(lang);
document.documentElement.lang = lang;
const session = Session.open(store, () => Math.floor(Math.random() * 2 ** 31));
const $ = (id: string) => document.getElementById(id)!;
new Screen(session, $("board") as HTMLCanvasElement, $("panel"), $("bar"), $("tip"), store);
