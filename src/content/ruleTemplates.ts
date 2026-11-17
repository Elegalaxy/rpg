import type { HeroClass } from '../sim/constants.ts'

/**
 * Starter scaffolds for the rule editor (GAME_DESIGN §7, "Rule chain view and templates"). Plain data only.
 * Every template leaves at least one blank for the player: an empty threshold (`value: ''`) or an empty skill
 * slot (`skillId: null`). Skill ids name skills the class can have; the persist layer drops any the hero lacks.
 * Hints are generic and never name a skill.
 */

export type TemplateConditionType = 'heroHp' | 'resource' | 'enemyCount' | 'telegraph' | 'telegraphWithin' | 'mark' | 'bossPhase'

export type TemplateCondition = {
  type: TemplateConditionType
  operator: string
  /** Empty means the player fills it in. The editor refuses to save an empty number. */
  value: string
  /** What to decide when the value is blank. */
  hint?: string
}

export type TemplateRow = {
  /** Null is a blank skill slot. */
  skillId: string | null
  /** Shown when the slot is blank, or when the hero does not have the skill. */
  hint: string
  condition?: TemplateCondition
}

export type TemplateSituation = 'damage' | 'defense' | 'crowd' | 'boss'

export type TemplateUnlock = 'open' | 'telegraph' | 'group' | 'boss'

export type RuleTemplate = {
  id: string
  name: string
  classId: HeroClass | 'any'
  /** A rows template fills the chain you are on. A stack template makes a new stack. */
  kind: 'rows' | 'stack'
  situation: TemplateSituation
  /** One line on what it sets up. */
  summary: string
  /** One line on what it gives up. */
  tradeOff: string
  /** For a stack template: its name and trigger. */
  stackName?: string
  trigger?: TemplateCondition
  /** At most 4 rows with at most one condition each. */
  rows: readonly TemplateRow[]
  unlock: TemplateUnlock
  /** Shown while locked. */
  unlockHint: string
}

export const SLOT_HINT = 'Pick one of your equipped skills here.'

export const UNLOCK_HINTS: { [unlock in TemplateUnlock]: string } = {
  open: '',
  telegraph: 'Defeat an enemy that telegraphs an attack.',
  group: 'Defeat an enemy that fights in a swarm.',
  boss: 'Defeat a boss that changes phase.',
}

export const ruleTemplates: readonly RuleTemplate[] = [
  {
    id: 'warrior-fury-engine',
    name: 'Fury engine',
    classId: 'warrior',
    kind: 'rows',
    situation: 'damage',
    summary: 'Build Fury with a filler, then spend it on a heavy hit.',
    tradeOff: 'Hits hard but takes every blow: no guard and no heal.',
    rows: [
      { skillId: 'cleave', hint: SLOT_HINT, condition: { type: 'resource', operator: 'atLeast', value: '', hint: 'How much Fury to hold before spending.' } },
      { skillId: 'driving-blow', hint: SLOT_HINT },
    ],
    unlock: 'open',
    unlockHint: UNLOCK_HINTS.open,
  },
  {
    id: 'warrior-hold-the-line',
    name: 'Hold the line',
    classId: 'warrior',
    kind: 'rows',
    situation: 'defense',
    summary: 'Guard when a hit is about to land and heal when low.',
    tradeOff: 'Safe, but nothing here deals damage until you add it.',
    rows: [
      { skillId: 'shield-brace', hint: SLOT_HINT, condition: { type: 'telegraphWithin', operator: 'atMost', value: '', hint: 'How many seconds before the hit to guard.' } },
      { skillId: 'second-wind', hint: SLOT_HINT, condition: { type: 'heroHp', operator: 'atMost', value: '', hint: 'At what HP % to heal.' } },
    ],
    unlock: 'telegraph',
    unlockHint: UNLOCK_HINTS.telegraph,
  },
  {
    id: 'assassin-mark-then-cut',
    name: 'Mark then cut',
    classId: 'assassin',
    kind: 'rows',
    situation: 'damage',
    summary: 'Keep the target marked, then cut it while it is.',
    tradeOff: 'Steady damage with no finisher until you choose one.',
    rows: [
      { skillId: 'mark-for-death', hint: SLOT_HINT, condition: { type: 'mark', operator: 'absent', value: '' } },
      { skillId: 'shadow-cut', hint: SLOT_HINT, condition: { type: 'mark', operator: 'present', value: '' } },
      { skillId: null, hint: 'Choose the skill that pays off a marked target.' },
    ],
    unlock: 'open',
    unlockHint: UNLOCK_HINTS.open,
  },
  {
    id: 'assassin-many-blades',
    name: 'Many blades',
    classId: 'assassin',
    kind: 'stack',
    situation: 'crowd',
    stackName: 'Many blades',
    trigger: { type: 'enemyCount', operator: 'atLeast', value: '', hint: 'How many enemies make this stack take over.' },
    summary: 'Switch to an area attack when enough enemies are alive.',
    tradeOff: 'Wastes Mark and has no finisher.',
    rows: [{ skillId: 'fan-of-knives', hint: SLOT_HINT }],
    unlock: 'group',
    unlockHint: UNLOCK_HINTS.group,
  },
  {
    id: 'ranger-open-strong',
    name: 'Open strong',
    classId: 'ranger',
    kind: 'rows',
    situation: 'damage',
    summary: 'Spend Readiness on a strong opener while it lasts.',
    tradeOff: 'Strong start, then nothing planned once Readiness runs dry.',
    rows: [
      { skillId: 'aimed-shot', hint: SLOT_HINT, condition: { type: 'resource', operator: 'atLeast', value: '', hint: 'How much Readiness the opener needs.' } },
      { skillId: null, hint: 'Choose what to do when Readiness runs dry.' },
    ],
    unlock: 'open',
    unlockHint: UNLOCK_HINTS.open,
  },
  {
    id: 'ranger-dont-get-hit',
    name: "Don't get hit",
    classId: 'ranger',
    kind: 'stack',
    situation: 'defense',
    stackName: "Don't get hit",
    trigger: { type: 'telegraphWithin', operator: 'atMost', value: '', hint: 'How many seconds before a hit to start dodging.' },
    summary: 'Switch to evasion when a hit is coming.',
    tradeOff: 'Only dodges and traps: no damage rows.',
    rows: [
      { skillId: 'fade-back', hint: SLOT_HINT },
      { skillId: 'snare-trap', hint: SLOT_HINT },
    ],
    unlock: 'telegraph',
    unlockHint: UNLOCK_HINTS.telegraph,
  },
  {
    id: 'mage-mana-budget',
    name: 'Mana budget',
    classId: 'mage',
    kind: 'rows',
    situation: 'damage',
    summary: 'Recover when Mana is low and spend it on one spell when it is high.',
    tradeOff: 'No area damage and no ward.',
    rows: [
      { skillId: 'arcane-recovery', hint: SLOT_HINT, condition: { type: 'resource', operator: 'atMost', value: '', hint: 'At what Mana to recover.' } },
      { skillId: 'frost-lance', hint: SLOT_HINT, condition: { type: 'resource', operator: 'atLeast', value: '', hint: 'How much Mana to keep before casting.' } },
    ],
    unlock: 'open',
    unlockHint: UNLOCK_HINTS.open,
  },
  {
    id: 'mage-crowd-burn',
    name: 'Crowd burn',
    classId: 'mage',
    kind: 'stack',
    situation: 'crowd',
    stackName: 'Crowd burn',
    trigger: { type: 'enemyCount', operator: 'atLeast', value: '', hint: 'How many enemies make this stack take over.' },
    summary: 'Switch to area spells when enough enemies are alive.',
    tradeOff: 'Burns Mana fast with no recovery row.',
    rows: [
      { skillId: 'chain-lightning', hint: SLOT_HINT },
      { skillId: 'fireball', hint: SLOT_HINT },
    ],
    unlock: 'group',
    unlockHint: UNLOCK_HINTS.group,
  },
  {
    id: 'cleric-patient-vow',
    name: 'Patient vow',
    classId: 'cleric',
    kind: 'rows',
    situation: 'defense',
    summary: 'Heal when low, ward before a hit, and strike otherwise.',
    tradeOff: 'Lasts long and kills slowly, with no plan for Faith.',
    rows: [
      { skillId: 'mend', hint: SLOT_HINT, condition: { type: 'heroHp', operator: 'atMost', value: '', hint: 'At what HP % to heal.' } },
      { skillId: 'ward', hint: SLOT_HINT, condition: { type: 'telegraph', operator: 'present', value: '' } },
      { skillId: 'smite', hint: SLOT_HINT },
    ],
    unlock: 'open',
    unlockHint: UNLOCK_HINTS.open,
  },
  {
    id: 'any-drink-when-low',
    name: 'Drink when low',
    classId: 'any',
    kind: 'rows',
    situation: 'defense',
    summary: 'Drink a healing supply from your pack when HP gets low, the stronger one first.',
    tradeOff: 'Uses up supplies and deals no damage: it only keeps you standing.',
    rows: [
      { skillId: 'greater-draught', hint: SLOT_HINT, condition: { type: 'heroHp', operator: 'atMost', value: '', hint: 'At what HP % to drink the stronger supply.' } },
      { skillId: 'healing-draught', hint: SLOT_HINT, condition: { type: 'heroHp', operator: 'atMost', value: '', hint: 'At what HP % to drink the basic supply.' } },
    ],
    unlock: 'open',
    unlockHint: UNLOCK_HINTS.open,
  },
  {
    id: 'any-ward-with-supplies',
    name: 'Ward with supplies',
    classId: 'any',
    kind: 'rows',
    situation: 'defense',
    summary: 'Ward off a telegraphed hit with a supply from your pack, the stronger one first.',
    tradeOff: 'Uses up supplies and deals no damage: add your attacks below it.',
    rows: [
      { skillId: 'riftglass-ward', hint: SLOT_HINT, condition: { type: 'telegraphWithin', operator: 'atMost', value: '', hint: 'How many seconds before the hit to use this. It protects for 5 seconds.' } },
      { skillId: 'ward-charm', hint: SLOT_HINT, condition: { type: 'telegraphWithin', operator: 'atMost', value: '', hint: 'How many seconds before the hit to use this. It protects for 5 seconds.' } },
    ],
    unlock: 'open',
    unlockHint: UNLOCK_HINTS.open,
  },
  {
    id: 'any-boss-turn',
    name: 'Boss turn',
    classId: 'any',
    kind: 'stack',
    situation: 'boss',
    stackName: 'Boss turn',
    trigger: { type: 'bossPhase', operator: 'atLeast', value: '2' },
    summary: 'A stack that takes over once a boss reaches its second phase.',
    tradeOff: 'Starts empty: the boss plan is yours to write.',
    rows: [{ skillId: null, hint: 'Choose how to answer the boss in its later phases.' }],
    unlock: 'boss',
    unlockHint: UNLOCK_HINTS.boss,
  },
]
