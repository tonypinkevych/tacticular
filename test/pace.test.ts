import { decide } from "../src/ai/ai"
import { odds } from "../src/rules/combat"
import { coverAgainst } from "../src/rules/cover"
import { WEAPONS } from "../src/rules/data"
import { chance } from "../src/rules/dice"
import { slots, spent } from "../src/view/model"
import { enemy, open, setup, squad } from "./fixture"

describe("edge", () => {
  const rows = open(13, 13)
  rows[5] = "......:......"
  test("advantages add up: flanked and staggered give 2 steps of 3", () => {
    const r = squad("r", "warden", { x: 12, y: 6 })
    const e = enemy("e", "orc", { x: 6, y: 6 })
    e.statuses.push({ id: "staggered", rounds: 1 })
    const o = odds(setup(rows, [r, e]), r, e)
    expect(o.edge).toBe(2)
    expect(chance(0, 10, 2)).toBe(17 / 20)
  })
  test("one disadvantage cancels one advantage, not all", () => {
    const r = squad("r", "warden", { x: 12, y: 6 })
    const e = enemy("e", "orc", { x: 6, y: 6 })
    e.statuses.push({ id: "staggered", rounds: 1 })
    e.stance = "hunker"
    expect(odds(setup(rows, [r, e]), r, e).edge).toBe(1)
  })
})

describe("weapons and keys", () => {
  test("the sniper rifle has a magazine of 3", () => {
    expect(WEAPONS.longbow.ammo).toBe(3)
  })
  test("Overwatch is Y and Reload is R; other slots keep digits", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const g = setup(open(4, 4), [v])
    const s = slots(g, v)
    expect(s.find((x) => x.id === "overwatch")?.key).toBe("Y")
    expect(s.find((x) => x.id === "reload")?.key).toBe("R")
    expect(s[0].key).toBe("1")
    expect(s.find((x) => x.id === "hunker")?.key).toMatch(/^[0-9]$/)
  })
  test("the squad is spent when no soldier has AP", () => {
    const a = squad("a", "vanguard", { x: 0, y: 0 })
    const b = squad("b", "warden", { x: 1, y: 0 })
    const g = setup(open(4, 4), [a, b])
    a.ap = 0
    expect(spent(g)).toBe(false)
    b.ap = 0
    expect(spent(g)).toBe(true)
  })
})

describe("team AI", () => {
  test("an alien shoots the hurt soldier first", () => {
    const a = squad("a", "warden", { x: 0, y: 0 })
    const b = squad("b", "warden", { x: 0, y: 4 })
    a.concealed = false
    b.concealed = false
    b.hp = b.maxHp - 3
    const e = enemy("e", "orc", { x: 5, y: 2 })
    const g = setup(open(8, 5), [a, b, e])
    e.ap = 1
    expect(decide(g, e)).toMatchObject({ type: "attack", target: "b" })
  })
  test("an alien moves to a tile that flanks a soldier in cover", () => {
    const rows = open(11, 11)
    rows[4] = ".....:....."
    rows[5] = "..:........"
    const s = squad("s", "warden", { x: 5, y: 5 })
    s.concealed = false
    const e = enemy("e", "orc", { x: 1, y: 1 })
    const g = setup(rows, [s, e])
    e.ap = 2
    const a = decide(g, e)
    expect(a?.type).toBe("move")
    expect(coverAgainst(g, s.pos, (a as { to: { x: number; y: number } }).to)).toBe(0)
  })
  test("an engaged alien that knows no soldier hunts instead of overwatch", () => {
    const s = squad("s", "warden", { x: 0, y: 1 })
    const e = enemy("e", "orc", { x: 28, y: 1 })
    const g = setup(open(30, 3), [s, e])
    g.groups[0].target = { x: 28, y: 1 }
    e.ap = 2
    expect(decide(g, e)?.type).toBe("move")
  })
})
