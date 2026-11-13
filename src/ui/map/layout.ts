/** Where each node sits in the map's coordinate space. The background is a placeholder. */
export const MAP_WIDTH = 540
export const MAP_HEIGHT = 330

export const NODE_POSITIONS: { readonly [id: string]: { x: number; y: number } } = {
  greyhaven: { x: 50, y: 165 },
  'splintered-road': { x: 150, y: 165 },
  'withered-grove': { x: 270, y: 70 },
  'fallen-bastion': { x: 270, y: 148 },
  'fracture-gate': { x: 400, y: 115 },
  'drowned-causeway': { x: 250, y: 265 },
  'rift-hollows': { x: 380, y: 275 },
  'cinder-scar': { x: 490, y: 245 },
}
