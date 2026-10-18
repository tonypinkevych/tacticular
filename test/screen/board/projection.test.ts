import { Projection } from "../../../src/screen/board/projection"

describe("projection", () => {
  const p = new Projection(16, 12)

  test("every tile's ground maps back to the tile", () => {
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 16; x++) {
        const g = p.ground({ x, y })
        expect(p.tile(g)).toEqual({ x, y })
        expect(p.tile({ x: g.x + 5, y: g.y + 1 })).toEqual({ x, y })
      }
  })
  test("x runs to the lower right and y to the lower left", () => {
    const o = p.anchor({ x: 3, y: 3 })
    expect(p.anchor({ x: 4, y: 3 })).toEqual({ x: o.x + 12, y: o.y + 6 })
    expect(p.anchor({ x: 3, y: 4 })).toEqual({ x: o.x - 12, y: o.y + 6 })
  })
  test("the whole board fits in its size", () => {
    const s = p.size()
    for (const t of [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 0, y: 11 },
      { x: 15, y: 11 },
    ]) {
      const a = p.anchor(t)
      expect(a.x - 12).toBeGreaterThanOrEqual(0)
      expect(a.x + 12).toBeLessThanOrEqual(s.x)
      expect(a.y - 27).toBeGreaterThanOrEqual(0)
      expect(a.y).toBeLessThanOrEqual(s.y)
    }
  })
})
