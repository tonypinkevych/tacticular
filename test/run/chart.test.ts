import { Chart } from "../../src/run/chart"

describe("chart", () => {
  test("4 layers of 2-3 missions, then the fortress", () => {
    const c = Chart.of(7)
    for (let l = 0; l < 4; l++) expect(c.layer(l).length).toBeGreaterThanOrEqual(2)
    expect(c.layer(4).map((n) => n.kind)).toEqual(["fortress"])
  })
  test("every mission leads on, and every mission past the first layer is reached", () => {
    for (let s = 1; s <= 30; s++) {
      const c = Chart.of(s)
      for (const n of c.nodes.filter((x) => x.layer < 4)) expect(n.next.length).toBeGreaterThan(0)
      for (const n of c.nodes.filter((x) => x.layer > 0)) expect(c.nodes.some((m) => m.next.includes(n.id))).toBe(true)
    }
  })
})
