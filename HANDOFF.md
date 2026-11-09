# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-09)
- **Current Goal:** Step 13.5 (class balance pass) is closed. Part 8 re-measured everything (seeds 1-3 x 100, rules mode) and changed no numbers. Next: user playtest and optional content.
- **Recent Changes & Files Touched (part 8, docs only):**
  - `doc/GAME_DESIGN.md` §7 "Class balance pass": the part 1 baseline tables are replaced by "Final measurement" (per-class tiers, crafted gap, telegraph gap, mixed fights, guards, band misses).
  - `doc/IMPLEMENTATION_PLAN.md`: Step 13.5 status `done`, dated Progress line with accepted deviations. This file overwritten.
  - Guards: reference CSV (seed 1, 100 runs) byte-identical; regular fights 100%; built matrix identical to part 8a; `--expedition` Road, Causeway, Hollows seeds 1-5: 0 defeats.
  - Results: Warden prepared W52 A42 R54 M48 C45; Colossus prepared 74/57/65/67/59; Reaver prepared 42/76/99/45/57; over-levelled all 94-100; arrived 0 except Reaver Ranger 84, Assassin 15.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Accepted deviations: seed spread over 8 points in mid-band cells; mixed-fight HP lost mostly outside 15-40; Assassin Warden crafted gap +37; Cleric telegraph check (all elites) and Assassin at the Colossus not met; Ranger Reaver prepared 99 approved; Cleric Colossus enrage is a cliff (130 s 20%, 140 s 68%, 150 s 90%), retune with care.
  - Greater Draught default rule threshold is decided: 40% HP.
  - OPEN: Ranger arrived at the Reaver wins 84% (band 20% or less). Not retuned; decide accept or retune.
- **Not verified:** the Colossus/Reaver enrage in the browser (ActorCard shows "Pressure n"); offline, away route, Save panel, Wear button, Going in with.
- **Exact Next Step:** (1) User playtest of the Causeway, Hollows, offline, Save panel, Wear button and Going in with. (2) Decide the Ranger-at-Reaver arrived item. (3) Optional later content: Grove/Bastion material drops, a post-Warden zone (Rift Hollows L22-28 exists; next zone TBD).
