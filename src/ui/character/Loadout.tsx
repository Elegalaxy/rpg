import { Collapsible } from '../Collapsible.tsx'
import { Help } from '../Help.tsx'
import { Tag } from '../Kit.tsx'
import { skillFacts } from '../skillInfo.ts'
import { useState } from 'react'

import { skillName } from '../../persist/loadout.ts'
import { selectedHero } from '../../persist/character.ts'
import type { SavedHero } from '../../persist/save.ts'
import { saveLoadoutFromUi, useSaveStatus } from '../store.ts'

function LoadoutForm({ hero }: { hero: SavedHero }) {
  const [chosen, setChosen] = useState<string[]>(hero.progress.loadout)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(skillId: string): void {
    setMessage(null)
    setError(null)
    setChosen(chosen.includes(skillId) ? chosen.filter((id) => id !== skillId) : [...chosen, skillId])
  }

  function save(): void {
    const result = saveLoadoutFromUi(chosen)
    setError(result.error)
    setMessage(result.message)
  }

  const skillRow = (skillId: string) => {
    const equipped = hero.progress.loadout.includes(skillId)
    const picked = chosen.includes(skillId)
    const facts = skillFacts(skillId, hero.progress.allocatedNodeIds)
    return (
      <li key={skillId}>
        <label>
          <input type="checkbox" checked={picked} onChange={() => toggle(skillId)} /> {skillName(skillId)}{' '}
          {equipped ? <Tag kind="good">In loadout</Tag> : <Tag kind="plain">Not equipped</Tag>}
          {picked !== equipped ? <Tag kind="info">{picked ? 'Will equip on save' : 'Will remove on save'}</Tag> : null}
        </label>
        {facts !== null ? (
          <p className="skill-facts">
            {facts.stats.join(' · ')}
            <br />
            {facts.effects.join('. ')}
          </p>
        ) : null}
      </li>
    )
  }
  const tooMany = chosen.length > 4
  const equippedIds = hero.progress.learnedSkillIds.filter((id) => hero.progress.loadout.includes(id))
  const spareIds = hero.progress.learnedSkillIds.filter((id) => !hero.progress.loadout.includes(id))
  const unequipped = spareIds.length
  return (
    <section aria-label="Loadout">
      <h2>Loadout — {hero.name}</h2>
      <p>
        Selected: <strong data-testid="loadout-count">{chosen.length}</strong> of 4.
        <Help label="About the loadout">Choose 1 to 4 skills.</Help>
      </p>
      {unequipped > 0 ? (
        <p role="status" data-testid="loadout-unequipped">
          <strong>{unequipped} learned, not equipped.</strong> Learned skills are only used in fights once they are in your loadout.
        </p>
      ) : null}
      {[
        { key: 'in', title: 'In loadout', ids: equippedIds, open: true },
        { key: 'spare', title: 'Learned, not equipped', ids: spareIds, open: equippedIds.length === 0 || spareIds.length > 0 },
      ]
        .filter((group) => group.ids.length > 0)
        .map((group) => (
          <Collapsible
            key={group.key}
            testId={`loadout-${group.key}`}
            defaultOpen={group.open}
            summary={
              <>
                <strong>{group.title}</strong>
                <span className="fold-count">{group.ids.length}</span>
              </>
            }
          >
            <ul>{group.ids.map(skillRow)}</ul>
          </Collapsible>
        ))}
      {tooMany ? <p role="alert">Pick at most 4 skills.</p> : null}
      <button type="button" disabled={chosen.length < 1 || tooMany} onClick={save}>
        Save loadout
      </button>
      {message !== null ? <p>{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}

export function Loadout() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  if (hero === null) {
    return (
      <section aria-label="Loadout">
        <h2>Loadout</h2>
        <p>Select a hero to choose their skills.</p>
      </section>
    )
  }
  return <LoadoutForm key={`${hero.id}:${hero.progress.loadout.join(',')}:${hero.progress.learnedSkillIds.length}`} hero={hero} />
}
