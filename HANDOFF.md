# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-16)
- **Current Goal:** Steps 13.13 (rule chain view and templates) and 13.14 (Auto run, sidebar gold) are both done. Next is the user's playtest, then closing 13.12 to 13.14 into a `## 0.x.0` changelog heading.
- **Recent Changes & Files Touched (13.13, UI only; sim, content defs and snapshots untouched):**
  - Docs: GAME_DESIGN section 7 "Rule chain view and templates" (template table, unlocks), plan Step 13.13.
  - `ui/character/chainModel.ts` (`buildChain`, `ruleFireCounts`), `RuleChain.tsx`, `RuleNode.tsx`, `RuleRouter.tsx` (replaces the tab row, keeps tab roles and ids), `TemplatePicker.tsx`, `useFireCounts.ts` (reads the live combat log through the store's `subscribe` and `getSnapshot`), `Rules.tsx` rewired, `rc-*` classes in `character.css`.
  - `content/ruleTemplates.ts` (10 plain-data templates) and `persist/ruleTemplates.ts` (`templatesFor`, `templateUnlocked`, `applyTemplate`).
  - Tests: `chainModel`, `RuleChain`, `RuleRouter`, `TemplatePicker`, `useFireCounts` (ui/character) and `persist/ruleTemplates.test.ts`. `RulesForm` takes `initialOpenRule`, `initialPicker`, `save` props for tests.
- **Changes (13.14):** Auto run toggle and fight limit, live loop decides at each hold, `ui/GoldLine.tsx` sidebar gold total; see plan Step 13.14.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. A game-changing commit adds a line under `Unreleased`. Doc files use CRLF.
  - Templates are scaffolds: every one has a blank that validation refuses to save, hints never name a skill, applying only edits the draft. A rows template fills the chain you are on (confirm if not empty); a stack template adds a stack.
  - Unlocks: telegraphing enemy, swarm enemy (the "first group win" stand-in), or a boss with phases, read from `defeatedEnemyIds` and account defeat records. No new save field.
  - Fire counts follow the rows as they were when they fired, so reordering mid-fight shifts them.
- **Not verified:** live "Used N×" in a real fight; Auto run over many repeated runs; keyboard walk through the whole chain editor (buttons are native, focus rule is in CSS).
- **Exact Next Step:** (1) User playtest of the rule chain, router and templates, and of Auto run. (2) Tune template wording or add templates only on feedback. (3) Close Steps 13.12 to 13.14 into a `## 0.x.0 · date · name` changelog heading.
