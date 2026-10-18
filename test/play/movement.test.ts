import { key } from "../../src/map/point"
import type { Kind } from "../../src/units/profiles"
import { find, setup, squad } from "../fixture"

const cost = (rows: string[], kind: Kind, to: { x: number; y: number }) => {
  const s = squad("s", kind, { x: 0, y: 0 })
  return setup(rows, [s]).reach(s, 10).cost.get(key(to))
}

describe("class movement", () => {
  test("the Assault vaults low cover for 1, others for 2", () => {
    expect(cost([".:.."], "vanguard", { x: 2, y: 0 })).toBe(1)
    expect(cost([".:.."], "ranger", { x: 2, y: 0 })).toBe(2)
  })
  test("the Scout climbs onto a roof from any side", () => {
    expect(cost([".RR"], "rogue", { x: 1, y: 0 })).toBe(1)
    expect(cost([".RR"], "ranger", { x: 1, y: 0 })).toBeUndefined()
  })
  test("the Heavy never climbs onto a roof", () => {
    expect(cost(["LRR"], "warden", { x: 1, y: 0 })).toBeUndefined()
    expect(cost(["LRR"], "ranger", { x: 1, y: 0 })).toBe(1)
  })
  test("the Heavy walks into trees and low cover for 2", () => {
    expect(cost([".T.", "###"], "warden", { x: 1, y: 0 })).toBe(2)
    expect(cost([".:", "##"], "warden", { x: 1, y: 0 })).toBe(2)
    expect(cost([".T.", "###"], "ranger", { x: 1, y: 0 })).toBeUndefined()
  })
  test("a tree or low cover the Heavy walks into turns to floor", () => {
    const g = setup([".T:.", "####"], [squad("s", "warden", { x: 0, y: 0 })])
    const a = g.apply({ type: "move", unit: "s", to: { x: 2, y: 0 } })
    expect(find(a, "s").pos).toEqual({ x: 2, y: 0 })
    expect(a.tile({ x: 1, y: 0 })).toBe("floor")
    expect(a.tile({ x: 2, y: 0 })).toBe("floor")
  })
  test("the Engineer wades into water for 2", () => {
    expect(cost([".~.", "###"], "engineer", { x: 1, y: 0 })).toBe(2)
    expect(cost([".~.", "###"], "engineer", { x: 2, y: 0 })).toBe(3)
    expect(cost([".~.", "###"], "ranger", { x: 1, y: 0 })).toBeUndefined()
  })
})
