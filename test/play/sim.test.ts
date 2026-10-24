import { Mind } from "../../src/aliens/mind"
import type { Game } from "../../src/mission/game"
import { type GoalKind, mission } from "../../src/mission/mission"
import type { ClassId } from "../../src/units/profiles"

const CLASSES: ClassId[] = ["vanguard", "ranger", "warden", "cleric", "blade"]

/** Both sides played by the mind on a generated mission until it ends. */
function game(seed: number, goal: GoalKind): Game {
  const squad = CLASSES.filter((_, i) => i !== seed % 5 && i !== (seed + 2) % 5).map((kind, i) => ({
    id: `s${i}`,
    kind,
  }))
  let g = mission(seed, { goal, squad })
  for (let i = 0; i < 3000 && (g.phase === "squad" || g.phase === "enemy"); i++) g = g.apply(new Mind(g).next())
  return g
}

describe("bot games", () => {
  test("100 first Kill all missions end and the squad wins 60-95%", () => {
    const ends = Array.from({ length: 100 }, (_, s) => game(s + 1, "kill").phase)
    const won = ends.filter((p) => p === "won").length
    console.log(`kill: squad won ${won} of 100`)
    expect(ends.every((p) => p === "won" || p === "lost")).toBe(true)
    expect(won).toBeGreaterThanOrEqual(60)
    expect(won).toBeLessThanOrEqual(95)
  }, 60000)
  test("Evac and Defend missions end, and the squad can win them", () => {
    for (const goal of ["evac", "defend"] as const) {
      const ends = Array.from({ length: 40 }, (_, s) => game(s + 1, goal).phase)
      console.log(`${goal}: squad won ${ends.filter((p) => p === "won").length} of 40`)
      expect(ends.every((p) => p === "won" || p === "lost")).toBe(true)
      expect(ends.filter((p) => p === "won").length).toBeGreaterThan(0)
    }
  }, 60000)
})
