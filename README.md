# Tacticular

A chess-like, turn-based tactics game in the browser. It is as simple as XCOM, with D&D dice, set in an
original fantasy world. You lead a squad of 4 against orc war bands on a random map with fog of war.
Position, information and timing win; brute force loses.

## Core rules

- Each soldier has 2 action points (AP). A move costs 1 AP. An attack, Overwatch or Hunker ends the turn.
- An attack is d20 + Aim against Defense. Cover adds Defense. A flank gives advantage: roll 2d20 and keep
  the higher. Overwatch, smoke and range give disadvantage. Advantage and disadvantage cancel.
- Soldiers start concealed. Enemies patrol, hear noise, investigate and blow war horns that call other groups.
  Kill an alerted group before the round ends, and no horn sounds.
- Grenades, heals and other abilities always work. Magic uses cooldowns, not mana.
- You win when the map is clear. You lose when the squad is dead.

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
- `Tab` selects the next soldier. `Esc` or a right click cancels. `Z` shows where aliens spot or fire.
- Drag or use the arrow keys to move the camera; the wheel zooms.
- The EN/RU switch changes the language. The game remembers your choice.

## Save and action log

The game keeps the mission seed and a log of your actions in `localStorage`. When you open the page again,
the game replays the log through the rules. Each action is a signed Nostr event (NIP-01, kind 7350), with a
local key, so the log can go to relays later. If an event is changed, the game refuses the save.

## Layout

```
src/map/       Board, tiles, the map generator (Terrain), Sight, Cover, Reach, Fire
src/units/     Unit and the profiles of the classes and the aliens
src/combat/    Dice, weapons, Combat (odds and attacks), Abilities
src/aliens/    Mind (the alien AI), Stealth (alerts, noise, the alarm), Reinforcements
src/mission/   Game, Turn, Orders, the mission generator, Match (the alien side and AI balance runs)
src/save/      Journal (signed Nostr event log) and the saved Session
src/i18n/      Locale: English and Russian strings
src/screen/    the isometric glyph board (board/), the HUD (hud/) and playback with sound (playback/)
test/          Vitest specs, one folder per source folder; test/play/ holds cases that cross modules
```

Only `src/screen/` has rendering code. The rest uses a seeded random stream, so the same seed and actions always
give the same game.

## Credits

All glyphs, tiles and icons are drawn for this game as 1-bit bitmaps in `src/screen/board/glyphs.ts`. The time of day
comes from the mission seed and changes only the look.
