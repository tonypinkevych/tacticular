import type { Game } from "../../src/mission/game"
import { enemy, setup, squad } from "../fixture"

const MAP = ["..h..l..", "........", ".l....T.", "...rr...", "........", "..l..h..", "........", "........"]

/** Every soldier shoots the first alien it can, every alien shoots back, until the mission ends. */
function play(seed: number): Game {
  let g = setup(
    MAP,
    [
      squad("r", "ranger", { x: 2, y: 6 }),
      squad("w", "warden", { x: 5, y: 6 }),
      enemy("a", "grunt", { x: 2, y: 1 }),
      enemy("b", "grunt", { x: 5, y: 1 }),
    ],
    seed,
  )
  for (let i = 0; i < 200 && g.phase !== "won" && g.phase !== "lost"; i++) {
    const side = g.phase === "squad" ? "squad" : "enemy"
    const actor = g.units.find(
      (u) => u.side === side && u.alive() && u.ap > 0 && g.foes(u).some((f) => g.combat.canShoot(u, f)),
    )
    if (!actor) {
      g = g.apply({ type: "endTurn" })
      continue
    }
    const target = g.foes(actor).find((f) => g.combat.canShoot(actor, f))!
    g = g.apply({ type: "shoot", unit: actor.id, target: target.id })
  }
  return g
}

describe("a duel", () => {
  test("ends", () => {
    expect(["won", "lost"]).toContain(play(7).phase)
  })
  test("one seed and one action log give the same game", () => {
    expect(play(11).log).toEqual(play(11).log)
  })
})
