import { Chart } from "../../src/run/chart"

describe("chart", () => {
  const charts = Array.from({ length: 50 }, (_, i) => Chart.of(i + 1))
  test("has 4 layers of 2-3 missions, then the fortress", () => {
    for (const c of charts) {
      for (let layer = 0; layer < 4; layer++) {
        const n = c.layer(layer).length
        expect(n).toBeGreaterThanOrEqual(2)
        expect(n).toBeLessThanOrEqual(3)
      }
      expect(c.layer(4).map((n) => n.kind)).toEqual(["fortress"])
    }
  })
  test("every mission leads on, and every mission after the first layer can be reached", () => {
    for (const c of charts) {
      for (const n of c.nodes.filter((x) => x.layer < 4)) expect(n.next.length).toBeGreaterThan(0)
      for (const n of c.nodes.filter((x) => x.layer > 0))
        expect(
          c.nodes.some((x) => x.next.includes(n.id)),
          `chart ${c.seed} node ${n.id}`,
        ).toBe(true)
    }
  })
  test("a layer holds different kinds, and every kind comes up", () => {
    const kinds = new Set<string>()
    for (const c of charts)
      for (let layer = 0; layer < 4; layer++) {
        const ks = c.layer(layer).map((n) => n.kind)
        expect(new Set(ks).size).toBe(ks.length)
        for (const k of ks) kinds.add(k)
      }
    expect([...kinds].sort()).toEqual(["captain", "defend", "intel", "relay", "vip"])
  })
  test("every mission has a biome, and every biome comes up", () => {
    const biomes = new Set(charts.flatMap((c) => c.nodes.map((n) => n.biome)))
    expect([...biomes].sort()).toEqual(["forest", "town", "village"])
  })
  test("the same seed gives the same chart", () => {
    expect(Chart.of(7)).toEqual(Chart.of(7))
  })
})
