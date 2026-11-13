import { describe, expect, it } from 'vitest'

import { legs, nodes } from '../../content/world.ts'
import { MAP_HEIGHT, MAP_WIDTH, NODE_POSITIONS } from './layout.ts'

type Point = { x: number; y: number }

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

describe('map layout', () => {
  it('gives every node a position', () => {
    for (const id of Object.keys(nodes)) expect(NODE_POSITIONS[id], id).toBeDefined()
  })

  it('keeps every node and its label inside the viewBox', () => {
    for (const [id, p] of Object.entries(NODE_POSITIONS)) {
      expect(p.y + 32, `${id} label bottom`).toBeLessThanOrEqual(MAP_HEIGHT)
      expect(p.y, `${id} top`).toBeGreaterThanOrEqual(20)
      expect(p.x, `${id} left`).toBeGreaterThanOrEqual(30)
      expect(p.x, `${id} right`).toBeLessThanOrEqual(MAP_WIDTH - 30)
    }
  })

  it('keeps every leg at least 24px from nodes that are not its ends', () => {
    for (const leg of legs) {
      const a = NODE_POSITIONS[leg.from]
      const b = NODE_POSITIONS[leg.to]
      expect(a).toBeDefined()
      expect(b).toBeDefined()
      for (const [id, p] of Object.entries(NODE_POSITIONS)) {
        if (id === leg.from || id === leg.to) continue
        expect(distanceToSegment(p, a, b), `${leg.from}-${leg.to} near ${id}`).toBeGreaterThanOrEqual(24)
      }
    }
  })
})
