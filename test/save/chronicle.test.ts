import { Chronicle } from "../../src/save/chronicle"

const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const into = (c: Chronicle) => {
  c.choose({ type: "draft", picks: c.run.candidates.slice(0, 3).map((x) => x.id) })
  c.choose({ type: "go", node: c.run.options()[0].id, deploy: c.run.roster.map((s) => s.id) })
}

describe("chronicle", () => {
  test("a new store starts a run from the seed", () => {
    expect(Chronicle.open(memory(), () => 42).run.seed).toBe(42)
  })
  test("a save of older rules is not resumed", () => {
    const store = memory()
    const old = Chronicle.open(store, () => 42)
    into(old)
    for (const k of ["run", "mission"]) {
      store.setItem(`tacticular.${k}.v5`, store.getItem(`tacticular.${k}.v6`) ?? "")
      store.removeItem(`tacticular.${k}.v6`)
    }
    expect(Chronicle.open(store, () => 7).run.seed).toBe(7)
  })
  test("going to a mission starts its game", () => {
    const c = Chronicle.open(memory(), () => 42)
    into(c)
    expect(c.game?.units.filter((u) => u.side === "squad")).toHaveLength(3)
  })
  test("a reopened store resumes the run and the mission where they were", () => {
    const store = memory()
    const c = Chronicle.open(store, () => 42)
    into(c)
    const g = c.game!
    const u = g.units.find((x) => x.side === "squad")!
    const action = { type: "endTurn" as const }
    c.record(action, g.apply(action))
    const back = Chronicle.open(store, () => 1)
    expect([back.run.stage, back.game?.phase, back.game?.units.find((x) => x.id === u.id)?.at]).toEqual([
      "mission",
      "enemy",
      u.at,
    ])
  })
  test("finishing a mission records its result in the run", () => {
    const c = Chronicle.open(memory(), () => 42)
    into(c)
    c.finish()
    expect(["chart", "reward", "lost"]).toContain(c.run.stage)
  })
  test("a broken save starts a new run", () => {
    const store = memory()
    store.setItem("tacticular.run.v2", "not json")
    expect(Chronicle.open(store, () => 9).run.seed).toBe(9)
  })
})
