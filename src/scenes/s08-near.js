// The near world of s08 (ref08) besides the stone (s08-rocks.js): the conifers framing
// the shot and the wildflowers in the bottom-left corner.

import { addTree, addHeroConifer, FOLIAGE, BARK } from '../elements/trees.js';
import { addFlowerBed } from '../elements/flora.js';

export function addTrees(S, { light }) {
  // Spruces behind the left blocks.
  const mids = [[215, 470, 410], [290, 470, 360], [365, 480, 290], [420, 500, 225], [482, 500, 215], [545, 505, 140], [585, 510, 110]];
  mids.forEach(([x, y, h], i) => addTree(S, { z: 1300, name: `spruce-l${i}`, detail: 'mid', x, y, h, width: 0.22, palette: FOLIAGE.night, tones: [0.08, 0.5], seed: 100 + i, light, sway: { phase: i * 0.17 } }));
  // Spruces on the right cliff top.
  const rights = [[1650, 664, 170], [1715, 660, 210], [1762, 658, 250], [1812, 654, 310], [1878, 652, 250], [1934, 650, 410], [2010, 650, 330]];
  rights.forEach(([x, y, h], i) => addTree(S, { z: 1300, name: `spruce-r${i}`, detail: 'mid', x, y, h, width: 0.24, palette: FOLIAGE.night, tones: [0.08, 0.5], seed: 120 + i, light, sway: { phase: i * 0.21 } }));
  // Dark spruces between the arch leg and the right cliff, in front of the lake.
  const lows = [[1480, 870, 130], [1560, 860, 170], [1630, 872, 140]];
  lows.forEach(([x, y, h], i) => addTree(S, { z: 1600, name: `spruce-low${i}`, detail: 'mid', x, y, h, width: 0.24, palette: FOLIAGE.forest, tones: [0.06, 0.42], seed: 140 + i, light, sway: { phase: i * 0.3 } }));
  // The giant spruce framing the left edge.
  addHeroConifer(S, {
    z: 900, name: 'giant', x: 75, y: 560, h: 1150, width: 0.2, tiers: 11, trunkFrac: 0.2, trunkWidth: 0.07,
    palette: FOLIAGE.night, bark: BARK.night, seed: 134, bias: 0.6, front: 0.3, interior: false, fronds: 2, light,
  });
}

export function addFlowers(S) {
  return addFlowerBed(S, { preset: 'night-lake', z: 480, planes: 1 });
}
