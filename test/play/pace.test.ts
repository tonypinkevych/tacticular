import { Mind } from "../../src/aliens/mind"
import { WEAPONS } from "../../src/combat/weapons"
import { Kit } from "../../src/screen/hud/kit"
import { spent } from "../../src/screen/model"
import { enemy, open, setup, squad } from "../fixture"

describe("edge", () => {
  const rows = open(13, 13)
  rows[5] = "......:......"
  test("one disadvantage cancels one advantage, not all: two against one is still a sure hit", () => {
    const r = squad("r", "warden", { x: 12, y: 6 })
    const e = enemy("e", "orc", { x: 6, y: 6 }, "unaware")
    expect(setup(rows, [r, e]).combat.odds(r, e, { reaction: true }).sure).toBe(true)
  })
})

describe("weapons and keys", () => {
  test("the sniper rifle has a magazine of 3", () => {
    expect(WEAPONS.longbow.ammo).toBe(3)
  })
  test("weapon 1, skills 2 3, ultimate 4, Reload 5, Overwatch 6, Hunker 7", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const g = setup(open(4, 4), [v])
    expect(new Kit(g, v).slots().map((x) => `${x.id}=${x.key}`)).toEqual([
      "weapon:shotgun=1",
      "ability:shove=2",
      "ability:charge=3",
      "ability:rampage=4",
      "reload=5",
      "overwatch=6",
      "hunker=7",
    ])
  })
  test("R, Y and H press Reload, Overwatch and Hunker", () => {
    const v = squad("v", "vanguard", { x: 0, y: 0 })
    const kit = new Kit(setup(open(4, 4), [v]), v)
    expect(["R", "Y", "H", "6", "Q"].map((k) => kit.slotFor(k)?.id ?? null)).toEqual([
      "reload",
      "overwatch",
      "hunker",
      "overwatch",
      null,
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
    g.groups[0].landing = { x: 0, y: 1 }
    e.ap = 2
    expect(new Mind(g).decide(e)?.type).toBe("move")
  })
})
