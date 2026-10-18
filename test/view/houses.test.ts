import { Board } from "../../src/rules/board"
import { Houses } from "../../src/view/houses"

const town = Board.parse(["........", ".####...", ".#..+...", ".#..#...", ".####...", "........"])

describe("houses", () => {
  test("the floor inside walls is a room; open ground and walls are not", () => {
    const h = Houses.of(town)
    expect(h.room({ x: 2, y: 2 })).toBe(h.room({ x: 3, y: 3 }))
    expect(h.room({ x: 2, y: 2 })).not.toBeUndefined()
    expect(h.room({ x: 0, y: 0 })).toBeUndefined()
    expect(h.room({ x: 1, y: 1 })).toBeUndefined()
  })
  test("a room has a roof until a unit stands inside", () => {
    const h = Houses.of(town)
    expect(h.roofed({ x: 2, y: 2 }, [])).toBe(true)
    expect(h.roofed({ x: 2, y: 2 }, [{ x: 3, y: 3 }])).toBe(false)
    expect(h.roofed({ x: 2, y: 2 }, [{ x: 6, y: 3 }])).toBe(true)
  })
  test("the walls of an open room are open too", () => {
    const h = Houses.of(town)
    expect(h.open({ x: 1, y: 1 }, [{ x: 3, y: 3 }])).toBe(true)
    expect(h.open({ x: 1, y: 1 }, [])).toBe(false)
    expect(h.open({ x: 6, y: 1 }, [{ x: 3, y: 3 }])).toBe(false)
  })
  test("a gap in the wall keeps the room closed off from the ground outside", () => {
    const gap = Board.parse(["......", ".####.", ".#..#.", ".#....", ".####.", "......"])
    const h = Houses.of(gap)
    expect(h.room({ x: 2, y: 2 })).not.toBeUndefined()
    expect(h.room({ x: 0, y: 2 })).toBeUndefined()
  })
})
