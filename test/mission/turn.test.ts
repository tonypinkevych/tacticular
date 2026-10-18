import { distance } from "../../src/map/point"
import type { Game } from "../../src/mission/game"
import { enemy, find, open, setup, squad } from "../fixture"

describe("patrol drift", () => {
  const route = [
    { x: 15, y: 1 },
    { x: 18, y: 1 },
  ]
  const roam = (round: number): Game => {
    const g = setup(open(20, 3), [squad("s", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 15, y: 1 }, "unaware")])
    g.groups = [{ id: "g1", revealed: false, target: null, landing: { x: 0, y: 1 } }]
    find(g, "e").patrol = route.map((p) => ({ ...p }))
    g.round = round
    return g.apply({ type: "endTurn" })
  }

  test("after round 3 an unaware group at a route point heads for a point nearer to where the squad landed", () => {
    const e = find(roam(4), "e")
    expect(distance(e.patrol[e.patrolIndex], { x: 0, y: 1 })).toBeLessThan(15)
  })
  test("up to round 3 the route stays", () => {
    expect(find(roam(3), "e").patrol).toEqual(route)
  })
})

describe("waiting", () => {
  test("a unit that ended its turn on overwatch starts the next one as waited", () => {
    const g = setup(open(20, 3), [squad("s", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 15, y: 1 })])
    g.phase = "enemy"
    find(g, "e").ap = 2
    const watched = g.apply({ type: "overwatch", unit: "e" })
    const next = watched.apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(find(next, "e").waited).toBe(true)
  })
})
