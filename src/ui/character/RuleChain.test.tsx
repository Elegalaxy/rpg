import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { selectedHero } from '../../persist/character.ts'
import { ruleSkillIds, type RowDraft } from '../../persist/loadout.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'

import { RuleChain, type RuleChainProps } from './RuleChain.tsx'

function warrior() {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)
  if (hero === null) throw new Error('no hero')
  return hero
}

const blow: RowDraft = { skillId: 'driving-blow', conditions: [], targetPriority: '' }
const noop = () => undefined

function chain(rows: RowDraft[], extra: Partial<RuleChainProps> = {}): string {
  const hero = warrior()
  return renderToStaticMarkup(
    <RuleChain
      hero={hero}
      rows={rows}
      stackId="default"
      skillIds={ruleSkillIds(hero)}
      open={null}
      counts={null}
      removed={false}
      onOpen={noop}
      onPatch={noop}
      onMove={noop}
      onReorder={noop}
      onDuplicate={noop}
      onRemove={noop}
      onAdd={noop}
      onUndo={noop}
      {...extra}
    />,
  )
}

describe('rule chain', () => {
  it('shows the empty state with the Fallback and the template entry', () => {
    const html = chain([], { onStartTemplate: noop })
    expect(html).toContain('No rules: the hero uses the Fallback.')
    expect(html).toContain('Start from template')
    expect(html).toContain('Weapon basic attack')
    expect(html).not.toContain('class="rc-add"')
  })

  it('reserves the Used slot with a dash and shows counts when there is data', () => {
    expect(chain([blow])).toContain('Used —')
    expect(chain([blow], { counts: { default: [4] } })).toContain('Used 4×')
    expect(chain([blow], { counts: {} })).toContain('Used 0×')
  })

  it('badges an unconditional row and a shadowed later row', () => {
    const html = chain([blow, { ...blow, conditions: [{ type: 'heroHp', operator: 'atMost', value: '50', statusId: '' }] }])
    expect(html).toContain('Always when ready')
    expect(html).toContain('Never reached: rule 1 always wins')
  })

  it('shows what the picked skill costs and does inside the open node only', () => {
    expect(chain([blow])).not.toContain('rule-skill-facts')
    const html = chain([blow], { open: 0 })
    expect(html).toContain('data-testid="rule-skill-facts"')
    expect(html).toMatch(/Cooldown \d/)
    expect(chain([{ ...blow, skillId: '' }], { open: 0 })).not.toContain('rule-skill-facts')
  })

  it('keeps the editing labels inside the open node only', () => {
    expect(chain([blow])).not.toContain('Rule 1 skill')
    const html = chain([blow], { open: 0 })
    for (const label of ['Rule 1 skill', 'Rule 1 target', 'Move rule 1 up', 'Move rule 1 down', 'Duplicate rule 1', 'Remove rule 1']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('aria-expanded="true"')
  })

  it('turns Add rule off at 12 rules and says why', () => {
    const rows = Array.from({ length: 12 }, () => blow)
    const html = chain(rows)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Add rule/)
    expect(html).toContain('A hero can have at most 12 rules.')
    expect(chain([blow])).not.toContain('A hero can have at most 12 rules.')
  })

  it('marks each rule as draggable so the card can be reordered', () => {
    const html = chain([blow, { ...blow, skillId: 'sundering-blow' }])
    expect(html).toContain('draggable="true"')
    expect(html).toContain('aria-grabbed="false"')
  })

  it('offers Undo after a remove', () => {
    expect(chain([blow], { removed: true })).toContain('Rule removed.')
    expect(chain([blow])).not.toContain('Rule removed.')
  })
})

describe('waiting rules (Step 13.37)', () => {
  it('tags a waiting rule with the skill it waits for and styles it as waiting', () => {
    const html = chain([{ skillId: 'cleave', conditions: [], targetPriority: '' }, blow], { waiting: ['cleave'] })
    expect(html).toContain('Waiting for')
    expect(html).toContain('Cleave')
    expect(html).toContain('rc-node--waiting')
    expect(html.match(/rc-node--waiting/g)).toHaveLength(1)
    expect(chain([blow])).not.toContain('Waiting for')
  })

  it('offers a waiting skill in the skill menu as not relearned', () => {
    const html = chain([{ skillId: 'cleave', conditions: [], targetPriority: '' }], { waiting: ['cleave'], open: 0 })
    expect(html).toContain('Cleave (not relearned)')
  })
})
