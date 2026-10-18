import type { Event } from "nostr-tools/pure"
import { type Choice, outcome, Run } from "../run/run"
import { history, Journal, RUN } from "./journal"
import { Session } from "./session"

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

const KEY = "tacticular.run"

/** The saved run: its signed log of choices, and the mission in play with its own log. */
export class Campaign {
  private readonly journal: Journal
  events: Event[] = []
  run!: Run
  session: Session | null = null

  constructor(private readonly store: Store) {
    this.journal = Journal.open(store)
  }

  /** Loads the saved run, or starts a new one when there is none or it does not verify. */
  static open(store: Store, seed: () => number): Campaign {
    const c = new Campaign(store)
    try {
      const events = JSON.parse(store.getItem(KEY) ?? "null") as Event[] | null
      if (events) {
        c.replay(events)
        return c
      }
    } catch {
      store.removeItem(KEY)
    }
    c.begin(seed())
    return c
  }

  /** Starts a new run from a seed. */
  begin(seed: number): void {
    this.events = [this.journal.begin(seed, {}, RUN)]
    this.run = Run.start(seed)
    this.session = null
    this.save()
  }

  /** Plays a choice on the run, signs, logs and saves it; going to a mission starts that mission. */
  choose(choice: Choice): void {
    this.run.play(choice)
    this.events.push(this.journal.record(this.events[0], this.events.length - 1, choice))
    this.session = null
    if (this.run.stage === "mission") {
      this.session = new Session(this.store)
      this.session.start(this.run.mission(), this.run.conditions())
    }
    this.save()
  }

  /** Ends the mission in play with the result its last game shows. */
  finish(): void {
    if (this.session) this.choose({ type: "finish", result: outcome(this.session.game) })
  }

  private replay(events: Event[]): void {
    const { seed, actions } = history<Choice>(events, RUN)
    this.run = Run.start(seed)
    for (const choice of actions) this.run.play(choice)
    this.events = events
    if (this.run.stage !== "mission") return
    const next = this.run.mission()
    this.session = Session.open(this.store, () => next, this.run.conditions())
    if (this.session.game.seed !== next) this.session.start(next, this.run.conditions())
  }

  private save(): void {
    this.store.setItem(KEY, JSON.stringify(this.events))
  }
}
