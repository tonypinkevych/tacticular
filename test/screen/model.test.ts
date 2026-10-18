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

describe("Tab", () => {
  test("with an attack armed, moves to the next target it can hit, barrels included", () => {
    const store = memory()
    const session = Session.open(store, () => 1)
    session.games = [
      setup(
        ["........", ".....b..", "........"],
        [squad("w", "warden", { x: 1, y: 1 }), enemy("e", "orc", { x: 7, y: 2 })],
      ),
    ]
    const m = Model.open(session, store)
    m.click({ x: 7, y: 2 })
    const tab = (shiftKey = false) => m.key({ key: "Tab", shiftKey, preventDefault: () => {} } as KeyboardEvent)
    expect(m.armed()?.target).toBe("e")
    tab()
    expect(m.armed()?.at).toEqual({ x: 5, y: 1 })
    tab()
    expect(m.armed()?.target).toBe("e")
    tab(true)
    expect(m.armed()?.at).toEqual({ x: 5, y: 1 })
  })
})

describe("log", () => {
  test("starts closed", () => {
    const store = memory()
    expect(
      Model.open(
        Session.open(store, () => 1),
        store,
      ).logOpen(),
    ).toBe(false)
  })
})
