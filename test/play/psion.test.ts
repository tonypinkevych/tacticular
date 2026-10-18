import { Mind } from "../../src/aliens/mind"
import { enemy, find, open, setup, squad } from "../fixture"

const scene = () => {
  const s = squad("s", "warden", { x: 0, y: 1 })
  s.concealed = false
  const w = enemy("w", "whisperer", { x: 5, y: 1 })
  w.cooldowns.dread = 3
  w.cooldowns.ward = 3
  const g = setup(open(8, 3), [s, w])
  g.phase = "enemy"
  find(g, "w").ap = 2
  return g
}

describe("Psion telegraph", () => {
  test("a Psion first marks the soldier it will Dominate", () => {
    const g = scene()
    find(g, "w").ap = 1
    const a = new Mind(g).decide(find(g, "w"))
    expect(a).toMatchObject({ type: "ability", ability: "mark", target: "s" })
    expect(find(g.apply(a!), "w").intent).toEqual({ type: "psi", target: "s" })
  })
  test("on its next turn it Dominates the marked soldier when it still sees it", () => {
    const g = scene()
    find(g, "w").intent = { type: "psi", target: "s" }
    expect(new Mind(g).decide(find(g, "w"))).toMatchObject({ type: "ability", ability: "dominate", target: "s" })
  })
  test("a marked soldier out of its sight is safe", () => {
    const g = scene()
    g.board.tiles[1 * 8 + 2] = "wall"
    g.board.tiles[0 * 8 + 2] = "wall"
    g.board.tiles[2 * 8 + 2] = "wall"
    find(g, "w").intent = { type: "psi", target: "s" }
    const a = new Mind(g).decide(find(g, "w"))
    expect(a?.type === "ability" && a.ability === "dominate").toBe(false)
  })
})
