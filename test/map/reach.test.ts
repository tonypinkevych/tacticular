import { same } from "../../src/map/point"
import { enemy, open, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]

describe("reach", () => {
  test("a class with move 1 reaches the 8 tiles around it", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 3 })])
    expect(g.reach(g.unit("r"), 1).tiles()).toHaveLength(8)
  })
  test("a class with move 2 reaches 2 tiles in any direction", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 3 })])
    expect(g.reach(g.unit("v"), 1).tiles()).toHaveLength(24)
  })
  test("a dash is two moves", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 3 })])
    expect(g.reach(g.unit("r"), 2).tiles()).toHaveLength(24)
  })
  test("rough ground ends the move", () => {
    const g = setup(rows(["........", "........", "...r...."]), [squad("v", "vanguard", { x: 3, y: 3 })])
    const tiles = g.reach(g.unit("v"), 1).tiles()
    expect(tiles.some((p) => same(p, { x: 3, y: 2 }))).toBe(true)
    expect(g.reach(g.unit("v"), 1).path({ x: 3, y: 1 })).not.toContainEqual({ x: 3, y: 2 })
  })
  test("a Brute walks through rough ground", () => {
    const g = setup(rows(["...r....", "...r....", "...r...."]), [enemy("b", "brute", { x: 3, y: 3 })])
    expect(g.reach(g.unit("b"), 1).path({ x: 3, y: 0 })).toEqual([
      { x: 3, y: 2 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ])
  })
  test("cover, water and units block the way", () => {
    const g = setup(rows(["........", "........", "..l~h..."]), [
      squad("r", "ranger", { x: 3, y: 3 }),
      squad("c", "cleric", { x: 4, y: 3 }),
    ])
    const tiles = g.reach(g.unit("r"), 1).tiles()
    for (const p of [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
    ])
      expect(tiles).not.toContainEqual(p)
  })
})
