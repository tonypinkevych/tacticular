import { distance } from "../../src/map/point"
import type { Game } from "../../src/mission/game"
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
  test("the tiles where an alien would spot a concealed soldier are those within its detection radius", () => {
    const e = enemy("e", "orc", { x: 10, y: 1 }, "unaware")
    const g = setup(open(20, 3), [squad("g", "warden", { x: 4, y: 1 }), squad("r", "rogue", { x: 3, y: 1 }), e])
    const spots = [...g.stealth.spots(find(g, "e"), find(g, "g"))].map((k) => k % 1000)
    expect(Math.min(...spots)).toBe(8)
    expect(Math.max(...spots)).toBe(12)
    const scout = new Set([...g.stealth.spots(find(g, "e"), find(g, "r"))].map((k) => k % 1000))
    expect([...scout].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12])
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
    find(g, "a").hp = 3
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
  const walled = [".".repeat(30), "#".repeat(30), ".".repeat(30)]

  test("an alien no soldier sees leaves a noise up to 2 tiles from where it stops within 12 of a soldier", () => {
    const noises = walk(walled, { x: 9, y: 2 }, { x: 10, y: 2 }).noises
    expect(noises).toHaveLength(1)
    expect(noises[0]).toMatchObject({ radius: 0, round: 1 })
    expect(distance(noises[0].at, { x: 10, y: 2 })).toBeLessThanOrEqual(2)
  })
  test("an unseen alien that stops far from every soldier leaves no noise", () => {
    expect(walk(walled, { x: 20, y: 2 }, { x: 21, y: 2 }).noises).toEqual([])
  })
  test("an alien near a noise heard this round leaves no second one", () => {
    const g = walk(walled, { x: 9, y: 2 }, { x: 10, y: 2 })
    g.units.push(enemy("f", "orc", { x: 11, y: 2 }, "unaware"))
    find(g, "f").ap = 2
    expect(g.apply({ type: "move", unit: "f", to: { x: 12, y: 2 } }).noises).toHaveLength(1)
  })
  test("an alien a soldier sees leaves no noise", () => {
    expect(walk(open(20, 3), { x: 2, y: 2 }, { x: 3, y: 2 }).noises).toEqual([])
  })
})

describe("hunt", () => {
  test("a soldier's loud shot moves the goal of an engaged group that hears it", () => {
    const g = setup(open(24, 3), [
      squad("w", "warden", { x: 0, y: 1 }),
      enemy("a", "orc", { x: 6, y: 1 }, "unaware", "g1"),
      enemy("b", "orc", { x: 8, y: 2 }, "engaged", "g2"),
    ])
    g.groups.find((x) => x.id === "g2")!.target = { x: 20, y: 2 }
    const a = g.apply({ type: "attack", unit: "w", target: "a" })
    expect(a.groups.find((x) => x.id === "g2")!.target).toEqual({ x: 0, y: 1 })
  })
  test("a group searches the place of its target for 2 rounds, then patrols again", () => {
    const g = setup(open(24, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 20, y: 1 }, "engaged")])
    g.groups[0].target = { x: 20, y: 1 }
    g.phase = "enemy"
    const once = g.apply({ type: "endTurn" })
    expect(find(once, "e").alert).toBe("engaged")
    const twice = once.apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(find(twice, "e").alert).toBe("unaware")
    expect(twice.groups[0].target).toBeNull()
  })
  test("a group with no route that calms down patrols toward where the squad landed", () => {
    const g = setup(open(24, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 20, y: 1 }, "engaged")])
    g.groups[0].target = { x: 20, y: 1 }
    g.groups[0].landing = { x: 0, y: 1 }
    g.phase = "enemy"
    const calm = g.apply({ type: "endTurn" }).apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(find(calm, "e").patrol).toEqual([
      { x: 20, y: 1 },
      { x: 0, y: 1 },
    ])
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

describe("captive", () => {
  test("aliens do not notice a captive soldier next to them", () => {
    const c = squad("c", "mage", { x: 3, y: 1 })
    c.give({ id: "captive", rounds: 99 })
    const g = setup(open(8, 3), [c, enemy("e", "orc", { x: 4, y: 1 }, "unaware")])
    g.stealth.scan()
    expect(find(g, "e").alert).toBe("unaware")
  })
})
