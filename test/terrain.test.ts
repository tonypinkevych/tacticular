import { apply } from "../src/rules/actions"
import { push } from "../src/rules/combat"
import { breakCover, coverAgainst } from "../src/rules/cover"
import { burning } from "../src/rules/fire"
import { key, reach, tileAt } from "../src/rules/grid"
import { map } from "../src/rules/mission"
import { clear } from "../src/rules/sight"
import type { Biome, Game } from "../src/rules/types"
import { enemy, find, setup, squad } from "./fixture"

const round = (g: Game): Game => apply(apply(g, { type: "endTurn" }), { type: "endTurn" })

describe("trees and rocks", () => {
  test("both are high cover that blocks sight", () => {
    const g = setup(["......", ".T..o.", "......"])
    expect(coverAgainst(g, { x: 0, y: 1 }, { x: 3, y: 1 })).toBe(5)
    expect(coverAgainst(g, { x: 5, y: 1 }, { x: 2, y: 1 })).toBe(5)
    expect(clear(g, { x: 0, y: 1 }, { x: 3, y: 1 })).toBe(false)
  })
  test("a tree breaks into low cover, a rock does not break", () => {
    const g = setup([".T.o."])
    breakCover(g, { x: 1, y: 0 })
    breakCover(g, { x: 3, y: 0 })
    expect(tileAt(g, { x: 1, y: 0 })).toBe("low")
    expect(tileAt(g, { x: 3, y: 0 })).toBe("rock")
  })
})

describe("mud", () => {
  test("a step into mud costs 2", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const g = setup([".mm.."], [s])
    const r = reach(g, s, 10)
    expect(r.cost.get(key({ x: 1, y: 0 }))).toBe(2)
    expect(r.cost.get(key({ x: 3, y: 0 }))).toBe(5)
  })
})

describe("grass", () => {
  test("a concealed soldier in grass is detected only from a next tile", () => {
    const g = setup(
      ["......", "gggggg", "......"],
      [squad("s", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 }, "investigating")],
    )
    const near = apply(g, { type: "move", unit: "s", to: { x: 3, y: 1 } })
    expect(find(near, "s").concealed).toBe(true)
    const next = apply(near, { type: "move", unit: "s", to: { x: 4, y: 1 } })
    expect(find(next, "s").concealed).toBe(false)
  })
})

describe("fire", () => {
  const blaze = () => {
    const g = setup(
      ["gggg.", "gTgg.", "....."],
      [squad("s", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 2 })],
    )
    g.zones.push({ kind: "fire", tiles: [{ x: 0, y: 0 }], rounds: 2 })
    return g
  }
  test("a unit in fire at round end takes 1 damage", () => {
    const g = round(blaze())
    expect(find(g, "s").hp).toBe(find(blaze(), "s").hp - 1)
  })
  test("fire spreads to next grass and trees each round, then burns out", () => {
    const one = round(blaze())
    expect(burning(one, { x: 1, y: 0 })).toBe(true)
    expect(burning(one, { x: 0, y: 1 })).toBe(true)
    expect(burning(one, { x: 2, y: 0 })).toBe(false)
    const two = round(one)
    expect(burning(two, { x: 1, y: 1 })).toBe(true)
    const out = round(round(two))
    expect(tileAt(out, { x: 0, y: 0 })).toBe("floor")
    expect(tileAt(out, { x: 1, y: 1 })).toBe("low")
  })
  test("walking into fire costs 1 HP", () => {
    const g = setup([".....", "....."], [squad("s", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 1 })])
    g.zones.push({ kind: "fire", tiles: [{ x: 1, y: 0 }], rounds: 2 })
    const a = apply(g, { type: "move", unit: "s", to: { x: 2, y: 0 } })
    expect(find(a, "s").hp).toBe(find(g, "s").hp - 1)
  })
  test("a Grenadier blast sets grass and trees on fire", () => {
    const g = setup(
      ["ggg..", "gTg..", "ggg..", ".....", "....."],
      [squad("s", "warden", { x: 4, y: 0 }), enemy("b", "bomber", { x: 1, y: 4 })],
    )
    g.phase = "enemy"
    find(g, "b").ap = 2
    const a = apply(g, { type: "ability", unit: "b", ability: "blast", at: { x: 1, y: 1 } })
    expect(burning(a, { x: 0, y: 0 })).toBe(true)
    expect(burning(a, { x: 1, y: 1 })).toBe(true)
    expect(burning(a, { x: 4, y: 0 })).toBe(false)
  })
})

describe("push", () => {
  test("a push into a wall or a unit does 2 damage", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup([".#..."], [v, e])
    e.pos = { x: 2, y: 0 }
    v.pos = { x: 3, y: 0 }
    push(g, find(g, "v").pos, find(g, "e"))
    expect(find(g, "e").hp).toBe(e.maxHp - 2)
    expect(find(g, "e").pos).toEqual({ x: 2, y: 0 })
  })
  test("a push off a roof does 2 damage", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup(["RR.."], [v, e])
    push(g, find(g, "v").pos, find(g, "e"))
    expect(find(g, "e").pos).toEqual({ x: 2, y: 0 })
    expect(find(g, "e").hp).toBe(e.maxHp - 2)
  })
  test("a push into fire burns", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup(["...."], [v, e])
    g.zones.push({ kind: "fire", tiles: [{ x: 2, y: 0 }], rounds: 2 })
    push(g, find(g, "v").pos, find(g, "e"))
    expect(find(g, "e").hp).toBe(e.maxHp - 1)
  })
})

describe("biome terrain", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1)
  const avg = (b: Biome, t: string) =>
    seeds.map((s) => map({ rng: s }, b)).reduce((n, m) => n + m.tiles.filter((x) => x === t).length, 0) / seeds.length
  test("forests have trees, grass and rocks; towns have few trees", () => {
    expect(avg("forest", "tree")).toBeGreaterThan(8)
    expect(avg("forest", "grass")).toBeGreaterThan(10)
    expect(avg("forest", "rock")).toBeGreaterThan(1)
    expect(avg("town", "tree")).toBeLessThan(avg("forest", "tree") / 3)
  })
  test("villages have fences and grass", () => {
    expect(avg("village", "low")).toBeGreaterThan(4)
    expect(avg("village", "grass")).toBeGreaterThan(6)
  })
})
