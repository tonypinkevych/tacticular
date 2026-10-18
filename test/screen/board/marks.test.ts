import { goals } from "../../../src/screen/board/marks"
import { enemy, open, setup, squad } from "../../fixture"

describe("goals", () => {
  test("mark a seen Warchief and not an unseen one", () => {
    const g = setup(open(12, 3), [squad("s", "warden", { x: 0, y: 1 }), enemy("w", "warchief", { x: 4, y: 1 })])
    g.goal = { kind: "warchief", tiles: [], slain: false }
    expect(goals(g)).toEqual([{ x: 4, y: 1 }])
    const far = setup(
      ["....#.......", "....#.......", "....#......."],
      [squad("s", "warden", { x: 0, y: 1 }), enemy("w", "warchief", { x: 10, y: 1 })],
    )
    far.goal = { kind: "warchief", tiles: [], slain: false }
    expect(goals(far)).toEqual([])
  })
  test("mark an unused terminal even before it is seen, and nothing once it is used", () => {
    const g = setup(open(12, 3), [squad("s", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 11, y: 2 }, "unaware")])
    g.goal = { kind: "intel", at: { x: 3, y: 1 }, taken: false, tiles: [] }
    g.explored.fill(false)
    expect(goals(g)).toEqual([{ x: 3, y: 1 }])
    g.goal.taken = true
    expect(goals(g)).toEqual([])
  })
  test("mark a held captive", () => {
    const c = squad("c", "mage", { x: 3, y: 1 })
    c.give({ id: "captive", rounds: 99 })
    const g = setup(open(12, 3), [
      squad("s", "warden", { x: 0, y: 1 }),
      c,
      enemy("e", "orc", { x: 11, y: 2 }, "unaware"),
    ])
    g.goal = { kind: "vip", captive: "c", tiles: [] }
    expect(goals(g)).toEqual([{ x: 3, y: 1 }])
  })
})
