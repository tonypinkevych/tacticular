import { aliens } from "../../src/mission/mission"
import { Run } from "../../src/run/run"
import { BRANCHES } from "../../src/units/profiles"

const drafted = () => {
  const r = Run.start(5)
  r.play({ type: "draft", picks: r.candidates.slice(0, 3).map((c) => c.id) })
  return r
}
const go = (r: Run) => r.play({ type: "go", node: r.options()[0].id, deploy: r.roster.slice(0, 3).map((s) => s.id) })

describe("run", () => {
  test("a run offers one soldier of each class and drafts 3", () => {
    const r = Run.start(5)
    expect(r.candidates.map((c) => c.kind).sort()).toEqual(["blade", "cleric", "ranger", "vanguard", "warden"])
    expect(drafted().roster).toHaveLength(3)
  })
  test("a node on the chart tells the goal and the aliens its mission would start with", () => {
    const r = drafted()
    const n = r.options()[0]
    go(r)
    const c = r.conditions()
    expect(drafted().preview(n.id)).toEqual({
      goal: c.goal,
      threat: c.threat,
      boss: c.boss,
      biome: c.biome,
      foe: c.foe,
      aliens: aliens(c),
    })
  })
  test("going to a mission raises the threat and builds it", () => {
    const r = drafted()
    go(r)
    expect([r.stage, r.threat]).toEqual(["mission", 1])
    expect(r.conditions().squad).toHaveLength(3)
  })
  test("soldiers keep the HP they leave with and heal 3; after a win the fallen come back with 1 HP", () => {
    const r = drafted()
    go(r)
    const [a, b, c] = r.roster
    r.play({ type: "finish", result: { won: true, hp: { [a.id]: 2, [b.id]: 0, [c.id]: c.max } } })
    expect(r.roster.map((s) => s.hp)).toEqual([5, 4, c.max])
  })
  test("after a loss the fallen are dead", () => {
    const r = drafted()
    go(r)
    const [a, b, c] = r.roster
    r.play({ type: "finish", result: { won: false, hp: { [a.id]: 2, [b.id]: 0, [c.id]: 0 } } })
    expect(r.roster.map((s) => s.id)).toEqual([a.id])
  })
  test("a win offers only the prize of its node; a loss raises the threat", () => {
    const r = drafted()
    go(r)
    const prize = r.chart.node(r.at ?? 0).prize
    r.play({ type: "finish", result: { won: true, hp: Object.fromEntries(r.roster.map((s) => [s.id, s.max])) } })
    expect(r.stage).toBe("reward")
    expect(r.offers.every((o) => o.kind === prize)).toBe(true)
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
  test("the first upgrade of a soldier picks one of its 2 branches, and later ones add a use or take a turn", () => {
    const r = drafted()
    const s = r.roster.find((x) => x.kind === "ranger") ?? r.roster[0]
    r.upgrade(s.id, BRANCHES[s.kind][1])
    r.upgrade(s.id)
    expect(s.extra).toMatchObject({ branch: BRANCHES[s.kind][1], upgrades: 1 })
  })
  test("an upgrade prize offers both branches of a soldier that has none", () => {
    for (let seed = 1; seed < 50; seed++) {
      const r = Run.start(seed)
      r.play({ type: "draft", picks: r.candidates.slice(0, 3).map((c) => c.id) })
      const n = r.options().find((x) => x.prize === "upgrade")
      if (!n) continue
      r.play({ type: "go", node: n.id, deploy: r.roster.map((x) => x.id) })
      r.play({ type: "finish", result: { won: true, hp: {}, combos: {} } })
      const first = r.offers[0]
      if (first.kind !== "upgrade") throw new Error("not an upgrade")
      const s = r.roster.find((x) => x.id === first.id)
      expect(
        r.offers.filter((o) => o.kind === "upgrade" && o.id === first.id).map((o) => o.kind === "upgrade" && o.branch),
      ).toEqual(s ? BRANCHES[s.kind] : [])
      return
    }
    throw new Error("no seed")
  })
  test("a soldier who lands 2 combos in a mission becomes a Partner", () => {
    const r = drafted()
    go(r)
    const [a, b] = r.deployed
    r.play({ type: "finish", result: { won: false, hp: { [a]: 3, [b]: 3 }, combos: { [a]: 2, [b]: 1 } } })
    const partner = (id: string) => r.roster.find((s) => s.id === id)?.extra.partner
    expect([partner(a), partner(b)]).toEqual([true, undefined])
  })
})
