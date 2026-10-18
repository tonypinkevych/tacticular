import { apply, Illegal } from "../src/rules/actions"
import { attack } from "../src/rules/combat"
import { PROFILES, ULT } from "../src/rules/data"
import { tileAt } from "../src/rules/grid"
import type { Game } from "../src/rules/types"
import { has, sideOf } from "../src/rules/units"
import { enemy, find, open, setup, squad } from "./fixture"

const ult = (g: Game, unit: string, ability: string, more: { target?: string; at?: { x: number; y: number } } = {}) => {
  find(g, unit).ult = ULT
  return apply(g, { type: "ability", unit, ability: ability as never, ...more })
}

describe("meter", () => {
  test("each class has an ultimate", () => {
    for (const c of ["vanguard", "ranger", "warden", "cleric", "rogue", "mage", "engineer"] as const)
      expect(PROFILES[c].ultimate).toBeTruthy()
  })
  test("a hit gives 1, a kill 2 more, up to the cap", () => {
    for (let seed = 1; seed < 100; seed++) {
      const g = setup(open(6, 2), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 3, y: 0 })], seed)
      const w = find(g, "w")
      const e = find(g, "e")
      attack(g, w, e)
      if (e.hp === e.maxHp) continue
      expect(w.ult).toBe(e.hp > 0 ? 1 : 3)
      w.ult = ULT
      e.hp = 1
      attack(g, w, e)
      expect(w.ult).toBe(ULT)
      return
    }
    throw new Error("no hit")
  })
  test("an ultimate needs a full meter and empties it", () => {
    const g = setup(open(6, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 3, y: 0 })])
    expect(() => apply(g, { type: "ability", unit: "g", ability: "ghost" })).toThrow(Illegal)
    expect(find(ult(g, "g", "ghost"), "g").ult).toBe(0)
  })
})

describe("ultimates", () => {
  test("Rampage charges alien after alien while it kills", () => {
    const g = setup(open(10, 3), [
      squad("v", "vanguard", { x: 0, y: 1 }),
      enemy("a", "orc", { x: 3, y: 1 }),
      enemy("b", "orc", { x: 5, y: 1 }),
    ])
    for (let seed = 1; seed < 200; seed++) {
      const s = { ...structuredClone(g), rng: seed }
      find(s, "a").hp = 1
      find(s, "b").hp = 1
      const a = ult(s, "v", "rampage", { target: "a" })
      if (find(a, "a").hp > 0) continue
      expect(find(a, "b").hp).toBe(0)
      return
    }
    throw new Error("no kill")
  })
  test("Killzone fires at each alien that moves in sight", () => {
    const g = setup(open(12, 4), [
      squad("r", "ranger", { x: 0, y: 0 }),
      enemy("a", "orc", { x: 8, y: 2 }),
      enemy("b", "orc", { x: 8, y: 3 }),
    ])
    let a = apply(ult(g, "r", "killzone"), { type: "endTurn" })
    a = apply(a, { type: "move", unit: "a", to: { x: 6, y: 2 } })
    a = apply(a, { type: "move", unit: "b", to: { x: 6, y: 3 } })
    expect(a.log.filter((x) => x.params.unit === "r" && x.params.reaction === true)).toHaveLength(2)
  })
  test("Saturation hits everyone in a cone for 2 and breaks cover", () => {
    const rows = open(10, 5)
    rows[2] = "....:....."
    const g = setup(rows, [
      squad("w", "warden", { x: 0, y: 2 }),
      enemy("a", "orc", { x: 5, y: 2 }),
      enemy("b", "orc", { x: 5, y: 0 }),
      enemy("c", "orc", { x: 0, y: 4 }),
    ])
    const a = ult(g, "w", "saturation", { at: { x: 5, y: 2 } })
    expect(find(a, "a").hp).toBe(find(g, "a").maxHp - 2)
    expect(find(a, "b").hp).toBe(find(g, "b").maxHp - 2)
    expect(find(a, "c").hp).toBe(find(g, "c").maxHp)
    expect(tileAt(a, { x: 4, y: 2 })).toBe("floor")
  })
  test("Field hospital heals and clears allies within 3 and revives the downed", () => {
    const g = setup(open(8, 2), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 2, y: 0 }),
      squad("d", "warden", { x: 3, y: 1 }),
      squad("f", "rogue", { x: 7, y: 0 }),
    ])
    find(g, "v").hp = 2
    find(g, "v").statuses.push({ id: "frightened", rounds: 2 })
    find(g, "d").hp = 0
    find(g, "d").down = 2
    find(g, "f").hp = 2
    const a = ult(g, "c", "hospital")
    expect(find(a, "v").hp).toBe(5)
    expect(has(find(a, "v"), "frightened")).toBe(false)
    expect(find(a, "d").hp).toBe(3)
    expect(find(a, "d").down).toBe(0)
    expect(find(a, "f").hp).toBe(2)
  })
  test("Ghost conceals the Scout even in sight and gives 1 AP", () => {
    const g = setup(open(8, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 3, y: 0 })])
    find(g, "g").concealed = false
    const a = ult(g, "g", "ghost")
    expect(find(a, "g").concealed).toBe(true)
    expect(find(a, "g").ap).toBe(3)
  })
  test("Dominate puts an alien on the squad's side", () => {
    for (let seed = 1; seed < 100; seed++) {
      const g = setup(open(8, 2), [squad("m", "mage", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 })], seed)
      const a = ult(g, "m", "dominate", { target: "e" })
      if (a.log.find((x) => x.key === "log.dominate")!.params.saved) continue
      expect(sideOf(find(a, "e"))).toBe("squad")
      return
    }
    throw new Error("no failed save")
  })
  test("Turret: overwatch every round for 3 rounds, then gone", () => {
    const g = setup(open(10, 3), [squad("n", "engineer", { x: 0, y: 1 }), enemy("e", "orc", { x: 9, y: 1 })])
    let a = ult(g, "n", "turret", { at: { x: 1, y: 1 } })
    const turret = a.units.find((u) => u.kind === "turret")!
    a = apply(a, { type: "endTurn" })
    expect(find(a, turret.id).stance).toBe("overwatch")
    for (let i = 0; i < 3; i++) a = apply(apply(a, { type: "endTurn" }), { type: "endTurn" })
    expect(find(a, turret.id).hp).toBe(0)
  })
})
