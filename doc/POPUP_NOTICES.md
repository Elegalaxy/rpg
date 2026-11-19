# Pop-up notices plan

Status: `planned`. Starts after the phone plan (steps 3 to 5: Town, run bar polish, PWA) is pushed.

## Goal

Tell the player when something worth noticing finishes, from one shared notice system instead of each screen's own line. UI only: the simulation, combat numbers and save format do not change.

## Why

- Auto run settles each run itself, so the outcome card (loot, first clears, Warden notes) is never seen.
- A level up only moves the XP bar. A finished contract only says "Done" in the tracker.
- One return can level up, finish a contract and pay a first clear at once, so notices need one queue, not a dialog each.

## Decisions (user, 2026-11-18)

- Two forms: a centered card for big moments, a toast for the rest.
- Big card moments, when playing by hand:
  - Level up, with the points to spend.
  - First-clear reward paid.
  - Contract finished, ready to collect.
  - New place discovered.
  - Warden beaten, new Echo rank, or reincarnation unlocked.
- Toast only:
  - Auto run stopped, with the reason.
  - Route finished, with a reward summary. Only when the outcome card was skipped (Auto run, away time).
- During Auto run every notice is a toast, big moments too. Nothing pauses the run.
- Settling by hand: pop up only what the outcome card does not show (level up, contract ready). Rewards the card already lists stay on the card.
- After time away: big-card moments show after the away report is closed. No toasts for the rest; the report covers them.
- Not covered: route mastered, new character slot, crafting or drills finished.

## Rules for the system

- One in-memory queue. Moments from the same return merge into one card, not stacked dialogs.
- Not saved: a reload does not replay notices, the same as the current notices.
- Toasts fade on their own and never need a click. Cards close with a button or Escape.
- On phones, clear of the sticky header, the pinned Start bar and the bottom tabs.
- `role="status"` for toasts, `role="dialog"` with a label for cards.
- `debugLog('[ui]', 'notice', ...)` each time one is queued and shown.

## Open questions

- Card order when several big moments merge (level up first?).
- Toast length on screen and the most shown at once.
- Should a card offer a shortcut button (Spend points, Go to Town to collect)?
