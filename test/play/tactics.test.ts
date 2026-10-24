import { Mind } from "../../src/aliens/mind"
import { distance } from "../../src/map/point"
import type { Game } from "../../src/mission/game"
import { type GoalKind, mission } from "../../src/mission/mission"
import type { Action } from "../../src/mission/orders"
import type { ClassId } from "../../src/units/profiles"

const CLASSES: ClassId[] = ["vanguard", "ranger", "warden", "cleric"]

/** The squad of a greedy player: shoot the likeliest hit from here, else walk one move straight at the aliens. */
function greedy(g: Game): Action {
  for (const u of g.units.filter((x) => x.side === "squad" && x.alive() && x.ap > 0)) {
    const shots = g.foes(u).filter((f) => g.combat.canShoot(u, f))
    if (shots.length) {
      const t = shots.sort((a, b) => g.combat.odds(u, b).chance - g.combat.odds(u, a).chance)[0]
      return { type: "shoot", unit: u.id, target: t.id }
    }
    const near = (p: { x: number; y: number }) => Math.min(...g.foes(u).map((f) => distance(f.at, p)))
    const to = g
      .reach(u, 1)
      .tiles()
      .sort((a, b) => near(a) - near(b))[0]
    if (to && near(to) < near(u.at)) return { type: "move", unit: u.id, to }
  }
  return { type: "endTurn" }
}

/** A mission played to its end, the squad by a policy and the aliens by the mind. */
function play(seed: number, goal: GoalKind, squad: (g: Game) => Action): Game {
  const kinds = CLASSES.filter((_, i) => i !== seed % 4)
  let g = mission(seed, { goal, squad: kinds.map((kind, i) => ({ id: `s${i}`, kind })) })
  for (let i = 0; i < 3000 && (g.phase === "squad" || g.phase === "enemy"); i++)
    g = g.apply(g.phase === "squad" ? squad(g) : new Mind(g).next())
  return g
}

const wins = (squad: (g: Game) => Action) =>
  Array.from({ length: 100 }, (_, s) => play(s + 1, "kill", squad).phase).filter((p) => p === "won").length

describe("tactics", () => {
  test("a careful squad wins Kill all clearly more often than a greedy one", () => {
    const careful = wins((g) => new Mind(g).next()),
      rush = wins(greedy)
    console.log(`kill: careful ${careful}, greedy ${rush} of 100`)
    expect(rush).toBeLessThanOrEqual(35)
    expect(careful - rush).toBeGreaterThanOrEqual(40)
  }, 120000)
})
