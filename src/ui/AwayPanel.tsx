import type { AwayReport, HeroAwaySummary } from '../persist/offline.ts'
import { Tag } from './Kit.tsx'
import { dismissAway, getAwayView, useSaveStatus } from './store.ts'

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`
}

const STOP_TEXT: { [reason: string]: string } = {
  returned: 'is back in Greyhaven. Close the run on the Map.',
  uncleared: 'stopped: this route is not cleared yet, so it was not run again.',
  supplies: 'stopped: the packed supplies are not in the stash any more.',
  bagFull: 'stopped: the bag is nearly full and your order is to ask. The run waits for you on the Map.',
  runLimit: 'stopped: the run limit you set was reached.',
  defeat: 'fell. Select the hero and close the run on the Map to pay the rescue fee.',
}

const STOP_LABEL: { [reason: string]: { kind: 'bad' | 'info'; text: string } } = {
  returned: { kind: 'info', text: 'Back in town' },
  uncleared: { kind: 'bad', text: 'Route not cleared' },
  supplies: { kind: 'bad', text: 'Out of supplies' },
  blocked: { kind: 'bad', text: 'Could not start' },
  bagFull: { kind: 'info', text: 'Bag full, waiting' },
  runLimit: { kind: 'info', text: 'Run limit reached' },
  defeat: { kind: 'bad', text: 'Defeated' },
}

function stopLine(hero: HeroAwaySummary): string {
  if (hero.stopped === null) return ''
  if (hero.stopped === 'blocked') return `${hero.heroName} stopped: ${hero.note ?? 'the next run could not start.'}`
  return `${hero.heroName} ${STOP_TEXT[hero.stopped] ?? ''}`
}

function materialList(hero: HeroAwaySummary): string {
  return Object.entries(hero.materials)
    .map(([id, amount]) => `${amount} ${id}`)
    .join(', ')
}

/** The report itself, with no store behind it. One table row per hero, then what is shared. */
export function AwayReportView({ report }: { report: AwayReport }) {
  const intro =
    report.awayMs > report.replayedMs
      ? `You were away ${duration(report.awayMs)}. Only the first ${duration(report.replayedMs)} count.`
      : `You were away ${duration(report.awayMs)}.`
  const withMaterials = report.heroes.filter((hero) => Object.keys(hero.materials).length > 0)
  const contracts = report.heroes.reduce((sum, hero) => sum + hero.contractsFinished, 0)
  const stops = report.heroes.map(stopLine).filter((line) => line !== '')
  return (
    <>
      <p>{intro}</p>
      {report.heroes.length > 0 ? (
        <table className="away-table" aria-label="What each hero did">
          <thead>
            <tr>
              <th scope="col">Hero</th>
              <th scope="col" className="num">Runs</th>
              <th scope="col" className="num">Fights won</th>
              <th scope="col" className="num">Gold</th>
              <th scope="col" className="num">XP</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.heroes.map((hero) => {
              const label = hero.stopped === null ? null : (STOP_LABEL[hero.stopped] ?? { kind: 'bad' as const, text: 'Stopped' })
              return (
                <tr key={hero.heroId} data-testid={`away-row-${hero.heroId}`}>
                  <th scope="row">{hero.heroName}</th>
                  <td className="num">{hero.runs}</td>
                  <td className="num">{hero.fightsWon}</td>
                  <td className="num">{hero.gold}</td>
                  <td className="num">
                    {hero.xp}
                    {hero.levelsGained > 0 ? <Tag kind="good"> ▲ {hero.levelsGained} {hero.levelsGained === 1 ? 'level' : 'levels'}</Tag> : null}
                  </td>
                  <td>{label === null ? <Tag kind="good">Still running</Tag> : <Tag kind={label.kind}>{label.text}</Tag>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
      <ul data-testid="away-lines">
        {stops.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {report.crafts.map((craft, index) => (
          <li key={`${index}-${craft}`}>{craft}</li>
        ))}
        {contracts > 0 ? <li>Contracts finished: {contracts}. Collect them at the Contract Board.</li> : null}
        {report.discovered.length > 0 ? <li>Discovered: {report.discovered.join(', ')}.</li> : null}
      </ul>
      {withMaterials.map((hero) => (
        <details key={hero.heroId}>
          <summary>
            Materials brought home by {hero.heroName} ({Object.values(hero.materials).reduce((sum, n) => sum + n, 0)})
          </summary>
          <p>{materialList(hero)}</p>
        </details>
      ))}
    </>
  )
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
      <AwayReportView report={view.summary!} />
      <button type="button" className="btn-primary" onClick={dismissAway}>
        Continue
      </button>
    </section>
  )
}
