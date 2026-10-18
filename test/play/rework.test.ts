import { CLASSES, ENEMIES, PROFILES } from "../../src/rules/data"
import { enemy, find, open, setup, squad } from "../fixture"

describe("one weapon per class", () => {
  test("no soldier or enemy has a sidearm", () => {
    for (const k of [...CLASSES, ...ENEMIES]) expect(PROFILES[k].sidearm, k).toBeNull()
  })
  test("the Rogue fights with a melee dagger", () => {
    expect(PROFILES.rogue.weapon).toBe("dagger")
  })
})

describe("range and position", () => {
  test("a ranged attack on an adjacent enemy has disadvantage", () => {
    const w = squad("w", "ranger", { x: 2, y: 1 })
    const e = enemy("e", "orc", { x: 3, y: 1 })
    expect(setup(open(6, 3), [w, e]).combat.odds(w, e).disadvantages).toContain("close")
  })
  test("Pincer: a melee attack has advantage with an ally on the far side", () => {
    const v = squad("v", "rogue", { x: 1, y: 1 })
    const g = squad("g", "vanguard", { x: 3, y: 1 })
    const e = enemy("e", "orc", { x: 2, y: 1 })
    expect(setup(open(6, 3), [v, g, e]).combat.odds(v, e).advantages).toContain("pincer")
  })
  test("Pincer does not help ranged attacks", () => {
    const w = squad("w", "warden", { x: 0, y: 1 })
    const g = squad("g", "rogue", { x: 4, y: 1 })
    const e = enemy("e", "orc", { x: 3, y: 1 })
    expect(setup(open(6, 3), [w, g, e]).combat.odds(w, e).advantages).not.toContain("pincer")
  })
})

describe("cooperation statuses", () => {
  test("Mark exposes a target: no cover and advantage, for 1 AP", () => {
    const rows = open(8, 12)
    rows[7] = "...:...."
    const r = squad("r", "rogue", { x: 4, y: 2 })
    const w = squad("w", "warden", { x: 3, y: 2 })
    const e = enemy("e", "orc", { x: 3, y: 8 })
    const g = setup(rows, [r, w, e]).apply({ type: "ability", unit: "r", ability: "tag", target: "e" })
    expect(find(g, "r").ap).toBe(1)
    const o = g.combat.odds(find(g, "w"), find(g, "e"))
    expect(o.cover).toBe(0)
    expect(o.advantages).toContain("exposed")
  })
  test("Shove pushes an adjacent enemy 1 tile and staggers it", () => {
    const v = squad("v", "vanguard", { x: 1, y: 1 })
    const e = enemy("e", "orc", { x: 2, y: 1 })
    const g = setup(open(6, 3), [v, e]).apply({ type: "ability", unit: "v", ability: "shove", target: "e" })
    expect(find(g, "e").pos).toEqual({ x: 3, y: 1 })
    expect(find(g, "e").statuses.map((s) => s.id)).toContain("staggered")
    expect(g.combat.odds(find(g, "v"), find(g, "e")).advantages).toContain("staggered")
  })
  test("a staggered enemy makes no overwatch shot", () => {
    const w = squad("w", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 6, y: 2 })
    e.stance = "overwatch"
    e.statuses.push({ id: "staggered", rounds: 1 })
    const g = setup(open(12, 3), [w, e]).apply({ type: "move", unit: "w", to: { x: 2, y: 0 } })
    expect(g.log.some((x) => x.key === "log.hit" || x.key === "log.miss")).toBe(false)
  })
  test("Rally gives an ally 1 AP", () => {
    const c = squad("c", "cleric", { x: 0, y: 0 })
    const v = squad("v", "vanguard", { x: 2, y: 0 })
    const e = enemy("e", "orc", { x: 9, y: 2 })
    const g0 = setup(open(10, 3), [c, v, e])
    find(g0, "v").ap = 0
    const g = g0.apply({ type: "ability", unit: "c", ability: "rally", target: "v" })
    expect(find(g, "v").ap).toBe(1)
    expect(find(g, "c").cooldowns.rally).toBe(4)
  })
  test("Sneak Attack works on a staggered target, not on a plain one", () => {
    const plain = enemy("e", "orc", { x: 2, y: 1 }, "engaged")
    const g1 = setup(open(6, 3), [squad("g", "rogue", { x: 1, y: 1 }), plain])
    expect(g1.combat.odds(find(g1, "g"), find(g1, "e")).max).toBe(4)
    const hit = enemy("e", "orc", { x: 2, y: 1 }, "engaged")
    hit.statuses.push({ id: "staggered", rounds: 1 })
    const g2 = setup(open(6, 3), [squad("g", "rogue", { x: 1, y: 1 }), hit])
    expect(g2.combat.odds(find(g2, "g"), find(g2, "e")).max).toBe(4 + 2)
  })
  test("a melee attack gets no flank advantage", () => {
    const v = squad("v", "rogue", { x: 1, y: 1 })
    const e = enemy("e", "orc", { x: 2, y: 1 })
    expect(setup(open(6, 3), [v, e]).combat.odds(v, e).advantages).not.toContain("flanked")
  })
})

describe("stealthy Rogue", () => {
  test("unaware enemies do not detect a concealed Rogue, even next to them", () => {
    const g = setup(open(12, 3), [squad("g", "rogue", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 }, "unaware")])
    const a = g.apply({ type: "move", unit: "g", to: { x: 5, y: 1 } })
    expect(find(a, "g").concealed).toBe(true)
  })
  test("investigating enemies detect a concealed Rogue within 1 tile", () => {
    const g = setup(open(12, 3), [
      squad("g", "rogue", { x: 0, y: 1 }),
      enemy("e", "orc", { x: 6, y: 1 }, "investigating"),
    ])
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 4, y: 1 } }), "g").concealed).toBe(true)
    expect(find(g.apply({ type: "move", unit: "g", to: { x: 5, y: 1 } }), "g").concealed).toBe(false)
  })
})
