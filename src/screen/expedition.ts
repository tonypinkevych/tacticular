import { type Accessor, createSignal, type Setter } from "solid-js"
import type { Campaign, Choice, Goal } from "../campaign/campaign"
import type { Chronicle } from "../save/chronicle"
import { Model } from "./model"

/** The campaign as the screen shows it: the saved chronicle, a version that changes with each choice, and the mission model. */
export class Expedition {
  readonly version: Accessor<number>
  model: Model | null = null
  private readonly bump: Setter<number>

  constructor(
    readonly chronicle: Chronicle,
    private readonly store: Storage,
  ) {
    ;[this.version, this.bump] = createSignal(0)
  }

  /** The expedition with a model for the mission in play, if any. */
  static open(chronicle: Chronicle, store: Storage): Expedition {
    const x = new Expedition(chronicle, store)
    x.mount()
    return x
  }

  /** The campaign, or null before a goal is picked; reading it tracks the version. */
  campaign(): Campaign | null {
    this.version()
    return this.chronicle.campaign
  }

  /** Starts a campaign with a random seed and the goal picked. */
  begin(goal: Goal): void {
    this.chronicle.begin(Math.floor(Math.random() * 2 ** 31), goal)
    this.mount()
  }

  choose(choice: Choice): void {
    this.chronicle.choose(choice)
    this.mount()
  }

  /** Ends the mission in play and goes back to the world map. */
  finish(): void {
    this.chronicle.finish()
    this.mount()
  }

  /** Gives up the campaign and goes back to the goal pick. */
  restart(): void {
    this.chronicle.abandon()
    this.mount()
  }

  private mount(): void {
    const session = this.chronicle.session
    this.model = session ? Model.open(session, this.store, this) : null
    this.bump((v) => v + 1)
  }
}
