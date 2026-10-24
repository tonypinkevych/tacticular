import { AROUND, key, type Point, plus } from "../../src/map/point"
import { terrain } from "../../src/map/terrain"
import { blocksMove } from "../../src/map/tile"

describe("terrain", () => {
  test("one seed gives one map", () => {
    expect(terrain(5).tiles).toEqual(terrain(5).tiles)
  })
  test("a map has cover, and its start rows are open", () => {
    for (let s = 1; s <= 50; s++) {
      const b = terrain(s)
      expect(
        b.tiles.filter((t) => t === "bags" || t === "rock" || t === "house" || t === "forest").length,
        `seed ${s}`,
      ).toBeGreaterThanOrEqual(8)
      for (const y of [0, 7])
        expect(
          Array.from({ length: 8 }, (_, x) => blocksMove(b.at({ x, y }))).filter(Boolean).length,
          `seed ${s} row ${y}`,
        ).toBeLessThanOrEqual(2)
    }
  })
  test("every open tile can be walked to from the squad's row", () => {
    for (let s = 1; s <= 200; s++) {
      const b = terrain(s)
      const start = Array.from({ length: 8 }, (_, x) => ({ x, y: 7 })).find((p) => !blocksMove(b.at(p)))!
      const seen = new Set([key(start)]),
        queue: Point[] = [start]
      while (queue.length) {
        const p = queue.shift()!
        for (const d of AROUND) {
          const q = plus(p, d)
          if (b.inside(q) && !blocksMove(b.at(q)) && !seen.has(key(q))) {
            seen.add(key(q))
            queue.push(q)
          }
        }
      }
      const open = b.tiles.filter((t) => !blocksMove(t)).length
      expect(seen.size, `seed ${s}`).toBe(open)
    }
  })
})
