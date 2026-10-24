import type { Game } from "../../src/mission/game"
import { Illegal } from "../../src/mission/orders"
import type { Branch } from "../../src/units/profiles"
import { Unit } from "../../src/units/unit"
import { enemy, open, reseed, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]

/** The game with a seed whose next roll lands below a percent. */
function hitting(game: Game, chance: number): Game {
  for (let s = 1; s < 20000; s++) if (reseed(game, s).dice.random() * 100 < chance) return reseed(game, s)
  throw new Error("no seed")
}

describe("tactics", () => {
  test("Suppress puts Suppressed on an alien in range for 1 AP and the turn goes on", () => {
    const g = setup(open(), [squad("w", "warden", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 3 })]).apply({
      type: "tactic",
      unit: "w",
      target: "g",
    })
    expect([g.unit("g").status, g.unit("w").ap]).toEqual(["suppressed", 1])
  })
  test("a tactic out of range is refused", () => {
    const g = setup(open(), [squad("w", "warden", { x: 3, y: 7 }), enemy("g", "grunt", { x: 3, y: 0 })])
    expect(() => g.apply({ type: "tactic", unit: "w", target: "g" })).toThrow(Illegal)
  })
  test("Shove pushes an adjacent alien a tile and staggers it", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 5 })]).apply({
      type: "tactic",
      unit: "v",
      target: "g",
    })
    expect(g.unit("g")).toMatchObject({ at: { x: 3, y: 4 }, status: "staggered" })
  })
  test("Shove into water drowns the alien", () => {
    const g = setup(rows(["........", "........", "........", "...~...."]), [
      squad("v", "vanguard", { x: 3, y: 5 }),
      enemy("g", "grunt", { x: 3, y: 4 }),
    ]).apply({ type: "tactic", unit: "v", target: "g" })
    expect(g.unit("g").alive()).toBe(false)
  })
  test("a Staggered alien loses its marked attack and has 1 AP in its next turn", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 6 }), enemy("b", "bomber", { x: 3, y: 5 })])
    g.marks.push({ kind: "blast", unit: "b", tiles: [{ x: 1, y: 6 }] })
    const next = g.apply({ type: "tactic", unit: "v", target: "b" })
    expect(next.marks).toEqual([])
    expect(next.apply({ type: "endTurn" }).unit("b").ap).toBe(1)
  })
  test("a new status replaces the old one, and statuses end at the start of the squad turn", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 3, y: 6 }),
      squad("c", "cleric", { x: 4, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 4 }),
    ])
      .apply({ type: "tactic", unit: "w", target: "g" })
      .apply({ type: "tactic", unit: "c", target: "g" })
    expect(g.unit("g").status).toBe("exposed")
    expect(g.apply({ type: "endTurn" }).apply({ type: "endTurn" }).unit("g").status).toBe(null)
  })
  test("a Suppressed alien that moves draws a shot from the Warden", () => {
    const g = setup(open(), [squad("w", "warden", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 3 })])
      .apply({ type: "tactic", unit: "w", target: "g" })
      .apply({ type: "endTurn" })
      .apply({ type: "move", unit: "g", to: { x: 2, y: 3 } })
    expect(g.log.some((e) => e.key === "log.pinned" && e.params.unit === "w")).toBe(true)
    expect(g.unit("g").status).toBe(null)
  })
})

describe("combos", () => {
  test("a Vanguard hit on a Suppressed alien deals 1 more and staggers it", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 2, y: 6 }),
      squad("v", "vanguard", { x: 3, y: 6 }),
      enemy("g", "commander", { x: 3, y: 4 }),
    ]).apply({ type: "tactic", unit: "w", target: "g" })
    expect(g.combat.odds(g.unit("v"), g.unit("g")).damage).toBe(4)
    const hit = hitting(g, 95).apply({ type: "shoot", unit: "v", target: "g" })
    expect(hit.unit("g").status).toBe("staggered")
    expect(hit.log.some((e) => e.key === "log.combo" && e.params.unit === "v")).toBe(true)
  })
  test("a Warden hit on a Staggered alien breaks the cover next to it and exposes it", () => {
    const g = setup(open(), [
      squad("v", "vanguard", { x: 3, y: 4 }),
      squad("w", "warden", { x: 5, y: 2 }),
      enemy("g", "commander", { x: 3, y: 3 }),
    ]).apply({ type: "tactic", unit: "v", target: "g" })
    expect(g.unit("g").at).toEqual({ x: 3, y: 2 })
    const at = g.unit("g").at
    g.board.set({ x: at.x, y: at.y + 1 }, "bags")
    const hit = hitting(g, g.combat.odds(g.unit("w"), g.unit("g")).chance).apply({
      type: "shoot",
      unit: "w",
      target: "g",
    })
    expect(hit.unit("g").status).toBe("exposed")
    expect(hit.board.at({ x: at.x, y: at.y + 1 })).toBe("torn")
  })
  test("an Exposed alien has no cover, and a Ranger hit on it is a sure crit that marks it", () => {
    const g = setup(rows(["........", "........", "...l...."]), [
      squad("c", "cleric", { x: 3, y: 4 }),
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "commander", { x: 3, y: 1 }),
    ]).apply({ type: "tactic", unit: "c", target: "g" })
    const odds = g.combat.odds(g.unit("r"), g.unit("g"))
    expect([odds.cover, odds.crit]).toEqual([0, 100])
    const hit = hitting(g, odds.chance).apply({ type: "shoot", unit: "r", target: "g" })
    expect(hit.unit("g")).toMatchObject({ status: "marked", hp: 3 })
  })
  test("a Cleric hit on a Marked alien heals each soldier within 1 tile of the Cleric", () => {
    const g = setup(open(), [
      squad("r", "ranger", { x: 3, y: 6 }),
      squad("c", "cleric", { x: 4, y: 6 }),
      enemy("g", "commander", { x: 4, y: 4 }),
    ]).apply({ type: "tactic", unit: "r", target: "g" })
    g.unit("r").hp = 2
    g.unit("c").hp = 3
    const hit = hitting(g, 95).apply({ type: "shoot", unit: "c", target: "g" })
    expect([hit.unit("r").hp, hit.unit("c").hp, hit.unit("g").status]).toEqual([3, 4, null])
  })
  describe("branches", () => {
    const trained = (
      id: string,
      kind: "vanguard" | "ranger" | "warden" | "cleric",
      at: { x: number; y: number },
      branch: string,
    ) => Unit.of(id, kind, "squad", at, { hp: 0, aim: 0, upgrades: 0, branch: branch as Branch })
    test("Bulldozer: a Shove pushes 2 tiles", () => {
      const g = setup(open(), [
        trained("v", "vanguard", { x: 3, y: 6 }, "bulldozer"),
        enemy("g", "grunt", { x: 3, y: 5 }),
      ])
      expect(g.apply({ type: "tactic", unit: "v", target: "g" }).unit("g").at).toEqual({ x: 3, y: 3 })
    })
    test("Pinning and Searing: Suppress and Flare deal 1", () => {
      const g = setup(open(), [
        trained("w", "warden", { x: 3, y: 6 }, "pinning"),
        trained("c", "cleric", { x: 4, y: 6 }, "searing"),
        enemy("g", "grunt", { x: 3, y: 4 }),
      ])
      const pinned = g.apply({ type: "tactic", unit: "w", target: "g" })
      expect(pinned.unit("g").hp).toBe(3)
      expect(pinned.apply({ type: "tactic", unit: "c", target: "g" }).unit("g").hp).toBe(2)
    })
    test("Chaplain: a Cleric combo heals 2", () => {
      const g = setup(open(), [
        squad("r", "ranger", { x: 3, y: 6 }),
        trained("c", "cleric", { x: 4, y: 6 }, "chaplain"),
        enemy("g", "commander", { x: 4, y: 4 }),
      ]).apply({ type: "tactic", unit: "r", target: "g" })
      g.unit("r").hp = 1
      expect(hitting(g, 95).apply({ type: "shoot", unit: "c", target: "g" }).unit("r").hp).toBe(3)
    })
  })
})
