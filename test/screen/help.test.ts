import { t } from "../../src/i18n/strings"
import { help } from "../../src/screen/help"
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
  test("while moving, the help names the status the soldier puts on and the combo it lands", () => {
    expect(help(game().unit("w"), "move")).toEqual({
      name: t("ui.combo"),
      about: t("help.combo.about", {
        tactic: t("tactic.suppressed"),
        put: t("status.suppressed"),
        status: t("status.staggered"),
        effect: t("combo.warden"),
      }),
      how: t("help.combo.how"),
    })
  })
})
