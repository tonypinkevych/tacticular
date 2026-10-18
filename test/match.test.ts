import { Match } from "../src/match"
import { enemy, find, open, setup, squad } from "./fixture"

describe("simulated squad with no foe in sight", () => {
  const hidden = () => {
    const g = setup(open(40, 3), [squad("w", "warden", { x: 10, y: 1 }), enemy("e", "orc", { x: 39, y: 1 }, "unaware")])
    g.explored = g.explored.map((_, i) => i % 40 < 20)
    return g
  }
  test("walks to the evac zone", () => {
    const g = hidden()
    g.goal = { kind: "evac", tiles: [{ x: 0, y: 1 }] }
    expect(find(new Match(g).simulate(1), "w").pos.x).toBeLessThan(10)
  })
  test("walks to the beacon", () => {
    const g = hidden()
    g.goal = { kind: "defend", at: { x: 2, y: 1 }, rounds: 6 }
    expect(find(new Match(g).simulate(1), "w").pos.x).toBeLessThan(10)
  })
  test("explores the nearest fog in Kill all", () => {
    expect(find(new Match(hidden()).simulate(1), "w").pos.x).toBeGreaterThan(10)
  })
})
