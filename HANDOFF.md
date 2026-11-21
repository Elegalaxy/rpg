# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-21)
- **Current Goal:** Step 13.40 "Hunter's Mark grants Readiness" is done. Hunter's Mark reveals the target and gains 20 Readiness, cooldown 8 (the measured HM-R variant). Next is the user's playtest and the 0.20.0 changelog close.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §10 "Hunter's Mark grants Readiness (Step 13.40)", skill text in §3 and the Pathfinder node, plan Step 13.40, CHANGELOG `Unreleased` [13.40].
  - Content: `src/content/skills.ts` Hunter's Mark (cooldown 8, effects reveal + resource 20), `content.test.ts`, `webs/nodeText.ts` regenerated with `tools/gen-node-text.py`.
  - Skill info text in the UI and Guide is derived from the effects, so it updates by itself; no UI code changed.
- **Active Decisions / Constraints:**
  - Hunter's Mark is learnable (Pathfinder cluster), in no reference loadout, so the reference rows are unchanged and every guard (reference and modded CSV, nine matrices at seed 1 x 5, golden duel) is byte-identical. The "Readiness at most 60" row is the player's to add; it is not shipped.
  - Re-measured with shipped content (HM-R last, seeds 1 to 3 x 100): prepared +7.3, crafted +2.2, median win time +2.6%.
  - `src/sim` and the harness are untouched. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot (line endings only): restore it, never commit it.
- **Risks:** Old saves with a rule using Hunter's Mark start gaining Readiness (intended). A rule without a Readiness gate casts it every 8 s at the cost of a basic attack.
- **Not verified:** nothing checked in a browser; the skill's description text in the Loadout and Guide was not viewed.
- **Exact Next Step:** (1) User playtest: learn Hunter's Mark as a Ranger, add a row "Readiness at most 60", watch the Readiness. (2) Close 13.36, 13.37, 13.40 into a `## 0.x.0` changelog heading.
