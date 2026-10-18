import { Mind } from "../../src/ai/mind"
import { WEAPONS } from "../../src/rules/data"
import { chance } from "../../src/rules/dice"
import { slots, spent } from "../../src/view/model"
import { enemy, open, setup, squad } from "../fixture"

describe("edge", () => {
  const rows = open(13, 13)
  rows[5] = "......:......"
  test("advantages add up: flanked and staggered give 2 steps of 3", () => {
    const r = squad("r", "warden", { x: 12, y: 6 })
    const e = enemy("e", "orc", { x: 6, y: 6 })
    e.statuses.push({ id: "staggered", rounds: 1 })
    const o = setup(rows, [r, e]).combat.odds(r, e)
    expect(o.edge).toBe(2)
    expect(chance(0, 10, 2)).toBe(17 / 20)
  })
  test("one disadvantage cancels one advantage, not all", () => {
    const r = squad("r", "warden", { x: 12, y: 6 })
    const e = enemy("e", "orc", { x: 6, y: 6 })
    e.statuses.push({ id: "staggered", rounds: 1 })
    e.stance = "hunker"
    expect(setup(rows, [r, e]).combat.odds(r, e).edge).toBe(1)
  })
})

describe("weapons and keys", () => {
  test("the sniper rifle has a magazine of 3", () => {
    expect(WEAPONS.longbow.ammo).toBe(3)
  })
  test("weapon 1, skills Q W E, ultimate R, Reload T, Overwatch Y, Hunker U", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const g = setup(open(4, 4), [v])
    expect(slots(g, v).map((x) => `${x.id}=${x.key}`)).toEqual([
      "weapon:shotgun=1",
      "ability:shove=Q",
      "ability:charge=W",
      "ability:breach=E",
      "ability:rampage=R",
      "reload=T",
      "overwatch=Y",
      "hunker=U",
    ])
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
    expect(new Mind(g).decide(e)).toMatchObject({ type: "attack", target: "b" })
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
    const a = new Mind(g).decide(e)
    expect(a?.type).toBe("move")
    expect(g.cover.against(s.pos, (a as { to: { x: number; y: number } }).to)).toBe(0)
  })
  test("an engaged alien that knows no soldier hunts instead of overwatch", () => {
    const s = squad("s", "warden", { x: 0, y: 1 })
    const e = enemy("e", "orc", { x: 28, y: 1 })
    const g = setup(open(30, 3), [s, e])
    g.groups[0].target = { x: 28, y: 1 }
    e.ap = 2
    expect(new Mind(g).decide(e)?.type).toBe("move")
  })
})
