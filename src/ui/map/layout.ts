/** Where each node sits in the map's coordinate space. The painted land is /map/frontier.png. */
export const MAP_WIDTH = 540
export const MAP_HEIGHT = 330

export const NODE_POSITIONS: { readonly [id: string]: { x: number; y: number } } = {
  greyhaven: { x: 85, y: 80 },
  'withered-grove': { x: 150, y: 100 },
  'fallen-bastion': { x: 300, y: 72 },
  'fracture-gate': { x: 470, y: 120 },
  'splintered-road': { x: 200, y: 190 },
  'drowned-causeway': { x: 120, y: 290 },
  'rift-hollows': { x: 360, y: 290 },
  'cinder-scar': { x: 500, y: 270 },
  'bloodthorn-barrens': { x: 430, y: 205 },
}
