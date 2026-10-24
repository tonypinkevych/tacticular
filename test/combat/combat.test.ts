import type { Game } from "../../src/mission/game"
import { enemy, open, reseed, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]

/** A game whose next two rolls fall below a hit chance and a crit chance. */
function lucky(game: Game, hit: number, crit: number): Game {
  for (let s = 1; s < 20000; s++) {
    const d = reseed(game, s).dice
    if (d.random() * 100 < hit && d.random() * 100 < crit) return reseed(game, s)
  }
  throw new Error("no seed")
}
function unlucky(game: Game, hit: number): Game {
  for (let s = 1; s < 20000; s++) if (reseed(game, s).dice.random() * 100 >= hit) return reseed(game, s)
  throw new Error("no seed")
}
const enemyTurn = (g: Game) => g.apply({ type: "endTurn" })

describe("hit chance", () => {
  const sniper = (cover: boolean, moved = true) => {
    const g = setup(rows(["........", "........", cover ? "...l...." : "........"]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    g.unit("r").moved = moved
    return g
  }
  test("low cover toward the shooter takes 20 from the aim", () => {
    const g = sniper(true)
    expect(g.combat.odds(g.unit("r"), g.unit("g"))).toMatchObject({ chance: 60, crit: 0, damage: 2 })
  })
  test("a Marked target takes 10 more aim, and a Suppressed shooter 20 less", () => {
    const g = sniper(true)
    g.unit("g").status = "marked"
    expect(g.combat.odds(g.unit("r"), g.unit("g")).chance).toBe(70)
    g.unit("g").status = "suppressed"
    expect(g.combat.odds(g.unit("g"), g.unit("r")).chance).toBe(75)
  })
  test("a Hunkered target has its cover doubled and cannot be crit", () => {
    const covered = sniper(true)
    covered.unit("g").hunkered = true
    expect(covered.combat.odds(covered.unit("r"), covered.unit("g"))).toMatchObject({ chance: 40, cover: 40, crit: 0 })
    const open = sniper(false)
    open.unit("g").hunkered = true
    expect(open.combat.odds(open.unit("r"), open.unit("g")).crit).toBe(0)
  })
  test("a flank removes the cover, adds 10 to the aim and gives a 50% crit", () => {
    const g = sniper(false)
    expect(g.combat.odds(g.unit("r"), g.unit("g"))).toMatchObject({ chance: 90, crit: 50 })
  })
  test("Steady gives the Ranger 20 when it did not move, up to 95", () => {
    const g = sniper(true, false)
    expect(g.combat.odds(g.unit("r"), g.unit("g")).chance).toBe(80)
    expect(
      sniper(false, false).combat.odds(sniper(false, false).unit("r"), sniper(false, false).unit("g")).chance,
    ).toBe(95)
  })
  test("Point blank gives the Vanguard 20 next to its target", () => {
    const g = setup(rows(["........", "........", "........", "........", "........", "...l...."]), [
      squad("v", "vanguard", { x: 3, y: 4 }),
      enemy("g", "grunt", { x: 3, y: 3 }),
      enemy("h", "grunt", { x: 3, y: 6 }),
    ])
    expect(g.combat.odds(g.unit("v"), g.unit("g")).chance).toBe(95)
    expect(g.combat.odds(g.unit("v"), g.unit("h")).chance).toBe(50)
  })
  test("a Vanguard hit next to its target pushes it back", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 2 }), enemy("g", "brute", { x: 3, y: 1 })])
    expect(lucky(g, 95, 100).apply({ type: "shoot", unit: "v", target: "g" }).unit("g").at).toEqual({ x: 3, y: 0 })
  })
  test("Aid takes 10 from shots at an ally next to the Cleric", () => {
    const g = setup(open(), [
      squad("r", "ranger", { x: 3, y: 6 }),
      squad("c", "cleric", { x: 4, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 2 }),
    ])
    expect(g.combat.odds(g.unit("g"), g.unit("r")).chance).toBe(85)
  })
  test("a target past the range or behind a rock cannot be shot", () => {
    const far = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 1 })])
    expect(far.combat.canShoot(far.unit("g"), far.unit("r"))).toBe(false)
    const hidden = setup(rows(["........", "........", "........", "........", "...h...."]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    expect(hidden.combat.canShoot(hidden.unit("r"), hidden.unit("g"))).toBe(false)
  })
})

describe("shots", () => {
  const duel = () =>
    setup(rows(["........", "........", "...l...."]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
  test("a hit takes the weapon damage", () => {
    const g = lucky(duel(), 80, 100).apply({ type: "shoot", unit: "r", target: "g" })
    expect(g.unit("g").hp).toBe(1)
  })
  test("a miss takes nothing", () => {
    const g = unlucky(duel(), 80).apply({ type: "shoot", unit: "r", target: "g" })
    expect(g.unit("g").hp).toBe(3)
  })
  test("a crit adds 1 damage", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 1 })])
    expect(lucky(g, 95, 50).apply({ type: "shoot", unit: "r", target: "g" }).unit("g").hp).toBe(0)
  })
  test("the Brute's claws always hit for its damage and push the target back", () => {
    const g = enemyTurn(
      setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("b", "brute", { x: 3, y: 3 })]),
    ).apply({ type: "shoot", unit: "b", target: "v" })
    expect(g.unit("v")).toMatchObject({ hp: 5, at: { x: 3, y: 5 } })
  })
  test("a push into water kills", () => {
    const g = enemyTurn(
      setup(rows(["........", "........", "........", "........", "........", "...~...."]), [
        squad("v", "vanguard", { x: 3, y: 4 }),
        enemy("b", "brute", { x: 3, y: 3 }),
      ]),
    ).apply({ type: "shoot", unit: "b", target: "v" })
    expect(g.unit("v").hp).toBe(0)
  })
  test("a shot at a barrel blows it: 2 around, fire on its tile, and the next barrel blows too", () => {
    const g = setup(rows(["........", "........", "........", "...bb..."]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("a", "grunt", { x: 3, y: 2 }),
      enemy("b", "brute", { x: 5, y: 3 }),
    ]).apply({ type: "shoot", unit: "r", at: { x: 3, y: 3 } })
    expect([g.unit("a").hp, g.unit("b").hp, g.board.at({ x: 3, y: 3 }), g.board.at({ x: 4, y: 3 })]).toEqual([
      1,
      3,
      "fire",
      "fire",
    ])
  })
  test("Shred: a Warden hit tears the sandbags in front of the target", () => {
    const g = setup(rows(["........", "........", "...l...."]), [
      squad("w", "warden", { x: 3, y: 5 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    expect(lucky(g, 45, 101).apply({ type: "shoot", unit: "w", target: "g" }).board.at({ x: 3, y: 2 })).toBe("torn")
  })
})
