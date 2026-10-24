import { Mind } from "../../src/aliens/mind"
import { mission } from "../../src/mission/mission"
import { outcome, type Reward, Run } from "../../src/run/run"

const ORDER = ["evac", "kill", "defend", "elite", "fortress"]

/** A whole run with the mind on both sides, picking missions and rewards as a careful player would. */
function play(seed: number): Run {
  const run = Run.start(seed)
  run.play({ type: "draft", picks: run.candidates.filter((_, i) => i !== seed % 4).map((c) => c.id) })
  for (let step = 0; step < 40 && run.stage !== "won" && run.stage !== "lost"; step++) {
    if (run.stage === "chart")
      run.play({
        type: "go",
        node: [...run.options()].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))[0].id,
        deploy: run.roster.slice(0, 3).map((s) => s.id),
      })
    else if (run.stage === "reward") {
      const rank = (r: Reward) =>
        r.kind === "recruit" && run.roster.length < 4
          ? 0
          : r.kind === "heal" && run.roster.some((x) => x.hp * 2 < x.max)
            ? 1
            : r.kind === "upgrade"
              ? 2
              : r.kind === "train"
                ? 3
                : 4
      run.play({ type: "take", pick: run.offers.indexOf([...run.offers].sort((a, b) => rank(a) - rank(b))[0]) })
    } else if (run.stage === "mission") {
      let g = mission(run.mission(), run.conditions())
      for (let i = 0; i < 3000 && (g.phase === "squad" || g.phase === "enemy"); i++) g = g.apply(new Mind(g).next())
      run.play({ type: "finish", result: outcome(g) })
    }
  }
  return run
}

describe("bot runs", () => {
  test("60 runs end and 20-40% are won", () => {
    const ends = Array.from({ length: 60 }, (_, s) => play(s + 1).stage)
    const won = ends.filter((x) => x === "won").length
    console.log(`runs won ${won} of 60`)
    expect(ends.every((x) => x === "won" || x === "lost")).toBe(true)
    expect(won).toBeGreaterThanOrEqual(12)
    expect(won).toBeLessThanOrEqual(24)
  }, 120000)
})
