import { Chronicle } from "../../src/save/chronicle"
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
  const x = Expedition.open(Chronicle.open(store), store)
  x.begin(1)
  return x
}

const launch = (x: Expedition) => {
  const c = x.campaign()!
  x.choose({
    type: "send",
    op: c.ops[0].id,
    squad: c
      .ready()
      .slice(0, 3)
      .map((s) => s.id),
    prep: 1,
  })
  x.choose({ type: "week" })
}

describe("expedition", () => {
  test("a new expedition has no campaign until a goal is picked", () => {
    const store = memory()
    const x = Expedition.open(Chronicle.open(store), store)
    expect(x.campaign()).toBeNull()
    x.begin(3)
    expect(x.campaign()?.goal).toBe(3)
  })
  test("a choice moves the campaign on and changes its version", () => {
    const x = opened()
    const before = x.version()
    x.choose({ type: "week" })
    expect(x.campaign()?.week).toBe(2)
    expect(x.version()).toBeGreaterThan(before)
  })
  test("a launched operation gives a mission model; ending it leaves the mission", () => {
    const x = opened()
    launch(x)
    expect(x.model?.game().units.some((u) => u.side === "squad")).toBe(true)
    x.finish()
    expect(x.model).toBeNull()
    expect(x.campaign()?.stage).not.toBe("mission")
  })
  test("the mission menu's new campaign goes back to the goal pick", () => {
    const x = opened()
    launch(x)
    x.model?.newMission()
    x.model?.newMission()
    expect(x.campaign()).toBeNull()
  })
})
