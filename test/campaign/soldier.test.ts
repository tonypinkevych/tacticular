import { LEVELS, level, points, rankable, type Soldier } from "../../src/campaign/soldier"

const soldier = (xp: number, ranks: Soldier["ranks"] = {}): Soldier => ({
  id: "s",
  kind: "vanguard",
  name: "Voss",
  spread: { hp: 0, aim: 0, will: 0 },
  hp: 9,
  ranks,
  xp,
  rest: 0,
})

describe("soldier", () => {
  test("eleven levels by XP, one rank point each", () => {
    expect(LEVELS).toHaveLength(11)
    expect(level(soldier(0))).toBe(1)
    expect(level(soldier(LEVELS[5]))).toBe(6)
    expect(level(soldier(99999))).toBe(11)
    expect(points(soldier(LEVELS[2], { close: 1 }))).toBe(2)
  })
  test("a basic skill at rank n needs level 2n−1 and stops at rank 3", () => {
    expect(rankable(soldier(LEVELS[1], { close: 1 }), "close")).toBe(false)
    expect(rankable(soldier(LEVELS[2], { close: 1 }), "close")).toBe(true)
    expect(rankable(soldier(99999, { close: 3 }), "close")).toBe(false)
  })
  test("the ultimate opens at level 6 and takes rank 2 at level 11", () => {
    expect(rankable(soldier(LEVELS[4]), "rampage")).toBe(false)
    expect(rankable(soldier(LEVELS[5]), "rampage")).toBe(true)
    expect(rankable(soldier(LEVELS[9], { rampage: 1 }), "rampage")).toBe(false)
    expect(rankable(soldier(LEVELS[10], { rampage: 1 }), "rampage")).toBe(true)
  })
  test("no point, or a skill outside the kit, cannot rank", () => {
    expect(rankable(soldier(0, { close: 1 }), "charge")).toBe(false)
    expect(rankable(soldier(LEVELS[3]), "rocket")).toBe(false)
  })
})
