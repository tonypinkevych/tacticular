import { enemy } from "../fixture"

describe("wounds", () => {
  test("a unit at half its HP or less is wounded", () => {
    const e = enemy("e", "warchief", { x: 0, y: 0 })
    e.hp = 6
    expect(e.wounded()).toBe(false)
    e.hp = 5
    expect(e.wounded()).toBe(true)
  })
  test("a wounded unit moves one move a turn, not a dash", () => {
    const e = enemy("e", "warchief", { x: 0, y: 0 })
    e.ap = 2
    expect(e.stride()).toBe(e.mobility * 2)
    e.hp = 5
    expect(e.stride()).toBe(e.mobility)
  })
})
