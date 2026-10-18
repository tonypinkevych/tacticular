import { Mind } from "../../src/ai/mind"
import { enemy, open, setup, squad } from "../fixture"

describe("corners", () => {
  test("two units at one corner flank each other", () => {
    const g = setup([".....", ".H...", ".H...", "....."])
    const a = { x: 0, y: 2 }
    const b = { x: 1, y: 0 }
    expect(g.cover.against(b, a)).toBe(0)
    expect(g.cover.against(a, b)).toBe(0)
  })
  test("a shooter past the cover line still faces the cover", () => {
    const g = setup([".....", ".H...", ".H...", "....."])
    expect(g.cover.against({ x: 0, y: 2 }, { x: 4, y: 3 })).toBe(5)
  })
})

describe("roofs", () => {
  test("a roof wall gives high cover to a unit on the ground, not to a unit on the roof", () => {
    const g = setup(["......", ".RRR..", ".RRR..", "......"])
    expect(g.cover.against({ x: 4, y: 1 }, { x: 0, y: 1 })).toBe(5)
    expect(g.cover.covered({ x: 4, y: 1 })).toBe(true)
    expect(g.cover.covered({ x: 2, y: 1 })).toBe(false)
  })
  test("a roof blocks sight between ground tiles; a unit on the roof sees over it", () => {
    const g = setup(["......", ".RRR..", ".RRR..", "......"])
    expect(g.sight.line({ x: 0, y: 1 }, { x: 5, y: 2 })).toBe(false)
    expect(g.sight.line({ x: 1, y: 1 }, { x: 5, y: 2 })).toBe(true)
  })
})

describe("advance", () => {
  test("an alien whose side sees a soldier out of its reach walks toward it", () => {
    const s = squad("s", "warden", { x: 0, y: 1 })
    s.concealed = false
    const e = enemy("e", "orc", { x: 28, y: 1 })
    const g = setup(open(30, 3), [s, e, enemy("o", "orc", { x: 5, y: 1 })])
    e.ap = 2
    const a = new Mind(g).decide(e)
    expect(a?.type).toBe("move")
    expect((a as { to: { x: number } }).to.x).toBeLessThan(28)
  })
})
