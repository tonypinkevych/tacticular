import { Board } from "../../src/map/board"
import { cover } from "../../src/map/cover"

const board = (rows: string[]) => Board.parse([...rows, ...Array(8 - rows.length).fill("........")])

describe("cover", () => {
  test("sandbags toward the shooter cut 1", () => {
    expect(cover(board(["........", "...l....", "...x...."]), { x: 3, y: 2 }, { x: 3, y: 7 })).toBe(0)
    expect(cover(board(["........", "...l....", "........"]), { x: 3, y: 2 }, { x: 3, y: 0 })).toBe(1)
  })
  test("a rock toward the shooter cuts 2", () => {
    expect(cover(board(["........", "...h...."]), { x: 3, y: 2 }, { x: 2, y: 0 })).toBe(2)
  })
  test("cover on another side does not count", () => {
    expect(cover(board(["........", "...h...."]), { x: 3, y: 2 }, { x: 7, y: 2 })).toBe(0)
  })
  test("a foe diagonal to the target beside its cover flanks it", () => {
    expect(cover(board(["........", "........", "....h..."]), { x: 3, y: 2 }, { x: 4, y: 1 })).toBe(0)
  })
  test("a forest under the target cuts 2", () => {
    expect(cover(board(["........", "........", "...T...."]), { x: 3, y: 2 }, { x: 7, y: 2 })).toBe(2)
  })
  test("a foe next to a target in a forest flanks it", () => {
    expect(cover(board(["........", "........", "...T...."]), { x: 3, y: 2 }, { x: 4, y: 3 })).toBe(0)
  })
})
