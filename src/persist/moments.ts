import { firstClearReward, firstClearRewardText } from '../content/firstClear.ts'
import { echoRewardText, firstClearLabel } from './firstClear.ts'
import { selectedHero } from './character.ts'
import { isComplete } from './contracts.ts'
import { bossFaced } from './reincarnation.ts'
import { contractFor, type SaveData } from './save.ts'
import { newlyDiscovered } from './world.ts'

/** Something worth telling the player about, found by comparing the save before and after a change. */
export type Moment =
  | { kind: 'level'; level: number; points: number }
  | { kind: 'warden'; text: string }
  | { kind: 'firstClear'; text: string }
  | { kind: 'contract'; text: string }
  | { kind: 'discovery'; text: string }

export type MomentKind = Moment['kind']

/** The order moments are listed in when several arrive together. */
export const MOMENT_ORDER: readonly MomentKind[] = ['level', 'warden', 'firstClear', 'contract', 'discovery']

export function sortMoments(moments: readonly Moment[]): Moment[] {
  return [...moments].sort((a, b) => MOMENT_ORDER.indexOf(a.kind) - MOMENT_ORDER.indexOf(b.kind))
}

/**
 * The selected hero's moments between two saves: a new level, a Warden win or reincarnation unlocked, first
 * clears paid, contracts finished, and places discovered. Empty when the selected hero changed in between.
 */
export function momentsBetween(before: SaveData, after: SaveData): Moment[] {
  const was = selectedHero(before)
  const now = selectedHero(after)
  if (was === null || now === null || was.id !== now.id) return []
  const moments: Moment[] = []
  if (now.progress.level > was.progress.level) {
    const points = now.progress.unspentAttributePoints + now.progress.unspentSkillPoints + now.progress.legacySkillPoints
    moments.push({ kind: 'level', level: now.progress.level, points })
  }
  if (now.echoRank > was.echoRank) moments.push({ kind: 'warden', text: `The Fractured Warden fell. Echo rank ${now.echoRank} is unlocked.` })
  if (bossFaced(was) === null && bossFaced(now) !== null) moments.push({ kind: 'warden', text: 'You faced a boss this life. You can now reincarnate.' })
  const paid = new Set(was.firstClearIds ?? [])
  for (const nodeId of now.firstClearIds ?? []) {
    const reward = paid.has(nodeId) ? null : firstClearReward(nodeId)
    if (reward !== null) moments.push({ kind: 'firstClear', text: `${reward.name}: ${firstClearRewardText(reward)}` })
    else if (!paid.has(nodeId) && nodeId.startsWith('echo:')) moments.push({ kind: 'firstClear', text: `${firstClearLabel(nodeId, undefined)}: ${echoRewardText(Number(nodeId.slice(5)))}` })
  }
  for (const active of now.purse.contracts) {
    const def = contractFor(now.purse, active.contractId)
    if (!isComplete(active, def)) continue
    const earlier = was.purse.contracts.find((entry) => entry.contractId === active.contractId)
    if (earlier !== undefined && isComplete(earlier, contractFor(was.purse, earlier.contractId))) continue
    moments.push({ kind: 'contract', text: def?.name ?? active.contractId })
  }
  for (const name of newlyDiscovered(before.account.discoveries, after.account.discoveries)) moments.push({ kind: 'discovery', text: name })
  return sortMoments(moments)
}

/** One line for a toast. */
export function momentLine(moment: Moment): string {
  if (moment.kind === 'level') return `Level ${moment.level} reached.${moment.points > 0 ? ` ${moment.points} points to spend.` : ''}`
  if (moment.kind === 'firstClear') return `First clear: ${moment.text}`
  if (moment.kind === 'contract') return `Contract complete: ${moment.text}. Collect it at the Contract Board.`
  if (moment.kind === 'discovery') return `New place found: ${moment.text}`
  return moment.text
}
