import { Unit } from "../../src/units/unit"

describe("unit", () => {
  test("starts with full HP, 2 AP and its skill uses", () => {
    const u = Unit.of("w", "warden", "squad", { x: 0, y: 0 })
    expect([u.hp, u.ap, u.uses, u.cooldown]).toEqual([7, 2, 1, 0])
  })
  test("a war cry adds one tile to its move", () => {
    const u = Unit.of("g", "grunt", "enemy", { x: 0, y: 0 })
    u.rallied = true
    expect(u.steps()).toBe(2)
  })
})
