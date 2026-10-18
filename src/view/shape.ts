import { key, ORTHOGONAL, plus, pointOf } from "../rules/point"

/** The tiles of an area with its holes filled and its notches one tile wide closed. */
export function shape(area: Set<number>): Set<number> {
  const points = [...area].map(pointOf)
  if (points.length === 0) return new Set()
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const min = { x: Math.min(...xs) - 1, y: Math.min(...ys) - 1 }
  const max = { x: Math.max(...xs) + 1, y: Math.max(...ys) + 1 }
  const outside = new Set([key(min)])
  const queue = [min]
  while (queue.length > 0) {
    const p = queue.pop()!
    for (const d of ORTHOGONAL) {
      const n = plus(p, d)
      if (n.x < min.x || n.y < min.y || n.x > max.x || n.y > max.y) continue
      if (area.has(key(n)) || outside.has(key(n))) continue
      outside.add(key(n))
      queue.push(n)
    }
  }
  const out = new Set<number>()
  for (let y = min.y + 1; y < max.y; y++)
    for (let x = min.x + 1; x < max.x; x++) {
      const p = { x, y }
      if (!outside.has(key(p))) out.add(key(p))
    }
  const notches = []
  for (let y = min.y + 1; y < max.y; y++)
    for (let x = min.x + 1; x < max.x; x++) {
      const p = { x, y }
      if (!out.has(key(p)) && ORTHOGONAL.filter((d) => out.has(key(plus(p, d)))).length >= 3) notches.push(key(p))
    }
  for (const k of notches) out.add(k)
  return out
}
