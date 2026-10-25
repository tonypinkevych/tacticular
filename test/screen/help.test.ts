import { t } from "../../src/i18n/strings"
import { label } from "../../src/screen/glyph"
import { help, statusHelp } from "../../src/screen/help"
import { enemy, open, setup, squad } from "../fixture"

const game = () =>
  setup(open(), [
    squad("r", "ranger", { x: 3, y: 6 }),
    squad("w", "warden", { x: 5, y: 6 }),
    enemy("g", "grunt", { x: 3, y: 1 }),
  ])

describe("help", () => {
  test("the help of an ability names it, says what it does and how to use it", () => {
    const g = game()
    expect([help(g.unit("r"), "skill"), help(g.unit("w"), "tactic")]).toEqual([
      { name: t("skill.headshot"), about: t("skill.about.headshot"), how: t("skill.how.headshot") },
      { name: t("tactic.suppressed"), about: t("tactic.about.suppressed"), how: t("tactic.how.suppressed") },
    ])
  })
  test("the combo card names the squad mate who cashes in the soldier's set-up and who sets up its own combo", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 5, y: 6 }),
      squad("v", "vanguard", { x: 3, y: 6 }),
      squad("c", "cleric", { x: 1, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 1 }),
    ])
    const team = g.units.filter((u) => u.side === "squad")
    expect(help(g.unit("w"), "move", team)).toEqual({
      name: t("ui.combo"),
      about: [
        t("help.combo.setup", { tactic: t("tactic.suppressed"), put: label("suppressed"), who: t("kind.vanguard") }),
        t("help.combo.cash", { status: label("staggered"), who: t("kind.vanguard"), effect: t("combo.warden") }),
      ].join("\n"),
      how: t("help.combo.how"),
    })
    expect(help(g.unit("c"), "move", team)?.about).toBe(
      [
        t("help.combo.setup.none", { tactic: t("tactic.exposed"), put: label("exposed") }),
        t("help.combo.cash.none", { status: label("marked"), effect: t("combo.cleric") }),
      ].join("\n"),
    )
  })
  test("an alien's status says what it does and which squad mate turns it into a combo", () => {
    const g = setup(open(), [
      squad("w", "warden", { x: 2, y: 6 }),
      squad("v", "vanguard", { x: 3, y: 6 }),
      enemy("g", "grunt", { x: 3, y: 3 }),
    ]).apply({ type: "tactic", unit: "w", target: "g" })
    const team = g.units.filter((u) => u.side === "squad")
    expect([statusHelp(g.unit("g"), team), statusHelp(g.unit("w"), team)]).toEqual([
      {
        name: label("suppressed"),
        about: t("status.about.suppressed"),
        how: t("help.status.how", { who: t("kind.vanguard") }),
      },
      null,
    ])
  })
})
