import { Board } from "../../src/map/board"

describe("board", () => {
  test("reads tiles from text rows", () => {
    const b = Board.parse([".=Tr~fl#", "tchcb...", ...Array(6).fill("........")])
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((x) => b.at({ x, y: 0 }))).toEqual([
      "grass",
      "road",
      "forest",
      "rubble",
      "water",
      "fire",
      "bags",
      "house",
    ])
    expect([0, 1, 2, 3, 4].map((x) => b.at({ x, y: 1 }))).toEqual(["torn", "cracked", "rock", "cracked", "barrel"])
  })
  test("outside the board is a building", () => {
    expect(Board.parse(Array(8).fill("........")).at({ x: -1, y: 0 })).toBe("house")
  })
  test("a blast tears sandbags, then leaves rubble", () => {
    const b = Board.parse(["l.......", ...Array(7).fill("........")])
    b.break({ x: 0, y: 0 })
    expect(b.at({ x: 0, y: 0 })).toBe("torn")
    b.break({ x: 0, y: 0 })
    expect(b.at({ x: 0, y: 0 })).toBe("rubble")
  })
  test("a blast cracks a rock, then leaves rubble", () => {
    const b = Board.parse(["h.......", ...Array(7).fill("........")])
    b.break({ x: 0, y: 0 })
    expect(b.at({ x: 0, y: 0 })).toBe("cracked")
    b.break({ x: 0, y: 0 })
    expect(b.at({ x: 0, y: 0 })).toBe("rubble")
  })
  test("a blast sets a forest on fire and leaves a building whole", () => {
    const b = Board.parse(["T#......", ...Array(7).fill("........")])
    b.break({ x: 0, y: 0 })
    b.break({ x: 1, y: 0 })
    expect([b.at({ x: 0, y: 0 }), b.at({ x: 1, y: 0 })]).toEqual(["fire", "house"])
  })
})
