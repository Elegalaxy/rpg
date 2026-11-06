import type { SavedHero } from '../../persist/save.ts'
import { goingInLines, type GoTo } from './goingInLines.ts'

export type { GoTo }

/** A read-only look at what the hero takes into the run, with a way to fix each part. */
export function GoingIn({ hero, onGo }: { hero: SavedHero; onGo?: (to: GoTo) => void }) {
  const lines = goingInLines(hero)
  return (
    <section className="going-in" aria-label="Going in with">
      <h4>Going in with</h4>
      <dl className="route-facts">
        {lines.map((line) => (
          <div key={line.label} className="going-in-line">
            <dt>{line.label}</dt>
            <dd>
              {line.text}
              {line.warn !== undefined ? <small className="going-in-warn"> {line.warn}</small> : null}
              {line.edit !== undefined && onGo !== undefined ? (
                <button type="button" className="link-button" onClick={() => onGo(line.edit!.to)}>
                  {line.edit.label}
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
