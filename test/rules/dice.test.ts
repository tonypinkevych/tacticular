import { chance, failChance } from "../../src/rules/dice"
import { open, setup } from "../fixture"

describe("d20 chance", () => {
  test("aim +4 against defense 12 needs 8: 65%", () => {
    expect(chance(4, 12, 0)).toBeCloseTo(0.65)
  })
  test("natural 1 always misses, natural 20 always hits", () => {
    expect(chance(30, 10, 0)).toBeCloseTo(0.95)
    expect(chance(0, 40, 0)).toBeCloseTo(0.05)
  })
  test("a save can always pass on a high roll", () => {
    expect(failChance(1, 14, 0)).toBeCloseTo(0.6)
  })
  test("the same seed gives the same rolls", () => {
    const a = setup(open(), [], 42)
    const b = setup(open(), [], 42)
    expect([a.dice.d20(), a.dice.d20()]).toEqual([b.dice.d20(), b.dice.d20()])
  })
})
