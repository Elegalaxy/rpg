# Project Handoff State

- **Last Updated By:** Claude Code
- **Current Goal:** First playable is built through Step 11.1. Step 11.2 (success-criteria playtest) waits on the user. A balance pass on elites and the Ranger/Assassin is done (2026-11-03).
- **Recent Changes & Files Touched:**
  - Rule conditions `stance` and `interruptible` (`src/sim/automation.ts`, `src/persist/loadout.ts`); built-hero harness `src/harness/builds.ts` (`--matrix built`) and `src/harness/skill.test.ts`.
  - Elites: Rootmaw interrupt 6% of max HP; Echo Knight 3,200 HP, 26 Power, Assault Armor/Resistance x0.6, Fractured Charge telegraph 2.0 s.
  - Ranger: 20 Readiness per basic hit, Aimed Shot 304% (node 338%), Piercing Arrow 220%, new Fade Back skill (+30 Evasion), rows target lowest Armor. Assassin rows target lowest Armor; built Assassin takes Smoke Step early.
  - Last commit 95caa79 pushed to `origin/main`. 659 tests, typecheck and lint clean.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`. No force-push.
  - Known leftovers: Ranger and Assassin cannot beat the Echo Knight at its own level 16; Ranger nodes past the fourth add nothing to the reference loadout; Cleric floor build loses both elites; Rootmaw is 97-100% at level 20; no consumables exist; existing saves do not learn Fade Back.
- **Exact Next Step:** The user plays from a fresh profile and marks §15 criteria 2, 5, 6, 7, 10 in Step 11.2 Progress. Optional balance follow-ups: consumables, a Ranger/Assassin survivability tool, Cleric floor damage.
