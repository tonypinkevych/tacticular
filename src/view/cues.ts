import type { Frame } from "../match"
import { WEAPONS } from "../rules/data"
import type { Game } from "../rules/game"
import type { WeaponId } from "../rules/types"

export type Cue =
  | "shotgun"
  | "rifle"
  | "lmg"
  | "smg"
  | "pistol"
  | "knife"
  | "psi"
  | "melee"
  | "alien"
  | "ability"
  | "hit"
  | "hurt"
  | "miss"
  | "crit"
  | "death"
  | "blast"
  | "step"
  | "door"
  | "heard"
  | "spotted"
  | "activity"
  | "select"
  | "denied"

const WEAPON_CUES: Partial<Record<WeaponId, Cue>> = {
  shotgun: "shotgun",
  longbow: "rifle",
  repeater: "lmg",
  crossbow: "smg",
  axes: "pistol",
  knives: "knife",
  bolt: "psi",
}

const HURTS = ["log.hit", "log.lash", "log.burn", "log.shrapnel", "log.slam", "log.fall", "log.fire", "log.mine"]

/** The sounds of one step of play: the action's own sounds at its start, and its results at its end. */
export function cues(before: Game, frame: Frame): { start: Cue[]; end: Cue[] } {
  const a = frame.action
  const after = frame.game
  const start: Cue[] = []
  if (a.type === "endTurn" && before.phase === "squad" && after.phase === "enemy") start.push("activity")
  if (a.type === "move") start.push("step")
  if (a.type === "ability") start.push("ability")
  if (a.type === "attack") {
    const w = a.weapon ?? before.units.find((u) => u.id === a.unit)?.weapon ?? "none"
    start.push(WEAPON_CUES[w] ?? (WEAPONS[w].melee ? "melee" : "alien"))
  }
  const end: Cue[] = []
  const add = (c: Cue) => {
    if (!end.includes(c)) end.push(c)
  }
  const squad = (id: unknown) => after.units.some((u) => u.id === id && u.side === "squad")
  for (const e of after.log.slice(before.log.length)) {
    if (HURTS.includes(e.key)) add(squad(e.params.target) ? "hurt" : "hit")
    if (e.key === "log.shrapnel" || e.key === "log.rocket" || e.key === "log.mine") add("blast")
    if (e.key === "log.crit") add("crit")
    if (e.key === "log.miss") add("miss")
    if (e.key === "log.dies") add("death")
    if (e.key === "log.door") add("door")
    if (e.key === "log.detected" || e.key === "log.engaged") add("spotted")
  }
  if (after.noises.slice(before.noises.length).some((n) => n.radius === 0)) add("heard")
  return { start, end }
}
