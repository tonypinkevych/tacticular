import { mission } from "../../src/mission/mission"

describe("mission", () => {
  test("the squad starts on the bottom row and 4 aliens on the top two", () => {
    const g = mission(3, {
      goal: "kill",
      squad: [
        { id: "a", kind: "vanguard" },
        { id: "b", kind: "ranger" },
        { id: "c", kind: "cleric" },
      ],
    })
    expect(g.units.filter((u) => u.side === "squad").map((u) => u.at.y)).toEqual([7, 7, 7])
    const aliens = g.units.filter((u) => u.side === "enemy")
    expect(aliens).toHaveLength(4)
    expect(aliens.every((u) => u.at.y <= 1)).toBe(true)
  })
  test("a soldier keeps the HP it carries in", () => {
    const g = mission(3, { goal: "kill", squad: [{ id: "a", kind: "vanguard", hp: 2 }] })
    expect(g.unit("a").hp).toBe(2)
  })
  test("the fortress adds the Commander", () => {
    const g = mission(3, { goal: "kill", squad: [{ id: "a", kind: "vanguard" }], boss: true })
    expect(g.units.some((u) => u.kind === "commander")).toBe(true)
  })
  test("threat adds aliens", () => {
    const g = mission(3, { goal: "kill", squad: [{ id: "a", kind: "vanguard" }], threat: 2 })
    expect(g.units.filter((u) => u.side === "enemy")).toHaveLength(5)
  })
  test("Evac marks the top row; Defend marks a beacon in the middle", () => {
    const evac = mission(4, { goal: "evac", squad: [{ id: "a", kind: "vanguard" }] })
    expect(evac.goal.kind === "evac" && evac.goal.tiles.every((p) => p.y === 0)).toBe(true)
    const defend = mission(4, { goal: "defend", squad: [{ id: "a", kind: "vanguard" }] })
    expect(defend.goal.kind === "defend" && defend.goal.at.y >= 3 && defend.goal.at.y <= 4).toBe(true)
  })
})
