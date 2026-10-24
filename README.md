# Tacticular

A chess-like, turn-based tactics game in the browser, played as a short roguelike run. You lead a squad of 3 on an
8×8 board that you see whole, like Into the Breach, drawn in hand-drawn ink. Position and timing win.

## Core rules

- Each soldier has 2 action points (AP). A move costs 1 AP and a dash costs 2. A shot, Overwatch or a skill ends
  the turn.
- The class sets how far one move goes: 2 tiles for the Vanguard and the Cleric, 1 for the Ranger and the
  Warden. Forest and rubble end a move. Cover, buildings, water and barrels block it.
- A shot hits by percent: the shooter's aim, −20 behind low cover, −40 behind high cover or in a forest. Cover on
  a side counts only against a shooter 2 or more tiles away on that axis, so a foe next to you or diagonal past
  your cover flanks you. A flank gives +10 aim and a 50% crit, which does 1 more damage.
- Each class has one skill and one passive: Run & Gun, Headshot, Grenade and Medkit. A Vanguard hit next to its
  target pushes it back, into water or fire too. A Medkit gives an ally with no AP 1 AP back. Each alien has one skill:
  covering fire, a charge, a marked blast or a war cry. The Bomber's blast and the Brute's charge show on the
  board a turn before they land.
- Blasts tear sandbags and crack rocks, then leave rubble. Barrels blow up and set their tile on fire. Fire burns
  and spreads to the next forest. A push into water drowns.
- 2 aliens drop once a mission, on tiles marked a round before.
- Missions: kill all aliens, take every soldier out by the top row, or hold the beacon for 5 rounds.

## The run

Pick 3 of the 4 classes. Cross a chart of 4 layers of missions to the Commander's fortress. Each mission raises the
threat, and each 3 threat adds an alien. Soldiers keep their HP between missions and heal 2. After a win the fallen
come back with 1 HP; after a loss they are dead. Each mission on the chart shows its reward: heal all, a recruit, training (+1 HP, +5 aim) or a
skill upgrade; an Elite always gives an upgrade. A win gives that reward.

## Run the game

You need Node.js 20 or later and pnpm.

```sh
pnpm install
pnpm dev        # play at the address that Vite shows
pnpm test       # run the rule, AI, mission, run, save and string tests
pnpm build      # type-check and build to dist/
```

## Controls

- Click a soldier to select it. Click a tile, an alien or a barrel to plan a move or a shot, and click it again to
  do it. The planned path marks fire and overwatch on the way.
- Point at an alien to see where it can walk and what it can hit. The turn ends on its own when no soldier has AP.
- `3` arms the skill, `4` sets Overwatch, `Enter` or the End turn button ends the turn, `Tab` selects the next soldier with AP, `Esc` or a
  right click cancels.
- Point at an alien to see the hit chance, the cover, the damage and the crit chance.

## Save and action log

The game keeps two logs in `localStorage`: the run's seed and choices (kind 7351), and the current mission's seed,
conditions and actions (kind 7350). When you open the page again, the game replays both through the rules. Each
entry is a signed Nostr event (NIP-01) with a local key. If an event is changed, the game refuses the save.

## Layout

```
src/map/       Board, tiles, the map generator (terrain), line of fire, cover, Reach
src/units/     Unit and the profiles of the classes and the aliens
src/combat/    Dice, Combat (odds, shots, blasts, pushes), Abilities
src/aliens/    Mind (the AI that plays a side), Reinforcements (the drops)
src/mission/   Game, its goals, Turn, Orders, the mission generator
src/run/       Run (draft, chart, rewards, training) and Chart
src/save/      Journal (signed Nostr event logs) and Chronicle (the saved run and mission)
src/i18n/      Locale: English and Russian strings
src/screen/    the ink board (board/), the HUD (hud/), Playback (playback/), the run screens (run/)
test/          Vitest specs, one folder per source folder; test/play/ holds cases that cross modules
```

Only `src/screen/` has drawing code. The rest uses a seeded random stream, so the same seed and actions always give
the same game.

## Credits

Every tile, unit and effect is drawn in code in `src/screen/board/` and baked into sprite frames.
