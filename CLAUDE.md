@HANDOFF.md

# CLAUDE.md

Guidance for Claude Code in this repository. Machine-wide rules (agent routing, the UI/UX guide, worktrees) live in `~/.claude/CLAUDE.md` and are not repeated here.

## Workflow

- **Worktrees:** follow the machine-wide worktree rule. Never edit the shared main checkout for implementation work.
- **Commit and push each finished stage:** when a stage, plan part or main function is finished (typecheck, tests and lint pass), run `git fetch origin`, rebase onto `origin/main`, commit, and push to `origin/main` before starting the next one. One commit per finished piece. Never force-push. Tell implementers this rule in every brief.
- **Handoff (shared with Cursor):** read `HANDOFF.md` before starting work; Cursor may have changed things. Overwrite it only after a milestone or when the user says "handoff": under 50 lines, with Last Updated By, Current Goal, Recent Changes and files touched, Active Decisions / Constraints, and Exact Next Step. Replace, do not append.

## Docs are the source of truth

- `doc/GAME_DESIGN.md`: design and all numbers. Numbers in code come from here; if evidence demands different numbers, record them in the design doc first, then change code. Don't silently "fix" numbers in code.
- `doc/IMPLEMENTATION_PLAN.md`: living step-by-step plan with a Status per step, "Decided" design questions (Q#/G#), and accepted deviations. Section refs like "§7" refer to GAME_DESIGN.md. When finishing a step, set its Status and add a dated Progress line.
- Portfolio brief: `../docs/ideas/incremental-rpg.md`. Keep it and `../docs/ideas/README.md` aligned when the concept, scope or status changes.

## Commands

```bash
npm run dev            # Vite dev server (React UI)
npm run build          # tsc -b && vite build
npm run typecheck      # tsc -b (app, node, and harness tsconfigs)
npm run lint           # oxlint
npm test               # vitest run (all tests, node environment)
npx vitest run src/sim/combat.test.ts          # single test file
npx vitest run -t "name fragment"              # single test by name
npm run sim -- --list  # headless harness CLI (tsx src/harness/cli.ts)
```

Harness CLI modes (see `src/harness/cli.ts`): `--scenario <id> --seed <n> [--runs <n>]`, `--matrix <...> --seed <n> --runs <n>` (reference matrix, CSV written under `reports/`), `--expedition <...> --seed <n>`.

## Architecture

A browser-local incremental RPG (TypeScript + React + Vite, no backend, no game engine, no state library). A deterministic headless combat simulation comes first, a harness validates balance numbers, and the React dashboard sits on top without changing the sim.

Layers under `src/`, with import rules **enforced by `tests/architecture.test.ts`** (run it after adding imports):

- `src/sim`: pure, deterministic simulation. May import only other `src/sim` files (tests may also import `vitest`). No `Math.random`, `Date`, `performance.now`, `console`, `process`, DOM/storage globals, React, or `node:*`. All randomness goes through the seeded RNG (`rng.ts`).
- `src/content`: data definitions (heroes, enemies, skills, statuses, gear, encounters, scenarios, skill webs under `webs/`). May import sim, but not UI/harness/persist, and performs no I/O. `content/scenarios.ts` exports `gameDefs`, the bundle the sim runs against.
- `src/harness`: Node-side batch runner, reference matrix/combos, expedition runner, report/CSV writer, CLI. Must not import `ui`, and not `persist` except `modded.ts` and `freeUpgrade.ts` (they craft gear with the game's own code).
- `src/persist`: versioned save (`save.ts`, key `rpg.save.v1`). Must not import `ui` or `harness`.
- `src/ui`: React app (`App.tsx`, `store.ts`, `loop.ts` driver, `combat/` viewer, `log/` categories). Must not import `harness`.
- `src/main.tsx` is the entry point, not a layer. Nothing may import from sibling game projects.

Sim internals worth knowing:

- Integer-millisecond clock advancing in fixed 10 ms steps with a fixed tie order (`constants.ts`, `combat.ts`). An action resolves the moment its actor becomes ready; telegraphs are the only wind-ups.
- Per-class mechanics live in `sim/classes/` (warrior, assassin, ranger, resources), racial layers in `sim/races/`, character growth/skill-web spending in `progression.ts`.
- `automation.ts` evaluates hero priority rows (the "readable automation" pillar); `enemyAi.ts` drives enemies; `damage.ts`/`statuses.ts`/`skills.ts` hold the math.
- `expedition.ts` is the road-run layer on top of combat (loot carry, retreat/escape, defeat penalties).
- `log.ts` produces structured combat events; `ui/log/categories.ts` classifies them for display.

## Conventions

- Same seed + same inputs give the same result. Changing RNG draw order or the tie order is a deliberate change.
- Snapshot tests in `src/content/__snapshots__` guard content numbers; intentional content changes require updating them.
- Unit tests sit next to the source as `*.test.ts`.

## Project-specific rules

**Changelog (required with every commit that changes the game):** `CHANGELOG.md` feeds the in-game "What's new" page. With every commit that changes player-visible behaviour, content, balance or fixes a bug, add a line under `Unreleased` in `CHANGELOG.md` (one plain player-facing line, tagged New / Improved / Balance / Fixed / Tech, plan step in brackets). When a milestone closes, move the lines under a new `## 0.x.0 · date · name` heading. Keep the format parseable by the in-game page parser; its test fails if the file's shape breaks. Tell implementers this rule in every brief.
