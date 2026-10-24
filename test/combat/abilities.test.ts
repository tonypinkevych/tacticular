import type { Game } from "../../src/mission/game"
import { Illegal } from "../../src/mission/orders"
import { Unit } from "../../src/units/unit"
import { enemy, open, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]
const end = (g: Game, times = 1) => {
  let n = g
  for (let i = 0; i < times; i++) n = n.apply({ type: "endTurn" })
  return n
}

describe("squad skills", () => {
  test("Run & Gun dashes, then shoots, and waits 3 turns", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 7 }), enemy("g", "grunt", { x: 3, y: 2 })]).apply({
      type: "skill",
      unit: "v",
      to: { x: 3, y: 4 },
      target: "g",
    })
    expect(g.unit("v")).toMatchObject({ at: { x: 3, y: 4 }, ap: 0, cooldown: 3 })
    expect(g.log.some((e) => e.key === "log.run")).toBe(true)
  })
  test("Headshot needs a flanked target", () => {
    const g = setup(rows(["........", "........", "...l...."]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    expect(() => g.apply({ type: "skill", unit: "r", target: "g" })).toThrow(Illegal)
  })
  test("Headshot deals 2 more on a flanked target", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "commander", { x: 3, y: 1 })])
    const shot = g.combat.hit(g.unit("r"), g.unit("g")).damage
    expect(g.apply({ type: "skill", unit: "r", target: "g" }).unit("g").hp).toBe(9 - shot - 2)
  })
  test("a Grenade hits a plus for 2 and breaks the cover in it, once a mission", () => {
    const g = setup(rows(["........", "........", "..l....."]), [
      squad("w", "warden", { x: 3, y: 6 }),
      enemy("a", "grunt", { x: 3, y: 2 }),
      enemy("b", "grunt", { x: 4, y: 2 }),
    ])
    const after = g.apply({ type: "skill", unit: "w", at: { x: 3, y: 2 } })
    expect([after.unit("a").hp, after.unit("b").hp, after.board.at({ x: 2, y: 2 })]).toEqual([5, 5, "torn"])
    expect(() => end(after, 2).apply({ type: "skill", unit: "w", at: { x: 3, y: 2 } })).toThrow(Illegal)
  })
  test("a Medkit heals an adjacent ally for 2, up to its HP", () => {
    const g = setup(open(), [
      squad("c", "cleric", { x: 3, y: 6 }),
      squad("v", "vanguard", { x: 4, y: 6 }),
      enemy("g", "grunt", { x: 0, y: 0 }),
    ])
    g.unit("v").hp = 6
    expect(g.apply({ type: "skill", unit: "c", target: "v" }).unit("v").hp).toBe(7)
  })
  test("a Medkit gives an ally with no AP 1 AP back", () => {
    const g = setup(open(), [
      squad("c", "cleric", { x: 3, y: 6 }),
      squad("v", "vanguard", { x: 4, y: 6 }),
      enemy("g", "grunt", { x: 0, y: 0 }),
    ])
    g.unit("v").ap = 0
    expect(g.apply({ type: "skill", unit: "c", target: "v" }).unit("v").ap).toBe(1)
  })
  test("a Medkit needs the ally next to the Cleric", () => {
    const g = setup(open(), [
      squad("c", "cleric", { x: 3, y: 6 }),
      squad("v", "vanguard", { x: 6, y: 6 }),
      enemy("g", "grunt", { x: 0, y: 0 }),
    ])
    expect(() => g.apply({ type: "skill", unit: "c", target: "v" })).toThrow(Illegal)
  })
})

describe("alien skills", () => {
  test("Covering fire aims 2 shots that fire in the next alien turn", () => {
    const aimed = end(setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 2 })])).apply(
      {
        type: "skill",
        unit: "g",
        target: "r",
      },
    )
    expect(aimed.marks.map((m) => m.kind)).toEqual(["volley"])
    const g = end(aimed, 2)
    expect(g.log.filter((e) => e.key === "log.hit" || e.key === "log.block")).toHaveLength(2)
  })
  test("a Charge marks a line, then runs it next turn and claws the first unit on it", () => {
    const marked = end(
      setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("b", "brute", { x: 3, y: 0 })]),
    ).apply({ type: "skill", unit: "b", at: { x: 3, y: 4 } })
    expect(marked.marks).toEqual([
      {
        kind: "charge",
        unit: "b",
        tiles: [
          { x: 3, y: 1 },
          { x: 3, y: 2 },
          { x: 3, y: 3 },
          { x: 3, y: 4 },
        ],
      },
    ])
    const run = end(marked, 2)
    expect([run.unit("b").at, run.unit("v").hp, run.unit("v").at]).toEqual([{ x: 3, y: 3 }, 4, { x: 3, y: 5 }])
  })
  test("a Bomber marks a plus, then blows it next turn for 2", () => {
    const g = end(
      setup(open(), [
        squad("r", "ranger", { x: 3, y: 4 }),
        squad("c", "cleric", { x: 3, y: 5 }),
        enemy("m", "bomber", { x: 5, y: 1 }),
      ]),
    ).apply({ type: "skill", unit: "m", at: { x: 3, y: 4 } })
    const run = end(g, 2)
    expect([run.unit("r").hp, run.unit("c").hp]).toEqual([3, 4])
  })
  test("killing the Bomber removes its mark", () => {
    const g = end(setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("m", "bomber", { x: 3, y: 1 })])).apply({
      type: "skill",
      unit: "m",
      at: { x: 3, y: 4 },
    })
    const next = end(g)
    next.unit("m").hp = 0
    expect(end(next).marks).toEqual([])
  })
  test("a War cry gives the aliens one more tile to move this turn", () => {
    const g = end(
      setup(open(), [
        squad("r", "ranger", { x: 7, y: 7 }),
        enemy("k", "commander", { x: 0, y: 0 }),
        enemy("g", "grunt", { x: 2, y: 0 }),
      ]),
    ).apply({ type: "skill", unit: "k" })
    expect(g.unit("g").steps()).toBe(2)
    expect(end(g, 2).unit("g").steps()).toBe(1)
  })
  test("Deadeye: Headshot works on a Marked alien behind cover", () => {
    const g = setup(rows(["........", "........", "...l...."]), [
      Unit.of("r", "ranger", "squad", { x: 3, y: 6 }, { hp: 0, upgrades: 0, branch: "deadeye" }),
      squad("c", "cleric", { x: 4, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    g.unit("g").status = "marked"
    expect(() => g.apply({ type: "skill", unit: "r", target: "g" })).not.toThrow()
  })
  test("Lunge dashes, then strikes an alien next to its tile, and waits 3 turns", () => {
    const g = setup(open(), [squad("b", "blade", { x: 3, y: 7 }), enemy("q", "commander", { x: 3, y: 2 })]).apply({
      type: "skill",
      unit: "b",
      to: { x: 3, y: 3 },
      target: "q",
    })
    expect(g.unit("b")).toMatchObject({ at: { x: 3, y: 3 }, ap: 0, cooldown: 3 })
    expect(g.unit("q").hp).toBe(6)
  })
})
