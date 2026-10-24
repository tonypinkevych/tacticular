import { t } from "../../src/i18n/strings"
import { Combos } from "../../src/screen/combos"
import { enemy, open, setup, squad } from "../fixture"

describe("combos", () => {
  test("an alien's status names the soldier who turns it into a combo, and the soldier is marked ready", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 2, y: 6 }),
      squad("v", "vanguard", { x: 3, y: 6 }),
      enemy("g", "commander", { x: 3, y: 4 }),
    ]).apply({ type: "tactic", unit: "w", target: "g" })
    const c = new Combos(g)
    expect([c.hints("g", null), c.primed(g.unit("v")), c.primed(g.unit("w"))]).toEqual([
      [t("ui.comboFor", { bonus: 2, unit: t("kind.vanguard") })],
      true,
      false,
    ])
  })
  test("the selected soldier's tactic names the teammate it would set up on each alien in reach", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 2, y: 6 }),
      squad("v", "vanguard", { x: 3, y: 6 }),
      enemy("g", "commander", { x: 3, y: 4 }),
    ])
    expect(new Combos(g).hints("g", g.unit("w"))).toEqual([t("ui.setsUp", { unit: t("kind.vanguard") })])
  })
})
