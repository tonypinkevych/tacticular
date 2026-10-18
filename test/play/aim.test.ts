import { Match } from "../../src/mission/match"
import { enemy, find, open, setup, squad } from "../fixture"

describe("telegraphed shots", () => {
  test("after the alien phase, an alien that sees a soldier has aimed at one", () => {
    const g = setup(open(12, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
    find(g, "w").concealed = false
    find(g, "e").alert = "engaged"
    const after = new Match(g).play({ type: "endTurn" }).at(-1)!.game
    expect(after.phase).toBe("squad")
    expect(find(after, "e").intent).toEqual({ type: "shot", target: "w" })
  })
})
