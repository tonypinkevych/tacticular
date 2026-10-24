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
  test("every mission but the fortress holds one prize, and an elite holds a skill upgrade", () => {
    for (let s = 1; s <= 30; s++) {
      const c = Chart.of(s)
      for (const n of c.nodes) expect(n.prize === undefined).toBe(n.kind === "fortress")
      for (const n of c.nodes.filter((x) => x.kind === "elite")) expect(n.prize).toBe("upgrade")
    }
  })
  test("every mission past the first layer but the fortress names a special alien", () => {
    for (let s = 1; s <= 30; s++)
      for (const n of Chart.of(s).nodes) expect(n.foe === undefined).toBe(n.layer === 0 || n.kind === "fortress")
  })
})
