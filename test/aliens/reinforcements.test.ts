import type { Game } from "../../src/mission/game"
import { enemy, open, setup, squad } from "../fixture"

const round = (g: Game) => g.apply({ type: "endTurn" }).apply({ type: "endTurn" })

describe("reinforcements", () => {
  const start = () => setup(open(), [squad("r", "ranger", { x: 3, y: 7 }), enemy("g", "grunt", { x: 0, y: 0 })])
  test("the landing is marked at the end of round 2", () => {
    const g = round(round(start()))
    expect([g.round, g.landing.length]).toEqual([3, 2])
  })
  test("2 aliens land in round 3 on the marked tiles", () => {
    const marked = round(round(start()))
    const g = marked.apply({ type: "endTurn" })
    const landed = g.units.filter((u) => u.side === "enemy" && u.id !== "g")
    expect(landed.map((u) => u.at)).toEqual(marked.landing)
    expect(g.landing).toEqual([])
  })
  test("aliens land as many times as the mission allows", () => {
    let g = start()
    for (let i = 0; i < 12; i++) g = round(g)
    expect(g.units.filter((u) => u.side === "enemy")).toHaveLength(5)
  })
  test("while a Pod stands, aliens land every 2 rounds and never run out", () => {
    let g = setup(open(), [squad("r", "ranger", { x: 3, y: 7 }), enemy("p", "pod", { x: 0, y: 0 })])
    g.drops = 1
    for (let i = 0; i < 6; i++) g = round(g)
    expect(g.log.filter((e) => e.key === "log.drop")).toHaveLength(3)
  })
})
