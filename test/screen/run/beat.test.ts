import { Campaign } from "../../../src/campaign/campaign"
import { beats, type Glance, glance } from "../../../src/screen/run/beat"

const calm: Glance = { supplies: 10, intel: 4, materials: 0, force: 1, project: 3, roster: [], ops: [] }

describe("beats", () => {
  test("a quiet week has none", () => {
    expect(beats(calm, calm, [])).toEqual([])
  })
  test("each resource that grew is a beat with its gain", () => {
    const b = beats(calm, { ...calm, supplies: 22, materials: 2 }, [])
    expect(b.map((x) => [x.icon, x.note.key, x.note.params.amount])).toEqual([
      ["world:supplies", "recap.supplies", 12],
      ["world:materials", "recap.materials", 2],
    ])
  })
  test("a new soldier, a Force Level and a Project rise are beats", () => {
    const after = { ...calm, force: 2, project: 5, roster: [{ id: "s9", name: "Vega" }] }
    expect(beats(calm, after, []).map((x) => x.note)).toEqual([
      { key: "recap.recruit", params: { name: "Vega" } },
      { key: "recap.force", params: { force: 2 } },
      { key: "recap.project", params: { amount: 2 } },
    ])
  })
  test("report lines keep their order and mark their region", () => {
    const b = beats(calm, calm, [
      { key: "week.research", params: { tech: "armor2" } },
      { key: "week.reinforced", params: { region: "af" } },
    ])
    expect(b.map((x) => [x.icon, x.region])).toEqual([
      ["world:research", null],
      ["world:strength", "af"],
    ])
  })
  test("an operation gone is expired and a new one is announced, each in its region", () => {
    const before = { ...calm, ops: [{ id: 1, kind: "intel" as const, region: "na" as const }] }
    const after = { ...calm, ops: [{ id: 2, kind: "captain" as const, region: "eas" as const }] }
    expect(beats(before, after, []).map((x) => [x.icon, x.note.key, x.region])).toEqual([
      ["op:intel", "recap.expired", "na"],
      ["op:captain", "recap.new", "eas"],
    ])
  })
  test("a glance reads a campaign's resources, roster and operations", () => {
    const c = Campaign.start(7, 1)
    const g = glance(c)
    expect(g.supplies).toBe(c.supplies)
    expect(g.roster.map((s) => s.id)).toEqual(c.roster.map((s) => s.id))
    expect(g.ops.map((o) => o.id)).toEqual(c.ops.map((o) => o.id))
  })
})
