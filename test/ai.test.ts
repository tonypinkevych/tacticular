import { decide } from "../src/ai/ai"
import { frames, play } from "../src/play"
import { apply } from "../src/rules/actions"
import { coverAgainst } from "../src/rules/cover"
import { newGame, parseBoard } from "../src/rules/game"
import type { Game } from "../src/rules/types"
import { makeUnit } from "../src/rules/units"
import { simulate } from "../src/sim"
import { enemy, find, open, setup, squad } from "./fixture"

const enemyTurn = (g: Game) => apply(g, { type: "endTurn" })

describe("enemy AI", () => {
  test("an exposed enemy moves into cover against a soldier it sees", () => {
    const rows = open(14, 7)
    rows[2] = "..........:..."
    const g = enemyTurn(setup(rows, [squad("w", "warden", { x: 10, y: 0 }), enemy("e", "orc", { x: 7, y: 5 })]))
    find(g, "w").concealed = false
    const a = decide(g, find(g, "e"))
    expect(a?.type).toBe("move")
    const after = apply(g, a!)
    expect(coverAgainst(after, find(after, "e").pos, { x: 10, y: 0 })).toBeGreaterThan(0)
  })
  test("an ogre that cannot reach marks its target, then charges next phase", () => {
    const rows = ["....:.........", "....:.........", ".............."]
    const base = setup(rows, [squad("v", "vanguard", { x: 0, y: 0 }), enemy("o", "ogre", { x: 8, y: 0 })])
    find(base, "v").concealed = false
    let g = enemyTurn(base)
    for (let i = 0; i < 2 && !find(g, "o").intent; i++) g = apply(g, decide(g, find(g, "o"))!)
    expect(find(g, "o").intent).toEqual({ type: "charge", target: "v" })
    g = enemyTurn(enemyTurn(g))
    expect(decide(g, find(g, "o"))).toMatchObject({ type: "ability", ability: "charge", target: "v" })
  })
  test("a revealed group reacts once, in the player phase", () => {
    const g = setup(open(20, 5), [
      squad("g", "rogue", { x: 0, y: 2 }),
      squad("h", "warden", { x: 0, y: 4 }),
      enemy("a", "orc", { x: 10, y: 2 }, "unaware"),
      enemy("b", "orc", { x: 11, y: 3 }, "unaware"),
    ])
    const a = play(g, { type: "move", unit: "g", to: { x: 6, y: 2 } })
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
    const g = play(g0, { type: "endTurn" })
    expect(find(g, "e").pos.x).toBeLessThan(19)
    expect(g.phase).toBe("squad")
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
        makeUnit("s1", "vanguard", "squad", { x: 0, y: 0 }, "A"),
        makeUnit("s2", "ranger", "squad", { x: 0, y: 2 }, "B"),
        makeUnit("s3", "cleric", "squad", { x: 0, y: 4 }, "C"),
        makeUnit("s4", "mage", "squad", { x: 0, y: 6 }, "D"),
        makeUnit("e1", "orc", "enemy", { x: 20, y: 1 }, "e1", "g1"),
        makeUnit("e2", "warchief", "enemy", { x: 21, y: 2 }, "e2", "g1"),
        makeUnit("e3", "bomber", "enemy", { x: 22, y: 3 }, "e3", "g1"),
        makeUnit("e4", "ogre", "enemy", { x: 16, y: 6 }, "e4", "g2"),
        makeUnit("e5", "whisperer", "enemy", { x: 18, y: 7 }, "e5", "g2"),
      ]
      units[4].patrol = [
        { x: 10, y: 0 },
        { x: 20, y: 1 },
      ]
      const game = newGame({
        seed,
        board: parseBoard(rows),
        units,
        groups: [
          { id: "g1", revealed: false, target: null },
          { id: "g2", revealed: false, target: null },
        ],
      })
      const end = simulate(game, 40)
      if (end.phase === "won" || end.phase === "lost") ended++
    }
    expect(ended).toBeGreaterThan(35)
  })
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
    const steps = frames(g0, { type: "endTurn" })
    expect(steps.map((s) => s.action.type)).toEqual(["endTurn", "move", "endTurn"])
    expect(steps[steps.length - 1].game).toEqual(play(g0, { type: "endTurn" }))
  })
})
