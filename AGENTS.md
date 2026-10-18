# Tacticular — repo conventions

What applies everywhere in this repo. Each `CLAUDE.md` is a pointer to the `AGENTS.md` beside it; the
conventions live here, where every tool reads them.

## Do not read

- `dist/`, `node_modules/` — build output and packages.

## Layers

- **`src/rules/`** holds the game: no DOM, no canvas, no clock. Random numbers come from the seeded stream
  only, so one seed and one action log always give the same game.
- **`src/ai/`** decides for the aliens through the rules, never around them.
- **`src/view/`** draws the game and reads input. It never changes a `Game` except through an action.
- **`src/i18n/`** holds every string the player reads, in English and Russian, with the same keys.
- **`src/save/`** holds the signed event log and the saved session.

## Writing

**Say it once, in the fewest words that keep the meaning.** This applies to docstrings, plans, commit
messages and replies in chat. Short sentences, never telegraphic fragments.

## Names

- **A name is a noun for what a thing _is_**, not what it does, type names included. Never a verb-agent
  (`Renderer`, `Builder`, `Manager`, `Handler`, `Generator`); no `-er`/`-or` suffix.
- **Nouns own data; verbs are methods on the noun that owns them.** A subsystem is one class holding its
  state, with verb methods on it (`Squad.select`, `Board.draw`), not a bag of free functions. A free
  function that takes the same object as its first argument everywhere wants to be a method.
- **If you never store it, it isn't a thing; it's a method.** A class built to be used on the spot is a
  free function in a noun costume. `-ing`/`-tion` names are the tell.
- **A free function is a pure reading over plain data** (`distance(a, b)`), named for the value it returns.
  A function that changes state is a verb method on the noun that owns that state.
- **Constructors take collaborators, not decisions.** No branching on inputs, no work a caller might not
  want paid for. Everything else is computed when asked.
- **A plain interface beside a class earns its place only at a boundary**: the save format, the event log,
  a Solid signal. Keep it smaller than the class.

## Files

- **One primary type per file; the filename matches it** in kebab case (`Sight` → `sight.ts`). No
  junk-drawer files (`helpers`, `utils`, `misc`).
- **A file reads top to bottom, like a book.** The primary type first, then its methods, then what only it
  uses.
- **A file over 500 lines holds more than one thing.** Split it by the nouns it holds. Data tables
  (`data.ts`, `strings.ts`, glyph bitmaps) are exempt.

## Docstrings

- **Docstrings on types and members only.** No inline comments, except a `// @todo #<n>` puzzle that marks
  open work.
- **A docstring states what the item does with what it holds.** Not how it does it, not why it is so, not
  what it used to be. It names no type or member of another file.
- **Five lines on a type, three on a member.** None at all where the name and the signature already say it.
- **Rationale goes in the plan**, not in the code.

## Tests

- **A test file proves one source file**: `src/rules/sight.ts` → `test/rules/sight.test.ts`. A case that
  reaches several modules is an integration test in `test/play/`.
- **One case per behaviour, no behaviour twice.**
- **A test proves behaviour through the public surface**: inputs in, outputs and visible effects out. It
  never reaches a private member or counts a fake's calls. It still passes when the code is rewritten
  another way.
- **Write the failing test first**, then make it pass.

## Style

- Biome formats and lints: no semicolons, double quotes, width 120.
- TypeScript strict; no `any`.

## Verify

```bash
pnpm test        # Vitest: rules, AI, missions, save, strings, view logic
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome check .
pnpm format      # write what lint only checks
pnpm build       # typecheck and build to dist/
```

## Check in the browser

- Never use `localhost:5173`: it holds the player's own save. Serve on `127.0.0.1` with another port.
- Stop the server and close the tab afterwards.

## Plans

Plans go in `plans/dd-MM-yyyy-<name>.md`. `plans/` is not tracked by git.
