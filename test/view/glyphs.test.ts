import { DICTIONARIES } from "../../src/i18n/strings"
import { ICONS, textWidth } from "../../src/view/glyphs"

describe("pixel font", () => {
  test("every word that floats over the map has its letters in both languages", () => {
    for (const lang of ["en", "ru"] as const)
      for (const k of ["ui.miss", "ui.crit", "ui.saved", "ui.failed"] as const) {
        const word = `${DICTIONARIES[lang][k]} −12`.toUpperCase()
        expect(textWidth(word), `${lang} ${word}`).toBeGreaterThan(0)
      }
  })
})

describe("action bar icons", () => {
  test("every icon is 9×9", () => {
    for (const [id, icon] of Object.entries(ICONS)) {
      expect(icon.length, id).toBe(9)
      for (const row of icon) expect(row.length, id).toBe(9)
    }
  })
})
