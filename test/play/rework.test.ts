import { PROFILES } from "../../src/units/profiles"
import { enemy, find, open, setup, squad } from "../fixture"

describe("one weapon per class", () => {
  test("the Rogue fights with a melee dagger", () => {
    expect(PROFILES.rogue.weapon).toBe("dagger")
  })
})

describe("range and position", () => {
  test("a ranged attack on an adjacent enemy has disadvantage", () => {
    const w = squad("w", "ranger", { x: 2, y: 1 })
    const e = enemy("e", "orc", { x: 3, y: 1 })
    expect(setup(open(6, 3), [w, e]).combat.odds(w, e).disadvantages).toContain("range")
  })
  test("a melee attack is flanked with an ally on the far side", () => {
    const v = squad("v", "rogue", { x: 1, y: 1 })
    const g = squad("g", "vanguard", { x: 3, y: 1 })
    const e = enemy("e", "orc", { x: 2, y: 1 })
    expect(setup(open(6, 3), [v, g, e]).combat.odds(v, e).advantages).toContain("flanked")
  })
})

describe("cooperation statuses", () => {
  test("Mark exposes a target: no cover and advantage, for 1 AP", () => {
    const rows = open(8, 12)
    rows[7] = "...:...."
    const r = squad("r", "rogue", { x: 4, y: 2 })
    const w = squad("w", "warden", { x: 3, y: 2 })
    const e = enemy("e", "orc", { x: 3, y: 8 })
    const g = setup(rows, [r, w, e]).apply({ type: "ability", unit: "r", ability: "tag", target: "e" })
    expect(find(g, "r").ap).toBe(1)
    const o = g.combat.odds(find(g, "w"), find(g, "e"))
    expect(o.cover).toBe(0)
    expect(o.advantages).toContain("flanked")
  })
  test("Shove pushes an adjacent enemy 1 tile and exposes it", () => {
    const v = squad("v", "vanguard", { x: 1, y: 1 })
    const e = enemy("e", "orc", { x: 2, y: 1 })
    const g = setup(open(6, 3), [v, e]).apply({ type: "ability", unit: "v", ability: "shove", target: "e" })
    expect(find(g, "e").pos).toEqual({ x: 3, y: 1 })
    expect(find(g, "e").statuses.map((s) => s.id)).toContain("exposed")
    expect(g.combat.odds(find(g, "v"), find(g, "e")).advantages).toContain("flanked")
  })
  test("an exposed enemy makes no overwatch shot", () => {
    const w = squad("w", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 6, y: 2 })
    e.stance = "overwatch"
    e.statuses.push({ id: "exposed", rounds: 1 })
    const g = setup(open(12, 3), [w, e]).apply({ type: "move", unit: "w", to: { x: 2, y: 0 } })
    expect(g.log.some((x) => x.key === "log.hit" || x.key === "log.miss")).toBe(false)
  })
  test("a melee attack gets no flank advantage", () => {
    const v = squad("v", "rogue", { x: 1, y: 1 })
    const e = enemy("e", "orc", { x: 2, y: 1 })
    expect(setup(open(6, 3), [v, e]).combat.odds(v, e).advantages).not.toContain("flanked")
  })
})

describe("stealthy Rogue", () => {
  test("an unaware enemy detects a concealed Rogue within 2 tiles", () => {
    const g = setup(open(12, 3), [squad("g", "rogue", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 }, "unaware")])
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 3, y: 1 } }), "g").concealed).toBe(true)
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 4, y: 1 } }), "g").concealed).toBe(false)
  })
  test("an investigating enemy detects a concealed Rogue within 4 tiles", () => {
    const g = setup(open(12, 3), [
      squad("g", "rogue", { x: 0, y: 1 }),
      enemy("e", "orc", { x: 6, y: 1 }, "investigating"),
    ])
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 1, y: 1 } }), "g").concealed).toBe(true)
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 2, y: 1 } }), "g").concealed).toBe(false)
  })
})
