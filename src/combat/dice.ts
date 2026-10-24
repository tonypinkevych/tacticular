/** The seeded random stream a game or a map draws from (mulberry32); it keeps its state in `rng`. */
export class Dice {
  constructor(private readonly state: { rng: number }) {}

  /** Next number in [0, 1). */
  random(): number {
    this.state.rng = (this.state.rng + 0x6d2b79f5) | 0
    let t = this.state.rng
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  die(sides: number): number {
    return 1 + Math.floor(this.random() * sides)
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)]
  }

  /** A whole number from lo to hi, both included. */
  between(lo: number, hi: number): number {
    return lo + this.die(hi - lo + 1) - 1
  }

  shuffle<T>(items: T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
}
