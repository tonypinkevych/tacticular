# Tacticular

A chess-like, turn-based tactics game in the browser, played as a short roguelike run. You lead a squad of 3 on an
8×8 board that you see whole, like Into the Breach, drawn in hand-drawn ink. Position and timing win.

## Core rules

- Each soldier has 2 action points (AP). A move costs 1 AP and a dash costs 2. A tactic costs 1 AP. A shot,
  Overwatch, Hunker down or a skill ends the turn.
- The class sets how far one move goes: 3 tiles for the Blade, 2 for the Vanguard and the Cleric, 1 for the Ranger
  and the Warden. Forest and rubble end a move. Cover, buildings, water and barrels block it.
- A shot hits by percent: the shooter's aim, −20 behind low cover, −40 behind high cover or in a forest. Cover on
  a side counts only against a shooter 2 or more tiles away on that axis, so a foe next to you or diagonal past
  your cover flanks you. A flank gives +10 aim and a 50% crit, which does 1 more damage.
- Each class has one skill and one passive: Run & Gun, Headshot, Grenade, Medkit and Lunge (dash, then strike). The
  Blade fights in melee: its strike next to an alien always hits for 3, and claws at it hit only half the time
  (Parry). A Vanguard hit next to its target pushes it back, into water or fire too. A Medkit gives an ally with no AP
  1 AP back. Each alien has one skill: covering fire, a charge, a marked blast or a war cry. The Bomber's blast and
  the Brute's charge show on the board a turn before they land.
- Aliens aim their shots, volleys and claws a turn ahead. The board shows each line with its hit chance now. It
  fires at the start of the next alien turn with +20 aim, if the target is still in sight (claws: still next to
  it). Overwatch stays a reaction.
- Hunker down: cover counts double, the open counts as low cover, and shots at the soldier cannot crit until its
  next turn.
- Blasts tear sandbags and crack rocks, then leave rubble. Barrels blow up and set their tile on fire. Fire burns
  and spreads to the next forest. A push into water drowns.
- A mission starts with 5 aliens. 2 more drop once a mission, on tiles marked a round before.
- Each mission past the first layer of the chart holds a special alien. A Guard takes no damage from a shot its cover
  faces. A Sniper shoots across the board, but only in a turn it has not moved, and its overwatch has no penalty. A
  Pod does not fight, but while it stands a drop comes every 2 rounds and drops never run out.
- Missions: kill all aliens, take every soldier out by the top row, or hold the beacon for 5 rounds.
- Maps come in 4 biomes: a village with crossing roads and houses, a forest cut by a river with 2 fords, ruins of
  rock and rubble, and a field with 2 lines of sandbag trenches.
- Full cover blocks a shot unless the unit beside it can step out to an open side.

## Combos

Each class puts one status on an alien with its tactic, and turns another status into a combo with a hit. An alien
holds one status at a time, and statuses end at the start of the squad turn. A combo uses the status up and puts on
the next link of the chain.

| Class | Tactic, puts on | Base effect of the status | Combo on a hit, when the alien is |
|---|---|---|---|
| Warden | Suppress: Suppressed | −20 aim; its first move draws a Warden shot | Staggered: +1 damage, the cover next to it breaks, it is Exposed |
| Vanguard | Shove (next to it, push 1): Staggered | its aimed attack is cancelled; 1 AP next turn | Suppressed: +1 damage, it is Staggered |
| Cleric | Flare: Exposed | its cover counts as 0 | Marked: soldiers within 1 tile of the Cleric heal 1 |
| Ranger | Mark: Marked | +10 aim on shots at it | Exposed: a sure crit, it is Marked |
| Blade | Taunt (4 tiles): Taunted | its aimed attack turns to the Blade, and it attacks only the Blade | Exposed: +2 damage, it is Staggered |

The chain is Suppress → Vanguard → Warden → Ranger → Cleric, and each tactic starts it at its own link. The Blade
shares Exposed with the Ranger and sends the chain back to the Warden. The squad you draft decides which links you
have.

## The run

Pick 3 of the 5 classes. Cross a chart of 4 layers of missions to the Commander's fortress. Each mission raises the
threat, and each 3 threat adds an alien. Soldiers keep their HP between missions and heal 3. A soldier who falls in a
mission is dead. Each mission on the chart shows its reward and its special alien.
The reward is heal all, a recruit, training (+1 HP, +5 aim) or an upgrade; an Elite always gives an upgrade. A win
gives that reward. A soldier's first upgrade picks one of 2 branches of its class:

- Vanguard: Bulldozer (Shove pushes 2) or Brawler (a combo deals 2 more).
- Ranger: Spotter (Marked gives +20 aim) or Deadeye (Headshot works on Marked aliens too).
- Warden: Pinning fire (Suppress deals 1) or Wrecker (every hit breaks the cover next to the target).
- Cleric: Chaplain (a combo heals 2) or Searing flare (Flare deals 1).
- Blade: Riposte (claws that miss it cost the alien 2) or Reaper (a kill with a strike gives 1 AP back).

Later upgrades give a skill use more or a turn less to wait. A soldier who lands 2 combos in a mission becomes a
Partner: +10 aim on aliens with the status its class gains from.

## Run the game

You need Node.js 20 or later and pnpm.

```sh
pnpm install
pnpm dev        # play at the address that Vite shows
pnpm test       # run the rule, AI, mission, run, save and string tests
pnpm build      # type-check and build to dist/
```

## Controls

- Click a soldier to select it, and click a tile to move there. The path under the cursor marks fire and overwatch
  on the way. Click an alien or a barrel to aim at it, and click it again to fire.
- Point at an alien to see where it can walk and what it can hit. The turn ends on its own when no soldier has AP.
- `1` Shoot, `2` the skill, `3` the tactic, `4` Overwatch and `5` Hunker down choose an action, as in XCOM. Shoot, the
  skill and the tactic aim at the first target and `Tab` moves the aim; Overwatch shows what it watches. A click on a
  target fires at once. The same key again, or `Enter`, carries out what is aimed. `Backspace` or the End turn button
  ends the turn. `Tab` selects the next soldier when no target is aimed, and `Esc` or a right click cancels.
- Point at an alien to see the hit chance, the cover, the damage, the crit chance and a combo.

## Save and action log

The game keeps two logs in `localStorage`: the run's seed and choices (kind 7351), and the current mission's seed,
conditions and actions (kind 7350). When you open the page again, the game replays both through the rules. Each
entry is a signed Nostr event (NIP-01) with a local key. If an event is changed, the game refuses the save.

## Layout

```
src/map/       Board, tiles, the map generator (terrain), line of fire, cover, Reach
src/units/     Unit and the profiles of the classes and the aliens
src/combat/    Dice, Combat (odds, shots, blasts, pushes), Abilities, Tactics (statuses and combos)
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
