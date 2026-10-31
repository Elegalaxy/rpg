import { useState } from 'react'

import { itemName } from '../../content/items.ts'
import { previewEquip, statLines, statsFor } from '../../persist/equipment.ts'
import { selectedHero } from '../../persist/character.ts'
import { EQUIPMENT_SLOT_IDS, gearGaps, slotsFor, type EquipmentSlotId, type ItemInstance } from '../../sim/economy.ts'
import { itemBase } from '../../content/items.ts'
import { devAddItems, equipFromUi, useSaveStatus } from '../store.ts'

const SLOT_LABELS: { [slot in EquipmentSlotId]: string } = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  feet: 'Feet',
  accessory0: 'Accessory 1',
  accessory1: 'Accessory 2',
}

function describeItem(item: ItemInstance): string {
  return `${itemName(item)}, item level ${item.itemLevel}, quality ${Math.round(item.quality * 100)}%, durability ${item.durability}/${item.maxDurability}`
}

function format(value: number, unit: string): string {
  return `${Math.round(value * 100) / 100}${unit}`
}

export function Equipment() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [error, setError] = useState<string | null>(null)
  if (hero === null) {
    return (
      <section aria-label="Equipment">
        <h2>Equipment</h2>
        <p>Select a hero to see their equipment.</p>
      </section>
    )
  }
  const stats = statsFor(hero)
  const gaps = gearGaps(hero.equipment, itemBase)
  const locked = save.expedition !== null
  const mainBase = hero.equipment.mainHand === null ? undefined : itemBase(hero.equipment.mainHand.baseId)
  const twoHanded = mainBase?.type === 'weapon' && mainBase.weaponKind === 'twoHanded'
  return (
    <section aria-label="Equipment">
      <h2>Equipment — {hero.name}</h2>
      {import.meta.env.DEV ? (
        <p>
          <button type="button" onClick={devAddItems}>
            Dev: add test weapons to the archive
          </button>
        </p>
      ) : null}
      <ul>
        {EQUIPMENT_SLOT_IDS.map((slot) => {
          const item = hero.equipment[slot]
          const disabled = slot === 'offHand' && twoHanded
          return (
            <li key={slot} data-testid={`slot-${slot}`}>
              <strong>{SLOT_LABELS[slot]}:</strong>{' '}
              {item === null ? (disabled ? 'disabled by the two-handed weapon' : 'empty') : describeItem(item)}
            </li>
          )
        })}
      </ul>
      {gaps.length > 0 ? <p role="alert">Cannot fight yet. Missing: {gaps.join(', ')}.</p> : null}
      {stats !== null ? (
        <table aria-label="Derived stats">
          <tbody>
            {statLines(stats).map((line) => (
              <tr key={line.label}>
                <th scope="row">{line.label}</th>
                <td data-testid={`stat-${line.label}`}>{format(line.value, line.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <h3>Archive</h3>
      {locked ? <p>Equipment is locked while an expedition is running.</p> : null}
      {save.account.archive.length === 0 ? <p>The archive is empty.</p> : null}
      <ul>
        {save.account.archive.map((item) => {
          const base = itemBase(item.baseId)
          const choices = base === undefined ? [] : slotsFor(base)
          return (
            <li key={item.id}>
              {describeItem(item)}
              {choices.map((slot) => {
                const preview = previewEquip(save, hero.id, item.id, slot)
                return (
                  <div key={slot}>
                    <button
                      type="button"
                      disabled={locked || preview.block !== null}
                      aria-label={`Equip ${itemName(item)} in ${SLOT_LABELS[slot]}`}
                      onClick={() => setError(equipFromUi(item.id, slot))}
                    >
                      Equip in {SLOT_LABELS[slot]}
                    </button>{' '}
                    {preview.block !== null ? (
                      <small data-testid="equip-block">{preview.block}</small>
                    ) : preview.changes.length === 0 ? (
                      <small>No stat changes.</small>
                    ) : (
                      <small data-testid="equip-changes">
                        {preview.changes.map((change) => `${change.label} ${format(change.before, change.unit)} → ${format(change.after, change.unit)}`).join('; ')}
                      </small>
                    )}
                  </div>
                )
              })}
            </li>
          )
        })}
      </ul>
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
