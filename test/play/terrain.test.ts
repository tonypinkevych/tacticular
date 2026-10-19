import { Dice } from "../../src/combat/dice"
import type { Biome, Board } from "../../src/map/board"
import { key } from "../../src/map/point"
import { map } from "../../src/map/terrain"
import { passable } from "../../src/map/tile"
import type { Game } from "../../src/mission/game"
import { enemy, find, setup, squad } from "../fixture"

const round = (g: Game): Game => g.apply({ type: "endTurn" }).apply({ type: "endTurn" })

describe("trees and rocks", () => {
  test("both are high cover that blocks sight", () => {
    const g = setup(["......", ".T..o.", "......"])
    expect(g.cover.against({ x: 0, y: 1 }, { x: 3, y: 1 })).toBe(5)
    expect(g.cover.against({ x: 5, y: 1 }, { x: 2, y: 1 })).toBe(5)
    expect(g.sight.clear({ x: 0, y: 1 }, { x: 3, y: 1 })).toBe(false)
  })
  test("a tree breaks into low cover, a rock does not break", () => {
    const g = setup([".T.o."])
    g.board.break({ x: 1, y: 0 })
    g.board.break({ x: 3, y: 0 })
    expect(g.tile({ x: 1, y: 0 })).toBe("low")
    expect(g.tile({ x: 3, y: 0 })).toBe("rock")
  })
})

describe("mud", () => {
  test("a step into mud costs 2", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const g = setup([".mm.."], [s])
    const r = g.reach(s, 10)
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
    const near = g.apply({ type: "move", unit: "s", to: { x: 3, y: 1 } })
    expect(find(near, "s").concealed).toBe(true)
    const next = near.apply({ type: "move", unit: "s", to: { x: 4, y: 1 } })
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
    expect(one.fire.burning({ x: 1, y: 0 })).toBe(true)
    expect(one.fire.burning({ x: 0, y: 1 })).toBe(true)
    expect(one.fire.burning({ x: 2, y: 0 })).toBe(false)
    const two = round(one)
    expect(two.fire.burning({ x: 1, y: 1 })).toBe(true)
    const out = round(round(two))
    expect(out.tile({ x: 0, y: 0 })).toBe("floor")
    expect(out.tile({ x: 1, y: 1 })).toBe("low")
  })
  test("walking into fire costs 1 HP", () => {
    const g = setup(
      [".....", "....."],
      [squad("s", "warden", { x: 0, y: 0 }), enemy("e", "shieldwall", { x: 4, y: 1 })],
    )
    g.zones.push({ kind: "fire", tiles: [{ x: 1, y: 0 }], rounds: 2 })
    const a = g.apply({ type: "move", unit: "s", to: { x: 2, y: 0 } })
    expect(find(a, "s").hp).toBe(find(g, "s").hp - 1)
  })
  test("a Grenadier blast sets grass and trees on fire", () => {
    const g = setup(
      ["ggg..", "gTg..", "ggg..", ".....", "....."],
      [squad("s", "warden", { x: 4, y: 0 }), enemy("b", "bomber", { x: 1, y: 4 })],
    )
    g.phase = "enemy"
    find(g, "b").ap = 2
    const a = g.apply({ type: "ability", unit: "b", ability: "blast", at: { x: 1, y: 1 } })
    expect(a.fire.burning({ x: 0, y: 0 })).toBe(true)
    expect(a.fire.burning({ x: 1, y: 1 })).toBe(true)
    expect(a.fire.burning({ x: 4, y: 0 })).toBe(false)
  })
})

describe("push", () => {
  test("a push into a wall or a unit does 2 damage", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup([".#..."], [v, e])
    e.pos = { x: 2, y: 0 }
    v.pos = { x: 3, y: 0 }
    g.combat.push(find(g, "v").pos, find(g, "e"))
    expect(find(g, "e").hp).toBe(e.maxHp - 2)
    expect(find(g, "e").pos).toEqual({ x: 2, y: 0 })
  })
  test("a push off a roof does 2 damage", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup(["RR.."], [v, e])
    g.combat.push(find(g, "v").pos, find(g, "e"))
    expect(find(g, "e").pos).toEqual({ x: 2, y: 0 })
    expect(find(g, "e").hp).toBe(e.maxHp - 2)
  })
  test("a push into fire burns", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup(["...."], [v, e])
    g.zones.push({ kind: "fire", tiles: [{ x: 2, y: 0 }], rounds: 2 })
    g.combat.push(find(g, "v").pos, find(g, "e"))
    expect(find(g, "e").hp).toBe(e.maxHp - 1)
  })
})

const SYMBOL: Record<string, string> = { floor: ".", low: ":", high: "H", wall: "#", door: "+", rock: "o" }

describe("barrels", () => {
  test("most maps hold a few barrels", () => {
    const maps = Array.from({ length: 40 }, (_, i) => map(new Dice({ rng: i + 1 })))
    const counts = maps.map((b) => b.tiles.filter((t) => t === "barrel").length)
    expect(counts.filter((n) => n >= 3).length).toBeGreaterThanOrEqual(36)
  })
})

describe("set pieces", () => {
  test("most maps hold a crashed ship, a checkpoint or a farm", () => {
    const marks = ["H#oo#H", ":.....:", "#...#.HH"]
    const maps = Array.from({ length: 40 }, (_, i) => map(new Dice({ rng: i + 1 })))
    const rows = (b: Board) =>
      Array.from({ length: b.height }, (_, y) =>
        Array.from({ length: b.width }, (_, x) => SYMBOL[b.at({ x, y })] ?? "?").join(""),
      )
    const held = maps.filter((b) => rows(b).some((r) => marks.some((m) => r.includes(m))))
    expect(held.length).toBeGreaterThanOrEqual(36)
  })
})

describe("biome terrain", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1)
  const avg = (b: Biome, t: string) =>
    seeds.map((s) => map(new Dice({ rng: s }), b)).reduce((n, m) => n + m.tiles.filter((x) => x === t).length, 0) /
    seeds.length
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

describe("layouts", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1)
  const crossings = (b: Board) =>
    Array.from({ length: b.height }, (_, y) => y).filter((y) =>
      Array.from({ length: Math.ceil(b.width * 0.2) + 1 }, (_, i) => Math.floor(b.width * 0.4) + i).every((x) =>
        passable(b.at({ x, y })),
      ),
    ).length
  test("a barrier map lets few rows straight across its middle, an open map lets many", () => {
    const avg = (layout: "barrier" | "open") =>
      seeds.reduce((n, s) => n + crossings(map(new Dice({ rng: s }), "village", [], layout)), 0) / seeds.length
    expect(avg("barrier")).toBeLessThan(3.5)
    expect(avg("open")).toBeGreaterThan(8)
  })
  test("about half the maps are open", () => {
    const open = seeds.filter((s) => crossings(map(new Dice({ rng: s }))) >= 6).length
    expect(open).toBeGreaterThan(12)
    expect(open).toBeLessThan(28)
  })
})
