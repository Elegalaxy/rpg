# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-13, after batch 5)
- **Current Goal:** Step 13.7 playtest fixes (feedback of 2026-11-11). Bug batches 1-5 are committed and pushed; next is the in-game changelog page, then batch 6 (UI rework). Step 13.6 Cinder Scar is closed as done with accepted deviations.
- **Recent Changes & Files Touched:**
  - Step 13.6 closed (0b398b5): Prepared keeps Bloodbound and Stalwart and adds Emberward, Tyrant 5,400 HP and Power 68, XP multipliers; Emberward check replaces the Burn check (Tonic is near-obsolete in the Scar).
  - Step 13.7 batch 1 (305986e): run start carries each item's durability; start refused on a disabled piece or during the defeat rest. Batch 2 (0a4310e): run-panel truth (fight numbers, away chips, Full bag note, gold KPIs, autosaved preparation, pending contract progress, standing-orders indicator). Batch 3 (18a56b7): no layout shift in fight view and crafting. Batch 4 (87f2eb5): shop compare names the replaced piece, bag room lines, rounding.
  - Batch 5: out-of-combat HP regen is exact 0.05 x VIT x factors, with the fraction carried in `ExpeditionState.hpRegenCarryMilli` (thousandths, cleared at full HP); `hpRegenMilliPerSecond`/`hpRegenRate` in `src/sim/expedition.ts`; run panel HP tile notes "+N HP/s between fights". Two expedition tests rewritten for the new rule; all 1009 tests, guards, typecheck and lint pass.
  - What's new page: `src/ui/whatsNew/` (`parseChangelog.ts` pure parser, `changelog.ts` `?raw` import and badge key, `seen.ts` localStorage, `WhatsNew.tsx`), a last top-level tab in `App.tsx` (local `AppTab`, no persist change), styles at the end of `kit.css`, test `whatsNew.test.tsx` runs the parser on the real CHANGELOG.md.
  - New `CHANGELOG.md` at the repo root (ef73057), built from git history; `CLAUDE.md` (untracked) now requires a changelog line with every game-changing commit.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards must stay byte-identical (reference CSV, warden, causeway, hollows, built, telegraph, elites, cinder); batch 5 moved none.
  - Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Approved defaults for the feedback design questions: fractional regen; walking speed UI-only x8 (x16 mastered); upgrade queue stays 3 and several +1 jobs per item, "queue all" fills free slots; no extra gear slots or second modifier; no wear while walking; supply gaps unchanged; live auto-repeat toggle at mastery; combo stacks deferred; docked collapsible run mini-panel (top-right wide, bottom on mobile).
- **Not verified:** the Tyrant at Power 68 in the live UI, cinderite drop and Salvage; offline and away route with Cinder Scar; `--expedition cinder-scar` after the tier change; batches 1-5 in the browser.
- **Exact Next Step:** (1) Batch 6 UI rework: run mini-panel, contract board first tab, enchanter grouped by item then unlock level then gold, upgrade layout, batch brewing, material sources, escape banner, away route in summary, new-modifier badge, quality tooltip, mastery help, map layout, walking playback speed. (2) Browser check of batches 1-5. (3) User playtest of the Causeway, Hollows and Cinder Scar. Keep every CHANGELOG.md line in the `- Category: text (Step ..)` shape; the What's new test fails otherwise.
