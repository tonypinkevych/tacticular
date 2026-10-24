/** A point in screen pixels. */
export type Pt = [number, number]

export const circle = (cx: number, cy: number, rx: number, ry = rx, n = 16): Pt[] =>
  Array.from({ length: n }, (_, i) => [
    cx + Math.cos((i / n) * Math.PI * 2) * rx,
    cy + Math.sin((i / n) * Math.PI * 2) * ry,
  ])

export const box = (x: number, y: number, w: number, h: number, c = 2): Pt[] => [
  [x + c, y],
  [x + w - c, y],
  [x + w, y + c],
  [x + w, y + h - c],
  [x + w - c, y + h],
  [x + c, y + h],
  [x, y + h - c],
  [x, y + c],
]

export const star = (c: Pt, r1: number, r2: number, n = 5, k = 0.75): Pt[] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? r2 : r1,
      a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * k]
  })

export const turn = ([x, y]: Pt, a: number): Pt => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
]

export const shift = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
