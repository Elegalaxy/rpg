import { describe, expect, it } from 'vitest'

import { classWebs } from '../content/webs/index.ts'
import { HERO_CLASSES } from '../sim/constants.ts'

import { BUILD_ORDER, BUILT_ENEMIES, builtNodeIds, builtSetup, formatBuiltTable, runBuiltMatrix } from './builds.ts'

describe('reference builds', () => {
  it('give every class nine real nodes in a legal order, with no keystone', () => {
    for (const classId of HERO_CLASSES) {
      expect(BUILD_ORDER[classId]).toHaveLength(9)
      const ids = builtNodeIds(classId, 9)
      const web = classWebs[classId]
      ids.forEach((id, position) => {
        const node = web.nodes.find((entry) => entry.id === id)
        expect(node, `${classId} ${id}`).toBeDefined()
        expect(node?.keystone, `${classId} ${id}`).toBe(false)
        if (node?.requires !== null && node?.requires !== undefined) expect(ids.indexOf(node.requires), `${classId} ${id}`).toBeLessThan(position)
      })
    }
  })

  it('a prefix is a smaller build, and zero points is the floor build', () => {
    expect(builtNodeIds('warrior', 6)).toEqual(builtNodeIds('warrior', 9).slice(0, 6))
    expect(builtSetup('ref-warrior-deserter', 'warrior', 0).hero.allocatedNodeIds).toEqual([])
    expect(builtSetup('ref-warrior-deserter', 'warrior', 6).hero.allocatedNodeIds).toHaveLength(6)
  })

  it('runs the matrix for every class, build, and enemy', () => {
    const rows = runBuiltMatrix(1, 1)
    expect(rows).toHaveLength(HERO_CLASSES.length * 3 * BUILT_ENEMIES.length)
    const table = formatBuiltTable(rows)
    expect(table.split('\n').filter((line) => line.length > 0)).toHaveLength(HERO_CLASSES.length * 3)
    expect(table).toContain('warrior 6 nodes')
  }, 120_000)
})
