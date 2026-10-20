// s07 Storm coast: a heavy ceiling of slate paper clouds opens at the upper right, where
// the guiding star shines through a lit rim. Rain slants across the frame at several
// depths, a storm sea of layered teal and navy waves surges in and bursts white on the
// dark shore rocks, and the fox stands on its mossy rock below the conifers, fur and tail
// streaming in the wind, looking up at the star. Lightning flashes in the clouds at
// t = 1.25 (strong), 3.125 and 5.75. The camera drifts right with a faint sway and
// passes its rest pose at the midpoint.

import { Scene } from '../core/stage.js';
import { TAU } from '../core/geom.js';
import { createFox } from '../elements/fox.js';
import {
  LIGHT, STAR, HORIZON, FOX, SWELL,
  addSkyAndClouds, addDistance, addReflectionGlow, addLeftFoliage, addLeftWoods, addBank, addRocks, addSurf, addForeground,
} from './s07-land.js';
import { addSea } from './s07-sea.js';
import { addRain, addLightning } from './s07-weather.js';

const DURATION = 8.5;
const REST_T = DURATION / 2;

// Lightning: the first strike is strong and dies away over about half a second; the two
// later ones are brief flickers (bolt visible for about 0.15 s).
const STRIKES = [
  {
    at: 1.25, power: 1, decay: 0.15, hold: 0.05, restrike: 0.12, boltDecay: 0.1,
    bolt: { from: [1100, 236], to: [1010, 486], width: 10, forks: 3, seed: 's07-bolt1' },
    glow: { x: 1080, y: 250, r: 520 },
  },
  {
    at: 3.125, power: 0.72, decay: 0.05, hold: 0.025, restrike: 0.07, boltDecay: 0.045,
    bolt: { from: [1830, 250], to: [1770, 470], width: 8, forks: 2, seed: 's07-bolt2' },
    glow: { x: 1820, y: 250, r: 420 },
  },
  {
    at: 5.75, power: 0.8, decay: 0.05, hold: 0.025, restrike: 0.08, boltDecay: 0.05,
    bolt: { from: [700, 160], to: [830, 420], width: 8, forks: 3, seed: 's07-bolt3' },
    glow: { x: 720, y: 190, r: 460 },
  },
];

// Run a builder and add tags to every layer it created.
function group(S, fn, tags, pick = null) {
  const n = S.layers.length;
  const out = fn(S);
  for (const L of S.layers.slice(n)) {
    for (const tag of pick ? pick(L) : tags) if (!L.tags.includes(tag)) L.tags.push(tag);
  }
  return out;
}

export default function () {
  return new Scene({
    id: 's07',
    duration: DURATION,
    background: '#151b2c',
    light: LIGHT,
    shadow: { alpha: 0.55, dist: 9, blur: 10 },
    post: { bloom: 0.38, threshold: 0.62, vignette: 0.3, grain: 0.05 },
    // Slow eased drift right with a slight push in, plus a faint sway; exactly at rest at
    // t = 4.25 (every term vanishes there).
    camera: (t) => {
      const u = (t - REST_T) / REST_T;
      const k = Math.sin(u * Math.PI / 2);
      const sw = Math.sin(TAU * (t - REST_T) / 6.2);
      return {
        x: 30 * k + 4 * sw,
        y: -9 * k + 2.5 * Math.sin(TAU * (t - REST_T) / 8.5),
        z: 45 * k, zoom: 1, roll: 0.0022 * sw,
      };
    },
    meta: { fox: { x: FOX.x, y: FOX.y }, light: { x: STAR.x, y: STAR.y }, horizon: HORIZON },
    build(S) {
      group(S, addSkyAndClouds, [], (L) => (
        L.z >= 19000 ? ['sky'] : /star|guide/i.test(L.name ?? '') || (L.z >= 11000 && L.z < 19000 && !/storm/.test(L.name ?? '')) ? ['celestial'] : ['cloud']
      ));
      group(S, (S) => addRain(S, {
        name: 'rain-far', z: 6000, size: 640, count: 520, len: [18, 44], width: [0.9, 1.5], alpha: [0.4, 0.75],
        speed: 700, drops: 20, color: '#cdd6ea', opacity: 0.85, flash: 0.5, strikes: STRIKES, seed: 's07-rain-far',
      }), ['rain']);
      group(S, addDistance, [], (L) => (/mist/.test(L.name ?? '') ? ['cloud', 'mist'] : ['land']));
      group(S, (S) => addRain(S, {
        name: 'rain-back', z: 2500, size: 700, count: 220, len: [26, 60], width: [1, 1.7], alpha: [0.35, 0.7],
        speed: 1000, drops: 20, color: '#d2daec', opacity: 0.8, flash: 0.5, strikes: STRIKES, seed: 's07-rain-back',
      }), ['rain']);
      group(S, (S) => addLightning(S, { zBolt: 6800, zGlow: 7000, zFlash: 430, strikes: STRIKES, flash: 0.4 }), ['lightning']);
      group(S, (S) => addSea(S, {
        seed: 's07-sea', horizon: HORIZON, y1: 1090, rows: 13, z0: 2300, z1: 900, x0: 760, x1: 2320,
        reflection: { x: 1493, top: 130, bottom: 320, v0: 0.25, v1: 0.62 },
        amp: [5, 165], lambda: [56, 600],
        // Hand-placed swells of very different sizes (the rest are random): small foamy
        // caps far out, a big curling teal breaker centre right, heavy crests at the right.
        feature: {
          3: [{ x: 1250, h: 24, w: 90, lean: 1.3, foam: 0.7 }, { x: 1730, h: 22, w: 90, lean: 1.2, foam: 0.6 }],
          4: [{ x: 1150, h: 42, w: 120, lean: 1.2, foam: 0.9 }, { x: 1570, h: 34, w: 110, lean: 1.3, foam: 0.7 }],
          5: [{ x: 1780, h: 62, w: 150, lean: 1.4, foam: 0.9 }],
          7: [{ x: 1310, h: 108, w: 220, lean: 1.55, foam: 1, curl: 1 }, { x: 1975, h: 84, w: 190, lean: 1.2, foam: 0.85 }],
          8: [{ x: 1790, h: 150, w: 300, lean: 1.4, foam: 1.15, curl: 1 }],
          10: [{ x: 1990, h: 175, w: 320, lean: 1.35, foam: 1, curl: 1 }],
        },
        swell: { period: SWELL, amp: [0.6, 8], travel: 1.25 },
        light: LIGHT, tags: ['sea'], density: 2,
      }), ['sea']);
      group(S, (S) => addRain(S, {
        name: 'rain-mid', z: 1700, size: 768, count: 130, len: [50, 120], width: [1.2, 2], alpha: [0.32, 0.66],
        speed: 1300, drops: 40, opacity: 0.85, flash: 0.5, strikes: STRIKES, seed: 's07-rain-mid',
      }), ['rain']);
      group(S, addLeftWoods, ['trees']);
      // Streaks just in front of the dark woods and rocks, where rain shows best.
      group(S, (S) => addRain(S, {
        name: 'rain-woods', z: 1010, size: 820, count: 70, len: [70, 150], width: [1.3, 2.1], alpha: [0.3, 0.6],
        speed: 1600, drops: 20, color: '#d8e0ee', opacity: 0.8, flash: 0.45, strikes: STRIKES, seed: 's07-rain-woods',
      }), ['rain']);
      group(S, addBank, ['ground']);
      group(S, addRocks, ['rocks']);
      group(S, addLeftFoliage, ['fg', 'flowers']);
      group(S, addSurf, ['sea', 'surf']);

      const fox = createFox(S, {
        pose: 'stand', yaw: FOX.yaw, x: FOX.x, y: FOX.y, z: 950, scale: FOX.scale, look: 1, wind: 0.8,
        rim: { amount: 0.4, color: '#ffe6b0', width: 3, glow: 0.3, dir: LIGHT },
        motion: (t) => ({ wind: 0.8 + 0.15 * Math.sin(TAU * t / 2.9) }),
      });
      if (!fox.layer.tags.includes('fox')) fox.layer.tags.push('fox');

      group(S, (S) => addRain(S, {
        name: 'rain-near', z: 560, size: 900, count: 95, len: [120, 240], width: [2.2, 3.6], alpha: [0.36, 0.62],
        speed: 2200, drops: 30, opacity: 0.85, flash: 0.4, strikes: STRIKES, soft: 0.8, seed: 's07-rain-near',
      }), ['rain']);
      group(S, addForeground, ['fg', 'flowers']);
      group(S, addReflectionGlow, ['sea']);
    },
  });
}
