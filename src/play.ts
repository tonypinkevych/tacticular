import { decide } from "./ai/ai";
import { apply, Illegal } from "./rules/actions";
import { distance } from "./rules/grid";
import { alive, sideOf } from "./rules/units";
import type { Action, Game, Unit } from "./rules/types";

/** Plays one player action, then every reaction and, after End turn, the whole enemy phase. */
export function play(game: Game, action: Action): Game {
  let next = react(apply(game, action));
  if (action.type === "endTurn" && next.phase === "enemy") next = enemyPhase(next);
  return next;
}

/** Each unit in the reveal queue takes one AI action, surprised. */
function react(game: Game): Game {
  let next = game;
  while (next.reactions.length > 0 && (next.phase === "squad" || next.phase === "enemy")) {
    const id = next.reactions[0];
    const ready = structuredClone(next);
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
    next = after;
  }
  return next;
}

function order(game: Game): Unit[] {
  const squad = game.units.filter((u) => alive(u) && sideOf(u) === "squad");
  const near = (u: Unit) => Math.min(...squad.map((s) => distance(s.pos, u.pos)), 999);
  return game.units.filter((u) => alive(u) && sideOf(u) === "enemy").sort((a, b) => near(a) - near(b));
}

/** Runs the AI for every enemy-side unit, then ends the round. */
export function enemyPhase(game: Game): Game {
  let next = game;
  for (const { id } of order(game)) {
    for (let i = 0; i < 4 && next.phase === "enemy"; i++) {
      const u = next.units.find((x) => x.id === id)!;
      if (sideOf(u) !== "enemy") break;
      const action = decide(next, u);
      if (!action) break;
      try {
        next = apply(next, action);
      } catch (e) {
        if (!(e instanceof Illegal)) throw e;
        break;
      }
    }
  }
  return next.phase === "enemy" ? apply(next, { type: "endTurn" }) : next;
}
