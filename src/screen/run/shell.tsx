import { Match, Switch } from "solid-js"
import type { Expedition } from "../expedition"
import { App } from "../hud/hud"
import { End } from "./end"
import { Goals } from "./goal"
import { World } from "./world"

/** The whole game: the goal pick, the world map, the mission in play, or the end of the campaign. */
export function Shell(props: { expedition: Expedition }) {
  const x = props.expedition
  const stage = () => x.campaign()?.stage ?? null
  return (
    <Switch>
      <Match when={stage() === null}>
        <Goals expedition={x} />
      </Match>
      <Match when={stage() === "world"}>
        <World expedition={x} />
      </Match>
      <Match when={stage() === "mission" && x.version() >= 0 && x.model} keyed>
        {(m) => <App model={m} />}
      </Match>
      <Match when={stage() === "won" || stage() === "lost"}>
        <End expedition={x} />
      </Match>
    </Switch>
  )
}
