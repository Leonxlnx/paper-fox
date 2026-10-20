// s04 Waterfall canyon: by moonlight the fox picks its way along a stone ledge high in
// a canyon. Waterfalls pour off the mossy cliffs on both sides, the river comes out of
// a far valley under snowy purple peaks, churns through rapids around dark boulders and
// sweeps toward the viewer; the guiding star hangs over the valley with its thin beam.
// The camera drifts right and rises a little, passing its rest pose at the midpoint.

import { Scene } from '../core/stage.js';
import { createFox } from '../elements/fox.js';
import { LIGHT } from './s04-kit.js';
import { addSkyAndDistance, MOON } from './s04-sky.js';
import { addCanyon, addCanyonNear, addRightBank } from './s04-canyon.js';
import {
  addLeftSlope, addLedge, addFallSpruces, addRiverSystem, addNearRocks, addHeroSpruces, addFlowers, ledgeY,
} from './s04-near.js';

const DURATION = 8.5;
const REST_T = DURATION / 2;

// The fox steps slowly right along the ledge; at rest it stands where ref04 has it.
const FOX = { x: 640, scale: 0.77, speed: 20 };
const foxX = (t) => FOX.x + (t - REST_T) * FOX.speed;

// Eased pan right with a slight rise: sin() through zero at rest, zero velocity at the ends.
const camK = (t) => Math.sin(((t - REST_T) / REST_T) * (Math.PI / 2));

// Run a builder and tag every layer it added (layers that already carry tags keep them
// and get the extra ones too, unless `onlyBare`).
function group(S, fn, tags, { onlyBare = false, pick = null } = {}) {
  const n = S.layers.length;
  const out = fn(S);
  for (const L of S.layers.slice(n)) {
    if (onlyBare && L.tags.length) continue;
    const extra = pick ? pick(L) : tags;
    for (const tag of extra) if (!L.tags.includes(tag)) L.tags.push(tag);
  }
  return out;
}

const isWater = (L) => /fall|foam|mist|spray|river|rapid|water/i.test(L.name ?? '');

export default function () {
  return new Scene({
    id: 's04',
    duration: DURATION,
    background: '#1a1d3c',
    light: LIGHT,
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.35, threshold: 0.64, vignette: 0.24, grain: 0.05 },
    camera: (t) => {
      const k = camK(t);
      return { x: 35 * k, y: -10 * k, z: 0, zoom: 1, roll: 0 };
    },
    meta: { fox: { x: FOX.x, y: ledgeY(FOX.x) }, light: { x: MOON.x, y: MOON.y }, horizon: 470 },
    build(S) {
      group(S, addSkyAndDistance, [], { onlyBare: true, pick: (L) => (L.z >= 9000 ? ['sky', 'clouds'] : ['mountains']) });
      group(S, addCanyon, [], { pick: (L) => (isWater(L) ? ['canyon', 'water', 'waterfall'] : ['canyon']) });
      group(S, addRightBank, ['canyon', 'trees']);
      group(S, addCanyonNear, [], { pick: (L) => (isWater(L) ? ['canyon', 'water', 'waterfall'] : ['canyon']) });
      group(S, addFallSpruces, ['trees']);
      group(S, addRiverSystem, [], { pick: (L) => (/rocks/.test(L.name ?? '') ? ['rocks'] : ['water']) });
      group(S, addLeftSlope, ['ground']);
      group(S, addLedge, ['ledge', 'ground']);

      const fox = createFox(S, {
        pose: 'walk', yaw: 0.3, z: 950, x: FOX.x, y: ledgeY(FOX.x), scale: FOX.scale, look: 0.6,
        motion: (t) => ({ x: foxX(t), y: ledgeY(foxX(t)) }),
      });
      if (!fox.layer.tags.includes('fox')) fox.layer.tags.push('fox');

      group(S, addNearRocks, [], { pick: (L) => (isWater(L) ? ['water'] : ['rocks']) });
      group(S, addHeroSpruces, ['trees', 'fg']);
      group(S, addFlowers, ['fg', 'flowers']);
    },
  });
}
