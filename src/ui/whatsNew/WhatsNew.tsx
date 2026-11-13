import { useMemo, useState } from 'react'

import { Pill, Tag, type PillKind } from '../Kit.tsx'
import { CHANGELOG_SECTIONS } from './changelog.ts'
import { CATEGORIES, inlineParts, type ChangeEntry, type ChangeSection } from './parseChangelog.ts'

/** Category meaning, defined once. Every tag also carries its name as text. */
const CATEGORY_KIND: Record<string, PillKind> = {
  New: 'good',
  Improved: 'info',
  Balance: 'gold',
  Fixed: 'owned',
  Tech: 'mat',
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, index) =>
        part.kind === 'bold' ? <strong key={index}>{part.value}</strong> : part.kind === 'code' ? <code key={index}>{part.value}</code> : part.value,
      )}
    </>
  )
}

function Entry({ entry }: { entry: ChangeEntry }) {
  return (
    <li className="whatsnew-entry">
      <span className="whatsnew-tags">
        <Pill kind={CATEGORY_KIND[entry.category] ?? 'mat'}>{entry.category}</Pill>
        {entry.planned ? <Tag kind="plain">planned</Tag> : null}
      </span>
      <span className="whatsnew-text">
        <Inline text={entry.text.charAt(0).toUpperCase() + entry.text.slice(1)} />
      </span>
    </li>
  )
}

export function WhatsNewView({ sections }: { sections: readonly ChangeSection[] }) {
  const [filter, setFilter] = useState<string | null>(null)
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const section of sections) for (const entry of section.entries) result.set(entry.category, (result.get(entry.category) ?? 0) + 1)
    return result
  }, [sections])
  const total = sections.reduce((sum, section) => sum + section.entries.length, 0)
  const shown = sections
    .map((section) => ({ section, entries: filter === null ? section.entries : section.entries.filter((entry) => entry.category === filter) }))
    .filter((item) => item.entries.length > 0)
  return (
    <section className="whatsnew" aria-labelledby="whatsnew-title">
      <h2 id="whatsnew-title">What&apos;s new</h2>
      <div className="whatsnew-chips" role="group" aria-label="Filter by category">
        <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>
          All <span className="whatsnew-count">{total}</span>
        </button>
        {CATEGORIES.map((category) => (
          <button key={category} type="button" aria-pressed={filter === category} onClick={() => setFilter(filter === category ? null : category)}>
            {category} <span className="whatsnew-count">{counts.get(category) ?? 0}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="whatsnew-empty" role="status">
          No changes in this category yet.
        </p>
      ) : (
        shown.map(({ section, entries }, index) => (
          <details key={section.heading} className="whatsnew-section" open={index === 0}>
            <summary>
              <strong>{section.version}</strong>
              {section.title !== '' ? <span className="whatsnew-title"> · {section.title}</span> : null}
              {section.date !== '' ? <span className="whatsnew-date"> · {section.date}</span> : null}
              <span className="whatsnew-count"> · {entries.length}</span>
            </summary>
            {section.intro !== '' ? (
              <p className="whatsnew-intro">
                <Inline text={section.intro} />
              </p>
            ) : null}
            <ul>
              {entries.map((entry, entryIndex) => (
                <Entry key={entryIndex} entry={entry} />
              ))}
            </ul>
          </details>
        ))
      )}
    </section>
  )
}

export function WhatsNew() {
  return <WhatsNewView sections={CHANGELOG_SECTIONS} />
}
