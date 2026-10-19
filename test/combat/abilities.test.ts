import { ABILITIES, growth } from "../../src/combat/abilities"
import type { Game } from "../../src/mission/game"
import { CLASSES, PROFILES } from "../../src/units/profiles"
import { enemy, find, open, reseed, setup, squad } from "../fixture"

const use = (g: Game, unit: string, ability: string, more: { target?: string; at?: { x: number; y: number } } = {}) =>
  g.apply({ type: "ability", unit, ability: ability as never, ...more })

describe("kits", () => {
  test("seven classes, each with a passive, two actives and an ultimate", () => {
    expect(CLASSES).toHaveLength(7)
    for (const c of CLASSES) {
      const [passive, ...actives] = PROFILES[c].abilities
      expect(ABILITIES[passive].passive).toBe(true)
      expect(actives.map((a) => !!ABILITIES[a].passive)).toEqual([false, false])
      expect(PROFILES[c].ultimate).not.toBeNull()
    }
  })
  test("a passive is not an action", () => {
    const g = setup(open(6, 3), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 5, y: 2 })])
    expect(() => use(g, "w", "shredder")).toThrow()
  })
})

describe("ranks", () => {
  test("a skill without a rank cannot be used", () => {
    const w = squad("w", "warden", { x: 0, y: 2 })
    w.ranks = { ...w.ranks, rocket: 0 }
    const g = setup(open(10, 5), [w, enemy("e", "orc", { x: 7, y: 2 })])
    expect(() => use(g, "w", "rocket", { at: { x: 5, y: 2 } })).toThrow()
  })
  test("a higher rank raises the skill's number", () => {
    const w = squad("w", "warden", { x: 0, y: 2 })
    w.ranks = { ...w.ranks, rocket: 2 }
    const g = setup(open(10, 5), [w, enemy("a", "ogre", { x: 5, y: 2 })])
    const a = use(g, "w", "rocket", { at: { x: 5, y: 2 } })
    expect(find(a, "a").hp).toBe(find(g, "a").maxHp - 3)
  })
  test("a higher rank cuts the cooldown", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    v.ranks = { ...v.ranks, run: 3 }
    const g = setup(open(8, 3), [v, enemy("e", "orc", { x: 7, y: 2 })])
    expect(find(use(g, "v", "run"), "v").cooldowns.run).toBe(2)
  })
  test("the ultimate at rank 2 is stronger: Ghost gives 2 AP", () => {
    const r = squad("r", "rogue", { x: 0, y: 0 })
    r.ranks = { ...r.ranks, ghost: 2 }
    r.ult = 4
    const g = setup(open(6, 3), [r, enemy("e", "orc", { x: 5, y: 2 })])
    expect(find(use(g, "r", "ghost"), "r").ap).toBe(4)
  })
})

describe("Assault", () => {
  test("Close quarters adds 2 damage within 2 tiles, not farther", () => {
    const at = (x: number, rank: number) => {
      const v = squad("v", "vanguard", { x: 0, y: 0 })
      v.ranks = { ...v.ranks, close: rank }
      const g = setup(open(8, 2), [v, enemy("e", "orc", { x, y: 0 })])
      return g.combat.odds(find(g, "v"), find(g, "e"))
    }
    expect(at(2, 1).max).toBeGreaterThan(at(2, 0).max)
    expect(at(3, 1).max).toBe(at(3, 0).max)
  })
  test("Close quarters at rank 3: a close kill gives 1 AP, once a turn", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    v.ranks = { ...v.ranks, close: 3 }
    const g = setup(open(8, 3), [v, enemy("a", "orc", { x: 1, y: 0 }), enemy("b", "orc", { x: 1, y: 2 })])
    find(g, "a").hp = 1
    find(g, "b").hp = 1
    const a = g.apply({ type: "attack", unit: "v", target: "a" })
    expect(find(a, "v").ap).toBe(1)
    const b = a.apply({ type: "attack", unit: "v", target: "b" })
    expect(find(b, "v").ap).toBe(0)
  })
  test("Run and gun costs no AP and makes a dash cost 1 AP", () => {
    const g = setup(open(10, 3), [squad("v", "vanguard", { x: 0, y: 0 }), enemy("e", "orc", { x: 9, y: 2 })])
    const a = use(g, "v", "run")
    expect(find(a, "v").ap).toBe(2)
    expect(find(a.apply({ type: "move", unit: "v", to: { x: 6, y: 0 } }), "v").ap).toBe(1)
  })
  test("Breach exposes the aliens in its cone and breaks the low cover there", () => {
    const g = setup(
      ["......", "..:...", "......"],
      [squad("v", "vanguard", { x: 0, y: 1 }), enemy("a", "orc", { x: 3, y: 1 }), enemy("b", "orc", { x: 0, y: 2 })],
    )
    const a = use(g, "v", "breach", { at: { x: 3, y: 1 } })
    expect(find(a, "a").has("exposed")).toBe(true)
    expect(find(a, "b").has("exposed")).toBe(false)
    expect(a.tile({ x: 2, y: 1 })).toBe("floor")
    expect(find(a, "v").ap).toBe(1)
  })
  test("Breach at rank 2 also does 2 damage", () => {
    const v = squad("v", "vanguard", { x: 0, y: 1 })
    v.ranks = { ...v.ranks, breach: 2 }
    const g = setup(open(6, 3), [v, enemy("a", "orc", { x: 2, y: 1 })])
    expect(find(use(g, "v", "breach", { at: { x: 2, y: 1 } }), "a").hp).toBe(find(g, "a").hp - 2)
  })
})

describe("Sniper", () => {
  const far = (rank: number) => {
    const r = squad("r", "ranger", { x: 0, y: 0 })
    r.ranks = { ...r.ranks, squadsight: rank }
    return setup(open(16, 2), [r, squad("v", "vanguard", { x: 8, y: 0 }), enemy("e", "orc", { x: 12, y: 0 })])
  }
  test("Squadsight shoots an alien only an ally sees; without it the shot is refused", () => {
    expect(() => far(1).apply({ type: "attack", unit: "r", target: "e" })).not.toThrow()
    expect(() => far(0).apply({ type: "attack", unit: "r", target: "e" })).toThrow()
  })
  test("Squadsight at rank 2 adds 1 damage beyond 8 tiles", () => {
    const max = (g: Game) => g.combat.odds(find(g, "r"), find(g, "e")).max
    expect(max(far(2))).toBeGreaterThan(max(far(1)))
  })
  test("Headshot hits a flanked alien for sure, for 1 AP and 1 ammo", () => {
    const g = setup(open(10, 2), [squad("r", "ranger", { x: 0, y: 0 }), enemy("e", "ogre", { x: 6, y: 0 })])
    for (const rng of [1, 2, 3, 4]) {
      const a = use(reseed(g, rng), "r", "headshot", { target: "e" })
      expect(find(a, "e").hp).toBeLessThan(find(g, "e").hp)
      expect(find(a, "r").ap).toBe(1)
      expect(find(a, "r").ammo).toBe(find(g, "r").ammo - 1)
    }
  })
  test("Headshot is refused on an alien in cover that is not Exposed", () => {
    const g = setup(["......H.", "........"], [squad("r", "ranger", { x: 0, y: 0 }), enemy("e", "orc", { x: 7, y: 0 })])
    expect(() => use(g, "r", "headshot", { target: "e" })).toThrow()
    find(g, "e").give({ id: "exposed", rounds: 1 })
    expect(() => use(g, "r", "headshot", { target: "e" })).not.toThrow()
  })
  test("Grapple climbs onto a roof for no AP", () => {
    const g = setup(["...RR", "...RR"], [squad("r", "ranger", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 1 })])
    const a = use(g, "r", "grapple", { at: { x: 3, y: 0 } })
    expect(find(a, "r").pos).toEqual({ x: 3, y: 0 })
    expect(find(a, "r").ap).toBe(2)
  })
})

describe("Heavy", () => {
  test("Shredder: a hit leaves the target Exposed for 1 round, 2 at rank 2", () => {
    const hit = (rank: number) => {
      const w = squad("w", "warden", { x: 0, y: 0 })
      w.ranks = { ...w.ranks, shredder: rank }
      const g = setup(open(8, 2), [w, enemy("e", "ogre", { x: 3, y: 0 })])
      return find(g.apply({ type: "attack", unit: "w", target: "e" }), "e").statuses.find((s) => s.id === "exposed")
    }
    expect(hit(0)).toBeUndefined()
    expect(hit(1)?.rounds).toBe(1)
    expect(hit(2)?.rounds).toBe(2)
  })
  test("Suppress: the target attacks with disadvantage and cannot overwatch", () => {
    const g = setup(open(8, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    const a = use(g, "w", "volley", { target: "e" })
    expect(find(a, "w").ammo).toBe(find(g, "w").ammo - 1)
    expect(find(a, "w").ap).toBe(1)
    const b = a.apply({ type: "endTurn" })
    expect(b.combat.odds(find(b, "e"), find(b, "w")).disadvantages).toContain("suppressed")
    expect(() => b.apply({ type: "overwatch", unit: "e" })).toThrow()
  })
  test("Suppress: when the target moves, the Heavy shoots it once", () => {
    const g = setup(open(10, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    const b = use(g, "w", "volley", { target: "e" })
      .apply({ type: "endTurn" })
      .apply({ type: "move", unit: "e", to: { x: 7, y: 1 } })
    expect(b.log.filter((x) => x.params.unit === "w" && x.params.reaction === true)).toHaveLength(1)
    expect(find(b, "e").has("suppressed")).toBe(false)
  })
  test("Suppress at rank 2 also suppresses the aliens next to the target", () => {
    const w = squad("w", "warden", { x: 0, y: 1 })
    w.ranks = { ...w.ranks, volley: 2 }
    const g = setup(open(8, 3), [w, enemy("a", "orc", { x: 5, y: 1 }), enemy("b", "orc", { x: 6, y: 1 })])
    expect(find(use(g, "w", "volley", { target: "a" }), "b").has("suppressed")).toBe(true)
  })
  test("Rocket hits a 3×3 area for 2, pushes units out and leaves the Heavy 1 AP", () => {
    const g = setup(open(10, 5), [
      squad("w", "warden", { x: 0, y: 2 }),
      enemy("a", "orc", { x: 5, y: 2 }),
      enemy("b", "orc", { x: 6, y: 2 }),
    ])
    const a = use(g, "w", "rocket", { at: { x: 5, y: 2 } })
    expect(find(a, "a").hp).toBe(find(g, "a").maxHp - 2)
    expect(find(a, "b").pos).toEqual({ x: 7, y: 2 })
    expect(find(a, "w").ap).toBe(1)
  })
  test("Rocket has 2 uses each mission", () => {
    const g = setup(open(10, 5), [squad("w", "warden", { x: 0, y: 2 }), enemy("a", "ogre", { x: 9, y: 2 })])
    const a = use(use(g, "w", "rocket", { at: { x: 5, y: 2 } }), "w", "rocket", { at: { x: 5, y: 2 } })
    find(a, "w").ap = 2
    expect(() => use(a, "w", "rocket", { at: { x: 5, y: 2 } })).toThrow("uses")
  })
})

describe("Medic", () => {
  test("Field medic gets a downed ally next to the Medic up with 1 HP at the end of the turn", () => {
    const g = setup(open(6, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 5, y: 2 }),
    ])
    g.combat.hurt(find(g, "v"), 99)
    const a = g.apply({ type: "endTurn" })
    expect(find(a, "v").hp).toBe(1)
    expect(find(a, "v").down).toBe(0)
  })
  test("Medkit heals an adjacent ally for no AP and lifts its bad statuses; 2 uses", () => {
    const g = setup(open(6, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 5, y: 2 }),
    ])
    find(g, "v").hp = 2
    find(g, "v").give({ id: "poisoned", rounds: 3 })
    const a = use(g, "c", "heal", { target: "v" })
    expect(find(a, "v").hp).toBeGreaterThan(2)
    expect(find(a, "v").has("poisoned")).toBe(false)
    expect(find(a, "c").ap).toBe(2)
    expect(() => use(use(a, "c", "heal", { target: "v" }), "c", "heal", { target: "v" })).toThrow("uses")
  })
  test("Shield absorbs the next 3 damage", () => {
    const g = setup(open(8, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 3, y: 0 }),
      enemy("e", "orc", { x: 7, y: 2 }),
    ])
    const a = use(g, "c", "ward", { target: "v" })
    a.combat.hurt(find(a, "v"), 2)
    expect(find(a, "v").hp).toBe(find(g, "v").hp)
    a.combat.hurt(find(a, "v"), 3)
    expect(find(a, "v").hp).toBe(find(g, "v").hp - 2)
    expect(find(a, "v").has("ward")).toBe(false)
  })
  test("a downed soldier lasts 3 rounds while a Medic lives", () => {
    const g = setup(open(4, 2), [squad("c", "cleric", { x: 0, y: 0 }), squad("v", "vanguard", { x: 1, y: 0 })])
    g.combat.hurt(find(g, "v"), 99)
    expect(find(g, "v").down).toBe(3)
  })
})

describe("Scout", () => {
  test("Shadow conceals the Scout again at the start of its turn when no alien sees it", () => {
    const shadow = (rank: number) => {
      const r = squad("g", "rogue", { x: 0, y: 0 })
      r.ranks = { ...r.ranks, shadow: rank }
      r.concealed = false
      const g = setup(["...#......", "...#......"], [r, enemy("e", "orc", { x: 9, y: 0 })])
      return find(g.apply({ type: "endTurn" }).apply({ type: "endTurn" }), "g").concealed
    }
    expect(shadow(1)).toBe(true)
    expect(shadow(0)).toBe(false)
  })
  test("Backstab from concealment does double damage and leaves 1 AP", () => {
    const g = setup(open(6, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 1, y: 0 }, "unaware")])
    find(g, "e").hp = 50
    const a = use(g, "g", "backstab", { target: "e" })
    expect(find(a, "e").hp).toBeLessThanOrEqual(50 - 8)
    expect(find(a, "g").ap).toBe(1)
  })
  test("Backstab is refused when the Scout is seen and not flanking", () => {
    const r = squad("g", "rogue", { x: 0, y: 0 })
    r.concealed = false
    const g = setup(open(6, 2), [r, enemy("e", "ogre", { x: 1, y: 0 })])
    expect(() => use(g, "g", "backstab", { target: "e" })).toThrow()
  })
  test("Hook pulls an alien 2 tiles toward the Scout and leaves it Shaken for a round", () => {
    const g = setup(open(8, 2), [squad("g", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 })])
    const e = find(use(g, "g", "hook", { target: "e" }), "e")
    expect(e.pos).toEqual({ x: 2, y: 0 })
    expect(e.statuses.find((s) => s.id === "shaken")?.rounds).toBe(1)
  })
})

describe("Psi operative", () => {
  const control = (rank: number) => {
    const m = squad("m", "mage", { x: 0, y: 0 })
    m.ranks = { ...m.ranks, mindshield: rank }
    const g = setup(open(8, 3), [m, squad("v", "vanguard", { x: 1, y: 0 }), enemy("p", "whisperer", { x: 5, y: 0 })])
    g.phase = "enemy"
    find(g, "p").ap = 2
    const after = use(g, "p", "dominate", { target: "v" })
    return after.log.find((x) => x.key === "log.dominate")!.params
  }
  test("Mind shield gives the allies next to the Psi operative advantage on the save", () => {
    expect(Number(control(1).total) - Number(control(0).total)).toBe(3)
  })
  test("Mind shield at rank 3 makes them immune", () => {
    expect(control(3).saved).toBe(true)
  })
  test("Stasis: the target cannot act or be hurt for a round", () => {
    const g = setup(open(8, 3), [squad("m", "mage", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 })])
    const a = use(g, "m", "stasis", { target: "e" })
    expect(a.combat.hurt(find(a, "e"), 3)).toBe(false)
    expect(find(a, "e").hp).toBe(find(g, "e").hp)
    expect(() => a.apply({ type: "attack", unit: "m", target: "e" })).toThrow()
    const b = a.apply({ type: "endTurn" })
    expect(find(b, "e").ap).toBe(0)
    expect(find(b.apply({ type: "endTurn" }), "e").has("stasis")).toBe(false)
  })
  test("Panic does not end the turn", () => {
    const g = setup(open(8, 3), [squad("m", "mage", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 })])
    expect(find(use(g, "m", "fear", { target: "e" }), "m").ap).toBe(1)
  })
})

describe("Engineer", () => {
  const watch = (rank: number) => {
    const n = squad("n", "engineer", { x: 0, y: 0 })
    n.ranks = { ...n.ranks, tripwire: rank }
    const g = setup(open(8, 2), [n, enemy("e", "orc", { x: 4, y: 0 })])
    return g.combat.odds(find(g, "n"), find(g, "e"), { reaction: true }).disadvantages
  }
  test("Tripwire: overwatch shots have no reaction disadvantage", () => {
    expect(watch(0)).toContain("reaction")
    expect(watch(1)).not.toContain("reaction")
  })
  test("Mine costs no AP; an alien that steps on it takes 2, is pushed and exposed", () => {
    const g = setup(open(8, 3), [squad("n", "engineer", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const planted = use(g, "n", "mine", { at: { x: 3, y: 1 } })
    expect(find(planted, "n").ap).toBe(2)
    const b = planted.apply({ type: "endTurn" }).apply({ type: "move", unit: "e", to: { x: 2, y: 1 } })
    expect(find(b, "e").hp).toBe(find(g, "e").maxHp - 2)
    expect(find(b, "e").has("exposed")).toBe(true)
    expect(b.zones.some((z) => z.kind === "mine")).toBe(false)
  })
  test("Flash blinds the aliens in a 3×3 area within 5, not the squad; at rank 3 it also exposes", () => {
    const n = squad("n", "engineer", { x: 0, y: 2 })
    n.ranks = { ...n.ranks, flash: 3 }
    const g = setup(open(8, 5), [
      n,
      squad("v", "vanguard", { x: 3, y: 3 }),
      enemy("a", "orc", { x: 4, y: 2 }),
      enemy("b", "orc", { x: 4, y: 3 }),
    ])
    const a = use(g, "n", "flash", { at: { x: 4, y: 2 } })
    expect(find(a, "a").statuses.find((s) => s.id === "blinded")?.rounds).toBe(2)
    expect(find(a, "b").has("exposed")).toBe(true)
    expect(find(a, "v").has("blinded")).toBe(false)
  })
  test("Flash takes the aliens it blinds off overwatch and drops their marks", () => {
    const e = enemy("e", "orc", { x: 4, y: 2 })
    e.stance = "overwatch"
    e.intent = { type: "shot", target: "n" }
    const g = setup(open(8, 5), [squad("n", "engineer", { x: 0, y: 2 }), e])
    const a = use(g, "n", "flash", { at: { x: 4, y: 2 } })
    expect(find(a, "e").stance).toBe("none")
    expect(find(a, "e").intent).toBeNull()
  })
})

describe("growth", () => {
  test("lists each number the next rank changes, now and next", () => {
    expect(growth("run", 2)).toEqual([{ stat: "cooldown", now: 3, next: 2 }])
    expect(growth("ward", 1)).toEqual([{ stat: "power", now: 3, next: 4 }])
  })
  test("a rank past the last row changes nothing", () => {
    expect(growth("rampage", 2)).toEqual([])
  })
})

describe("Aliens", () => {
  test("Covering fire: a Grunt shoots a soldier that moves in its sight, once each round", () => {
    const v = squad("v", "vanguard", { x: 0, y: 1 })
    v.concealed = false
    const g = setup(open(10, 3), [v, enemy("e", "orc", { x: 8, y: 1 })])
    const a = g
      .apply({ type: "move", unit: "v", to: { x: 1, y: 1 } })
      .apply({ type: "move", unit: "v", to: { x: 2, y: 1 } })
    expect(a.log.filter((x) => x.params.unit === "e" && x.params.reaction === true)).toHaveLength(1)
  })
  test("Knockback: a Brute hit pushes the soldier 2 tiles", () => {
    const g = setup(open(8, 3), [squad("v", "vanguard", { x: 2, y: 1 }), enemy("o", "ogre", { x: 1, y: 1 })])
    g.phase = "enemy"
    for (const u of g.units) if (u.side === "enemy") u.ap = 2
    find(g, "v").hp = 50
    const hit = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((rng) => reseed(g, rng).apply({ type: "attack", unit: "o", target: "v" }))
      .find((a) => find(a, "v").hp < 50)!
    expect(find(hit, "v").pos).toEqual({ x: 4, y: 1 })
  })
  test("Shield wall: an alien next to a Shield trooper has +3 Def", () => {
    const g = setup(open(8, 3), [
      squad("v", "vanguard", { x: 0, y: 1 }),
      enemy("e", "orc", { x: 5, y: 1 }),
      enemy("s", "shieldwall", { x: 6, y: 1 }),
    ])
    expect(g.combat.odds(find(g, "v"), find(g, "e")).defenseParts).toContainEqual({ key: "wall", value: 3 })
  })
  test("Poison: a Stalker hit poisons the soldier for 1 damage each round", () => {
    const g = setup(open(6, 3), [squad("v", "vanguard", { x: 2, y: 1 }), enemy("a", "assassin", { x: 1, y: 1 })])
    g.phase = "enemy"
    for (const u of g.units) if (u.side === "enemy") u.ap = 2
    find(g, "v").hp = 50
    const hit = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((rng) => reseed(g, rng).apply({ type: "attack", unit: "a", target: "v" }))
      .find((a) => find(a, "v").hp < 50)!
    expect(find(hit, "v").has("poisoned")).toBe(true)
    const hp = find(hit, "v").hp
    expect(find(hit.apply({ type: "endTurn" }), "v").hp).toBe(hp - 1)
  })
  test("War cry: aliens within 6 get 1 AP and engage, once each mission", () => {
    const g = setup(open(12, 3), [
      squad("v", "vanguard", { x: 0, y: 1 }),
      enemy("c", "warchief", { x: 8, y: 1 }),
      enemy("n", "orc", { x: 10, y: 1 }, "unaware", "g2"),
    ])
    g.phase = "enemy"
    for (const u of g.units) if (u.side === "enemy") u.ap = 2
    const a = use(g, "c", "warcry")
    expect(find(a, "n").ap).toBe(3)
    expect(find(a, "n").alert).toBe("engaged")
    expect(() => use(a, "c", "warcry")).toThrow("uses")
  })
})
