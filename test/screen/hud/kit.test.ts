import { Kit } from "../../../src/screen/hud/kit"
import { enemy, open, setup, squad } from "../../fixture"

describe("hover sets the armed target", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const c = squad("c", "cleric", { x: 1, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, c, e])
  const shot = { slot: "weapon:repeater", target: null, at: null }

  test("a foe in reach becomes the target", () => {
    expect(new Kit(g, w).retarget(shot, { x: 5, y: 1 }).target).toBe("e")
  })
  test("an ally does not become the target of an attack", () => {
    expect(new Kit(g, w).retarget(shot, { x: 1, y: 1 }).target).toBeNull()
  })
  test("an empty tile keeps the last target", () => {
    expect(new Kit(g, w).retarget({ ...shot, target: "e" }, { x: 3, y: 0 }).target).toBe("e")
  })
  test("a friendly ability takes an ally in range and not a foe", () => {
    const heal = { slot: "ability:heal", target: null, at: null }
    expect(new Kit(g, c).retarget(heal, { x: 0, y: 1 }).target).toBe("w")
    expect(new Kit(g, c).retarget(heal, { x: 5, y: 1 }).target).toBeNull()
  })
})

describe("a controlled alien", () => {
  const c = squad("c", "cleric", { x: 1, y: 1 })
  const w = squad("w", "warden", { x: 0, y: 0 })
  const e = enemy("e", "orc", { x: 2, y: 1 })
  e.give({ id: "dominated", rounds: 2 })
  const g = setup(open(8, 3), [w, c, e])

  test("takes the squad's heal by hover and as the default target", () => {
    const armed = { slot: "ability:heal", target: null, at: null }
    expect(new Kit(g, c).retarget(armed, e.pos).target).toBe("e")
  })
  test("takes a soldier's shot by hover, but is not its default target", () => {
    const f = enemy("f", "orc", { x: 6, y: 1 })
    const h = setup(open(8, 3), [squad("v", "vanguard", { x: 0, y: 1 }), e.clone(), f])
    const v = h.units[0]
    const shot = { slot: "weapon:shotgun", target: null, at: null }
    expect(new Kit(h, v).retarget(shot, e.pos).target).toBe("e")
    expect(new Kit(h, v).target("weapon:shotgun")).toBe("f")
  })
  test("takes the Medic's Shield", () => {
    expect(new Kit(g, c).retarget({ slot: "ability:ward", target: null, at: null }, e.pos).target).toBe("e")
  })
})

describe("sights", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(["........", "........", "...#....", "........"], [w, e])

  test("the foes a soldier can target, with the hit chance and whether they are flanked", () => {
    const [s] = new Kit(g, w).sights()
    expect(s.unit?.id).toBe("e")
    expect(s.chance).toBeGreaterThan(0)
    expect(s.flanked).toBe(true)
  })
  test("from another tile it lists the known foes the soldier would see there", () => {
    const far = enemy("f", "orc", { x: 6, y: 3 })
    const spotter = squad("s", "rogue", { x: 7, y: 0 })
    const walled = setup(["....#...", "....#...", "....#...", "........"], [w, far, spotter])
    expect(new Kit(walled, w).sights()).toEqual([])
    expect(new Kit(walled, w).sights({ x: 3, y: 3 }).map((s) => s.unit?.id)).toEqual(["f"])
  })
})

describe("a barrel", () => {
  const w = squad("w", "warden", { x: 1, y: 1 })
  const g = setup(["........", ".....b..", "........"], [w, enemy("e", "orc", { x: 7, y: 2 })])
  test("a weapon aims at a barrel under the cursor, and firing shoots it", () => {
    const kit = new Kit(g, w)
    const armed = kit.retarget({ slot: "weapon:repeater", target: null, at: null }, { x: 5, y: 1 })
    expect(armed.at).toEqual({ x: 5, y: 1 })
    expect(kit.action(armed)).toEqual({ type: "shoot", unit: "w", at: { x: 5, y: 1 } })
  })
  test("is one of the targets of a weapon, with the foes in reach, nearest first", () => {
    const kit = new Kit(g, w)
    const all = kit.targets({ slot: "weapon:repeater", target: null, at: null })
    expect(all.map((x) => x.target ?? x.at)).toEqual([{ x: 5, y: 1 }, "e"])
  })
  test("shows in the sights after the foes, sure to blow up", () => {
    const sights = new Kit(g, w).sights()
    expect(sights.map((c) => c.unit?.id ?? c.at)).toEqual(["e", { x: 5, y: 1 }])
    expect(sights[1].chance).toBe(100)
  })
})

describe("objective", () => {
  test("the Use slot shows next to an unused objective and gives the Use action", () => {
    const s = squad("s", "rogue", { x: 1, y: 1 })
    const g = setup(open(8, 3), [s, enemy("e", "orc", { x: 7, y: 1 }, "unaware")])
    g.goal = { kind: "relay", at: { x: 5, y: 1 }, planted: null, tiles: [], blown: false }
    expect(new Kit(g, s).slots().some((x) => x.id === "use")).toBe(false)
    g.goal = { kind: "relay", at: { x: 2, y: 1 }, planted: null, tiles: [], blown: false }
    const use = new Kit(g, s).slotFor("9")
    expect(use?.id).toBe("use")
    expect(new Kit(g, s).action({ slot: "use", target: null, at: null })).toEqual({ type: "use", unit: "s" })
  })
})

describe("door", () => {
  test("the Door slot shows next to a door, aims at it first and gives the Door action", () => {
    const s = squad("s", "rogue", { x: 1, y: 1 })
    const g = setup(["#####", "#.+..", "#####"], [s, enemy("e", "orc", { x: 4, y: 1 }, "unaware")])
    const kit = new Kit(g, s)
    expect(kit.slotFor("0")?.id).toBe("door")
    expect(kit.spot("door")).toEqual({ x: 2, y: 1 })
    expect(kit.action({ slot: "door", target: null, at: { x: 2, y: 1 } })).toEqual({
      type: "door",
      unit: "s",
      at: { x: 2, y: 1 },
    })
    const far = squad("f", "rogue", { x: 4, y: 1 })
    expect(new Kit(setup(["#####", "#.+..", "#####"], [far]), far).slotFor("0")).toBeUndefined()
  })
})

describe("cues", () => {
  const cue = (g: ReturnType<typeof setup>, id: string, slot: string) =>
    new Kit(g, g.units.find((u) => u.id === id)!).slots().find((s) => s.id === slot)?.cue
  test("Headshot lights when a flanked alien is in reach, not when it stands in cover", () => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    expect(cue(setup(open(10, 2), [r, enemy("e", "orc", { x: 6, y: 0 })]), "r", "ability:headshot")).toBe(true)
    const covered = setup(["......H.", "........"], [r.clone(), enemy("e", "orc", { x: 7, y: 0 })])
    expect(cue(covered, "r", "ability:headshot")).toBe(false)
  })
  test("Backstab lights when the concealed Scout stands next to an alien", () => {
    const g = setup(open(6, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 1, y: 0 }, "unaware")])
    expect(cue(g, "g", "ability:backstab")).toBe(true)
    const far = setup(open(6, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 }, "unaware")])
    expect(cue(far, "g", "ability:backstab")).toBe(false)
  })
  test("Medkit lights when an ally in reach is down, wounded or poisoned", () => {
    const g = setup(open(6, 2), [squad("c", "cleric", { x: 0, y: 0 }), squad("v", "vanguard", { x: 1, y: 0 })])
    expect(cue(g, "c", "ability:heal")).toBe(false)
    g.units[1].give({ id: "poisoned", rounds: 3 })
    expect(cue(g, "c", "ability:heal")).toBe(true)
  })
})

describe("rank-ups on the bar", () => {
  test("a soldier with a free point shows every skill of its kit, with a + where its level allows", () => {
    const v = squad("v", "vanguard", { x: 0, y: 1 })
    v.ranks = { close: 1 }
    v.level = 3
    const slots = new Kit(setup(open(8, 3), [v, enemy("e", "orc", { x: 7, y: 1 })]), v).slots()
    const up = (id: string) => slots.find((s) => s.id === `ability:${id}`)?.up
    expect([up("close"), up("run"), up("breach"), up("rampage")]).toEqual([true, true, true, false])
    expect(slots.find((s) => s.id === "ability:run")?.disabled).toBe(true)
  })
  test("a soldier with no level shows no +", () => {
    const v = squad("v", "vanguard", { x: 0, y: 1 })
    const slots = new Kit(setup(open(8, 3), [v, enemy("e", "orc", { x: 7, y: 1 })]), v).slots()
    expect(slots.some((s) => s.up)).toBe(false)
  })
})
