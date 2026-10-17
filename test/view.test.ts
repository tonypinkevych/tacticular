import type { Frame } from "../src/play"
import { retarget } from "../src/view/model"
import { Playback } from "../src/view/motion"
import { enemy, open, setup, squad } from "./fixture"

describe("hover sets the armed target", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const c = squad("c", "cleric", { x: 1, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, c, e])
  const shot = { slot: "weapon:repeater", target: null, at: null }

  test("a foe in reach becomes the target", () => {
    expect(retarget(g, w, shot, { x: 5, y: 1 }).target).toBe("e")
  })
  test("an ally does not become the target of an attack", () => {
    expect(retarget(g, w, shot, { x: 1, y: 1 }).target).toBeNull()
  })
  test("an empty tile keeps the last target", () => {
    expect(retarget(g, w, { ...shot, target: "e" }, { x: 3, y: 0 }).target).toBe("e")
  })
  test("a friendly ability takes an ally in range and not a foe", () => {
    const heal = { slot: "ability:heal", target: null, at: null }
    expect(retarget(g, c, heal, { x: 0, y: 1 }).target).toBe("w")
    expect(retarget(g, c, heal, { x: 5, y: 1 }).target).toBeNull()
  })
})

describe("enemy turn playback", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, e])
  const walk = (id: string, to: { x: number; y: number }): Frame => {
    const after = structuredClone(g)
    after.units.find((u) => u.id === id)!.pos = to
    return { action: { type: "move", unit: id, to }, game: after }
  }

  test("the focus is the visible enemy that acts", () => {
    const p = new Playback(1, g)
    p.add(g, [walk("e", { x: 4, y: 1 })])
    expect(p.at(0).focus).toEqual({ x: 5, y: 1 })
  })
  test("a soldier's own move has no focus", () => {
    const p = new Playback(1, g)
    p.add(g, [walk("w", { x: 1, y: 1 })])
    expect(p.at(0).focus).toBeNull()
  })
})
