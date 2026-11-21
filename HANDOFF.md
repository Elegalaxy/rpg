# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-22, Step 13.50)
- **Current Goal:** Step 13.50 is done and pushed to `origin/main`: the Assassin's Envenomed strikes tick for 10% from the start and the Venom Edge node has no numeric effect. Steps 13.36 to 13.50 can now be closed into a `## 0.x.0` changelog heading after the user's playtest.
- **Recent Changes & Files Touched:**
  - Measured four node jobs with the 10% base (+1 Poison cap, +1% tick, +5% basic bonus, nothing): only "nothing" passes. The others break the Warden prepared +/-8 with Toxic Opportunity or Toxic Sovereign allocated; basic +5% also breaks the runaway limit. "Nothing" is numerically identical to the old node-allocated build.
  - Content: `ENVENOM.coefficient` 0.1 in `content/scenarios.ts`; node text regenerated (`content/webs/nodeText.ts` from GAME_DESIGN §10 cluster text); Loadout passive text; comments in `persist/heroUpdates.ts`. No save migration (the node stays allocated).
  - Harness (measurement only): variants `n10-cap|tick11|basic15|none`, `VENOM_BASELINE=live` report mode in `harness/venom.ts`; sim hooks `envenom.nodeBasicBonus` and `nodeCapBonus` (off in `gameDefs()`).
  - Guards at `--seed 1 --runs 5`: only Assassin rows without the node moved (reference, telegraph, built); modded, cinder, hollows, warden, causeway, elites and toxic are byte-identical. Lines listed in GAME_DESIGN §10 "Venom Edge node after the 10% base".
  - Tests: `scenarios.test.ts` assassin-vs-standard seed 42 time 8653 to 7731 ms; `venom.test.ts` expectations. Docs: GAME_DESIGN §10, IMPLEMENTATION_PLAN 13.50, CHANGELOG `Unreleased` Balance line.
- **Active Decisions / Constraints:**
  - Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot file: restore it (`git checkout --`), it has no real change.
  - Do not run measurements at the same time as the full `npm test` (slots harness tests time out).
- **Risks:** Venom Edge is now a pure connector node (no effect text players can use); a later round could give it a job once the boss cap rules change. Warden prepared per-seed results are noisy (about +/-10 per seed at 100 runs).
- **Not verified:** The node text in the in-game skill web in a browser; the Tyrant cells' `current` baseline stays a confound (12-cell tables decide).
- **Exact Next Step:** Close 13.36 to 13.50 into a `## 0.x.0` changelog heading after the user's playtest; idea: give the Venom Edge node a small readable job later if the design wants one.
