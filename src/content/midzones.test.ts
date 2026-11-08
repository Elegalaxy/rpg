import { describe, expect, it } from 'vitest'

import { boardPool } from './contracts.ts'
import { encounters, toExpeditionEncounter } from './encounters.ts'
import { enemies } from './enemies.ts'

const DROPS: Record<string, { materialId: string; baseQuantity: number } | undefined> = {
  thornbeast: { materialId: 'hide', baseQuantity: 4 },
  'blight-spider': { materialId: 'witherbark', baseQuantity: 2 },
  'rootmaw-stalker': { materialId: 'witherbark', baseQuantity: 8 },
  'hollow-sentry': { materialId: 'shard', baseQuantity: 4 },
  'fallen-arbalist': { materialId: 'oathsteel', baseQuantity: 2 },
  'echo-knight': { materialId: 'oathsteel', baseQuantity: 8 },
  'fracture-wisp': undefined,
  'oathbound-echo': undefined,
  'fractured-warden': undefined,
}

describe('Grove and Bastion drops', () => {
  it('matches the drop table in GAME_DESIGN', () => {
    for (const [id, drop] of Object.entries(DROPS)) {
      const def = enemies[id]
      expect(def, id).toBeDefined()
      if (drop === undefined) expect(def?.drop, id).toBeUndefined()
      else expect(def?.drop, id).toEqual(drop)
    }
  })

  it('copies the drops onto expedition fights and drops them again when drops are off', () => {
    const mixed = encounters['grove-mixed']
    const bastion = encounters['bastion-mixed']
    expect(mixed).toBeDefined()
    expect(bastion).toBeDefined()
    for (const encounter of [mixed!, bastion!]) {
      const on = toExpeditionEncounter(encounter).enemies
      const off = toExpeditionEncounter(encounter, { drops: false }).enemies
      for (const [index, enemy] of on.entries()) {
        const drop = enemies[enemy.defId]?.drop
        expect(enemy.materialId).toBe(drop?.materialId)
        expect(enemy.baseQuantity).toBe(drop?.baseQuantity)
        expect(off[index]?.materialId).toBeUndefined()
        expect(off[index]?.baseQuantity).toBeUndefined()
        expect(off[index]?.gold).toBe(enemy.gold)
      }
    }
    const elite = toExpeditionEncounter(encounters['rootmaw-stalker']!)
    expect(elite.enemies[0]).toMatchObject({ materialId: 'witherbark', baseQuantity: 8 })
    expect(toExpeditionEncounter(encounters['echo-knight']!).enemies[0]).toMatchObject({ materialId: 'oathsteel', baseQuantity: 8 })
  })

  it('pays the Spider bounty and the Arbalist bounty in the zone material', () => {
    const pool = boardPool(['node:withered-grove', 'node:fallen-bastion'])
    expect(pool.bounty.find((entry) => entry.key === 'kill:blight-spider')?.materialId).toBe('witherbark')
    expect(pool.bounty.find((entry) => entry.key === 'kill:fallen-arbalist')?.materialId).toBe('oathsteel')
    expect(pool.bounty.find((entry) => entry.key === 'kill:thornbeast')?.materialId).toBe('hide')
  })
})
