import { type Accessor, createSignal, type Setter } from "solid-js"
import type { Campaign, Choice, Goal } from "../campaign/campaign"
import { type Lang, locale } from "../i18n/strings"
import type { Chronicle } from "../save/chronicle"
import { Model, SPEED_KEY, savedSpeed } from "./model"
import type { Cue } from "./playback/cues"
import type { Speed } from "./playback/motion"
import { Sound } from "./playback/sound"

/**
 * The campaign as the screen shows it: the saved chronicle, a version that changes with each choice, the mission
 * model, and the language, speed and sound the player sets on the world map.
 */
export class Expedition {
  readonly version: Accessor<number>
  readonly lang: Accessor<Lang>
  readonly speed: Accessor<Speed>
  readonly muted: Accessor<boolean>
  model: Model | null = null
  private readonly sound = new Sound()
  private readonly bump: Setter<number>
  private readonly setLang: Setter<Lang>
  private readonly setSpeedSignal: Setter<Speed>
  private readonly setMuted: Setter<boolean>

  constructor(
    readonly chronicle: Chronicle,
    private readonly store: Storage,
  ) {
    ;[this.version, this.bump] = createSignal(0)
    ;[this.lang, this.setLang] = createSignal<Lang>(locale.lang)
    ;[this.speed, this.setSpeedSignal] = createSignal<Speed>(savedSpeed(store))
    ;[this.muted, this.setMuted] = createSignal(this.sound.muted)
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

  setLanguage(l: Lang): void {
    locale.use(l)
    locale.remember(this.store)
    this.setLang(l)
  }

  setSpeed(s: Speed): void {
    this.setSpeedSignal(s)
    try {
      this.store.setItem(SPEED_KEY, String(s))
    } catch {
      return
    }
  }

  play(cue: Cue): void {
    this.sound.play(cue)
  }

  toggleSound(): void {
    this.sound.toggle()
    this.setMuted(this.sound.muted)
  }

  private mount(): void {
    const session = this.chronicle.session
    this.model = session ? Model.open(session, this.store, this) : null
    this.setLang(locale.lang)
    this.bump((v) => v + 1)
  }
}
