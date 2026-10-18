import { Campaign } from "../../src/save/campaign"
import { Expedition } from "../../src/screen/expedition"

const memory = (): Storage => {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    key: () => null,
    clear: () => m.clear(),
    length: 0,
  }
}

const opened = () => {
  const store = memory()
  return Expedition.open(
    Campaign.open(store, () => 12),
    store,
  )
}

describe("expedition", () => {
  test("a choice moves the run on and changes its version", () => {
    const x = opened()
    const before = x.version()
    x.choose({ type: "draft", picks: ["c1", "c2", "c3"] })
    expect(x.run().stage).toBe("chart")
    expect(x.version()).toBeGreaterThan(before)
  })
  test("going to a mission gives a mission model; ending it leaves the mission", () => {
    const x = opened()
    x.choose({ type: "draft", picks: ["c1", "c2", "c3"] })
    x.choose({ type: "go", node: x.run().options()[0].id, deploy: ["c1", "c2", "c3"] })
    expect(x.model?.game().units.some((u) => u.id === "c1")).toBe(true)
    x.finish()
    expect(x.model).toBeNull()
    expect(x.run().stage).not.toBe("mission")
  })
  test("the mission menu's new run starts a run at the draft", () => {
    const x = opened()
    x.choose({ type: "draft", picks: ["c1", "c2", "c3"] })
    x.choose({ type: "go", node: x.run().options()[0].id, deploy: ["c1", "c2", "c3"] })
    x.model?.newMission()
    x.model?.newMission()
    expect(x.run().stage).toBe("draft")
  })
})
