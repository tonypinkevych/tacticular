import { verifyEvent } from "nostr-tools/pure"
import { Chronicle } from "../../src/save/chronicle"

const memory = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  }
}

/** Launches the first posted operation with 3 ready soldiers and, after its infiltration weeks, deploys them. */
const launch = (c: Chronicle): string[] => {
  const squad = c
    .campaign!.ready()
    .slice(0, 3)
    .map((s) => s.id)
  c.choose({ type: "launch", op: c.campaign!.ops[0].id, squad })
  while (c.campaign!.stage === "world" && !c.campaign!.due()) c.choose({ type: "week" })
  if (c.campaign!.stage === "world") c.choose({ type: "deploy" })
  return squad
}

const started = (store = memory()) => {
  const c = Chronicle.open(store)
  c.begin(21, 3)
  return { c, store }
}

describe("chronicle", () => {
  test("with no save there is no campaign, and old run and campaign saves are dropped", () => {
    const store = memory()
    store.setItem("tacticular.run", "[]")
    store.setItem("tacticular.week", "[]")
    expect(Chronicle.open(store).campaign).toBeNull()
    expect([store.raw.has("tacticular.run"), store.raw.has("tacticular.week")]).toEqual([false, false])
  })
  test("choices are signed events, and opening the store again replays the campaign", () => {
    const { c, store } = started()
    c.choose({ type: "recruit", kind: "ranger" })
    const events = JSON.parse(store.raw.get("tacticular.field")!)
    expect(events).toHaveLength(2)
    expect(events.every(verifyEvent)).toBe(true)
    const again = Chronicle.open(store)
    expect(again.campaign?.goal).toBe(3)
    expect(again.campaign?.roster).toEqual(c.campaign?.roster)
  })
  test("a launched operation starts its mission with the squad, and it survives a reload", () => {
    const { c, store } = started()
    const squad = launch(c)
    const sent = c.session?.game.units.filter((u) => u.side === "squad" && !u.has("captive")).map((u) => u.id)
    expect(sent).toEqual(squad)
    c.session?.act({ type: "endTurn" })
    const again = Chronicle.open(store)
    expect(again.campaign?.stage).toBe("mission")
    expect(again.session?.game.round).toBe(2)
  })
  test("finishing a mission reads its result into the campaign", () => {
    const { c, store } = started()
    launch(c)
    const game = c.session!.game
    for (const u of game.units) if (u.side === "squad") u.hp = 0
    game.phase = "lost"
    c.finish()
    expect(c.session).toBeNull()
    expect(c.campaign?.roster).toHaveLength(1)
    expect(Chronicle.open(store).campaign?.roster).toHaveLength(1)
  })
  test("a log that does not verify leaves no campaign", () => {
    const store = memory()
    store.setItem("tacticular.field", "[{}]")
    expect(Chronicle.open(store).campaign).toBeNull()
  })
})
