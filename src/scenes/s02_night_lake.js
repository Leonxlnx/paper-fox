// Scene 2, night lake. The fox stands on a flat grey rock above a moonlit valley and
// looks up at the full moon. The camera makes one slow push toward it.

import { Scene } from '../core/stage.js';
import { E } from '../core/ease.js';
import { createFox } from '../elements/fox.js';
import { buildSky, MOON } from './s02-sky.js';
import { buildLand, LAKE } from './s02-land.js';
import { buildNear } from './s02-near.js';

const DURATION = 8.5;
const REST = 4.25;

// Fox ground point (between the paws) at rest, film px.
const FOX = { x: 620, y: 706 };

// Push-in: zoom 1/1.025 -> 1.025 with a slight dolly and drift for parallax, centred a
// little toward the fox. Every term is zero at t = REST.
const PUSH = { zoom: 1.025, dolly: 24, drift: 14, ox: -160, oy: 40 };

function camera(t) {
  const u = 2 * E.sine(t / DURATION) - 1; // -1 .. 1, 0 at REST
  return {
    x: -PUSH.drift * u,
    y: 0,
    z: PUSH.dolly * u,
    zoom: PUSH.zoom ** u,
    roll: 0,
    ox: PUSH.ox,
    oy: PUSH.oy,
  };
}

// Run fn and give every plane it adds the tags.
function tagger(S) {
  return (tags, fn) => {
    const first = S.layers.length;
    fn();
    for (const L of S.layers.slice(first)) L.tags = [...new Set([...L.tags, ...tags])];
  };
}

export default function () {
  return new Scene({
    id: 's02',
    duration: DURATION,
    background: '#0b1a36',
    light: [0.5, -0.866],
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.3, threshold: 0.64, vignette: 0.22, grain: 0.04 },
    camera,
    meta: { fox: FOX, light: { x: MOON.x, y: MOON.y }, horizon: LAKE.top },
    build(S) {
      const tag = tagger(S);
      buildSky(S, tag);
      buildLand(S);
      tag(['fox'], () => createFox(S, { pose: 'stand', x: FOX.x, y: FOX.y, z: 950, look: 0.2, scale: 0.95 }));
      buildNear(S, tag);
    },
  });
}
