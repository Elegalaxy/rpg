import { useState } from 'react'
import { purseOf } from '../../persist/save.ts'

import { itemBase, itemName } from '../../content/items.ts'
import { selectedHero } from '../../persist/character.ts'
import { changeIsBetter, previewEquip, statLines, statsFor } from '../../persist/equipment.ts'
import { EQUIPMENT_SLOT_IDS, gearGaps, slotsFor, type EquipmentSlotId, type ItemInstance } from '../../sim/economy.ts'
import { Row } from '../Row.tsx'
import { devAddItems, equipFromUi, unequipFromUi, useSaveStatus } from '../store.ts'

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

/** The stat names in the order the stats panel shows them, so the panel keeps its size when gear is missing. */
const STAT_LABELS = [
  'Maximum HP',
  'Physical Power',
  'Magical Power',
  'Healing Power',
  'Armor',
  'Resistance',
  'Evasion',
  'Accuracy',
  'Critical chance',
  'Cooldown reduction',
  'Base action time',
]

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
  const [openSlot, setOpenSlot] = useState<EquipmentSlotId | null>(null)
  if (hero === null) {
    return (
      <section aria-label="Equipment">
        <h2>Equipment</h2>
        <p>Select a hero to see their equipment.</p>
      </section>
    )
  }
  const stats = statsFor(hero)
  const lines = stats === null ? null : statLines(stats)
  const gaps = gearGaps(hero.equipment, itemBase)
  const locked = save.expedition !== null
  const mainBase = hero.equipment.mainHand === null ? undefined : itemBase(hero.equipment.mainHand.baseId)
  const twoHanded = mainBase?.type === 'weapon' && mainBase.weaponKind === 'twoHanded'

  function candidatesFor(slot: EquipmentSlotId): ItemInstance[] {
    return purseOf(save).archive.filter((item) => {
      const base = itemBase(item.baseId)
      return base !== undefined && slotsFor(base).includes(slot)
    })
  }

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
      {locked ? <p>Equipment is locked while an expedition is running.</p> : null}
      <div className="split">
        <div>
          <ul className="rows" aria-label="Worn gear">
            {EQUIPMENT_SLOT_IDS.map((slot) => {
              const item = hero.equipment[slot]
              const disabled = slot === 'offHand' && twoHanded
              const open = openSlot === slot
              const choices = open ? candidatesFor(slot) : []
              return (
                <Row
                  key={slot}
                  testId={`slot-${slot}`}
                  actions={
                    <>
                      <button
                        type="button"
                        className={item === null ? 'btn-good' : undefined}
                        disabled={locked || disabled}
                        aria-expanded={open}
                        aria-label={`${item === null ? 'Choose' : 'Swap'} ${SLOT_LABELS[slot]}`}
                        onClick={() => setOpenSlot(open ? null : slot)}
                      >
                        {item === null ? 'Choose' : 'Swap'}
                      </button>
                      <button type="button" disabled={locked || item === null} aria-label={`Unequip ${SLOT_LABELS[slot]}`} onClick={() => setError(unequipFromUi(slot))}>
                        Unequip
                      </button>
                    </>
                  }
                >
                  <strong>{SLOT_LABELS[slot]}</strong>
                  <span className="row-note">
                    {item === null ? (disabled ? 'disabled by the two-handed weapon' : 'empty') : describeItem(item)}
                  </span>
                  {open ? (
                    <div className="chooser">
                      {choices.length === 0 ? (
                        <p>Nothing in the archive fits this slot.</p>
                      ) : (
                        <ul className="rows" aria-label={`Items for ${SLOT_LABELS[slot]}`}>
                          {choices.map((choice) => {
                            const preview = previewEquip(save, hero.id, choice.id, slot)
                            return (
                              <Row
                                key={choice.id}
                                actions={
                                  <button
                                    type="button"
                                    className="btn-good"
                                    disabled={locked || preview.block !== null}
                                    aria-label={`Equip ${itemName(choice)} in ${SLOT_LABELS[slot]}`}
                                    onClick={() => {
                                      const problem = equipFromUi(choice.id, slot)
                                      setError(problem)
                                      if (problem === null) setOpenSlot(null)
                                    }}
                                  >
                                    Equip
                                  </button>
                                }
                              >
                                {describeItem(choice)}
                                {preview.block !== null ? (
                                  <small className="row-note" data-testid="equip-block">
                                    {preview.block}
                                  </small>
                                ) : stats === null ? (
                                  <small className="row-note">Fills the empty slot.</small>
                                ) : preview.changes.length === 0 ? (
                                  <small className="row-note">No stat changes.</small>
                                ) : (
                                  <small className="row-note change-list" data-testid="equip-changes">
                                    {preview.changes.map((change) => (
                                      <span key={change.label} className={changeIsBetter(change.label, change.before, change.after) ? 'change-better' : 'change-worse'}>
                                        {change.label} {format(change.before, change.unit)} → {format(change.after, change.unit)}
                                      </span>
                                    ))}
                                  </small>
                                )}
                              </Row>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </Row>
              )
            })}
          </ul>
          {gaps.length > 0 ? <p role="alert">Cannot fight yet. Missing: {gaps.map((gap) => SLOT_LABELS[gap as EquipmentSlotId] ?? gap).join(', ')}.</p> : null}
          {error !== null ? <p role="alert">{error}</p> : null}
          <h3>In the archive</h3>
          {purseOf(save).archive.length === 0 ? <p>The archive is empty.</p> : <p>Pick a slot above to equip one of these.</p>}
          <ul className="rows" aria-label="Archive">
            {purseOf(save).archive.map((item) => (
              <Row key={item.id}>{describeItem(item)}</Row>
            ))}
          </ul>
        </div>
        <aside className="sticky-panel stats-panel" aria-label="Derived stats">
          <h3>Stats</h3>
          <table>
            <tbody>
              {STAT_LABELS.map((label) => {
                const line = lines?.find((entry) => entry.label === label)
                return (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td data-testid={`stat-${label}`}>{line === undefined ? '—' : format(line.value, line.unit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {stats === null ? <p className="row-note">Stats show once every slot is filled.</p> : null}
        </aside>
      </div>
    </section>
  )
}
