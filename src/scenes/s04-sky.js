// s04 sky and distance: the twilight backdrop with its peach horizon under the guiding
// star, gold paper stars, the moon half behind cream clouds, the far snowy ranges and
// the navy ridges and forested valley the river comes out of.

import { W } from '../core/stage.js';
import { addSky, addStarField, addMoon, addGuidingStar, GUIDE_PRESETS } from '../elements/sky.js';
import { addCloud } from '../elements/clouds.js';
import { addRange, addHills } from '../elements/terrain.js';
import { addForestBand, FOLIAGE } from '../elements/trees.js';
import { rgba } from '../core/color.js';
import { LIGHT } from './s04-kit.js';

// A soft elliptical glow (screen blend) breathing very slowly: the violet afterglow
// pooled over the far valley in ref04.
function addGlow(S, { name, z, x, y, rx, ry, color, alpha, blend = 'screen' }) {
  return S.add({
    name, z, blend,
    render(ctx, t) {
      ctx.save();
      ctx.globalAlpha *= alpha * (0.93 + 0.07 * Math.sin(t * 0.8 + x * 0.01));
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(color, 1)); g.addColorStop(0.35, rgba(color, 0.62)); g.addColorStop(0.7, rgba(color, 0.2)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    },
  });
}

// Positions at rest, film px (reference px x 1.1483).
export const MOON = { x: 621, y: 118, r: 89 };
export const STAR = { x: 1486, y: 276, size: 39 };

// ref04 peaks: violet rock, lilac-white snow (no sunset pink).
const PEAKS = {
  rock: ['#2e2a72', '#3e3888', '#5448a2', '#6e5cb8', '#8c78cc'],
  snow: ['#8a7ec8', '#a59ad8', '#c2b8e8', '#dcd5f2', '#f2eefa'],
  rim: '#ffffff', haze: '#9a8cd0', shadow: 'rgba(22,16,60,0.5)',
};

const SKY_STARS = [
  { x: 1079, y: 146, r: 23 }, { x: 1231, y: 172, r: 14 }, { x: 1188, y: 86, r: 14 }, { x: 767, y: 45, r: 13 },
  { x: 889, y: 103, r: 11 }, { x: 970, y: 68, r: 10 }, { x: 1291, y: 224, r: 8 },
];

export function addSkyAndDistance(S) {
  addSky(S, {
    palette: 'twilight', seed: 's04',
    // The peach pool of the afterglow sits low under the guiding star, not across the whole horizon.
    glows: [
      { x: 1500, y: 390, r: 520, color: '#ffc8a2', alpha: 0.32 },
      { x: 1560, y: 330, r: 300, color: '#f4b8b0', alpha: 0.25 },
    ],
  }).tags = ['sky'];

  const tagged = (layers) => { for (const L of [layers].flat()) L.tags = ['celestial']; return layers; };
  tagged(addStarField(S, {
    seed: 's04-stars', stars: SKY_STARS, glow: 0.35,
    dots: 60, region: [660, 0, 640, 320],
  }));
  tagged(addStarField(S, { seed: 's04-dots', stars: [], dots: 50, region: [1300, 0, 620, 250], glow: 0.2 }));

  // Cream bank behind the moon (its upper puffs peek out to the left of the disc).
  addCloud(S, {
    name: 'moon-back', z: 15500, seed: 's04-moonback', palette: 'night', light: LIGHT, drift: 1.5, sway: 3,
    x: 360, y: -40, w: 330, h: 200, tiers: 2, tone: -0.25, warm: { x: MOON.x, y: MOON.y, r: 260, color: '#ffe0b0', amt: 0.35 },
    tierOpts: [
      { crown: [[400, 40, 50], [462, 70, 54], [520, 84, 50]], lobes: 0, tone: 0.05, merge: true },
      { crown: [[430, 110, 46], [500, 130, 42]], lobes: 5, tone: 0.3 },
    ],
  });
  tagged(addMoon(S, { ...MOON, seed: 's04-moon', glow: 1.1 }));
  // Lavender puffs drifting across the moon's lower left.
  addCloud(S, {
    name: 'moon-front', z: 11000, seed: 's04-moonfront', palette: 'night', light: LIGHT, drift: 2, sway: 4,
    x: 470, y: 90, w: 210, h: 120, tiers: 2, warm: { x: MOON.x, y: MOON.y, r: 200, color: '#ffe0b0', amt: 0.25 },
    tierOpts: [
      { crown: [[505, 152, 30], [548, 160, 34], [590, 178, 28]], lobes: 5, tone: 0.3 },
      { crown: [[520, 186, 26], [565, 194, 24]], lobes: 5, tone: 0.5 },
    ],
  });
  // The long cream bank right of the moon, its lavender underside sunk behind the far range.
  addCloud(S, {
    name: 'moon-right', z: 10000, seed: 's04-moonright', palette: 'night', light: LIGHT, drift: 2.5, sway: 5,
    x: 660, y: 110, w: 420, h: 140, tiers: 3, warm: { x: MOON.x, y: MOON.y, r: 360, color: '#ffe0b0', amt: 0.3 },
    tierOpts: [
      { crown: [[720, 178, 34], [790, 160, 46], [860, 166, 50], [930, 182, 40], [990, 200, 34], [1040, 214, 26]], lobes: 0, tone: 0.05, merge: true },
      { crown: [[690, 205, 26], [740, 200, 30], [800, 205, 32], [870, 210, 30], [940, 220, 28], [1010, 228, 22]], lobes: 6, tone: 0.32 },
      { crown: [[720, 236, 22], [780, 236, 24], [850, 240, 24], [920, 244, 22]], lobes: 6, tone: 0.5 },
    ],
  });
  addCloud(S, {
    name: 'mid-small', z: 10000, seed: 's04-midsmall', palette: 'night', light: LIGHT, drift: 3, sway: 4,
    x: 950, y: 200, w: 200, h: 70, tiers: 2, flatBase: true,
    tierOpts: [
      { crown: [[985, 250, 18], [1020, 236, 24], [1060, 238, 22], [1100, 252, 14]], lobes: 0, tone: 0.06, merge: true },
      { crown: [[975, 262, 12], [1015, 258, 16], [1060, 260, 15], [1110, 264, 10]], lobes: 5, tone: 0.3 },
    ],
  });
  // Right side: the tall cream bank above the cliff and the low pink-lavender streak.
  addCloud(S, {
    name: 'right-high', z: 10000, seed: 's04-righthigh', palette: 'night', light: [0.3, -0.95], drift: 2, sway: 4,
    x: 1650, y: 40, w: 560, h: 180, tiers: 3, flatBase: true, tone: -0.22, warm: { x: 1500, y: 330, r: 520, color: '#ffe2bc', amt: 0.4 },
    tierOpts: [
      { crown: [[1720, 160, 30], [1790, 130, 44], [1860, 104, 56], [1940, 92, 62], [2040, 100, 60], [2140, 120, 50]], lobes: 0, tone: 0.05, merge: true },
      { crown: [[1680, 196, 20], [1740, 186, 30], [1810, 176, 36], [1890, 170, 40], [1980, 172, 40], [2080, 180, 36], [2170, 190, 30]], lobes: 6, tone: 0.3 },
      { crown: [[1700, 212, 14], [1770, 208, 20], [1850, 206, 22], [1940, 206, 22], [2040, 208, 20], [2140, 212, 18]], lobes: 6, tone: 0.48 },
    ],
  });
  addCloud(S, {
    name: 'right-low', z: 9500, seed: 's04-rightlow', palette: 'night', light: [0.3, -0.95], drift: 3, sway: 4,
    x: 1620, y: 240, w: 330, h: 70, tiers: 2, flatBase: true, tone: 0.1, warm: { x: 1500, y: 330, r: 300, color: '#f2b2b6', amt: 0.4 },
    tierOpts: [
      { crown: [[1660, 296, 14], [1710, 282, 22], [1770, 270, 28], [1830, 262, 28], [1890, 270, 24], [1940, 284, 18]], lobes: 0, tone: 0.2, merge: true },
      { crown: [[1650, 304, 10], [1720, 300, 14], [1800, 298, 16], [1880, 300, 14], [1950, 304, 10]], lobes: 5, tone: 0.42 },
    ],
  });

  // The star's beam: a clear column of light falling to the far peaks (ref04).
  tagged(addGuidingStar(S, { ...STAR, ...GUIDE_PRESETS.canyon, seed: 's04-guide', beam: { length: 250, alpha: 1.35, width: 14, up: 70 } }).layers);

  // Far snowy ranges: violet peaks snowed only near the tops, fading into the afterglow.
  addRange(S, {
    name: 'range-far', z: 8500, palette: PEAKS, haze: 0.3, hazeColor: '#a294d4', light: [0.5, -0.866], snow: 0.3, snowline: 0.48, detail: 0.6, contrast: 0.7,
    fade: { color: '#a898e6', from: 300, to: 480, alpha: 0.6 },
    peaks: [
      { x: 760, y: 196, left: 160, right: 170, baseY: 330, seed: 101 },
      { x: 900, y: 222, left: 140, right: 160, baseY: 340, seed: 102 },
      { x: 1040, y: 252, left: 170, right: 160, baseY: 380, seed: 103 },
      { x: 1215, y: 287, left: 200, right: 140, baseY: 450, seed: 104 },
      { x: 1318, y: 283, left: 150, right: 210, baseY: 450, seed: 105 },
      { x: 1540, y: 362, left: 160, right: 170, baseY: 470, seed: 106 },
      { x: 1650, y: 330, left: 200, right: 240, baseY: 480, seed: 107 },
      { x: 1820, y: 380, left: 150, right: 260, baseY: 480, seed: 108 },
    ],
  });
  // The near snow peak: deep blue flank with a lit snowy ridge, rising out of the valley.
  addRange(S, {
    name: 'range-near', z: 6000, palette: PEAKS, haze: 0.06, hazeColor: '#8a80cc', light: [0.5, -0.866], snow: 0.24, snowline: 0.44, ridge: 0.7, detail: 0.9,
    fade: { color: '#9688e0', from: 400, to: 525, alpha: 0.6 },
    peaks: [
      { x: 1368, y: 338, left: 270, right: 310, baseY: 520, profile: 1.2, seed: 111 },
      { x: 1660, y: 372, left: 150, right: 240, baseY: 520, profile: 1.1, seed: 112 },
    ],
  });
  // Navy ridges in front, sweeping down to the valley floor.
  addRange(S, {
    name: 'ridges', z: 4200, palette: 'ridge', light: [0.5, -0.866], snow: 0, detail: 0.7, contrast: 0.8,
    fade: { color: '#8a7cdc', from: 430, to: 560, alpha: 0.62 },
    peaks: [
      { x: 1180, y: 392, left: 260, right: 330, baseY: 560, profile: 1.05, seed: 121 },
      { x: 1690, y: 420, left: 260, right: 300, baseY: 560, profile: 1.05, seed: 122 },
    ],
  });
  // Violet afterglow pooled where the valley meets the far ranges, and a paler breath of
  // it lying on the valley floor over the river's far reach.
  addGlow(S, { name: 'valley-glow', z: 3900, x: 1490, y: 500, rx: 470, ry: 120, color: '#a48ef0', alpha: 0.5 });
  addGlow(S, { name: 'valley-glow-peach', z: 7000, x: 1520, y: 420, rx: 380, ry: 90, color: '#f0b8c8', alpha: 0.28 });
  // The valley: forested slopes on both sides of the river's far reach.
  addHills(S, {
    name: 'valley-hills', z: 3200, palette: 'forest', haze: 0.5, light: [0.5, -0.866], strips: 3, crest: 4, shadeAmt: 0.4,
    hills: [
      { x0: 860, x1: 1500, y: 452, baseY: 580, peakX: 1000, round: 1.2, seed: 131 },
      { x0: 1520, x1: W + 260, y: 470, baseY: 580, peakX: 1800, round: 1.3, seed: 132 },
    ],
  });
  addForestBand(S, {
    name: 'valley-forest', z: 3000, x0: 860, x1: 1500, box: { x: 760, y: 300, w: 840, h: 320 },
    base: [[880, 478], [1050, 496], [1250, 524], [1450, 550]], heights: [18, 46], rows: 3, density: 1.1,
    colors: [FOLIAGE.forest, FOLIAGE.teal], weights: [3, 2], haze: '#5a62ae', hazeAmt: [0.72, 0.42], tones: [0.12, 0.45],
    midMin: 999, gaps: 0.75, seed: 141, light: [0.5, -0.866],
  });
  addGlow(S, { name: 'valley-floor-glow', z: 2950, x: 1500, y: 548, rx: 250, ry: 60, color: '#b4a2f2', alpha: 0.38 });
  addForestBand(S, {
    name: 'valley-forest-r', z: 3000, x0: 1560, x1: 2160, box: { x: 1480, y: 360, w: 760, h: 260 },
    base: [[1560, 545], [1700, 520], [1900, 505], [2160, 500]], heights: [22, 50], rows: 3, density: 1.3,
    colors: [FOLIAGE.forest, FOLIAGE.teal], weights: [3, 2], haze: '#5a62ae', hazeAmt: [0.66, 0.36], tones: [0.12, 0.45],
    midMin: 999, gaps: 0.75, seed: 142, light: [0.5, -0.866],
  });
}
