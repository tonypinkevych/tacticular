import type { Frame } from "../../src/match"
import { floats, Playback } from "../../src/view/motion"
import { enemy, open, setup, squad } from "../fixture"

describe("enemy turn playback", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, e])
  const walk = (id: string, to: { x: number; y: number }): Frame => {
    const after = g.clone()
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

describe("floats", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, e])
  const logged = (key: string, params: Record<string, string | number | boolean>) => {
    const a = g.clone()
    a.log.push({ key, params })
    return a
  }

  test("a hit shows only the damage and marks the unit as hit", () => {
    const [f] = floats(g, logged("log.hit", { unit: "w", target: "e", dmg: 4, chance: 45 }), 0)
    expect(f.text).toBe("−4")
    expect(f.hit).toBe(true)
  })
  test("a crit says so, with no chance", () => {
    const [f] = floats(g, logged("log.crit", { unit: "w", target: "e", dmg: 6, chance: 45 }), 0)
    expect(f.text).not.toContain("%")
    expect(f.text).toContain("6")
  })
  test("a death leaves a fading figure", () => {
    const a = logged("log.dies", { unit: "e" })
    a.units.find((u) => u.id === "e")!.hp = 0
    const [f] = floats(g, a, 0)
    expect(f.unit?.id).toBe("e")
  })
})
