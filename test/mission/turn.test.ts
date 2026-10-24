import { enemy, open, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]

describe("turns", () => {
  test("the aliens get 2 AP when the squad ends its turn", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 3 }), enemy("g", "grunt", { x: 7, y: 0 })]).apply({
      type: "endTurn",
    })
    expect([g.phase, g.unit("g").ap]).toEqual(["enemy", 2])
  })
  test("a new round gives the squad 2 AP and counts down its cooldowns", () => {
    const start = setup(open(), [squad("r", "ranger", { x: 3, y: 3 }), enemy("g", "grunt", { x: 7, y: 0 })])
    start.unit("r").cooldown = 3
    const g = start.apply({ type: "overwatch", unit: "r" }).apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect([g.round, g.phase, g.unit("r").ap, g.unit("r").cooldown]).toEqual([2, "squad", 2, 2])
  })
  test("a unit in fire burns for 1 at the end of the round", () => {
    const g = setup(rows(["........", "........", "........", "...f...."]), [
      squad("v", "vanguard", { x: 3, y: 3 }),
      enemy("g", "grunt", { x: 7, y: 0 }),
    ])
    expect(g.apply({ type: "endTurn" }).apply({ type: "endTurn" }).unit("v").hp).toBe(8)
  })
  test("fire spreads to the next forest at the end of the round", () => {
    const g = setup(rows(["........", "........", "........", "...fT..."]), [
      squad("v", "vanguard", { x: 0, y: 7 }),
      enemy("g", "grunt", { x: 7, y: 0 }),
    ])
    expect(g.apply({ type: "endTurn" }).apply({ type: "endTurn" }).board.at({ x: 4, y: 3 })).toBe("fire")
  })
  test("the squad wins when no alien stands", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 3 }), enemy("g", "grunt", { x: 3, y: 0 })])
    g.unit("g").hp = 1
    let next = g
    for (let i = 0; i < 20 && next.phase !== "won"; i++)
      next =
        next.phase === "squad" && next.unit("r").ap > 0
          ? next.apply({ type: "shoot", unit: "r", target: "g" })
          : next.apply({ type: "endTurn" })
    expect(next.phase).toBe("won")
  })
  test("the squad loses when no soldier stands", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("b", "brute", { x: 3, y: 3 })])
    g.unit("v").hp = 2
    const aimed = g.apply({ type: "endTurn" }).apply({ type: "shoot", unit: "b", target: "v" })
    expect(aimed.apply({ type: "endTurn" }).apply({ type: "endTurn" }).phase).toBe("lost")
  })
})

describe("aimed attacks", () => {
  const aim = (rows8: string[] = open(), at = { x: 3, y: 6 }) =>
    setup(rows8, [squad("r", "ranger", at), enemy("g", "grunt", { x: 3, y: 3 })])
      .apply({ type: "endTurn" })
      .apply({ type: "shoot", unit: "g", target: "r" })
  test("an alien shot is aimed, not fired, and shows its target", () => {
    const g = aim()
    expect([g.unit("r").hp, g.unit("g").ap]).toEqual([7, 0])
    expect(g.marks).toEqual([{ kind: "shot", unit: "g", target: "r", tiles: [{ x: 3, y: 6 }] }])
  })
  test("an aimed shot fires at the start of the next alien turn", () => {
    const g = aim().apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(g.marks).toEqual([])
    expect(g.log.some((e) => ["log.hit", "log.crit", "log.miss"].includes(e.key) && e.params.unit === "g")).toBe(true)
  })
  test("an aimed shot misses a target that left its sight", () => {
    const g = aim(rows(["........", "........", "........", "........", "........", "........", "...hhh.."]), {
      x: 2,
      y: 6,
    })
    const hidden = g.apply({ type: "endTurn" }).apply({ type: "move", unit: "r", to: { x: 4, y: 7 } })
    const next = hidden.apply({ type: "endTurn" })
    expect(next.log.some((e) => e.key === "log.dodge" && e.params.target === "r")).toBe(true)
    expect(next.unit("r").hp).toBe(7)
  })
  test("claws land only on a target still next to the alien", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("b", "brute", { x: 3, y: 3 })])
      .apply({ type: "endTurn" })
      .apply({ type: "shoot", unit: "b", target: "v" })
      .apply({ type: "endTurn" })
      .apply({ type: "move", unit: "v", to: { x: 3, y: 6 } })
      .apply({ type: "endTurn" })
    expect(g.unit("v").hp).toBe(9)
  })
  test("a Shove cancels the shot the alien aimed", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("g", "grunt", { x: 3, y: 3 })])
      .apply({ type: "endTurn" })
      .apply({ type: "shoot", unit: "g", target: "v" })
      .apply({ type: "endTurn" })
      .apply({ type: "tactic", unit: "v", target: "g" })
    expect(g.marks).toEqual([])
  })
})

describe("goals", () => {
  const evac = () => {
    const g = setup(open(), [
      squad("r", "ranger", { x: 3, y: 0 }),
      squad("v", "vanguard", { x: 5, y: 5 }),
      enemy("g", "grunt", { x: 7, y: 7 }),
    ])
    g.goal = { kind: "evac", tiles: Array.from({ length: 8 }, (_, x) => ({ x, y: 0 })) }
    return g
  }
  test("a soldier on an evac tile leaves at the end of the squad turn", () => {
    const g = evac().apply({ type: "endTurn" })
    expect([g.unit("r").out, g.phase]).toEqual([true, "enemy"])
  })
  test("Evac is won when every living soldier has left", () => {
    const g = evac()
    g.unit("v").hp = 0
    expect(g.apply({ type: "endTurn" }).phase).toBe("won")
  })
  const defend = (aliens: number) => {
    const g = setup(open(), [
      squad("r", "ranger", { x: 0, y: 7 }),
      ...Array.from({ length: aliens }, (_, i) => enemy(`g${i}`, "grunt", { x: 2 + i, y: 3 })),
    ])
    g.goal = { kind: "defend", at: { x: 3, y: 3 }, rounds: 5, strikes: 0 }
    return g
  }
  const round = (g: ReturnType<typeof defend>) => g.apply({ type: "endTurn" }).apply({ type: "endTurn" })
  test("Defend is lost when aliens hold the beacon area 2 round ends in a row", () => {
    expect(round(round(defend(2))).phase).toBe("lost")
  })
  test("Defend is won after its rounds", () => {
    let g = defend(0)
    g.units.push(enemy("far", "grunt", { x: 7, y: 0 }))
    for (let i = 0; i < 5; i++) g = round(g)
    expect(g.phase).toBe("won")
  })
})
