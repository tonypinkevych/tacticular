import { apply, Illegal } from "../src/rules/actions"
import { tileAt } from "../src/rules/grid"
import type { Game } from "../src/rules/types"
import { enemy, find, open, setup, squad } from "./fixture"

const hits = (g: Game) => g.log.filter((e) => e.key === "log.hit" || e.key === "log.crit" || e.key === "log.miss")

describe("action points", () => {
  test("a short move costs 1 AP, a dash costs 2", () => {
    const g = setup(open(20, 3), [squad("v", "vanguard", { x: 0, y: 0 }), enemy("e", "orc", { x: 19, y: 2 })])
    const a = apply(g, { type: "move", unit: "v", to: { x: 6, y: 0 } })
    expect(find(a, "v").ap).toBe(1)
    const b = apply(g, { type: "move", unit: "v", to: { x: 7, y: 0 } })
    expect(find(b, "v").ap).toBe(0)
  })
  test("moving does not end the turn, attacking does", () => {
    const g = setup(open(12, 3), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 8, y: 0 })])
    const a = apply(g, { type: "move", unit: "w", to: { x: 2, y: 0 } })
    const b = apply(a, { type: "attack", unit: "w", target: "e" })
    expect(find(b, "w").ap).toBe(0)
    expect(find(b, "w").ammo).toBe(4)
    expect(() => apply(b, { type: "reload", unit: "w" })).toThrow(Illegal)
  })
  test("the longbow needs 2 AP and no move", () => {
    const g = setup(open(20, 3), [squad("r", "ranger", { x: 0, y: 0 }), enemy("e", "orc", { x: 8, y: 0 })])
    const a = apply(g, { type: "move", unit: "r", to: { x: 1, y: 0 } })
    expect(() => apply(a, { type: "attack", unit: "r", target: "e" })).toThrow("needs 2 AP")
    expect(() => apply(g, { type: "attack", unit: "r", target: "e" })).not.toThrow()
  })
  test("the original game does not change", () => {
    const g = setup(open(12, 3), [squad("v", "vanguard", { x: 0, y: 0 }), enemy("e", "orc", { x: 11, y: 2 })])
    apply(g, { type: "move", unit: "v", to: { x: 3, y: 0 } })
    expect(find(g, "v").pos).toEqual({ x: 0, y: 0 })
  })
})

describe("reactions", () => {
  test("overwatch fires once at the first move in sight", () => {
    const g0 = setup(open(12, 3), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 6, y: 2 })])
    const g1 = apply(g0, { type: "overwatch", unit: "w" })
    const g2 = apply(g1, { type: "endTurn" })
    const g3 = apply(g2, { type: "move", unit: "e", to: { x: 9, y: 2 } })
    expect(hits(g3)).toHaveLength(1)
    expect(hits(g3)[0].params.reaction).toBe(true)
    expect(find(g3, "w").stance).toBe("none")
  })
  test("leaving a melee unit's reach provokes a free attack", () => {
    const g0 = setup(open(12, 3), [squad("v", "vanguard", { x: 5, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const g1 = apply(g0, { type: "endTurn" })
    const g2 = apply(g1, { type: "move", unit: "e", to: { x: 10, y: 1 } })
    expect(hits(g2)).toHaveLength(1)
    expect(hits(g2)[0].params.unit).toBe("v")
  })
  test("moving inside the reach does not provoke", () => {
    const g0 = setup(open(12, 3), [squad("v", "vanguard", { x: 5, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const g1 = apply(apply(g0, { type: "endTurn" }), { type: "move", unit: "e", to: { x: 6, y: 0 } })
    expect(hits(g1)).toHaveLength(0)
  })
  test("hunker needs cover", () => {
    const g = setup(["...", ".:.", "..."], [squad("c", "cleric", { x: 1, y: 2 }), enemy("e", "orc", { x: 0, y: 0 })])
    expect(find(apply(g, { type: "hunker", unit: "c" }), "c").stance).toBe("hunker")
    const g2 = setup(open(3, 3), [squad("c", "cleric", { x: 1, y: 2 }), enemy("e", "orc", { x: 0, y: 0 })])
    expect(() => apply(g2, { type: "hunker", unit: "c" })).toThrow("cover")
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
    const a = apply(g, { type: "ability", unit: "c", ability: "heal", target: "v" })
    expect(find(a, "v").hp).toBeGreaterThanOrEqual(7)
    expect(find(a, "c").cooldowns.heal).toBe(2)
    expect(find(a, "c").ap).toBe(1)
    expect(() => apply(a, { type: "ability", unit: "c", ability: "heal", target: "v" })).toThrow("cooldown")
  })
  test("cooldowns go down at round end", () => {
    const g = setup(open(6, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 5, y: 2 }),
    ])
    let a = apply(g, { type: "ability", unit: "c", ability: "heal", target: "v" })
    a = apply(apply(a, { type: "endTurn" }), { type: "endTurn" })
    expect(find(a, "c").cooldowns.heal).toBe(1)
    expect(a.round).toBe(2)
    expect(find(a, "c").ap).toBe(2)
  })
  test("a fire flask hits everyone in 3×3 and burns cover", () => {
    const rows = ["......", "..:H..", "......"]
    const g = setup(rows, [
      squad("v", "vanguard", { x: 0, y: 0 }),
      enemy("e", "orc", { x: 2, y: 2 }),
      squad("r", "ranger", { x: 3, y: 2 }),
    ])
    const a = apply(g, { type: "item", unit: "v", item: "flask", at: { x: 2, y: 1 } })
    expect(find(a, "e").hp).toBe(5)
    expect(find(a, "r").hp).toBe(5)
    expect(tileAt(a, { x: 2, y: 1 })).toBe("floor")
    expect(tileAt(a, { x: 3, y: 1 })).toBe("low")
    expect(find(a, "v").items.flask).toBe(0)
  })
  test("bulwark makes high cover tiles for 2 rounds", () => {
    const g = setup(open(6, 6), [squad("w", "warden", { x: 2, y: 3 }), enemy("e", "orc", { x: 5, y: 0 })])
    const a = apply(g, { type: "ability", unit: "w", ability: "bulwark", at: { x: 2, y: 2 } })
    expect([1, 2, 3].map((x) => tileAt(a, { x, y: 2 }))).toEqual(["high", "high", "high"])
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
    g = apply(g, { type: "endTurn" })
    for (let seed = 1; seed < 50; seed++) {
      const a = apply({ ...g, rng: seed }, { type: "ability", unit: "x", ability: "dominate", target: "v" })
      if (a.log.find((e) => e.key === "log.dominate")!.params.saved) continue
      expect(find(a, "v").statuses.map((s) => s.id)).toContain("dominated")
      const next = apply(apply(a, { type: "endTurn" }), { type: "endTurn" })
      expect(next.phase).toBe("enemy")
      const b = apply(next, { type: "move", unit: "v", to: { x: 0, y: 2 } })
      expect(find(b, "v").pos).toEqual({ x: 0, y: 2 })
      return
    }
    throw new Error("no failed save in 50 seeds")
  })
  test("charge moves next to the target and attacks", () => {
    const g = setup(open(10, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const a = apply(g, { type: "ability", unit: "v", ability: "charge", target: "e" })
    expect(find(a, "v").pos.x).toBe(5)
    expect(hits(a)).toHaveLength(1)
    expect(find(a, "v").ap).toBe(0)
  })
})

describe("charge landing", () => {
  test("charge lands on the chosen tile next to the target", () => {
    const g = setup(open(10, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    const a = apply(g, { type: "ability", unit: "v", ability: "charge", target: "e", at: { x: 6, y: 0 } })
    expect(find(a, "v").pos).toEqual({ x: 6, y: 0 })
  })
  test("a landing tile not next to the target is illegal", () => {
    const g = setup(open(10, 3), [squad("v", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    expect(() => apply(g, { type: "ability", unit: "v", ability: "charge", target: "e", at: { x: 3, y: 1 } })).toThrow(
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
    const a = apply(g, { type: "move", unit: "v", to: { x: 3, y: 1 } })
    expect(find(a, "v").pos).toEqual({ x: 3, y: 1 })
    expect(tileAt(a, { x: 2, y: 1 })).toBe("open")
  })
})

describe("mission end", () => {
  test("killing the last enemy wins", () => {
    const g = setup(open(4, 3), [squad("v", "vanguard", { x: 0, y: 0 }), enemy("e", "orc", { x: 1, y: 0 })])
    find(g, "e").hp = 1
    for (let seed = 1; seed < 20; seed++) {
      const a = apply({ ...g, rng: seed }, { type: "attack", unit: "v", target: "e" })
      if (find(a, "e").hp === 0) {
        expect(a.phase).toBe("won")
        return
      }
    }
    throw new Error("no hit")
  })
})
