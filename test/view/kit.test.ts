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
