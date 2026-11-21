# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-22, Step 13.49; 13.46 to 13.48 by another implementer, see git log)
- **Current Goal:** QoL batch, Steps 13.41 to 13.45, is done and pushed to `origin/main` (one commit per step, plus a one-line test type fix for 13.43). Next is the user's playtest, then closing 13.36 to 13.45 into a `## 0.x.0` changelog heading.
- **Recent Changes & Files Touched:**
  - 13.41: Ranger template "Top up Readiness" (Hunter's Mark at Readiness at most 60, then a blank slot) in `content/ruleTemplates.ts`, Ranger Guide tip in `content/guide.ts`.
  - 13.42: `SavedHero.pastLoadouts` (last 3 lives, newest first; cap `MAX_PAST_SETUPS` in `persist/skillSlots.ts`). `pastSetups(hero)` reads an old single `pastLoadout` as slot one; `reincarnate` writes `pastLoadouts` and deletes the old field. `returnToLoadout` uses the newest kept setup that held the skill (`persist/pastSetup.ts`).
  - 13.43: optional `SavedHero.nextLifePlan` (purchases and picks), `persist/nextLifePlan.ts` (`restorePlan` drops stale entries with reasons, `withSavedPlan`), `saveNextLifePlanFromUi`, planner restores, shows a drop notice, has a Reset plan button; `reincarnate` clears it.
  - 13.44: `persist/sellSafety.ts` (`sellGroup`, `needsSellConfirm`, `RISKY_QUALITY` 1.05), `ui/town/sellArm.ts` (two-click state machine), `SellButton.tsx`, `SellList.tsx` (extracted from `Town.tsx`), grouped archive in `Equipment.tsx`, Guide sentence.
  - 13.45: Legacy claim block always shown (`heirloomSlotUse`, `heirloomClaimBlock` in `persist/reincarnation.ts`, `ui/character/Legacy.tsx`).
  - Docs: GAME_DESIGN (template table, 13.42 bullet, "Saved between-lives plan", "Safe selling", Legacy claim bullet), IMPLEMENTATION_PLAN steps 13.41 to 13.45, CHANGELOG `Unreleased`.
  - 13.49 (2026-11-22): opt-in `SavedHero.autoRepair` ("Repair at home", next to Auto contracts). `persist/autoRepair.ts` `autoRepairStep(save)` repairs worn pieces most worn first at the normal `repairCost` via `repairOne`, skips unaffordable; called after `autoContractsStep` in `ui/store.ts` (toast, commit 'auto run repair') and `persist/offline.ts` (`repairedPieces`, `repairGold`; away line in `ui/AwayPanel.tsx`). The 0-durability refusal is unchanged. Reference matrix identical before/after.
- **Active Decisions / Constraints:**
  - No sim or content-number change; the reference matrix still runs. Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
  - Heirlooms are items with `heirloom: {heroId, cap}`; `pastLifeItemIds` lists every archive id at reincarnation (heirlooms included); `sellItem` refuses heirlooms.
  - No jsdom in the project: UI tests are static markup, plus the pure `sellArm` state machine with fake timers.
- **Risks:** `nextLifePlan` is saved on every planner change (one `commitSave` each). A blank heirloom pick is stored as an empty string, which `save.ts` allows only for this field.
- **Not verified:** Stale-plan notice in a real browser (the app's autosave overwrote my injected localStorage); Desktop width of the planner and Legacy block; Equipment tab archive grouping in a browser; Escape and timeout revert were clicked on desktop only.
- **Exact Next Step:** (1) User playtest: reincarnate twice and relearn a skill, reload mid-planner, sell earlier-life gear (two clicks), open Legacy with no free slot. (2) Close 13.36 to 13.45 into a `## 0.x.0` changelog heading.
