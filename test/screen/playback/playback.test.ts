import type { Game } from "../../../src/mission/game"
import type { Action } from "../../../src/mission/orders"
import { Playback } from "../../../src/screen/playback/playback"
import { enemy, open, reseed, setup, squad } from "../../fixture"

function run(before: Game, action: Action) {
  const p = new Playback()
  p.sync(before, 0)
  const after = before.apply(action)
  p.play(before, action, after)
  const seen: string[] = []
  for (let t = 0; t < 10; t += 0.05) {
    p.tick(t)
    for (const s of p.units.values()) seen.push(`${s.id}:${s.state}`)
    for (const f of p.floats) seen.push(`float:${f.text}`)
  }
  return { p, seen, after }
}

describe("playback", () => {
  test("a move walks the unit and leaves it on its tile", () => {
    const { p, seen } = run(
      setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 7, y: 0 })]),
      { type: "move", unit: "r", to: { x: 3, y: 4 } },
    )
    expect(seen).toContain("r:walk")
    expect(p.units.get("r")).toMatchObject({ x: 3, y: 4, state: "idle" })
    expect(p.busy(10)).toBe(false)
  })
  test("a hit shows the damage over the target and plays its hit", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "commander", { x: 3, y: 1 })])
    let hit = g
    for (let s = 1; s < 500; s++)
      if (
        reseed(g, s).dice.random() * 100 < 95 &&
        reseed(g, s).apply({ type: "shoot", unit: "r", target: "g" }).unit("g").hp < 8
      ) {
        hit = reseed(g, s)
        break
      }
    const { seen } = run(hit, { type: "shoot", unit: "r", target: "g" })
    expect(seen.some((x) => /float:(CRIT )?−\d/.test(x))).toBe(true)
    expect(seen).toContain("g:hit")
  })
  test("a death plays the death and then the unit is gone", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 1 })])
    g.unit("g").hp = 0.5
    const { p, seen } = run(g, { type: "shoot", unit: "r", target: "g" })
    if (seen.some((x) => x === "float:MISS")) return
    expect(seen).toContain("g:death")
    expect(p.units.has("g")).toBe(false)
  })
})
