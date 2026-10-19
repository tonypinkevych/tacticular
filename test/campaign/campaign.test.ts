import {
  Campaign,
  CONTACT_COST,
  GOALS,
  LIBERATION,
  type Op,
  RECRUIT_COST,
  RESISTANCE,
} from "../../src/campaign/campaign"
import { kit } from "../../src/campaign/soldier"
import { place } from "../../src/campaign/world"

const fresh = (seed = 7, goal: 1 | 3 | 8 = 1) => Campaign.start(seed, goal)
const home = (c: Campaign) => c.regions.find((r) => r.resistance > 0)!
const squad = (c: Campaign, n = 4) =>
  c
    .ready()
    .slice(0, n)
    .map((s) => s.id)
const launch = (c: Campaign, op: Op, n = 3) => {
  c.play({ type: "send", op: op.id, squad: squad(c, n) })
  c.play({ type: "week" })
  c.play({ type: "launch", op: op.id })
}
const win = (c: Campaign, op: Op) => ({
  won: true,
  hp: Object.fromEntries(op.squad.map((id) => [id, c.roster.find((s) => s.id === id)!.hp])),
})

describe("campaign", () => {
  test("starts with one region in contact, two operations there, and 6 soldiers of 6 classes", () => {
    const c = fresh()
    expect(c.regions.filter((r) => r.resistance > 0)).toHaveLength(1)
    expect(c.ops.filter((o) => o.region === home(c).id)).toHaveLength(2)
    expect(new Set(c.roster.map((s) => s.kind)).size).toBe(6)
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
  test("a recruit costs Supplies", () => {
    const c = fresh()
    c.play({ type: "recruit" })
    expect(c.roster).toHaveLength(7)
    expect(c.supplies).toBe(10 - RECRUIT_COST)
  })
  test("a squad of 3 or 4 ready soldiers is sent before the operation's last week, and is away", () => {
    const c = fresh()
    const op = c.ops[0]
    expect(() => c.play({ type: "send", op: op.id, squad: squad(c, 2) })).toThrow()
    c.play({ type: "send", op: op.id, squad: squad(c) })
    expect(op.sent).toBe(c.week)
    expect(c.ready()).toHaveLength(2)
    const last = c.ops[1]
    last.expires = c.week
    expect(() => c.play({ type: "send", op: last.id, squad: squad(c, 2) })).toThrow()
  })
  test("a sent squad is called back and the operation is open again", () => {
    const c = fresh()
    const op = c.ops[0]
    c.play({ type: "send", op: op.id, squad: squad(c) })
    c.play({ type: "cancel", op: op.id })
    expect([op.sent, op.squad]).toEqual([null, []])
    expect(c.ready()).toHaveLength(6)
  })
  test("a week with nothing to launch moves the world on and the Project by 1", () => {
    const c = fresh()
    c.play({ type: "week" })
    expect(c.stage).toBe("world")
    expect(c.week).toBe(2)
    expect(c.project).toBe(1)
  })
  test("a sent operation is ready after a week and Launch plays it at once; a win pays it and gives XP", () => {
    const c = fresh()
    const op = c.ops.find((o) => o.kind === "intel")!
    c.play({ type: "send", op: op.id, squad: squad(c, 3) })
    expect(() => c.play({ type: "launch", op: op.id })).toThrow()
    const intel = c.intel
    c.play({ type: "week" })
    expect(c.stage).toBe("world")
    c.play({ type: "launch", op: op.id })
    expect(c.stage).toBe("mission")
    expect(c.conditions().goal).toBe("intel")
    const sent = op.squad
    c.play({ type: "finish", result: win(c, op) })
    expect(c.stage).toBe("world")
    expect(c.week).toBe(2)
    expect(c.intel).toBe(intel + 4)
    expect(home(c).resistance).toBe(2)
    const back = c.roster.filter((s) => sent.includes(s.id))
    expect(back.every((s) => s.xp === GOALS[1].xp && s.rest === 0)).toBe(true)
    expect(c.roster.filter((s) => !sent.includes(s.id)).every((s) => s.xp === GOALS[1].xp / 4)).toBe(true)
  })
  test("End week waits while a ready operation is at its last week, until it is launched or called back", () => {
    const c = fresh()
    const op = c.ops[0]
    c.play({ type: "send", op: op.id, squad: squad(c) })
    while (c.week < op.expires) c.play({ type: "week" })
    expect(c.due()).toBe(op)
    expect(() => c.play({ type: "week" })).toThrow()
    c.play({ type: "cancel", op: op.id })
    expect(c.due()).toBeNull()
    c.play({ type: "week" })
    expect(c.ops).not.toContain(op)
  })
  test("a soldier at 0 HP after a mission leaves the roster", () => {
    const c = fresh()
    const op = c.ops[0]
    launch(c, op)
    const dead = op.squad[0]
    c.play({ type: "finish", result: { won: false, hp: { ...win(c, op).hp, [dead]: 0 } } })
    expect(c.roster.some((s) => s.id === dead)).toBe(false)
  })
  test("each week of waiting raises infiltration one tier up to 5: more aliens and alarm early, marked groups late", () => {
    const short = fresh()
    launch(short, short.ops[0], 4)
    const long = fresh()
    const op = long.ops[0]
    op.expires = long.week + 9
    long.play({ type: "send", op: op.id, squad: squad(long, 4) })
    const tiers: number[] = []
    for (let i = 0; i < 5; i++) {
      long.play({ type: "week" })
      tiers.push(long.score(op))
    }
    long.play({ type: "launch", op: op.id })
    expect(tiers).toEqual([2, 3, 4, 5, 5])
    expect(short.conditions().alarm).toBe(1)
    expect(short.conditions().groups).toBeGreaterThan(long.conditions().groups!)
    expect(long.conditions().scouted).toBe(true)
  })
  test("a Liberation opens at full Resistance and low Strength; its win frees the region and wins goal 1", () => {
    const c = fresh()
    Object.assign(home(c), { resistance: RESISTANCE, strength: LIBERATION })
    c.play({ type: "week" })
    const op = c.ops.find((o) => o.kind === "liberation")!
    expect(op).toBeDefined()
    launch(c, op, 4)
    expect(c.conditions().goal).toBe("warchief")
    c.play({ type: "finish", result: win(c, op) })
    expect(c.stage).toBe("won")
  })
  test("the campaign is lost when the Project ends", () => {
    const c = fresh()
    c.project = GOALS[1].end - 1
    c.play({ type: "week" })
    expect(c.stage).toBe("lost")
  })
  test("the Force Level rises each pace weeks of the goal", () => {
    const c = fresh(7, 3)
    for (let i = 0; i < GOALS[3].pace; i++) c.play({ type: "week" })
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
  test("an unanswered retaliation costs the region 1 Resistance", () => {
    const c = fresh()
    Object.assign(home(c), { resistance: 2, vigilance: 9 })
    for (let i = 0; i < 6 && !c.ops.some((o) => o.kind === "defend"); i++) c.play({ type: "week" })
    const op = c.ops.find((o) => o.kind === "defend")!
    const before = home(c).resistance
    while (c.ops.includes(op)) c.play({ type: "week" })
    expect(home(c).resistance).toBe(before - 1)
  })
  test("a rank point is spent only where the level allows", () => {
    const c = fresh()
    const s = c.roster[0]
    const [first, second] = kit(s)
    c.play({ type: "rank", soldier: s.id, skill: first })
    expect(s.ranks![first]).toBe(1)
    expect(() => c.play({ type: "rank", soldier: s.id, skill: second })).toThrow()
  })
})
