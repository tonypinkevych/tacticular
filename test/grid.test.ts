import { distance, key, reach } from "../src/rules/grid"
import { enemy, open, setup, squad } from "./fixture"

describe("grid", () => {
  test("diagonals cost 1, then 2, then 1", () => {
    expect(distance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1)
    expect(distance({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(3)
    expect(distance({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(9)
    expect(distance({ x: 0, y: 0 }, { x: 5, y: 2 })).toBe(6)
  })
  test("reach uses the same diagonal rule", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = reach(setup(open(), [v]), v, 3)
    expect(r.cost.get(key({ x: 2, y: 2 }))).toBe(3)
    expect(r.cost.has(key({ x: 3, y: 3 }))).toBe(false)
  })
  test("walls block, and enemies block, but allies can be passed", () => {
    const rows = ["...", "##.", "..."]
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = reach(setup(rows, [v]), v, 10)
    expect(r.path({ x: 0, y: 2 }).length).toBe(6)
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const blocked = reach(setup(["...", "###", "..."], [v, e]), v, 10)
    expect(blocked.cost.has(key({ x: 2, y: 0 }))).toBe(false)
    const a = squad("a", "ranger", { x: 1, y: 0 })
    const passed = reach(setup(["...", "###", "..."], [v, a]), v, 10)
    expect(passed.cost.get(key({ x: 2, y: 0 }))).toBe(2)
    expect(passed.cost.has(key({ x: 1, y: 0 }))).toBe(false)
  })
  test("no corner cutting past blocked tiles", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = reach(setup([".#", ".."], [v]), v, 10)
    expect(r.cost.get(key({ x: 1, y: 1 }))).toBe(2)
  })
})
