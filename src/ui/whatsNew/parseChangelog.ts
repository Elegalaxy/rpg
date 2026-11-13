/** Pure parser for CHANGELOG.md. The page feeds it the raw file text at build time. */

export const CATEGORIES = ['New', 'Improved', 'Balance', 'Fixed', 'Tech'] as const
export type Category = (typeof CATEGORIES)[number]

export type ChangeEntry = {
  /** One of CATEGORIES for a well-formed file; kept as written so the file-shape test can catch a typo. */
  category: string
  /** True for lines such as `Improved (planned): ...`. */
  planned: boolean
  text: string
}

export type ChangeSection = {
  /** The heading text after `## `. */
  heading: string
  unreleased: boolean
  /** `0.10.0` for a patch, `Unreleased` for the open section. */
  version: string
  /** Date or date range; empty when the heading has none. */
  date: string
  /** The patch name, or the Unreleased title. */
  title: string
  /** Prose lines between the heading and the first bullet, joined. */
  intro: string
  entries: ChangeEntry[]
}

const BULLET = /^- ([A-Za-z]+)(?: \(([^)]*)\))?: (.+)$/

function parseHeading(heading: string): Omit<ChangeSection, 'intro' | 'entries'> {
  if (/^Unreleased\b/.test(heading)) {
    const title = heading.replace(/^Unreleased\s*:?\s*/, '')
    return { heading, unreleased: true, version: 'Unreleased', date: '', title }
  }
  const parts = heading.split(' · ').map((part) => part.trim())
  if (parts.length >= 3) return { heading, unreleased: false, version: parts[0] ?? '', date: parts[1] ?? '', title: parts.slice(2).join(' · ') }
  return { heading, unreleased: false, version: parts[0] ?? heading, date: '', title: parts.slice(1).join(' · ') }
}

/** Sections in file order (newest first). Anything before the first `## ` is ignored. */
export function parseChangelog(source: string): ChangeSection[] {
  const sections: ChangeSection[] = []
  let current: ChangeSection | null = null
  const intro: string[] = []
  const close = () => {
    if (current !== null) current.intro = intro.join(' ').trim()
    intro.length = 0
  }
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (line.startsWith('## ')) {
      close()
      current = { ...parseHeading(line.slice(3).trim()), intro: '', entries: [] }
      sections.push(current)
      continue
    }
    if (current === null) continue
    const bullet = BULLET.exec(line)
    if (bullet !== null) {
      const [, category = '', suffix = '', text = ''] = bullet
      current.entries.push({ category, planned: /planned/i.test(suffix), text })
    } else if (line.trim() !== '' && !line.startsWith('- ') && current.entries.length === 0 && line !== '---') {
      intro.push(line.trim())
    }
  }
  close()
  return sections
}

export type TextPart = { kind: 'text' | 'bold' | 'code'; value: string }

/** Splits `**bold**` and `code` spans so the page can render them without raw HTML. */
export function inlineParts(text: string): TextPart[] {
  const parts: TextPart[] = []
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`/g
  let last = 0
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > last) parts.push({ kind: 'text', value: text.slice(last, match.index) })
    if (match[1] !== undefined) parts.push({ kind: 'bold', value: match[1] })
    else parts.push({ kind: 'code', value: match[2] ?? '' })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}
