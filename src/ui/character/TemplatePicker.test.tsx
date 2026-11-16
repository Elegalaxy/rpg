import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ruleTemplates } from '../../content/ruleTemplates.ts'
import { selectedHero } from '../../persist/character.ts'
import { templatesFor } from '../../persist/ruleTemplates.ts'
import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'

import { RulesForm } from './Rules.tsx'
import { TemplatePicker } from './TemplatePicker.tsx'

function setup() {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  const hero = selectedHero(made.save)
  if (hero === null) throw new Error('no hero')
  return { save: made.save, hero }
}

const noop = () => undefined

function picker(extra: Partial<Parameters<typeof TemplatePicker>[0]> = {}): string {
  const { save, hero } = setup()
  return renderToStaticMarkup(
    <TemplatePicker
      options={templatesFor(hero, save)}
      atStackLimit={false}
      replacing={null}
      onApply={noop}
      onConfirmReplace={noop}
      onCancelReplace={noop}
      onClose={noop}
      {...extra}
    />,
  )
}

describe('template picker', () => {
  it('groups cards by situation and shows each trade-off', () => {
    const html = picker()
    for (const title of ['Dealing damage', 'Staying alive']) expect(html).toContain(title)
    expect(html).toContain('Fury engine')
    expect(html).toContain('Gives up: Hits hard but takes every blow: no guard and no heal.')
    expect(html).not.toContain('Mark then cut')
  })

  it('disables locked cards and says how to unlock them', () => {
    const html = picker()
    expect(html).toMatch(/<button[^>]*aria-label="Use template Hold the line"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Use template Hold the line"/)
    expect(html).toContain('Defeat an enemy that telegraphs an attack.')
    expect(html).not.toMatch(/aria-label="Use template Fury engine"[^>]*disabled/)
  })

  it('turns stack templates off at the stack limit, with the reason', () => {
    const { save, hero } = setup()
    const options = templatesFor(hero, save).map((option) => ({ ...option, unlocked: true, lockedReason: null }))
    const stack = ruleTemplates.find((template) => template.kind === 'stack' && (template.classId === 'any' || template.classId === 'warrior'))!
    const html = picker({ options, atStackLimit: true })
    expect(html).toContain(`aria-label="Use template ${stack.name}"`)
    expect(html).toContain('A hero can have at most 4 stacks.')
  })

  it('asks before replacing existing rules', () => {
    const template = ruleTemplates.find((entry) => entry.id === 'warrior-fury-engine')!
    const html = picker({ replacing: { template, ruleCount: 3, chainName: 'Default' } })
    expect(html).toContain('Replace the 3 rules in Default with Fury engine?')
    expect(html).toContain('Keep mine')
  })
})

describe('rules screen templates', () => {
  it('has a Templates button, and the picker opens from the empty state', () => {
    const { save, hero } = setup()
    const html = renderToStaticMarkup(<RulesForm hero={hero} save={save} />)
    expect(html).toContain('>Templates<')
    expect(html).not.toContain('Rule templates')
    const open = renderToStaticMarkup(<RulesForm hero={hero} save={save} initialPicker />)
    expect(open).toContain('aria-label="Rule templates"')
    const empty = renderToStaticMarkup(<RulesForm hero={{ ...hero, priorityRows: [] }} save={save} />)
    expect(empty).toContain('No rules: the hero uses the Fallback.')
    expect(empty).toContain('Start from template')
  })
})
