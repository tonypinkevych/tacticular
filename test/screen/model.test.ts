import { Session } from "../../src/save/session"
import { Model } from "../../src/screen/model"
import { enemy, open, setup, squad } from "../fixture"

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

describe("click", () => {
  test("selects an alien the squad controls", () => {
    const e = enemy("e", "orc", { x: 3, y: 1 })
    e.give({ id: "dominated", rounds: 2 })
    e.ap = 2
    const store = memory()
    const session = Session.open(store, () => 1)
    session.games = [setup(open(8, 3), [squad("w", "vanguard", { x: 0, y: 1 }), e])]
    const m = new Model(session, store)
    m.click(e.pos)
    expect(m.unit()?.id).toBe("e")
  })
})
