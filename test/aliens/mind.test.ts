import { Mind } from "../../src/aliens/mind"
import { Board } from "../../src/map/board"
import { distance, key } from "../../src/map/point"
import { Game } from "../../src/mission/game"
import { Match } from "../../src/mission/match"
import { Unit } from "../../src/units/unit"
import { enemy, find, open, setup, squad } from "../fixture"

const enemyTurn = (g: Game) => g.apply({ type: "endTurn" })

describe("enemy AI", () => {
  test("an alien shoots the soldier it aimed at, not the easier target", () => {
    const rows = open(12, 5)
    rows[1] = "....:......."
    const g = enemyTurn(
      setup(rows, [
        squad("a", "warden", { x: 4, y: 0 }),
        squad("b", "mage", { x: 5, y: 4 }),
        enemy("e", "orc", { x: 8, y: 2 }),
      ]),
    )
    for (const id of ["a", "b"]) find(g, id).concealed = false
    find(g, "e").intent = { type: "shot", target: "a" }
    expect(new Mind(g).decide(find(g, "e"))).toMatchObject({ type: "attack", target: "a" })
  })
  test("an alien aims at the soldier it would attack", () => {
    const g = enemyTurn(setup(open(10, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })]))
    find(g, "w").concealed = false
    expect(new Mind(g).aim(find(g, "e"))).toMatchObject({ type: "aim", unit: "e", target: "w" })
  })
  test("an alien marks a tile within one move with a better shot than where it stands", () => {
    const rows = open(16, 7)
    rows[3] = ".:.............."
    const g = enemyTurn(setup(rows, [squad("w", "warden", { x: 0, y: 3 }), enemy("e", "orc", { x: 5, y: 3 })]))
    find(g, "w").concealed = false
    const e = find(g, "e")
    const aim = new Mind(g).aim(e)
    expect(aim).toMatchObject({ type: "aim", target: "w" })
    const from = (aim as unknown as { from: { x: number; y: number } }).from
    expect(g.reach(e, e.mobility).cost.has(key(from))).toBe(true)
    const w = find(g, "w")
    expect(g.combat.odds(e.at(from), w).chance).toBeGreaterThan(g.combat.odds(e, w).chance)
  })
  test("an alien with a firing tile walks there first, then shoots", () => {
    const g = enemyTurn(setup(open(16, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 10, y: 1 })]))
    find(g, "w").concealed = false
    find(g, "e").intent = { type: "shot", target: "w", from: { x: 6, y: 1 } }
    const move = new Mind(g).decide(find(g, "e"))
    expect(move).toEqual({ type: "move", unit: "e", to: { x: 6, y: 1 } })
    const there = g.apply(move!)
    expect(new Mind(there).decide(find(there, "e"))).toMatchObject({ type: "attack", target: "w" })
  })
  test("an alien whose firing tile is taken fires from where it stands when it can", () => {
    const g = enemyTurn(
      setup(open(16, 3), [
        squad("w", "warden", { x: 0, y: 1 }),
        squad("b", "warden", { x: 4, y: 1 }),
        enemy("e", "orc", { x: 6, y: 1 }),
      ]),
    )
    for (const id of ["w", "b"]) find(g, id).concealed = false
    find(g, "e").intent = { type: "shot", target: "w", from: { x: 4, y: 1 } }
    expect(new Mind(g).decide(find(g, "e"))).toMatchObject({ type: "attack", target: "w" })
  })
  test("a walking alien stops before the tiles a known soldier on overwatch covers", () => {
    const g = enemyTurn(
      setup(open(20, 3), [
        squad("w", "warden", { x: 0, y: 1 }),
        enemy("e", "orc", { x: 12, y: 1 }),
        enemy("s", "orc", { x: 5, y: 0 }),
      ]),
    )
    find(g, "w").concealed = false
    find(g, "w").stance = "overwatch"
    const e = find(g, "e")
    const step = new Mind(g).toward(e, { x: 1, y: 1 }, e.stride())
    expect(step).toMatchObject({ type: "move", to: { x: 7 } })
  })
  test("an alien that sees no soldier aims at nobody", () => {
    const g = enemyTurn(setup(open(30, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 29, y: 1 })]))
    expect(new Mind(g).aim(find(g, "e"))).toBeNull()
  })
  test("an exposed enemy moves into cover against a soldier it sees", () => {
    const rows = open(14, 7)
    rows[2] = "..........:..."
    const g = enemyTurn(setup(rows, [squad("w", "warden", { x: 10, y: 0 }), enemy("e", "orc", { x: 7, y: 5 })]))
    find(g, "w").concealed = false
    const a = new Mind(g).decide(find(g, "e"))
    expect(a?.type).toBe("move")
    const after = g.apply(a!)
    expect(after.cover.against(find(after, "e").pos, { x: 10, y: 0 })).toBeGreaterThan(0)
  })
  test("an ogre that cannot reach marks its target, then charges next phase", () => {
    const rows = ["....:.........", "....:.........", ".............."]
    const base = setup(rows, [squad("v", "vanguard", { x: 0, y: 0 }), enemy("o", "ogre", { x: 8, y: 0 })])
    find(base, "v").concealed = false
    base.groups[0].target = { x: 0, y: 0 }
    let g = enemyTurn(base)
    for (let i = 0; i < 4 && !find(g, "o").intent; i++) {
      const a = new Mind(g).decide(find(g, "o"))
      g = a ? g.apply(a) : enemyTurn(enemyTurn(g))
    }
    expect(find(g, "o").intent).toEqual({ type: "charge", target: "v" })
    g = enemyTurn(enemyTurn(g))
    expect(new Mind(g).decide(find(g, "o"))).toMatchObject({ type: "ability", ability: "charge", target: "v" })
  })
  test("a revealed group reacts once, in the player phase", () => {
    const g = setup(open(20, 5), [
      squad("g", "warden", { x: 0, y: 2 }),
      squad("h", "warden", { x: 0, y: 4 }),
      enemy("a", "orc", { x: 8, y: 2 }, "unaware"),
      enemy("b", "orc", { x: 9, y: 3 }, "unaware"),
    ])
    const a = new Match(g).play({ type: "move", unit: "g", to: { x: 6, y: 2 } }).at(-1)!.game
    expect(a.reactions).toEqual([])
    expect(a.phase).toBe("squad")
    const acted = ["a", "b"].filter(
      (id) => find(a, id).pos.x !== find(g, id).pos.x || a.log.some((e) => e.params.unit === id),
    )
    expect(acted.length).toBeGreaterThan(0)
  })
  test("a patrol walks its route while unaware", () => {
    const g0 = setup(open(20, 3), [
      squad("v", "vanguard", { x: 0, y: 0 }),
      enemy("e", "orc", { x: 19, y: 2 }, "unaware"),
    ])
    find(g0, "e").patrol = [
      { x: 12, y: 2 },
      { x: 19, y: 2 },
    ]
    const g = new Match(g0).play({ type: "endTurn" }).at(-1)!.game
    expect(find(g, "e").pos.x).toBeLessThan(19)
    expect(g.phase).toBe("squad")
  })
})

describe("search and hunt", () => {
  const alien = (
    rows: string[],
    at: { x: number; y: number },
    alert: "investigating" | "engaged",
    target: { x: number; y: number },
  ) => {
    const g = setup(rows, [
      squad("s", "vanguard", { x: rows[0].length - 1, y: rows.length - 1 }),
      enemy("e", "orc", at, alert),
    ])
    find(g, "s").concealed = true
    g.groups[0].target = target
    g.phase = "enemy"
    find(g, "e").ap = 2
    return g
  }
  const moved = (g: Game) => {
    const a = new Mind(g).decide(find(g, "e"))
    return a?.type === "move" ? a.to : null
  }

  test("an alien far from the noise dashes toward it with both moves", () => {
    const g = alien(open(30, 3), { x: 29, y: 2 }, "investigating", { x: 12, y: 2 })
    expect(29 - (moved(g)?.x ?? 29)).toBeGreaterThan(find(g, "e").mobility)
  })
  test("at the noise an alien moves to a tile its side does not see", () => {
    const rows = ["..###...", "..###...", "........"]
    const g = alien(rows, { x: 4, y: 2 }, "investigating", { x: 1, y: 2 })
    find(g, "e").mobility = 6
    const to = moved(g)
    expect(to).not.toBeNull()
    expect(g.sight.sees(find(g, "e"), to!)).toBe(false)
  })
  test("an engaged alien that lost sight of the squad searches the last place it saw a soldier", () => {
    const g = alien(open(30, 3), { x: 20, y: 1 }, "engaged", { x: 20, y: 1 })
    const to = moved(g)
    expect(to === null || distance(to, { x: 20, y: 1 }) <= 3).toBe(true)
  })
})

describe("fight", () => {
  const duel = (d: number) => {
    const rows = [".".repeat(12), `.H${".".repeat(d - 1)}H${".".repeat(10 - d)}`, ".".repeat(12)]
    const g = setup(rows, [squad("s", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 2 + d, y: 1 })])
    find(g, "s").concealed = false
    g.phase = "enemy"
    find(g, "e").ap = 2
    return g
  }

  test("an alien that waited last turn and sees no soldier heads for where the squad landed", () => {
    const g = duel(6)
    g.groups[0].landing = { x: 0, y: 1 }
    expect(new Mind(g).decide(find(g, "e"))?.type).toBe("overwatch")
    find(g, "e").waited = true
    expect(new Mind(g).decide(find(g, "e"))?.type).toBe("move")
  })
  test("a badly hurt alien with no kill falls back away from the soldiers", () => {
    const rows = [".".repeat(12), ".H......H...", ".".repeat(12)]
    const g = setup(rows, [squad("s", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 6, y: 1 })])
    find(g, "s").concealed = false
    g.phase = "enemy"
    find(g, "e").ap = 2
    find(g, "e").hp = 2
    const a = new Mind(g).decide(find(g, "e"))
    expect(a?.type).toBe("move")
    expect(distance((a as { to: { x: number; y: number } }).to, { x: 0, y: 1 })).toBeGreaterThan(6)
  })
})

describe("evac guard", () => {
  const evac = (rows: string[], units: Unit[]) => {
    const g = setup(rows, [squad("s", "vanguard", { x: 0, y: 1 }), ...units])
    g.goal = { kind: "evac", tiles: [{ x: rows[0].length - 1, y: 1 }] }
    g.phase = "enemy"
    for (const u of g.units) if (u.side === "enemy") u.ap = 2
    return g
  }

  test("the group nearest the evac zone walks to it, the other group does not", () => {
    const g = evac(open(30, 3), [
      enemy("a", "orc", { x: 18, y: 1 }, "unaware", "g1"),
      enemy("b", "orc", { x: 10, y: 1 }, "unaware", "g2"),
    ])
    const a = new Mind(g).decide(find(g, "a"))
    expect(a?.type).toBe("move")
    expect((a as { to: { x: number } }).to.x).toBeGreaterThan(18)
    expect(new Mind(g).decide(find(g, "b"))).toBeNull()
  })
  test("a guard at the evac zone takes cover facing where the squad landed", () => {
    const rows = [".".repeat(12), `${".".repeat(8)}:...`, ".".repeat(12)]
    const g = evac(rows, [enemy("a", "orc", { x: 10, y: 0 }, "unaware", "g1")])
    g.groups[0].landing = { x: 0, y: 1 }
    const a = new Mind(g).decide(find(g, "a"))
    expect(a).toMatchObject({ type: "move", to: { x: 9, y: 1 } })
  })
})

describe("headless missions", () => {
  test("AI against AI ends without errors on 50 seeds", () => {
    const rows = [
      "........................",
      "...:......H.......:.....",
      "........#####...........",
      "..H.....#...+.....H.....",
      "........#####......:....",
      "....:..........H........",
      "..........:.........:...",
      "...H.........H..........",
    ]
    let ended = 0
    for (let seed = 1; seed <= 50; seed++) {
      const units = [
        Unit.of("s1", "vanguard", "squad", { x: 0, y: 0 }, "A"),
        Unit.of("s2", "ranger", "squad", { x: 0, y: 2 }, "B"),
        Unit.of("s3", "cleric", "squad", { x: 0, y: 4 }, "C"),
        Unit.of("s4", "mage", "squad", { x: 0, y: 6 }, "D"),
        Unit.of("e1", "orc", "enemy", { x: 20, y: 1 }, "e1", "g1"),
        Unit.of("e2", "warchief", "enemy", { x: 21, y: 2 }, "e2", "g1"),
        Unit.of("e3", "bomber", "enemy", { x: 22, y: 3 }, "e3", "g1"),
        Unit.of("e4", "ogre", "enemy", { x: 16, y: 6 }, "e4", "g2"),
        Unit.of("e5", "whisperer", "enemy", { x: 18, y: 7 }, "e5", "g2"),
      ]
      units[4].patrol = [
        { x: 10, y: 0 },
        { x: 20, y: 1 },
      ]
      const game = Game.start({
        seed,
        board: Board.parse(rows),
        units,
        groups: [
          { id: "g1", revealed: false, target: null },
          { id: "g2", revealed: false, target: null },
        ],
      })
      const end = new Match(game).simulate(40)
      if (end.phase === "won" || end.phase === "lost") ended++
    }
    expect(ended).toBeGreaterThan(35)
  }, 15000)
})

describe("frames", () => {
  test("frames keep each enemy step and end in the same game as play", () => {
    const g0 = setup(open(20, 3), [
      squad("v", "vanguard", { x: 0, y: 0 }),
      enemy("e", "orc", { x: 19, y: 2 }, "unaware"),
    ])
    find(g0, "e").patrol = [
      { x: 12, y: 2 },
      { x: 19, y: 2 },
    ]
    const steps = new Match(g0).play({ type: "endTurn" })
    expect(steps.map((s) => s.action.type)).toEqual(["endTurn", "move", "endTurn"])
    expect(steps[steps.length - 1].game).toEqual(new Match(g0).play({ type: "endTurn" }).at(-1)!.game)
  })
})

describe("patrols", () => {
  test("a unit standing on its first patrol point walks to the next one", () => {
    const g0 = setup(open(20, 3), [
      squad("v", "vanguard", { x: 0, y: 0 }),
      enemy("e", "orc", { x: 19, y: 2 }, "unaware"),
    ])
    find(g0, "e").patrol = [
      { x: 19, y: 2 },
      { x: 10, y: 2 },
    ]
    const g = new Match(g0).play({ type: "endTurn" }).at(-1)!.game
    expect(find(g, "e").pos.x).toBeLessThan(19)
  })
})

describe("next-turn flank", () => {
  test("an alien flanks a tile next turn when it can walk to a tile that sees it with no cover between", () => {
    const rows = open(14, 7)
    rows[3] = "..:..........."
    const g = setup(rows, [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 6, y: 3 })])
    const mind = new Mind(g)
    expect(mind.flanks(find(g, "e"), { x: 1, y: 3 })).toBe(true)
    expect(mind.flanks(find(g, "e"), { x: 1, y: 3 }, 0)).toBe(false)
  })
})

describe("threat", () => {
  test("covers the tiles an alien can walk to next turn, and for a melee alien the tiles next to them", () => {
    const orc = enemy("o", "orc", { x: 1, y: 1 })
    const brute = enemy("b", "ogre", { x: 1, y: 1 })
    const reach = new Mind(setup(open(20, 3), [orc])).threat(orc)
    expect(reach.has(key({ x: 1 + 2 * orc.mobility, y: 1 }))).toBe(true)
    expect(reach.has(key({ x: 2 + 2 * orc.mobility, y: 1 }))).toBe(false)
    const strike = new Mind(setup(open(20, 3), [brute])).threat(brute)
    expect(strike.has(key({ x: 2 + 2 * brute.mobility, y: 1 }))).toBe(true)
  })
  test("a wounded alien threatens one move only", () => {
    const orc = enemy("o", "orc", { x: 1, y: 1 })
    orc.hp = 1
    const reach = new Mind(setup(open(20, 3), [orc])).threat(orc)
    expect(reach.has(key({ x: 1 + orc.mobility, y: 1 }))).toBe(true)
    expect(reach.has(key({ x: 2 + orc.mobility, y: 1 }))).toBe(false)
  })
})
