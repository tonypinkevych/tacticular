import type { Event } from "nostr-tools/pure";
import { mission } from "../rules/mission";
import { play } from "../play";
import type { Action, Game } from "../rules/types";
import { author, begin, read, record, secret } from "./journal";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const SAVE = "tacticular.save";

/** A mission in play: the game, its signed log and its saved copy in storage. */
export class Session {
  private readonly key: Uint8Array;
  events: Event[] = [];
  games: Game[] = [];
  actions: Action[] = [];

  constructor(private readonly store: Store) {
    this.key = secret(store);
  }

  /** The player's public key in hex. */
  get author(): string {
    return author(this.key);
  }

  get game(): Game {
    return this.games[this.games.length - 1];
  }

  /** Loads the saved mission, or starts a new one when there is none or it does not verify. */
  static open(store: Store, seed: () => number): Session {
    const s = new Session(store);
    try {
      const events = JSON.parse(store.getItem(SAVE) ?? "null") as Event[] | null;
      if (events) {
        s.replay(events);
        return s;
      }
    } catch {
      store.removeItem(SAVE);
    }
    s.start(seed());
    return s;
  }

  start(seed: number): void {
    this.events = [begin(this.key, seed)];
    this.games = [mission(seed)];
    this.actions = [];
    this.save();
  }

  replay(events: Event[]): void {
    const { seed, actions } = read(events);
    this.events = events;
    this.actions = [];
    this.games = [mission(seed)];
    for (const a of actions) {
      this.games.push(play(this.game, a));
      this.actions.push(a);
    }
  }

  /** Plays an action; on success it is signed, logged and saved. */
  act(action: Action): void {
    const next = play(this.game, action);
    this.events.push(record(this.key, this.events[0], this.actions.length, action));
    this.actions.push(action);
    this.games.push(next);
    this.save();
  }

  /** A move can be undone when it revealed no tile and caused no roll or event. */
  canUndo(): boolean {
    const last = this.actions[this.actions.length - 1];
    if (!last || last.type !== "move" || this.games.length < 2) return false;
    const before = this.games[this.games.length - 2];
    const after = this.game;
    const seen = (g: Game) => g.explored.filter(Boolean).length;
    return before.rng === after.rng && before.log.length === after.log.length && seen(before) === seen(after);
  }

  undo(): void {
    if (!this.canUndo()) return;
    this.games.pop();
    this.actions.pop();
    this.events.pop();
    this.save();
  }

  private save(): void {
    this.store.setItem(SAVE, JSON.stringify(this.events));
  }
}
