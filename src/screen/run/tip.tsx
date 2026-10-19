import { createSignal, onCleanup, Show } from "solid-js"

/** The details of the element under the pointer, in a box beside it; an element names them in `data-tip` and `data-info`. */
export function Tip() {
  const [at, setAt] = createSignal<{ x: number; y: number; tip: string; info: string } | null>(null)
  const move = (e: MouseEvent) => {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tip]") : null
    setAt(el?.dataset.tip ? { x: e.clientX, y: e.clientY, tip: el.dataset.tip, info: el.dataset.info ?? "" } : null)
  }
  window.addEventListener("mousemove", move)
  onCleanup(() => window.removeEventListener("mousemove", move))
  return (
    <Show when={at()}>
      {(a) => (
        <div
          id="hover"
          style={{
            left: `${Math.min(a().x + 14, window.innerWidth - 280)}px`,
            top: `${a().y > window.innerHeight - 120 ? a().y - 90 : a().y + 18}px`,
          }}
        >
          <b>{a().tip}</b>
          <Show when={a().info}>
            <span>{a().info}</span>
          </Show>
        </div>
      )}
    </Show>
  )
}
