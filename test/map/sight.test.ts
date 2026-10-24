import { Board } from "../../src/map/board"
import { clear } from "../../src/map/sight"

const board = (rows: string[]) => Board.parse([...rows, ...Array(8 - rows.length).fill("........")])

describe("line of fire", () => {
  test("a rock in the middle blocks it", () => {
    expect(clear(board(["...h...."]), { x: 0, y: 0 }, { x: 6, y: 0 })).toBe(false)
  })
  test("sandbags and water do not block it", () => {
    expect(clear(board(["..l~...."]), { x: 0, y: 0 }, { x: 6, y: 0 })).toBe(true)
  })
  test("cover next to either end does not block it", () => {
    expect(clear(board([".h...h.."]), { x: 0, y: 0 }, { x: 6, y: 0 })).toBe(true)
  })
})
