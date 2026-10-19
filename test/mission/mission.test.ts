import { Dice } from "../../src/combat/dice"
import type { Biome } from "../../src/map/board"
import { distance, key, type Point } from "../../src/map/point"
import { map } from "../../src/map/terrain"
import { walkable } from "../../src/map/tile"
import { mission } from "../../src/mission/mission"
import { PROFILES } from "../../src/units/profiles"

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
  test("every group holds at least 2 aliens", () => {
    for (const seed of seeds) {
      const g = mission(seed, { size: 2 })
      for (const group of g.groups) expect(g.units.filter((u) => u.group === group.id).length).toBeGreaterThanOrEqual(2)
    }
  })
  test("one group starts on the way, nearer the squad than the objective", () => {
    for (const seed of seeds) {
      const g = mission(seed, { goal: "intel" })
      const from = g.units[0].pos
      const near = Math.min(...g.units.filter((u) => u.side === "enemy").map((u) => distance(u.pos, from)))
      expect(near, `seed ${seed}`).toBeLessThanOrEqual(distance((g.goal as { at: Point }).at, from) - 2)
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
  }, 15_000)
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
  test("in a Warchief mission, a Warchief starts inside a walled yard", () => {
    const kills = games.filter((g) => g.goal.kind === "warchief")
    expect(kills.length).toBeGreaterThan(10)
    for (const g of kills) {
      const chief = g.units.find((u) => u.kind === "warchief")
      expect(chief, `seed ${g.seed}`).toBeDefined()
      expect(walled(g, chief!.pos), `seed ${g.seed}`).toBe(true)
    }
  })
  test("a Warchief mission has an evac zone far from the squad", () => {
    for (const g of games.filter((x) => x.goal.kind === "warchief")) {
      const tiles = "tiles" in g.goal ? g.goal.tiles : []
      expect(tiles.length, `seed ${g.seed}`).toBeGreaterThan(0)
      const lead = g.units.find((u) => u.side === "squad")!.pos
      for (const p of tiles) expect(distance(lead, p), `seed ${g.seed}`).toBeGreaterThan(g.board.width / 2)
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

describe("objective missions", () => {
  const goals = (goal: "intel" | "vip" | "relay") => Array.from({ length: 30 }, (_, i) => mission(i + 1, { goal }))
  test("Intel and Relay put the objective inside a ring of low cover, and both have an evac zone", () => {
    for (const g of [...goals("intel"), ...goals("relay")]) {
      const goal = g.goal
      if (goal.kind !== "intel" && goal.kind !== "relay") throw new Error(goal.kind)
      expect(g.tile(goal.at), `seed ${g.seed}`).toBe("floor")
      const ring = [-2, -1, 0, 1, 2].flatMap((d) => [
        { x: goal.at.x + d, y: goal.at.y - 2 },
        { x: goal.at.x + d, y: goal.at.y + 2 },
      ])
      expect(ring.filter((p) => g.tile(p) === "low").length, `seed ${g.seed}`).toBeGreaterThan(4)
      expect(goal.tiles.length, `seed ${g.seed}`).toBeGreaterThan(0)
    }
  })
  test("VIP puts a captive soldier of a class not in the squad inside a walled yard", () => {
    for (const g of goals("vip")) {
      const goal = g.goal
      if (goal.kind !== "vip") throw new Error(goal.kind)
      const c = g.unit(goal.captive)
      expect(c.has("captive")).toBe(true)
      expect(c.side).toBe("squad")
      const others = g.units.filter((u) => u.side === "squad" && u !== c).map((u) => u.kind)
      expect(others).not.toContain(c.kind)
      expect(goal.tiles.length).toBeGreaterThan(0)
    }
  })
  test("the run can name the captive", () => {
    const recruit = { id: "v1", kind: "engineer" as const, name: "Kane", spread: { hp: 0, aim: 0, will: 0 }, hp: 8 }
    const g = mission(3, { goal: "vip", captive: recruit })
    expect(g.unit("v1").name).toBe("Kane")
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

describe("conditions", () => {
  const recruit = { id: "s1", kind: "mage" as const, name: "Voss", spread: { hp: 1, aim: 0, will: 0 }, hp: 3 }
  test("set the goal, the squad, the alien groups and their size, and the pad", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = mission(seed, { goal: "defend", squad: [recruit], groups: 2, size: 1, pad: true })
      expect(g.goal.kind).toBe("defend")
      expect(g.groups).toHaveLength(2)
      for (const group of g.groups) expect(g.units.filter((u) => u.group === group.id)).toHaveLength(1)
      expect(g.pad).not.toBeNull()
      const squad = g.units.filter((u) => u.side === "squad")
      expect(squad.map((u) => [u.id, u.kind, u.name, u.hp, u.maxHp])).toEqual([
        ["s1", "mage", "Voss", 3, PROFILES.mage.hp + 1],
      ])
    }
  })
  test("place a squad of 4 on distinct floor tiles", () => {
    const four = ["s1", "s2", "s3", "s4"].map((id) => ({ ...recruit, id }))
    for (let seed = 1; seed <= 20; seed++) {
      const g = mission(seed, { squad: four })
      const spots = g.units.filter((u) => u.side === "squad").map((u) => u.pos)
      for (const p of spots) expect(["floor", "bridge"]).toContain(g.board.at(p))
      expect(new Set(spots.map((p) => `${p.x},${p.y}`)).size).toBe(4)
    }
  })
  test("set where the alarm starts", () => {
    expect(mission(1, { alarm: 3 }).alarm).toBe(3)
  })
  test("set the biome", () => {
    for (let s = 1; s <= 10; s++) expect(mission(s, { biome: "town" }).board.biome).toBe("town")
  })
  test("a scouted mission starts with a heard noise on each alien group", () => {
    const g = mission(1, { scouted: true })
    for (const group of g.groups) {
      const lead = g.units.find((u) => u.group === group.id)!
      expect(g.noises).toContainEqual({ at: lead.pos, radius: 0, round: 1 })
    }
  })
  test("no conditions give the same mission as before", () => {
    expect(mission(5, {}).units.map((u) => u.pos)).toEqual(mission(5).units.map((u) => u.pos))
  })
})

describe("force level", () => {
  const aliens = (force: number) =>
    Array.from({ length: 30 }, (_, i) => mission(i + 1, { force, groups: 4, size: 3 }))
      .flatMap((g) => g.units)
      .filter((u) => u.side === "enemy")
  test("Brutes come from Force Level 2, Stalkers from 3, Psions from 4", () => {
    expect(new Set(aliens(1).map((u) => u.kind))).not.toContain("ogre")
    expect(new Set(aliens(2).map((u) => u.kind))).toContain("ogre")
    expect(new Set(aliens(2).map((u) => u.kind))).not.toContain("assassin")
    expect(new Set(aliens(3).map((u) => u.kind))).not.toContain("whisperer")
    expect(new Set(aliens(4).map((u) => u.kind))).toContain("whisperer")
  })
  test("alien skills rank up at Force Level 4 and 7, and each 3 levels add 1 HP", () => {
    const at = (force: number) => aliens(force).find((u) => u.kind === "warchief")!
    expect([1, 4, 7].map((f) => at(f).rank("warcry"))).toEqual([1, 2, 3])
    expect([1, 4, 7, 10].map((f) => at(f).maxHp - PROFILES.warchief.hp)).toEqual([0, 1, 2, 3])
  })
})
