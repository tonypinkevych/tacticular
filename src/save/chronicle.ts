import type { Event } from "nostr-tools/pure"
import { Campaign, type Choice, type Goal, outcome } from "../campaign/campaign"
import { CAMPAIGN, history, Journal } from "./journal"
import { Session } from "./session"

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

const KEY = "tacticular.field"

/** Keys of saves the game no longer reads. */
const OLD = ["tacticular.run", "tacticular.campaign", "tacticular.week", "tacticular.squad"]

/** The saved campaign: its signed log of choices, and the mission in play with its own log. */
export class Chronicle {
  private readonly journal: Journal
  events: Event[] = []
  campaign: Campaign | null = null
  session: Session | null = null

  constructor(private readonly store: Store) {
    this.journal = Journal.open(store)
  }

  /** Loads the saved campaign; with none, or one that does not verify, there is no campaign yet. */
  static open(store: Store): Chronicle {
    const c = new Chronicle(store)
    for (const k of OLD) store.removeItem(k)
    try {
      const events = JSON.parse(store.getItem(KEY) ?? "null") as Event[] | null
      if (events) c.replay(events)
    } catch {
      store.removeItem(KEY)
      c.campaign = null
    }
    return c
  }

  /** Starts a new campaign from a seed and a goal. */
  begin(seed: number, goal: Goal): void {
    this.events = [this.journal.begin(seed, { goal }, CAMPAIGN)]
    this.campaign = Campaign.start(seed, goal)
    this.session = null
    this.save()
  }

  /** Drops the campaign, so a new one can begin. */
  abandon(): void {
    this.store.removeItem(KEY)
    this.events = []
    this.campaign = null
    this.session = null
  }

  /** Plays a choice, signs, logs and saves it; a choice that leads into a mission starts that mission. */
  choose(choice: Choice): void {
    if (!this.campaign) return
    this.campaign.play(choice)
    this.events.push(this.journal.record(this.events[0], this.events.length - 1, choice))
    this.session = null
    if (this.campaign.stage === "mission") {
      this.session = new Session(this.store)
      this.session.start(this.campaign.mission(), this.campaign.conditions())
    }
    this.save()
  }

  /** Ends the mission in play with the result its last game shows. */
  finish(): void {
    if (this.session) this.choose({ type: "finish", result: outcome(this.session.game) })
  }

  private replay(events: Event[]): void {
    const { seed, conditions, actions } = history<Choice, { goal: Goal }>(events, CAMPAIGN)
    const campaign = Campaign.start(seed, conditions.goal)
    for (const choice of actions) campaign.play(choice)
    this.campaign = campaign
    this.events = events
    if (campaign.stage !== "mission") return
    const next = campaign.mission()
    this.session = Session.open(this.store, () => next, campaign.conditions())
    if (this.session.game.seed !== next) this.session.start(next, campaign.conditions())
  }

  private save(): void {
    this.store.setItem(KEY, JSON.stringify(this.events))
  }
}
