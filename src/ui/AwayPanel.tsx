import type { AwayReport, HeroAwaySummary } from '../persist/offline.ts'
import { dismissAway, getAwayView, useSaveStatus } from './store.ts'

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`
}

const EMPTY: HeroAwaySummary = {
  heroId: '',
  heroName: '',
  runs: 0,
  fightsWon: 0,
  retreats: 0,
  defeated: false,
  xp: 0,
  levelsGained: 0,
  gold: 0,
  materials: {},
  contractsFinished: 0,
  stopped: null,
  note: null,
}

const STOP_TEXT: { [reason: string]: string } = {
  returned: 'Your hero is back in Greyhaven. Close the run on the Map.',
  uncleared: 'The hero stopped: this route is not cleared yet, so it was not run again.',
  supplies: 'The hero stopped: the packed supplies are not in the stash any more.',
  bagFull: 'The hero stopped: the bag is nearly full and your order is to ask. The run waits for you on the Map.',
  runLimit: 'The hero stopped: the run limit you set was reached.',
  defeat: 'The hero fell. Close the run on the Map to pay the rescue fee.',
}

function lines(report: AwayReport): string[] {
  const summary = { ...report, ...(report.heroes[0] ?? EMPTY) }
  const out: string[] = []
  out.push(
    summary.awayMs > summary.replayedMs
      ? `You were away ${duration(summary.awayMs)}. Only the first ${duration(summary.replayedMs)} count.`
      : `You were away ${duration(summary.awayMs)}.`,
  )
  if (summary.runs > 0 || summary.fightsWon > 0 || summary.retreats > 0) {
    out.push(`Runs finished: ${summary.runs}. Fights won: ${summary.fightsWon}. Retreats: ${summary.retreats}.`)
  }
  const materials = Object.entries(summary.materials).map(([id, amount]) => `${amount} ${id}`)
  if (summary.gold > 0 || materials.length > 0) out.push(`Brought home: ${[summary.gold > 0 ? `${summary.gold} gold` : '', ...materials].filter(Boolean).join(', ')}.`)
  if (summary.xp > 0) out.push(`Experience earned: ${summary.xp}.${summary.levelsGained > 0 ? ` Gained ${summary.levelsGained} ${summary.levelsGained === 1 ? 'level' : 'levels'}.` : ''}`)
  for (const craft of summary.crafts) out.push(craft)
  if (summary.contractsFinished > 0) out.push(`Contracts finished: ${summary.contractsFinished}. Collect them at the Contract Board.`)
  if (summary.discovered.length > 0) out.push(`Discovered: ${summary.discovered.join(', ')}.`)
  if (summary.stopped !== null) out.push(summary.stopped === 'blocked' ? `The hero stopped: ${summary.note ?? 'the next run could not start.'}` : (STOP_TEXT[summary.stopped] ?? ''))
  return out
}

/** The catch-up bar while time away is replayed, then the "while you were away" summary. */
export function AwayPanel() {
  useSaveStatus()
  const view = getAwayView()
  if (view.phase === 'idle') return null
  if (view.phase === 'running') {
    return (
      <section aria-label="Catching up">
        <h2>Catching up on your time away…</h2>
        <progress max={100} value={Math.round(view.progress * 100)} aria-label="Catch-up progress" />{' '}
        <span data-testid="catch-up-percent">{Math.round(view.progress * 100)}%</span>
      </section>
    )
  }
  return (
    <section aria-label="While you were away">
      <h2>While you were away</h2>
      <ul data-testid="away-lines">
        {lines(view.summary!).map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
      <button type="button" className="btn-primary" onClick={dismissAway}>
        Continue
      </button>
    </section>
  )
}
