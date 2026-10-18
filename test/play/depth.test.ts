import { Mind } from "../../src/ai/mind"
import { WEAPONS } from "../../src/rules/data"
import { mission } from "../../src/rules/mission"
import { distance, key } from "../../src/rules/point"
import { walkable } from "../../src/rules/tile"
import { enemy, open, setup, squad } from "../fixture"

describe("overwatch risk", () => {
  test("a reaction shot has disadvantage, but not against a unit that vaults or dashes", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 5, y: 0 })
    const g = setup(open(8, 2), [s, e])
    expect(g.combat.odds(e, s, e.weapon, { reaction: true }).disadvantages).toContain("reaction")
    expect(g.combat.odds(e, s, e.weapon, { reaction: true, risky: true }).disadvantages).not.toContain("reaction")
  })
})

describe("magazines", () => {
  test("the shotgun and the LMG hold 3", () => {
    expect(WEAPONS.shotgun.ammo).toBe(3)
    expect(WEAPONS.repeater.ammo).toBe(3)
  })
})

describe("breaking cover", () => {
  test("a crit breaks the cover that protects the target", () => {
    let broken = false
    for (let seed = 1; seed < 300 && !broken; seed++) {
      const s = squad("s", "ranger", { x: 0, y: 0 })
      const e = enemy("e", "ogre", { x: 0, y: 7 })
      const g = setup([".", ".", ".", ".", ".", ".", "H", ".", "."], [s, e], seed)
      g.combat.attack(s, e)
      if (g.log.some((x) => x.key === "log.crit")) {
        expect(g.tile({ x: 0, y: 6 })).toBe("low")
        broken = true
      } else expect(g.tile({ x: 0, y: 6 })).toBe("high")
    }
    expect(broken).toBe(true)
  })
  test("a Brute breaks the low cover it vaults", () => {
    const o = enemy("o", "ogre", { x: 0, y: 0 })
    const g = setup([".:.."], [o])
    g.orders.walk(o, g.reach(o, 4).path({ x: 2, y: 0 }))
    expect(g.tile({ x: 1, y: 0 })).toBe("floor")
  })
})

describe("alien behaviors", () => {
  test("a Stalker that no soldier sees hides again at the end of the alien turn", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const a = enemy("a", "assassin", { x: 20, y: 0 })
    const b = enemy("b", "assassin", { x: 3, y: 0 }, "engaged", "g2")
    const g = setup(open(24, 2), [s, a, b])
    g.phase = "enemy"
    g.turn.end()
    expect(g.units.find((x) => x.id === "a")!.concealed).toBe(true)
    expect(g.units.find((x) => x.id === "b")!.concealed).toBe(false)
  })
  test("a Psion shields an ally", () => {
    const w = enemy("w", "whisperer", { x: 0, y: 0 })
    const o = enemy("o", "orc", { x: 2, y: 0 })
    const s = squad("s", "warden", { x: 7, y: 0 })
    s.concealed = false
    const g = setup(open(12, 2), [w, o, s])
    w.ap = 2
    const a = new Mind(g).decide(w)
    expect(a).toMatchObject({ type: "ability", ability: "ward", target: "o" })
  })
})

describe("height", () => {
  test("a rooftop is reached only by its ladder, which costs 2", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = setup([".LRR", "..RR"], [v]).reach(v, 10)
    expect(r.cost.get(key({ x: 1, y: 0 }))).toBe(2)
    expect(r.cost.get(key({ x: 2, y: 0 }))).toBe(3)
    expect(r.path({ x: 2, y: 1 })[0]).toEqual({ x: 1, y: 0 })
  })
  test("a unit on a roof jumps down to the ground for a normal step", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const r = setup(["RR.", "..."], [v]).reach(v, 10)
    expect(r.cost.get(key({ x: 0, y: 1 }))).toBe(1)
    expect(r.cost.get(key({ x: 2, y: 0 }))).toBe(2)
  })
  test("a ridge is walked on at normal cost", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    expect(
      setup([".^^"], [v])
        .reach(v, 10)
        .cost.get(key({ x: 2, y: 0 })),
    ).toBe(2)
  })
  test("up high: +2 Aim and the low cover below does not count", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 0, y: 5 })
    const g = setup(["^", ".", ".", ".", ":", "."], [s, e])
    const o = g.combat.odds(s, e)
    expect(o.aimParts).toContainEqual({ key: "height", value: 2 })
    expect(o.cover).toBe(0)
    const flat = setup([".", ".", ".", ".", ":", "."], [s, e]).combat.odds(s, e)
    expect(flat.cover).toBe(2)
    expect(flat.aimParts.some((p) => p.key === "height")).toBe(false)
  })
  test("up high: +2 Sight", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const far = { x: s.vision + 2, y: 0 }
    const row = (c: string) => [c + ".".repeat(far.x + 1)]
    expect(setup(row("^"), [s]).sight.tiles(s).has(key(far))).toBe(true)
    expect(setup(row("."), [s]).sight.tiles(s).has(key(far))).toBe(false)
  })
  test("maps have ridges, and village and town maps have rooftops with a ladder", () => {
    let roofs = 0
    for (let seed = 1; seed <= 40; seed++) {
      const b = mission(seed).board
      expect(b.tiles).toContain("ridge")
      roofs += b.tiles.includes("roof") ? 1 : 0
      b.tiles.forEach((t, i) => {
        if (t !== "ladder") return
        const p = { x: i % b.width, y: Math.floor(i / b.width) }
        const near = [
          { x: p.x + 1, y: p.y },
          { x: p.x - 1, y: p.y },
          { x: p.x, y: p.y + 1 },
          { x: p.x, y: p.y - 1 },
        ].filter((n) => n.x >= 0 && n.y >= 0 && n.x < b.width && n.y < b.height)
        expect(near.some((n) => b.tiles[n.y * b.width + n.x] === "roof")).toBe(true)
      })
    }
    expect(roofs).toBeGreaterThan(3)
  })
})

describe("bleeding out", () => {
  test("a soldier at 0 HP is down for 2 rounds, then dies", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const t = squad("t", "ranger", { x: 3, y: 0 })
    const g = setup(open(6, 2), [s, t])
    g.combat.hurt(s, 99)
    expect(s.down).toBe(2)
    expect(g.log.some((x) => x.key === "log.down")).toBe(true)
    expect(g.log.some((x) => x.key === "log.dies")).toBe(false)
    g.phase = "enemy"
    g.turn.end()
    expect(s.down).toBe(1)
    g.phase = "enemy"
    g.turn.end()
    expect(s.down).toBe(0)
    expect(g.log.some((x) => x.key === "log.dies")).toBe(true)
  })
  test("the Medic's Heal gets a downed soldier up", () => {
    const m = squad("m", "cleric", { x: 0, y: 0 })
    const s = squad("s", "warden", { x: 1, y: 0 })
    const g = setup(open(4, 2), [m, s])
    g.combat.hurt(s, 99)
    const next = g.apply({ type: "ability", unit: "m", ability: "heal", target: "s" })
    const up = next.units.find((x) => x.id === "s")!
    expect(up.down).toBe(0)
    expect(up.hp).toBeGreaterThanOrEqual(3)
  })
  test("a downed soldier blocks its tile", () => {
    const s = squad("s", "warden", { x: 1, y: 0 })
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const g = setup(open(3, 1), [s, v])
    g.combat.hurt(s, 99)
    expect(g.reach(v, 5).cost.has(key({ x: 1, y: 0 }))).toBe(false)
  })
  test("an alien at 0 HP dies at once", () => {
    const e = enemy("e", "orc", { x: 0, y: 0 })
    const g = setup(open(2, 1), [e])
    g.combat.hurt(e, 99)
    expect(e.down).toBe(0)
    expect(g.log.some((x) => x.key === "log.dies")).toBe(true)
  })
})

describe("objectives", () => {
  test("missions pick Kill all, Evac or Defend", () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const g = mission(seed)
      kinds.add(g.goal.kind)
      if (g.goal.kind === "evac") {
        expect(g.goal.tiles.length).toBeGreaterThan(0)
        const start = g.units[0].pos
        for (const p of g.goal.tiles) {
          expect(Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y))).toBeGreaterThanOrEqual(g.board.width - 6)
          expect(walkable(g.tile(p))).toBe(true)
        }
      }
      if (g.goal.kind === "defend") {
        expect(walkable(g.tile(g.goal.at))).toBe(true)
        expect(g.goal.rounds).toBe(6)
      }
    }
    expect([...kinds].sort()).toEqual(["defend", "evac", "kill"])
  })
  test("Evac is won when every standing soldier is in the zone", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const t = squad("t", "ranger", { x: 4, y: 1 })
    const e = enemy("e", "orc", { x: 0, y: 3 }, "unaware")
    const g = setup(open(6, 4), [s, t, e])
    g.goal = {
      kind: "evac",
      tiles: [
        { x: 4, y: 0 },
        { x: 4, y: 1 },
      ],
    }
    const a = g.apply({ type: "move", unit: "s", to: { x: 3, y: 0 } })
    expect(a.phase).toBe("squad")
    expect(a.apply({ type: "move", unit: "s", to: { x: 4, y: 0 } }).phase).toBe("won")
  })
  test("Defend is lost when an alien stands on the beacon at round end", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 5, y: 3 }, "unaware")
    const g = setup(open(6, 4), [s, e])
    g.goal = { kind: "defend", at: { x: 5, y: 3 }, rounds: 6 }
    g.phase = "enemy"
    g.turn.end()
    expect(g.phase).toBe("lost")
  })
  test("Defend is won after the last round", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 5, y: 3 }, "unaware")
    const g = setup(open(6, 4), [s, e])
    g.goal = { kind: "defend", at: { x: 2, y: 2 }, rounds: 6 }
    g.round = 6
    g.phase = "enemy"
    g.turn.end()
    expect(g.phase).toBe("won")
  })
})

describe("reinforcements", () => {
  test("after the alarm, 2 aliens drop on the landing pad every 3 rounds, at most 3 times", () => {
    const s = squad("s", "warden", { x: 0, y: 5 })
    const e = enemy("e", "orc", { x: 20, y: 5 }, "unaware")
    const g = setup(open(24, 10), [s, e])
    g.pad = { x: 18, y: 2 }
    g.groups[0].alarmed = true
    const enemies = () => g.units.filter((u) => u.side === "enemy").length
    g.phase = "enemy"
    g.turn.end()
    expect(g.drop?.round).toBe(4)
    for (let i = 0; i < 2; i++) {
      g.phase = "enemy"
      g.turn.end()
    }
    expect(enemies()).toBe(1)
    g.phase = "enemy"
    g.turn.end()
    expect(enemies()).toBe(3)
    expect(g.log.some((x) => x.key === "log.drop")).toBe(true)
    for (let i = 0; i < 12; i++) {
      g.phase = "enemy"
      g.turn.end()
    }
    expect(enemies()).toBe(7)
    expect(g.drop).toBeNull()
    expect(g.units.filter((u) => u.group?.startsWith("d")).every((u) => distance(u.pos, { x: 18, y: 2 }) <= 2)).toBe(
      true,
    )
  })
  test("a map with no landing pad gets no reinforcements", () => {
    const g = setup(open(24, 10), [squad("s", "warden", { x: 0, y: 5 }), enemy("e", "orc", { x: 20, y: 5 }, "unaware")])
    g.groups[0].alarmed = true
    for (let i = 0; i < 6; i++) {
      g.phase = "enemy"
      g.turn.end()
    }
    expect(g.drop).toBeNull()
    expect(g.units.filter((u) => u.side === "enemy")).toHaveLength(1)
  })
})

describe("defend AI", () => {
  test("an engaged alien with no soldier in sight heads for the beacon", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 15, y: 0 })
    const g = setup(open(16, 1), [s, e])
    g.goal = { kind: "defend", at: { x: 2, y: 0 }, rounds: 6 }
    e.ap = 2
    const a = new Mind(g).decide(e)
    expect(a?.type).toBe("move")
    if (a?.type === "move") expect(a.to.x).toBeLessThan(15)
  })
})
