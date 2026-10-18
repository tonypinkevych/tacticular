import { Kit } from "../../src/view/kit"
import { enemy, open, setup, squad } from "../fixture"

describe("hover sets the armed target", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const c = squad("c", "cleric", { x: 1, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, c, e])
  const shot = { slot: "weapon:repeater", target: null, at: null }

  test("a foe in reach becomes the target", () => {
    expect(new Kit(g, w).retarget(shot, { x: 5, y: 1 }).target).toBe("e")
  })
  test("an ally does not become the target of an attack", () => {
    expect(new Kit(g, w).retarget(shot, { x: 1, y: 1 }).target).toBeNull()
  })
  test("an empty tile keeps the last target", () => {
    expect(new Kit(g, w).retarget({ ...shot, target: "e" }, { x: 3, y: 0 }).target).toBe("e")
  })
  test("a friendly ability takes an ally in range and not a foe", () => {
    const heal = { slot: "ability:heal", target: null, at: null }
    expect(new Kit(g, c).retarget(heal, { x: 0, y: 1 }).target).toBe("w")
    expect(new Kit(g, c).retarget(heal, { x: 5, y: 1 }).target).toBeNull()
  })
})

describe("a controlled alien", () => {
  const c = squad("c", "cleric", { x: 1, y: 1 })
  const w = squad("w", "warden", { x: 0, y: 0 })
  const e = enemy("e", "orc", { x: 2, y: 1 })
  e.give({ id: "dominated", rounds: 2 })
  const g = setup(open(8, 3), [w, c, e])

  test.each(["heal", "rally"])("takes the squad's %s by hover and as the default target", (id) => {
    const armed = { slot: `ability:${id}`, target: null, at: null }
    expect(new Kit(g, c).retarget(armed, e.pos).target).toBe("e")
  })
  test("takes Guard", () => {
    expect(new Kit(g, w).retarget({ slot: "ability:guard", target: null, at: null }, e.pos).target).toBe("e")
  })
})

describe("sights", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(["........", "........", "...#....", "........"], [w, e])

  test("the foes a soldier can target, with the hit chance and whether they are flanked", () => {
    const [s] = new Kit(g, w).sights()
    expect(s.unit.id).toBe("e")
    expect(s.chance).toBeGreaterThan(0)
    expect(s.flanked).toBe(true)
  })
  test("from another tile it lists the known foes the soldier would see there", () => {
    const far = enemy("f", "orc", { x: 6, y: 3 })
    const spotter = squad("s", "rogue", { x: 7, y: 0 })
    const walled = setup(["....#...", "....#...", "....#...", "........"], [w, far, spotter])
    expect(new Kit(walled, w).sights()).toEqual([])
    expect(new Kit(walled, w).sights({ x: 3, y: 3 }).map((s) => s.unit.id)).toEqual(["f"])
  })
})
