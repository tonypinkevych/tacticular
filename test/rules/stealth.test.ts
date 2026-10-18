import type { Game } from "../../src/rules/game"
import { enemy, find, open, reseed, setup, squad } from "../fixture"

const kill = (g: Game, unit: string, target: string): Game => {
  for (let seed = 1; seed < 200; seed++) {
    const a = reseed(g, seed).apply({ type: "attack", unit, target })
    if (find(a, target).hp === 0) return a
  }
  throw new Error("no kill")
}

describe("detection", () => {
  test("a concealed soldier is detected within 2 tiles of an unaware enemy", () => {
    const g = setup(open(20, 3), [squad("g", "warden", { x: 4, y: 1 }), enemy("e", "orc", { x: 10, y: 1 }, "unaware")])
    const far = g.apply({ type: "move", unit: "g", to: { x: 7, y: 1 } })
    expect(find(far, "g").concealed).toBe(true)
    const near = far.apply({ type: "move", unit: "g", to: { x: 8, y: 1 } })
    expect(find(near, "g").concealed).toBe(false)
    expect(find(near, "e").alert).toBe("engaged")
  })
  test("an investigating enemy detects within 4 tiles", () => {
    const g = setup(open(20, 3), [
      squad("g", "warden", { x: 0, y: 1 }),
      enemy("e", "orc", { x: 10, y: 1 }, "investigating"),
    ])
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 5, y: 1 } }), "g").concealed).toBe(true)
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 6, y: 1 } }), "g").concealed).toBe(false)
  })
  test("a first reveal in the player phase queues the group's reveal reaction", () => {
    const g = setup(open(20, 3), [
      squad("g", "warden", { x: 4, y: 1 }),
      enemy("a", "orc", { x: 10, y: 1 }, "unaware"),
      enemy("b", "orc", { x: 11, y: 1 }, "unaware"),
    ])
    const a = g.apply({ type: "move", unit: "g", to: { x: 8, y: 1 } })
    expect(a.reactions.sort()).toEqual(["a", "b"])
  })
})

describe("noise and silent kills", () => {
  test("a silent kill nobody sees keeps concealment and alerts nobody", () => {
    const rows = open(20, 5)
    rows[0] = "...................H"
    const g = setup(rows, [
      squad("g", "rogue", { x: 4, y: 2 }),
      enemy("a", "orc", { x: 5, y: 2 }, "unaware", "g1"),
      enemy("b", "orc", { x: 19, y: 4 }, "unaware", "g2"),
    ])
    const a = kill(g, "g", "a")
    expect(find(a, "g").concealed).toBe(true)
    expect(find(a, "b").alert).toBe("unaware")
    expect(a.reactions).toEqual([])
  })
  test("a loud shot sends groups in its radius to investigate", () => {
    const g = setup(open(24, 3), [
      squad("w", "warden", { x: 0, y: 1 }),
      enemy("a", "orc", { x: 6, y: 1 }, "unaware", "g1"),
      enemy("b", "orc", { x: 7, y: 2 }, "unaware", "g2"),
      enemy("c", "orc", { x: 23, y: 1 }, "unaware", "g3"),
    ])
    const a = g.apply({ type: "attack", unit: "w", target: "a" })
    expect(find(a, "w").concealed).toBe(false)
    expect(find(a, "c").alert).toBe("unaware")
    expect(["investigating", "engaged"]).toContain(find(a, "b").alert)
  })
})

describe("heard steps", () => {
  const walk = (rows: string[], from: { x: number; y: number }, to: { x: number; y: number }): Game => {
    const g = setup(rows, [squad("g", "warden", { x: 0, y: 0 }), enemy("e", "orc", from, "unaware")])
    g.phase = "enemy"
    find(g, "e").ap = 2
    return g.apply({ type: "move", unit: "e", to })
  }
  const walled = ["....................", "####################", "...................."]

  test("an alien no soldier sees leaves a noise where it stops near a soldier", () => {
    expect(walk(walled, { x: 2, y: 2 }, { x: 3, y: 2 }).noises).toEqual([{ at: { x: 3, y: 2 }, radius: 0, round: 1 }])
  })
  test("an unseen alien that stops far from every soldier leaves no noise", () => {
    expect(walk(walled, { x: 12, y: 2 }, { x: 13, y: 2 }).noises).toEqual([])
  })
  test("an alien a soldier sees leaves no noise", () => {
    expect(walk(open(20, 3), { x: 2, y: 2 }, { x: 3, y: 2 }).noises).toEqual([])
  })
})

describe("horn", () => {
  const base = () =>
    setup(open(24, 3), [
      squad("r", "ranger", { x: 0, y: 1 }),
      enemy("a", "orc", { x: 6, y: 1 }, "engaged", "g1"),
      enemy("b", "orc", { x: 11, y: 1 }, "unaware", "g2"),
    ])
  test("an Engaged group alive at round end calls groups in range", () => {
    let g = base()
    g.groups[0].target = { x: 0, y: 1 }
    find(g, "a").hp = 999
    g = g.apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(find(g, "b").alert).toBe("investigating")
    expect(g.groups[1].target).toEqual({ x: 0, y: 1 })
  })
  test("killing the spotter before round end stops the horn", () => {
    let g = base()
    g.groups[0].target = { x: 0, y: 1 }
    g = kill(g, "r", "a")
    g = g.apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(g.log.some((e) => e.key === "log.horn")).toBe(false)
  })
})

describe("fog", () => {
  test("the squad explores what it sees", () => {
    const g = setup(open(30, 3), [squad("v", "vanguard", { x: 0, y: 1 })])
    expect(g.explored[1 * 30 + 6]).toBe(true)
    expect(g.explored[1 * 30 + 20]).toBe(false)
  })
})
