import { Campaign } from "../../../src/campaign/campaign"
import { beats, type Glance, glance } from "../../../src/screen/run/beat"

const calm: Glance = { supplies: 10, intel: 4, materials: 0, force: 1, project: 3, roster: [], ops: [] }

describe("beats", () => {
  test("a quiet week has none", () => {
    expect(beats(calm, calm, [])).toEqual([])
  })
  test("each resource that grew is a beat with its gain that counts its counter up", () => {
    const b = beats(calm, { ...calm, supplies: 22, materials: 2 }, [])
    expect(b.map((x) => [x.icon, x.note.key, x.note.params.amount, x.counter])).toEqual([
      ["world:supplies", "recap.supplies", 12, "supplies"],
      ["world:materials", "recap.materials", 2, "materials"],
    ])
  })
  test("a new soldier, a Force Level and a Project rise are beats", () => {
    const after = { ...calm, force: 2, project: 5, roster: [{ id: "s9", name: "Vega", level: 1 }] }
    expect(beats(calm, after, []).map((x) => x.note)).toEqual([
      { key: "recap.recruit", params: { name: "Vega" } },
      { key: "recap.force", params: { force: 2 } },
      { key: "recap.project", params: { amount: 2 } },
    ])
  })
  test("report lines keep their order and mark their region; a spread also marks where it came from", () => {
    const b = beats(calm, calm, [
      { key: "week.research", params: { tech: "armor2" } },
      { key: "week.spread", params: { from: "na", region: "sa" } },
      { key: "week.ignored", params: { op: "intel", region: "af", penalty: "project" } },
    ])
    expect(b.map((x) => [x.icon, x.region, x.from])).toEqual([
      ["world:research", null, undefined],
      ["world:strength", "sa", "na"],
      ["op:intel", "af", undefined],
    ])
  })
  test("a soldier who reached a new level is a beat", () => {
    const before = { ...calm, roster: [{ id: "s1", name: "Vega", level: 1 }] }
    const after = { ...calm, roster: [{ id: "s1", name: "Vega", level: 2 }] }
    expect(beats(before, after, []).map((x) => [x.icon, x.note])).toEqual([
      ["world:rank", { key: "recap.level", params: { name: "Vega", level: 2 } }],
    ])
  })
  test("a won or lost mission is a beat with its operation's icon", () => {
    const b = beats(calm, calm, [{ key: "week.won", params: { op: "relay", region: "af" } }])
    expect(b.map((x) => [x.icon, x.region])).toEqual([["op:relay", "af"]])
  })
  test("a new operation is announced in its region", () => {
    const after = { ...calm, ops: [{ id: 2, kind: "captain" as const, region: "eas" as const }] }
    expect(beats(calm, after, []).map((x) => [x.icon, x.note.key, x.region])).toEqual([
      ["op:captain", "recap.new", "eas"],
    ])
  })
  test("a glance reads a campaign's resources, roster and operations", () => {
    const c = Campaign.start(7, 3)
    const g = glance(c)
    expect(g.supplies).toBe(c.supplies)
    expect(g.roster.map((s) => s.id)).toEqual(c.roster.map((s) => s.id))
    expect(g.ops.map((o) => o.id)).toEqual(c.ops.map((o) => o.id))
  })
})
