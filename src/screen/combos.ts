import { t } from "../i18n/strings"
import { adjacent } from "../map/point"
import type { Game } from "../mission/game"
import type { Unit } from "../units/unit"

/** The combo chances a squad has on a board, as the player reads them. */
export class Combos {
  constructor(private readonly game: Game) {}

  /**
   * The hints over an alien: with a status, each soldier whose hit turns it into a combo and what that adds; else each
   * teammate the selected soldier's tactic would set up there.
   */
  hints(id: string, selected: Unit | null): string[] {
    const g = this.game,
      f = g.units.find((x) => x.id === id)
    if (!f?.alive() || f.side !== "enemy" || g.phase !== "squad") return []
    const squad = g.units.filter((s) => s.side === "squad" && s.alive())
    if (f.status) {
      const plain = g.clone()
      plain.unit(f.id).status = null
      return squad
        .filter((s) => s.id !== f.by && s.profile.combo === f.status)
        .map((s) =>
          t("ui.comboFor", {
            bonus: g.combat.hit(s, f).damage - plain.combat.hit(plain.unit(s.id), plain.unit(f.id)).damage,
            unit: t(`kind.${s.kind}`),
          }),
        )
    }
    const u = selected
    if (!u?.profile.tactic || u.ap === 0 || !g.tactics.reaches(u, f.at)) return []
    return squad
      .filter((s) => s !== u && s.profile.combo === u.profile.tactic)
      .map((s) => t("ui.setsUp", { unit: t(`kind.${s.kind}`) }))
  }

  /** Whether a soldier can turn an alien's status into a combo with a hit from where it stands now. */
  primed(u: Unit): boolean {
    const g = this.game
    if (g.phase !== "squad" || u.ap === 0) return false
    return g
      .foes(u)
      .some(
        (f) =>
          f.status === u.profile.combo &&
          f.by !== u.id &&
          (g.combat.canShoot(u, f) || (!!u.profile.melee && adjacent(u.at, f.at))),
      )
  }
}
