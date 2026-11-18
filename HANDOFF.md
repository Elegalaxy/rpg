# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.23 "In-game Guide" is done, parts 1 to 5. Step 13.22 (crafted backpack) is handled by another implementer and is paused at its go/no-go.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §12 "Guide page (2026-11-18)", plan Step 13.23.
  - Text: `src/content/guide.ts` (hand-written, NO digits, enforced by `guide.test.ts`; also checks every non-supply skill is class-owned, extra or hidden).
  - Page: `src/ui/guide/guideIndex.ts` (pure entry builder and search; numbers come from content and sim), `Guide.tsx` (`Guide`, `GuideView`), `guideNav.ts` (`openGuide`, `useGuideTarget`), `GuideLink.tsx`; CSS appended to `src/ui/kit.css`.
  - Wiring: `App.tsx` (Guide tab after "What's new", Welcome "Read the guide" and "Back to hero creation", tab switch on a new link nonce); `GuideLink` on `CreateHero`, `ExpeditionPanel` (vow), `Rules`, `SkillWeb`, `Legacy`.
  - Tests: `guideIndex.test.ts`, `guide.test.tsx`, `guideNav.test.ts`, `guideLinks.test.tsx`.
- **Active Decisions / Constraints:**
  - Prose lives only in `guide.ts`, no digits. Add a new class, race, vow, status, supply or class skill and the tests tell you what Guide text is missing.
  - Class entries show cluster intros and keystone names only; node details stay on the Skills screen. Skill rows show base values.
  - Gated supplies read "Unlocks after ...". Mage Convergence spells (six) are listed through `EXTRA_CLASS_SKILLS`.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`.
- **Known rough edge:** `effectLine` in `ui/skillInfo.ts` falls back to raw names for some effects (chain, field, arm trap, reveal) and says "Heals 0%" for Mend. Fixing it also improves the skill tooltips.
- **Not verified:** mobile width layout of the skill table, the in-shell links (Combat setup, skill web, Legacy, vow picker) in a browser (only the Welcome flow was clicked), and the pane had zero height so smooth scrolling itself was not observed (focus and section opening were).
- **Exact Next Step:** (1) Look at the Guide in a real browser with a hero. (2) Optionally polish `effectLine` for the rough edge above. (3) Step 13.22 parts 3 and 4 wait for the user's go/no-go.
