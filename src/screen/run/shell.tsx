import { Match, Switch } from "solid-js"
import type { Expedition } from "../expedition"
import { App } from "../hud/hud"
import { Draft } from "./draft"
import { End } from "./end"
import { Rewards } from "./rewards"
import { Route } from "./route"

/** The whole game: the screen of the run's stage, or the mission in play. */
export function Shell(props: { expedition: Expedition }) {
  const x = props.expedition
  const stage = () => x.run().stage
  return (
    <Switch>
      <Match when={stage() === "draft"}>
        <Draft expedition={x} />
      </Match>
      <Match when={stage() === "chart"}>
        <Route expedition={x} />
      </Match>
      <Match when={stage() === "mission" && x.version() >= 0 && x.model} keyed>
        {(m) => <App model={m} />}
      </Match>
      <Match when={stage() === "reward"}>
        <Rewards expedition={x} />
      </Match>
      <Match when={stage() === "won" || stage() === "lost"}>
        <End expedition={x} />
      </Match>
    </Switch>
  )
}
