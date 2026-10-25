# Tacticular

A chess-like, turn-based tactics game in the browser, played as a short roguelike run. You lead a squad of 3 on an
8×8 board that you see whole, like Into the Breach, drawn in hand-drawn ink. Position and timing win.

## Core rules

- Each soldier has 2 action points (AP). A move costs 1 AP and a dash costs 2. A tactic costs 1 AP. A shot,
  Overwatch, Hunker down or a skill ends the turn.
- The class sets how far one move goes: 3 tiles for the Blade, 2 for the Vanguard and the Cleric, 1 for the Ranger
  and the Warden. Forest and rubble end a move. Cover, buildings, water and barrels block it.
- Every attack hits. Its damage is the weapon damage, −1 behind low cover, −2 behind high cover or in a forest, and
  never below 0, so cover can block a hit fully. Cover on a side counts only against a shooter 2 or more tiles away
  on that axis, so a foe next to you or diagonal past your cover flanks you. A flank adds 1 damage. Marked adds 1
  damage taken, and a Suppressed unit deals 1 less.
- Each class has one skill and one passive: Run & Gun, Headshot, Grenade, Medkit and Lunge (dash, then strike). The
  Blade fights in melee: its strike next to an alien deals 3, and claws at it deal 1 less (Parry). A Vanguard hit next to its target pushes it back, into water or fire too. A Medkit gives an ally with no AP
  1 AP back. Each alien has one skill: covering fire, a charge, a marked blast or a war cry. The Bomber's blast and
  the Brute's charge show on the board a turn before they land.
- Aliens aim their shots, volleys and claws a turn ahead. The board shows each line with its damage now. It lands at
  the start of the next alien turn if the target is still in sight (claws: still next to it). Each shot of a volley
  deals 1 less. Overwatch stays a reaction, and its shot deals 1 less.
- Hunker down: cover cuts twice the damage and the open counts as low cover, until the soldier's next turn.
- Blasts tear sandbags and crack rocks, then leave rubble. Barrels blow up and set their tile on fire. Fire burns
  and spreads to the next forest. A push into water drowns.
- A mission starts with 5 aliens. 2 more drop every 3 rounds, on tiles marked a round before: twice in Kill all,
  once in the other missions.
- Each mission past the first layer of the chart holds a special alien. A Guard takes no damage from a shot its cover
  faces. A Sniper shoots across the board, but only in a turn it has not moved, and its overwatch deals full damage. A
  Pod does not fight, but while it stands a drop comes every 2 rounds and drops never run out.
- Missions: kill all aliens, take every soldier out by the top row, or hold the beacon for 5 rounds. The
  beacon falls when aliens outnumber soldiers on the 9 tiles around it at 2 round ends in a row; the board marks
  these tiles in blue.
- Maps come in 4 biomes: a village with crossing roads and houses, a forest cut by a river with 2 fords, ruins of
  rock and rubble, and a field with 2 lines of sandbag trenches.
- Full cover blocks a shot unless the unit beside it can step out to an open side.

## Combos

Each class puts one status on an alien with its tactic, and turns another status into a combo with a hit. An alien
holds one status at a time, and statuses end at the start of the squad turn. A combo uses the status up and puts on
the next link of the chain.

| Class | Tactic, puts on | Base effect of the status | Combo on a hit, when the alien is |
|---|---|---|---|
| Warden | Suppress: Suppressed | deals 1 less; its first move draws a Warden shot | Staggered: +2 damage, the cover next to it breaks, it is Exposed |
| Vanguard | Shove (next to it, push 1): Staggered | its aimed attack is cancelled; 1 AP next turn | Suppressed: +2 damage, it is Staggered |
| Cleric | Flare: Exposed | its cover counts as 0 | Marked: soldiers within 1 tile of the Cleric heal 1 |
| Ranger | Mark: Marked | takes 1 more from each hit | Exposed: +2 damage, it is Marked |
| Blade | Taunt (4 tiles): Taunted | its aimed attack turns to the Blade, and it attacks only the Blade | Exposed: +3 damage, it is Staggered |

The chain is Suppress → Vanguard → Warden → Ranger → Cleric, and each tactic starts it at its own link. The Blade
shares Exposed with the Ranger and sends the chain back to the Warden. Any other soldier deals 1 more to an alien
with a status a teammate put on, so every squad can combo. With a soldier selected, the board names the teammate its
tactic sets up on each alien, and over each status the soldier who turns it into a combo; the squad list marks a
soldier with a combo ready. Pointing at a soldier in the squad list shows its combo card: what it sets up and for whom,
and which teammate sets up its own combo.

## Ultimates

Each combo or +1 hit, landed or set up, charges both soldiers. After 2 charges in a mission, a soldier's ultimate
is ready (key `6`); it ends the turn and empties the charge.

| Class | Ultimate |
|---|---|
| Vanguard | Breach: dash up to 3 tiles in a line; every alien beside the line is shoved away and Staggered |
| Ranger | Killshot: a shot that ignores cover with 3 more damage; a kill gives 1 AP back |
| Warden | Lockdown: Suppress every alien in range and sight |
| Cleric | Flare barrage: Expose every alien within 2 tiles and heal every soldier 2 |
| Blade | Whirlwind: strike every alien next to it |

## The run

Pick 3 of the 5 classes. Cross a chart of 4 layers of missions to the Commander's fortress. Each mission raises the
threat, and each 2 threat adds an alien. Soldiers keep their HP between missions and heal 3. A soldier who falls in a
mission is dead. Each mission on the chart shows its reward and its special alien.
The reward is heal all, a recruit, training (+2 HP) or an upgrade; an Elite always gives an upgrade. A win
gives that reward. A soldier's first upgrade picks one of 2 branches of its class:

- Vanguard: Bulldozer (Shove pushes 2) or Brawler (a combo deals 3 more).
- Ranger: Spotter (a Marked alien takes 2 more) or Deadeye (Headshot works on Marked aliens too).
- Warden: Pinning fire (Suppress deals 1) or Wrecker (every hit breaks the cover next to the target).
- Cleric: Chaplain (a combo heals 2) or Searing flare (Flare deals 1).
- Blade: Riposte (every claw at it costs the alien 2) or Reaper (a kill with a strike gives 1 AP back).

Later upgrades give a skill use more or a turn less to wait.

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
- `1` Shoot, `2` the skill, `3` the tactic, `4` Overwatch, `5` Hunker down and `6` the ultimate choose an action, as in XCOM. Shoot, the
  skill and the tactic aim at the first target and `Tab` moves the aim; Overwatch shows what it watches. A click on a
  target fires at once. The same key again, or `Enter`, carries out what is aimed. `Backspace` or the End turn button
  ends the turn. `Tab` selects the next soldier when no target is aimed, and `Esc` or a right click cancels.
- Point at an alien to see the damage, what the cover cuts, a combo, and KILL when the hit would kill it.

## Save and action log

The game keeps two logs in `localStorage`: the run's seed and choices (kind 7351), and the current mission's seed,
conditions and actions (kind 7350). When you open the page again, the game replays both through the rules. Each
entry is a signed Nostr event (NIP-01) with a local key. If an event is changed, the game refuses the save.

## Layout

```
src/map/       Board, tiles, the map generator (terrain), line of fire, cover, Reach
src/units/     Unit and the profiles of the classes and the aliens
src/combat/    Dice, Combat (odds, shots, blasts, pushes), Abilities, Tactics (statuses and combos), Ultimates
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
