import { type JSX, onCleanup } from "solid-js"
import { t } from "../../i18n/strings"

/** A box over the map with a title; Escape, the close button or a click outside it closes it. */
export function Popup(props: { title: JSX.Element; onClose: () => void; children: JSX.Element }) {
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") props.onClose()
  }
  window.addEventListener("keydown", key)
  onCleanup(() => window.removeEventListener("keydown", key))
  return (
    <>
      <button type="button" class="veil" aria-label={t("ui.close")} onClick={() => props.onClose()} />
      <div class="popup card" role="dialog">
        <header>
          <h3>{props.title}</h3>
          <button type="button" class="close" data-tip={t("ui.close")} onClick={() => props.onClose()}>
            ×
          </button>
        </header>
        {props.children}
      </div>
    </>
  )
}
