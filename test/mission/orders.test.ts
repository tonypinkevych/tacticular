import { Illegal } from "../../src/mission/orders"
import { enemy, open, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]
const duel = () => setup(open(), [squad("r", "ranger", { x: 3, y: 3 }), enemy("g", "grunt", { x: 7, y: 0 })])

describe("orders", () => {
  test("a move costs 1 AP", () => {
    expect(
      duel()
        .apply({ type: "move", unit: "r", to: { x: 3, y: 2 } })
        .unit("r"),
    ).toMatchObject({ at: { x: 3, y: 2 }, ap: 1, moved: true })
  })
  test("a dash costs 2 AP", () => {
    expect(
      duel()
        .apply({ type: "move", unit: "r", to: { x: 3, y: 1 } })
        .unit("r").ap,
    ).toBe(0)
  })
  test("a tile past a dash is refused", () => {
    expect(() => duel().apply({ type: "move", unit: "r", to: { x: 3, y: 0 } })).toThrow(Illegal)
  })
  test("a shot ends the turn", () => {
    const g = duel().apply({ type: "shoot", unit: "r", target: "g" })
    expect(g.unit("r").ap).toBe(0)
    expect(() => g.apply({ type: "move", unit: "r", to: { x: 3, y: 2 } })).toThrow(Illegal)
  })
  test("a unit acts only in its side's turn", () => {
    expect(() => duel().apply({ type: "move", unit: "g", to: { x: 6, y: 0 } })).toThrow(Illegal)
  })
  test("overwatch fires once at the first enemy that moves in range", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 7 }), enemy("g", "grunt", { x: 3, y: 1 })])
      .apply({ type: "overwatch", unit: "r" })
      .apply({ type: "endTurn" })
      .apply({ type: "move", unit: "g", to: { x: 3, y: 2 } })
    expect(g.log.filter((e) => e.key === "log.overwatch")).toHaveLength(1)
    expect(g.unit("r").overwatch).toBe(false)
  })
  test("stepping into fire burns for 1", () => {
    const g = setup(rows(["........", "........", "........", "........", "........", "...f...."]), [
      squad("v", "vanguard", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 7, y: 0 }),
    ])
    expect(g.apply({ type: "move", unit: "v", to: { x: 3, y: 5 } }).unit("v").hp).toBe(5)
  })
})
