import { createSignal } from "solid-js"
import { t } from "../../i18n/strings"

/** A button that starts a new run on a second click within a few seconds of the first. */
export function Restart(props: { onRestart: () => void }) {
  const [armed, setArmed] = createSignal(false)
  const click = () => {
    if (armed()) {
      props.onRestart()
      return
    }
    setArmed(true)
    setTimeout(() => setArmed(false), 3000)
  }
  return (
    <button type="button" class="restart" classList={{ armed: armed() }} onClick={click}>
      {t(armed() ? "ui.run.sure" : "ui.run.restart")}
    </button>
  )
}
