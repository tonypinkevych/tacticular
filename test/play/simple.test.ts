import { Mind } from "../../src/ai/mind"
import { crit } from "../../src/rules/combat"
import { PROFILES, WEAPONS } from "../../src/rules/data"
import { chance, failChance } from "../../src/rules/dice"
import { enemy, open, setup, squad } from "../fixture"

describe("simplified d20", () => {
  test("each step of edge is ±3 on one die", () => {
    expect(chance(4, 12, 1)).toBeCloseTo(0.8)
    expect(chance(4, 12, -1)).toBeCloseTo(0.5)
  })
  test("a save with an edge gets +3", () => {
    expect(failChance(1, 14, 1)).toBeCloseTo(0.45)
  })
  test("one die per roll", () => {
    const g = setup(open(), [], 7)
    const roll = g.dice.d20()
    expect(roll).toBeGreaterThanOrEqual(1)
    expect(roll).toBeLessThanOrEqual(20)
  })
  test("the needed roll includes the edge", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "shieldwall", { x: 0, y: 8 }, "unaware")
    const o = setup(open(3, 10), [r, e]).combat.odds(r, e)
    expect(o.edge).toBe(2)
    expect(o.need).toBe(Math.max(2, o.defense - o.aim - 6))
  })
})

describe("damage", () => {
  test("every weapon has a small damage range", () => {
    for (const w of Object.values(WEAPONS)) {
      const lo = w.dice.count + w.dice.bonus
      const hi = w.dice.count * w.dice.sides + w.dice.bonus
      expect(hi - lo).toBeLessThanOrEqual(2)
      expect(hi).toBeLessThanOrEqual(7)
    }
  })
  test("a crit adds half the damage, rounded up", () => {
    expect(crit(4)).toBe(6)
    expect(crit(5)).toBe(8)
  })
  test("no unit has armor", () => {
    for (const p of Object.values(PROFILES)) expect("armor" in p).toBe(false)
  })
})

describe("shotgun and close range", () => {
  test("the Assault carries a shotgun with range 1–3", () => {
    expect(PROFILES.vanguard.weapon).toBe("shotgun")
    expect(WEAPONS.shotgun).toMatchObject({ min: 1, max: 3, melee: false })
  })
  test("only the sniper is too close at 1 tile", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = squad("r", "ranger", { x: 2, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup(open(4, 2), [v, r, e])
    expect(g.combat.odds(v, e).disadvantages).not.toContain("close")
    expect(g.combat.odds(r, e).disadvantages).toContain("close")
  })
})

describe("alarm", () => {
  test("a group sounds the alarm once", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 5, y: 0 })
    const g = setup(open(12, 2), [s, e])
    g.groups[0].target = { x: 0, y: 0 }
    g.stealth.horn()
    g.stealth.horn()
    expect(g.log.filter((x) => x.key === "log.horn")).toHaveLength(1)
  })
  test("it calls groups within 6 tiles only", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const near = enemy("n", "orc", { x: 7, y: 0 }, "unaware", "g2")
    const far = enemy("f", "orc", { x: 9, y: 1 }, "unaware", "g3")
    const g = setup(open(16, 2), [s, e, near, far])
    g.groups[0].target = { x: 0, y: 0 }
    g.stealth.horn()
    expect(near.alert).toBe("investigating")
    expect(far.alert).toBe("unaware")
  })
})

describe("AI friendly fire", () => {
  test("a grenadier does not throw onto an ally", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const b = enemy("b", "bomber", { x: 5, y: 0 })
    const o = enemy("o", "orc", { x: 1, y: 1 })
    const g = setup(open(8, 3), [s, b, o])
    b.intent = { type: "bomb", at: { x: 0, y: 0 } }
    const a = new Mind(g).decide(b)
    expect(a?.type === "ability" && a.ability === "blast").toBe(false)
  })
})
