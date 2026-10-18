import { key, pointOf } from "../../../src/map/point"
import { shape } from "../../../src/screen/board/shape"

const keys = (rows: string[]): Set<number> => {
  const out = new Set<number>()
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "#") out.add(key({ x, y }))
  })
  return out
}
const rows = (s: Set<number>, width: number, height: number): string[] =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (s.has(key({ x, y })) ? "#" : ".")).join(""),
  )

describe("shape", () => {
  test("a hole inside the area is filled", () => {
    const area = keys(["#####", "##.##", "#...#", "##.##", "#####"])
    expect(rows(shape(area), 5, 5)).toEqual(["#####", "#####", "#####", "#####", "#####"])
  })
  test("a notch one tile wide is filled", () => {
    const area = keys(["##.##", "#####"])
    expect(rows(shape(area), 5, 2)).toEqual(["#####", "#####"])
  })
  test("a bay two tiles wide stays open", () => {
    const area = keys(["#..##", "#####"])
    expect(rows(shape(area), 5, 2)).toEqual(["#..##", "#####"])
  })
  test("an area at the board corner keeps its tiles", () => {
    const area = keys(["##", "#."])
    expect([...shape(area)].map(pointOf)).toHaveLength(3)
  })
})
