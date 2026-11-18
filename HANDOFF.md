# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.27 "A boss victory also unlocks reincarnation" is done. A Warden win (any Echo rank) or a boss loss now unlocks reincarnation. Next is the user's playtest.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §10 Trigger, the Warden section, risk note, exploit guard; plan Step 13.27; CHANGELOG `Unreleased` [13.27].
  - Code: `bossFaced(hero)` in `src/persist/reincarnation.ts` (`'lost' | 'won' | 'both' | null`); `reincarnationBlock` and `src/persist/guidance.ts` use it; outcome line in `world.ts outcomeSummary` and `ui/map/ExpeditionPanel.tsx`; condition line in `ui/character/Legacy.tsx`; Guide reincarnation topic in `src/content/guide.ts`.
  - Tests: `src/persist/echo.test.ts` (win unlocks, plain elite win does not, loss unchanged, reincarnate resets, old save), `src/persist/reincarnation.test.ts` (message), `src/ui/character/Legacy.test.tsx`.
- **Active Decisions / Constraints:**
  - No new save field: a win is `echoRank > 0` (reset by reincarnation with `bossLossThisLife`). Heroes who already beat the Warden this life are unlocked at once. Legacy stays level-based, so no exploit.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Not verified:** Legacy screen in a browser; no dedicated offline Warden-win test (offline settles through `settleExpedition`, covered by the live-settle test).
- **Exact Next Step:** User playtest: beat the Warden, open Heroes > Legacy and reincarnate. Then close 13.22 and 13.27 into a `## 0.x.0` changelog heading.
