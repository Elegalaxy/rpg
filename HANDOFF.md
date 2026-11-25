# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-25, Step 14.6, stopped again at two failing gate cells)
- **Current Goal:** Step 14.6 "Elite uniques". P1 and P2 are on `origin/main`. Everything after them is LOCAL ONLY on branch `uniques` in `../rpg-worktrees/uniques` (not pushed). P7 is not done.
- **Recent Changes & Files Touched:**
  - Items: `sim/uniques.ts` (table, signature), `gearBonusesFor` (`sim/economy.ts`), `content/uniques.ts`, `itemName`, fixed sell price, `uniqueId` save check, sell confirm.
  - Award: `persist/uniques.ts`, `settleExpedition` and `uniquePreview`, moments, offline summary, Notices.
  - UI: `ui/town/UniqueLines.tsx`, gear rows, outcome card, AwayPanel, Guide group "Unique items", signature notes in the equip preview.
  - Harness: `--matrix uniques`, gate flags per the 2026-11-25 decision (GAME_DESIGN section 9).
  - Signatures now: Rootmaw, Echo, Undertow (+2% HP, +1.5 phys resist), Reaver and Thornblood halved once; Tyrant at the proposed values.
- **Open gates (seeds 1-3 x 100, bound +8):** Warden + Colossus signature only, Warrior +10.3; Warden + Matriarch signature only, Warrior +9.3. The other six gated cells pass.
- **Facts for the decision:** the Matriarch signature-only cell also adds the Talisman built-in stat; the signature alone reads +6.0 for the Warrior. On seeds 4-12 (Warrior) the cells read +8.6 and +4.7.
- **Guards:** all ten guard matrices (seed 1 x 100) were byte-identical to the pre-step run after the sim edit.
- **Active Decisions / Constraints:** Never remove `// admin code`. One commit per part. `npm test` rewrites the scenarios snapshot: restore it. Matriarch enemy tuning is not to be touched. Leave other chats' worktrees alone.
- **Not verified:** outcome card, toast, away line and Guide in a browser (unit-tested only).
- **Exact Next Step:** User decides on the two cells (accept as exceptions, measure the Matriarch signature without the built-in stat and halve or accept the Colossus, or lower the two signatures again). Then push the local commits, close the plan Status, move the changelog lines under `## 0.25.0 · <date> · Elite uniques` with no empty Unreleased heading, and remove the worktree and branch.
