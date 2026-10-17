import { attack, odds } from "../src/rules/combat"
import { addStatus } from "../src/rules/units"
import { enemy, open, setup, squad } from "./fixture"

describe("odds", () => {
  test("cover adds defense and removes the flank", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const rows = open(3, 10)
    rows[7] = ":.."
    const g = setup(rows, [r, e])
    const o = odds(g, r, e)
    expect(o.cover).toBe(2)
    expect(o.defense).toBe(13)
    expect(o.edge).toBe(0)
    expect(o.chance).toBeCloseTo(0.7)
  })
  test("an open target is flanked and gives advantage", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const o = odds(setup(open(3, 10), [r, e]), r, e)
    expect(o.advantages).toContain("flanked")
    expect(o.edge).toBe(1)
  })
  test("overwatch disadvantage cancels the unaware advantage", () => {
    const w = squad("w", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 4 }, "unaware")
    const rows = open(3, 6)
    rows[3] = ":.."
    const o = odds(setup(rows, [w, e]), w, e, "repeater", { reaction: true })
    expect(o.advantages).toEqual(["unaware"])
    expect(o.disadvantages).toEqual(["reaction"])
    expect(o.edge).toBe(0)
  })
  test("past best range: disadvantage and −1 Aim per extra tile", () => {
    const c = squad("c", "cleric", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 10 })
    const o = odds(setup(open(3, 12), [c, e]), c, e)
    expect(o.disadvantages).toContain("range")
    expect(o.aim).toBe(3 - 2)
  })
  test("ward adds 2 defense, shieldwall adds 1 armor", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const s = enemy("s", "shieldwall", { x: 1, y: 8 })
    addStatus(e, { id: "ward", rounds: 2 })
    const o = odds(setup(open(3, 10), [r, e, s]), r, e)
    expect(o.defense).toBe(13)
    expect(o.max).toBe(13 - 1)
  })
})

describe("results", () => {
  test("an attack logs the hit chance it had", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const g = setup(open(3, 10), [r, e])
    const expected = Math.round(odds(g, r, e).chance * 100)
    attack(g, r, e)
    expect(g.log.find((x) => x.key !== "log.dies")?.params.chance).toBe(expected)
  })
})
