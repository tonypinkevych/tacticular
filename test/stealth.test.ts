import { apply } from "../src/rules/actions"
import type { Game } from "../src/rules/types"
import { enemy, find, open, setup, squad } from "./fixture"

const kill = (g: Game, unit: string, target: string): Game => {
  for (let seed = 1; seed < 200; seed++) {
    const a = apply({ ...g, rng: seed }, { type: "attack", unit, target })
    if (find(a, target).hp === 0) return a
  }
  throw new Error("no kill")
}

describe("detection", () => {
  test("a concealed soldier is detected within 4 tiles of an unaware enemy", () => {
    const g = setup(open(20, 3), [squad("g", "rogue", { x: 0, y: 1 }), enemy("e", "orc", { x: 10, y: 1 }, "unaware")])
    const far = apply(g, { type: "move", unit: "g", to: { x: 5, y: 1 } })
    expect(find(far, "g").concealed).toBe(true)
    const near = apply(far, { type: "move", unit: "g", to: { x: 6, y: 1 } })
    expect(find(near, "g").concealed).toBe(false)
    expect(find(near, "e").alert).toBe("engaged")
  })
  test("an investigating enemy detects within 6 tiles", () => {
    const g = setup(open(20, 3), [
      squad("g", "rogue", { x: 0, y: 1 }),
      enemy("e", "orc", { x: 10, y: 1 }, "investigating"),
    ])
    expect(find(apply(g, { type: "move", unit: "g", to: { x: 3, y: 1 } }), "g").concealed).toBe(true)
    expect(find(apply(g, { type: "move", unit: "g", to: { x: 4, y: 1 } }), "g").concealed).toBe(false)
  })
  test("a first reveal in the player phase queues the group's reveal reaction", () => {
    const g = setup(open(20, 3), [
      squad("g", "rogue", { x: 0, y: 1 }),
      enemy("a", "orc", { x: 10, y: 1 }, "unaware"),
      enemy("b", "orc", { x: 11, y: 1 }, "unaware"),
    ])
    const a = apply(g, { type: "move", unit: "g", to: { x: 6, y: 1 } })
    expect(a.reactions.sort()).toEqual(["a", "b"])
  })
})

describe("noise and silent kills", () => {
  test("a silent kill nobody sees keeps concealment and alerts nobody", () => {
    const rows = open(20, 5)
    rows[0] = "...................H"
    const g = setup(rows, [
      squad("g", "rogue", { x: 0, y: 2 }),
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
    const a = apply(g, { type: "attack", unit: "w", target: "a" })
    expect(find(a, "w").concealed).toBe(false)
    expect(find(a, "c").alert).toBe("unaware")
    expect(["investigating", "engaged"]).toContain(find(a, "b").alert)
  })
  test("a stone pulls a group without breaking concealment", () => {
    const g = setup(open(20, 3), [squad("g", "rogue", { x: 0, y: 1 }), enemy("e", "orc", { x: 10, y: 1 }, "unaware")])
    const a = apply(g, { type: "item", unit: "g", item: "stone", at: { x: 6, y: 1 } })
    expect(find(a, "e").alert).toBe("investigating")
    expect(a.groups[0].target).toEqual({ x: 6, y: 1 })
    expect(find(a, "g").concealed).toBe(true)
  })
})

describe("horn", () => {
  const base = () =>
    setup(open(24, 3), [
      squad("r", "ranger", { x: 0, y: 1 }),
      enemy("a", "orc", { x: 8, y: 1 }, "engaged", "g1"),
      enemy("b", "orc", { x: 20, y: 1 }, "unaware", "g2"),
    ])
  test("an Engaged group alive at round end calls groups in range", () => {
    let g = base()
    g.groups[0].target = { x: 0, y: 1 }
    find(g, "a").hp = 999
    g = apply(apply(g, { type: "endTurn" }), { type: "endTurn" })
    expect(find(g, "b").alert).toBe("investigating")
    expect(g.groups[1].target).toEqual({ x: 0, y: 1 })
  })
  test("killing the spotter before round end stops the horn", () => {
    let g = base()
    g.groups[0].target = { x: 0, y: 1 }
    g = kill(g, "r", "a")
    g = apply(apply(g, { type: "endTurn" }), { type: "endTurn" })
    expect(g.log.some((e) => e.key === "log.horn")).toBe(false)
  })
})

describe("fog", () => {
  test("the squad explores what it sees and keeps ghosts of enemies it saw", () => {
    const g = setup(open(30, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 7, y: 1 }, "unaware")])
    expect(g.explored[1 * 30 + 8]).toBe(true)
    expect(g.explored[1 * 30 + 20]).toBe(false)
    expect(g.ghosts).toEqual([{ unit: "e", at: { x: 7, y: 1 }, round: 1 }])
  })
})
