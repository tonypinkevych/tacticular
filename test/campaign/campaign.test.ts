import { Campaign, CONTACT_COST, GOALS, type Op, RECRUIT_COST, RESISTANCE } from "../../src/campaign/campaign"
import { kit, points } from "../../src/campaign/soldier"
import { place } from "../../src/campaign/world"

const fresh = (seed = 7, goal: 3 | 5 | 8 = 3) => Campaign.start(seed, goal)
const home = (c: Campaign) => c.regions.find((r) => r.resistance > 0)!
const squad = (c: Campaign, n = 3) =>
  c
    .ready()
    .slice(0, n)
    .map((s) => s.id)
const launch = (c: Campaign, op: Op, n = 3) => c.play({ type: "launch", op: op.id, squad: squad(c, n) })
const win = (c: Campaign, op: Op) => ({
  won: true,
  hp: Object.fromEntries(op.squad.map((id) => [id, c.roster.find((s) => s.id === id)!.hp])),
})
const posted = (c: Campaign, kind: Op["kind"]) => {
  for (let i = 0; i < 40 && !c.ops.some((o) => o.kind === kind); i++) c.play({ type: "week" })
  return c.ops.find((o) => o.kind === kind)!
}
describe("campaign", () => {
  test("starts with one region in contact, two alien sites away from it, 4 soldiers of 4 classes and 2 posted ops", () => {
    const c = fresh()
    expect(c.regions.filter((r) => r.resistance > 0)).toHaveLength(1)
    expect(c.regions.filter((r) => r.site && r !== home(c))).toHaveLength(2)
    expect(c.roster).toHaveLength(4)
    expect(new Set(c.roster.map((s) => s.kind)).size).toBe(4)
    expect(c.ops.map((o) => o.region)).toEqual([home(c).id, home(c).id])
  })
  test("each week posts 3 operations once two regions are in contact, each with a difficulty from 1 to 4", () => {
    const c = fresh()
    c.intel = 10
    c.play({ type: "contact", region: place(home(c).id).next[0] })
    c.play({ type: "week" })
    expect(c.ops).toHaveLength(3)
    expect(c.ops.every((o) => o.difficulty >= 1 && o.difficulty <= 4)).toBe(true)
  })
  test("a week never posts two operations of one kind in one region", () => {
    const c = fresh()
    for (let i = 0; i < 30 && c.stage === "world"; i++) {
      const keys = c.ops.map((o) => `${o.kind}:${o.region}`)
      expect(new Set(keys).size).toBe(keys.length)
      c.play({ type: "week" })
    }
  })
  test("a squad of 3 ready soldiers launches a posted operation at once, and only one each week", () => {
    const c = fresh()
    const [op, other] = c.ops
    expect(() => c.play({ type: "launch", op: op.id, squad: squad(c, 2) })).toThrow()
    launch(c, op)
    expect(c.stage).toBe("mission")
    c.play({ type: "finish", result: win(c, op) })
    expect(() => launch(c, other)).toThrow()
  })
  test("a week moves the Project by 1, and each ignored operation pays its penalty and leaves", () => {
    const c = fresh()
    c.ops = c.ops.map((o) => ({ ...o, penalty: "project" as const }))
    c.play({ type: "week" })
    expect(c.week).toBe(2)
    expect(c.project).toBe(1 + 2 * 2)
    expect(c.report.filter((n) => n.key === "week.ignored")).toHaveLength(2)
  })
  test("a won Intel operation pays Supplies and Intel by its difficulty and gives XP, but no Resistance", () => {
    const c = fresh()
    const op = posted(c, "intel")
    op.difficulty = 3
    const [supplies, intel] = [c.supplies, c.intel]
    launch(c, op)
    expect(c.conditions().goal).toBe("intel")
    const sent = op.squad
    c.play({ type: "finish", result: win(c, op) })
    expect([c.supplies, c.intel]).toEqual([supplies + 6, intel + 5])
    expect(home(c).resistance).toBe(1)
    const back = c.roster.filter((s) => sent.includes(s.id))
    expect(back.every((s) => s.xp === GOALS[3].xp)).toBe(true)
    expect(c.roster.filter((s) => !sent.includes(s.id)).every((s) => s.xp === GOALS[3].xp / 4)).toBe(true)
  })
  test("difficulty sets the pods, their size and the alarm", () => {
    const at = (d: 1 | 4) => {
      const c = fresh()
      c.ops[0].difficulty = d
      launch(c, c.ops[0])
      return c.conditions()
    }
    expect([at(1).groups, at(1).size, at(1).alarm]).toEqual([2, 2, 0])
    expect([at(4).groups, at(4).size, at(4).alarm]).toEqual([5, 3, 1])
  })
  test("a Captain win opens a Liberation the next week; its win frees the region, and the third one wins goal 3", () => {
    const c = fresh()
    for (const r of c.regions.filter((x) => x !== home(c)).slice(0, 2)) r.free = true
    const op = posted(c, "captain")
    launch(c, op)
    c.play({ type: "finish", result: win(c, op) })
    expect(home(c).resistance).toBe(RESISTANCE)
    c.play({ type: "week" })
    const lib = c.ops.find((o) => o.kind === "liberation")!
    launch(c, lib)
    expect(c.conditions().goal).toBe("warchief")
    c.play({ type: "finish", result: win(c, lib) })
    expect(c.stage).toBe("won")
  })
  test("a Relay is posted only where there is a site, and its win destroys the site and cuts the Project", () => {
    const c = fresh()
    home(c).site = true
    const op = posted(c, "relay")
    expect(c.region(op.region).site).toBe(true)
    c.project = 5
    launch(c, op)
    c.play({ type: "finish", result: win(c, op) })
    expect([c.region(op.region).site, c.project]).toEqual([false, 3])
  })
  test("an ignored retaliation costs the region 1 Resistance", () => {
    const c = fresh()
    Object.assign(home(c), { resistance: 2, vigilance: 9 })
    c.play({ type: "week" })
    expect(c.ops.some((o) => o.kind === "defend")).toBe(true)
    c.play({ type: "week" })
    expect(home(c).resistance).toBe(1)
  })
  test("each month the strongest alien region gives 1 Strength to its weakest weaker neighbour", () => {
    const c = fresh()
    for (const r of c.regions) r.strength = 4
    c.region("na").strength = 9
    c.region("sa").strength = 2
    for (let i = 0; i < 4; i++) {
      c.ops = []
      c.play({ type: "week" })
    }
    expect(c.region("sa").strength).toBe(3)
    expect(c.report).toContainEqual({ key: "week.spread", params: { from: "na", region: "sa" } })
  })
  test("a free South Asia takes 1 off the difficulty of every new operation", () => {
    const c = fresh()
    expect(home(c).id).not.toBe("sas")
    home(c).strength = 10
    c.region("sas").free = true
    for (let i = 0; i < 8; i++) {
      c.play({ type: "week" })
      expect(c.ops.filter((o) => o.kind !== "captain").every((o) => o.difficulty <= 3)).toBe(true)
    }
  })
  test("Intel contacts a region next to one in contact", () => {
    const c = fresh()
    const far = c.regions.find((r) => r.resistance === 0 && !place(home(c).id).next.includes(r.id))!
    expect(() => c.play({ type: "contact", region: far.id })).toThrow()
    const near = place(home(c).id).next[0]
    const intel = c.intel
    c.play({ type: "contact", region: near })
    expect(c.region(near).resistance).toBe(1)
    expect(c.intel).toBe(intel - CONTACT_COST)
  })
  test("a recruit costs Supplies and is of the class the player picks", () => {
    const c = fresh()
    c.play({ type: "recruit", kind: "engineer" })
    expect(c.roster).toHaveLength(5)
    expect(c.roster[4].kind).toBe("engineer")
    expect(c.supplies).toBe(10 - RECRUIT_COST)
  })
  test("a squad holds 3 until Squad size research, then 4", () => {
    const c = fresh()
    c.supplies = 50
    c.materials = 10
    expect(() => launch(c, c.ops[0], 4)).toThrow()
    c.play({ type: "research", tech: "squad" })
    c.play({ type: "week" })
    c.play({ type: "week" })
    expect(c.most()).toBe(4)
    launch(c, c.ops[0], 4)
    expect(c.conditions().squad).toHaveLength(4)
  })
  test("no free soldier comes in a month; a free South America brings one", () => {
    const c = fresh()
    c.ops = []
    for (let i = 0; i < 4; i++) c.play({ type: "week" })
    expect(c.roster).toHaveLength(4)
    c.region(home(c).id === "sa" ? "na" : "sa").free = true
    for (let i = 0; i < 4; i++) c.play({ type: "week" })
    expect(c.roster).toHaveLength(5)
  })
  test("a soldier at 0 HP after a mission leaves the roster", () => {
    const c = fresh()
    const op = c.ops[0]
    launch(c, op)
    const dead = op.squad[0]
    c.play({ type: "finish", result: { won: false, hp: { ...win(c, op).hp, [dead]: 0 } } })
    expect(c.roster.some((s) => s.id === dead)).toBe(false)
  })
  test("the campaign is lost when the Project ends", () => {
    const c = fresh()
    c.project = GOALS[3].end - 1
    c.play({ type: "week" })
    expect(c.stage).toBe("lost")
  })
  test("the Force Level rises each pace weeks of the goal", () => {
    const c = fresh(7, 5)
    for (let i = 0; i < GOALS[5].pace; i++) c.play({ type: "week" })
    expect(c.force).toBe(2)
  })
  test("each month both sides get income", () => {
    const c = fresh()
    for (let i = 0; i < 4; i++) c.play({ type: "week" })
    expect(c.supplies).toBe(10 + 10 + 2)
    expect(c.intel).toBe(4 + 2)
    expect(c.project).toBeGreaterThan(4)
  })
  test("research takes 2 weeks, then armor gives the squad 2 HP", () => {
    const c = fresh()
    c.supplies = 50
    c.materials = 10
    c.play({ type: "research", tech: "armor2" })
    expect(() => c.play({ type: "research", tech: "weapons2" })).toThrow()
    c.play({ type: "week" })
    c.play({ type: "week" })
    expect(c.techs).toContain("armor2")
    launch(c, c.ops[0])
    const s = c.conditions().squad![0]
    expect(s.hp).toBe(c.roster.find((x) => x.id === s.id)!.hp + 2)
  })
  test("a mission takes each soldier's level, and its result brings back the ranks spent in it", () => {
    const c = fresh()
    const op = c.ops[0]
    launch(c, op)
    const s = c.roster.find((x) => x.id === op.squad[0])!
    expect(c.conditions().squad![0].level).toBe(1)
    c.play({ type: "finish", result: { ...win(c, op), ranks: { [s.id]: { [kit(s)[0]]: 1 } } } })
    expect(s.ranks).toEqual({ [kit(s)[0]]: 1 })
  })
  test("a rank point is spent only where the level allows", () => {
    const c = fresh()
    const s = c.roster[0]
    const [first, second] = kit(s)
    c.play({ type: "rank", soldier: s.id, skill: first })
    expect(s.ranks![first]).toBe(1)
    expect(() => c.play({ type: "rank", soldier: s.id, skill: second })).toThrow()
  })
  test("a rank-up of a skill that left the kit is skipped, so the point stays", () => {
    const c = fresh()
    const s = c.roster[0]
    c.play({ type: "rank", soldier: s.id, skill: "shove" as never })
    expect(s.ranks).toEqual({})
    expect(points(s)).toBe(1)
  })
})
