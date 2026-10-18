/** A tile position on the board. */
export interface Point {
  x: number
  y: number
}

export const key = (p: Point): number => p.y * 1000 + p.x

export const pointOf = (k: number): Point => ({ x: k % 1000, y: Math.floor(k / 1000) })

export const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y

export const plus = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })

/** Grid distance where diagonal steps cost 1, then 2, then 1, and so on. */
export function distance(a: Point, b: Point): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2)
}

export const adjacent = (a: Point, b: Point): boolean => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1

/** The square of points around a center, edge to edge. */
export function area(center: Point, radius: number): Point[] {
  const out: Point[] = []
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) out.push({ x, y })
  }
  return out
}

export const ORTHOGONAL: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

export const AROUND: Point[] = [...ORTHOGONAL, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }]
