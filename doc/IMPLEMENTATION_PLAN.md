# RPG Implementation Plan

Status: living plan, Step 0.1 verified  
Last updated: 2026-10-22  
Next step: Step 2.3  
Design source of truth: [GAME_DESIGN.md](GAME_DESIGN.md). Section numbers below (for example §7) refer to that document.  
Portfolio brief: [docs/ideas/incremental-rpg.md](../../docs/ideas/incremental-rpg.md)

This plan describes how to build the first playable (§14). It does not change game design. Numbers in code come from GAME_DESIGN.md. When the evidence calls for different numbers, record them there first, then change the code.

Implementer and tester: work on one step at a time. Set the step's Status, and add a dated line under its Progress. Status values: `todo`, `done`, `verified`, `failed`, `blocked`.

---

## 1. Goal

Build a browser-local first playable of the incremental RPG. Start with a deterministic, headless combat simulation harness and use it to check the provisional combat numbers. Then add a React dashboard UI on top of that simulation, without changing it, until the §15 success criteria can be tested.

## 2. Assumptions

1. GAME_DESIGN.md numbers are provisional hypotheses (§7, §18). Implement them as written and collect evidence. Don't silently "fix" them in code.
2. The game is single-player and browser-local: no backend, accounts, network, or telemetry.
3. Node.js (current LTS) and npm are available on Windows. Commands below work in PowerShell.
4. Git is not initialized, and the user will create the repo later. Nothing in this plan depends on git.
5. Offline progression is deferred, as §11 allows. The simulation stays headless and can resume from JSON, so a catch-up loop can be added later without rule changes.
6. Desktop packaging is deferred. A static Vite build keeps both Tauri and Electron possible.
7. Reference simulations use the §9 "Level-20 reference heroes": Human, no passive nodes, no consumables. Racial and passive effects arrive in Stage 6.
8. Placeholder art is acceptable (§12, §14).
9. The user asked for this plan at `rpg/doc/IMPLEMENTATION_PLAN.md`. That overrides the default `rpg/doc/plans/YYYY-MM-DD-*.md` location in `AGENT_FLOW.md`. When calling `/implementer` or `/tester`, pass this path and a step number.
10. Some later stages need design decisions that GAME_DESIGN.md §17 leaves open. Those steps say so under "Design gate". Run the brainstormer and record the answer in GAME_DESIGN.md before starting them.

## 3. Questions for the user

### Decided

- **Q1. Tech stack. Decided 2026-10-21:** TypeScript + React + Vite, with the simulation in plain TypeScript, Vitest for tests and tsx for the harness CLI. No game engine and no state library. Section 4 has the comparison. Rejected: Phaser or PixiJS canvas renderer, and Godot 4.
- **Q2. Simulation clock. Decided 2026-10-21:** an integer-millisecond clock that advances in fixed, deterministic 10 ms steps, with a fixed tie order. Rejected: an event queue that jumps to the next event, and 100 ms steps. The mechanics are recorded in GAME_DESIGN §7 "Simulation clock and action timing".
- **Q3. Action timing. Decided 2026-10-21:** an action resolves the moment its actor becomes ready. Action time is the recovery before the next ready time. Each actor's first ready time is one base action time after the encounter starts. Explicit telegraphs are the only wind-ups. Rejected: a wind-up before every action, and acting at t=0. Recorded in GAME_DESIGN §7.

### Blocking

**Q4. Reference loadouts and priority rows (blocks Step 3.1).** These are harness fixtures, not recommended player builds. Recommended defaults:
- Warrior (one-handed + shield): Driving Blow, Sundering Blow, Shield Brace, Second Wind. Rows: Second Wind if HP ≤ 40%; Shield Brace if an enemy telegraph resolves within 1.0 s; Sundering Blow if the target lacks Expose; Driving Blow.
- Assassin (dual daggers): Mark for Death, Shadow Cut, Venom Edge, Execute. Rows: Mark for Death if the target is not Marked; Execute if Advantage ≥ 4 or target HP ≤ 30%; Venom Edge if target Poison < 5; Shadow Cut.
- Ranger (bow + quiver): Aimed Shot, Piercing Arrow, Volley, Snare Trap. Rows: Snare Trap if an enemy telegraph is present; Volley if enemy count ≥ 3; Aimed Shot if Readiness ≥ 80; Piercing Arrow.
- Mage (caster + focus): Fireball, Frost Lance, Mana Ward, Arcane Recovery. Rows: Mana Ward if HP ≤ 50% or a telegraph resolves within 1.0 s; Arcane Recovery if Mana ≤ 30; Fireball if enemy count ≥ 2; Frost Lance. Arcane Bolt is the fallback (see Q6).
- Cleric (caster + shield, Vow of Zeal): Smite, Mend, Ward, Judgment. Rows: Mend if HP ≤ 50%; Ward if a telegraph resolves within 1.0 s; Judgment if Faith ≥ 75; Smite.

**Q5. Reference heroes below level 20 (blocks Step 3.1).** Equal-level benchmarks (§7 "Enemy balance framework") need heroes at levels 1–19, but §9 defines only level 20. **Recommended:** a level-L hero has 50 + 2 × (L − 1) attribute points, split in the same proportions as the class's level-20 build (deterministic rounding), and wears neutral 100%-quality gear at item level L. The level-20 output then reproduces §9 exactly.

### Non-blocking (answer before the named step; the step uses the recommendation otherwise)

- **Q6 (Step 2.4).** Is Arcane Bolt an innate Mage fallback that doesn't take one of the four slots, like a weapon basic attack? **Recommended: yes.**
- **Q7 (Step 2.1).** Healing roll distribution (§7 leaves it open). **Recommended:** the same "average of two uniform rolls" as damage, over 90–100%.
- **Q8 (Step 2.2).** Do DoT ticks ever hit a barrier that existed before the DoT was applied? **Recommended:** no. DoT ticks always bypass barriers.
- **Q9 (Step 2.2).** Do speed changes (Chill, Pack Hunter, Heavy Follow-Through) reschedule an already-scheduled next action? **Recommended:** no. They apply when the next action is scheduled. Stun and explicit "push" effects still move the scheduled time.
- **Q10 (Step 2.5).** What counts as "an action that exploits Mark" for Advantage? **Recommended:** only skills or nodes whose text references Mark (Shadow Cut, Exploit Weakness, Toxic Opportunity), not every hit on a Marked target.
- **Q11 (Steps 2.3, 8.1).** When are enemy defenses "revealed" for target priorities? **Recommended:** in combat, a per-enemy `revealed` flag set by the encounter setup or by Hunter's Mark. In the game, an enemy type is revealed after the hero's account first defeats it. Harness scenarios start revealed.
- **Q12 (Step 3.2).** Numbers for enemy "stacking pressure after expected duration" (§7). **Recommended:** leave it out of the harness at first. The harness ends any fight at 10 simulated minutes and reports it as `timeout`. Choose the numbers in Step 3.3 from the evidence.
- **Q13 (Step 2.3).** The "Most dangerous" target priority has no threat score yet (§7). **Recommended:** leave it out until the score is designed.
- **Q14 (Step 2.5).** Quiver capacity. **Recommended:** one slot holds one special arrow, the base quiver has 6 slots, and harness Rangers carry 6 Flame Arrows.
- **Q15 (Step 2.7).** Under the decided timing model, when does an enemy act again after a telegraphed skill? **Recommended:** the telegraph starts when the enemy becomes ready, and the skill resolves when the telegraph ends. The enemy's next ready time is that resolution time plus the skill's action time. Stun and delay push the resolution, which pushes the next ready time with it.

### Design gates (brainstormer → GAME_DESIGN.md before the step starts)

| Gate | Needed by | Open item (§17 unless noted) |
| --- | --- | --- |
| G1 | Step 5.2 | Loot tables per enemy, loot capacity, supply slots, which consumables exist in the first playable |
| G2 | Step 5.3 | Escape-chance formula, whether an escape attempt uses the hero's action, retry cooldown, boss-progress loss on retreat |
| G3 | Step 5.4 | Durability loss on defeat, rescue fee, carried-gold handling, debt consequences, recovery delay length |
| G4 | Step 6.3 | Node connections and starting nodes for all five class webs, racial-branch attachment points, node costs |
| G5 | Step 6.2 | Racial unlock layers. Recommended for the first playable: core mechanic at creation, branch nodes by skill points, mastery layering deferred. |
| G6 | Step 7.2 | Starting character slots, slot-unlock milestones, duplicate race/class heroes |
| G7 | Steps 8.1, 9.4 | Fractured Frontier node layout, resource nodes, travel times, boss-reveal threshold, contract list |
| G8 | Step 9.3 | Materials, recipes, quality/proficiency/upgrade formulas, modifiers or runes |
| G9 | Step 10.1 | Fracture Echo rank modifiers and rank rewards. Recommended for the first playable: the 1.12^R multiplier only. |
| G10 | Steps 10.2–10.3 | Reincarnation currency conversion, legacy purchases, what mastery does numerically, heirloom scaling |

### Small preference questions

- Which Node version is installed (`node -v`)? Recommended: current LTS.
- npm or pnpm? Recommended: npm, since it ships with Node.
- Keep harness CSV reports out of git and record findings in GAME_DESIGN.md? Recommended: yes.
- Placeholder sprites: colored boxes that switch to your own PNGs when you drop them in `public/sprites/`? Recommended: yes.
- Default viewer speed 1×, with 2× and 4× unlocked during development? Recommended: yes. Mastery-based speed gating comes later.
- Combat log text: plain English sentences with rounded numbers, full precision on expand? Recommended: yes.

## 4. Tech stack recommendation

**Decision (approved 2026-10-21): TypeScript + React + Vite, with the simulation in plain TypeScript. Vitest for tests, tsx to run the harness CLI in Node. No game engine and no state-management library.**

| Option | For | Against | Verdict |
| --- | --- | --- | --- |
| A. TS + React + Vite (DOM, SVG, CSS) | Already the stack in §13. One language for simulation, harness, UI and tests, so the same rules run everywhere. Dashboards, panels, logs and rule editors are React's strength. The node map works as SVG with CSS-animated routes. Text-only files suit a Cursor-driven workflow. The static build can be wrapped by Tauri or Electron later. | No built-in sprite animation, particles or tweening. Large animated scenes would need a canvas later. | **Chosen** |
| B. TS simulation + Phaser or PixiJS canvas (+ React panels) | Real sprite animation, tweens and camera for combat and map. | Adds a second rendering model and a React-to-canvas bridge. Dashboards and logs are awkward in canvas. Not needed for placeholder pixel art. | Defer. If the combat scene outgrows CSS, add PixiJS to that one panel. |
| C. Godot 4 (GDScript or C#) | Good 2D tooling and native desktop export. | Scenes are built in the editor GUI, which the user wants to avoid. C# web export is limited, which weakens the browser-first target. Dashboard UI is more work than in React. | Not needed |

Not considered further: Unity (GUI-heavy, ruled out by the user). A Python balance harness with a TypeScript game would need the rules written twice, and the two copies would drift, which breaks "same rules everywhere". C# Blazor adds a WASM runtime with no benefit here.

**Is a game engine needed? No.** The game is dashboard and system-heavy. Combat is automated and shown as bars, timers, simple sprite states and a log. The map is an illustrated node graph. §13 reaches the same conclusion.

Supporting choices (recommended defaults, change only with a reason):

- **Randomness:** a small in-house seeded PRNG (sfc32 with splitmix32 seeding) whose state is plain JSON. No library.
- **Content:** typed TypeScript data modules (`satisfies` against simulation types), checked by an integrity test. No JSON schema library.
- **UI state:** one hand-written store exposed through React's `useSyncExternalStore`, plus a `requestAnimationFrame` loop. No Redux or Zustand.
- **Styling:** plain CSS files. Pixel art uses `image-rendering: pixelated`.
- **Saves:** versioned JSON in `localStorage`. IndexedDB only if saves outgrow it.
- **Desktop later:** Tauri (small, needs a Rust toolchain) or Electron (larger, pure JS). Decide when packaging starts.

## 5. Project structure under `rpg/`

Create files only when a step needs them. Don't scaffold empty folders or files ahead of time.

```text
rpg/
  doc/
    GAME_DESIGN.md            design source of truth
    IMPLEMENTATION_PLAN.md    this plan
  index.html                  Vite entry
  package.json                scripts: dev, build, test, typecheck, sim, lint
  vite.config.ts              Vite + Vitest config
  tsconfig.json               project references (from the Vite template)
  tsconfig.app.json           browser code: src/ (excluding src/harness)
  tsconfig.node.json          Vite config (from the template)
  tsconfig.harness.json       Node code: src/harness, tests/, plus sim and content
  .gitignore                  node_modules, dist, reports
  public/
    sprites/                  optional placeholder PNGs (<id>.png)
    map/                      placeholder map background
  reports/                    harness CSV output (gitignored)
  tests/
    architecture.test.ts      import-boundary and forbidden-API checks
  src/
    main.tsx                  mounts the React app
    sim/                      pure deterministic rules (no React, DOM, storage, clock, console)
      constants.ts            formula coefficients and STEP_MS
      rng.ts                  seeded PRNG
      types.ts                state, definitions, log events (all JSON-serializable)
      stats.ts                hero and enemy derived stats
      damage.ts               hit, variance, crit, barrier, mitigation pipeline
      combat.ts               createCombat, stepCombat, runCombat
      skills.ts               skill eligibility and effect resolution
      statuses.ts             Bleed, Poison, Burn, Chill, Stun, Mark, Expose
      automation.ts           priority rows, conditions, targeting, manual queue
      enemyAi.ts              enemy skill choice, telegraphs, traits, phases
      log.ts                  formatEvent, summarizeDefeat
      classes/                warrior, assassin, ranger, mage, cleric, index
      races/                  human, elf, beastfolk, undead, index
      expedition.ts           travel, encounter chains, momentum, retreat, defeat (Stage 5)
      progression.ts          XP, levels, attributes, skill webs (Stage 6), reincarnation (Stage 10)
      economy.ts              items, durability, crafting, contracts (Stage 9)
    content/                  data only
      index.ts                builds the GameDefs bundle passed to the simulation
      gear.ts heroes.ts skills.ts enemies.ts encounters.ts scenarios.ts
      webs/                   per-class webs and racial branches (Stage 6)
      world.ts items.ts recipes.ts contracts.ts (Stages 8–9)
    harness/                  Node-only CLI
      cli.ts batch.ts report.ts
    persist/
      save.ts                 versioned localStorage save/load (Stage 7)
    ui/
      App.tsx store.ts loop.ts debug.ts
      combat/ log/ character/ map/ town/
```

Unit tests sit next to the file they test (`stats.test.ts` beside `stats.ts`). Only cross-cutting tests go in `tests/`.

## 6. Architectural boundaries

### Allowed imports

| Layer | May import | Must not import or use |
| --- | --- | --- |
| `src/sim` | other `src/sim` files only | React, DOM globals, `localStorage`, `node:*`, `process`, `src/content`, `src/ui`, `src/persist`, `src/harness`; `Math.random`, `Date`, `performance.now`, `console` |
| `src/content` | `src/sim` (types and pure helpers) | UI, persistence, harness, I/O |
| `src/harness` | `src/sim`, `src/content`, Node APIs | `src/ui`, `src/persist` |
| `src/persist` | `src/sim` types, browser storage | `src/ui`, `src/harness` |
| `src/ui` | `src/sim`, `src/content`, `src/persist` | `src/harness` |

`tests/architecture.test.ts` (Step 0.2) enforces this table.

### Simulation rules

- **Pure and deterministic:** the same definitions, player configuration, seed and commands always produce the same state and log on the same JS engine.
- **Plain data state:** combat and expedition state are JSON-serializable objects (no classes, Maps, Sets or functions). The RNG state lives inside them. The test for both save/load and active-vs-offline parity: serialize mid-run, continue, and compare against an uninterrupted run.
- **Clock comes from outside:** the simulation only advances by fixed `STEP_MS` steps when a caller asks. The UI loop, the harness and a future offline catch-up all call the same step function. Only adapters (UI, persistence) read the wall clock.
- **Definitions are passed in:** `createCombat` and `stepCombat` receive a `GameDefs` bundle (skills, enemies, encounters, gear) instead of importing content. Tests can use tiny fixtures, and the harness can run variants for balance.
- **Logic and data are split:** per-skill and per-enemy numbers live in `src/content`. Formula coefficients live in `src/sim/constants.ts`. Each class's or race's resource rule constants are named exports at the top of its own module.
- **Fixed extension points:** class and race modules plug in through one fixed list of hooks defined in `types.ts` (encounter start/end, action chosen/resolved, damage dealt/taken, kill, outgoing/incoming modifiers, fallback action). Add a hook only when a planned node needs it, and record it in that step's progress line. Modules never reach into combat internals.
- **Closed effect list:** skills use a closed union of effect kinds (damage, heal, barrier, buff, apply status, resource change, action delay, and so on). Add a kind only when a listed skill needs it. No scripting language.
- **The log is the data flow:** every roll, modifier, rule evaluation, resource change and status change is a typed log event with full-precision inputs. Text formatting (`log.ts`) is a separate pure function used by both the CLI and the UI.

### Debug prints (data flow visibility)

- The simulation never prints. Its data flow is the event log.
- Harness: lines start with `[sim]` and show scenario, seed, step size, then the formatted log (single run) or the summary table (batch).
- UI: `src/ui/debug.ts` exports `debugLog(tag, ...)`, which prints `console.debug('[ui]' | '[loop]' | '[save]', ...)` only when `import.meta.env.DEV` is set. Print at boundaries: scenario load, seed, speed change, rule edits, encounter end, save/load with byte size.
- Errors are never swallowed. CLI argument errors exit with code 1 and a message. Save-load failures show a visible UI message and `console.error`.

### Input validation

Treat CLI arguments, UI inputs (seed, hero name, rule rows, attribute allocation) and loaded saves as untrusted. Validate them at the adapter and reject with a clear message. The simulation also checks its command inputs (for example, a manual-queue skill that is not equipped) and logs a rejection event instead of throwing.

### Every step's definition of done

1. `npm run typecheck` and `npm test` pass.
2. Golden snapshot changes are accepted (`npx vitest run -u`) only when the step intends to change outcomes. The progress line says so.
3. New functionality has the debug prints described above.
4. Code marked `// admin code` is never removed or altered.
5. A dated progress line is added to the step.

---

## 7. Stages and steps

Overview:

| Stage | Purpose | Steps |
| --- | --- | --- |
| 0 | Project setup | 0.1–0.2 |
| 1 | Deterministic combat core and harness skeleton | 1.1–1.4 |
| 2 | Combat rules needed for reference simulations | 2.1–2.10 |
| 3 | Reference simulations and balance evidence | 3.1–3.3 |
| 4 | Combat viewer (first UI) | 4.1–4.4 |
| 5 | Expedition simulation (headless) | 5.1–5.4 |
| 6 | Character framework: all races, all classes | 6.1–6.9 |
| 7 | Saves and character UI | 7.1–7.4 |
| 8 | World map and expedition UI | 8.1–8.3 |
| 9 | Items, town, crafting, contracts | 9.1–9.4 |
| 10 | Boss ranks, reincarnation, mastery | 10.1–10.3 |
| 11 | First-playable integration and playtest | 11.1–11.2 |

Stages 0–3 implement §18 (harness, reference simulations, revise from evidence) before any broad UI work. Stage 4 adds a minimal viewer, so the primary question in §14 can be tested early. Steps in Stages 5–11 are outlines. Refine each one when the stage before it is verified and its design gates are closed.

---

### Stage 0: Project setup

### Step 0.1: Scaffold the browser app and tooling
- Status: `verified`
- Depends on: none
- Files: `rpg/package.json`, `rpg/index.html`, `rpg/vite.config.ts`, `rpg/tsconfig*.json`, `rpg/.gitignore`, `rpg/src/main.tsx`, `rpg/src/ui/App.tsx`, `rpg/src/ui/debug.ts`
- Change: Generate the Vite `react-ts` template **in a temporary folder outside `rpg/`** and copy its files into `rpg/`. Never choose "Remove existing files". Delete the demo assets and CSS. Move `App.tsx` to `src/ui/`. Add dev dependencies `vitest`, `tsx` and `@types/node`. Add `tsconfig.harness.json` (Node types, includes `src/harness`, `src/sim`, `src/content`, `tests`) and exclude `src/harness` from `tsconfig.app.json`. Scripts: `dev`, `build`, `lint` (from the template), `test` = `vitest run --passWithNoTests`, `typecheck` = `tsc -b` (covering both app and harness configs), `sim` = `tsx src/harness/cli.ts`. Keep TypeScript `strict`. `.gitignore`: `node_modules`, `dist`, `reports`. `App` shows "RPG – dev build", and `debugLog('[ui]', 'app mounted')` runs on mount.
- Must not change: anything in `rpg/doc/`. Do not run `git init`.
- Acceptance criteria: `npm install`, `npm run typecheck`, `npm test`, `npm run build` all succeed. `npm run dev` serves the page.
- Verification: run the four commands. User: `npm run dev`, open the printed URL, see "RPG – dev build", and see `[ui] app mounted` in the browser console.
- Progress:
  - 2026-10-21: Added the Vite React/TypeScript scaffold, strict app/Node/harness configs, Vitest/tsx tooling, lint config, minimal UI, and `[ui]` mount logging. `npm install`, `npm run typecheck`, `npm test` (no tests yet), `npm run build`, `npm run lint`, and a temporary dev-server HTTP check all passed.
  - 2026-10-22: Verified. `npm install`, `npm run typecheck`, `npm test` (no test files, exit 0), `npm run lint`, and `npm run build` all exited 0. Dev server `http://localhost:5173/` served `App.tsx` with h1 text "RPG – dev build" (U+2013) and `debugLog("[ui]", "app mounted")`; served `debug.ts` calls `console.debug` only when `import.meta.env.DEV` is true. The production bundle keeps the heading and drops the debug strings. Strict mode, harness include/app exclude, gitignore, scripts, no git repo, and no premature sim/content/harness folders match this step. `rpg/doc` design text was unchanged aside from this bookkeeping.

### Step 0.2: Architecture boundary test
- Status: `verified`
- Depends on: 0.1
- Files: `rpg/tests/architecture.test.ts`
- Change: The test walks `src/` and checks each layer against the section 6 import table using regex checks on import specifiers. For `src/sim` it also bans the forbidden APIs listed there. Failure messages name the file, the line and the rule.
- Must not change: app code.
- Acceptance criteria: the test passes on the current tree. Temporarily adding `Math.random()` to a file under `src/sim` makes it fail with that file and line. Revert afterwards.
- Verification: `npm test`. User: none needed beyond seeing the test listed as passing.
- Progress:
  - 2026-10-22: Added `tests/architecture.test.ts`. It walks `src/` and checks section 6 imports with regexes; `src/sim` also bans `Math.random`, `Date`, `performance.now`, `console`, browser storage, `process`, DOM globals, React, and `node:*`. `*.test.ts` / `*.spec.ts` under `src/sim` may import `vitest`. `npm test` passed. Temporary `src/sim/architecture-probe.ts` line 2 `Math.random()` failed with `src/sim/architecture-probe.ts:2: src/sim must not use Math.random`, then the file and empty `src/sim/` were removed. Clean tree: `npm test`, `npm run typecheck`, and `npm run lint` passed.
  - 2026-10-22: Verified. Clean tree: `npm test` (1 file, 1 test), `npm run typecheck`, and `npm run lint` all exited 0. `src/sim/architecture-probe.ts` and `src/sim/` were absent before and after. Failure text is `file:line: rule`. A recreated line-2 `Math.random()` probe failed with `src/sim/architecture-probe.ts:2: src/sim must not use Math.random`. The same run also rejected the section 6 denials (sim allowlist, content UI/persistence/harness/I/O, harness ui/persist, persist ui/harness, ui harness) and allowed sim-to-sim, content-to-sim, harness Node/sim/content, persist storage, ui sim/content/persist/React, and vitest in a sim test. Probes were removed; `npm test` passed again.

---

### Stage 1: Deterministic combat core and harness skeleton

### Step 1.1: Seeded RNG
- Status: `verified`
- Depends on: 0.2
- Files: `src/sim/rng.ts`, `src/sim/rng.test.ts`
- Change: sfc32 PRNG with state stored as a plain `{a,b,c,d}` object, seeded through splitmix32. Pure functions that advance the passed state: `createRng(seed)`, `nextFloat`, `chance(p)`, `uniform(min,max)`, `centeredRoll(min,max)` (the average of two uniforms, §7 "Consistency"), and `deriveSeed(base, index)` for batch and per-encounter seeds. Seeds must be integers in the 32-bit range; reject anything else.
- Acceptance criteria: the same seed gives the same first 1,000 values. A state round-tripped through `JSON.stringify`/`JSON.parse` continues the identical sequence. Different seeds differ. 100,000 `nextFloat` values are all in [0,1) with a mean of 0.49–0.51. `centeredRoll(0.6, 1)` stays in range with a mean of about 0.8. Invalid seeds throw a clear error.
- Verification: `npm test`.
- Progress:
  - 2026-10-22: Added `src/sim/rng.ts` (sfc32 seeded by splitmix32, state `{a,b,c,d}`) and `src/sim/rng.test.ts` (`[rng]` logs for seed, samples, and means). `tests/architecture.test.ts` allows `console` in `src/sim` test files so those logs pass the boundary check; production `src/sim` still bans it. `npm test` passed (2 files, 9 tests), `npm run typecheck` passed, and `npm run lint` passed.
  - 2026-10-22: Verified. `npm test` (2 files, 10 tests, exit 0), `npm run typecheck` (exit 0), and `npm run lint` (exit 0). Same seed repeats 1,000 `nextFloat` values for 0, 1, 2, 42, -1, -2147483648, and 2147483647. Seed 42 JSON round-trip continued the same sequence. Those seeds produced different 1,000-value sequences. 100,000 `nextFloat` values for seed 42 stayed in [0, 1) (low 0.000013538403436541557, high 0.9999961263965815, outside 0) with mean 0.49955238378273786. `centeredRoll(0.6, 1)` stayed in range (low 0.6006984421052038, high 0.9993183658923954, outside 0) with mean 0.7996582125152144. Invalid seeds throw `must be an integer from -2147483648 through 2147483647`. `src/sim/rng.ts` is not a test file and has no architecture violations. Synthetic `src/sim/fixture.ts` fails for `Math.random`, `Date`, `performance.now`, and `console`; `src/sim/fixture.test.ts` may use `console` and still fails the other three.

### Step 1.2: Derived stats and formula constants
- Status: `verified`
- Depends on: 1.1
- Files: `src/sim/constants.ts`, `src/sim/stats.ts`, `src/sim/stats.test.ts`, `src/content/gear.ts`, `src/content/heroes.ts`
- Change: Implement the §7 "Combat mathematics" hero formulas (max HP, physical/magical/healing power, accuracy, evasion, crit chance and damage, action time with its 0.5 s floor, cooldown reduction with its 50% cap, innate penetration with the 80% total cap, Defense reduction with its 80% cap, resource-generation bonus, XP bonus, out-of-combat regeneration, healing-received bonus) and the XP curve. Implement the §9 equipment math: weapon kinds, off-hands, armor categories, slot shares, light-set Evasion, and the 90% off-preference effectiveness. Implement §7 "Enemy balance framework" stat blocks: level, archetype, elite multipliers, per-enemy overrides, rounding after multipliers. `content/heroes.ts` defines the five §9 reference heroes as attributes plus gear specs.
- Must not change: any GAME_DESIGN value. If a number cannot be reproduced, stop and report it as `blocked`.
- Acceptance criteria: tests reproduce every §9 reference-hero number for all five classes at the precision shown (for example Warrior 370 HP, 96 Physical Power, 116 Armor, 60 Resistance, 11.4% crit, 162% crit damage, 12.97% penetration, 12.12% resource bonus, 1.72 s action; Assassin 89.04 Physical Power and 36 Evasion). Standard level-20 enemy × Warden multipliers gives 3,840 HP, 36 Power and 68 Armor/Resistance. Each archetype multiplier has one test. Cumulative XP to level 20 is about 33,600.
- Verification: `npx vitest run src/sim/stats.test.ts`. User: compare the passing test names with §9.
- Progress:
  - 2026-10-22: Added `src/sim/constants.ts`, `src/sim/stats.ts`, `src/sim/stats.test.ts`, `src/content/gear.ts`, `src/content/heroes.ts`, and `src/content/heroes.test.ts` (content check; `src/sim` tests cannot import `src/content`). Published reference-hero stats, Warden 3840/36/68, each archetype multiplier, the caps, and invalid inputs match GAME_DESIGN. Cumulative XP to level 20 is 33567 from `round(50 × level^1.5)`, about 33600. `npm test` passed (4 files, 35 tests), `npm run typecheck` passed, and `npm run lint` passed.
  - 2026-10-22: Verified. `npx vitest run src/sim/stats.test.ts` passed (1 file, 23 tests, exit 0). `npm test` passed (4 files, 35 tests, exit 0). `npm run typecheck` and `npm run lint` exited 0. Published level-20 figures match at the shown precision for Warrior (370 HP, 96 Physical Power, 116 Armor, 60 Resistance, 16 Accuracy, 16 Evasion, 11.4% crit, 162% crit damage, 12.97% penetration, 12.12% resource bonus, 1.72 s), Assassin (310 HP, 89.04 Physical Power, 49 Armor, 56 Resistance, 30 Accuracy, 36 Evasion, 17% crit, 159% crit damage, 10.59% penetration, 8.33% resource bonus, 1.15 s), Ranger (330 HP, 96.8 Physical Power, 70/70 Armor/Resistance, 28/28 Accuracy/Evasion, 16.2% crit, 161% crit damage, 12.22% penetration, 8.33% resource bonus, 1.72 s), Mage (310 HP, 130.4 Magical Power, 35 Armor, 98 Resistance, 16/16 Accuracy/Evasion, 11.4% crit, 155% crit damage, 16.19% magical penetration, 12.14% cooldown reduction, 9.68% resource bonus, 1.72 s), and Cleric (370 HP, 88 Magical Power, 44 Healing Power, 88/88 Armor/Resistance, 14/14 Accuracy/Evasion, 10.6% crit, 155% crit damage, 11.43% magical penetration, 8.57% cooldown reduction, 15.28% resource bonus, 1.75 s). Level-20 standard × Warden multipliers is 3840 HP, 36 Power, and 68 Armor/Resistance. Swarm, skirmisher, standard, tank, burst, and support each have a multiplier test. Cumulative XP to level 20 is 33567, 33 away from about 33600. Invalid level, missing gear, an item level above the hero, and a two-handed off-hand throw the asserted messages. `src/sim` does not import content; the architecture test passed, so production sim still bans the forbidden APIs.

### Step 1.3: Combat state, log, and basic-attack duel
- Status: `verified`
- Depends on: 1.2 (Q2 and Q3 decided)
- Files: `src/sim/types.ts`, `src/sim/damage.ts`, `src/sim/combat.ts`, `src/sim/log.ts`, tests next to each, `src/content/enemies.ts`, `src/content/scenarios.ts`, `src/content/index.ts`
- Change: JSON-serializable `CombatState` (time in ms, RNG state, hero, enemies, log, outcome). `createCombat(setup, defs, seed)`, `stepCombat(state, defs)` (one `STEP_MS` = 10 step), `runCombat(state, defs, maxMs)` (ends as `victory`, `defeat` or `timeout`). Clock, scheduling and tie order follow GAME_DESIGN §7 "Simulation clock and action timing" exactly. Basic attack: hit chance clamped to 5–95%, centered Consistency roll, crit roll, Defense reduction by attacker level, rounding, a minimum of 1 on an unshielded hit. `damage.ts` takes roll values as arguments so tests can fix them. Typed events: encounter start, action, hit roll, damage (all inputs), death, encounter end. `formatEvent` produces English text. Scenario `duel-basic`: level-20 reference Warrior against a level-20 Standard dummy, basic attacks only.
- Acceptance criteria: the damage pipeline with fixed rolls matches hand-computed values, including both hit-chance clamps. The same seed run twice gives deep-equal state and log. Serializing at t=5,000 ms and continuing gives a final log identical to an uninterrupted run. A golden snapshot test pins the formatted log of `duel-basic` with seed 42.
- Verification: `npm test`.
- Progress:
  - 2026-10-22: Added JSON combat state, 10 ms stepping, basic-attack damage, the typed log, and scenario `duel-basic`. Files: `src/sim/types.ts`, `damage.ts`, `combat.ts`, `log.ts`, their tests, combat coefficients in `src/sim/constants.ts`, `src/content/enemies.ts`, `scenarios.ts`, `scenarios.test.ts`, `index.ts`, and the seed-42 snapshot. Empty clock hooks for expiries, periodic ticks, and telegraph resolutions; no class hook. Accuracy and Evasion are percentage points in the hit formula, and the basic attack coefficient is 1. Seed 42 wins at 20.688 s. `npm test` passed (8 files, 62 tests), `npm run typecheck` passed, and `npm run lint` passed.
  - 2026-10-22: Verified. `npm test` passed (8 files, 62 tests, exit 0) on the Step 1.3 tree, and a later full-suite recheck passed (13 files, 96 tests, exit 0). `npm run typecheck` and `npm run lint` exited 0 both times. Combat state is plain JSON: seed 42 serialized at t=5000 ms and continued matches the uninterrupted state and log. Production `src/sim` imports only `src/sim`; the architecture test still bans `Math.random`, `Date`, `console`, and `performance.now` there. `stepCombat` advances 10 ms. The Warrior's first action is at 1724 ms, and the next ready time is 3448 ms while the clock is 1730 ms. Equal ready times resolve the hero, then enemies by slot, after expiry, tick, and telegraph handling. Fixed rolls match the pipeline: 5% and 95% hit clamps, Warrior 96×0.8 vs 45 Armor rounds 60.900 to 61, the same hit crits to 99, half-up rounding sends 2.5 to 3 and 3.5 to 4, an unshielded 0.12 becomes 1 HP, and a barrier can reduce HP damage to 0. Two seed-42 runs are deep-equal. The `duel-basic` snapshot passed: victory, encounter end at 20.688 s (20688 ms), clock 20690 ms, hero 296/370 HP. Missing hero, no enemies, a non-integer seed, and an unknown enemy throw the asserted messages.
  - 2026-10-22: Verified. `npm test` (8 files, 69 tests, exit 0), `npm run typecheck` (exit 0), and `npm run lint` (exit 0). Combat state is plain JSON: time in ms, RNG `{a,b,c,d}`, hero, enemies, log, and outcome. `createCombat`, one 10 ms `stepCombat`, and `runCombat` cover victory, defeat, and timeout. Within a step the order is expiries, periodic ticks, telegraph resolutions, then actions by scheduled time, hero before enemies, enemies by slot. Recovery is added to the previous ready time. The first action is one rounded base action time after start (Warrior 1724 ms, Standard dummy 2200 ms). Nobody acts at t=0. Damage tests hand-compute both hit-chance clamps, the centered Consistency roll, a separate crit roll, defense reduction by attacker level, half-up rounding, and at least 1 damage on a successful unshielded hit. Seed 42 `duel-basic` is the level-20 reference Warrior versus a level-20 Standard dummy, basic attacks only: victory, encounter log ends at 20688 ms, clock finishes that step at 20690 ms. The same seed is deep-equal, and JSON at t=5000 ms continues to the same final log. The golden snapshot matches. `src/sim` does not import content or use banned APIs, and production sim does not print.

### Step 1.4: Harness CLI with single and batch modes
- Status: `verified`
- Depends on: 1.3
- Files: `src/harness/cli.ts`, `src/harness/batch.ts`, `src/harness/batch.test.ts`
- Change: `runBatch(scenarioId, baseSeed, runs)` uses `deriveSeed(base, i)` per run and returns win rate, duration mean/p10/p50/p90, mean hero HP lost %, and timeout count. It does no printing. The CLI parses `--scenario`, `--seed`, `--runs`, `--list` and validates them (unknown scenario lists the valid ones; non-integer seed or runs < 1 exit with code 1). A single run prints a `[sim]` header (scenario, seed, `STEP_MS`), then the formatted log, then the outcome. Batch mode prints the summary, then a separate `[sim] runs/sec` timing line.
- Acceptance criteria: running the same command twice prints identical output apart from the timing line. `runBatch` twice with 20 runs gives equal results. An invalid scenario exits non-zero with a message.
- Verification: `npm run sim -- --scenario duel-basic --seed 42`, `npm run sim -- --scenario duel-basic --seed 42 --runs 500`, `npm run sim -- --scenario nope`. User: run them, read the log, run the first one again and confirm the log is identical.
- Progress:
  - 2026-10-22: Added `src/harness/batch.ts`, `src/harness/batch.test.ts`, and `src/harness/cli.ts`. `runBatch` uses `deriveSeed(base, i)` with i from 0 and returns win rate, duration mean/p10/p50/p90, mean hero HP lost percent, and timeout count, without printing. The CLI prints a `[sim]` header, the formatted log, and the outcome for one run, or the summary plus one `[sim]` runs/sec line. Fights stop at 10 simulated minutes. Seed 42 `duel-basic` ended `victory` at 20688 ms. `npm test` passed (9 files, 71 tests), `npm run typecheck` passed, and `npm run lint` passed. Two single runs matched, including no timing line. Two 20-run batches matched apart from the timing line. `npm run sim -- --scenario nope` exited 1 and named `duel-basic`. `--runs 500` succeeded (win rate 1, 0 timeouts).
  - 2026-10-22: Verified. `npm test` passed (10 files, 75 tests, exit 0), `npm run typecheck` exited 0, and `npm run lint` exited 0. `runBatch('duel-basic', 42, 20)` matches fights seeded with `deriveSeed(42, i)` for i from 0, does not print, and returns win rate 1, duration mean 20343.2 ms, p10 15343.6, p50 20688, p90 24136, mean hero HP lost 25.851351351351347%, and 0 timeouts. A one-run batch matches index 0 and not index 1. `npm run sim -- --scenario duel-basic --seed 42` twice printed the same stdout: `[sim] scenario duel-basic seed 42 STEP_MS 10`, the formatted log, and `[sim] outcome victory durationMs 20688`, with no runs/sec line. Two `--runs 20` commands and two `--runs 500` commands matched apart from one `[sim] runs/sec` line. `--runs 500` was win rate 1, duration mean 19077.784 ms, p10 13792, p50 18964, p90 24136, mean hero HP lost 24.89945945945946%, and 0 timeouts. `--scenario nope` exited 1 and listed `duel-basic`. Seed `1.5` and `--runs 0` exited 1 with a clear message. `--list` printed `duel-basic`. `src/harness` does not import ui or persist. Production `src/sim` does not print.

---

### Stage 2: Combat rules for reference simulations

Use fixture skills and enemies inside test files where real content doesn't exist yet. Every step adds at least one runnable harness scenario.

### Step 2.1: Active skills, effects, and unconditional priority rows
- Status: `verified`
- Depends on: 1.4, Q7
- Files: `src/sim/types.ts`, `src/sim/skills.ts`, `src/sim/automation.ts`, `src/content/skills.ts`, `src/content/content.test.ts`, tests
- Change: `SkillDef` data with cost, cooldown, action-time coefficient, tags, equipment requirement, target mode (single or all), and an effect list from the closed union: damage, heal (90–100% roll per Q7), pre-mitigation barrier with a duration, "until next action" buffs (damage reduction, Evasion, incoming-damage multiplier), and action delay. Cooldowns start on resolution and use cooldown reduction. Active skills don't roll to hit. Priority rows without conditions: the first eligible row wins, with the weapon basic attack as the fallback. The log shows every row skipped and the reason. `content.test.ts` checks unique ids and that every reference resolves.
- Must not change: the `duel-basic` golden snapshot.
- Acceptance criteria: tests cover the cooldown reduction cap, the action-time floor, barrier absorption before Defense with overflow mitigated, a barrier absorbing a whole hit for 0 HP, and multiplying incoming-damage multipliers (1.25 × 1.20 = 1.50).
- Verification: `npm test`.
- Progress:
  - 2026-10-22: Added skill definitions, effect resolution, and unconditional priority rows. Q7 is unanswered; healing uses the centered roll on half-open [0.90, 1.00), same distribution as damage. A positive skill cost is unaffordable until class resources exist. Files: `src/sim/types.ts`, `skills.ts`, `skills.test.ts`, `automation.ts`, `automation.test.ts`, `damage.ts`, `combat.ts`, `combat.test.ts`, `log.ts`, `log.test.ts`, `constants.ts`, `src/content/skills.ts`, `content.test.ts`, `scenarios.ts`, `scenarios.test.ts`, `index.ts`, `src/harness/cli.test.ts`, `batch.test.ts`. `npm test` passed (13 files, 96 tests), `npm run typecheck` passed, and `npm run lint` passed. `npm run sim -- --scenario driving-blow --seed 42` ended victory at 17240 ms. `npm run sim -- --scenario duel-basic --seed 42` still ended victory at 20688 ms. The duel-basic golden snapshot was not changed.
  - 2026-10-22: Verified. `npm test` passed (13 files, 96 tests, exit 0), `npm run typecheck` exited 0, and `npm run lint` exited 0. Active skills do not log a hit roll; hero and enemy basic attacks still do. Cooldown reduction above 50% schedules an 8s cooldown at 4s (ready at 5724 ms). A 0.1 action-time coefficient floors at 0.5s and is added to the previous ready time (1724 + 500). Barrier 40 absorbs before Defense on after-crit 100, overflow 60 mitigates to 40 HP, and a full absorb deals 0 HP. Incoming multipliers 1.25 × 1.20 resolve to 1.50 on the next hit. The first eligible unconditional row wins, each skip is logged with one reason, and the weapon basic attack is the fallback. A combat heal roll equals `centeredRoll` on [0.90, 1.00) and differs from one uniform draw. `content.test.ts` checks unique ids and resolved references. `npm run sim -- --scenario driving-blow --seed 42` exited 0: victory at 17240 ms; the first action is Driving Blow at 1.724s with no hit roll. `npm run sim -- --scenario duel-basic --seed 42` exited 0: victory at 20688 ms, and the golden snapshot still matches. Production `src/sim` does not import content or use `console`.

### Step 2.2: Statuses
- Status: `verified`
- Depends on: 2.1, Q8, Q9
- Files: `src/sim/statuses.ts`, `src/sim/types.ts`, tests
- Change: Implement §7 "Status application" and "Initial status set": Bleed (stacks, 3 target actions, ticks when the target acts), Poison (shared duration, ticks every 2 s), Burn (intensity 1–5, ticks every 1 s), Chill (10/7/5% slow), Stun (pushes the next action 1.5 s), Mark, Expose (only the strongest applies). Application chance = clamp(5%, 95%, base + Potency − Resistance). DoTs snapshot the source at application and tick against current Defense with no roll and no crit. Contact statuses are blocked when a barrier absorbs the whole hit. Boss rules: about 60% of stack caps, 50% duration, Stun at 35%. Speed changes per Q9.
- Acceptance criteria: one test per status rule, including the boss caps, contact blocking, and Bleed ticking faster on a faster target.
- Verification: `npm test`.
- Progress:
  - 2026-10-22: Added Bleed, Poison, Burn, Chill, Stun, Mark, and Expose. Q8 is unanswered; DoT ticks always bypass barriers, including a barrier that existed before the DoT, and still use current Defense. Q9 is unanswered; Chill does not move an already scheduled action and applies when the next recovery is scheduled, while Stun still pushes that action and does not freeze cooldowns. Application chance is clamp(5%, 95%, base + Potency − Resistance) in percentage points. Potency is Intellect plus equipment and skill potency and does not change tick damage. Physical resistance uses Vitality; magical uses Spirit. Bleed and Poison are physical contact statuses. Burn and Chill are magical. Stun and Expose use the skill's physical or magical tag. Mark does not roll. Boss stack caps use round(normal × 0.6): 3, 3, 3, and 2. Boss durations are half. Bleed's 3 actions are not halved. Boss Stun is 525 ms. A tick due at the exact expiry time does not fire, because expiries run first, so an 8 s Poison ticks at 2, 4, and 6 s. Stun is an immediate push, not a lingering cleansable status. Cleanse priority is Bleed, Poison, Burn, Chill, Expose, Mark. Expose keeps the strongest fraction per defense and a weaker application still refreshes the duration. Venom Edge has no listed resource cost, so its cost is 0, and its unstated base chance is 100% before the clamp. Scenario `venom-edge` seed 42: victory at 12346 ms. `duel-basic` seed 42 stayed victory at 20688 ms. `driving-blow` seed 42 stayed victory at 17240 ms. The duel-basic snapshot was not changed. `npm test` passed (14 files, 121 tests), `npm run typecheck` passed, and `npm run lint` passed.
  - 2026-10-22: Verified. `npm test` passed (14 files, 121 tests, exit 0), `npm run typecheck` exited 0, and `npm run lint` exited 0. Application chance clamps to 5%–95% from base + Intellect + equipment potency + skill potency − Vitality (physical) or Spirit (magical), and potency does not change tick power or coefficient. Bleed and Poison are physical contact statuses; Burn and Chill are magical; Stun and Expose follow the skill tag; Mark does not roll. Bleed is 5 stacks of 3 target actions (boss cap 3, actions not halved) and a 1 s target ticks more often than a 3 s target. Poison is 5 stacks, 8 s refresh, combined ticks at 2/4/6 s (boss 3 stacks, 4 s). Burn intensity caps at 5 with a 5 s refresh and 1 s ticks (boss intensity 3, 2.5 s). Chill slows action speed by 10/17/22% (2200 ms becomes 2444/2651/2821 ms), refreshes 6 s, and does not move an already scheduled action (boss cap 2, 3 s). Stun pushes the scheduled action 1.5 s without moving cooldowns (boss 525 ms). Expose keeps the strongest Armor and Resistance fractions and a weaker reapplication still refreshes 8 s (boss 4 s). DoT ticks snapshot power, penetration, and coefficient, use current Defense, skip variance and crit, and bypass a barrier that was already present. A full barrier absorb blocks Bleed and Poison without a roll; a partial absorb still rolls Bleed; Burn, Chill, Stun, Expose, and Mark still apply through a full absorb. Cleanse removes one selected or highest-priority status and all of its stacks. Boss scaling is caps and durations only; no immunity was added. `npm run sim -- --scenario venom-edge --seed 42` exited 0: victory at 12346 ms. `duel-basic` seed 42 exited 0: victory at 20688 ms, and the golden snapshot still matched. `driving-blow` seed 42 exited 0: victory at 17240 ms. Production `src/sim` does not import content or use `print`, `Math.random`, `Date`, `performance.now`, or `console`.

### Step 2.3: Automation conditions and target priorities
- Status: `todo`
- Depends on: 2.2, Q11, Q13
- Files: `src/sim/automation.ts`, tests
- Change: Up to 12 rows. Hero conditions: HP %, class resource, barrier, own status, special ammo. Enemy conditions: enemy count, target HP %, type or rank, status, Mark, boss phase, telegraph tag and time to resolution. Operators: at most, at least, equal, not equal, present, absent. Global target priority plus per-row override: current, lowest or highest HP %, lowest Armor, lowest Resistance, Marked, acting soonest, random (seeded). Leave out "Most dangerous" (Q13). Armor and Resistance priorities need the target's `revealed` flag (Q11). Add `setPriorityRules(state, rules)`, which takes effect at the next evaluation and logs a `rulesChanged` event. Invalid rows (unknown skill, more than 12 rows) are rejected and logged.
- Acceptance criteria: tests show OR behaviour through repeated rows, a failing condition falling through to the next row, per-row target override, and an unrevealed priority being skipped and logged.
- Verification: `npm test`.
- Progress:

### Step 2.4: Class module contract, Warrior, and Mage
- Status: `todo`
- Depends on: 2.3, Q6
- Files: `src/sim/types.ts` (hook list), `src/sim/classes/index.ts`, `warrior.ts`, `mage.ts`, `src/content/skills.ts`, `src/content/scenarios.ts`, tests
- Change: Define the hook list (section 6), resource scope (encounter or expedition), basic-attack gain normalization by weapon time ÷ 2.0, and the Spirit multiplier. Warrior: §4 Fury rules (5 per generator, HP-loss Fury, 20 cap per hit, held-Fury bonus up to +25%, a spender snapshots the bonus and then pays) and all six §7 Warrior skills with their equipment requirements. Out-of-combat drain waits until Step 5.1. Mage: §4 Mana rules (100 max, starts full, 2/s in combat, no basic attack, Arcane Bolt fallback per Q6, waits and logs once when it can't afford anything) and all six §7 Mage skills. Chain Lightning jumps at 75% per jump and pushes each hit target 0.25 s.
- Acceptance criteria: unit tests for every listed resource rule. Scenarios `warrior-vs-standard` and `mage-vs-standard` run to an outcome.
- Verification: `npm test`, `npm run sim -- --scenario mage-vs-standard --seed 1`. User: read the log and check that Fury and Mana changes appear on each relevant line.
- Progress:

### Step 2.5: Assassin and Ranger
- Status: `todo`
- Depends on: 2.4, Q10, Q14
- Files: `src/sim/classes/assassin.ts`, `ranger.ts`, `src/content/skills.ts`, `src/content/scenarios.ts`, tests
- Change: Assassin: Advantage 0–5, at most one gain per action, a visible fractional accumulator, loss at encounter end, Mark for Death rules (one target, moves, 8 s, attacks refresh it to at least 8 s, at most 12 s), and all six skills including the Execute formula. Ranger: Readiness 0–100. The starting value comes from the encounter setup (harness default 100, per §4 calibration). +10 per successful basic (normalized). One armed Snare Trap at a time. Hunter's Mark sets `revealed`. Flame Arrow uses quiver ammo (Q14). All six Ranger skills.
- Acceptance criteria: tests for the one-gain cap, fractional progress under Spirit, Mark moving and its 12 s cap, the Execute formula, a single armed trap, and Flame Arrow becoming ineligible at 0 arrows.
- Verification: `npm test`, plus one harness scenario per class.
- Progress:

### Step 2.6: Cleric
- Status: `todo`
- Depends on: 2.5
- Files: `src/sim/classes/cleric.ts`, `src/content/skills.ts`, `src/content/scenarios.ts`, tests
- Change: Faith 0–100, starts at 0, lasts for the expedition. The three vows from §4, chosen in setup. All six skills: Consecration as one field that is refreshed when recast; Penance bypasses barriers and Defense and can't be used if it would be fatal.
- Acceptance criteria: tests for each vow's trigger and cap, a Temperance failure after overheal, the Penance fatality block, and Consecration replacing the existing field.
- Verification: `npm test`, plus a harness scenario.
- Progress:

### Step 2.7: Enemy framework and Splintered Road enemies
- Status: `todo`
- Depends on: 2.6, Q15
- Files: `src/sim/enemyAi.ts`, `src/content/enemies.ts`, `src/content/encounters.ts`, tests
- Change: `EnemyDef` with level range, archetype, overrides, authored skills (coefficient, cooldown, telegraph ms, tags, `canCrit`, effects), filler attack, and traits as small named handlers. AI: use the first ready authored skill in listed order, otherwise the filler. Telegraphs are logged with their tag and resolution time, are visible to automation, and are postponed by Stun or delay but not by damage. Multi-enemy encounters. Encounter XP from §7 (baseline, archetype multiplier, group discount, no XP for summons). Enemies: Fracture Shardling (death burst cancelled when the encounter ends), Starved Wolf (Pack Hunter, Pounce), Deserter (Rusted Cut, Guard).
- Acceptance criteria: a test for each enemy mechanic, a test that Stun postpones Pounce, and a test of the group XP discount.
- Verification: `npm test`, `npm run sim -- --scenario warrior-vs-wolf-pair --seed 3`. User: find the Pounce telegraph and its resolution in the log.
- Progress:

### Step 2.8: Withered Grove and Fallen Bastion regular enemies
- Status: `todo`
- Depends on: 2.7
- Files: `src/sim/enemyAi.ts`, `src/content/enemies.ts`, `src/content/encounters.ts`, tests
- Change: Blight Spider, Thornbeast (regeneration paused by Burn, halved by Expose), Fracture Wisp, Hollow Sentry (Shield Wall on itself plus one ally), Fallen Arbalist (Reload at −20 Evasion), Oathbound Echo (Ward on the ally with the lowest barrier, Mend on an ally). Add ally targeting to the AI.
- Acceptance criteria: a test for each listed mechanic.
- Verification: `npm test`, plus one mixed-encounter scenario per zone.
- Progress:

### Step 2.9: Elites
- Status: `todo`
- Depends on: 2.8
- Files: `src/sim/enemyAi.ts`, `src/content/enemies.ts`, tests
- Change: Rootmaw Stalker (§6 stat override; Grasping Roots is interrupted when the hero deals 10% of its max HP during the telegraph). Echo Knight (stance switch every 10 s; at 60% HP, a 2 s telegraph summons a level-16 Oathbound Echo that gives no XP).
- Acceptance criteria: stats match §6. Tests cover the interrupt and the summon.
- Verification: `npm test`, plus an elite scenario for each.
- Progress:

### Step 2.10: The Fractured Warden
- Status: `todo`
- Depends on: 2.9
- Files: `src/sim/enemyAi.ts`, `src/content/enemies.ts`, tests
- Change: The three HP-threshold phases from §6 and their skill sets. Blade and Ward Echoes summoned on the phase-2 transition with stats relative to the Warden. Phase-3 stacks every 8 s up to 5. Boss-phase events visible to automation. Echo rank R multiplies HP, Power, Armor and Resistance by 1.12^R (rank modifiers wait for G9).
- Acceptance criteria: rank-0 stats match §6. Tests cover phase transitions, Echo stats, the stack cap, and rank-2 multipliers.
- Verification: `npm test`, `npm run sim -- --scenario warrior-vs-warden --seed 7`. User: find the phase-change and summon lines in the log.
- Progress:

---

### Stage 3: Reference simulations and balance evidence

### Step 3.1: Reference scenario matrix
- Status: `todo`
- Depends on: 2.10, Q4, Q5
- Files: `src/content/heroes.ts`, `src/content/scenarios.ts`, tests
- Change: Level-L reference-hero generator (Q5). Default loadouts and rows (Q4). A `reference` matrix covering, for each class: every regular enemy alone at the middle of its level band against an equal-level hero; one mixed group per zone; both elites at their own level; and the Warden at rank 0 against the level-20 heroes. Scenario ids look like `ref-<class>-<encounter>`.
- Acceptance criteria: the level-20 generator output equals the §9 heroes exactly. Every matrix scenario runs one seed to an outcome without errors.
- Verification: `npm test`, `npm run sim -- --list`.
- Progress:

### Step 3.2: Batch report against design targets
- Status: `todo`
- Depends on: 3.1, Q12
- Files: `src/harness/report.ts`, `src/harness/cli.ts`, `src/sim/log.ts` (`summarizeDefeat`), tests
- Change: `npm run sim -- --matrix reference --runs 300 --seed 1` prints a class × encounter table: win %, duration p10/p50/p90, mean HP attrition, timeouts, top defeat cause, and XP per simulated hour. Each row is flagged against its §7 target: equal-level standard fights take 8–12 s with 10–20% attrition, and a successful Warden fight takes 60–90 s. The same table goes to `reports/<date>-reference.csv`. `summarizeDefeat` returns the last HP-loss events and active statuses before death, and the UI reuses it in Step 4.3. Performance budget: 1,000 Warden runs in under 30 s. Print the measured runs/sec.
- Acceptance criteria: the report is deterministic for a fixed seed (apart from timing). `summarizeDefeat` has a unit test. The performance budget is met, or the measured gap is recorded in Progress.
- Verification: run the matrix command. User: open the CSV in a spreadsheet and spot-check one row against a single-seed log.
- Progress:

### Step 3.3: Balance review and coefficient revision
- Status: `todo`
- Depends on: 3.2
- Files: `rpg/doc/GAME_DESIGN.md` (decided numbers and changelog line), `src/sim/constants.ts`, `src/content/*.ts`, golden snapshots
- Change: This step is led by the user (main chat or brainstormer). Review the report and decide which coefficient, skill and enemy changes to make, and the stacking-pressure numbers (Q12). Record the decisions in GAME_DESIGN.md first. The implementer then updates constants and content, and accepts the golden snapshot changes.
- Acceptance criteria: the GAME_DESIGN changelog has a dated entry. A rerun of the matrix meets the targets, or GAME_DESIGN records the accepted deviations. Progress lists the before and after headline numbers.
- Verification: rerun the matrix. User: confirm the decisions in GAME_DESIGN.md read correctly.
- Progress:

---

### Stage 4: Combat viewer (first UI)

### Step 4.1: Store and game loop
- Status: `todo`
- Depends on: 3.2
- Files: `src/ui/store.ts`, `src/ui/loop.ts`, `src/ui/loop.test.ts`, `src/ui/App.tsx`
- Change: A store holding `CombatState`, exposed through `useSyncExternalStore`. A `requestAnimationFrame` loop with an accumulator that runs whole `STEP_MS` steps for elapsed time × speed, at most 250 ms of catch-up per frame, and notifies subscribers once per frame. Controls: scenario select (from `content/scenarios.ts`), seed input (validated integer), restart with the same seed, new random seed (the UI may use `crypto.getRandomValues`), pause, and 1×/2×/4× speed. `debugLog` lines for each control.
- Acceptance criteria: `loop.test.ts` shows that irregular fake frame times give a final state equal to `runCombat` for the same seed. In the browser, restarting with the same seed replays identically.
- Verification: `npm test`. User: `npm run dev`, pick `ref-warrior-…`, enter seed 42, run it to the end, and compare the outcome line with `npm run sim -- --scenario <same> --seed 42`.
- Progress:

### Step 4.2: Combat panel with placeholder sprites
- Status: `todo`
- Depends on: 4.1
- Files: `src/ui/combat/*.tsx`, `src/ui/combat/combat.css`, optional `public/sprites/`
- Change: Hero and enemy cards: a sprite (`/sprites/<id>.png`, falling back to a colored box with initials on load error, `image-rendering: pixelated`), HP, barrier and resource bars, cooldown overlays on the four skills, a telegraph bar with its tag and countdown, status badges with stacks and remaining time, the boss phase, and a short "act" bump animation in CSS.
- Must not change: simulation code.
- Acceptance criteria: every value shown comes straight from `CombatState`. No game logic lives in components.
- Verification: `npm run typecheck`. User: watch a Warden fight at 1× and confirm the telegraph bars, status badges and phase indicator update visibly.
- Progress:

### Step 4.3: Log panel and outcome summary
- Status: `todo`
- Depends on: 4.2
- Files: `src/ui/log/*.tsx`
- Change: The formatted log with category filters (damage/heal, rolls, statuses, automation, resources, retreat, defeat cause), a "follow" toggle, a click on a row to show the full-precision payload, and only the last 500 rows rendered, with a "show all" option. After the fight, an outcome card with the cause chain from `summarizeDefeat`.
- Acceptance criteria: filters hide and show the right event types. The card appears for victory, defeat and timeout.
- Verification: User: lose a fight on purpose (for example Mage against the Warden) and confirm the card and filtered log explain why.
- Progress:

### Step 4.4: Manual skill queue
- Status: `todo`
- Depends on: 4.3
- Files: `src/sim/automation.ts`, tests, `src/ui/combat/*.tsx`
- Change: `queueManualAction(state, skillId)` (§7 "Automation"): used at the next action, skips row conditions but not eligibility, and logs a cancellation if the skill becomes ineligible first. The UI shows a queue button on each skill that is ready.
- Acceptance criteria: tests for use, for cancellation, and for rejecting a skill that isn't equipped.
- Verification: `npm test`. User: queue Second Wind at high HP and confirm the log marks it as manual. Write a short note in Progress on whether watching combat is satisfying (the §14 primary question).
- Progress:

---

### Stage 5: Expedition simulation (headless)

### Step 5.1: Expedition runner and between-encounter rules
- Status: `todo`
- Depends on: 4.4
- Files: `src/sim/expedition.ts`, `src/sim/classes/*.ts`, `src/content/encounters.ts`, `src/harness/cli.ts`, tests
- Change: `ExpeditionState` and `stepExpedition`. Travel segments: out-of-combat regeneration, Mana at 5/s, Readiness at 5/s, Fury waiting 3 s then draining 10/s, per-class persistence rules. Each encounter is drawn from the zone table with the seeded RNG. HP and resources carry over between encounters. Encounter seeds come from `deriveSeed(expeditionSeed, index)`. The CLI gets `--expedition <id>`.
- Acceptance criteria: deterministic. Serializing mid-travel and mid-combat gives identical results. Tests for each between-encounter rule.
- Verification: `npm test`, `npm run sim -- --expedition splintered-road --seed 5`.
- Progress:

### Step 5.2: Momentum, unsecured loot, and returning to town
- Status: `todo`
- Depends on: 5.1, G1
- Files: `src/sim/expedition.ts`, `src/content/enemies.ts` (loot tables), tests
- Change: Momentum 0–5 (+1 regular, +2 elite), +5% material quantity and +2 pp rare-node chance per stack, reset rules from §8. Unsecured loot is capped by loot capacity (G1). A `returnToTown` command starts a safe return trip that secures the loot.
- Acceptance criteria: tests for gaining momentum, the cap, every reset, and loot being secured only on arrival.
- Verification: `npm test`, plus the harness expedition summary showing momentum and loot.
- Progress:

### Step 5.3: Retreat and escape
- Status: `todo`
- Depends on: 5.2, G2
- Files: `src/sim/expedition.ts`, `src/sim/automation.ts`, tests
- Change: Player-configured retreat thresholds. The escape roll uses the G2 formula and the roll is logged. Enemies keep acting. Failed attempts retry after a cooldown. A successful escape returns safely and resets momentum. Boss-progress loss per G2.
- Acceptance criteria: tests for a successful escape, a failure followed by a retry, and the threshold trigger.
- Verification: `npm test`. User: in the harness log, find an escape roll and its inputs.
- Progress:

### Step 5.4: Defeat outcome
- Status: `todo`
- Depends on: 5.3, G3
- Files: `src/sim/expedition.ts`, `src/sim/types.ts` (durability on equipped items), tests
- Change: Apply §8 defeat: unsecured loot lost, durability damage (an item at 0 is disabled, never destroyed), consumed supplies stay consumed, unused supplies kept, rescue fee paid from carried gold with the rest becoming debt, a recovery delay. Set `bossLossThisLife` when the defeat was against a boss.
- Acceptance criteria: one test per consequence.
- Verification: `npm test`.
- Progress:

---

### Stage 6: Character framework (all races, all classes)

§14 requires all four races and five classes to work as a framework before any single pairing becomes the main focus. Steps 6.4–6.8 follow the same pattern: node data in `src/content/webs/<class>.ts`, effects through the existing hooks in `src/sim/classes/<class>.ts`, and one test per node.

### Step 6.1: XP, levels, and attribute allocation
- Status: `todo`
- Depends on: 5.4
- Files: `src/sim/progression.ts`, `src/content/heroes.ts` (race starting attributes), tests
- Change: XP gain with level-difference modifiers and the Spirit bonus. Two attribute points per level, one skill point every three levels. Allocation validation (unspent points only, whole numbers, no negatives). Starting attributes per race from §4.
- Acceptance criteria: tests match the §7 XP examples and reject invalid allocations.
- Verification: `npm test`.
- Progress:

### Step 6.2: Race module contract and four racial cores
- Status: `todo`
- Depends on: 6.1, G5
- Files: `src/sim/races/*.ts`, tests, `src/content/scenarios.ts`
- Change: Races use the same hook list as classes. Human: XP bonus (attachment points come in 6.3). Elf: Focus. Beastfolk: Ferocity at expedition scope. Undead: Stillness. All numbers from §4.
- Acceptance criteria: a test per core rule. A harness `combos` matrix runs all 20 race/class pairs against a level-10 Standard enemy with no errors, and each log contains that race's events.
- Verification: `npm test`, `npm run sim -- --matrix combos --runs 50 --seed 1`.
- Progress:

### Step 6.3: Skill-web model and allocation rules
- Status: `todo`
- Depends on: 6.2, G4
- Files: `src/sim/progression.ts`, `src/content/webs/*.ts`, tests
- Change: Node graph data, connectivity requirements, skill-point costs, at most one major keystone, no respec within a life, racial-branch attachment points (two, or three with Flexible Route), skill-unlock nodes adding learnable skills, a four-skill loadout chosen from learned skills, and legacy skill points. `previewAllocation(hero, nodeId)` returns requirements, consequences and keystone exclusions for the UI.
- Acceptance criteria: tests for illegal allocations, keystone exclusivity, and preview contents.
- Verification: `npm test`.
- Progress:

### Step 6.4: Warrior passives and keystones
- Status: `todo`
- Depends on: 6.3
- Files: `src/content/webs/warrior.ts`, `src/sim/classes/warrior.ts`, tests
- Change: The 15 §4 Warrior nodes, including Berserker, Weapon Master and Unbroken.
- Acceptance criteria: one test per node. The Step 3.2 matrix still runs.
- Verification: `npm test`.
- Progress:

### Step 6.5: Assassin passives and keystones
- Status: `todo`
- Depends on: 6.4
- Files: `src/content/webs/assassin.ts`, `src/sim/classes/assassin.ts`, tests
- Change: The 15 §4 Assassin nodes, including Ghost, Toxic Sovereign and Death Sentence (bosses can't be executed).
- Acceptance criteria and verification: as Step 6.4.
- Progress:

### Step 6.6: Ranger passives and keystones
- Status: `todo`
- Depends on: 6.5
- Files: `src/content/webs/ranger.ts`, `src/sim/classes/ranger.ts`, tests
- Change: The 15 §4 Ranger nodes, including Deadeye, Trapper and Trailblazer (which reads expedition momentum).
- Acceptance criteria and verification: as Step 6.4.
- Progress:

### Step 6.7: Mage passives and keystones
- Status: `todo`
- Depends on: 6.6
- Files: `src/content/webs/mage.ts`, `src/sim/classes/mage.ts`, tests
- Change: The 15 §4 Mage nodes, including Elemental Convergence (six authored recipes in a Convergence slot with their own priority row), Overcast and Grand Grimoire charges.
- Acceptance criteria: as Step 6.4, plus one test per Convergence recipe.
- Verification: `npm test`.
- Progress:

### Step 6.8: Cleric passives and keystones
- Status: `todo`
- Depends on: 6.7
- Files: `src/content/webs/cleric.ts`, `src/sim/classes/cleric.ts`, tests
- Change: The 15 §4 Cleric nodes, including Exalted Vow, Living Sanctuary (a temporary Sanctuary Release skill) and Sacred Balance (Grace and Wrath replace Faith).
- Acceptance criteria and verification: as Step 6.4.
- Progress:

### Step 6.9: Racial branches and Undead curses
- Status: `todo`
- Depends on: 6.8
- Files: `src/content/webs/racial.ts`, `src/sim/races/*.ts`, tests
- Change: The 16 §4 racial nodes and the three Undead curses (chosen before an expedition).
- Acceptance criteria: one test per node and curse. The `combos` matrix runs all 20 pairs with representative allocated webs and no errors.
- Verification: `npm test`, `npm run sim -- --matrix combos --runs 50 --seed 1`.
- Progress:

---

### Stage 7: Saves and character UI

### Step 7.1: Versioned local save
- Status: `todo`
- Depends on: 6.9
- Files: `src/persist/save.ts`, `src/persist/save.test.ts`, `src/ui/store.ts`
- Change: `SaveData` with `version: 1`, account data (materials, recipes, discoveries, gold, slots), heroes, the selected hero, and any active expedition state. Stored under `localStorage` key `rpg.save.v1`. Save on hero creation, confirmed allocations, town actions, and encounter end. On load, check the shape and version. If it is corrupt or the version is unknown, copy the raw data to `rpg.save.corrupt.<timestamp>`, show an error, and offer a new game. `[save]` debug lines show the byte size. No migrations before the first playable.
- Acceptance criteria: tests for the round trip, an unknown version, malformed JSON, and resuming an active expedition from the save with an identical continuation.
- Verification: `npm test`. User: create something, reload the page, and confirm it is still there.
- Progress:

### Step 7.2: Hero creation and roster
- Status: `todo`
- Depends on: 7.1, G6
- Files: `src/ui/character/Create*.tsx`, `Roster*.tsx`, `src/content/heroes.ts` (identity text)
- Change: Pick race and class (all 20 pairs) and see a short identity summary of each (§15 criterion 2). Name the hero: trimmed, 1–24 characters. Slot limit per G6. Select the active hero.
- Acceptance criteria: all 20 pairs can be created. Invalid names are rejected with a message.
- Verification: User: create one hero of each race and confirm the summaries differ.
- Progress:

### Step 7.3: Attributes and skill-web screen
- Status: `todo`
- Depends on: 7.2
- Files: `src/ui/character/Attributes*.tsx`, `SkillWeb*.tsx`
- Change: Allocate attribute points with a confirmation. An SVG web view with the racial branch in its own color. A preview panel from `previewAllocation`. A confirmation dialog for irreversible choices that states keystone exclusivity.
- Acceptance criteria: the UI cannot make an allocation the simulation rejects.
- Verification: User: allocate a keystone and confirm the other two become unavailable, as the preview said.
- Progress:

### Step 7.4: Loadout and priority-rule editor
- Status: `todo`
- Depends on: 7.3
- Files: `src/ui/character/Loadout*.tsx`, `Rules*.tsx`
- Change: Choose four skills. Edit up to 12 rows: condition dropdowns limited to valid types, a target override, reordering, and validation messages. Edits made during combat go through `setPriorityRules`. Saved per hero.
- Acceptance criteria: invalid rows can't be saved. A mid-combat edit appears as a `rulesChanged` log line.
- Verification: User: add an Execute row at Advantage ≥ 3 and watch the log use it.
- Progress:

---

### Stage 8: World map and expedition UI

### Step 8.1: Fractured Frontier content
- Status: `todo`
- Depends on: 7.4, G7
- Files: `src/content/world.ts`, `src/content/encounters.ts`, tests
- Change: Greyhaven, the Splintered Road, Withered Grove and Fallen Bastion nodes, and the fracture/boss node. Routes and travel times, encounter tables per node, resource nodes, the boss-reveal threshold, and discovery and gate flags (shared discoveries, personal gates, §6).
- Acceptance criteria: the content integrity test resolves every reference. The harness runs an expedition on every route.
- Verification: `npm test`.
- Progress:

### Step 8.2: Node map view
- Status: `todo`
- Depends on: 8.1
- Files: `src/ui/map/*.tsx`, `public/map/`
- Change: SVG nodes and routes over a placeholder background. Node states: locked, discovered, cleared. An animated hero marker while travelling. Choosing a destination and route. A route info panel with known enemies, resources and level band.
- Acceptance criteria: the map state comes only from simulation and save state.
- Verification: User: choose a route and watch the marker travel.
- Progress:

### Step 8.3: Expedition panel
- Status: `todo`
- Depends on: 8.2
- Files: `src/ui/map/Expedition*.tsx`, `src/ui/App.tsx`
- Change: Preparation (retreat thresholds, vow, curse, quiver, supplies). While running: momentum, unsecured loot, HP and resources, and a choice between pushing on and returning, with the Stage 4 combat and log panels embedded. An outcome screen for return, retreat or defeat that lists the costs.
- Acceptance criteria: the user can play a full expedition without the CLI.
- Verification: User: run an expedition, push for momentum, and decide when to return (§15 criterion 7).
- Progress:

---

### Stage 9: Items, town, crafting, contracts

### Step 9.1: Items and equipment
- Status: `todo`
- Depends on: 8.3
- Files: `src/sim/economy.ts`, `src/content/items.ts`, `src/ui/town/Equipment*.tsx`, tests
- Change: Item instances (base, item level, quality, durability, modifiers) and the eight slots. Item-level requirement, the 90% off-preference rule, two-handed weapons disabling the off-hand, the archive, and starter gear per class.
- Acceptance criteria: tests for each equip rule. Equipping changes the derived stats shown in the UI.
- Verification: `npm test`. User: swap a weapon and see the action time and power change.
- Progress:

### Step 9.2: Town services
- Status: `todo`
- Depends on: 9.1, G1, G3
- Files: `src/sim/economy.ts`, `src/ui/town/*.tsx`, tests
- Change: Secure loot into shared materials. Carried versus deposited gold. A basic shop for buying and selling items and supplies at fixed prices. Repair. Paying off debt.
- Acceptance criteria: tests for deposits, repair cost, and debt payment.
- Verification: User: return from an expedition, deposit gold, and repair a damaged item.
- Progress:

### Step 9.3: Crafting
- Status: `todo`
- Depends on: 9.2, G8
- Files: `src/sim/economy.ts`, `src/content/recipes.ts`, `src/ui/town/Craft*.tsx`, tests
- Change: Base recipe + material + one modifier. Seeded quality roll (the average of two rolls within the visible range). Proficiency. A failed upgrade consumes materials and leaves the item unchanged. A short crafting queue that advances on simulation time while the hero is in town.
- Acceptance criteria: tests for the quality range, a failed upgrade, and queue progress.
- Verification: User: craft an item, equip it, and see its effect in the next fight (§15 criterion 8).
- Progress:

### Step 9.4: Contracts
- Status: `todo`
- Depends on: 9.3, G7
- Files: `src/sim/economy.ts`, `src/content/contracts.ts`, `src/ui/town/Contracts*.tsx`, tests
- Change: Repeatable contracts that track progress from expedition events and pay gold, materials and XP at the §7 efficiency target.
- Acceptance criteria: tests for progress tracking and completion.
- Verification: User: accept a contract, complete it, and collect the reward.
- Progress:

---

### Stage 10: Boss ranks, reincarnation, mastery

### Step 10.1: Boss reveal and Echo ranks
- Status: `todo`
- Depends on: 9.4, G9
- Files: `src/sim/expedition.ts`, `src/sim/progression.ts`, tests
- Change: Zone progress reveals the boss. A victory unlocks the hero's next personal rank. A loss at any rank sets `bossLossThisLife`.
- Acceptance criteria: tests for the reveal, rank unlocks, and the loss flag.
- Verification: `npm test`.
- Progress:

### Step 10.2: Reincarnation
- Status: `todo`
- Depends on: 10.1, G10
- Files: `src/sim/progression.ts`, `src/ui/character/Reincarnate*.tsx`, tests
- Change: Eligibility requires a boss loss this life, with defeat costs already applied. Currency from level and XP. First-time milestone bonuses. The §10 reset and preserve lists. Legacy skill points come back unallocated. Choose one heirloom.
- Acceptance criteria: a test for each reset and preserve item.
- Verification: User: lose to the Warden, reincarnate, and confirm what was kept.
- Progress:

### Step 10.3: Mastery, legacy purchases, heirloom scaling, slot unlocks
- Status: `todo`
- Depends on: 10.2, G6, G10
- Files: `src/sim/progression.ts`, `src/content/heroes.ts`, `src/ui/character/Legacy*.tsx`, tests
- Change: The personal mastery effects and legacy purchases defined in G10. The heirloom scales to the hero's level. Character slots unlock by milestone (G6).
- Acceptance criteria: tests for each purchase effect and for heirloom scaling. The harness shows the second-life reference hero doing measurably better against the Warden.
- Verification: `npm test`, plus a harness comparison of first-life and second-life Warden win rates.
- Progress:

---

### Stage 11: First-playable integration and playtest

### Step 11.1: New-game flow and walkthrough fixes
- Status: `todo`
- Depends on: 10.3
- Files: `src/ui/App.tsx` and the screens touched by gaps found
- Change: Start screen, then hero creation, town, map and expedition, with navigation between them. Fix only the gaps that block the §15 walkthrough.
- Acceptance criteria: a fresh browser profile can reach a Warden fight without dev tools.
- Verification: User: play from a fresh profile and note any blockers in Progress.
- Progress:

### Step 11.2: Success-criteria playtest
- Status: `todo`
- Depends on: 11.1
- Files: this plan (Progress), `rpg/doc/GAME_DESIGN.md` (findings and open questions), `docs/ideas/incremental-rpg.md` (status, only if it changes)
- Change: The user plays through the ten §15 success criteria. Run the `combos` and `reference` matrices for a preliminary balance check. Record the findings.
- Acceptance criteria: each §15 criterion is marked pass or fail with a note.
- Verification: User-led playtest.
- Progress:

---

## 8. Risks, and what would reveal them early

| Risk | Early signal | Mitigation |
| --- | --- | --- |
| Determinism breaks (stray `Math.random` or `Date`, iteration order, mutation during iteration, step-size drift) | Golden snapshot diffs. The serialize-and-resume test fails. Two runs of the same seed differ in `runBatch`. | Step 0.2 boundary test, the Step 1.3 resume test, scheduling from scheduled time, a documented tie order |
| Scope: 20 pairs, 30 skills, 91 nodes and authored enemies overwhelm the plan | Stage 2 or Stage 6 steps take far longer than the others, or turn into `blocked` | One class per step, harness matrices as smoke tests, design gates instead of guessing |
| The effect model fills up with special cases | `combat.ts` gains class-specific `if` branches. New hooks appear in every step. | Fixed hook list and closed effect union. Review after Steps 2.6 and 6.8. |
| The evidence contradicts the design numbers and causes churn | Step 3.2 shows win rates far outside the targets | Step 3.3 makes revision an explicit decision recorded in GAME_DESIGN |
| Design gaps stall later stages | Gates G1–G10 still open when Stage 4 ends | Schedule brainstormer sessions during Stages 3–4 |
| Fixed 10 ms steps are too slow for batch or future offline runs | Step 3.2 runs/sec misses the budget | Profile first. Switch to an event queue (the rejected Q2 alternative) only with evidence, and record the change in GAME_DESIGN §7 first. |
| JS math differs between engines (for example `Math.pow`) and shifts results | Different outcomes in Node and the browser for the same seed | The Step 4.1 manual comparison. Round at defined boundaries. |
| The log is too big or unreadable | The UI stutters on long fights. The playtester can't explain a defeat. | Render the last 500 rows. Use `summarizeDefeat`. Steps 4.3 and 11.2 check it. |
| The browser pauses `requestAnimationFrame` in background tabs | Combat freezes when the user switches tabs | Accepted for the first playable. Offline catch-up (deferred) solves it with the same step function. |
| Saves break as content changes | Load errors after content edits | Version field, corrupt-save copy. No migrations until after the first playable. |

## 9. Deferred (not in this plan)

- Offline progression and catch-up, zone proving, mastery-gated speed controls (§11)
- Running the simulation in a Web Worker (only if the main thread stutters)
- Desktop packaging (Tauri or Electron), IndexedDB, cloud saves, save migrations
- The event and event-policy system, route events, lore quests (§6, §14)
- Hybrid branches for difficult pairings, the Undead/Cleric hybrid node, repeated-element Convergence recipes (§4, §17)
- The "Most dangerous" target priority until threat scoring is designed (Q13)
- Cleanse sources (no first-playable skill cleanses; this depends on the G1 consumables)
- Gradual feature unlocking for onboarding, accessibility options, audio, polished pixel art
- More regions, world tiers, final balance for all 20 pairings, business model

## 10. Changelog

- 2026-10-21: Recorded the approved decisions: stack (Q1), fixed 10 ms clock (Q2) and resolve-on-ready action timing (Q3). The clock and timing mechanics now live in GAME_DESIGN §7. Step 1.3 points there. Step 0.1 is ready. Added Q15 (enemy timing after a telegraph) for Step 2.7.
- 2026-10-21: Created the plan with the stack recommendation (TypeScript + React + Vite, no engine), the folder structure, architectural boundaries, 12 stages (0–11) and 52 steps. The deterministic simulation harness comes first.
