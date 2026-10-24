import { locale } from "../../../src/i18n/strings"
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
    if (seen.some((x) => x === "float:MISS")) return
    expect(seen).toContain("g:death")
    expect(p.units.has("g")).toBe(false)
  })
  test("an alien shot shows its hit chance over the alien first, and a soldier shot does not", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 2 })])
    g.marks.push({ kind: "shot", unit: "g", target: "r", tiles: [{ x: 3, y: 6 }] })
    const alien = run(g, { type: "endTurn" })
    const chance = alien.after.log.find((e) => e.params.unit === "g")?.params.chance
    expect(alien.seen.find((x) => x.startsWith("float:"))).toBe(`float:${chance}%`)
    g.marks = []
    expect(run(g, { type: "shoot", unit: "r", target: "g" }).seen.some((x) => x.endsWith("%"))).toBe(false)
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
  test("a soldier's overwatch shot at a moving alien shows its hit chance", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 0 })])
    g.unit("r").overwatch = true
    g.phase = "enemy"
    const { seen, after } = run(g, { type: "move", unit: "g", to: { x: 3, y: 1 } })
    const chance = after.log.find((e) => e.params.unit === "r" && e.params.chance !== undefined)?.params.chance
    expect(seen).toContain(`float:${chance}%`)
  })
})
