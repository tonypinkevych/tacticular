import { detect, use } from "./i18n/strings";
import { Session } from "./save/session";
import { Screen } from "./view/screen";

const store = window.localStorage;
use(detect(store, navigator.languages ?? [navigator.language]));
document.documentElement.lang = detect(store, navigator.languages ?? [navigator.language]);
const session = Session.open(store, () => Math.floor(Math.random() * 2 ** 31));
new Screen(session, document.getElementById("board") as HTMLCanvasElement, document.getElementById("panel")!, store);
