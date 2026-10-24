import { Mind } from "../../src/aliens/mind"
import type { Game } from "../../src/mission/game"
import { enemy, setup, squad } from "../fixture"

const MAPS = [
  ["..h...l.", ".l...T..", "....r...", "..l...h.", ".T...l..", "...h....", ".l....l.", "........"],
  ["...#....", ".l..h...", "T.....l.", "..~~..T.", ".h....r.", "....l...", "..l..h..", "........"],
  ["..T..h..", "l....l..", "...bb...", ".h....T.", "..r..l..", "l.....h.", "...l....", "........"],
]
const SQUADS = [
  ["vanguard", "ranger", "warden"],
  ["ranger", "warden", "cleric"],
  ["vanguard", "cleric", "ranger"],
  ["warden", "vanguard", "cleric"],
] as const
const ALIENS = [
  ["grunt", "grunt", "brute", "bomber"],
  ["grunt", "brute", "grunt", "commander"],
  ["grunt", "bomber", "grunt", "brute"],
] as const

/** Both sides played by the mind until the mission ends. */
function game(seed: number): Game {
  const map = MAPS[seed % MAPS.length],
    kinds = SQUADS[seed % SQUADS.length],
    foes = ALIENS[seed % ALIENS.length]
  let g = setup(
    map,
    [
      ...kinds.map((k, i) => squad(`s${i}`, k, { x: 2 + i * 2, y: 7 })),
      ...foes.map((k, i) => enemy(`a${i}`, k, { x: 1 + i * 2, y: 0 })),
    ],
    seed,
  )
  for (let i = 0; i < 2000 && (g.phase === "squad" || g.phase === "enemy"); i++) g = g.apply(new Mind(g).next())
  return g
}

describe("bot games", () => {
  test("100 games end and the squad wins 40-70%", () => {
    const ends = Array.from({ length: 100 }, (_, s) => game(s + 1).phase)
    const won = ends.filter((p) => p === "won").length
    console.log(`squad won ${won} of 100`)
    expect(ends.every((p) => p === "won" || p === "lost")).toBe(true)
    expect(won).toBeGreaterThanOrEqual(40)
    expect(won).toBeLessThanOrEqual(70)
  }, 60000)
})
