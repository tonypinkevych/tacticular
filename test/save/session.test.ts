import { Mind } from "../../src/ai/mind"
import { key } from "../../src/rules/point"
import { history } from "../../src/save/journal"
import { Session } from "../../src/save/session"

const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  }
}

function playSome(s: Session, steps: number): void {
  for (let i = 0; i < steps && s.game.phase === "squad"; i++) {
    const u = s.game.units.find((x) => x.alive() && x.side === "squad" && x.ap > 0)
    if (!u) {
      s.act({ type: "endTurn" })
      continue
    }
    const r = s.game.reach(u, u.mobility)
    const to = [...r.cost.keys()].map((k) => ({ x: k % 1000, y: Math.floor(k / 1000) })).find((p) => p.x > u.pos.x)
    const action =
      new Mind(s.game).decide(u) ?? (to ? { type: "move" as const, unit: u.id, to } : { type: "endTurn" as const })
    try {
      s.act(action)
    } catch {
      s.act({ type: "endTurn" })
    }
  }
}

describe("save", () => {
  test("the log is signed Nostr events that verify and link to the start", () => {
    const store = memory()
    const s = Session.open(store, () => 11)
    playSome(s, 6)
    const events = JSON.parse(store.raw.get("tacticular.save")!)
    expect(events[0].kind).toBe(7350)
    expect(events[0].sig).toMatch(/^[0-9a-f]{128}$/)
    const { seed, actions } = history(events)
    expect(seed).toBe(11)
    expect(actions).toEqual(s.actions)
  })
  test("reopening replays the log into an equal game", () => {
    const store = memory()
    const s = Session.open(store, () => 5)
    playSome(s, 10)
    const again = Session.open(store, () => 999)
    expect(again.game).toEqual(s.game)
  })
  test("a tampered event is refused and a new mission starts", () => {
    const store = memory()
    const s = Session.open(store, () => 5)
    s.act({ type: "endTurn" })
    const events = JSON.parse(store.raw.get("tacticular.save")!)
    events[1].content = JSON.stringify({ type: "move", unit: "s1", to: { x: 0, y: 0 } })
    store.setItem("tacticular.save", JSON.stringify(events))
    const again = Session.open(store, () => 77)
    expect(again.actions).toEqual([])
    expect(again.game.seed).toBe(77)
  })
  test("a quiet move can be undone, an attack cannot", () => {
    const store = memory()
    const s = Session.open(store, () => 3)
    const u = s.game.units.find((x) => x.side === "squad")!
    const r = s.game.reach(u, 1)
    const to = [...r.cost.keys()]
      .map((k) => ({ x: k % 1000, y: Math.floor(k / 1000) }))
      .find((p) => key(p) !== key(u.pos))!
    const from = { ...u.pos }
    s.act({ type: "move", unit: u.id, to })
    s.act({ type: "move", unit: u.id, to: from })
    expect(s.canUndo()).toBe(true)
    s.undo()
    expect(s.actions).toHaveLength(1)
    expect(Session.open(store, () => 1).actions).toHaveLength(1)
    s.act({ type: "endTurn" })
    expect(s.canUndo()).toBe(false)
  })
})
