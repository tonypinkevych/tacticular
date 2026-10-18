import { decide } from "../src/ai/ai"
import { apply } from "../src/rules/actions"
import { DETECTION, HORN, PROFILES, WEAPONS } from "../src/rules/data"
import { mission } from "../src/rules/mission"
import { enemy, find, open, setup, squad } from "./fixture"

const seeds = Array.from({ length: 100 }, (_, i) => i + 1)

describe("scale", () => {
  test("a mission is 16 by 16 with 3 soldiers and 2 alien groups of 2-3", () => {
    for (const seed of seeds) {
      const g = mission(seed)
      expect([g.board.width, g.board.height]).toEqual([16, 16])
      expect(g.units.filter((u) => u.side === "squad")).toHaveLength(3)
      expect(g.groups).toHaveLength(2)
      for (const group of g.groups) {
        const size = g.units.filter((u) => u.group === group.id).length
        expect(size).toBeGreaterThanOrEqual(2)
        expect(size).toBeLessThanOrEqual(3)
      }
    }
  })
  test("soldiers move 3-5 tiles per AP and see 6, the Sniper 7", () => {
    for (const kind of ["vanguard", "ranger", "warden", "cleric", "rogue", "mage"] as const) {
      expect(PROFILES[kind].mobility).toBeGreaterThanOrEqual(3)
      expect(PROFILES[kind].mobility).toBeLessThanOrEqual(5)
      expect(PROFILES[kind].vision).toBe(kind === "ranger" ? 7 : 6)
    }
  })
  test("detection, alarm and weapon ranges fit the small map", () => {
    expect(DETECTION.unaware).toBe(2)
    expect(DETECTION.investigating).toBe(4)
    expect(HORN).toBe(6)
    expect(WEAPONS.shotgun.max).toBe(3)
    expect(WEAPONS.repeater.max).toBe(6)
    expect(WEAPONS.longbow.min).toBe(4)
  })
})

describe("no ghosts and no items", () => {
  test("the game keeps no last known alien positions", () => {
    const g = setup(open(12, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    expect("ghosts" in g).toBe(false)
  })
  test("soldiers carry no items", () => {
    expect("items" in squad("v", "vanguard", { x: 0, y: 0 })).toBe(false)
  })
  test("a Grenadier blasts the tile it marked, as an ability", () => {
    const s = squad("s", "warden", { x: 0, y: 1 })
    const b = enemy("b", "bomber", { x: 4, y: 1 })
    const g = setup(open(8, 3), [s, b])
    b.intent = { type: "bomb", at: { x: 0, y: 1 } }
    g.phase = "enemy"
    b.ap = 2
    const a = decide(g, b)
    expect(a).toMatchObject({ type: "ability", ability: "blast", at: { x: 0, y: 1 } })
    const after = apply(g, a!)
    expect(find(after, "s").hp).toBeLessThan(s.hp)
  })
})
