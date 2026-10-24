import { Unit } from "../../src/units/unit"

describe("unit", () => {
  test("starts with full HP, 2 AP and its skill uses", () => {
    const u = Unit.of("w", "warden", "squad", { x: 0, y: 0 })
    expect([u.hp, u.ap, u.uses, u.cooldown]).toEqual([9, 2, 1, 0])
  })
  test("a war cry adds one tile to its move", () => {
    const u = Unit.of("g", "grunt", "enemy", { x: 0, y: 0 })
    u.rallied = true
    expect(u.steps()).toBe(2)
  })
  test("training adds HP and aim; an upgrade adds a use or takes a turn off the wait", () => {
    const w = Unit.of("w", "warden", "squad", { x: 0, y: 0 }, { hp: 1, aim: 5, upgrades: 1 })
    const r = Unit.of("r", "ranger", "squad", { x: 0, y: 0 }, { hp: 0, aim: 0, upgrades: 1 })
    expect([w.hp, w.profile.aim, w.uses, r.profile.cooldown]).toEqual([10, 70, 2, 2])
  })
})
