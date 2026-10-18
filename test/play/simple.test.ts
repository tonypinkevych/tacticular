import { Mind } from "../../src/aliens/mind"
import { crit } from "../../src/combat/combat"
import { chance, failChance } from "../../src/combat/dice"
import { WEAPONS } from "../../src/combat/weapons"
import { CLASSES, PROFILES } from "../../src/units/profiles"
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
  test("the needed roll includes the disadvantage", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "shieldwall", { x: 0, y: 8 })
    e.stance = "hunker"
    const rows = open(3, 10)
    rows[7] = ":.."
    const o = setup(rows, [r, e]).combat.odds(r, e)
    expect(o.edge).toBe(-1)
    expect(o.need).toBe(Math.min(20, o.defense - o.aim + 3))
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
  test("a sure critical from a soldier's weapon kills an Orc; the psi bolt is the exception", () => {
    for (const c of CLASSES.filter((c) => c !== "mage")) {
      const w = WEAPONS[PROFILES[c].weapon]
      expect(crit(w.dice.count + w.dice.bonus), c).toBeGreaterThanOrEqual(PROFILES.orc.hp)
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
  test("only the sniper is out of range at 1 tile", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = squad("r", "ranger", { x: 2, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const g = setup(open(4, 2), [v, r, e])
    expect(g.combat.odds(v, e).disadvantages).not.toContain("range")
    expect(g.combat.odds(r, e).disadvantages).toContain("range")
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
    expect(g.log.find((x) => x.key === "log.horn")?.params).toMatchObject({ x: 5, y: 0, radius: 15 })
  })
  test("it calls groups within 15 tiles only, and 30 for a Warchief's group", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 1, y: 0 })
    const near = enemy("n", "orc", { x: 16, y: 0 }, "unaware", "g2")
    const far = enemy("f", "orc", { x: 18, y: 1 }, "unaware", "g3")
    const g = setup(open(40, 2), [s, e, near, far])
    g.groups[0].target = { x: 0, y: 0 }
    g.stealth.horn()
    expect(near.alert).toBe("investigating")
    expect(far.alert).toBe("unaware")
    const chief = enemy("c", "warchief", { x: 1, y: 1 })
    const distant = enemy("d", "orc", { x: 31, y: 0 }, "unaware", "g2")
    const h = setup(open(40, 2), [s, chief, distant])
    h.groups[0].target = { x: 0, y: 0 }
    h.stealth.horn()
    expect(distant.alert).toBe("investigating")
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
