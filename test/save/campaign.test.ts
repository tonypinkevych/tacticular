import { verifyEvent } from "nostr-tools/pure"
import { Campaign } from "../../src/save/campaign"

const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  }
}

const started = (store = memory()) => {
  const c = Campaign.open(store, () => 21)
  c.choose({ type: "draft", picks: ["c1", "c2", "c3"] })
  return { c, store }
}

describe("campaign", () => {
  test("a new campaign starts a run at the draft", () => {
    expect(Campaign.open(memory(), () => 3).run.stage).toBe("draft")
  })
  test("choices are signed events, and opening the store again replays the run", () => {
    const { c, store } = started()
    const events = JSON.parse(store.raw.get("tacticular.run")!)
    expect(events).toHaveLength(2)
    expect(events.every(verifyEvent)).toBe(true)
    const again = Campaign.open(store, () => 99)
    expect(again.run.seed).toBe(21)
    expect(again.run.roster).toEqual(c.run.roster)
  })
  test("going to a mission starts it with the run's conditions, and it survives a reload", () => {
    const { c, store } = started()
    const node = c.run.options()[0]
    c.choose({ type: "go", node: node.id, deploy: ["c1", "c2"] })
    expect(c.session?.game.units.filter((u) => u.side === "squad" && !u.has("captive")).map((u) => u.id)).toEqual([
      "c1",
      "c2",
    ])
    c.session?.act({ type: "endTurn" })
    const again = Campaign.open(store, () => 99)
    expect(again.run.stage).toBe("mission")
    expect(again.session?.game.round).toBe(2)
  })
  test("finishing a mission reads its result into the run", () => {
    const { c, store } = started()
    c.choose({ type: "go", node: c.run.options()[0].id, deploy: ["c1", "c2", "c3"] })
    const game = c.session!.game
    for (const u of game.units) if (u.side === "squad") u.hp = 0
    game.phase = "lost"
    c.finish()
    expect(c.run.stage).toBe("lost")
    expect(c.session).toBeNull()
    expect(Campaign.open(store, () => 99).run.stage).toBe("lost")
  })
  test("a run log that does not verify starts a new run", () => {
    const store = memory()
    store.setItem("tacticular.run", "[{}]")
    expect(Campaign.open(store, () => 5).run.seed).toBe(5)
  })
})
