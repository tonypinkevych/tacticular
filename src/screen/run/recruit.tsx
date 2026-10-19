import { createSignal, For } from "solid-js"
import { RECRUIT_COST } from "../../campaign/campaign"
import { t } from "../../i18n/strings"
import { CLASSES, type ClassId } from "../../units/profiles"
import { css } from "../board/color"
import { ICONS, UNITS } from "../board/glyphs"
import type { Expedition } from "../expedition"
import { Icon } from "../hud/icon"
import { INK, OCHRE } from "./ink"

/** The class pick of a new soldier, with its cost on the confirm button; classes the roster lacks come first. */
export function Recruit(props: { expedition: Expedition; onDone: () => void }) {
  const x = props.expedition
  const c = () => x.campaign()!
  const classes = () => [...CLASSES].sort((a, b) => Number(has(a)) - Number(has(b)))
  const has = (k: ClassId) => c().roster.some((s) => s.kind === k)
  const [kind, setKind] = createSignal<ClassId>(classes()[0])
  return (
    <>
      <p class="small">{t("world.recruitInfo")}</p>
      <div class="squad">
        <For each={classes()}>
          {(k) => (
            <button
              type="button"
              class="soldier"
              classList={{ on: kind() === k, dim: has(k) }}
              data-tip={t(`kind.${k}`)}
              onClick={() => setKind(k)}
            >
              <Icon glyph={UNITS[k]} color={css(INK)} class="portrait" />
              <span class="name">{t(`kind.${k}`)}</span>
            </button>
          )}
        </For>
      </div>
      <div class="row">
        <span class="spacer" />
        <button type="button" onClick={() => props.onDone()}>
          {t("ui.close")}
        </button>
        <button
          type="button"
          class="primary"
          onClick={() => {
            x.choose({ type: "recruit", kind: kind() })
            props.onDone()
          }}
        >
          <Icon glyph={ICONS["world:supplies"]} color={css(OCHRE)} class="icon" />
          {RECRUIT_COST} · {t("ui.confirm")}
        </button>
      </div>
    </>
  )
}
