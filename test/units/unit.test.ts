import { enemy } from "../fixture"

describe("wounds", () => {
  test("a unit at half its HP or less is wounded", () => {
    const e = enemy("e", "warchief", { x: 0, y: 0 })
    e.hp = Math.floor(e.maxHp / 2) + 1
    expect(e.wounded()).toBe(false)
    e.hp = Math.floor(e.maxHp / 2)
    expect(e.wounded()).toBe(true)
  })
  test("a wounded unit moves one move a turn, not a dash", () => {
    const e = enemy("e", "warchief", { x: 0, y: 0 })
    e.ap = 2
    expect(e.stride()).toBe(e.mobility * 2)
    e.hp = Math.floor(e.maxHp / 2)
    expect(e.stride()).toBe(e.mobility)
  })
})

describe("ranks", () => {
  test("a new unit has rank 1 in each skill of its kit and none outside it", () => {
    const u = enemy("v", "vanguard", { x: 0, y: 0 }, "engaged", "g1", "squad")
    expect(u.rank("charge")).toBe(1)
    expect(u.rank("rampage")).toBe(1)
    expect(u.rank("rocket")).toBe(0)
  })
})
