import { Camera } from "../../src/view/camera"

const camera = () => {
  const c = new Camera()
  c.view = { x: 800, y: 600 }
  c.world = { x: 2000, y: 1500 }
  c.look({ x: 1000, y: 700 })
  return c
}

describe("camera", () => {
  test("screen and world points map both ways", () => {
    const c = camera()
    const w = c.toWorld({ x: 123, y: 456 })
    expect(c.toScreen(w).x).toBeCloseTo(123)
    expect(c.toScreen(w).y).toBeCloseTo(456)
    expect(c.toWorld({ x: 400, y: 300 })).toEqual({ x: 1000, y: 700 })
  })
  test("a zoom step keeps the world point under the mouse in place", () => {
    const c = camera()
    const mouse = { x: 600, y: 200 }
    const before = c.toWorld(mouse)
    expect(c.step(mouse, true)).toBe(true)
    for (let i = 0; i < 60; i++) c.ease(1 / 60)
    expect(c.scale).toBe(5)
    expect(c.toWorld(mouse).x).toBeCloseTo(before.x, 0)
    expect(c.toWorld(mouse).y).toBeCloseTo(before.y, 0)
  })
  test("a glide ends at its goal and a small board stays in the middle", () => {
    const c = camera()
    c.glide({ x: 900, y: 650 })
    for (let i = 0; i < 120; i++) c.ease(1 / 60)
    expect(c.center.x).toBeCloseTo(900, 0)
    c.world = { x: 40, y: 20 }
    c.clamp()
    expect(c.center).toEqual({ x: 20, y: 10 })
  })
})
