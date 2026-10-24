import { locale } from "../../../src/i18n/strings"
import type { Game } from "../../../src/mission/game"
import type { Action } from "../../../src/mission/orders"
import { Playback } from "../../../src/screen/playback/playback"
import { enemy, open, setup, squad } from "../../fixture"

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
    const { seen } = run(g, { type: "shoot", unit: "r", target: "g" })
    expect([seen.includes(`float:−${g.combat.hit(g.unit("r"), g.unit("g")).damage}`), seen.includes("g:hit")]).toEqual([
      true,
      true,
    ])
  })
  test("a shot the cover blocks shows BLOCKED and no hit", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 1 })])
    g.unit("r").moved = true
    g.unit("g").hunkered = true
    const { seen } = run(g, { type: "shoot", unit: "r", target: "g" })
    expect([seen.includes("float:BLOCKED"), seen.includes("g:hit")]).toEqual([true, false])
  })
  test("a grenade shows the damage over each unit it hits and plays its hit", () => {
    const { seen } = run(setup(open(), [squad("w", "warden", { x: 5, y: 6 }), enemy("g", "grunt", { x: 5, y: 3 })]), {
      type: "skill",
      unit: "w",
      at: { x: 5, y: 3 },
    })
    expect([seen.includes("float:−2"), seen.includes("g:hit")]).toEqual([true, true])
  })
  test("a death plays the death and then the unit is gone", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 1 })])
    g.unit("g").hp = 0.5
    const { p, seen } = run(g, { type: "shoot", unit: "r", target: "g" })
    expect(seen).toContain("g:death")
    expect(p.units.has("g")).toBe(false)
  })
  test("the texts over the board are in the player's language", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 0 })])
    g.unit("g").overwatch = true
    locale.use("ru")
    const { seen } = run(g, { type: "move", unit: "v", to: { x: 3, y: 4 } })
    locale.use("en")
    const texts = seen.filter((x) => x.startsWith("float:"))
    expect(texts).toContain("float:НАБЛЮДЕНИЕ")
    expect(texts.some((x) => /[A-Z]/.test(x.slice(6)))).toBe(false)
  })
  test("an ultimate shows its name over the soldier", () => {
    const g = setup(open(), [squad("w", "warden", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 3 })])
    g.unit("w").charge = 2
    expect(run(g, { type: "ultimate", unit: "w" }).seen).toContain("float:LOCKDOWN")
  })
})
