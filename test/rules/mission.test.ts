import type { Biome } from "../../src/rules/board"
import { PROFILES } from "../../src/rules/data"
import { Dice } from "../../src/rules/dice"
import { mission } from "../../src/rules/mission"
import { key } from "../../src/rules/point"
import { map } from "../../src/rules/terrain"
import { walkable } from "../../src/rules/tile"

describe("mission", () => {
  const seeds = Array.from({ length: 100 }, (_, i) => i + 1)
  test("every walkable tile and door is reachable from the squad", () => {
    for (const seed of seeds) {
      const g = mission(seed)
      const { width, height, tiles } = g.board
      const open = (i: number) => walkable(tiles[i]) || tiles[i] === "door"
      const start = g.units[0].pos.y * width + g.units[0].pos.x
      const seen = new Set([start])
      const queue = [start]
      while (queue.length) {
        const i = queue.pop()!
        const x = i % width
        for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
          if (n < 0 || n >= width * height || seen.has(n) || !open(n)) continue
          seen.add(n)
          queue.push(n)
        }
      }
      tiles.forEach((_, i) => {
        if (open(i) && !seen.has(i))
          throw new Error(`seed ${seed}: tile ${i % width},${Math.floor(i / width)} unreachable`)
      })
    }
  })
  test("the squad has 3 distinct classes within the random spread", () => {
    for (const seed of seeds) {
      const squad = mission(seed).units.filter((u) => u.side === "squad")
      expect(new Set(squad.map((u) => u.kind)).size).toBe(3)
      for (const u of squad) {
        expect(Math.abs(u.maxHp - PROFILES[u.kind].hp)).toBeLessThanOrEqual(2)
        expect(Math.abs(u.aim - PROFILES[u.kind].aim)).toBeLessThanOrEqual(1)
        expect(Math.abs(u.will - PROFILES[u.kind].will)).toBeLessThanOrEqual(1)
      }
    }
  })
  test("a Warchief in groups of 3; at most one special", () => {
    for (const seed of seeds) {
      const g = mission(seed)
      for (const group of g.groups) {
        const kinds = g.units.filter((u) => u.group === group.id).map((u) => u.kind)
        if (kinds.length >= 3) expect(kinds).toContain("warchief")
        expect(kinds.filter((k) => ["ogre", "assassin", "whisperer"].includes(k)).length).toBeLessThanOrEqual(1)
      }
    }
  })
  test("every group has a route of 3 points and knows where the squad landed", () => {
    for (const seed of seeds) {
      const g = mission(seed)
      for (const group of g.groups) {
        expect(group.landing, `seed ${seed}`).toEqual(g.units[0].pos)
        for (const u of g.units.filter((x) => x.group === group.id)) expect(u.patrol.length, `seed ${seed}`).toBe(3)
      }
    }
  })
  test("every enemy can walk to the squad", () => {
    for (const seed of seeds) {
      const g = mission(seed)
      const free = g.clone()
      free.units = []
      for (const e of g.units.filter((u) => u.side === "enemy")) {
        const r = free.reach(e, 10_000)
        expect(r.cost.has(key(g.units[0].pos)), `seed ${seed}: ${e.id}`).toBe(true)
      }
    }
  })
  test("the same seed builds the same mission", () => {
    expect(mission(7)).toEqual(mission(7))
  })
})

describe("maps for each mission", () => {
  const games = Array.from({ length: 100 }, (_, i) => mission(i + 1))
  const walled = (g: ReturnType<typeof mission>, p: { x: number; y: number }) =>
    [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].every((d) => {
      for (let i = 1; i <= 5; i++) {
        const t = g.tile({ x: p.x + d.x * i, y: p.y + d.y * i })
        if (t === "wall" || t === "door") return true
      }
      return false
    })
  test("in Kill all, a Warchief starts inside a walled yard", () => {
    const kills = games.filter((g) => g.goal.kind === "kill")
    expect(kills.length).toBeGreaterThan(10)
    for (const g of kills) {
      const chief = g.units.find((u) => u.kind === "warchief")
      expect(chief, `seed ${g.seed}`).toBeDefined()
      expect(walled(g, chief!.pos), `seed ${g.seed}`).toBe(true)
    }
  })
  test("some maps have a landing pad for reinforcements, most do not", () => {
    const pads = games.filter((g) => g.pad)
    expect(pads.length).toBeGreaterThan(15)
    expect(pads.length).toBeLessThan(55)
    for (const g of pads) expect(g.tile(g.pad!), `seed ${g.seed}`).toBe("floor")
  })
  test("in Defend, the beacon stands on a ridge", () => {
    const holds = games.filter((g) => g.goal.kind === "defend")
    expect(holds.length).toBeGreaterThan(10)
    for (const g of holds) if (g.goal.kind === "defend") expect(g.tile(g.goal.at), `seed ${g.seed}`).toBe("ridge")
  })
  test("in Defend, every alien group starts engaged with the beacon as its target", () => {
    for (const g of games) {
      const goal = g.goal
      if (goal.kind !== "defend") continue
      for (const u of g.units.filter((x) => x.side === "enemy")) expect(u.alert, `seed ${g.seed}`).toBe("engaged")
      for (const group of g.groups) expect(group.target, `seed ${g.seed}`).toEqual(goal.at)
    }
  })
})

describe("biomes", () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i + 1)
  const count = (tiles: string[], t: string) => tiles.filter((x) => x === t).length
  test("missions come in forest, village and town", () => {
    const biomes = new Set(seeds.map((s) => mission(s).board.biome))
    expect([...biomes].sort()).toEqual(["forest", "town", "village"])
  })
  test("a forest has more trees than a town, and a town has more walls", () => {
    const by = (b: Biome) => seeds.map((s) => map(new Dice({ rng: s }), b))
    const avg = (b: Biome, t: string) => by(b).reduce((n, m) => n + count(m.tiles, t), 0) / seeds.length
    expect(avg("forest", "tree")).toBeGreaterThan(avg("town", "tree"))
    expect(avg("town", "wall")).toBeGreaterThan(avg("forest", "wall"))
    expect(avg("village", "wall")).toBeGreaterThan(avg("forest", "wall"))
  })
})
