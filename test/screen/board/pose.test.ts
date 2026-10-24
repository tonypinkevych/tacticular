import { pose } from "../../../src/screen/board/pose"

describe("pose", () => {
  test("the Blade's strike and Lunge swing the sword down from above, with no muzzle flash", () => {
    for (const state of ["shoot", "lowShoot", "skill"] as const) {
      const f = [0, 1, 2, 3].map((i) => pose("blade", state, i))
      expect(f.some((p) => p.flash)).toBe(false)
      expect(f[2].ga - f[0].ga).toBeGreaterThan(90)
      expect(f.some((p) => p.fx === "swipe")).toBe(true)
    }
    expect(pose("blade", "skill", 2).x).toBeGreaterThan(0)
  })
})
