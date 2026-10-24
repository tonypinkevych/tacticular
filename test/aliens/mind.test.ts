import { Mind } from "../../src/aliens/mind"
import { cover } from "../../src/map/cover"
import type { Game } from "../../src/mission/game"
import { enemy, open, setup, squad } from "../fixture"

const rows = (r: string[]) => [...r, ...Array(8 - r.length).fill("........")]
const aliens = (g: Game) => g.apply({ type: "endTurn" })

describe("mind", () => {
  test("a Grunt in range shoots", () => {
    const g = aliens(setup(open(), [squad("r", "ranger", { x: 3, y: 5 }), enemy("g", "grunt", { x: 3, y: 2 })]))
    expect(new Mind(g).next()).toMatchObject({ type: expect.stringMatching(/shoot|skill/), unit: "g" })
  })
  test("a Grunt out of range moves first", () => {
    const g = aliens(setup(open(), [squad("r", "ranger", { x: 3, y: 7 }), enemy("g", "grunt", { x: 3, y: 0 })]))
    expect(new Mind(g).next()).toMatchObject({ type: "move", unit: "g" })
  })
  test("a Grunt moves to a tile with cover from the squad", () => {
    const g = aliens(
      setup(rows(["........", "........", "l.l.l.l."]), [
        squad("r", "ranger", { x: 3, y: 6 }),
        enemy("g", "grunt", { x: 3, y: 0 }),
      ]),
    )
    const a = new Mind(g).next()
    expect(a.type === "move" && cover(g.board, a.to, { x: 3, y: 6 })).toBeGreaterThan(0)
  })
  test("a Grunt facing a soldier behind cover moves to flank it", () => {
    const g = aliens(
      setup(rows(["........", "........", "........", "........", "...ll..."]), [
        squad("r", "ranger", { x: 3, y: 5 }),
        enemy("g", "grunt", { x: 5, y: 3 }),
      ]),
    )
    const a = new Mind(g).next()
    expect(a.type === "move" && cover(g.board, { x: 3, y: 5 }, a.to)).toBe(0)
  })
  test("a Brute next to a soldier claws it", () => {
    const g = aliens(setup(open(), [squad("v", "vanguard", { x: 3, y: 4 }), enemy("b", "brute", { x: 3, y: 3 })]))
    expect(new Mind(g).next()).toEqual({ type: "shoot", unit: "b", target: "v" })
  })
  test("a Bomber marks a blast on the squad in its turn", () => {
    let g = aliens(
      setup(open(), [
        squad("r", "ranger", { x: 3, y: 4 }),
        squad("c", "cleric", { x: 3, y: 5 }),
        enemy("m", "bomber", { x: 3, y: 1 }),
      ]),
    )
    for (let i = 0; i < 3 && g.phase === "enemy"; i++) g = g.apply(new Mind(g).next())
    expect(g.marks.map((m) => m.kind)).toEqual(["blast"])
  })
  test("a Commander with many allies roars before they act", () => {
    let g = aliens(
      setup(open(), [
        squad("r", "ranger", { x: 3, y: 7 }),
        enemy("g", "grunt", { x: 1, y: 0 }),
        enemy("h", "grunt", { x: 5, y: 0 }),
        enemy("i", "grunt", { x: 0, y: 1 }),
        enemy("j", "grunt", { x: 6, y: 1 }),
        enemy("k", "commander", { x: 3, y: 0 }),
      ]),
    )
    const done: string[] = []
    for (let a = new Mind(g).next(); a.type !== "endTurn" && a.unit === "k"; a = new Mind(g).next()) {
      done.push(a.type)
      g = g.apply(a)
    }
    expect(done).toContain("skill")
  })
  test("a side with nothing to do ends its turn", () => {
    const g = aliens(setup(open(), [squad("r", "ranger", { x: 3, y: 7 }), enemy("g", "grunt", { x: 3, y: 0 })]))
    g.unit("g").ap = 0
    expect(new Mind(g).next()).toEqual({ type: "endTurn" })
  })
  test("a Cleric heals a hurt ally next to it", () => {
    const g = setup(open(), [
      squad("c", "cleric", { x: 3, y: 7 }),
      squad("v", "vanguard", { x: 4, y: 7 }),
      enemy("g", "grunt", { x: 3, y: 0 }),
    ])
    g.unit("v").hp = 2
    let now = g
    const done: unknown[] = []
    for (let a = new Mind(now).next(); a.type !== "endTurn"; a = new Mind(now).next()) {
      done.push(a)
      now = now.apply(a)
    }
    expect(done).toContainEqual({ type: "skill", unit: "c", target: "v" })
  })
  test("a squad suppresses an alien first when its Vanguard can then hit it for a combo", () => {
    const g = setup(rows(["........", "........", "...l...."]), [
      squad("v", "vanguard", { x: 2, y: 3 }),
      squad("w", "warden", { x: 5, y: 5 }),
      enemy("g", "commander", { x: 3, y: 1 }),
    ])
    expect(new Mind(g).next()).toEqual({ type: "tactic", unit: "w", target: "g" })
  })
  test("a boxed-in soldier under fire with nothing to shoot hunkers down", () => {
    const g = setup(
      rows(["........", "........", "........", "........", "........", "..hlh...", "..h.h...", "..hhh..."]),
      [squad("c", "cleric", { x: 3, y: 6 }), enemy("g", "commander", { x: 3, y: 1 })],
    )
    g.unit("c").ap = 1
    expect(new Mind(g).next()).toEqual({ type: "hunker", unit: "c" })
  })
  test("a soldier an alien aims at moves where the aimed shot is less likely to hit", () => {
    const g = setup(rows(["........", "........", "........", "........", "........", "........", "...hhh.."]), [
      squad("c", "cleric", { x: 2, y: 6 }),
      enemy("g", "commander", { x: 3, y: 3 }),
    ])
    g.marks.push({ kind: "shot", unit: "g", target: "c", tiles: [{ x: 2, y: 6 }] })
    const damage = (x: typeof g) =>
      x.combat.canShoot(x.unit("g"), x.unit("c")) ? x.combat.hit(x.unit("g"), x.unit("c")).damage : 0
    const after = g.apply(new Mind(g).next())
    expect(damage(after)).toBeLessThan(damage(g))
  })
  test("a Blade with a ready ultimate uses it in its turn on the aliens next to it", () => {
    const g = setup(open(), [
      squad("b", "blade", { x: 3, y: 4 }),
      enemy("a", "grunt", { x: 3, y: 3 }),
      enemy("c", "grunt", { x: 4, y: 5 }),
      enemy("d", "grunt", { x: 2, y: 4 }),
    ])
    g.unit("b").charge = 2
    let now = g
    const done: unknown[] = []
    for (let a = new Mind(now).next(); a.type !== "endTurn"; a = new Mind(now).next()) {
      done.push(a)
      now = now.apply(a)
    }
    expect(done).toContainEqual({ type: "ultimate", unit: "b" })
  })
  test("a Pod neither moves nor attacks", () => {
    const g = aliens(setup(open(), [squad("r", "ranger", { x: 3, y: 2 }), enemy("p", "pod", { x: 3, y: 1 })]))
    expect(new Mind(g).next()).toEqual({ type: "endTurn" })
    expect(() => g.apply({ type: "move", unit: "p", to: { x: 3, y: 0 } })).toThrow()
  })
  test("a soldier stays out of the reach aliens get with one move", () => {
    const g = setup(rows(["........", "........", "........", "........", "...l.l.."]), [
      squad("c", "cleric", { x: 3, y: 7 }),
      enemy("g", "grunt", { x: 3, y: 0 }),
      enemy("h", "grunt", { x: 6, y: 0 }),
    ])
    g.unit("c").ap = 1
    const after = g.apply(new Mind(g).next())
    const c = after.unit("c")
    for (const f of after.foes(c))
      for (const q of [f.at, ...after.reach(f, 1).tiles()]) expect(after.combat.canShoot(f, c, q)).toBe(false)
  })
  test("a Sniper with a shot stays and aims instead of moving", () => {
    const g = aliens(setup(open(), [squad("r", "ranger", { x: 0, y: 7 }), enemy("s", "sniper", { x: 7, y: 0 })]))
    let next = g
    for (let i = 0; i < 3 && next.phase === "enemy"; i++) next = next.apply(new Mind(next).next())
    expect(next.unit("s").moved && next.marks.some((m) => m.unit === "s")).toBe(false)
  })
})
