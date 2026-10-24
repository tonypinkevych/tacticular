import { aliens, type Conditions, mission } from "../../src/mission/mission"

describe("mission", () => {
  test("the squad starts on the bottom row and 5 aliens on the top two", () => {
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
    expect(aliens).toHaveLength(5)
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
  test("threat adds aliens, as many as the count of the conditions says", () => {
    const c: Conditions = { goal: "kill", squad: [{ id: "a", kind: "vanguard" }], threat: 3, boss: true }
    expect(mission(3, c).units.filter((u) => u.side === "enemy")).toHaveLength(7)
    expect(aliens(c)).toBe(7)
  })
  test("Evac marks the top row; Defend marks a beacon near the squad", () => {
    const evac = mission(4, { goal: "evac", squad: [{ id: "a", kind: "vanguard" }] })
    expect(evac.goal.kind === "evac" && evac.goal.tiles.every((p) => p.y === 0)).toBe(true)
    const defend = mission(4, { goal: "defend", squad: [{ id: "a", kind: "vanguard" }] })
    expect(defend.goal.kind === "defend" && defend.goal.at.y === 5).toBe(true)
  })
  test("Kill all brings 3 drops, the other goals 1", () => {
    const kill = mission(1, { squad: [], goal: "kill" }),
      evac = mission(1, { squad: [], goal: "evac" })
    expect([kill.drops, evac.drops]).toEqual([3, 1])
  })
  test("a mission with a foe holds one alien of that kind", () => {
    const g = mission(3, { goal: "kill", squad: [{ id: "a", kind: "ranger" }], foe: "sniper" })
    expect(g.units.filter((u) => u.kind === "sniper")).toHaveLength(1)
  })
})
