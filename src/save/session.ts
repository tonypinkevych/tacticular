import type { Event } from "nostr-tools/pure"
import type { Game } from "../mission/game"
import { type Frame, Match } from "../mission/match"
import { mission } from "../mission/mission"
import type { Action } from "../mission/orders"
import { history, Journal } from "./journal"

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

const SAVE = "tacticular.save"

/** A mission in play: the game, its signed log and its saved copy in storage. */
export class Session {
  private readonly journal: Journal
  events: Event[] = []
  games: Game[] = []
  actions: Action[] = []

  constructor(private readonly store: Store) {
    this.journal = Journal.open(store)
  }

  /** The player's public key in hex. */
  get author(): string {
    return this.journal.author()
  }

  get game(): Game {
    return this.games[this.games.length - 1]
  }

  /** Loads the saved mission, or starts a new one when there is none or it does not verify. */
  static open(store: Store, seed: () => number): Session {
    const s = new Session(store)
    try {
      const events = JSON.parse(store.getItem(SAVE) ?? "null") as Event[] | null
      if (events) {
        s.replay(events)
        return s
      }
    } catch {
      store.removeItem(SAVE)
    }
    s.start(seed())
    return s
  }

  start(seed: number): void {
    this.events = [this.journal.begin(seed)]
    this.games = [mission(seed)]
    this.actions = []
    this.save()
  }

  replay(events: Event[]): void {
    const { seed, actions } = history(events)
    this.events = events
    this.actions = []
    this.games = [mission(seed)]
    for (const a of actions) {
      this.games.push(new Match(this.game).play(a).at(-1)!.game)
      this.actions.push(a)
    }
  }

  /** Plays an action; on success it is signed, logged and saved, and its steps are returned. */
  act(action: Action): Frame[] {
    const steps = new Match(this.game).play(action)
    this.events.push(this.journal.record(this.events[0], this.actions.length, action))
    this.actions.push(action)
    this.games.push(steps[steps.length - 1].game)
    this.save()
    return steps
  }

  /** A move can be undone when it revealed no tile and caused no roll or event. */
  canUndo(): boolean {
    const last = this.actions[this.actions.length - 1]
    if (last?.type !== "move" || this.games.length < 2) return false
    const before = this.games[this.games.length - 2]
    const after = this.game
    const seen = (g: Game) => g.explored.filter(Boolean).length
    return before.rng === after.rng && before.log.length === after.log.length && seen(before) === seen(after)
  }

  undo(): void {
    if (!this.canUndo()) return
    this.games.pop()
    this.actions.pop()
    this.events.pop()
    this.save()
  }

  private save(): void {
    this.store.setItem(SAVE, JSON.stringify(this.events))
  }
}
