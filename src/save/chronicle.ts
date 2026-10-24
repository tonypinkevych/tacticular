import type { Event } from "nostr-tools/pure"
import type { Game } from "../mission/game"
import { mission } from "../mission/mission"
import type { Action } from "../mission/orders"
import { type Choice, outcome, Run } from "../run/run"
import { history, Journal, KIND, RUN } from "./journal"

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

const RUN_KEY = "tacticular.run.v6"
const MISSION_KEY = "tacticular.mission.v6"

/** The saved run: its signed log of choices, and the mission in play with its own signed log of actions. */
export class Chronicle {
  private readonly journal: Journal
  private events: Event[] = []
  private moves: Event[] = []
  run!: Run
  game: Game | null = null

  constructor(private readonly store: Store) {
    this.journal = Journal.open(store)
  }

  /** Loads the saved run, or starts a new one when there is none or it does not verify. */
  static open(store: Store, seed: () => number): Chronicle {
    const c = new Chronicle(store)
    try {
      const events = JSON.parse(store.getItem(RUN_KEY) ?? "null") as Event[] | null
      if (events) {
        c.replay(events, JSON.parse(store.getItem(MISSION_KEY) ?? "[]") as Event[])
        return c
      }
    } catch {
      store.removeItem(RUN_KEY)
      store.removeItem(MISSION_KEY)
    }
    c.begin(seed())
    return c
  }

  /** Starts a new run from a seed. */
  begin(seed: number): void {
    this.events = [this.journal.begin(seed, {}, RUN)]
    this.run = Run.start(seed)
    this.game = null
    this.moves = []
    this.save()
  }

  /** Plays a choice on the run, signs and saves it; going to a mission starts that mission. */
  choose(choice: Choice): void {
    this.run.play(choice)
    this.events.push(this.journal.record(this.events[0], this.events.length - 1, choice))
    this.game = null
    this.moves = []
    if (this.run.stage === "mission") this.start()
    this.save()
  }

  /** Records an action of the mission in play and the game it leads to. */
  record(action: Action, after: Game): void {
    if (!this.moves.length) return
    this.moves.push(this.journal.record(this.moves[0], this.moves.length - 1, action))
    this.game = after
    this.store.setItem(MISSION_KEY, JSON.stringify(this.moves))
  }

  /** Ends the mission in play with the result its last game shows. */
  finish(): void {
    if (this.game) this.choose({ type: "finish", result: outcome(this.game) })
  }

  private start(): void {
    const seed = this.run.mission()
    this.moves = [this.journal.begin(seed, this.run.conditions(), KIND)]
    this.game = mission(seed, this.run.conditions())
  }

  private replay(events: Event[], moves: Event[]): void {
    const { seed, actions } = history<Choice>(events, RUN)
    this.run = Run.start(seed)
    for (const choice of actions) this.run.play(choice)
    this.events = events
    if (this.run.stage !== "mission") return
    this.start()
    try {
      const log = history<Action>(moves, KIND)
      if (log.seed !== this.run.mission()) return
      let game = this.game as Game
      for (const a of log.actions) game = game.apply(a)
      this.moves = moves
      this.game = game
    } catch {
      this.store.removeItem(MISSION_KEY)
    }
  }

  private save(): void {
    this.store.setItem(RUN_KEY, JSON.stringify(this.events))
    this.store.setItem(MISSION_KEY, JSON.stringify(this.moves))
  }
}
