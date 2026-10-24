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
  test("a Bomber marks a blast on the squad", () => {
    const g = aliens(
      setup(open(), [
        squad("r", "ranger", { x: 3, y: 4 }),
        squad("c", "cleric", { x: 3, y: 5 }),
        enemy("m", "bomber", { x: 3, y: 1 }),
      ]),
    )
    expect(new Mind(g).next()).toMatchObject({ type: "skill", unit: "m" })
  })
  test("a Commander with allies roars first", () => {
    const g = aliens(
      setup(open(), [
        squad("r", "ranger", { x: 3, y: 7 }),
        enemy("g", "grunt", { x: 1, y: 0 }),
        enemy("h", "grunt", { x: 5, y: 0 }),
        enemy("k", "commander", { x: 3, y: 0 }),
      ]),
    )
    expect(new Mind(g).next()).toEqual({ type: "skill", unit: "k" })
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
    expect(new Mind(g).next()).toEqual({ type: "skill", unit: "c", target: "v" })
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
  test("a soldier an alien aims at steps out of its sight", () => {
    const g = setup(rows(["........", "........", "........", "........", "........", "........", "...hhh.."]), [
      squad("c", "cleric", { x: 2, y: 6 }),
      enemy("g", "commander", { x: 3, y: 3 }),
    ])
    g.marks.push({ kind: "shot", unit: "g", target: "c", tiles: [{ x: 2, y: 6 }] })
    const after = g.apply(new Mind(g).next())
    expect(after.combat.canShoot(after.unit("g"), after.unit("c"))).toBe(false)
  })
  test("a Pod neither moves nor attacks", () => {
    const g = aliens(setup(open(), [squad("r", "ranger", { x: 3, y: 2 }), enemy("p", "pod", { x: 3, y: 1 })]))
    expect(new Mind(g).next()).toEqual({ type: "endTurn" })
    expect(() => g.apply({ type: "move", unit: "p", to: { x: 3, y: 0 } })).toThrow()
  })
})
