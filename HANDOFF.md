# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-17)
- **Current Goal:** Step 13.18 "Later lives" is done, parts 1 to 5 (part 6, "Restore last life's build", deferred). Next is the user's playtest, then closing 13.18 into a `## 0.x.0` changelog heading.
- **Recent Changes & Files Touched (persist and UI only; `src/sim`, content defs, harness and snapshots untouched):**
  - Part 1 docs: GAME_DESIGN §10 "Later lives (Step 13.18)"; §9 elite Legacy Skill Point lines struck; `routeReturns` in the carries-over list; plan Step 13.18.
  - Part 2 Remembered Paths: `SavedHero.rememberedEnemyIds`, new `persist/remembered.ts` (`zoneGateRecord`, `unionElites`, `openByMemory`), `reincarnate` unions elites, `nodeStatus` and the contract board read it for zone nodes only, MapView note (`map-remembered`).
  - Part 3 Recall XP: `SavedHero.peakLevel`, `recallNeed` / `recallXp` in `persist/reincarnation.ts`, used in `settleExpedition`, `outcomeStats(expedition, hero)`, `outcomeSummary`, `offline.ts`, outcome card.
  - Part 4 Head Start: `HeroPurchases.headStart` (0 to 2), `HEAD_START_LEVELS` 5 / 10, `HEAD_START_COSTS` 20 / 35, `buyPurchase('headStart')`.
  - Part 5: `startingProgress`, `nextLifePreview`; `ui/character/Legacy.tsx` rebuilt (cards, purchases table, Next life), CSS in `character.css`, `Legacy.test.tsx`.
- **Active Decisions / Constraints:**
  - Fracture Gate never reads remembered elites (no farming by losing to the Warden on purpose). Drills are not boosted by Recall. Heroes that reincarnated before this step get no `peakLevel` until their next reincarnation.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`.
- **Not verified:** a real Recall run and a real life-2 Causeway start in the browser (unit tests only); the browser check used the dev Legacy buttons at level 1.
- **Exact Next Step:** (1) User playtest: reincarnate a hero who beat an elite, check the Causeway opens and Recall shows on the outcome card. (2) Close Step 13.18 into a `## 0.x.0 · date · name` changelog heading. (3) Optional part 6: store the last life's skill-web node ids and priority rows, and offer "Restore last life's build" using `allocateNode` and `allocateRacialNode`.
