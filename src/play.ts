import { decide } from "./ai/ai";
import { apply, Illegal } from "./rules/actions";
import { distance } from "./rules/grid";
import { alive, sideOf } from "./rules/units";
import type { Action, Game, Unit } from "./rules/types";

/** One step of play: an action and the game right after it. */
export interface Frame {
  action: Action;
  game: Game;
}

/** Plays one player action, then every reaction and, after End turn, the whole enemy phase. */
export function play(game: Game, action: Action): Game {
  const out = frames(game, action);
  return out[out.length - 1].game;
}

/** The same as play, but keeps every step so the view can show them one by one. */
export function frames(game: Game, action: Action): Frame[] {
  const out: Frame[] = [{ action, game: apply(game, action) }];
  react(out);
  if (action.type === "endTurn" && last(out).phase === "enemy") enemyPhase(out);
  return out;
}

const last = (out: Frame[]): Game => out[out.length - 1].game;

/** Each unit in the reveal queue takes one AI action, surprised. */
function react(out: Frame[]): void {
  while (last(out).reactions.length > 0 && (last(out).phase === "squad" || last(out).phase === "enemy")) {
    const id = last(out).reactions[0];
    const ready = structuredClone(last(out));
    const u = ready.units.find((x) => x.id === id)!;
    u.ap = alive(u) ? 1 : 0;
    const action = decide(ready, u);
    let after = ready;
    if (action) {
      try {
        after = apply(ready, action);
      } catch (e) {
        if (!(e instanceof Illegal)) throw e;
      }
    }
    after.units.find((x) => x.id === id)!.ap = 0;
    after.reactions = after.reactions.filter((x) => x !== id);
    out.push({ action: action ?? { type: "endTurn" }, game: after });
  }
}

function order(game: Game): Unit[] {
  const squad = game.units.filter((u) => alive(u) && sideOf(u) === "squad");
  const near = (u: Unit) => Math.min(...squad.map((s) => distance(s.pos, u.pos)), 999);
  return game.units.filter((u) => alive(u) && sideOf(u) === "enemy").sort((a, b) => near(a) - near(b));
}

/** Runs the AI for every enemy-side unit, then ends the round. */
function enemyPhase(out: Frame[]): void {
  for (const { id } of order(last(out))) {
    for (let i = 0; i < 4 && last(out).phase === "enemy"; i++) {
      const u = last(out).units.find((x) => x.id === id)!;
      if (sideOf(u) !== "enemy") break;
      const action = decide(last(out), u);
      if (!action) break;
      try {
        out.push({ action, game: apply(last(out), action) });
      } catch (e) {
        if (!(e instanceof Illegal)) throw e;
        break;
      }
    }
  }
  if (last(out).phase === "enemy") out.push({ action: { type: "endTurn" }, game: apply(last(out), { type: "endTurn" }) });
}
