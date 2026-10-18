import type { Game } from "../../src/rules/game"
import { Illegal } from "../../src/rules/orders"
import { enemy, find, open, reseed, setup, squad } from "../fixture"

const hits = (g: Game) => g.log.filter((e) => e.key === "log.hit" || e.key === "log.crit" || e.key === "log.miss")

describe("action points", () => {
  test("a short move costs 1 AP, a dash costs 2", () => {
    const g = setup(open(20, 3), [squad("v", "vanguard", { x: 0, y: 0 }), enemy("e", "orc", { x: 19, y: 2 })])
    const a = g.apply({ type: "move", unit: "v", to: { x: 4, y: 0 } })
    expect(find(a, "v").ap).toBe(1)
    const b = g.apply({ type: "move", unit: "v", to: { x: 5, y: 0 } })
    expect(find(b, "v").ap).toBe(0)
  })
  test("moving does not end the turn, attacking does", () => {
    const g = setup(open(12, 3), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 8, y: 0 })])
    const a = g.apply({ type: "move", unit: "w", to: { x: 2, y: 0 } })
    const b = a.apply({ type: "attack", unit: "w", target: "e" })
    expect(find(b, "w").ap).toBe(0)
    expect(find(b, "w").ammo).toBe(2)
    expect(() => b.apply({ type: "reload", unit: "w" })).toThrow(Illegal)
  })
  test("the longbow needs 2 AP and no move", () => {
    const g = setup(open(20, 3), [squad("r", "ranger", { x: 0, y: 0 }), enemy("e", "orc", { x: 6, y: 0 })])
    const a = g.apply({ type: "move", unit: "r", to: { x: 1, y: 0 } })
    expect(() => a.apply({ type: "attack", unit: "r", target: "e" })).toThrow("needs 2 AP")
    expect(() => g.apply({ type: "attack", unit: "r", target: "e" })).not.toThrow()
  })
  test("the original game does not change", () => {
    const g = setup(open(12, 3), [squad("v", "vanguard", { x: 0, y: 0 }), enemy("e", "orc", { x: 11, y: 2 })])
    g.apply({ type: "move", unit: "v", to: { x: 3, y: 0 } })
    expect(find(g, "v").pos).toEqual({ x: 0, y: 0 })
  })
})

describe("reactions", () => {
  test("overwatch fires once at the first move in sight", () => {
    const g0 = setup(open(12, 3), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 7, y: 2 })])
    const g1 = g0.apply({ type: "overwatch", unit: "w" })
    const g2 = g1.apply({ type: "endTurn" })
    const g3 = g2.apply({ type: "move", unit: "e", to: { x: 3, y: 2 } })
    expect(hits(g3)).toHaveLength(1)
    expect(hits(g3)[0].params.reaction).toBe(true)
    expect(find(g3, "w").stance).toBe("none")
  })
  test("leaving a melee unit's reach provokes a free attack", () => {
    const g0 = setup(open(12, 3), [squad("v", "rogue", { x: 5, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const g1 = g0.apply({ type: "endTurn" })
    const g2 = g1.apply({ type: "move", unit: "e", to: { x: 10, y: 1 } })
    expect(hits(g2)).toHaveLength(1)
    expect(hits(g2)[0].params.unit).toBe("v")
  })
  test("moving inside the reach does not provoke", () => {
    const g0 = setup(open(12, 3), [squad("v", "vanguard", { x: 5, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const g1 = g0.apply({ type: "endTurn" }).apply({ type: "move", unit: "e", to: { x: 6, y: 0 } })
    expect(hits(g1)).toHaveLength(0)
  })
  test("hunker needs cover", () => {
    const g = setup(["...", ".:.", "..."], [squad("c", "cleric", { x: 1, y: 2 }), enemy("e", "orc", { x: 0, y: 0 })])
    expect(find(g.apply({ type: "hunker", unit: "c" }), "c").stance).toBe("hunker")
    const g2 = setup(open(3, 3), [squad("c", "cleric", { x: 1, y: 2 }), enemy("e", "orc", { x: 0, y: 0 })])
    expect(() => g2.apply({ type: "hunker", unit: "c" })).toThrow("cover")
  })
})

describe("abilities and items", () => {
  test("heal restores HP and sets the cooldown", () => {
    const g = setup(open(6, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 5, y: 2 }),
    ])
    find(g, "v").hp = 3
    const a = g.apply({ type: "ability", unit: "c", ability: "heal", target: "v" })
    expect(find(a, "v").hp).toBeGreaterThanOrEqual(7)
    expect(find(a, "c").cooldowns.heal).toBe(2)
    expect(find(a, "c").ap).toBe(1)
    expect(() => a.apply({ type: "ability", unit: "c", ability: "heal", target: "v" })).toThrow("cooldown")
  })
  test("cooldowns go down at round end", () => {
    const g = setup(open(6, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 5, y: 2 }),
    ])
    let a = g.apply({ type: "ability", unit: "c", ability: "heal", target: "v" })
    a = a.apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(find(a, "c").cooldowns.heal).toBe(1)
    expect(a.round).toBe(2)
    expect(find(a, "c").ap).toBe(2)
  })
  test("a Grenadier blast hits everyone in 3×3 and burns cover", () => {
    const rows = ["......", "..:H..", "......", "......", "......"]
    const g = setup(rows, [
      squad("v", "vanguard", { x: 0, y: 0 }),
      enemy("e", "orc", { x: 2, y: 2 }),
      squad("r", "ranger", { x: 3, y: 2 }),
      enemy("b", "bomber", { x: 2, y: 4 }),
    ])
    g.phase = "enemy"
    find(g, "b").ap = 2
    const a = g.apply({ type: "ability", unit: "b", ability: "blast", at: { x: 2, y: 1 } })
    expect(find(a, "e").hp).toBe(4)
    expect(find(a, "r").hp).toBe(4)
    expect(a.tile({ x: 2, y: 1 })).toBe("floor")
    expect(a.tile({ x: 3, y: 1 })).toBe("low")
  })
  test("a failed Dominate save turns a soldier to the enemy side", () => {
    let g = setup(
      open(8, 3),
      [
        squad("v", "vanguard", { x: 0, y: 0 }),
        squad("m", "mage", { x: 1, y: 0 }),
        enemy("x", "whisperer", { x: 6, y: 0 }),
      ],
      3,
    )
    g = g.apply({ type: "endTurn" })
    for (let seed = 1; seed < 50; seed++) {
      const a = reseed(g, seed).apply({ type: "ability", unit: "x", ability: "dominate", target: "v" })
      if (a.log.find((e) => e.key === "log.dominate")!.params.saved) continue
      expect(find(a, "v").statuses.map((s) => s.id)).toContain("dominated")
      const next = a.apply({ type: "endTurn" }).apply({ type: "endTurn" })
      expect(next.phase).toBe("enemy")
      const b = next.apply({ type: "move", unit: "v", to: { x: 0, y: 2 } })
      expect(find(b, "v").pos).toEqual({ x: 0, y: 2 })
      return
    }
    throw new Error("no failed save in 50 seeds")
  })
  test("charge moves next to the target and attacks", () => {
    const g = setup(open(10, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    const a = g.apply({ type: "ability", unit: "v", ability: "charge", target: "e" })
    expect(find(a, "v").pos.x).toBe(4)
    expect(hits(a)).toHaveLength(1)
    expect(find(a, "v").ap).toBe(0)
  })
})

describe("charge landing", () => {
  test("charge lands on the chosen tile next to the target", () => {
    const g = setup(open(10, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    const a = g.apply({ type: "ability", unit: "v", ability: "charge", target: "e", at: { x: 4, y: 0 } })
    expect(find(a, "v").pos).toEqual({ x: 4, y: 0 })
  })
  test("a landing tile not next to the target is illegal", () => {
    const g = setup(open(10, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    expect(() => g.apply({ type: "ability", unit: "v", ability: "charge", target: "e", at: { x: 2, y: 1 } })).toThrow(
      "place",
    )
  })
})

describe("doors", () => {
  test("walking into a closed door opens it", () => {
    const g = setup(
      ["#####", "#.+..", "#####"],
      [squad("v", "vanguard", { x: 1, y: 1 }), enemy("e", "orc", { x: 4, y: 1 }, "unaware")],
    )
    const a = g.apply({ type: "move", unit: "v", to: { x: 3, y: 1 } })
    expect(find(a, "v").pos).toEqual({ x: 3, y: 1 })
    expect(a.tile({ x: 2, y: 1 })).toBe("open")
  })
})

describe("mission end", () => {
  test("killing the last enemy wins", () => {
    const g = setup(open(4, 3), [squad("v", "vanguard", { x: 0, y: 0 }), enemy("e", "orc", { x: 1, y: 0 })])
    find(g, "e").hp = 1
    for (let seed = 1; seed < 20; seed++) {
      const a = reseed(g, seed).apply({ type: "attack", unit: "v", target: "e" })
      if (find(a, "e").hp === 0) {
        expect(a.phase).toBe("won")
        return
      }
    }
    throw new Error("no hit")
  })
})

describe("a controlled alien", () => {
  test("a soldier can shoot an alien the squad controls", () => {
    const e = enemy("e", "orc", { x: 3, y: 1 })
    e.give({ id: "dominated", rounds: 2 })
    const g = setup(open(8, 3), [squad("w", "vanguard", { x: 0, y: 1 }), e])
    expect(hits(g.apply({ type: "attack", unit: "w", target: "e" }))).toHaveLength(1)
  })
})
