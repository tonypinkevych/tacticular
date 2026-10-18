import { enemy, find, open, reseed, setup, squad } from "../fixture"

describe("odds", () => {
  test("cover adds defense and removes the flank", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const rows = open(3, 10)
    rows[7] = ":.."
    const g = setup(rows, [r, e])
    const o = g.combat.odds(r, e)
    expect(o.cover).toBe(2)
    expect(o.defense).toBe(13)
    expect(o.edge).toBe(0)
    expect(o.chance).toBeCloseTo(0.7)
  })
  test("an open target is flanked: a sure hit", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const o = setup(open(3, 10), [r, e]).combat.odds(r, e)
    expect(o.advantages).toContain("flanked")
    expect(o.sure).toBe(true)
    expect(o.chance).toBe(1)
  })
  test("a sure hit forecasts critical damage", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const o = setup(open(3, 10), [r, e]).combat.odds(r, e)
    expect([o.min, o.max]).toEqual([8, 11])
  })
  test("overwatch disadvantage cancels the unaware advantage", () => {
    const w = squad("w", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 4 }, "unaware")
    const rows = open(3, 6)
    rows[3] = ":.."
    const o = setup(rows, [w, e]).combat.odds(w, e, "repeater", { reaction: true })
    expect(o.advantages).toEqual(["unaware"])
    expect(o.disadvantages).toEqual(["reaction"])
    expect(o.edge).toBe(0)
  })
  test("a wounded attacker is shaken", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 6 })
    r.hp = Math.floor(r.maxHp / 2)
    expect(setup(open(3, 10), [r, e]).combat.odds(r, e).disadvantages).toContain("shaken")
  })
  test("past best range: disadvantage only, Aim stays", () => {
    const c = squad("c", "cleric", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 10 })
    const o = setup(open(3, 12), [c, e]).combat.odds(c, e)
    expect(o.disadvantages).toContain("range")
    expect(o.aim).toBe(3)
  })
  test("ward adds 2 defense, a Shield trooper ally adds 1", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const s = enemy("s", "shieldwall", { x: 1, y: 8 })
    e.give({ id: "ward", rounds: 2 })
    const o = setup(open(3, 10), [r, e, s]).combat.odds(r, e)
    expect(o.defense).toBe(14)
  })
})

describe("results", () => {
  test("a sure hit is always a critical hit, whatever the die", () => {
    const g = setup(open(3, 10), [squad("r", "ranger", { x: 0, y: 0 }), enemy("e", "orc", { x: 0, y: 6 })])
    for (let seed = 1; seed <= 20; seed++) {
      const a = reseed(g, seed).apply({ type: "attack", unit: "r", target: "e" })
      expect(a.log.some((x) => x.key === "log.crit")).toBe(true)
    }
  })
  test("an attack logs the hit chance it had", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const g = setup(open(3, 10), [r, e])
    const expected = Math.round(g.combat.odds(r, e).chance * 100)
    g.combat.attack(r, e)
    expect(g.log.find((x) => x.key !== "log.dies")?.params.chance).toBe(expected)
  })
  test("an attack logs the roll it needed and the die it rolled", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 8 })
    const g = setup(open(3, 10), [r, e])
    const need = g.combat.odds(r, e).need
    g.combat.attack(r, e)
    const p = g.log.find((x) => x.key !== "log.dies")!.params
    expect(p.need).toBe(need)
    expect(p.total).toBe(Number(p.roll) + g.combat.odds(r, e).aim + 3 * g.combat.odds(r, e).edge)
  })
})

describe("barrels", () => {
  test("a barrel blows up: 3 damage to everyone in 3×3, cover in it breaks, the barrel is gone", () => {
    const g = setup(
      ["......", ".:b...", "......"],
      [squad("s", "warden", { x: 2, y: 0 }), enemy("e", "orc", { x: 3, y: 2 })],
    )
    g.combat.smash({ x: 2, y: 1 })
    expect(g.tile({ x: 2, y: 1 })).toBe("floor")
    expect(g.tile({ x: 1, y: 1 })).toBe("floor")
    expect(find(g, "s").hp).toBe(find(g, "s").maxHp - 3)
    expect(find(g, "e").hp).toBe(find(g, "e").maxHp - 3)
  })
  test("a blast sets off the barrels next to it", () => {
    const g = setup([".bb...b"])
    g.combat.smash({ x: 1, y: 0 })
    expect(g.tile({ x: 2, y: 0 })).toBe("floor")
    expect(g.tile({ x: 6, y: 0 })).toBe("barrel")
  })
})
