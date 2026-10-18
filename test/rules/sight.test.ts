import { setup } from "../fixture"

describe("sight", () => {
  test("walls and high cover block, low cover and water do not", () => {
    const g = setup([".#.:.~H."])
    expect(g.sight.clear({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false)
    expect(g.sight.clear({ x: 2, y: 0 }, { x: 6, y: 0 })).toBe(true)
    expect(g.sight.clear({ x: 2, y: 0 }, { x: 7, y: 0 })).toBe(false)
  })
  test("a unit next to cover peeks out from the side tiles", () => {
    const g = setup([".....", ".#...", "....."])
    expect(g.sight.clear({ x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false)
    expect(g.sight.line({ x: 0, y: 1 }, { x: 4, y: 1 })).toBe(true)
  })
  test("two units do not both step out to see around a corner", () => {
    const g = setup([".....", ".####", ".#..."])
    expect(g.sight.line({ x: 0, y: 2 }, { x: 3, y: 0 })).toBe(false)
    expect(g.sight.line({ x: 3, y: 0 }, { x: 0, y: 2 })).toBe(false)
  })
})

describe("cover", () => {
  const g = setup([".....", "..:..", "..T..", ".....", "....."])
  const t = { x: 2, y: 2 }
  test("cover counts against attacks from its side", () => {
    expect(g.cover.against(t, { x: 2, y: 0 })).toBe(2)
    expect(g.cover.against(t, { x: 0, y: 0 })).toBe(2)
  })
  test("attacks from the open side or level with the cover flank", () => {
    expect(g.cover.against(t, { x: 0, y: 1 })).toBe(0)
    expect(g.cover.against(t, { x: 4, y: 2 })).toBe(0)
    expect(g.cover.against(t, { x: 2, y: 4 })).toBe(0)
  })
})
