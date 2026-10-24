import { createSignal, Match, Switch } from "solid-js"
import { t } from "../../i18n/strings"
import type { Chronicle } from "../../save/chronicle"
import { Battle } from "../battle"
import { Hud } from "../hud/hud"
import { ChartView } from "./chart"
import { Draft } from "./draft"
import { RewardView } from "./reward"

/** The run on screen: the stage it stands at, each choice saved through the chronicle. */
export function Shell(props: { chronicle: Chronicle }) {
  const c = props.chronicle
  const [version, bump] = createSignal(0)
  const run = () => {
    version()
    return c.run
  }
  let battle: Battle | null = null
  const fight = () => {
    version()
    if (!battle && c.game) {
      battle = new Battle(c.game, (action, after) => c.record(action, after))
      battle.begin(performance.now() / 1000)
      shell.battle = battle
    }
    return battle as Battle
  }
  const step = (f: () => void) => {
    f()
    battle = null
    shell.battle = null
    bump((v) => v + 1)
  }
  return (
    <Switch>
      <Match when={run().stage === "draft"}>
        <Draft candidates={run().candidates} onPick={(picks) => step(() => c.choose({ type: "draft", picks }))} />
      </Match>
      <Match when={run().stage === "chart"}>
        <ChartView run={run()} onGo={(node, deploy) => step(() => c.choose({ type: "go", node, deploy }))} />
      </Match>
      <Match when={run().stage === "mission" && fight()}>
        <Hud battle={fight()} onNext={() => step(() => c.finish())} />
      </Match>
      <Match when={run().stage === "reward"}>
        <RewardView run={run()} onTake={(pick) => step(() => c.choose({ type: "take", pick }))} />
      </Match>
      <Match when={run().stage === "won" || run().stage === "lost"}>
        <section class="screen">
          <h1>{t(`ui.run.${run().stage}`)}</h1>
          <button type="button" class="go" onClick={() => step(() => c.begin(Math.floor(Math.random() * 2 ** 31)))}>
            {t("ui.run.new")}
          </button>
        </section>
      </Match>
    </Switch>
  )
}

/** The battle the keyboard drives, if a mission is on screen. */
export const shell: { battle: Battle | null } = { battle: null }
