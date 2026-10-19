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
  x.begin(3)
  return x
}

const launch = (x: Expedition) => {
  const c = x.campaign()!
  x.choose({
    type: "launch",
    op: c.ops[0].id,
    squad: c
      .ready()
      .slice(0, 3)
      .map((s) => s.id),
  })
  while (c.stage === "world" && !c.due()) x.choose({ type: "week" })
  if (c.stage === "world") x.choose({ type: "deploy" })
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
  test("ending a mission leaves the beats of what it gave for the world map, once", () => {
    const x = opened()
    launch(x)
    x.finish()
    const keys = x.debrief()?.map((b) => b.note.key) ?? []
    expect(keys.some((k) => k === "week.won" || k === "week.lost")).toBe(true)
    expect(x.debrief()).toBeNull()
  })
  test("the mission menu's new campaign goes back to the goal pick", () => {
    const x = opened()
    launch(x)
    x.model?.newMission()
    x.model?.newMission()
    expect(x.campaign()).toBeNull()
  })
  test("the world menu sets the language and the speed a mission then plays with", () => {
    const x = opened()
    x.setLanguage("ru")
    x.setSpeed(4)
    expect([x.lang(), x.speed()]).toEqual(["ru", 4])
    launch(x)
    expect([x.model?.lang(), x.model?.speed()]).toEqual(["ru", 4])
    x.setLanguage("en")
  })
  test("the sound toggle mutes and unmutes", () => {
    const x = opened()
    const before = x.muted()
    x.toggleSound()
    expect(x.muted()).toBe(!before)
  })
})
