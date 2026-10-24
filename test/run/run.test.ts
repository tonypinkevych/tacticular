import { Run } from "../../src/run/run"

const drafted = () => {
  const r = Run.start(5)
  r.play({ type: "draft", picks: r.candidates.slice(0, 3).map((c) => c.id) })
  return r
}
const go = (r: Run) => r.play({ type: "go", node: r.options()[0].id, deploy: r.roster.slice(0, 3).map((s) => s.id) })

describe("run", () => {
  test("a run offers one soldier of each class and drafts 3", () => {
    const r = Run.start(5)
    expect(r.candidates.map((c) => c.kind).sort()).toEqual(["cleric", "ranger", "vanguard", "warden"])
    expect(drafted().roster).toHaveLength(3)
  })
  test("going to a mission raises the threat and builds it", () => {
    const r = drafted()
    go(r)
    expect([r.stage, r.threat]).toEqual(["mission", 1])
    expect(r.conditions().squad).toHaveLength(3)
  })
  test("soldiers keep the HP they leave with and heal 2; after a win the fallen come back with 1 HP", () => {
    const r = drafted()
    go(r)
    const [a, b, c] = r.roster
    r.play({ type: "finish", result: { won: true, hp: { [a.id]: 2, [b.id]: 0, [c.id]: c.max } } })
    expect(r.roster.map((s) => s.hp)).toEqual([4, 3, c.max])
  })
  test("after a loss the fallen are dead", () => {
    const r = drafted()
    go(r)
    const [a, b, c] = r.roster
    r.play({ type: "finish", result: { won: false, hp: { [a.id]: 2, [b.id]: 0, [c.id]: 0 } } })
    expect(r.roster.map((s) => s.id)).toEqual([a.id])
  })
  test("a win offers 3 rewards; a loss raises the threat", () => {
    const r = drafted()
    go(r)
    r.play({ type: "finish", result: { won: true, hp: Object.fromEntries(r.roster.map((s) => [s.id, s.max])) } })
    expect([r.stage, r.offers.length]).toEqual(["reward", 3])
    const l = drafted()
    go(l)
    l.play({ type: "finish", result: { won: false, hp: Object.fromEntries(l.roster.map((s) => [s.id, 1])) } })
    expect([l.stage, l.threat]).toEqual(["chart", 2])
  })
  test("training and a skill upgrade carry into the next mission", () => {
    const r = drafted()
    const id = r.roster[0].id
    r.train(id)
    r.upgrade(id)
    go(r)
    expect(r.conditions().squad[0].extra).toEqual({ hp: 1, aim: 5, upgrades: 1 })
  })
  test("winning the fortress wins the run; losing every soldier loses it", () => {
    const r = drafted()
    r.at = r.chart.layer(4)[0].id
    r.stage = "mission"
    r.deployed = r.roster.map((s) => s.id)
    r.play({ type: "finish", result: { won: true, hp: Object.fromEntries(r.roster.map((s) => [s.id, 1])) } })
    expect(r.stage).toBe("won")
    const l = drafted()
    go(l)
    l.play({ type: "finish", result: { won: false, hp: {} } })
    expect(l.stage).toBe("lost")
  })
})
