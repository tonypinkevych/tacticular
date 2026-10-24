import { enemy, open, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]

describe("turns", () => {
  test("the aliens get 2 AP when the squad ends its turn", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 3 }), enemy("g", "grunt", { x: 7, y: 0 })]).apply({
      type: "endTurn",
    })
    expect([g.phase, g.unit("g").ap]).toEqual(["enemy", 2])
  })
  test("a new round gives the squad 2 AP and counts down its cooldowns", () => {
    const start = setup(open(), [squad("r", "ranger", { x: 3, y: 3 }), enemy("g", "grunt", { x: 7, y: 0 })])
    start.unit("r").cooldown = 3
    const g = start.apply({ type: "overwatch", unit: "r" }).apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect([g.round, g.phase, g.unit("r").ap, g.unit("r").cooldown]).toEqual([2, "squad", 2, 2])
  })
  test("a unit in fire burns for 1 at the end of the round", () => {
    const g = setup(rows(["........", "........", "........", "...f...."]), [
      squad("v", "vanguard", { x: 3, y: 3 }),
      enemy("g", "grunt", { x: 7, y: 0 }),
    ])
    expect(g.apply({ type: "endTurn" }).apply({ type: "endTurn" }).unit("v").hp).toBe(6)
  })
  test("fire spreads to the next forest at the end of the round", () => {
    const g = setup(rows(["........", "........", "........", "...fT..."]), [
      squad("v", "vanguard", { x: 0, y: 7 }),
      enemy("g", "grunt", { x: 7, y: 0 }),
    ])
    expect(g.apply({ type: "endTurn" }).apply({ type: "endTurn" }).board.at({ x: 4, y: 3 })).toBe("fire")
  })
  test("the squad wins when no alien stands", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 3 }), enemy("g", "grunt", { x: 3, y: 0 })])
    g.unit("g").hp = 1
    let next = g
    for (let i = 0; i < 20 && next.phase !== "won"; i++)
      next =
        next.phase === "squad" && next.unit("r").ap > 0
          ? next.apply({ type: "shoot", unit: "r", target: "g" })
          : next.apply({ type: "endTurn" })
    expect(next.phase).toBe("won")
  })
  test("the squad loses when no soldier stands", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("b", "brute", { x: 3, y: 3 })])
    g.unit("v").hp = 2
    expect(g.apply({ type: "endTurn" }).apply({ type: "shoot", unit: "b", target: "v" }).phase).toBe("lost")
  })
})
