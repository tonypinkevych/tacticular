import { odds } from "../src/rules/combat"
import { coverAgainst, flankers } from "../src/rules/cover"
import { enemy, open, setup, squad } from "./fixture"

const board = (rows: string[]) => setup(rows)

describe("flank geometry", () => {
  const rows = open(13, 13)
  rows[5] = "......:......"
  const t = { x: 6, y: 6 }
  const g = board(rows)
  test.each([
    ["straight ahead", { x: 6, y: 0 }, 2],
    ["slightly off", { x: 8, y: 0 }, 2],
    ["45 degrees", { x: 12, y: 0 }, 2],
    ["past 45 degrees", { x: 12, y: 3 }, 2],
    ["one row ahead, far to the side", { x: 0, y: 5 }, 2],
    ["side on", { x: 12, y: 6 }, 0],
    ["behind", { x: 6, y: 12 }, 0],
  ])("low cover north, attacker %s", (_, from, cover) => {
    expect(coverAgainst(g, t, from)).toBe(cover)
  })
  test("a corner with cover on two sides covers both directions", () => {
    const r = open(9, 9)
    r[3] = "....H...."
    r[4] = ".....:..."
    const c = board(r)
    expect(coverAgainst(c, { x: 4, y: 4 }, { x: 4, y: 0 })).toBe(5)
    expect(coverAgainst(c, { x: 4, y: 4 }, { x: 8, y: 4 })).toBe(2)
    expect(coverAgainst(c, { x: 4, y: 4 }, { x: 0, y: 4 })).toBe(0)
  })
})

describe("flank effects", () => {
  test("a flanked target gives advantage and loses its cover bonus", () => {
    const rows = open(13, 13)
    rows[5] = "......:......"
    const r = squad("r", "warden", { x: 12, y: 6 })
    const e = enemy("e", "orc", { x: 6, y: 6 })
    const o = odds(setup(rows, [r, e]), r, e)
    expect(o.advantages).toContain("flanked")
    expect(o.cover).toBe(0)
  })
  test("a covered target gives no flank", () => {
    const rows = open(13, 13)
    rows[5] = "......:......"
    const r = squad("r", "warden", { x: 6, y: 0 })
    const e = enemy("e", "orc", { x: 6, y: 6 })
    const o = odds(setup(rows, [r, e]), r, e)
    expect(o.advantages).not.toContain("flanked")
    expect(o.cover).toBe(2)
  })
  test("an enemy that cannot see a soldier does not flank it", () => {
    const rows = open(13, 5)
    rows[2] = "......#......"
    const s = squad("s", "warden", { x: 2, y: 2 })
    const e = enemy("e", "orc", { x: 10, y: 2 })
    const g = setup(rows, [s, e])
    expect(flankers(g, s, [e])).toEqual([])
  })
})
