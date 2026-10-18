import { Mind } from "../../src/aliens/mind"
import { WEAPONS } from "../../src/combat/weapons"
import { distance, key } from "../../src/map/point"
import { walkable } from "../../src/map/tile"
import { mission } from "../../src/mission/mission"
import { enemy, find, open, setup, squad } from "../fixture"

describe("overwatch risk", () => {
  test("a reaction shot has disadvantage, but not against a unit that vaults or dashes", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 5, y: 0 })
    const g = setup(open(8, 2), [s, e])
    expect(g.combat.odds(e, s, { reaction: true }).disadvantages).toContain("reaction")
    expect(g.combat.odds(e, s, { reaction: true, risky: true }).disadvantages).not.toContain("reaction")
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
        expect(g.goal.rounds).toBe(8)
      }
    }
    expect([...kinds].sort()).toEqual(["defend", "evac", "warchief"])
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
  test("Defend is lost when aliens outnumber soldiers on and around the beacon at 2 round ends in a row", () => {
    const s = squad("s", "warden", { x: 3, y: 2 })
    const g = setup(open(8, 5), [s, enemy("e", "orc", { x: 4, y: 3 }, "unaware"), enemy("f", "orc", { x: 2, y: 1 })])
    g.goal = { kind: "defend", at: { x: 3, y: 2 }, rounds: 6, held: 0 }
    const end = () => {
      g.phase = "enemy"
      g.turn.end()
    }
    end()
    expect(g.phase).toBe("squad")
    expect(g.goal).toMatchObject({ held: 1 })
    end()
    expect(g.phase).toBe("lost")
  })
  test("Defend control resets when the soldiers match the aliens around the beacon", () => {
    const g = setup(open(8, 5), [
      squad("s", "warden", { x: 3, y: 2 }),
      squad("t", "warden", { x: 2, y: 2 }),
      enemy("e", "orc", { x: 4, y: 3 }, "unaware"),
      enemy("f", "orc", { x: 2, y: 1 }, "unaware"),
    ])
    g.goal = { kind: "defend", at: { x: 3, y: 2 }, rounds: 6, held: 1 }
    g.phase = "enemy"
    g.turn.end()
    expect(g.phase).toBe("squad")
    expect(g.goal).toMatchObject({ held: 0 })
  })
  test("Defend is won after the last round", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 5, y: 3 }, "unaware")
    const g = setup(open(6, 4), [s, e])
    g.goal = { kind: "defend", at: { x: 2, y: 2 }, rounds: 6, held: 0 }
    g.round = 6
    g.phase = "enemy"
    g.turn.end()
    expect(g.phase).toBe("won")
  })
})

describe("alarm", () => {
  const ends = (g: ReturnType<typeof setup>, n: number) => {
    for (let i = 0; i < n; i++) {
      g.phase = "enemy"
      g.turn.end()
    }
  }
  test("rises by 1 at the end of each even round, and by 1 more in a round with a loud squad noise", () => {
    const g = setup(open(24, 10), [squad("s", "warden", { x: 0, y: 5 }), enemy("e", "orc", { x: 20, y: 5 }, "unaware")])
    ends(g, 4)
    expect(g.alarm).toBe(2)
    g.stealth.noise({ x: 0, y: 5 }, 8, find(g, "s"))
    ends(g, 1)
    expect(g.alarm).toBe(3)
  })
  test("at 4, 7 and 10, 2 aliens land on the pad, shown the round before", () => {
    const g = setup(open(24, 10), [squad("s", "warden", { x: 0, y: 5 }), enemy("e", "orc", { x: 20, y: 5 }, "unaware")])
    g.pad = { x: 18, y: 2 }
    const enemies = () => g.units.filter((u) => u.side === "enemy").length
    g.alarm = 3
    expect(g.reinforcements.coming()).toBeNull()
    ends(g, 1)
    expect(g.reinforcements.coming()).toEqual({ x: 18, y: 2 })
    expect(enemies()).toBe(1)
    ends(g, 1)
    expect(enemies()).toBe(3)
    expect(g.log.some((x) => x.key === "log.drop")).toBe(true)
    expect(g.units.filter((u) => u.group?.startsWith("d")).every((u) => distance(u.pos, { x: 18, y: 2 }) <= 2)).toBe(
      true,
    )
  })
  test("a loud round that jumps over a step still brings the help", () => {
    const g = setup(open(24, 10), [squad("s", "warden", { x: 0, y: 5 }), enemy("e", "orc", { x: 20, y: 5 }, "unaware")])
    g.pad = { x: 18, y: 2 }
    g.alarm = 6
    g.round = 2
    g.stealth.noise({ x: 0, y: 5 }, 8, find(g, "s"))
    ends(g, 1)
    expect(g.alarm).toBe(8)
    expect(g.units.filter((u) => u.side === "enemy")).toHaveLength(3)
  })
  test("with no pad, at 4 the nearest calm group hunts the squad", () => {
    const g = setup(open(24, 10), [
      squad("s", "warden", { x: 0, y: 5 }),
      enemy("e", "orc", { x: 10, y: 5 }, "unaware", "g1"),
      enemy("f", "orc", { x: 22, y: 5 }, "unaware", "g2"),
    ])
    g.alarm = 3
    g.round = 2
    ends(g, 1)
    expect(g.units.filter((u) => u.side === "enemy")).toHaveLength(2)
    expect(find(g, "e").alert).toBe("investigating")
    expect(g.groups.find((x) => x.id === "g1")?.target).toEqual({ x: 0, y: 5 })
    expect(find(g, "f").alert).toBe("unaware")
  })
})

describe("defend waves", () => {
  test("waves of 2, 3 and 4 aliens land at the edge farthest from the beacon at the end of rounds 2, 4 and 6", () => {
    const g = setup(open(24, 10), [squad("s", "warden", { x: 1, y: 5 }), enemy("e", "orc", { x: 3, y: 9 }, "unaware")])
    g.goal = { kind: "defend", at: { x: 2, y: 5 }, rounds: 8, held: 0 }
    const sizes: number[] = []
    for (let round = 1; round <= 6; round++) {
      if (round % 2 === 0) expect(g.reinforcements.coming()?.x).toBe(23)
      g.phase = "enemy"
      g.turn.end()
      sizes.push(g.units.filter((u) => u.side === "enemy").length - 1)
    }
    expect(sizes).toEqual([0, 2, 2, 5, 5, 9])
    const wave = g.units.filter((u) => u.group?.startsWith("w"))
    expect(wave.every((u) => u.alert === "engaged" && u.pos.x >= 20)).toBe(true)
    expect(g.groups.filter((x) => x.id.startsWith("w")).every((x) => x.target?.x === 2)).toBe(true)
  })
})

describe("defend AI", () => {
  test("an engaged alien with no soldier in sight heads for the beacon", () => {
    const s = squad("s", "warden", { x: 0, y: 0 })
    const e = enemy("e", "orc", { x: 15, y: 0 })
    const g = setup(open(16, 1), [s, e])
    g.goal = { kind: "defend", at: { x: 2, y: 0 }, rounds: 6, held: 0 }
    e.ap = 2
    const a = new Mind(g).decide(e)
    expect(a?.type).toBe("move")
    if (a?.type === "move") expect(a.to.x).toBeLessThan(15)
  })
})
