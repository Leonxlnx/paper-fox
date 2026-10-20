// s08 Aurora arch (ref08): the fox walks onto a natural stone arch under green aurora
// curtains, the guiding star resting on the summit of a glowing snow peak, a sea of
// clouds filling the valleys and a lake catching the starlight.
//
// Motion: aurora ribbons ripple and sway with a shimmer travelling along them, the star
// pulses, the falls flow, the cloud sea rows drift, trees and flowers sway, and the fox
// walks slowly right from the ledge toward the arch (x 628 -> 882) while the camera
// pans right with it (x -35 -> +35, at rest at t = 4.25).

import { Scene } from '../core/stage.js';
import { addSky, addStarField, addGuidingStar, GUIDE_PRESETS } from '../elements/sky.js';
import { createFox } from '../elements/fox.js';
import { addAuroraRibbons, REF08_RIBBONS } from './s08-aurora.js';
import { addBackdrop } from './s08-backdrop.js';
import { addRocks } from './s08-rocks.js';
import { addTrees, addFlowers } from './s08-near.js';

const DURATION = 8.5;
const REST_T = 4.25;

// Light sources and anchors at camera rest (film px).
const STAR = { x: 1517, y: 112, size: 64 };
const FOX = { x: 755, y: 534, scale: 0.6, speed: 30 };
const HORIZON = 580;

// The walkway under the fox's paws: the ledge's deck, then the first stones of the arch.
const LEDGE = [[560, 538], [660, 536], [740, 535], [810, 533], [860, 530], [900, 534], [960, 540], [1000, 548]];
function ledgeY(x) {
  if (x <= LEDGE[0][0]) return LEDGE[0][1];
  for (let i = 1; i < LEDGE.length; i++) {
    const [x0, y0] = LEDGE[i - 1], [x1, y1] = LEDGE[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return LEDGE[LEDGE.length - 1][1];
}

// Gold paper stars traced from the reference (x, y, horizontal arm length).
const SKY_STARS = [
  { x: 372, y: 42, r: 13 }, { x: 501, y: 135, r: 21 }, { x: 632, y: 217, r: 8 }, { x: 716, y: 274, r: 7 },
  { x: 812, y: 33, r: 13 }, { x: 974, y: 62, r: 6 }, { x: 1151, y: 226, r: 14 }, { x: 1828, y: 28, r: 16 },
  { x: 1873, y: 262, r: 5 }, { x: 920, y: 315, r: 4 },
];

// Camera: a slow eased pan to the right following the fox, through rest at t = 4.25.
function camera(t) {
  const u = Math.max(-1, Math.min(1, (t - REST_T) / REST_T));
  const k = Math.sin((Math.PI / 2) * u);
  return { x: 35 * k, y: 0, z: 30 * k, zoom: 1, roll: 0 };
}

export default function () {
  return new Scene({
    id: 's08',
    duration: DURATION,
    background: '#081634',
    light: [0.62, -0.78],
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.36, threshold: 0.6, vignette: 0.22, grain: 0.05 },
    meta: { fox: { x: FOX.x, y: FOX.y }, light: { x: STAR.x, y: STAR.y }, horizon: HORIZON },
    camera,
    build(S) {
      const lap = () => {};
      addSky(S, {
        palette: 'aurora', seed: 's08-sky',
        stops: [[-240, '#010f30'], [0, '#02133a'], [200, '#031a46'], [420, '#08285a'], [700, '#123a6a'], [1320, '#1a4870']],
        glows: [{ x: STAR.x, y: STAR.y + 40, r: 260, color: '#4a4a6a', alpha: 0.5 }],
      }).tags = ['sky'];
      lap('sky');
      for (const L of addAuroraRibbons(S, { ribbons: REF08_RIBBONS, shimmer: 0.5 })) L.tags = ['aurora'];
      lap('aurora');
      for (const L of addStarField(S, { stars: SKY_STARS, dots: 70, region: [-100, -60, 2120, 460], seed: 's08-stars', glow: 0.35 })) L.tags = ['celestial'];
      for (const L of addGuidingStar(S, { x: STAR.x, y: STAR.y, size: STAR.size, ...GUIDE_PRESETS.aurora, arms: [1, 0.92, 0.98, 0.92] }).layers) L.tags = ['celestial'];
      lap('stars');
      addBackdrop(S, { star: STAR, light: S.light, lap });
      lap('backdrop');
      addRocks(S);
      lap('rocks');
      addTrees(S, { light: S.light });
      lap('trees');
      createFox(S, {
        pose: 'walk', z: 960, x: FOX.x, y: FOX.y, scale: FOX.scale,
        motion: (t) => {
          const x = FOX.x + (t - REST_T) * FOX.speed;
          return { x, y: ledgeY(x) };
        },
      });
      lap('fox');
      for (const L of addFlowers(S)) L.tags = ['fg'];
      lap('flowers');
    },
  });
}
