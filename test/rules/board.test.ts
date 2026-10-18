import { Board } from "../../src/rules/board"

describe("board", () => {
  test("a quarter turn turns the map clockwise", () => {
    const b = Board.parse(["#..", "..."])
    const turned = b.turn()
    expect([turned.width, turned.height]).toEqual([2, 3])
    expect(turned.at({ x: 1, y: 0 })).toBe("wall")
  })
  test("a point turns with the map", () => {
    const b = Board.parse(["#..", "..+"])
    const turned = b.turn()
    for (const p of [
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ])
      expect(turned.at(b.turned(p))).toBe(b.at(p))
  })
})
