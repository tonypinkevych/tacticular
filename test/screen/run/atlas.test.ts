import { PLACES } from "../../../src/campaign/world"
import { EARTH, LABELS, land } from "../../../src/screen/run/atlas"

describe("atlas", () => {
  test("every row of the Earth has the same width", () => {
    expect(new Set(EARTH.map((r) => r.length)).size).toBe(1)
  })
  test("a cell gives its region, and the sea or land of no region gives none", () => {
    expect(land(10, 4)).toBe("na")
    expect(land(0, 0)).toBeNull()
    expect(land(25, 0)).toBeNull()
    expect(land(-1, 3)).toBeNull()
  })
  test("each region has land and a label inside the map", () => {
    for (const p of PLACES) {
      expect(EARTH.some((r, y) => [...r].some((_, x) => land(x, y) === p.id))).toBe(true)
      expect(LABELS[p.id].y).toBeLessThan(EARTH.length)
      expect(LABELS[p.id].x).toBeLessThan(EARTH[0].length)
    }
  })
})
