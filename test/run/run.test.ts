import { outcome, Run } from "../../src/run/run"
import { CLASSES } from "../../src/units/profiles"
import { enemy, open, setup, squad } from "../fixture"

const drafted = (seed = 1) => {
  const run = Run.start(seed)
  run.draft(run.candidates.slice(0, 3).map((c) => c.id))
  return run
}
const first = (run: Run) => run.options().find((n) => n.kind !== "defend")!.id
const ids = (run: Run) => run.roster.map((s) => s.id)

describe("draft", () => {
  test("offers one soldier of each class; picking 3 fills the roster and opens the chart", () => {
    const run = Run.start(1)
    expect(run.stage).toBe("draft")
    expect(run.candidates.map((c) => c.kind)).toEqual(CLASSES)
    run.draft(["c1", "c3", "c5"])
    expect(ids(run)).toEqual(["c1", "c3", "c5"])
    expect(run.stage).toBe("chart")
  })
  test("refuses a pick of other than 3", () => {
    expect(() => Run.start(1).draft(["c1", "c2"])).toThrow()
  })
})

describe("chart", () => {
  test("the first move takes a mission of the first layer, later moves one the last mission leads to", () => {
    const run = drafted()
    expect(run.options().map((n) => n.layer)).toEqual(run.chart.layer(0).map(() => 0))
    const node = first(run)
    run.go(node, ids(run))
    expect(run.stage).toBe("mission")
    run.finish({ won: false, hp: {} })
    expect(run.options().map((n) => n.id)).toEqual(run.chart.node(node).next)
  })
  test("refuses a mission it cannot reach and more than 4 soldiers", () => {
    const run = drafted()
    expect(() => run.go(run.chart.layer(1)[0].id, ids(run))).toThrow()
    run.roster.push({ ...run.roster[0], id: "x" }, { ...run.roster[0], id: "y" })
    expect(() => run.go(first(run), ids(run))).toThrow()
    expect(() => run.go(first(run), ids(run).slice(0, 4))).not.toThrow()
  })
  test("a mission carries the deployed soldiers with their HP", () => {
    const run = drafted()
    run.roster[0].hp = 2
    run.go(first(run), ids(run))
    expect(run.conditions().squad).toEqual(run.roster)
  })
  test("needs 3 soldiers, or the whole roster when it has fewer", () => {
    const run = drafted()
    expect(() => run.go(first(run), ids(run).slice(0, 2))).toThrow()
    run.roster.pop()
    expect(() => run.go(first(run), ids(run))).not.toThrow()
  })
  test("each mission raises the threat, and threat brings more alien groups", () => {
    const run = drafted()
    run.go(first(run), ids(run))
    const early = run.conditions().groups ?? 0
    run.threat = 6
    expect(run.conditions().groups).toBeGreaterThan(early)
    expect(run.threat).toBe(6)
  })
})

describe("fortress", () => {
  const at = (done: string[]) => {
    const run = drafted()
    run.done = done as Run["done"]
    run.at = run.chart.nodes.find((n) => n.kind === "fortress")!.id
    run.deployed = ids(run)
    return run.conditions()
  }
  test("is a Warchief mission with a pad and fog", () => {
    expect(at([])).toMatchObject({ goal: "warchief", pad: true, scouted: false })
  })
  test("has no pad after the relay, scouted groups after intel, one group fewer after the captain", () => {
    const base = at([]).groups ?? 0
    expect(at(["relay", "intel", "captain"])).toMatchObject({ pad: false, scouted: true, groups: base - 1 })
  })
})

describe("after a mission", () => {
  const played = (won: boolean, hp: Record<string, number>) => {
    const run = drafted()
    run.go(first(run), ids(run))
    run.finish({ won, hp })
    return run
  }
  test("standing soldiers keep their HP and heal 1; the dead leave; a win offers 3 rewards", () => {
    const run = played(true, { c1: 3, c2: 0, c3: 5 })
    expect(ids(run)).toEqual(["c1", "c3"])
    expect(run.roster.map((s) => s.hp)).toEqual([4, 6])
    expect(run.stage).toBe("reward")
    expect(run.offers).toHaveLength(3)
  })
  test("a soldier who stayed out heals 3", () => {
    const run = drafted()
    run.roster.push({ ...run.roster[0], id: "x", hp: 1 })
    run.go(first(run), ["c1", "c2", "c3"])
    run.finish({ won: true, hp: { c1: 3, c2: 3, c3: 3 } })
    expect(run.roster.find((s) => s.id === "x")?.hp).toBe(4)
  })
  test("a loss gives no reward and raises the threat; the run goes on", () => {
    const run = drafted()
    run.go(first(run), ids(run))
    const threat = run.threat
    run.finish({ won: false, hp: { c1: 2, c2: 2, c3: 2 } })
    expect(run.stage).toBe("chart")
    expect(run.threat).toBe(threat + 1)
  })
  test("the run is lost when no soldier is left", () => {
    expect(played(false, { c1: 0, c2: 0, c3: 0 }).stage).toBe("lost")
  })
  test("winning the fortress wins the run", () => {
    const run = drafted()
    run.at = run.chart.nodes.find((n) => n.kind === "fortress")!.id
    run.deployed = ids(run)
    run.stage = "mission"
    run.finish({ won: true, hp: { c1: 1, c2: 1, c3: 1 } })
    expect(run.stage).toBe("won")
  })
  const opening = (kind: string) => {
    for (let seed = 1; ; seed++) {
      const run = drafted(seed)
      const node = run.chart.layer(0).find((n) => n.kind === kind)
      if (node) return { run, node: node.id }
    }
  }
  test("a won VIP mission adds the freed soldier", () => {
    const { run, node } = opening("vip")
    run.go(node, ids(run))
    const captive = run.conditions().captive!
    run.finish({ won: true, hp: { c1: 3, c2: 3, c3: 3, [captive.id]: 4 } })
    expect(ids(run)).toContain(captive.id)
  })
  test("a won Defend mission heals every soldier 3 more", () => {
    const { run, node } = opening("defend")
    run.go(node, ids(run))
    run.finish({ won: true, hp: { c1: 1, c2: 1, c3: 1 } })
    expect(run.roster.map((s) => s.hp)).toEqual([5, 5, 5])
  })
})

describe("rewards", () => {
  const offered = () => {
    const run = drafted()
    run.go(first(run), ids(run))
    run.finish({ won: true, hp: { c1: 2, c2: 2, c3: 2 } })
    return run
  }
  test("offer a heal, a recruit and training", () => {
    expect(offered().offers.map((o) => o.kind)).toEqual(["heal", "recruit", "train"])
  })
  test("a heal gives every soldier 3 HP", () => {
    const run = offered()
    run.take(0)
    expect(run.roster.map((s) => s.hp)).toEqual([6, 6, 6])
    expect(run.stage).toBe("chart")
  })
  test("a roster of 5 gets no recruit offer", () => {
    const run = drafted()
    run.roster.push({ ...run.roster[0], id: "x" }, { ...run.roster[0], id: "y" })
    run.go(first(run), ids(run).slice(0, 4))
    run.finish({ won: true, hp: { c1: 2, c2: 2, c3: 2, x: 2 } })
    expect(run.offers.map((o) => o.kind)).not.toContain("recruit")
  })
  test("a recruit joins the roster", () => {
    const run = offered()
    run.take(1)
    expect(run.roster).toHaveLength(4)
  })
  test("training gives a soldier 1 more max HP and 1 more Aim", () => {
    const run = offered()
    const pick = run.offers[2]
    if (pick.kind !== "train") throw new Error(pick.kind)
    const before = structuredClone(run.roster.find((s) => s.id === pick.id)!)
    run.take(2)
    const after = run.roster.find((s) => s.id === pick.id)!
    expect([after.spread.hp, after.spread.aim, after.hp]).toEqual([
      before.spread.hp + 1,
      before.spread.aim + 1,
      before.hp + 1,
    ])
  })
})

describe("outcome", () => {
  test("reads the squad's HP: a downed soldier counts 1 HP after a win and 0 after a loss", () => {
    const a = squad("a", "warden", { x: 0, y: 0 })
    const b = squad("b", "ranger", { x: 1, y: 0 })
    b.hp = 0
    b.down = 2
    const g = setup(open(4, 2), [a, b, enemy("e", "orc", { x: 3, y: 1 })])
    g.phase = "won"
    expect(outcome(g)).toEqual({ won: true, hp: { a: a.maxHp, b: 1 } })
    g.phase = "lost"
    expect(outcome(g).hp.b).toBe(0)
  })
})

describe("replay", () => {
  test("the same seed and choices give the same run", () => {
    const play = () => {
      const run = drafted(9)
      run.go(first(run), ids(run))
      run.finish({ won: true, hp: { c1: 2, c2: 2, c3: 2 } })
      return run
    }
    expect(play()).toEqual(play())
  })
})
