import type { Cue } from "./cues"

const KEY = "tacticular.muted"

/** Retro sounds made with Web Audio, one recipe per cue, that the player can mute. */
export class Sound {
  muted = Sound.saved()
  private ctx: AudioContext | null = null
  private out: GainNode | null = null

  play(cue: Cue): void {
    if (this.muted) return
    try {
      this.ctx ??= new AudioContext()
      if (this.ctx.state === "suspended") void this.ctx.resume()
      RECIPES[cue](new Voice(this.ctx, this.mix(this.ctx)), this.ctx.currentTime + 0.01)
    } catch {
      this.ctx = null
    }
  }

  /** Mutes or unmutes and remembers the choice in this browser. */
  toggle(): void {
    this.muted = !this.muted
    try {
      localStorage.setItem(KEY, this.muted ? "1" : "0")
    } catch {}
  }

  private mix(ctx: AudioContext): GainNode {
    if (!this.out) {
      this.out = ctx.createGain()
      this.out.gain.value = 0.4
      this.out.connect(ctx.destination)
    }
    return this.out
  }

  private static saved(): boolean {
    try {
      return localStorage.getItem(KEY) === "1"
    } catch {
      return false
    }
  }
}

/** The building blocks of a recipe: filtered noise bursts and sliding tones. */
class Voice {
  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
  ) {}

  burst(t: number, len: number, freq: number, q: number, peak: number, type: BiquadFilterType = "lowpass"): void {
    const ctx = this.ctx
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    src.connect(filter)
    this.envelope(filter, t, peak, len)
    src.start(t)
    src.stop(t + len + 0.05)
  }

  tone(t: number, from: number, to: number, len: number, type: OscillatorType = "square", peak = 0.3): void {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, t + len)
    this.envelope(o, t, peak, len)
    o.start(t)
    o.stop(t + len + 0.05)
  }

  private envelope(node: AudioNode, t: number, peak: number, len: number): void {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.003 + len)
    node.connect(g)
    g.connect(this.out)
  }
}

const RECIPES: Record<Cue, (v: Voice, t: number) => void> = {
  shotgun: (v, t) => {
    v.burst(t, 0.35, 1800, 0.7, 1)
    v.tone(t, 140, 40, 0.25, "sine", 0.6)
  },
  rifle: (v, t) => {
    v.burst(t, 0.08, 6000, 0.5, 0.9, "highpass")
    v.burst(t, 0.6, 900, 0.8, 0.5)
    v.tone(t, 220, 50, 0.3, "sine", 0.5)
  },
  lmg: (v, t) => {
    for (let i = 0; i < 6; i++) {
      v.burst(t + i * 0.07, 0.08, 2200, 0.8, 0.7)
      v.tone(t + i * 0.07, 120, 50, 0.06, "sine", 0.4)
    }
  },
  smg: (v, t) => {
    for (let i = 0; i < 4; i++) v.burst(t + i * 0.05, 0.05, 3200, 0.8, 0.5)
  },
  pistol: (v, t) => {
    v.burst(t, 0.12, 3000, 0.8, 0.8)
    v.tone(t, 300, 80, 0.08, "sine", 0.3)
  },
  knife: (v, t) => v.burst(t, 0.18, 3500, 6, 0.4, "bandpass"),
  psi: (v, t) => {
    v.tone(t, 900, 120, 0.4, "sawtooth", 0.15)
    v.tone(t, 905, 125, 0.4, "sawtooth", 0.15)
  },
  melee: (v, t) => {
    v.burst(t, 0.12, 2500, 3, 0.5, "bandpass")
    v.burst(t + 0.08, 0.1, 700, 1, 0.6)
  },
  alien: (v, t) => {
    v.tone(t, 1400, 300, 0.25, "sawtooth", 0.18)
    v.burst(t, 0.1, 1500, 1, 0.4)
  },
  ability: (v, t) => {
    v.tone(t, 520, 780, 0.12, "triangle", 0.25)
    v.tone(t + 0.1, 780, 1040, 0.12, "triangle", 0.2)
  },
  hit: (v, t) => {
    v.burst(t, 0.1, 900, 1, 0.8)
    v.tone(t, 160, 60, 0.12, "square", 0.25)
  },
  hurt: (v, t) => v.tone(t, 200, 120, 0.2, "triangle", 0.5),
  miss: (v, t) => v.burst(t, 0.25, 5000, 4, 0.3, "bandpass"),
  crit: (v, t) => {
    v.burst(t, 0.15, 1200, 1, 1)
    v.tone(t, 660, 990, 0.12, "square", 0.15)
    v.tone(t + 0.1, 990, 1320, 0.15, "square", 0.15)
  },
  death: (v, t) => {
    v.tone(t, 500, 60, 0.6, "sawtooth", 0.25)
    v.burst(t, 0.4, 600, 1, 0.4)
  },
  blast: (v, t) => {
    v.burst(t, 1.2, 500, 0.7, 1)
    v.tone(t, 90, 30, 0.8, "sine", 0.8)
  },
  step: (v, t) => {
    v.burst(t, 0.05, 500, 1, 0.5)
    v.burst(t + 0.25, 0.05, 450, 1, 0.4)
  },
  door: (v, t) => {
    v.tone(t, 90, 70, 0.25, "square", 0.2)
    v.burst(t + 0.2, 0.08, 400, 1, 0.6)
  },
  heard: (v, t) => {
    v.burst(t, 0.07, 250, 1, 0.35)
    v.burst(t + 0.3, 0.07, 230, 1, 0.3)
  },
  spotted: (v, t) => {
    v.tone(t, 440, 880, 0.12, "square", 0.15)
    v.tone(t + 0.13, 880, 880, 0.12, "square", 0.15)
  },
  activity: (v, t) => {
    for (let i = 0; i < 3; i++) v.tone(t + i * 0.18, 220, 200, 0.16, "sawtooth", 0.12)
  },
  select: (v, t) => v.tone(t, 880, 880, 0.05, "square", 0.12),
  denied: (v, t) => v.tone(t, 180, 160, 0.15, "square", 0.15),
}
