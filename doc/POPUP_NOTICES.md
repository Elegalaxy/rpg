# Pop-up notices plan

Status: `done` (2026-11-20).

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
- Toasts slide in, stay 5 seconds, then fade out. They never need a click. Cards fade and scale in, and fade out on a button or Escape.
- On phones, clear of the sticky header, the pinned Start bar and the bottom tabs.
- `role="status"` for toasts, `role="dialog"` with a label for cards.
- `debugLog('[ui]', 'notice', ...)` each time one is queued and shown.

## Decisions (user, 2026-11-20)

- Card order: level up, then Warden, first clear, contract, new place.
- Toasts stay 5 seconds, at most 3 at once (the oldest goes first).
- Each moment on the card has one shortcut: Spend points (Hero, only with points to spend), Open Legacy (Warden), Spend the free upgrade (Weaponsmith), Go to the Contract Board, Open the map.

## How it is built

- `persist/moments.ts`: `momentsBetween(before, after)` compares two saves for the selected hero and returns the moments in card order. Pure, tested in `moments.test.ts`.
- `ui/notices.ts`: the in-memory queue (`reportMoments`, `pushToast`, `dismissCard`), with the modes `hand`, `away` and `auto`.
- `ui/store.ts` reports from five places: a settle by hand (level up and contract only), Auto run's own settle and contract hand-in (route summary toast plus every moment as a toast), the away catch-up (card, held until the report closes), finished drills and collected contracts (level up), and places found mid-run.
- The route summary toast is for live Auto run only. Runs played while away are in the away report.
- `ui/Notices.tsx`: the card and the toasts, rendered once in `App.tsx`; a shortcut closes the card and switches tab.
