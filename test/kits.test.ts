import { apply } from "../src/rules/actions"
import { hurt, odds } from "../src/rules/combat"
import { CLASSES, PROFILES, WEAPONS } from "../src/rules/data"
import { tileAt } from "../src/rules/grid"
import type { Game } from "../src/rules/types"
import { has } from "../src/rules/units"
import { enemy, find, open, setup, squad } from "./fixture"

const use = (g: Game, unit: string, ability: string, more: { target?: string; at?: { x: number; y: number } } = {}) =>
  apply(g, { type: "ability", unit, ability: ability as never, ...more })

describe("kits", () => {
  test("seven classes, each with three skills", () => {
    expect(CLASSES).toHaveLength(7)
    for (const c of CLASSES) expect(PROFILES[c].abilities).toHaveLength(3)
  })
})

describe("Assault", () => {
  test("passive: +1 edge at range 2 or less", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 2, y: 0 })
    const far = enemy("f", "orc", { x: 3, y: 1 })
    const g = setup(open(6, 3), [v, e, far])
    expect(odds(g, v, e).advantages).toContain("point")
    expect(odds(g, v, far).advantages).not.toContain("point")
  })
  test("Breach opens a door and staggers the aliens next to it", () => {
    const g = setup(
      ["..#..", "..+..", "..#.."],
      [squad("v", "vanguard", { x: 1, y: 1 }), enemy("e", "orc", { x: 3, y: 1 })],
    )
    const a = use(g, "v", "breach", { at: { x: 2, y: 1 } })
    expect(tileAt(a, { x: 2, y: 1 })).toBe("open")
    expect(has(find(a, "e"), "staggered")).toBe(true)
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
    const b = apply(apply(g, { type: "endTurn" }), { type: "move", unit: "e", to: { x: 1, y: 4 } })
    const shots = b.log.filter((x) => x.params.unit === "r" && x.params.reaction === true)
    expect(shots).toHaveLength(1)
    expect(has(find(b, "s"), "guarded")).toBe(false)
  })
  test("Steady: +1 edge on the next shot, for no AP, if the Sniper did not move", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 5, y: 0 })
    const g = use(setup(open(8, 2), [r, e]), "r", "steady")
    expect(find(g, "r").ap).toBe(2)
    expect(odds(g, find(g, "r"), find(g, "e")).advantages).toContain("steady")
  })
})

describe("Heavy", () => {
  test("passive: the first hit each round does 1 less damage", () => {
    const w = squad("w", "warden", { x: 0, y: 0 })
    const g = apply(apply(setup(open(4, 2), [w, enemy("e", "orc", { x: 3, y: 0 })]), { type: "endTurn" }), {
      type: "endTurn",
    })
    const h = find(g, "w")
    hurt(g, h, 3)
    hurt(g, h, 3)
    expect(h.hp).toBe(h.maxHp - 5)
  })
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
  test("Brace: overwatch and hunker at once", () => {
    const g = setup(["..:.", "...."], [squad("w", "warden", { x: 1, y: 0 }), enemy("e", "orc", { x: 3, y: 1 })])
    const a = use(g, "w", "brace")
    expect(find(a, "w").stance).toBe("overwatch")
    expect(odds(a, find(a, "e"), find(a, "w")).disadvantages).toContain("hunkered")
  })
})

describe("Medic", () => {
  test("passive: a downed soldier lasts 3 rounds while a Medic lives", () => {
    const g = setup(open(4, 2), [squad("c", "cleric", { x: 0, y: 0 }), squad("v", "vanguard", { x: 1, y: 0 })])
    hurt(g, find(g, "v"), 99)
    expect(find(g, "v").down).toBe(3)
  })
  test("Smoke covers a 3×3 area", () => {
    const g = setup(open(8, 5), [squad("c", "cleric", { x: 0, y: 2 }), enemy("e", "orc", { x: 7, y: 2 })])
    const a = use(g, "c", "smoke", { at: { x: 3, y: 2 } })
    expect(a.zones.find((z) => z.kind === "smoke")?.tiles).toHaveLength(9)
  })
  test("Stim gives an ally 1 AP", () => {
    const g = setup(open(6, 2), [squad("c", "cleric", { x: 0, y: 0 }), squad("v", "vanguard", { x: 2, y: 0 })])
    expect(find(use(g, "c", "rally", { target: "v" }), "v").ap).toBe(3)
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
    expect(has(find(a, "e"), "exposed")).toBe(true)
    expect(find(a, "g").concealed).toBe(true)
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
    expect(tileAt(use(g, "n", "barricade", { at: { x: 2, y: 1 } }), { x: 2, y: 1 })).toBe("high")
  })
  test("Drone puts a spotter next to the Engineer; a new one replaces the old", () => {
    const g = setup(open(6, 3), [squad("n", "engineer", { x: 1, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    const a = use(g, "n", "drone", { at: { x: 1, y: 0 } })
    const drone = a.units.find((u) => u.kind === "drone")!
    expect(drone.side).toBe("squad")
    expect(drone.pos).toEqual({ x: 1, y: 0 })
    a.units.find((u) => u.id === "n")!.cooldowns = {}
    a.units.find((u) => u.id === "n")!.ap = 2
    const b = use(a, "n", "drone", { at: { x: 1, y: 2 } })
    expect(b.units.filter((u) => u.kind === "drone" && u.hp > 0)).toHaveLength(1)
  })
  test("a drone does not count as a soldier for the mission end", () => {
    const g = setup(open(6, 3), [squad("n", "engineer", { x: 1, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    const a = use(g, "n", "drone", { at: { x: 1, y: 0 } })
    hurt(a, find(a, "n"), 99)
    find(a, "n").down = 0
    const drone = a.units.find((u) => u.kind === "drone")!
    const b = apply(a, { type: "move", unit: drone.id, to: { x: 2, y: 0 } })
    expect(b.phase).toBe("lost")
  })
  test("Mine: an alien that steps on it takes 2, is pushed and Staggered", () => {
    const g = setup(open(8, 3), [squad("n", "engineer", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const a = apply(use(g, "n", "mine", { at: { x: 3, y: 1 } }), { type: "endTurn" })
    const b = apply(a, { type: "move", unit: "e", to: { x: 2, y: 1 } })
    expect(find(b, "e").hp).toBe(find(g, "e").maxHp - 2)
    expect(has(find(b, "e"), "staggered")).toBe(true)
    expect(b.zones.some((z) => z.kind === "mine")).toBe(false)
  })
})
