import changelogSource from '../../../CHANGELOG.md?raw'
import { parseChangelog, type ChangeSection } from './parseChangelog.ts'

/** The repo's CHANGELOG.md, read at build time. */
export const CHANGELOG_SECTIONS: readonly ChangeSection[] = parseChangelog(changelogSource)

/** The badge key: changes when a new patch or a new line lands. */
export function changelogKey(sections: readonly ChangeSection[]): string {
  const first = sections[0]
  return first === undefined ? '' : `${first.heading}|${first.entries.length}`
}
