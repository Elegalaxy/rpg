import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../../sim/constants.ts'

import { classWebs } from './index.ts'
import { classWebIntro, clusterIntro, racialIntro } from './intro.ts'
import { nodeText } from './nodeText.ts'
import { racialWebs } from './racial.ts'

describe('skill web text', () => {
  it('describes every class and racial node, and nothing else', () => {
    const ids = [...Object.values(classWebs).flatMap((web) => web.nodes), ...Object.values(racialWebs).flatMap((web) => web.nodes)].map((node) => node.id)
    expect(ids).toHaveLength(91)
    for (const id of ids) expect(nodeText[id], id).toBeTruthy()
    expect(Object.keys(nodeText).sort()).toEqual([...ids].sort())
  })

  it('introduces every class web, cluster, and race', () => {
    for (const classId of HERO_CLASSES) {
      expect(classWebIntro[classId].length).toBeGreaterThan(20)
      const clusters = [...new Set(classWebs[classId].nodes.map((node) => node.cluster))]
      expect(Object.keys(clusterIntro[classId]).sort()).toEqual([...clusters].sort())
    }
    for (const race of Object.keys(racialWebs) as (keyof typeof racialWebs)[]) expect(racialIntro[race].length).toBeGreaterThan(20)
  })
})
