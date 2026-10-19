import type { Game } from "../../src/mission/game"
import { Illegal } from "../../src/mission/orders"
import { enemy, find, open, reseed, setup, squad } from "../fixture"

/** A Brute's phase with a soldier 5 tiles away. */
const brute = (): Game => {
  const g = setup(open(10, 3), [squad("v", "vanguard", { x: 5, y: 1 }), enemy("o", "ogre", { x: 0, y: 1 })])
  g.phase = "enemy"
  find(g, "o").ap = 2
  return g
}
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
    const shot = g3.log.find((e) => e.key === "log.overwatch")
    expect(shot?.params).toEqual({ unit: "w", target: "e", x: 5, y: 2 })
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
  test("a skill spends 1 AP and sets its cooldown", () => {
    const g = setup(open(6, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 5, y: 2 }),
    ])
    const a = g.apply({ type: "ability", unit: "c", ability: "ward", target: "v" })
    expect(find(a, "c").cooldowns.ward).toBe(3)
    expect(find(a, "c").ap).toBe(1)
    expect(() => a.apply({ type: "ability", unit: "c", ability: "ward", target: "v" })).toThrow("cooldown")
  })
  test("cooldowns go down at round end", () => {
    const g = setup(open(6, 3), [
      squad("c", "cleric", { x: 0, y: 0 }),
      squad("v", "vanguard", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 5, y: 2 }),
    ])
    let a = g.apply({ type: "ability", unit: "c", ability: "ward", target: "v" })
    a = a.apply({ type: "endTurn" }).apply({ type: "endTurn" })
    expect(find(a, "c").cooldowns.ward).toBe(2)
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
    expect(find(a, "e").hp).toBe(find(g, "e").maxHp - 3)
    expect(find(a, "r").hp).toBe(find(g, "r").maxHp - 3)
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
    const g = brute()
    const a = g.apply({ type: "ability", unit: "o", ability: "charge", target: "v" })
    expect(find(a, "o").pos.x).toBe(4)
    expect(hits(a)).toHaveLength(1)
    expect(find(a, "o").ap).toBe(0)
  })
})

describe("charge landing", () => {
  test("charge lands on the chosen tile next to the target", () => {
    const a = brute().apply({ type: "ability", unit: "o", ability: "charge", target: "v", at: { x: 4, y: 0 } })
    expect(find(a, "o").pos).toEqual({ x: 4, y: 0 })
  })
  test("a landing tile not next to the target is illegal", () => {
    expect(() =>
      brute().apply({ type: "ability", unit: "o", ability: "charge", target: "v", at: { x: 2, y: 1 } }),
    ).toThrow("place")
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
  test("a soldier next to a door opens it, then closes it, for 1 AP each", () => {
    const g = setup(
      ["#####", "#.+..", "#####"],
      [squad("v", "vanguard", { x: 1, y: 1 }), enemy("e", "orc", { x: 4, y: 1 }, "unaware")],
    )
    const opened = g.apply({ type: "door", unit: "v", at: { x: 2, y: 1 } })
    expect(opened.tile({ x: 2, y: 1 })).toBe("open")
    const closed = opened.apply({ type: "door", unit: "v", at: { x: 2, y: 1 } })
    expect(closed.tile({ x: 2, y: 1 })).toBe("door")
    expect(find(closed, "v").ap).toBe(0)
  })
  test("a door with a unit in it does not close", () => {
    const g = setup(
      ["#####", "#.+..", "#####"],
      [squad("v", "vanguard", { x: 1, y: 1 }), squad("w", "warden", { x: 2, y: 1 })],
    )
    g.board.set({ x: 2, y: 1 }, "open")
    expect(() => g.apply({ type: "door", unit: "v", at: { x: 2, y: 1 } })).toThrow()
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
  const chief = () => {
    const g = setup(open(8, 3), [
      squad("v", "vanguard", { x: 0, y: 0 }),
      enemy("w", "warchief", { x: 1, y: 0 }),
      enemy("e", "orc", { x: 7, y: 2 }),
    ])
    g.goal = { kind: "warchief", tiles: [{ x: 3, y: 0 }], slain: false }
    find(g, "w").hp = 1
    for (let seed = 1; seed < 20; seed++) {
      const a = reseed(g, seed).apply({ type: "attack", unit: "v", target: "w" })
      if (find(a, "w").hp === 0) return a
    }
    throw new Error("no hit")
  }
  test("in a Warchief mission, killing the Warchief goes on while other aliens stand", () => {
    const a = chief()
    expect(a.phase).toBe("squad")
    expect(a.goal).toMatchObject({ slain: true })
    expect(a.log.filter((x) => x.key === "log.chief")).toHaveLength(1)
  })
  test("after the Warchief dies, the squad in the evac zone wins", () => {
    const a = chief()
    find(a, "v").ap = 2
    expect(a.apply({ type: "move", unit: "v", to: { x: 3, y: 0 } }).phase).toBe("won")
  })
  test("before the Warchief dies, the evac zone does not win", () => {
    const g = setup(open(8, 3), [
      squad("v", "vanguard", { x: 0, y: 0 }),
      enemy("w", "warchief", { x: 7, y: 2 }, "unaware"),
    ])
    g.goal = { kind: "warchief", tiles: [{ x: 2, y: 0 }], slain: false }
    expect(g.apply({ type: "move", unit: "v", to: { x: 2, y: 0 } }).phase).toBe("squad")
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

describe("wounds", () => {
  test("a wounded soldier cannot dash", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    v.hp = Math.floor(v.maxHp / 2)
    const g = setup(open(12, 2), [v, enemy("e", "orc", { x: 11, y: 1 })])
    expect(() => g.apply({ type: "move", unit: "v", to: { x: v.mobility + 1, y: 0 } })).toThrow("unreachable")
  })
})

describe("aim", () => {
  test("an alien aims at a soldier it sees, for no AP", () => {
    const g = setup(open(10, 2), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 5, y: 0 })])
    g.phase = "enemy"
    find(g, "e").ap = 0
    const a = g.apply({ type: "aim", unit: "e", target: "w" })
    expect(find(a, "e").intent).toEqual({ type: "shot", target: "w" })
  })
  test("an alien cannot aim at a soldier it does not see", () => {
    const g = setup(
      ["...#......", "...#......"],
      [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 6, y: 0 })],
    )
    g.phase = "enemy"
    expect(() => g.apply({ type: "aim", unit: "e", target: "w" })).toThrow(Illegal)
  })
  test("an attack spends the aim", () => {
    const g = setup(open(10, 2), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 5, y: 0 })])
    g.phase = "enemy"
    find(g, "e").ap = 2
    const a = g.apply({ type: "aim", unit: "e", target: "w" }).apply({ type: "attack", unit: "e", target: "w" })
    expect(find(a, "e").intent).toBeNull()
  })
})

describe("shooting a barrel", () => {
  test("a soldier shoots a barrel in sight and weapon range: it blows up and the turn ends", () => {
    const g = setup(
      ["..........", "......b...", ".........."],
      [squad("w", "warden", { x: 2, y: 1 }), enemy("e", "orc", { x: 7, y: 2 })],
    )
    const a = g.apply({ type: "shoot", unit: "w", at: { x: 6, y: 1 } })
    expect(a.tile({ x: 6, y: 1 })).toBe("floor")
    expect(find(a, "e").hp).toBe(find(g, "e").maxHp - 3)
    expect(find(a, "w").ap).toBe(0)
  })
  test("a melee fighter cannot shoot a barrel", () => {
    const g = setup(["...b......"], [squad("g", "rogue", { x: 2, y: 0 }), enemy("e", "orc", { x: 9, y: 0 })])
    expect(() => g.apply({ type: "shoot", unit: "g", at: { x: 3, y: 0 } })).toThrow(Illegal)
  })
})

describe("objectives", () => {
  const far = () => enemy("e", "orc", { x: 11, y: 2 }, "unaware")
  test("Use next to the terminal takes the intel for 1 AP; then the evac zone wins", () => {
    const g = setup(open(12, 3), [squad("s", "rogue", { x: 1, y: 1 }), far()])
    g.goal = { kind: "intel", at: { x: 2, y: 1 }, taken: false, tiles: [{ x: 4, y: 1 }] }
    const a = g.apply({ type: "use", unit: "s" })
    expect(a.goal).toMatchObject({ taken: true })
    expect(find(a, "s").ap).toBe(1)
    expect(a.apply({ type: "move", unit: "s", to: { x: 4, y: 1 } }).phase).toBe("won")
  })
  test("the evac zone does not win before the intel is taken", () => {
    const g = setup(open(12, 3), [squad("s", "rogue", { x: 1, y: 1 }), far()])
    g.goal = { kind: "intel", at: { x: 8, y: 1 }, taken: false, tiles: [{ x: 2, y: 1 }] }
    expect(g.apply({ type: "move", unit: "s", to: { x: 2, y: 1 } }).phase).toBe("squad")
  })
  test("Use away from the objective is refused", () => {
    const g = setup(open(12, 3), [squad("s", "rogue", { x: 1, y: 1 }), far()])
    g.goal = { kind: "relay", at: { x: 5, y: 1 }, planted: null, tiles: [], blown: false }
    expect(() => g.apply({ type: "use", unit: "s" })).toThrow(Illegal)
  })
  test("Use next to the relay plants a charge", () => {
    const g = setup(open(12, 3), [squad("s", "rogue", { x: 1, y: 1 }), far()])
    g.goal = { kind: "relay", at: { x: 2, y: 2 }, planted: null, tiles: [], blown: false }
    expect(g.apply({ type: "use", unit: "s" }).goal).toMatchObject({ kind: "relay", planted: 1 })
  })
  const captive = () => {
    const c = squad("c", "mage", { x: 5, y: 1 })
    c.give({ id: "captive", rounds: 99 })
    return c
  }
  test("a soldier who steps next to the captive frees it", () => {
    const g = setup(open(12, 3), [squad("s", "rogue", { x: 1, y: 1 }), captive(), far()])
    g.goal = { kind: "vip", captive: "c", tiles: [{ x: 6, y: 0 }] }
    const a = g.apply({ type: "move", unit: "s", to: { x: 4, y: 1 } })
    expect(find(a, "c").has("captive")).toBe(false)
    expect(a.log.some((x) => x.key === "log.freed")).toBe(true)
  })
  test("the mission is lost when every soldier falls while the captive is held", () => {
    const g = setup(open(12, 3), [squad("s", "rogue", { x: 1, y: 1 }), captive(), far()])
    g.goal = { kind: "vip", captive: "c", tiles: [{ x: 6, y: 0 }] }
    find(g, "s").hp = 0
    g.orders.settle()
    expect(g.phase).toBe("lost")
  })
  test("an alien cannot target a captive", () => {
    const g = setup(open(12, 3), [captive(), enemy("e", "orc", { x: 7, y: 1 })])
    expect(g.orders.canTarget(find(g, "e"), find(g, "c"))).toBe(false)
  })
  test("the freed captive in the evac zone wins; its death loses", () => {
    const g = setup(open(12, 3), [squad("s", "rogue", { x: 1, y: 1 }), squad("c", "mage", { x: 5, y: 1 }), far()])
    g.goal = { kind: "vip", captive: "c", tiles: [{ x: 6, y: 1 }] }
    expect(g.apply({ type: "move", unit: "c", to: { x: 6, y: 1 } }).phase).toBe("won")
    find(g, "c").hp = 0
    g.orders.settle()
    expect(g.phase).toBe("lost")
  })
})
