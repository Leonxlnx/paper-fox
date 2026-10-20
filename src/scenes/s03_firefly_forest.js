// Scene 3: the firefly forest. Night under giant redwoods: the guiding star hangs in a
// gap of navy sky, a stream steps down over little cascades between mossy rocks, and
// the fox stands on a mossy boulder looking up at the star while fireflies drift
// through every depth of the wood. The camera pushes slowly deeper into the forest.

import { Scene } from '../core/stage.js';
import { addGuidingStar, addStarField, GUIDE_PRESETS } from '../elements/sky.js';
import { createFox } from '../elements/fox.js';
import { addFlowerBed, FLOWER_BEDS } from '../elements/flora.js';
import { addBackdrop } from './s03-backdrop.js';
import { addTrunks } from './s03-trunks.js';
import { addGround } from './s03-ground.js';
import { addFireflies, addGlow } from './s03-fireflies.js';

// Composition at rest, film px (reference px x 1.1483).
const STAR = { x: 1275, y: 318 };
const FOX = { x: 815, y: 655 };
const HORIZON = 560;

// The forest-right preset's backing sweeps over the pool at the bottom of the stream; open it
// up so the water and the rock beside it show as in the reference (x < 1500 pushed right).
// Right of that the backing is dropped below the mossy log's lower edge so the log shows across
// the right side as in the reference.
const LOG_BOTTOM = (x) => 771 - (x - 1650) * 0.384;
const opened = (pts) => pts.map(([x, y]) => (x < 1500 ? [1440 + (x - 1260) * 0.25, y + (1500 - x) * 0.4] : [x, x > 1540 ? Math.max(y, LOG_BOTTOM(x) - 14) : y]));
const RIGHT_ROWS = FLOWER_BEDS['forest-right'].rows.map((row) => row.map((it) => (it.edge && (it.type === 'backing' || it.type === 'undergrowth') ? { ...it, x0: Math.max(it.x0, 1410), edge: opened(it.edge) } : it)));

// Camera: a slow push deeper into the wood, dolly -45 .. +45, through rest at t = 4.25.
const DURATION = 8.5;
const REST_T = 4.25;
const DOLLY = 45;
const camera = (t) => ({ x: 0, y: 0, z: DOLLY * Math.sin(((t - REST_T) / REST_T) * (Math.PI / 2)), zoom: 1, roll: 0 });

export default function () {
  return new Scene({
    id: 's03',
    duration: DURATION,
    background: '#08121a',
    light: [0.3, -0.95],
    shadow: { alpha: 0.55, dist: 10, blur: 12 },
    post: { bloom: 0.55, threshold: 0.56, bloomRadius: 1.2, vignette: 0.32, grain: 0.05 },
    meta: { fox: FOX, light: STAR, horizon: HORIZON },
    camera,
    build(S) {
      addBackdrop(S, { star: STAR });
      for (const L of addStarField(S, {
        seed: 's03-stars', region: [860, 0, 600, 420], dots: 46,
        stars: [{ x: 1168, y: 84, r: 15 }, { x: 1201, y: 30, r: 6 }, { x: 1040, y: 150, r: 5 }, { x: 1330, y: 120, r: 5 }],
      })) L.tags.push('celestial');

      // Far fireflies deep in the wood and in the gap.
      addFireflies(S, {
        z: 1900, name: 'fireflies-far', halo: 6.5, glow: 1.2,
        flies: [
          [1000, 300, 3.5], [1060, 410, 4], [1180, 382, 3.5], [1330, 452, 4], [1440, 300, 3.5], [940, 205, 3], [1210, 520, 3.5],
          [860, 425, 3.5], [300, 330, 4], [150, 430, 3.5], [420, 236, 3.5], [1660, 430, 4], [1760, 262, 3.5], [1840, 560, 3.5],
          [760, 470, 3.5], [1110, 556, 3.5], [1385, 560, 4], [655, 362, 3.5], [1300, 200, 3], [1530, 520, 3.5],
          [1250, 410, 3], [1100, 250, 2.5], [1400, 380, 3], [980, 520, 3], [1600, 350, 3], [560, 300, 3], [60, 340, 3.5], [1880, 420, 3],
        ].map(([x, y, r]) => ({ x, y, r })),
      });

      // The guiding star sits just in front of the gap spruces so no tree can hide it, with a
      // soft warm halo spreading over the night blue round it.
      addGlow(S, { z: 2010, x: STAR.x, y: STAR.y, r: 260, alpha: 0.55, name: 'star-halo', tags: ['celestial'] });
      addGlow(S, { z: 2005, x: STAR.x, y: STAR.y, r: 95, alpha: 0.55, period: 3.7, name: 'star-glow', tags: ['celestial'] });
      for (const L of addGuidingStar(S, { x: STAR.x, y: STAR.y, size: 54, z: 2000, ...GUIDE_PRESETS.forest, halo: 1.8 }).layers) L.tags.push('celestial');

      addGround(S);
      // Warm light of the fireflies pooled over the forest floor round the stream (ref03 glows
      // amber through the middle of the wood).
      addGlow(S, { z: 995, x: 820, y: 560, r: 660, alpha: 0.12, period: 7, name: 'floor-glow' });

      // Fireflies over the forest floor at mid depth, between the trunks and over the stream.
      addFireflies(S, {
        z: 1450, name: 'fireflies-deep', halo: 6.5, glow: 1.25,
        flies: [
          [620, 520, 6], [960, 560, 5], [1050, 612, 7], [880, 470, 5], [1185, 626, 5], [1370, 520, 6], [1475, 566, 5], [1700, 560, 6],
          [1610, 470, 5], [250, 480, 6], [120, 566, 5], [480, 520, 5], [1450, 650, 5], [1020, 515, 4.5], [760, 566, 5], [1880, 610, 5],
          [330, 650, 5], [40, 420, 5], [1240, 690, 4.5], [1360, 690, 5], [1150, 330, 4], [1500, 420, 4.5], [700, 430, 4.5], [1790, 500, 5],
        ].map(([x, y, r]) => ({ x, y, r })),
      });
      addTrunks(S);

      createFox(S, { pose: 'stand', x: FOX.x, y: FOX.y, z: 950, scale: 0.98, look: 1 });

      for (const L of addFlowerBed(S, { preset: 'forest-left', z: 520 })) L.tags.push('fg');
      for (const L of addFlowerBed(S, { preset: 'forest-right', rows: RIGHT_ROWS, z: 540 })) L.tags.push('fg');

      addFireflies(S, {
        z: 1100, name: 'fireflies-mid', glow: 1.45, halo: 8,
        flies: [
          { x: 715, y: 266, r: 10, stalk: { len: 70, ang: 0.35 } },
          { x: 386, y: 287, r: 7, stalk: { len: 60, ang: 0.3 } },
          { x: 497, y: 430, r: 10, stalk: { len: 60, ang: 0.4 } },
          { x: 725, y: 395, r: 9 },
          { x: 1671, y: 329, r: 9, stalk: { len: 60, ang: -0.35 } },
          { x: 1892, y: 359, r: 12, stalk: { len: 70, ang: -0.4 } },
          { x: 1872, y: 476, r: 9, stalk: { len: 50, ang: -0.1 } },
          { x: 105, y: 222, r: 7 },
          { x: 365, y: 134, r: 5 },
          { x: 1396, y: 397, r: 6 },
          { x: 1145, y: 458, r: 7 },
          { x: 1253, y: 449, r: 5 },
          { x: 570, y: 500, r: 6, stalk: { len: 40, ang: 0.1 } },
          { x: 298, y: 584, r: 11, stalk: { len: 60, ang: 0.3 } },
          { x: 1436, y: 677, r: 7, stalk: { len: 40, ang: 0 } },
          { x: 1494, y: 826, r: 13, stalk: { len: 50, ang: 0 } },
          { x: 1339, y: 963, r: 9 },
          { x: 1112, y: 411, r: 6 },
          { x: 985, y: 470, r: 5 },
          { x: 1020, y: 380, r: 6 },
          { x: 1210, y: 520, r: 7 },
          { x: 610, y: 210, r: 6 },
          { x: 160, y: 470, r: 8, stalk: { len: 55, ang: -0.2 } },
          { x: 1560, y: 600, r: 8, stalk: { len: 50, ang: 0.25 } },
          { x: 1760, y: 720, r: 9, stalk: { len: 60, ang: -0.3 } },
          { x: 470, y: 760, r: 9, stalk: { len: 55, ang: 0.2 } },
          { x: 1290, y: 820, r: 6 },
          { x: 1180, y: 920, r: 7 },
          { x: 960, y: 700, r: 6 },
          { x: 1600, y: 220, r: 6 },
          { x: 250, y: 380, r: 6 },
        ],
      });
      // Close to the lens: big soft lights, a few of them wandering across the frame.
      addFireflies(S, {
        z: 440, name: 'fireflies-near', bokeh: true, halo: 6,
        flies: [
          { x: 65, y: 969, r: 18 }, { x: 842, y: 1019, r: 12 }, { x: 1720, y: 170, r: 15, drift: 150 }, { x: 430, y: 110, r: 13, drift: 130 },
          { x: 1870, y: 880, r: 14 }, { x: 640, y: 880, r: 9, drift: 90 }, { x: 1100, y: 160, r: 9, drift: 120 },
        ],
      });
    },
  });
}
