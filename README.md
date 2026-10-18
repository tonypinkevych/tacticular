# Tacticular

A chess-like, turn-based tactics game in the browser, played as a short roguelike run. You lead a squad of up to 4
against alien war bands on random maps with fog of war. Position, information and timing win; brute force
loses.

## Core rules

- Each soldier has 2 action points (AP). A move costs 1 AP. An attack, Overwatch or Hunker ends the turn.
- An attack is d20 + Aim against Defense; cover adds Defense. A flank or an unaware target is an advantage.
  More advantages than disadvantages give a sure critical hit; otherwise each disadvantage left costs 3.
- A unit at half HP or less is wounded: it attacks shaken and cannot dash.
- Aliens show whom they will shoot next. Hover an alien to see where it can go next turn.
- Soldiers start concealed. Enemies patrol, hear noise and investigate. An alarm rises each round; at 4, 7
  and 10 the aliens get help. A "?" marks where the squad heard an alien it cannot see.
- Missions: kill the Warchief and then leave or kill the rest, take the intel and leave, free a captive, bomb a
  relay, or hold a beacon for 8 rounds against growing waves.

## The run

Pick 3 of 7 soldiers; up to 4 go on a mission, and the roster holds 5. Cross a chart of missions to the fortress and kill the Warchief there. HP carries from
mission to mission; a won mission gives a heal, a recruit or training, and changes the fortress. The run ends
when no soldier is left.

## Run

You need Node.js 20 or later and pnpm.

```sh
pnpm install
pnpm dev        # play at the address that Vite shows
pnpm test       # run the rule, AI, mission, save and string tests
pnpm build      # type-check and build to dist/
```

## Controls

- Click a soldier, then click a tile to move, or click an enemy to see the hit chance. Click the enemy again to attack.
- Use the panel for abilities, items, Overwatch, Hunker, Reload and End turn.
- Point at a tile to see where the soldier can move, the path, its cover and who flanks it there. Point at an
  alien to see the hit chance.
- `Tab` selects the next soldier, or with an attack or a skill armed, its next target. `Esc` or a right click cancels. `Z` shows where aliens spot or fire.
- Drag or use the arrow keys to move the camera; the wheel zooms.
- The EN/RU switch changes the language. The game remembers your choice.

## Save and action log

The game keeps two logs in `localStorage`: the run's seed and choices (kind 7351), and the current mission's
seed, conditions and actions (kind 7350). When you open the page again, the game replays both through the
rules. Each entry is a signed Nostr event (NIP-01) with a local key, so the logs can go to relays later. If
an event is changed, the game refuses the save.

## Layout

```
src/map/       Board, tiles, the map generator (Terrain), Sight, Cover, Reach, Fire
src/units/     Unit and the profiles of the classes and the aliens
src/combat/    Dice, weapons, Combat (odds and attacks), Abilities
src/aliens/    Mind (the alien AI), Stealth (alerts, noise, the alarm), Reinforcements
src/mission/   Game, Turn, Orders, the mission generator, Match (the alien side and AI balance runs)
src/run/       Run (draft, chart, threat, rewards, carried HP) and Chart (the act's missions)
src/save/      Journal (signed Nostr event logs), the saved Session (a mission) and Campaign (the run)
src/i18n/      Locale: English and Russian strings
src/screen/    the glyph board (board/), the HUD (hud/), playback with sound (playback/), run screens (run/)
test/          Vitest specs, one folder per source folder; test/play/ holds cases that cross modules
```

Only `src/screen/` has rendering code. The rest uses a seeded random stream, so the same seed and actions always
give the same game.

## Credits

All glyphs, tiles and icons are drawn for this game as 1-bit bitmaps in `src/screen/board/glyphs.ts`. The time of day
comes from the mission seed and changes only the look.
