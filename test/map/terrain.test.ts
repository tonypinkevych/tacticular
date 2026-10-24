import { AROUND, key, type Point, plus } from "../../src/map/point"
import { BIOMES, terrain } from "../../src/map/terrain"
import { blocksMove } from "../../src/map/tile"

describe("terrain", () => {
  test("one seed gives one map", () => {
    expect(terrain(5, "forest").tiles).toEqual(terrain(5, "forest").tiles)
  })
  test("a map has cover, and its start rows are open", () => {
    for (let s = 1; s <= 200; s++) {
      const b = terrain(s, BIOMES[s % 4])
      expect(
        b.tiles.filter((t) => t === "bags" || t === "rock" || t === "cracked" || t === "house" || t === "forest")
          .length,
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
      const b = terrain(s, BIOMES[s % 4])
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
  test("each biome has its own ground", () => {
    const count = (s: number, biome: (typeof BIOMES)[number], ...kinds: string[]) =>
      terrain(s, biome).tiles.filter((t) => kinds.includes(t)).length
    for (let s = 1; s <= 30; s++) {
      expect(count(s, "village", "house"), `village ${s}`).toBeGreaterThanOrEqual(3)
      expect(count(s, "village", "road"), `village ${s}`).toBeGreaterThanOrEqual(6)
      expect(count(s, "forest", "water"), `forest ${s}`).toBeGreaterThanOrEqual(5)
      expect(count(s, "forest", "forest"), `forest ${s}`).toBeGreaterThanOrEqual(6)
      expect(count(s, "ruins", "rubble"), `ruins ${s}`).toBeGreaterThanOrEqual(3)
      expect(count(s, "ruins", "rock", "cracked"), `ruins ${s}`).toBeGreaterThanOrEqual(3)
      expect(count(s, "field", "bags"), `field ${s}`).toBeGreaterThanOrEqual(6)
    }
  })
})
