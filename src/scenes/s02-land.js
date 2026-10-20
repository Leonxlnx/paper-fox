// s02 night lake: everything between the sky and the fox's perch. Snowy ranges, green
// hills under conifer forests, the moonlit lake, and the river that leaves it, swirls
// through the rapids and drops over two stone ledges toward the bottom-right corner.

import { addRange, addHills, addBoulders } from '../elements/terrain.js';
import { FOLIAGE, addForestBand } from '../elements/trees.js';
import { boulderGeometry } from '../elements/terrain-rocks.js';
import { WATER, addLake, addRiver } from '../elements/water.js';
import { buildValley } from './s02-valley.js';
import { addCascades, addRiverFoam, addRockFoam } from './s02-props.js';

const S2 = 1920 / 1672; // reference px -> film px
const refPts = (pts) => pts.map(([x, y]) => [x * S2, y * S2]);

// The reference lights the far landscape from the upper left (snow faces, lit hill
// flanks), whatever the moon says; keep that look.
const LAND_LIGHT = [-0.5, -0.866];

// Moon reflection column on the lake.
export const LAKE = { top: 582, reflectX: 1480 };

// The reference river is a bright cobalt with pale streaks, lighter than WATER.night.
const RIVER = {
  ...WATER.night,
  deep: '#1a56a2', base: '#2c6dbc', mid: '#4689d2', light: '#76b0e6', pale: '#b6d8f3',
  fall: ['light', 'pale', 'foam', 'light', 'foam', 'pale', 'mid', 'foam'],
};
// The cascades read as bright white sheets in the reference.
const CASCADE = {
  ...RIVER, mid: '#5c9ee2', light: '#a6d0f4', pale: '#e8f4fe', foam: '#ffffff',
  fall: ['foam', 'mid', 'pale', 'foam', 'light', 'foam', 'mid', 'pale', 'foam', 'light'],
};
// River rocks: warm grey-brown with lit top facets, as in the reference (crack, deep
// side, side, mid, top, lit top).
const RIVER_ROCK = {
  ramp: ['#0e0a09', '#18110f', '#221916', '#33271f', '#54453c', '#76645a'],
  fleck: '#c8a458', moss: ['#4a5a26', '#6e7e2e', '#98a03a'],
};
const LAKE_PAL ={ ...WATER.nightLake, lake: ['#4a84bc', '#2a669e'] };

function mountains(S) {
  addRange(S, {
    name: 'far-peaks', z: 8000, palette: 'lake', haze: 0.35, light: LAND_LIGHT, snow: 0.6, detail: 0.6,
    peaks: [
      { x: 640, y: 282, left: 200, right: 160, baseY: 420, seed: 41 },
      { x: 905, y: 262, left: 200, right: 220, baseY: 430, seed: 42 },
      { x: 755, y: 266, left: 220, right: 200, baseY: 440, seed: 43 },
      { x: 1665, y: 355, left: 260, right: 300, baseY: 470, seed: 45 },
      { x: 1460, y: 335, left: 220, right: 260, baseY: 470, seed: 44 },
    ],
  });
  addRange(S, {
    name: 'hero-peak', z: 6000, palette: 'lake', light: LAND_LIGHT, snow: 0.5, ridge: 0.5, detail: 1,
    peaks: [{ x: 1115, y: 205, left: 430, right: 620, baseY: 460, profile: 1.3, seed: 46 }],
  });
  addRange(S, {
    name: 'blue-ridge', z: 4200, palette: 'lake', light: LAND_LIGHT, snow: 0, detail: 0.8,
    peaks: [
      { x: 1190, y: 398, left: 420, right: 420, baseY: 520, seed: 47 },
      { x: 860, y: 412, left: 260, right: 300, baseY: 520, seed: 48 },
    ],
  });
}

function hills(S) {
  addHills(S, {
    name: 'forest-hills', z: 3400, palette: 'forest', light: LAND_LIGHT, strips: 3, crest: 4, shadeAmt: 0.4,
    hills: [
      { x0: 380, x1: 1050, y: 420, baseY: 600, peakX: 600, round: 1.2 },
      { x0: 850, x1: 1500, y: 470, baseY: 620, peakX: 1150, round: 1.2 },
    ],
  });
  addHills(S, {
    name: 'far-hills', z: 3000, palette: 'night', haze: 0.45, light: LAND_LIGHT, strips: 4, crest: 5,
    hills: [
      { x0: 1480, x1: 2400, y: 360, baseY: 600, peakX: 2000, round: 1.3 },
      { x0: 1200, x1: 1640, y: 486, baseY: 600, peakX: 1420, round: 1.2 },
    ],
  });
  addForestBand(S, {
    z: 2600, name: 'forest-back', x0: 420, x1: 1250, base: refPts([[420, 420], [700, 395], [900, 420], [1100, 470], [1250, 520]]),
    heights: [40, 110], rows: 2, density: 1.6, colors: FOLIAGE.blue, haze: '#5f80b0', hazeAmt: [0.55, 0.35], seed: 21, midMin: 999, gaps: 0.8, tones: [0.15, 0.45],
  });
  // The far right hill: dense small trees toward the far shore, open slope higher up.
  addForestBand(S, {
    z: 2400, name: 'forest-shore', x0: 1160, x1: 2300, base: refPts([[1180, 520], [1350, 512], [1500, 492], [1672, 470], [1900, 455]]),
    heights: [30, 105], rows: 3, density: 1.5, colors: FOLIAGE.blue, haze: '#4a7090', hazeAmt: [0.45, 0.12], seed: 22, midMin: 999, gaps: 0.9, tones: [0.15, 0.5],
  });
}

function water(S) {
  addLake(S, {
    z: 1500, x0: 1000, x1: 2300, top: LAKE.top, bottom: 800, palette: LAKE_PAL, seed: 's02-lake',
    shore: { height: 16, ranges: [[1420, 1560], [1560, 1760]] },
    light: { x: LAKE.reflectX, width: 140, widthBottom: 90, bottom: 770, count: 40 },
  });
  const UP = {
    path: [[1496, 748], [1450, 778], [1330, 798], [1180, 822], [1060, 846], [990, 880], [1030, 914], [1200, 900], [1420, 884], [1660, 884], [1900, 876], [2200, 870]],
    width: [40, 54, 80, 110, 140, 140, 130, 120, 110, 120, 120, 120],
  };
  const LOW = { path: [[1150, 955], [1400, 990], [1650, 1030], [1900, 1070], [2250, 1110]], width: [150, 300, 380, 440, 520] };
  const upper = addRiver(S, { z: 1300, palette: RIVER, seed: 's02-river', speed: 30, texH: 200, align: 'along', ...UP, blend: [70, 0] });
  const lower = addRiver(S, { z: 1240, palette: RIVER, seed: 's02-river-low', speed: 34, texH: 240, ...LOW, blend: [90, 0] });
  // Lift both reaches toward the reference's bright cobalt.
  for (const [r, z] of [[upper, 1299.5], [lower, 1239.5]]) {
    S.add({ name: 'river-tint', z, blend: 'soft-light', alpha: 0.75, render(ctx) { ctx.fillStyle = '#62acff'; ctx.fill(r.clip); } });
  }
  // Deepen the water under the swirl strips toward the reference's saturated cobalt, so the
  // white water at the rocks and falls reads against it.
  for (const [r, z, a] of [[upper, 1299.45, 0.3], [lower, 1239.45, 0.6]]) {
    S.add({ name: 'river-deepen', z, blend: 'multiply', alpha: a, render(ctx) { ctx.fillStyle = '#3c7ee8'; ctx.fill(r.clip); } });
  }
  // The reference's many white and pale swirl strips, densest in the bend and the rapids.
  addRiverFoam(S, {
    z: 1299, palette: RIVER, box: { x: 880, y: 700, w: 1420, h: 500 },
    rivers: [
      { ...UP, z: 1299.4, clip: upper.clip, count: 190, white: 0.42, from: 0.1, to: 1 },
      { ...LOW, z: 1239.4, clip: lower.clip, count: 180, white: 0.36, from: 0.04, to: 1 },
    ],
  });
  addCascades(S, {
    z: 1230, palette: CASCADE, speed: 64,
    falls: [
      { x0: 1178, x1: 1316, top: 888, bottom: 942, tilt: -2, sag: 4 },
      { x0: 1470, x1: 1662, top: 878, bottom: 940, tilt: 3, sag: 5 },
    ],
  });
  // Seeds pinned so each rock keeps its cut when the list changes.
  const rocks = [
    { x: 1095, y: 952, w: 210, h: 95, shape: 'pointy', seed: 53 },
    { x: 1394, y: 932, w: 192, h: 98, shape: 'round', seed: 64 },
    { x: 1556, y: 858, w: 150, h: 42, shape: 'flat', seed: 86 },
    { x: 1738, y: 912, w: 170, h: 72, shape: 'round', seed: 97 },
    { x: 1782, y: 962, w: 220, h: 80, shape: 'flat', seed: 108 },
    { x: 1885, y: 975, w: 150, h: 62, shape: 'round', seed: 119 },
    { x: 1325, y: 1040, w: 150, h: 82, shape: 'pointy', seed: 130 },
    { x: 1500, y: 1086, w: 270, h: 98, shape: 'round', seed: 141 },
    { x: 1060, y: 812, w: 170, h: 52, shape: 'round', seed: 152 },
  ];
  // Foam crescents, trailing white water and rapids, all behind the rocks so nothing
  // white is pasted across a rock face.
  addRockFoam(S, {
    z: 1158, palette: { ...RIVER, pale: '#c8e2f8' }, light: LAND_LIGHT, flow: 0.3, box: { x: 940, y: 770, w: 1080, h: 380 },
    rocks: rocks.map((r) => boulderGeometry(r)),
    rapids: [
      { x: 1222, y: 990, len: 120, a: 0.22, th: 5, n: 3 },
      { x: 1428, y: 1012, len: 140, a: 0.26, th: 5, n: 3 },
      { x: 1676, y: 950, len: 90, a: 0.3, th: 3.5, n: 5 },
      { x: 1846, y: 928, len: 80, a: 0.2, th: 3.5, n: 4 },
      { x: 1640, y: 1010, len: 150, a: 0.3, th: 5.5, n: 4 },
      { x: 1180, y: 846, len: 110, a: 0.15, th: 3, n: 3 },
    ],
  });
  addBoulders(S, { name: 'river-rocks', z: 1150, palette: RIVER_ROCK, contrast: 1.25, light: LAND_LIGHT, moss: 0, rocks });
}

export function buildLand(S) {
  mountains(S);
  hills(S);
  buildValley(S);
  water(S);
}
