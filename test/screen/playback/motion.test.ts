import type { Frame } from "../../../src/mission/match"
import { floats, Playback } from "../../../src/screen/playback/motion"
import { enemy, find, open, setup, squad } from "../../fixture"

describe("enemy turn playback", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, e])
  const walk = (id: string, to: { x: number; y: number }): Frame => {
    const after = g.clone()
    after.units.find((u) => u.id === id)!.pos = to
    return { action: { type: "move", unit: id, to }, game: after }
  }

  test("the focus is the visible enemy that acts", () => {
    const p = new Playback(1, g)
    p.add(g, [walk("e", { x: 4, y: 1 })])
    expect(p.at(0).focus).toEqual({ x: 5, y: 1 })
  })
  test("a soldier's own move has no focus", () => {
    const p = new Playback(1, g)
    p.add(g, [walk("w", { x: 1, y: 1 })])
    expect(p.at(0).focus).toBeNull()
  })
  test("a visible alien that takes a stance or uses a skill shows the action's name over it", () => {
    const p = new Playback(1, g)
    const watch: Frame = { action: { type: "overwatch", unit: "e" }, game: g.clone() }
    p.add(g, [watch, walk("e", { x: 4, y: 1 })])
    p.at(0)
    expect(p.texts.map((f) => [f.text, f.at])).toEqual([["Overwatch", { x: 5, y: 1 }]])
  })
  test("a soldier's walk sounds steps; an unseen alien's walk sounds only when heard", () => {
    const p = new Playback(1, g)
    p.add(g, [walk("w", { x: 1, y: 1 })])
    p.at(0)
    expect(p.sounds.splice(0)).toEqual(["step"])
    const unseen = setup(open(20, 3), [squad("w", "warden", { x: 0, y: 1 }), enemy("e", "orc", { x: 18, y: 1 })])
    const heard = unseen.clone()
    heard.units.find((u) => u.id === "e")!.pos = { x: 17, y: 1 }
    heard.noises.push({ at: { x: 17, y: 1 }, radius: 0, round: 1 })
    const q = new Playback(1, unseen)
    q.add(unseen, [{ action: { type: "move", unit: "e", to: { x: 17, y: 1 } }, game: heard }])
    q.at(0)
    q.at(10)
    expect(q.sounds).toEqual(["heard"])
  })
  test("an alien turn with nothing in sight still shows for 1.5 s", () => {
    const turn = g.clone()
    turn.phase = "enemy"
    const p = new Playback(1, g)
    p.add(g, [
      { action: { type: "endTurn" }, game: turn },
      { action: { type: "endTurn" }, game: g.clone() },
    ])
    p.at(0)
    expect(p.at(1400).game.phase).toBe("enemy")
    expect(p.at(1600).game.phase).toBe("squad")
  })
})

describe("overwatch", () => {
  const g0 = setup(open(12, 3), [squad("w", "warden", { x: 0, y: 0 }), enemy("e", "orc", { x: 7, y: 2 })])
  const before = g0.apply({ type: "overwatch", unit: "w" }).apply({ type: "endTurn" })
  const action = { type: "move", unit: "e", to: { x: 3, y: 2 } } as const
  const frame: Frame = { action, game: before.apply(action) }

  test("the walk stops where the shot is fired, the shot flies from the watcher, and its result shows then", () => {
    const p = new Playback(1, before)
    p.add(before, [frame])
    p.at(0)
    const still = p.at(300)
    expect(still.mover?.at).toEqual({ x: 5, y: 2 })
    expect(still.shot).toMatchObject({ from: { x: 0, y: 0 }, to: { x: 5, y: 2 } })
    expect(p.texts.map((f) => [f.text, f.at])).toEqual([["Overwatch", { x: 0, y: 0 }]])
    p.at(700)
    expect(p.texts.some((f) => f.text !== "Overwatch" && f.at.x === 5 && f.at.y === 2)).toBe(true)
  })
})

describe("floats", () => {
  const w = squad("w", "warden", { x: 0, y: 1 })
  const e = enemy("e", "orc", { x: 5, y: 1 })
  const g = setup(open(8, 3), [w, e])
  const logged = (key: string, params: Record<string, string | number | boolean>) => {
    const a = g.clone()
    a.log.push({ key, params })
    return a
  }

  test("a hit shows only the damage and marks the unit as hit", () => {
    const [f] = floats(g, logged("log.hit", { unit: "w", target: "e", dmg: 4, chance: 45 }), 0)
    expect(f.text).toBe("−4")
    expect(f.hit).toBe(true)
  })
  test("a crit says so, with no chance", () => {
    const [f] = floats(g, logged("log.crit", { unit: "w", target: "e", dmg: 6, chance: 45 }), 0)
    expect(f.text).not.toContain("%")
    expect(f.text).toContain("6")
  })
  test("a horn shows a text at the caller and a ring as wide as its reach", () => {
    const [f] = floats(g, logged("log.horn", { group: "g1", x: 5, y: 1, radius: 15 }), 0)
    expect(f).toMatchObject({ text: "Horn!", at: { x: 5, y: 1 }, ring: 15 })
  })
  test("a death leaves a fading figure", () => {
    const a = logged("log.dies", { unit: "e" })
    a.units.find((u) => u.id === "e")!.hp = 0
    const [f] = floats(g, a, 0)
    expect(f.unit?.id).toBe("e")
  })
})

describe("shot styles", () => {
  const style = (g: ReturnType<typeof setup>, frame: Frame) => {
    const p = new Playback(1, g)
    p.add(g, [frame])
    return p.at(0).shot?.style
  }
  test("a melee attack plays as a strike, a gun as a bolt, a rocket as an arc", () => {
    const g = setup(open(8, 3), [
      squad("v", "vanguard", { x: 0, y: 1 }),
      squad("h", "warden", { x: 0, y: 0 }),
      enemy("e", "ogre", { x: 1, y: 1 }),
    ])
    expect(style(g, { action: { type: "attack", unit: "e", target: "v" }, game: g.clone() })).toBe("melee")
    expect(style(g, { action: { type: "attack", unit: "v", target: "e" }, game: g.clone() })).toBe("bolt")
    const at = { x: 5, y: 1 }
    expect(style(g, { action: { type: "ability", unit: "h", ability: "rocket", at }, game: g.clone() })).toBe("arc")
  })
  test("the Scout's Hook throws a chain and drags the alien to where it lands, Mark closes a sight, Ghost fades", () => {
    const g = setup(open(8, 2), [squad("s", "rogue", { x: 0, y: 0 }), enemy("e", "orc", { x: 4, y: 0 })])
    find(g, "s").ult = 4
    const play = (action: Frame["action"]) => {
      const p = new Playback(1, g)
      p.add(g, [{ action, game: g.apply(action) }])
      return p.at(0).shot
    }
    expect(play({ type: "ability", unit: "s", ability: "hook", target: "e" })).toMatchObject({
      style: "hook",
      to: { x: 4, y: 0 },
      land: { x: 2, y: 0 },
    })
    expect(play({ type: "ability", unit: "s", ability: "tag", target: "e" })?.style).toBe("mark")
    expect(play({ type: "ability", unit: "s", ability: "ghost" })).toMatchObject({
      style: "ghost",
      from: { x: 0, y: 0 },
    })
  })
})
