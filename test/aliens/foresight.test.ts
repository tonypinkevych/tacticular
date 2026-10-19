import { Foresight } from "../../src/aliens/foresight"
import { enemy, find, open, setup, squad } from "../fixture"

const look = (g: ReturnType<typeof setup>) =>
  new Foresight(
    g,
    () => 0,
    () => 0,
  )

describe("foresight", () => {
  test("a Heavy rockets a cluster of three aliens", () => {
    const g = setup(open(12, 5), [
      squad("w", "warden", { x: 0, y: 2 }),
      enemy("a", "orc", { x: 6, y: 1 }),
      enemy("b", "orc", { x: 6, y: 2 }),
      enemy("c", "orc", { x: 6, y: 3 }),
    ])
    const best = look(g).best(find(g, "w"))!.action
    expect(best).toMatchObject({ ability: "rocket" })
    const after = g.apply(best)
    for (const id of ["a", "b", "c"]) expect(find(after, id).hp).toBeLessThan(find(g, id).hp)
  })
  test("a Medic heals the wounded ally next to it", () => {
    const g = setup(open(12, 5), [
      squad("c", "cleric", { x: 0, y: 2 }),
      squad("v", "vanguard", { x: 1, y: 2 }),
      enemy("e", "orc", { x: 10, y: 2 }),
    ])
    find(g, "v").hp = 2
    expect(look(g).best(find(g, "c"))?.action).toMatchObject({ ability: "heal", target: "v" })
  })
  test("a skill on cooldown or without a rank is not tried", () => {
    const g = setup(open(12, 5), [squad("w", "warden", { x: 0, y: 2 }), enemy("a", "orc", { x: 6, y: 2 })])
    const w = find(g, "w")
    w.cooldowns = { rocket: 2, volley: 1 }
    w.ranks = { ...w.ranks, brace: 0 }
    expect(look(g).best(w)).toBeNull()
  })
  test("an alien leaves its marked skills to its intent", () => {
    const g = setup(open(12, 5), [squad("s", "warden", { x: 0, y: 2 }), enemy("b", "bomber", { x: 4, y: 2 })])
    expect(look(g).best(find(g, "b"))).toBeNull()
  })
  test("a skill that leaves AP counts the shot the unit can still take after it", () => {
    const g = setup(open(12, 5), [squad("w", "warden", { x: 0, y: 2 }), enemy("a", "orc", { x: 5, y: 2 })])
    find(g, "w").cooldowns = { rocket: 2, brace: 2 }
    const plain = look(g).best(find(g, "w"))!
    const follow = new Foresight(
      g,
      () => 0,
      () => 3,
    ).best(find(g, "w"))!
    expect(follow.action).toMatchObject({ ability: "volley" })
    expect(follow.value).toBeCloseTo(plain.value + 3)
  })
  test("Shaken on a foe is worth more the longer it lasts", () => {
    const g = setup(open(12, 5), [squad("w", "warden", { x: 0, y: 2 }), enemy("a", "orc", { x: 5, y: 2 })])
    const w = find(g, "w")
    w.cooldowns = { rocket: 2, brace: 2 }
    const short = look(g).best(w)!.value
    w.ranks = { ...w.ranks, volley: 3 }
    expect(look(g).best(w)!.value).toBeGreaterThan(short)
  })
})
