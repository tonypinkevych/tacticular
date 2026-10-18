import type { Game } from "../../src/rules/game"
import { mission } from "../../src/rules/mission"
import { AROUND, distance, key, type Point, pointOf } from "../../src/rules/point"
import { coverOf, passable } from "../../src/rules/tile"

const ORTHO = AROUND.slice(0, 4)

/** The edge strip a point stands nearest to: the tiles within 3 of that edge. */
function strip(g: Game, p: Point): Point[] {
  const { width: w, height: h } = g.board
  const e = edge(g, p)
  const out: Point[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const near = [x <= 3, x >= w - 4, y <= 3, y >= h - 4][e]
      if (near && passable(g.board.at({ x, y }))) out.push({ x, y })
    }
  return out
}

function edge(g: Game, p: Point): number {
  const d = [p.x, g.board.width - 1 - p.x, p.y, g.board.height - 1 - p.y]
  return d.indexOf(Math.min(...d))
}

function opposite(g: Game, p: Point): Point {
  return { x: g.board.width - 1 - p.x, y: g.board.height - 1 - p.y }
}

/** Vertex-disjoint walking routes from the squad's edge to the far edge, at most cap. */
function routes(g: Game, cap = 12): number {
  const { width: w, height: h } = g.board
  const n = w * h
  const start = g.units.find((u) => u.side === "squad")!.pos
  const src = new Set(strip(g, start).map(key))
  const dst = new Set(strip(g, opposite(g, start)).map(key))
  const idx = (p: Point) => p.y * w + p.x
  const edge = (a: number, b: number) => `${a},${b}`
  const flow = new Map<string, number>()
  const nodesIn = (i: number) => i * 2
  const nodesOut = (i: number) => i * 2 + 1
  const S = n * 2
  const T = n * 2 + 1
  const adj = new Map<number, number[]>()
  const capacity = new Map<string, number>()
  const add = (a: number, b: number, c: number) => {
    adj.set(a, [...(adj.get(a) ?? []), b])
    adj.set(b, [...(adj.get(b) ?? []), a])
    capacity.set(edge(a, b), (capacity.get(edge(a, b)) ?? 0) + c)
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = { x, y }
      if (!passable(g.board.at(p))) continue
      const i = idx(p)
      add(nodesIn(i), nodesOut(i), 1)
      for (const d of ORTHO) {
        const q = { x: x + d.x, y: y + d.y }
        if (g.board.inside(q) && passable(g.board.at(q))) add(nodesOut(i), nodesIn(idx(q)), 1)
      }
      if (src.has(key(p))) add(S, nodesIn(i), 99)
      if (dst.has(key(p))) add(nodesOut(i), T, 99)
    }
  const res = (a: number, b: number) => (capacity.get(edge(a, b)) ?? 0) - (flow.get(edge(a, b)) ?? 0)
  let total = 0
  while (total < cap) {
    const prev = new Map<number, number>([[S, S]])
    const queue = [S]
    while (queue.length && !prev.has(T)) {
      const a = queue.shift()!
      for (const b of adj.get(a) ?? [])
        if (!prev.has(b) && res(a, b) > 0) {
          prev.set(b, a)
          queue.push(b)
        }
    }
    if (!prev.has(T)) break
    for (let b = T; b !== S; b = prev.get(b)!) {
      const a = prev.get(b)!
      flow.set(edge(a, b), (flow.get(edge(a, b)) ?? 0) + 1)
      flow.set(edge(b, a), (flow.get(edge(b, a)) ?? 0) - 1)
    }
    total++
  }
  return total
}

/** Share of walkable tiles with a cover tile within 2. */
function covered(g: Game): number {
  const { width: w, height: h } = g.board
  let all = 0
  let near = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = { x, y }
      if (!passable(g.board.at(p))) continue
      all++
      let found = false
      for (let dy = -2; dy <= 2 && !found; dy++)
        for (let dx = -2; dx <= 2 && !found; dx++)
          if (coverOf(g.board.at({ x: x + dx, y: y + dy })) > 0 && (dx || dy)) found = true
      if (found) near++
    }
  return near / all
}

/** Walking distance from the squad to the nearest alien. */
function contact(g: Game): number {
  const u = g.units.find((x) => x.side === "squad")!
  const r = g.reach(u, 999)
  const aliens = g.units.filter((x) => x.side === "enemy")
  let best = Infinity
  for (const a of aliens)
    for (const k of r.cost.keys()) if (distance(pointOf(k), a.pos) <= 1) best = Math.min(best, r.cost.get(k)!)
  return best
}

/** Soldiers that start with a cover tile next to them. */
function sheltered(g: Game): number {
  const squad = g.units.filter((u) => u.side === "squad")
  return (
    squad.filter((u) => AROUND.some((d) => coverOf(g.board.at({ x: u.pos.x + d.x, y: u.pos.y + d.y })) > 0)).length /
    squad.length
  )
}

describe("maps", () => {
  const games = Array.from({ length: 100 }, (_, i) => mission(i + 1))

  test("the map is 32×32", () => {
    for (const g of games) expect([g.board.width, g.board.height]).toEqual([32, 32])
  })
  test("2 to 5 separate routes lead from the squad's edge to the far edge", () => {
    for (const g of games) expect(routes(g), `seed ${g.seed}`).toBeGreaterThanOrEqual(2)
    for (const g of games) expect(routes(g), `seed ${g.seed}`).toBeLessThanOrEqual(5)
  })
  test("most walkable tiles have cover within 2", () => {
    for (const g of games) expect(covered(g), `seed ${g.seed}`).toBeGreaterThanOrEqual(0.5)
  })
  test("the nearest alien is at least 2 dashes away", () => {
    for (const g of games) expect(contact(g), `seed ${g.seed}`).toBeGreaterThanOrEqual(16)
  })
  test("every soldier starts next to cover", () => {
    for (const g of games) expect(sheltered(g), `seed ${g.seed}`).toBe(1)
  })
  test("the squad starts on any of the four edges", () => {
    const edges = new Set(games.map((g) => edge(g, g.units.find((u) => u.side === "squad")!.pos)))
    expect(edges.size).toBe(4)
  })
})
