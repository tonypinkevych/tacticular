import { WEAPONS } from "../../src/combat/weapons"
import type { Game } from "../../src/mission/game"
import { CLASSES, PROFILES } from "../../src/units/profiles"
import { enemy, find, open, setup, squad } from "../fixture"

const use = (g: Game, unit: string, ability: string, more: { target?: string; at?: { x: number; y: number } } = {}) =>
  g.apply({ type: "ability", unit, ability: ability as never, ...more })

describe("kits", () => {
  test("seven classes, each with two skills and an ultimate", () => {
    expect(CLASSES).toHaveLength(7)
    for (const c of CLASSES) expect(PROFILES[c].abilities).toHaveLength(2)
    for (const c of CLASSES) expect(PROFILES[c].ultimate).not.toBeNull()
  })
})

describe("Sniper", () => {
  test("Grapple climbs onto a roof for no AP", () => {
    const g = setup(["...RR", "...RR"], [squad("r", "ranger", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 1 })])
    const a = use(g, "r", "grapple", { at: { x: 3, y: 0 } })
    expect(find(a, "r").pos).toEqual({ x: 3, y: 0 })
    expect(find(a, "r").ap).toBe(2)
  })
  test("Guard shoots the first alien that steps next to the guarded ally", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const s = squad("s", "warden", { x: 0, y: 4 })
    const e = enemy("e", "orc", { x: 6, y: 4 })
    const g = use(setup(open(8, 6), [r, s, e]), "r", "guard", { target: "s" })
    const b = g.apply({ type: "endTurn" }).apply({ type: "move", unit: "e", to: { x: 1, y: 4 } })
    const shots = b.log.filter((x) => x.params.unit === "r" && x.params.reaction === true)
    expect(shots).toHaveLength(1)
    expect(find(b, "s").has("guarded")).toBe(false)
  })
})

describe("Heavy", () => {
  test("Rocket hits a 3×3 area for 2 and pushes units out of it", () => {
    const g = setup(open(10, 5), [
      squad("w", "warden", { x: 0, y: 2 }),
      enemy("a", "orc", { x: 5, y: 2 }),
      enemy("b", "orc", { x: 6, y: 2 }),
    ])
    const a = use(g, "w", "rocket", { at: { x: 5, y: 2 } })
    expect(find(a, "a").hp).toBe(find(g, "a").maxHp - 2)
    expect(find(a, "b").pos).toEqual({ x: 7, y: 2 })
    expect(find(a, "w").ap).toBe(0)
  })
})

describe("Medic", () => {
  test("passive: a downed soldier lasts 3 rounds while a Medic lives", () => {
    const g = setup(open(4, 2), [squad("c", "cleric", { x: 0, y: 0 }), squad("v", "vanguard", { x: 1, y: 0 })])
    g.combat.hurt(find(g, "v"), 99)
    expect(find(g, "v").down).toBe(3)
  })
  test("Smoke covers a 3×3 area", () => {
    const g = setup(open(8, 5), [squad("c", "cleric", { x: 0, y: 2 }), enemy("e", "orc", { x: 7, y: 2 })])
    const a = use(g, "c", "smoke", { at: { x: 3, y: 2 } })
    expect(a.zones.find((z) => z.kind === "smoke")?.tiles).toHaveLength(9)
  })
})

describe("Scout", () => {
  test("Hook pulls an alien 2 tiles toward the Scout", () => {
    const g = setup(open(8, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 })])
    expect(find(use(g, "g", "hook", { target: "e" }), "e").pos).toEqual({ x: 2, y: 0 })
  })
  test("Mark exposes an alien and keeps the Scout concealed", () => {
    const g = setup(open(8, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 5, y: 0 }, "unaware")])
    const a = use(g, "g", "tag", { target: "e" })
    expect(find(a, "e").has("exposed")).toBe(true)
    expect(find(a, "g").concealed).toBe(true)
  })
  test("Mark lasts 1 round and ends after the first sure hit on the target", () => {
    const g = setup(open(8, 2), [
      squad("g", "rogue", { x: 0, y: 0 }),
      squad("w", "warden", { x: 0, y: 1 }),
      enemy("e", "orc", { x: 5, y: 0 }),
    ])
    find(g, "e").hp = 50
    const a = use(g, "g", "tag", { target: "e" })
    expect(find(a, "e").statuses.find((x) => x.id === "exposed")?.rounds).toBe(1)
    const b = a.apply({ type: "attack", unit: "w", target: "e" })
    expect(find(b, "e").has("exposed")).toBe(false)
  })
})

describe("Psi operative", () => {
  test("passive: the psi bolt ignores cover", () => {
    expect(WEAPONS.bolt.ignoresCover).toBe(true)
  })
  test("Swap trades places with a unit", () => {
    const g = setup(open(8, 2), [squad("m", "mage", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 })])
    const a = use(g, "m", "swap", { target: "e" })
    expect(find(a, "m").pos).toEqual({ x: 4, y: 0 })
    expect(find(a, "e").pos).toEqual({ x: 0, y: 0 })
  })
})

describe("Engineer", () => {
  test("Barricade builds high cover next to the Engineer", () => {
    const g = setup(open(6, 3), [squad("n", "engineer", { x: 1, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    expect(use(g, "n", "barricade", { at: { x: 2, y: 1 } }).tile({ x: 2, y: 1 })).toBe("high")
  })
  test("Mine: an alien that steps on it takes 2, is pushed and exposed", () => {
    const g = setup(open(8, 3), [squad("n", "engineer", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const a = use(g, "n", "mine", { at: { x: 3, y: 1 } }).apply({ type: "endTurn" })
    const b = a.apply({ type: "move", unit: "e", to: { x: 2, y: 1 } })
    expect(find(b, "e").hp).toBe(find(g, "e").maxHp - 2)
    expect(find(b, "e").has("exposed")).toBe(true)
    expect(b.zones.some((z) => z.kind === "mine")).toBe(false)
  })
})
