import type { Frame } from "../../src/match"
import type { Action } from "../../src/rules/types"
import { cues } from "../../src/view/cues"
import { enemy, open, setup, squad } from "../fixture"

describe("cues", () => {
  const g = setup(open(8, 3), [squad("w", "vanguard", { x: 0, y: 1 }), enemy("e", "orc", { x: 5, y: 1 })])
  const frame = (action: Action, change: (after: typeof g) => void = () => {}): Frame => {
    const after = g.clone()
    change(after)
    return { action, game: after }
  }

  test("a shot sounds its weapon first, then its result", () => {
    const f = frame({ type: "attack", unit: "w", target: "e" }, (a) =>
      a.log.push({ key: "log.hit", params: { unit: "w", target: "e", dmg: 3 } }),
    )
    expect(cues(g, f)).toEqual({ start: ["shotgun"], end: ["hit"] })
  })
  test("a hit on a soldier sounds as hurt, a death as death", () => {
    const f = frame({ type: "attack", unit: "e", target: "w" }, (a) => {
      a.log.push({ key: "log.hit", params: { unit: "e", target: "w", dmg: 3 } })
      a.log.push({ key: "log.dies", params: { unit: "w" } })
    })
    expect(cues(g, f).end).toEqual(["hurt", "death"])
  })
  test("a walk sounds steps", () => {
    expect(cues(g, frame({ type: "move", unit: "w", to: { x: 1, y: 1 } })).start).toEqual(["step"])
  })
  test("the end of the squad turn sounds the alien activity", () => {
    expect(
      cues(
        g,
        frame({ type: "endTurn" }, (a) => (a.phase = "enemy")),
      ).start,
    ).toEqual(["activity"])
  })
  test("a step heard from an unseen alien sounds as heard", () => {
    const f = frame({ type: "move", unit: "e", to: { x: 6, y: 1 } }, (a) =>
      a.noises.push({ at: { x: 6, y: 1 }, radius: 0, round: 1 }),
    )
    expect(cues(g, f).end).toContain("heard")
  })
  test("a spotted soldier sounds the alarm", () => {
    const f = frame({ type: "move", unit: "w", to: { x: 1, y: 1 } }, (a) =>
      a.log.push({ key: "log.detected", params: { unit: "w", by: "e" } }),
    )
    expect(cues(g, f).end).toEqual(["spotted"])
  })
})
