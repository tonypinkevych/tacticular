import { For } from "solid-js"

/** A row of `of` pips, the first `on` of them lit in the tone's color. */
export function Pips(props: { on: number; of: number; tone: "bad" | "good" }) {
  return (
    <span class={`pips ${props.tone}`}>
      <For each={Array.from({ length: props.of }, (_, i) => i < props.on)}>
        {(lit) => <i classList={{ on: lit }} />}
      </For>
    </span>
  )
}
