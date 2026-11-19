# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-19)
- **Current Goal:** Step 13.32 "Claim an heirloom now" is done. A bought heirloom slot can be used at once on an owned item, not only at the next reincarnation. Step 13.31 (lean inheritance) still awaits the user's playtest and balance call.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §10 "Claim an heirloom now", Third Heirloom row; plan Step 13.32; CHANGELOG `Unreleased` [13.32].
  - Persist: `src/persist/reincarnation.ts` gains `claimHeirloom(save, heroId, itemId)`, `freeHeirloomSlots(hero)`, `claimableItems(hero)`; tests in `reincarnation.test.ts`.
  - UI: `store.ts` `claimHeirloomFromUi`; `Legacy.tsx` "Heirloom slot free" block (select plus "Make heirloom now"), purchase effect text; `character.css` `.legacy-claim`; Guide sentence in `content/guide.ts` (no digits).
- **Active Decisions / Constraints:**
  - Claim refuses: unknown hero or item, already an heirloom, another hero's heirloom, no free slot, a running expedition. Free slots = allowance minus items flagged for the hero (worn plus archive). No gold or materials.
  - Claimed item gets `cap = itemLevel`, then `scaleHeirlooms` runs. `pastLifeItemIds` is untouched, and an heirloom cannot be sold, so the carried-share guards are unchanged. `reincarnate` is unchanged and keeps a claimed heirloom within the allowance (choosing another item with one slot releases the claimed one).
  - `src/sim`, content numbers and the harness are untouched.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Not verified:** the Legacy claim block in a browser and at 375 px (tests are static markup only).
- **Exact Next Step:** (1) User playtest: buy Second Heirloom after reincarnating, claim an earlier-life item, check it works at the hero's level. (2) Finish the 13.31 playtest and balance call. (3) Close 13.31 and 13.32 into a `## 0.x.0` changelog heading.
