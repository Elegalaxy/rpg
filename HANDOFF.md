# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-28, Step 14.6 done)
- **Current Goal:** Step 14.6 "Elite uniques" is done and pushed to `origin/main`. Changelog lines are closed under `## 0.25.0 · 2026-11-28 · Elite uniques`.
- **Recent Changes & Files Touched:**
  - Items: `sim/uniques.ts` (table, signature scaled by item level), `gearBonusesFor` (`sim/economy.ts`), `content/uniques.ts`, `itemName`, fixed sell price (`content/shop.ts`), `uniqueId` save check, two-click sell (`persist/sellSafety.ts`).
  - Award: `persist/uniques.ts`, paid by `settleExpedition` on a safe return, `uniquePreview`, moments, away report, Notices.
  - UI: `ui/town/UniqueLines.tsx`, gear rows, outcome card, AwayPanel, Guide group "Unique items", signature notes in the equip preview.
  - Harness: `--matrix uniques`; signature-only cells measure the signature alone.
  - Signature values: Rootmaw, Echo, Undertow (+2% HP, +1.5 physical resist), Reaver and Thornblood halved once; Tyrant as proposed.
- **Gates:** applied at a unique's own zone tier and later (GAME_DESIGN section 9). Recorded exception: Warden + Colossus signature cell, Warrior +10.3 against +8 (+8.6 over 900 extra runs).
- **Guards:** all ten guard matrices (seed 1 x 100) were byte-identical to the pre-step run after the sim edit.
- **Active Decisions / Constraints:** Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line under `## Unreleased` (add the heading; never leave it empty). `npm test` rewrites the scenarios snapshot: restore it. Matriarch enemy tuning stays as accepted.
- **Risks:** fixed early item levels fall behind unless upgraded; selling a unique is irreversible; at the level 20 Warden, a later-zone fixed modifier on an heirloom is very strong (record only); no gated all-six row remains; record-only harness cells were not re-measured with the final values.
- **Not verified:** outcome card, toast, away line and Guide entries in a browser (unit-tested only).
- **Exact Next Step:** Pick the next step with the user; ideas are a browser pass over the new-item notices and a look at the later-zone modifiers on early tiers.
