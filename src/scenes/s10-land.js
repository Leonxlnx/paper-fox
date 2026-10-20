// The far land of s10: lavender and rose snow peaks around the sun (one big peak in the
// middle), slate-blue foothills, sunlit lime-green hills and the dark conifers along the
// far shore of the lake.

import { addRange, addHills } from '../elements/terrain.js';
import { addForestBand, forestBand, FOLIAGE } from '../elements/trees.js';
import { LIGHT } from './s10-layout.js';

// Foothill ridges in shade: saturated blue-slate (sampled).
const SLATE_HILLS = {
  crest: '#7088bc', ramp: ['#56709f', '#4a6596', '#3f598a', '#354e7e', '#2c4472'],
  shade: '#263a64', haze: '#9aa2c4', rim: '#c4c8e4',
};

// Sunlit dawn hills: lime crests, olive folds (sampled).
const LIME_HILLS = {
  crest: '#d6d050', ramp: ['#c2c444', '#a8b23c', '#8a9c34', '#6c852e', '#526c28'],
  shade: '#3c5424', haze: '#c4c48a', rim: '#f4eaa0',
};

const HAZE = '#8a96b4';

// Dawn peaks: blue-lavender rock, snow running from lavender shade through rose to
// pink-gold where the low sun catches it.
const PEAKS = {
  rock: ['#34447e', '#45589a', '#5c6cae', '#7a82c0', '#9e9ccc'],
  snow: ['#aca2cc', '#d0b2cc', '#f0bcbe', '#fccca8', '#ffe6c2'],
  rim: '#fff2d8', haze: '#b0b4dc', shadow: 'rgba(36,30,72,0.42)',
};

// Far ridges between the peaks and the slate foothills: hazy blue-lavender.
const LAV_RIDGES = {
  crest: '#b4b6e0', ramp: ['#9ca2d4', '#8c94c8', '#7e88bc', '#717cb0', '#6470a4'],
  shade: '#566296', haze: '#b8bade', rim: '#dcdcf2',
};

export function buildLand(S) {
  // Snowy peaks in three layers, back to front, hazier with distance. Broad flanks, soft
  // skylines. The low ridge at 1525 cuts the sun disc at its centre line.
  const soft = { palette: PEAKS, light: LIGHT, jag: 0.45, shoulder: 1, drips: 0.6, spurs: 3, edge: 0.45 };
  addRange(S, {
    name: 'peaks-haze', z: 8300, ...soft, haze: 0.5, hazeColor: '#b6b8e0', snow: 0.5, snowline: 0.9, detail: 0.12,
    peaks: [
      { x: 690, y: 322, left: 230, right: 190, baseY: 440, profile: 1, seed: 101 },
      { x: 1300, y: 338, left: 210, right: 170, baseY: 450, profile: 1, seed: 103 },
      { x: 1690, y: 326, left: 190, right: 210, baseY: 450, profile: 1, seed: 105 },
      { x: 1980, y: 318, left: 200, right: 240, baseY: 450, profile: 1, seed: 107 },
    ],
  });
  addRange(S, {
    name: 'peaks-far', z: 8000, ...soft, haze: 0.26, snow: 0.56, snowline: 0.9, detail: 0.2,
    peaks: [
      { x: 795, y: 306, left: 210, right: 180, baseY: 445, profile: 1.05, seed: 3 },
      { x: 968, y: 318, left: 160, right: 170, baseY: 445, profile: 1, seed: 5 },
      { x: 1525, y: 352, left: 240, right: 190, baseY: 452, profile: 0.85, seed: 9 },
      { x: 1760, y: 314, left: 270, right: 290, baseY: 455, profile: 1, seed: 15 },
    ],
  });
  addRange(S, {
    name: 'peaks', z: 7000, ...soft, snow: 0.6, snowline: 0.82, detail: 0.3,
    peaks: [
      { x: 760, y: 330, left: 170, right: 180, baseY: 460, profile: 1, seed: 21 },
      { x: 1128, y: 276, left: 340, right: 310, baseY: 472, profile: 1.05, jag: 0.6, seed: 23 },
      { x: 1372, y: 342, left: 190, right: 180, baseY: 472, profile: 0.95, seed: 25 },
      { x: 1668, y: 344, left: 200, right: 190, baseY: 468, profile: 0.95, seed: 27 },
      { x: 1846, y: 336, left: 190, right: 280, baseY: 468, profile: 0.95, seed: 29 },
    ],
  });

  // Hazy blue-lavender ridges at the feet of the peaks, a layer behind the slate foothills.
  addHills(S, {
    name: 'ridges', z: 5800, palette: LAV_RIDGES, light: LIGHT, strips: 3, crest: 3, shadeAmt: 0.4,
    hills: [
      { x0: 560, x1: 1260, y: 396, baseY: 540, peakX: 880, round: 1.2, seed: 45 },
      { x0: 1160, x1: 1760, y: 404, baseY: 540, peakX: 1400, round: 1.1, seed: 46 },
      { x0: 1560, x1: 2240, y: 388, baseY: 540, peakX: 1960, round: 1.2, seed: 47 },
    ],
  });

  // Slate foothills in front of the peaks.
  addHills(S, {
    name: 'foothills', z: 4600, palette: SLATE_HILLS, light: LIGHT, strips: 4, crest: 4, shadeAmt: 0.6,
    hills: [
      { x0: 560, x1: 1480, y: 404, baseY: 560, peakX: 1290, round: 1.3, seed: 41 },
      { x0: 1360, x1: 2200, y: 398, baseY: 560, peakX: 1930, round: 1.1, seed: 43 },
    ],
  });

  // Sunlit green hills: the big one left of centre, a long one behind on the right, two in front.
  addHills(S, {
    name: 'hills', z: 3200, palette: LIME_HILLS, light: LIGHT, strips: 5, crest: 9,
    hills: [
      { x0: 1300, x1: 2240, y: 428, baseY: 610, peakX: 1820, round: 1.4, seed: 51 },
      { x0: 860, x1: 1600, y: 438, baseY: 630, peakX: 1130, round: 1.5, seed: 53 },
      { x0: 1520, x1: 2300, y: 478, baseY: 640, peakX: 1980, round: 1.5, seed: 55 },
      { x0: 1100, x1: 1720, y: 500, baseY: 650, peakX: 1500, round: 1.6, seed: 57 },
    ],
  });

  // Woods in the folds of the green hills.
  S.plane(3100, {
    name: 'hill-woods', x: 860, y: 440, w: 1400, h: 180, edge: { width: 1, hi: 0.2, lo: 0.15 }, shadow: { blur: 6, alpha: 0.35 },
    draw(ctx) {
      const o = { rows: 2, rowLift: 8, colors: [FOLIAGE.forest, FOLIAGE.dawn], weights: [2, 1], haze: HAZE, hazeAmt: [0.4, 0.18], midMin: 999, skirt: 6, light: LIGHT, tones: [0.1, 0.5], gaps: 0.6 };
      forestBand(ctx, { ...o, x0: 900, x1: 1250, base: [[900, 580], [1100, 584], [1250, 594]], heights: [14, 36], density: 1.2, seed: 91 });
      forestBand(ctx, { ...o, x0: 1380, x1: 1760, base: [[1380, 590], [1560, 566], [1760, 546]], heights: [12, 32], density: 1.1, seed: 92 });
      forestBand(ctx, { ...o, x0: 1780, x1: 2240, base: [[1780, 528], [2000, 508], [2240, 522]], heights: [12, 28], density: 1, seed: 93 });
    },
  });

  // A thin line of dark conifers along the far lake shore.
  addForestBand(S, {
    z: 2700, name: 'forest-hills', x0: 860, x1: 2200, light: LIGHT,
    base: [[860, 604], [1100, 596], [1300, 592], [1500, 588], [1700, 586], [2200, 584]],
    heights: [22, 54], rows: 2, density: 0.9, colors: [FOLIAGE.dawn, FOLIAGE.forest], weights: [1, 2],
    haze: HAZE, hazeAmt: [0.45, 0.2], seed: 63, midMin: 999, tones: [0.1, 0.42], gaps: 0.9,
  });
}
