# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-22, Steps 13.46 to 13.48; 13.49 by another implementer, see git log)
- **Current Goal:** Idea batch 13.46 to 13.48 is done and pushed to `origin/main` (one commit each). 13.49 (Auto run repair at home) was pushed by another chat. Next is the user's decision on the Venom base tick, then closing the unreleased lines into a `## 0.x.0` changelog heading.
- **Recent Changes & Files Touched:**
  - 13.46: Legacy "Make heirloom now" shows the item list and button only when a slot is free and something is claimable; otherwise only the key-values and the reason. List sorted best first (item level, quality), worn pieces marked "(worn)". `claimOptions` in `persist/reincarnation.ts`, `ui/character/Legacy.tsx`, tests in `Legacy.test.tsx`.
  - 13.47: measured the Assassin passive's 8% base tick with no Venom Edge node (measurement only, no content change). Harness variants `live-nonode`, `current-nonode`, `live-baseNN-nonode`, `VENOM_EXCLUDE=tyrant` in `harness/venom.ts`. Result: 8% fails (Warden prepared -16.0 vs the +/-8 limit; prepared tier -12.3 on the 12 cells without the Tyrant). A 10% base passes, 9% fails. Table in GAME_DESIGN §10 "Base tick on its own".
  - 13.48: new matrix `npm run sim -- --matrix toxic --seed 1 --runs 5` (`harness/toxic.ts`, `toxic.test.ts`): Assassin plain / Toxic Opportunity / Toxic Sovereign vs every elite cell. Baseline recorded in GAME_DESIGN §10 "Toxic guard matrix". The nine older matrices stay byte-identical.
- **Active Decisions / Constraints:**
  - No sim or content-number change in this batch. Never remove `// admin code`. One commit per part to `origin/main`; every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it. `reports/` is gitignored.
  - `current` in the venom harness drops the Burn Warming Tonic row on Tyrant cells (13-row cap), so Tyrant cells are not like-for-like with `live`; use `VENOM_EXCLUDE=tyrant` for the clean comparison.
- **Risks:** `slotsRanger.test.ts` "is deterministic on a small run" can time out at 30 s when the machine is loaded (passes alone and on a quiet rerun). The shipped 8% base without the node is below the measurement band at the Warden.
- **Not verified:** Legacy layout was checked by DOM measurements only (screenshots from the browser pane were stale at 375 px).
- **Exact Next Step:** (1) User decides: keep 8% base (the node is what makes the Warden pass), or 10% base and give the Venom Edge node another job. (2) Close the unreleased changelog lines under a `## 0.x.0` heading.
