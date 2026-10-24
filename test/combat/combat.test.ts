import { Illegal } from "../../src/mission/orders"
import type { ClassId } from "../../src/units/profiles"
import { type Training, Unit } from "../../src/units/unit"
import { enemy, open, setup, squad } from "../fixture"

const trained = (id: string, kind: ClassId, at: { x: number; y: number }, extra: Partial<Training>) =>
  Unit.of(id, kind, "squad", at, { hp: 0, upgrades: 0, ...extra })
const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]

describe("damage", () => {
  const sniper = (cover: boolean, moved = true) => {
    const g = setup(rows(["........", "........", cover ? "...l...." : "........"]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    g.unit("r").moved = moved
    return g
  }
  test("low cover toward the shooter takes 1 from the damage", () => {
    const g = sniper(true)
    expect(g.combat.hit(g.unit("r"), g.unit("g"))).toMatchObject({ damage: 1, cover: 1 })
  })
  test("a Marked target takes 1 more, and a Suppressed shooter deals 1 less", () => {
    const g = sniper(true)
    g.unit("g").status = "marked"
    expect(g.combat.hit(g.unit("r"), g.unit("g")).damage).toBe(2)
    g.unit("g").status = "suppressed"
    expect(g.combat.hit(g.unit("g"), g.unit("r")).damage).toBe(3)
  })
  test("a Hunkered target doubles the cover cut, the open counting as low, and can block a hit fully", () => {
    const covered = sniper(true)
    covered.unit("g").hunkered = true
    expect(covered.combat.hit(covered.unit("r"), covered.unit("g"))).toMatchObject({ damage: 0, cover: 2 })
    const open = sniper(false)
    open.unit("g").hunkered = true
    expect(open.combat.hit(open.unit("r"), open.unit("g"))).toMatchObject({ damage: 0, cover: 2 })
  })
  test("a flank adds 1 to the damage", () => {
    const g = sniper(false)
    expect(g.combat.hit(g.unit("r"), g.unit("g"))).toMatchObject({ damage: 3, cover: 0 })
  })
  test("Steady adds 1 when the Ranger did not move", () => {
    const g = sniper(true, false)
    expect(g.combat.hit(g.unit("r"), g.unit("g")).damage).toBe(2)
  })
  test("Point blank adds 1 when the Vanguard is next to its target", () => {
    const g = setup(rows(["........", "........", "........", "........", "........", "...l...."]), [
      squad("v", "vanguard", { x: 3, y: 4 }),
      enemy("g", "grunt", { x: 3, y: 3 }),
      enemy("h", "grunt", { x: 3, y: 6 }),
    ])
    expect([g.combat.hit(g.unit("v"), g.unit("g")).damage, g.combat.hit(g.unit("v"), g.unit("h")).damage]).toEqual([
      5, 2,
    ])
  })
  test("a Vanguard hit next to its target pushes it back", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 2 }), enemy("g", "brute", { x: 3, y: 1 })])
    expect(g.apply({ type: "shoot", unit: "v", target: "g" }).unit("g").at).toEqual({ x: 3, y: 0 })
  })
  test("Aid takes 1 from shots at an ally next to the Cleric", () => {
    const g = setup(open(), [
      squad("r", "ranger", { x: 3, y: 6 }),
      squad("c", "cleric", { x: 4, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 2 }),
    ])
    expect(g.combat.hit(g.unit("g"), g.unit("r")).damage).toBe(3)
  })
  test("a target past the range or behind a rock cannot be shot", () => {
    const far = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 1 })])
    expect(far.combat.canShoot(far.unit("g"), far.unit("r"))).toBe(false)
    const hidden = setup(rows(["........", "........", "........", "........", "...h...."]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    expect(hidden.combat.canShoot(hidden.unit("r"), hidden.unit("g"))).toBe(false)
  })
})

describe("shots", () => {
  const duel = () =>
    setup(rows(["........", "........", "...l...."]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
  test("every shot hits for its damage", () => {
    const g = duel().apply({ type: "shoot", unit: "r", target: "g" })
    expect(g.unit("g").hp).toBe(4)
  })
  test("a shot the cover cuts to 0 is blocked", () => {
    const g = duel()
    g.unit("r").moved = true
    g.unit("g").hunkered = true
    const after = g.apply({ type: "shoot", unit: "r", target: "g" })
    expect([after.unit("g").hp, after.log.some((e) => e.key === "log.block")]).toEqual([6, true])
  })
  test("the Brute's claws always hit for its damage and push the target back", () => {
    const g = setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("b", "brute", { x: 3, y: 3 })])
    g.combat.fire(g.unit("b"), g.unit("v"))
    expect(g.unit("v")).toMatchObject({ hp: 4, at: { x: 3, y: 5 } })
  })
  test("a push into water kills", () => {
    const g = setup(rows(["........", "........", "........", "........", "........", "...~...."]), [
      squad("v", "vanguard", { x: 3, y: 4 }),
      enemy("b", "brute", { x: 3, y: 3 }),
    ])
    g.combat.fire(g.unit("b"), g.unit("v"))
    expect(g.unit("v").hp).toBe(0)
  })
  test("a shot at a barrel blows it: 2 around, fire on its tile, and the next barrel blows too", () => {
    const g = setup(rows(["........", "........", "........", "...bb..."]), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("a", "grunt", { x: 3, y: 2 }),
      enemy("b", "brute", { x: 5, y: 3 }),
    ]).apply({ type: "shoot", unit: "r", at: { x: 3, y: 3 } })
    expect([g.unit("a").hp, g.unit("b").hp, g.board.at({ x: 3, y: 3 }), g.board.at({ x: 4, y: 3 })]).toEqual([
      4,
      6,
      "fire",
      "fire",
    ])
  })
  test("Shred: a Warden hit tears the sandbags in front of the target", () => {
    const g = setup(rows(["........", "........", "...l...."]), [
      squad("w", "warden", { x: 3, y: 5 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    expect(g.apply({ type: "shoot", unit: "w", target: "g" }).board.at({ x: 3, y: 2 })).toBe("torn")
  })
  describe("new aliens", () => {
    test("a Guard takes no damage from a shot its cover faces, but a flank or Exposed hurts it", () => {
      const g = setup(rows(["........", "........", "...l...."]), [
        squad("r", "ranger", { x: 3, y: 6 }),
        squad("v", "vanguard", { x: 5, y: 1 }),
        enemy("q", "guard", { x: 3, y: 1 }),
      ])
      expect(g.combat.hit(g.unit("r"), g.unit("q")).damage).toBe(0)
      expect(g.combat.hit(g.unit("v"), g.unit("q")).damage).toBe(4)
      g.unit("q").status = "exposed"
      expect(g.combat.hit(g.unit("r"), g.unit("q")).damage).toBe(6)
    })
    test("a blast hurts a Guard behind cover", () => {
      const g = setup(rows(["........", "........", "...l...."]), [
        squad("r", "ranger", { x: 3, y: 6 }),
        enemy("q", "guard", { x: 3, y: 1 }),
      ])
      g.combat.blast({ x: 3, y: 1 }, 2)
      expect(g.unit("q").hp).toBe(6)
    })
    test("a blast logs the damage to each unit it hits", () => {
      const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("q", "grunt", { x: 3, y: 1 })])
      g.combat.blast({ x: 3, y: 1 }, 2)
      expect(g.log.at(-1)).toEqual({ key: "log.burst", params: { target: "q", dmg: 2 } })
    })
    test("a Sniper reaches across the board for 3 damage, 4 on a flank", () => {
      const g = setup(open(), [squad("r", "ranger", { x: 0, y: 7 }), enemy("s", "sniper", { x: 7, y: 0 })])
      expect([g.combat.canShoot(g.unit("s"), g.unit("r")), g.combat.hit(g.unit("s"), g.unit("r")).damage]).toEqual([
        true,
        4,
      ])
    })
    test("a Sniper that moved cannot shoot in that turn", () => {
      const g = setup(open(), [squad("r", "ranger", { x: 0, y: 7 }), enemy("s", "sniper", { x: 7, y: 0 })]).apply({
        type: "endTurn",
      })
      const moved = g.apply({ type: "move", unit: "s", to: { x: 6, y: 0 } })
      expect(() => moved.apply({ type: "shoot", unit: "s", target: "r" })).toThrow(Illegal)
    })
    test("a Sniper on overwatch fires at full damage", () => {
      const g = setup(open(), [squad("r", "ranger", { x: 3, y: 7 }), enemy("s", "sniper", { x: 3, y: 0 })])
      g.unit("s").overwatch = true
      const moved = g.apply({ type: "move", unit: "r", to: { x: 3, y: 6 } })
      expect(moved.unit("r").hp).toBe(g.unit("r").hp - g.combat.hit(g.unit("s"), moved.unit("r")).damage)
    })
  })
})

describe("branches and traits", () => {
  test("Spotter: a Marked alien takes 2 more, not 1", () => {
    const g = setup(open(), [
      trained("r", "ranger", { x: 3, y: 6 }, { branch: "spotter" }),
      squad("w", "warden", { x: 4, y: 6 }),
      enemy("g", "grunt", { x: 4, y: 3 }),
    ])
    const before = g.combat.hit(g.unit("w"), g.unit("g")).damage
    const marked = g.apply({ type: "tactic", unit: "r", target: "g" })
    expect(marked.combat.hit(marked.unit("w"), marked.unit("g")).damage).toBe(before + 2)
  })
  test("Brawler: a Vanguard combo deals 3 more", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 2, y: 6 }),
      trained("v", "vanguard", { x: 3, y: 6 }, { branch: "brawler" }),
      enemy("g", "commander", { x: 3, y: 4 }),
    ]).apply({ type: "tactic", unit: "w", target: "g" })
    expect(g.combat.hit(g.unit("v"), g.unit("g")).damage).toBe(7)
  })
  test("Wrecker: every Warden hit breaks the cover next to its target", () => {
    const g = setup(rows(["........", "...l....", "........"]), [
      trained("w", "warden", { x: 5, y: 2 }, { branch: "wrecker" }),
      enemy("g", "commander", { x: 3, y: 2 }),
    ])
    const hit = g.apply({ type: "shoot", unit: "w", target: "g" })
    expect(hit.board.at({ x: 3, y: 1 })).toBe("torn")
  })
  test("a Partner deals 1 more to an alien with the status its class gains from", () => {
    const g = setup(open(), [
      trained("v", "vanguard", { x: 3, y: 6 }, { partner: true }),
      squad("w", "warden", { x: 4, y: 6 }),
      enemy("g", "commander", { x: 3, y: 3 }),
    ])
    const plain = setup(open(), [squad("v", "vanguard", { x: 3, y: 6 }), enemy("g", "commander", { x: 3, y: 3 })])
    g.unit("g").status = "suppressed"
    plain.unit("g").status = "suppressed"
    expect(g.combat.hit(g.unit("v"), g.unit("g")).damage).toBe(
      plain.combat.hit(plain.unit("v"), plain.unit("g")).damage + 1,
    )
  })
  describe("the Blade", () => {
    test("a Blade strike next to an alien always hits for 3 and does not push", () => {
      const g = setup(open(), [squad("b", "blade", { x: 3, y: 4 }), enemy("q", "commander", { x: 3, y: 3 })])
      expect(g.combat.hit(g.unit("b"), g.unit("q"))).toMatchObject({ damage: 3 })
      const hit = g.apply({ type: "shoot", unit: "b", target: "q" })
      expect(hit.unit("q")).toMatchObject({ hp: 6, at: { x: 3, y: 3 } })
    })
    test("Marked and Suppressed change melee hits too", () => {
      const g = setup(open(), [squad("b", "blade", { x: 3, y: 4 }), enemy("x", "brute", { x: 3, y: 3 })])
      g.unit("x").status = "marked"
      const struck = g.combat.hit(g.unit("b"), g.unit("x")).damage
      g.unit("x").status = "suppressed"
      expect([struck, g.combat.hit(g.unit("x"), g.unit("b")).damage]).toEqual([4, 1])
    })
    test("Parry: claws at the Blade deal 1 less", () => {
      const g = setup(open(), [squad("b", "blade", { x: 3, y: 4 }), enemy("x", "brute", { x: 3, y: 3 })])
      expect(g.combat.hit(g.unit("x"), g.unit("b")).damage).toBe(2)
    })
    test("a Blade hit on an Exposed alien deals 3 more and staggers it", () => {
      const g = setup(open(), [squad("b", "blade", { x: 3, y: 4 }), enemy("q", "commander", { x: 3, y: 3 })])
      g.unit("q").status = "exposed"
      expect(g.combat.hit(g.unit("b"), g.unit("q")).damage).toBe(6)
      expect(g.apply({ type: "shoot", unit: "b", target: "q" }).unit("q")).toMatchObject({ hp: 3, status: "staggered" })
    })
    test("Riposte: every claw at the Blade costs the alien 2", () => {
      const g = setup(open(), [
        trained("b", "blade", { x: 3, y: 4 }, { branch: "riposte" }),
        enemy("x", "brute", { x: 3, y: 3 }),
      ])
      g.combat.fire(g.unit("x"), g.unit("b"))
      expect(g.unit("x").hp).toBe(6)
    })
    test("Reaper: a kill with a strike gives 1 AP back", () => {
      const g = setup(open(), [
        trained("b", "blade", { x: 3, y: 4 }, { branch: "reaper" }),
        enemy("q", "grunt", { x: 3, y: 3 }),
      ])
      g.unit("q").hp = 2
      expect(g.apply({ type: "shoot", unit: "b", target: "q" }).unit("b").ap).toBe(1)
    })
  })
})
