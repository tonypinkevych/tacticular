# Tacticular

A chess-like, turn-based tactics game in the browser, played as a campaign to free the Earth. You lead squads of up to 4
against alien war bands on random maps with fog of war. Position, information and timing win; brute force
loses.

## Core rules

- Each soldier has 2 action points (AP). A move costs 1 AP. An attack, Overwatch or Hunker ends the turn.
- An attack is d20 + Aim against Defense; cover adds Defense. A flank or an unaware target is an advantage.
  More advantages than disadvantages give a sure critical hit; otherwise each disadvantage left costs 3. Melee
  aliens and hunkered units never take a sure hit: the flank gives an edge instead.
- A unit at half HP or less is wounded: it attacks shaken and cannot dash.
- Aliens show whom they will shoot next and the tile they will fire from. Hover an alien to see where it can go
  next turn; plan a move to see which aliens could flank that tile next turn. Aliens avoid known overwatch.
- Soldiers start concealed. Enemies patrol, hear noise and investigate; a group that calms down stays wary. The
  alarm rises every second round and after each round with a loud shot or blast; at 4, 7 and 10 the aliens get
  help. A "?" marks where the squad heard an alien it cannot see.
- Missions: kill the Warchief, or bomb a relay, and then leave or kill the rest; take the intel and leave; free a
  captive; or hold a beacon for 8 rounds against growing waves. A downed soldier left outside the evac zone is
  lost.

## Skills and levels

Each class has 3 skills and an ultimate. A soldier gets 1 rank point at each of 11 levels. A skill takes 3 ranks,
each with a higher number or a shorter cooldown; a skill at rank n needs level 2n−1. The ultimate opens at level 6
and takes rank 2 at level 11. The alien AI and the bot squad try each ready skill on copies of the game and use
the best one.

## The campaign

Pick the goal: free 1, 3 or all 8 regions. Each week you contact regions with Intel, recruit and research with
Supplies and Materials, rank up soldiers and send squads of 3 or 4 to operations. A short squad or a long prep
infiltrates better: fewer aliens, or groups marked. Won operations raise a region's Resistance and cut its alien
Strength; at full Resistance and low Strength, a Liberation frees the region and turns on its bonus.

The aliens get income from the regions they hold. They spend it on Strength where you are active, on Dark Events
that make every mission harder until you end them, and on the Project. Their Force Level rises with time and
brings new kinds, skill ranks and HP. When the Project ends, the war is lost.

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
- Use the panel for abilities, items, Overwatch, Hunker, Reload, Door and End turn. Door (`0` or `O`) opens or
  closes a door next to the soldier for 1 AP.
- Point at a tile to see where the soldier can move, the path, its cover and who flanks it there. Point at an
  alien to see the hit chance.
- `Tab` selects the next soldier, or with an attack or a skill armed, its next target. `Esc` or a right click cancels. `Z` shows where aliens spot or fire. While the selected soldier is concealed, a red fill always shows where seen aliens would spot it.
- Drag or use the arrow keys to move the camera; the wheel zooms.
- The EN/RU switch changes the language. The game remembers your choice.

## Save and action log

The game keeps two logs in `localStorage`: the campaign's seed, goal and choices (kind 7352), and the current mission's
seed, conditions and actions (kind 7350). When you open the page again, the game replays both through the
rules. Each entry is a signed Nostr event (NIP-01) with a local key, so the logs can go to relays later. If
an event is changed, the game refuses the save.

## Layout

```
src/map/       Board, tiles, the map generator (Terrain), Sight, Cover, Reach, Fire
src/units/     Unit and the profiles of the classes and the aliens
src/combat/    Dice, weapons, Combat (odds and attacks), Abilities
src/aliens/    Mind (the AI), Foresight (its look-ahead at skills), Stealth (alerts, noise, the alarm), Reinforcements
src/mission/   Game, Turn, Orders, the mission generator, Match (the alien side and AI balance runs)
src/campaign/  Campaign (weeks, both economies, operations, infiltration), the world's regions, soldier levels
src/save/      Journal (signed Nostr event logs), the saved Session (a mission) and Chronicle (the campaign)
src/i18n/      Locale: English and Russian strings
src/screen/    the glyph board (board/), the HUD (hud/), playback with sound (playback/), campaign screens (run/)
test/          Vitest specs, one folder per source folder; test/play/ holds cases that cross modules
```

Only `src/screen/` has rendering code. The rest uses a seeded random stream, so the same seed and actions always
give the same game.

## Credits

All glyphs, tiles and icons are drawn for this game as 1-bit bitmaps in `src/screen/board/glyphs.ts`. The time of day
comes from the mission seed and changes only the look.
