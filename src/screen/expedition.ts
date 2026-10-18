import { type Accessor, createSignal, type Setter } from "solid-js"
import type { Choice, Run } from "../run/run"
import type { Campaign } from "../save/campaign"
import { Model } from "./model"

/** The run as the screen shows it: the saved campaign, a version that changes with each choice, and the mission model. */
export class Expedition {
  readonly version: Accessor<number>
  model: Model | null = null
  private readonly bump: Setter<number>

  constructor(
    readonly campaign: Campaign,
    private readonly store: Storage,
  ) {
    ;[this.version, this.bump] = createSignal(0)
  }

  /** The expedition with a model for the mission in play, if any. */
  static open(campaign: Campaign, store: Storage): Expedition {
    const x = new Expedition(campaign, store)
    x.mount()
    return x
  }

  /** The run; reading it tracks the version. */
  run(): Run {
    this.version()
    return this.campaign.run
  }

  choose(choice: Choice): void {
    this.campaign.choose(choice)
    this.mount()
  }

  /** Ends the mission in play and goes back to the run. */
  finish(): void {
    this.campaign.finish()
    this.mount()
  }

  /** Gives up the run and starts a new one. */
  restart(): void {
    this.campaign.begin(Math.floor(Math.random() * 2 ** 31))
    this.mount()
  }

  private mount(): void {
    const session = this.campaign.session
    this.model = session ? Model.open(session, this.store, this) : null
    this.bump((v) => v + 1)
  }
}
