import { Illegal } from "../../src/mission/orders"
import { enemy, open, setup, squad } from "../fixture"

const ready = (g: ReturnType<typeof setup>, id: string) => {
  g.unit(id).charge = 2
  return g
}

describe("ultimates", () => {
  test("an ultimate is refused until 2 combos charge it, and using it empties the charge and ends the turn", () => {
    const g = setup(open(), [squad("w", "warden", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 3 })])
    expect(() => g.apply({ type: "ultimate", unit: "w" })).toThrow(Illegal)
    const after = ready(g, "w").apply({ type: "ultimate", unit: "w" })
    expect([after.unit("w").charge, after.unit("w").ap]).toEqual([0, 0])
  })
  test("a hit on a status a teammate put on charges both soldiers", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 2, y: 6 }),
      squad("v", "vanguard", { x: 3, y: 6 }),
      enemy("g", "commander", { x: 3, y: 4 }),
    ])
      .apply({ type: "tactic", unit: "w", target: "g" })
      .apply({ type: "shoot", unit: "v", target: "g" })
    expect([g.unit("w").charge, g.unit("v").charge]).toEqual([1, 1])
  })
  test("Breach: the Vanguard dashes a line and shoves and staggers every alien beside it", () => {
    const g = ready(
      setup(open(), [
        squad("v", "vanguard", { x: 3, y: 6 }),
        enemy("a", "grunt", { x: 2, y: 4 }),
        enemy("b", "grunt", { x: 4, y: 5 }),
      ]),
      "v",
    ).apply({ type: "ultimate", unit: "v", to: { x: 3, y: 3 } })
    expect([g.unit("v").at, g.unit("a").at, g.unit("a").status, g.unit("b").at, g.unit("b").status]).toEqual([
      { x: 3, y: 3 },
      { x: 1, y: 4 },
      "staggered",
      { x: 5, y: 5 },
      "staggered",
    ])
  })
  test("Killshot: the Ranger ignores cover for 3 more, and a kill gives 1 AP back", () => {
    const g = setup(
      ["........", "........", "...l....", "........", "........", "........", "........", "........"],
      [
        squad("r", "ranger", { x: 3, y: 6 }),
        enemy("g", "commander", { x: 3, y: 1 }),
        enemy("h", "grunt", { x: 6, y: 1 }),
      ],
    )
    g.unit("r").moved = true
    const shot = ready(g, "r").apply({ type: "ultimate", unit: "r", target: "g" })
    expect(shot.unit("g").hp).toBe(9 - 2 - 3)
    g.unit("g").hp = 3
    expect(ready(g, "r").apply({ type: "ultimate", unit: "r", target: "g" }).unit("r").ap).toBe(1)
  })
  test("Lockdown: the Warden suppresses every alien in its range and sight", () => {
    const g = ready(
      setup(open(), [
        squad("w", "warden", { x: 3, y: 6 }),
        enemy("a", "grunt", { x: 3, y: 3 }),
        enemy("b", "grunt", { x: 3, y: 0 }),
      ]),
      "w",
    ).apply({ type: "ultimate", unit: "w" })
    expect([g.unit("a").status, g.unit("b").status]).toEqual(["suppressed", null])
  })
  test("Flare barrage: the Cleric exposes every alien within 2 tiles and heals the squad 2", () => {
    const g = setup(open(), [
      squad("c", "cleric", { x: 3, y: 6 }),
      squad("r", "ranger", { x: 0, y: 7 }),
      enemy("a", "grunt", { x: 3, y: 4 }),
      enemy("b", "grunt", { x: 3, y: 1 }),
    ])
    g.unit("r").hp = 1
    const after = ready(g, "c").apply({ type: "ultimate", unit: "c" })
    expect([after.unit("a").status, after.unit("b").status, after.unit("r").hp]).toEqual(["exposed", null, 3])
  })
  test("Whirlwind: the Blade strikes every alien next to it", () => {
    const g = ready(
      setup(open(), [
        squad("b", "blade", { x: 3, y: 4 }),
        enemy("a", "grunt", { x: 3, y: 3 }),
        enemy("c", "grunt", { x: 4, y: 5 }),
      ]),
      "b",
    ).apply({ type: "ultimate", unit: "b" })
    expect([g.unit("a").hp, g.unit("c").hp]).toEqual([4, 4])
  })
})
