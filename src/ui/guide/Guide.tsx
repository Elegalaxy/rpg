import { useEffect, useMemo, useRef, useState } from 'react'

import { Tag } from '../Kit.tsx'
import { GUIDE_SECTIONS, buildGuide, searchGuide, type GuideEntry, type GuideEntryId, type GuideSection } from './guideIndex.ts'

export type GuideTarget = { id: GuideEntryId; nonce: number }

const FLASH_MS = 1800

/** The newest request this page has acted on, so reopening the tab later does not replay an old link. */
let handledNonce = 0

function factValue(entry: GuideEntry, label: string): string {
  return entry.facts.find((fact) => fact.label === label)?.value ?? ''
}

type JumpFn = (id: GuideEntryId) => void

function EntryLinks({ entry, onJump }: { entry: GuideEntry; onJump: JumpFn }) {
  if (entry.links.length === 0) return null
  return (
    <p className="guide-links">
      <span className="guide-links-label">See also</span>
      {entry.links.map((link) => (
        <button key={link.id} type="button" className="guide-link-button" onClick={() => onJump(link.id)}>
          {link.label}
        </button>
      ))}
    </p>
  )
}

function EntryCard({ entry, flash, onJump }: { entry: GuideEntry; flash: boolean; onJump: JumpFn }) {
  return (
    <article id={entry.id} className={`guide-entry${flash ? ' guide-flash' : ''}`}>
      <h4 tabIndex={-1} data-guide-heading>
        {entry.title}
      </h4>
      {entry.summary !== '' ? <p className="guide-summary">{entry.summary}</p> : null}
      {entry.facts.length > 0 ? (
        <dl className="guide-facts">
          {entry.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {entry.lines.length > 0 ? (
        <ul className="guide-lines">
          {entry.lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
      {entry.prose.length > 0 ? (
        <details className="guide-more">
          <summary>How it plays</summary>
          {entry.prose.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </details>
      ) : null}
      <EntryLinks entry={entry} onJump={onJump} />
    </article>
  )
}

function SkillTable({ group, entries, flashId, onJump }: { group: string; entries: GuideEntry[]; flashId: string | null; onJump: JumpFn }) {
  return (
    <div className="guide-group">
      <h3 className="guide-group-title">
        {group} <span className="guide-count">{entries.length}</span>
      </h3>
      <div className="guide-table-wrap" role="region" aria-label={`${group} skills`} tabIndex={0}>
        <table className="guide-skills">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col" className="guide-num">
                Cost
              </th>
              <th scope="col" className="guide-num">
                Cooldown
              </th>
              <th scope="col">Target</th>
              <th scope="col">Effects</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} id={entry.id} className={flashId === entry.id ? 'guide-flash' : undefined}>
                <th scope="row">
                  <span tabIndex={-1} data-guide-heading className="guide-skill-name">
                    {entry.title}
                  </span>
                  <span className="guide-skill-unlock">{factValue(entry, 'Unlocked by')}</span>
                  {factValue(entry, 'Needs') !== '' ? <span className="guide-skill-unlock">Needs {factValue(entry, 'Needs')}</span> : null}
                </th>
                <td className="guide-num" data-label="Cost">
                  {factValue(entry, 'Cost')}
                </td>
                <td className="guide-num" data-label="Cooldown">
                  {factValue(entry, 'Cooldown')}
                </td>
                <td data-label="Target">{factValue(entry, 'Target')}</td>
                <td data-label="Effects">
                  <ul className="guide-lines">
                    {entry.lines.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  {entry.links.map((link) => (
                    <button key={link.id} type="button" className="guide-link-button" onClick={() => onJump(link.id)}>
                      {link.label}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionBody({ section, entries, flashId, onJump }: { section: GuideSection; entries: GuideEntry[]; flashId: string | null; onJump: JumpFn }) {
  const groups: { name: string; items: GuideEntry[] }[] = []
  for (const entry of entries) {
    const name = entry.group ?? ''
    const found = groups.find((group) => group.name === name)
    if (found === undefined) groups.push({ name, items: [entry] })
    else found.items.push(entry)
  }
  return (
    <div className="guide-section-body">
      {groups.map((group) =>
        section === 'skills' ? (
          <SkillTable key={group.name} group={group.name} entries={group.items} flashId={flashId} onJump={onJump} />
        ) : (
          <div key={group.name} className="guide-group">
            {group.name !== '' ? (
              <h3 className="guide-group-title">
                {group.name} <span className="guide-count">{group.items.length}</span>
              </h3>
            ) : null}
            {group.items.map((entry) => (
              <EntryCard key={entry.id} entry={entry} flash={flashId === entry.id} onJump={onJump} />
            ))}
          </div>
        ),
      )}
    </div>
  )
}

export function GuideView({ entries, target = null }: { entries: readonly GuideEntry[]; target?: GuideTarget | null }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<GuideSection | null>(null)
  const [opened, setOpened] = useState<Partial<Record<GuideSection, boolean>>>({ basics: true })
  const [flashId, setFlashId] = useState<string | null>(null)
  const pending = useRef<GuideEntryId | null>(null)
  const [scrollTick, setScrollTick] = useState(0)
  const searching = query.trim() !== ''

  const matches = useMemo(() => searchGuide(entries, query, filter), [entries, query, filter])
  const chipCounts = useMemo(() => {
    const result = new Map<GuideSection, number>()
    for (const entry of searchGuide(entries, query, null)) result.set(entry.section, (result.get(entry.section) ?? 0) + 1)
    return result
  }, [entries, query])
  const total = useMemo(() => searchGuide(entries, query, null).length, [entries, query])

  function jump(id: GuideEntryId): void {
    const entry = entries.find((candidate) => candidate.id === id)
    if (entry === undefined) return
    setQuery('')
    setFilter(null)
    setOpened((previous) => ({ ...previous, [entry.section]: true }))
    setFlashId(id)
    pending.current = id
    setScrollTick((tick) => tick + 1)
  }

  const nonce = target?.nonce
  const targetId = target?.id
  useEffect(() => {
    if (targetId !== undefined && nonce !== undefined && nonce > handledNonce) {
      handledNonce = nonce
      jump(targetId)
    }
    // Only a new nonce is a new request; `jump` reads the latest entries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])

  useEffect(() => {
    // Tick 0 is the first mount: a request seen then is replayed by the tick that its own state change causes.
    if (scrollTick === 0) return
    const id = pending.current
    if (id === null) return
    pending.current = null
    // The commit that opened the section and cleared the search is already in the DOM here.
    const element = document.getElementById(id)
    if (element === null) return
    element.scrollIntoView({ block: 'start', behavior: 'smooth' })
    element.querySelector<HTMLElement>('[data-guide-heading]')?.focus({ preventScroll: true })
  }, [scrollTick])

  useEffect(() => {
    if (flashId === null) return
    const timer = setTimeout(() => setFlashId(null), FLASH_MS)
    return () => clearTimeout(timer)
  }, [flashId])

  return (
    <section className="guide" aria-labelledby="guide-title">
      <h2 id="guide-title">Guide</h2>
      <div className="guide-search">
        <input
          type="search"
          aria-label="Search the guide"
          placeholder="Search classes, skills, supplies…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="whatsnew-chips" role="group" aria-label="Filter by section">
        <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>
          All <span className="whatsnew-count">{total}</span>
        </button>
        {GUIDE_SECTIONS.map((section) => (
          <button key={section.id} type="button" aria-pressed={filter === section.id} onClick={() => setFilter(filter === section.id ? null : section.id)}>
            {section.label} <span className="whatsnew-count">{chipCounts.get(section.id) ?? 0}</span>
          </button>
        ))}
      </div>
      {matches.length === 0 ? (
        <p className="whatsnew-empty" role="status">
          Nothing in the guide matches &quot;{query}&quot;.{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFilter(null)
            }}
          >
            Clear
          </button>
        </p>
      ) : (
        GUIDE_SECTIONS.map((section) => {
          const inSection = matches.filter((entry) => entry.section === section.id)
          if (inSection.length === 0) return null
          const open = searching || filter !== null || opened[section.id] === true
          return (
            <details
              key={section.id}
              className="whatsnew-section guide-section"
              id={`guide-section-${section.id}`}
              open={open}
              onToggle={(event) => {
                const next = event.currentTarget.open
                if (next !== open && !searching && filter === null) setOpened((previous) => ({ ...previous, [section.id]: next }))
              }}
            >
              <summary>
                <strong>{section.label}</strong>
                <span className="whatsnew-count"> · {inSection.length}</span>
                {section.id === 'skills' ? <Tag kind="plain">base values</Tag> : null}
              </summary>
              <SectionBody section={section.id} entries={inSection} flashId={flashId} onJump={jump} />
            </details>
          )
        })
      )}
    </section>
  )
}

export function Guide({ target = null }: { target?: GuideTarget | null }) {
  const entries = useMemo(() => buildGuide(), [])
  return <GuideView entries={entries} target={target} />
}
