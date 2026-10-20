// Scene 05: Snow peaks. The fox stands on a snowy granite outcrop high above a
// moonlit valley and looks up at the guiding star over the great peak. Paper snow
// drifts down at several depths while the camera cranes slowly up toward the star.

import { Scene } from '../core/stage.js';
import { createFox } from '../elements/fox.js';
import { addSkyLayers, STAR } from './s05-sky.js';
import { addMountains } from './s05-mountains.js';
import { addLakeValley, addValleyForests, addRightOutcrop, addSnowSlopes } from './s05-valley.js';
import { addLeftSlope, addLeftCliff, addFoxRock, addTrail, addNearRocks, addLeftBank, addFlowers, addSnowfall } from './s05-near.js';

const DURATION = 8.5;
const REST = 4.25;

// The fox's ground point and size (film px at rest).
const FOX = { x: 640, y: 515, scale: 0.8, yaw: 0.35 };

// Crane up from below the rest framing to above it, with a slight push in.
// The sine passes exactly through rest at t = 4.25 and eases out at both ends.
function camera(t) {
  const u = Math.sin(((t - REST) / REST) * (Math.PI / 2));
  return { x: 0, y: -30 * u, z: 36 * u, zoom: 1, roll: 0 };
}

function addFox(S) {
  createFox(S, { pose: 'stand', x: FOX.x, y: FOX.y, z: 950, scale: FOX.scale, yaw: FOX.yaw, look: 1, wind: 0.3 });
}

// Build stages, back to front (named so they can be timed one by one).
export const STAGES = [
  ['sky', (S) => addSkyLayers(S, { rest: REST })],
  ['mountains', addMountains],
  ['lake-valley', addLakeValley],
  ['forests', addValleyForests],
  ['outcrop', addRightOutcrop],
  ['slopes', addSnowSlopes],
  ['left-slope', addLeftSlope],
  ['left-cliff', addLeftCliff],
  ['fox-rock', addFoxRock],
  ['trail', addTrail],
  ['fox', addFox],
  ['near-rocks', addNearRocks],
  ['left-bank', addLeftBank],
  ['flowers', addFlowers],
  ['snowfall', addSnowfall],
];

export default function () {
  return new Scene({
    id: 's05',
    duration: DURATION,
    background: '#0a1a3a',
    light: [0.45, -0.89],
    shadow: { alpha: 0.5, dist: 10, blur: 10 },
    post: { bloom: 0.3, threshold: 0.68, vignette: 0.22, grain: 0.045 },
    camera,
    meta: { fox: { x: FOX.x, y: FOX.y }, light: { x: STAR.x, y: STAR.y }, horizon: 640 },
    build(S) {
      for (const [, stage] of STAGES) stage(S);
    },
  });
}
