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
  test("a click on an alien in range shoots it", () => {
    const b = start()
    b.click({ x: 3, y: 1 })
    expect(b.game().unit("r").ap).toBe(0)
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
  test("an armed Grenade shows the tiles it reaches and the plus under the cursor", () => {
    const b = start()
    b.pick("w")
    b.toggleSkill()
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
})
