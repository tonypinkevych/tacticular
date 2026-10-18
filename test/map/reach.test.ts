import { distance, key } from "../../src/map/point"
import { enemy, open, setup, squad } from "../fixture"

describe("grid", () => {
  test("diagonals cost 1, then 2, then 1", () => {
    expect(distance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1)
    expect(distance({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(3)
    expect(distance({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(9)
    expect(distance({ x: 0, y: 0 }, { x: 5, y: 2 })).toBe(6)
  })
  test("reach uses the same diagonal rule", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = setup(open(), [v]).reach(v, 3)
    expect(r.cost.get(key({ x: 2, y: 2 }))).toBe(3)
    expect(r.cost.has(key({ x: 3, y: 3 }))).toBe(false)
  })
  test("walls block, and enemies block, but allies can be passed", () => {
    const rows = ["...", "##.", "..."]
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = setup(rows, [v]).reach(v, 10)
    expect(r.path({ x: 0, y: 2 }).length).toBe(6)
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const blocked = setup(["...", "###", "..."], [v, e]).reach(v, 10)
    expect(blocked.cost.has(key({ x: 2, y: 0 }))).toBe(false)
    const a = squad("a", "ranger", { x: 1, y: 0 })
    const passed = setup(["...", "###", "..."], [v, a]).reach(v, 10)
    expect(passed.cost.get(key({ x: 2, y: 0 }))).toBe(2)
    expect(passed.cost.has(key({ x: 1, y: 0 }))).toBe(false)
  })
  test("no corner cutting past blocked tiles", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = setup([".#", ".."], [v]).reach(v, 10)
    expect(r.cost.get(key({ x: 1, y: 1 }))).toBe(2)
  })
  test("a unit vaults over low cover for 2 and cannot stop on it", () => {
    const v = squad("v", "ranger", { x: 0, y: 0 })
    const r = setup([".:.."], [v]).reach(v, 10)
    expect(r.cost.get(key({ x: 2, y: 0 }))).toBe(2)
    expect(r.cost.has(key({ x: 1, y: 0 }))).toBe(false)
    expect(r.path({ x: 3, y: 0 })).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
  })
  test("no vault onto a foe, a wall or across two low tiles", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 2, y: 0 })
    expect(
      setup([".:."], [v, e])
        .reach(v, 10)
        .cost.has(key({ x: 2, y: 0 })),
    ).toBe(false)
    expect(setup([".:#"], [v]).reach(v, 10).cost.size).toBe(1)
    expect(setup([".::."], [v]).reach(v, 10).cost.size).toBe(1)
  })
})
