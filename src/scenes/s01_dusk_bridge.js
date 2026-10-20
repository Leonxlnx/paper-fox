// s01 Dusk bridge: the opening shot. At sunset the fox walks across a wooden footbridge
// over a rushing stream, a meadow of wildflowers around it, snowy ranges and a lake
// glowing beyond. Partway through, the guiding star blinks on above the mountains and
// lays down its trail; the camera drifts right with the fox.

import { Scene, W, H } from '../core/stage.js';
import { E } from '../core/ease.js';
import { createFox } from '../elements/fox.js';
import { addBoulders } from '../elements/terrain.js';
import { addFlowerBed } from '../elements/flora.js';
import { buildSky, SUN, STAR } from './s01-sky.js';
import { buildLand } from './s01-land.js';
import { buildStream, WARM_STONE } from './s01-stream.js';
import { addBridge, deckY } from './s01-bridge.js';
import { addTexturedHills, MEADOW_PAL } from './s01-meadow.js';

// Wildflower drifts for the right bank: ref01 has red and white clusters among the yellow.
const BANK_FLOWERS = [
  ['#f2cc3a', '#c9921e', 4], ['#f6f1e2', '#bfb39c', 3.5], ['#d9474a', '#8e2a30', 3],
  ['#ee6a5a', '#a43a34', 1.2], ['#e27aa0', '#a04468', 0.6],
];

const MEADOW_BACK = { x0: -700, x1: 1500, y: 380, baseY: 760, peakX: 60, round: 1.1, bottom: 520, seed: 61 };
const MEADOW_RIGHT = { x0: 1000, x1: W + 700, y: 600, baseY: 820, peakX: 2000, round: 1.2, bottom: 480, seed: 62 };

const DURATION = 8.5;
const REST_T = DURATION / 2;
const PAN = 40;                       // camera x at the ends of the shot

// The fox crosses the bridge slowly; at rest it stands where the reference has it.
const FOX = { x: 652, scale: 0.74, speed: 40 };
const foxX = (t) => FOX.x + (t - REST_T) * FOX.speed;

const tagAll = (layers, ...tags) => {
  for (const L of [layers].flat()) L.tags.push(...tags);
  return layers;
};

export default function () {
  return new Scene({
    id: 's01',
    duration: DURATION,
    background: '#6a8434',
    light: [0.8, -0.6],
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.18, threshold: 0.78, vignette: 0.18, grain: 0.04 },
    camera: (t) => ({ x: PAN * (2 * E.sine(t / DURATION) - 1) }),
    meta: { fox: { x: FOX.x, y: deckY(FOX.x) }, light: { x: SUN.x, y: SUN.y }, horizon: 530 },
    build(S) {
      buildSky(S, { restT: REST_T });
      buildLand(S, { sun: SUN });

      // Meadow slope behind the bridge and the meadow running right to the far trees.
      addTexturedHills(S, {
        name: 'meadow-back', z: 1150, palette: MEADOW_PAL, light: S.light, strips: 5, crest: 8,
        hills: [MEADOW_BACK],
        tex: { scale: 1.2, sizeTop: 0.5, density: 1.25, flowers: 1.5, specks: 1.6, mottle: 0.16, shrubs: 1.3 },
      });
      addTexturedHills(S, {
        name: 'meadow-right', z: 1100, palette: MEADOW_PAL, light: S.light, strips: 5, crest: 8,
        hills: [MEADOW_RIGHT],
        // The right bank above the open water carries the flower drifts now (ref01).
        tex: { scale: 1.1, sizeTop: 0.8, sizeBottom: 1.6, density: 1.2, flowers: 4.2, specks: 1.6, mottle: 0.15, shrubs: 1.4, flowerMix: BANK_FLOWERS },
      });

      buildStream(S);
      addBridge(S, { z: 980 });

      const fox = createFox(S, {
        pose: 'walk', z: 950, x: FOX.x, y: deckY(FOX.x), scale: FOX.scale,
        motion: (t) => ({ x: foxX(t), y: deckY(foxX(t)) }),
      });
      fox.layer.tags.push('fox');

      tagAll(addBoulders(S, {
        name: 'rocks-near', z: 540, palette: WARM_STONE, light: S.light, moss: 0.5,
        rocks: [{ x: 1812, y: 1102, w: 340, h: 176, shape: 'round', seed: 71 }, { x: 1560, y: 1112, w: 170, h: 80, shape: 'round', seed: 72 }],
      }), 'rocks');

      tagAll(addFlowerBed(S, { preset: 'dusk-bridge', z: 480, planes: 2, res: 1 }), 'fg');
      // Only a few flowers hug the far right edge; the rest of the bottom right is open
      // water, boulders and foam (ref01).
      tagAll(addFlowerBed(S, {
        region: [1730, 620, 1920, 930], anchor: 'right', palette: 'dusk', seed: 's01-right', z: 560, res: 1,
        density: 0.9, mix: { echinacea: 0, daisy: 5, tansy: 3, astilbe: 5, lupine: 0, leaf: 0, blade: 1.2 },
      }), 'fg');
    },
  });
}
