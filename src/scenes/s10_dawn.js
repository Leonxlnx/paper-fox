// s10 — Dawn, the final shot. The fox sits on its rock above the valley as the sun
// rises behind the peaks; the guiding star falls one last time and lands beside it as a
// glowing star flower. Below, a waterfall drops into the river that winds out of the lake.
//
// Layout constants live in s10-layout.js; each part of the diorama has its own module.

import { Scene } from '../core/stage.js';
import { clamp } from '../core/ease.js';
import { buildSky } from './s10-sky.js';
import { buildLand } from './s10-land.js';
import { buildWater } from './s10-water.js';
import { buildHero } from './s10-hero.js';
import { buildFlowers } from './s10-flowers.js';
import { LIGHT, SUN, FOX } from './s10-layout.js';

const DURATION = 8.5;
const REST_T = 4.25;
const DOLLY = 60;   // px: the camera pulls back from +DOLLY to -DOLLY

// A slow pull-back that starts from stillness, passes rest at REST_T and settles.
function camera(t) {
  const u = clamp((t - REST_T) / REST_T, -1, 1);
  return { x: 0, y: 0, z: -DOLLY * Math.sin(u * Math.PI / 2), zoom: 1, roll: 0 };
}

export default function () {
  return new Scene({
    id: 's10',
    duration: DURATION,
    background: '#2c3a22',
    light: LIGHT,
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.26, threshold: 0.74, vignette: 0.22, grain: 0.04, grade: { color: '#c07a30', amount: 0.12, mode: 'soft-light' } },
    camera,
    meta: { fox: { x: FOX.x, y: FOX.y }, light: { x: SUN.x, y: SUN.y }, horizon: 450 },
    build(S) {
      buildSky(S);
      buildLand(S);
      buildWater(S);
      buildHero(S);
      buildFlowers(S);
    },
  });
}
