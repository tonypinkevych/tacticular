import { Battle } from "../../src/screen/battle"
import { enemy, open, setup, squad } from "../fixture"

const start = () => {
  const b = new Battle(
    setup(open(), [
      squad("r", "ranger", { x: 3, y: 6 }),
      squad("w", "warden", { x: 5, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ]),
  )
  b.begin(0)
  return b
}

describe("battle", () => {
  test("the first soldier is selected", () => {
    expect(start().selected()).toBe("r")
  })
  test("a click on a tile in reach moves the selected soldier", () => {
    const b = start()
    b.click({ x: 3, y: 5 })
    expect(b.game().unit("r").at).toEqual({ x: 3, y: 5 })
  })
  test("a click on an alien aims at it, and a second click shoots it", () => {
    const b = start()
    b.click({ x: 3, y: 1 })
    expect([b.mode(), b.planned(), b.game().unit("r").ap]).toEqual(["shoot", { x: 3, y: 1 }, 2])
    b.click({ x: 3, y: 1 })
    expect(b.game().unit("r").ap).toBe(0)
  })
  test("in Shoot a click on a target that is not aimed fires at once", () => {
    const b = new Battle(
      setup(open(), [
        squad("r", "ranger", { x: 3, y: 6 }),
        squad("w", "warden", { x: 5, y: 6 }),
        enemy("g", "grunt", { x: 3, y: 1 }),
        enemy("h", "grunt", { x: 6, y: 1 }),
      ]),
    )
    b.begin(0)
    b.choose("shoot")
    b.click({ x: 6, y: 1 })
    expect(b.game().unit("r").ap).toBe(0)
  })
  test("Shoot picked again fires at the aimed target", () => {
    const b = start()
    b.choose("shoot")
    b.choose("shoot")
    expect(b.game().unit("r").ap).toBe(0)
  })
  test("the skill picked again uses it on the aimed target", () => {
    const b = start()
    b.choose("skill")
    expect(b.planned()).toEqual({ x: 3, y: 1 })
    b.choose("skill")
    expect(b.game().unit("r").ap).toBe(0)
  })
  test("the route to the tile under the cursor marks fire and the overwatch that fires on it", () => {
    const g = setup(
      ["........", "........", "........", "........", "........", "..lfl...", "........", "........"],
      [squad("v", "vanguard", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 0 })],
    )
    g.unit("g").overwatch = true
    const b = new Battle(g)
    b.begin(0)
    b.point({ x: 3, y: 4 })
    expect(b.route()).toEqual({
      path: [
        { x: 3, y: 5 },
        { x: 3, y: 4 },
      ],
      perils: [
        { at: { x: 3, y: 5 }, kind: "fire" },
        { at: { x: 3, y: 4 }, kind: "watch" },
      ],
    })
  })
  test("the cursor on an alien shows the tiles it walks to and the tiles it can shoot", () => {
    const b = start()
    b.point({ x: 3, y: 1 })
    const z = b.zones()
    expect(z.foeMove).toHaveLength(19)
    expect(z.foeShot.some((p) => p.x === 3 && p.y === 6)).toBe(true)
    expect(z.foeShot.some((p) => p.x === 3 && p.y === 7)).toBe(false)
  })
  test("a click on another soldier selects it", () => {
    const b = start()
    b.click({ x: 5, y: 6 })
    expect(b.selected()).toBe("w")
  })
  test("a refused click shows the reason", () => {
    const b = start()
    b.click({ x: 0, y: 0 })
    expect(b.notice()).toBe("unreachable")
  })
  test("the zones show the move, the dash and the targets", () => {
    const z = start().zones()
    expect([z.move.length, z.dash.length, z.targets]).toEqual([8, 10, [{ x: 3, y: 1 }]])
  })
  test("the chosen Grenade shows the tiles it reaches and the plus under the cursor", () => {
    const b = start()
    b.pick("w")
    b.choose("skill")
    b.point({ x: 5, y: 3 })
    const z = b.zones()
    expect(z.reach.every((p) => Math.max(Math.abs(p.x - 5), Math.abs(p.y - 6)) <= 4)).toBe(true)
    expect(z.area).toHaveLength(5)
  })
  test("the odds show for the alien under the cursor", () => {
    const b = start()
    b.point({ x: 3, y: 1 })
    expect(b.odds()?.odds.chance).toBe(95)
  })
  test("Shoot aims at the first target, and Confirm fires", () => {
    const b = start()
    b.choose("shoot")
    expect(b.planned()).toEqual({ x: 3, y: 1 })
    expect(b.game().unit("r").ap).toBe(2)
    b.confirm()
    expect(b.game().unit("r").ap).toBe(0)
  })
  test("Tab in Shoot moves the aim to the next target", () => {
    const g = setup(open(), [
      squad("r", "ranger", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
      enemy("h", "grunt", { x: 6, y: 1 }),
    ])
    const b = new Battle(g)
    b.begin(0)
    b.choose("shoot")
    const first = b.planned()
    b.tab()
    expect(b.planned()).not.toEqual(first)
  })
  test("Overwatch waits for a confirm", () => {
    const b = start()
    b.choose("overwatch")
    expect(b.game().unit("r").overwatch).toBe(false)
    b.choose("overwatch")
    expect(b.game().unit("r").overwatch).toBe(true)
  })
  test("the cursor on a barrel shows its blast, and the blast of the barrel next to it", () => {
    const b = new Battle(
      setup(
        ["........", "........", "...bb...", "........", "........", "........", "........", "........"],
        [squad("r", "ranger", { x: 3, y: 6 }), squad("w", "warden", { x: 5, y: 6 })],
      ),
    )
    b.begin(0)
    b.point({ x: 3, y: 2 })
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`
    expect(b.zones().area.map(key).sort()).toEqual(["3,2", "4,2", "2,2", "5,2", "3,1", "3,3", "4,1", "4,3"].sort())
  })
  test("an aimed barrel keeps its blast shown when the cursor leaves it", () => {
    const b = new Battle(
      setup(
        ["........", "........", "...b....", "........", "........", "........", "........", "........"],
        [squad("r", "ranger", { x: 3, y: 6 }), squad("w", "warden", { x: 5, y: 6 })],
      ),
    )
    b.begin(0)
    b.click({ x: 3, y: 2 })
    b.point({ x: 0, y: 7 })
    expect([b.mode(), b.zones().area.length]).toEqual(["shoot", 5])
  })
  test("a lost mission says why: the aliens took the beacon, or the squad died", () => {
    const g = setup(open(), [squad("r", "ranger", { x: 3, y: 6 }), enemy("g", "grunt", { x: 3, y: 1 })])
    g.phase = "lost"
    expect(new Battle(g).loss()).toBe("squad")
    g.goal = { kind: "defend", at: { x: 3, y: 3 }, rounds: 5, strikes: 2 }
    expect(new Battle(g).loss()).toBe("beacon")
  })
})
