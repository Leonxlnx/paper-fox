// Test sheet for the tree family. Three pages cross-fade over the six seconds, each
// laid out at the position and scale of its reference so renders compare 1:1:
//   0-2 s  ref02: the big left spruce cluster, hillside and far-shore forests
//   2-4 s  ref03: redwood trunks under drooping canopy, teal spruces behind
//   4-6 s  ref10: the sunlit dawn cluster and lakeside forests

import { Scene, W, H } from '../core/stage.js';
import { RNG } from '../core/rng.js';
import { piece, linear } from '../core/piece.js';
import { ridge, closeDown, ellipse } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { smoothstep } from '../core/ease.js';
import {
  FOLIAGE, BARK, hazePalette, coniferMid, canopy, trunk, bigTrunk, addTree, addHeroConifer, addForestBand,
} from '../elements/trees.js';

const S2 = 1.1483; // reference px -> film px

// Page visibility: page k is fully shown around its own two seconds.
const page = (k) => (t) => {
  const a = k === 0 ? 1 : smoothstep(k * 2 - 0.25, k * 2 + 0.25, t);
  const b = k === 2 ? 1 : 1 - smoothstep(k * 2 + 1.75, k * 2 + 2.25, t);
  return Math.min(a, b);
};

function refPts(pts) { return pts.map(([x, y]) => [x * S2, y * S2]); }

// --- ref02 ------------------------------------------------------------------------

function nightLake(S) {
  const alpha = page(0);
  // Sky, cloud bank, mountains and far hills: flat context for the trees, one sprite.
  S.plane(20000, {
    name: 'a-backdrop', x: -200, y: -200, w: W + 400, h: H + 400, mat: 'sky', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = linear(ctx, 0, 0, 0, 700, ['#141a44', '#1d2458', '#2c3570']);
      ctx.fillRect(-200, -200, W + 400, H + 400);
      flecks(ctx, -200, -200, W + 400, 700, 700, 5, { max: 1.1 });
      const r = new RNG(4);
      for (let i = 0; i < 14; i++) {
        const x = 260 + i * 55 + r.range(-10, 10), y = 90 + Math.sin(i * 0.7) * 40 + r.range(0, 60);
        piece(ctx, ellipse(x, y, 70 + r.range(0, 30), 55 + r.range(0, 20), 36), {
          fill: linear(ctx, 0, y - 60, 0, y + 60, ['#e8e2f0', '#b9b3d8', '#8f8cbf']),
          shadow: { color: 'rgba(30,20,60,0.35)', blur: 8, x: -2, y: 5 },
        });
      }
      const top = ridge(-200, W + 200, 380, { amp: 150, freq: 0.0032, sharp: 0.8, seed: 11, step: 10 });
      piece(ctx, closeDown(top, 700), { fill: linear(ctx, 0, 230, 0, 600, ['#9ea4d4', '#5c64a0', '#3c4680']) });
      piece(ctx, refPts([[1000, 470], [1200, 400], [1450, 350], [1672, 320], [1760, 320], [1760, 700], [1000, 700]]), { fill: linear(ctx, 0, 380, 0, 600, ['#4f8a76', '#2f5e5a']), smooth: true });
      piece(ctx, refPts([[350, 470], [600, 380], [750, 360], [900, 390], [1100, 460], [1250, 520], [1250, 700], [350, 700]]), { fill: '#3b6a70', smooth: true });
    },
  }, { alpha });
  addForestBand(S, {
    z: 2600, name: 'a-band-back', alpha, x0: 420, x1: 1250, base: refPts([[420, 420], [700, 395], [900, 420], [1100, 470], [1250, 520]]),
    heights: [45, 125], rows: 2, density: 1.8, colors: FOLIAGE.blue, haze: '#5f80b0', hazeAmt: [0.55, 0.35], seed: 21, midMin: 999, gaps: 0.8, tones: [0.15, 0.45],
  });
  addForestBand(S, {
    z: 2400, name: 'a-band-shore', alpha, x0: 1160, x1: 2100, base: refPts([[1180, 520], [1350, 505], [1500, 470], [1672, 430], [1800, 420]]),
    heights: [35, 130], rows: 3, density: 1.8, colors: FOLIAGE.blue, haze: '#4a7090', hazeAmt: [0.5, 0.15], seed: 22, midMin: 999, gaps: 0.8, tones: [0.15, 0.45],
  });
  S.plane(2000, {
    name: 'a-hill-green', x: 600, y: 380, w: 900, h: 450,
    draw(ctx) {
      piece(ctx, refPts([[620, 400], [700, 385], [820, 395], [980, 440], [1120, 500], [1230, 545], [1230, 640], [620, 640]]), {
        fill: linear(ctx, 0, 440, 0, 720, ['#6e9a48', '#4f7a36', '#365e2c']), smooth: true,
      });
    },
  }, { alpha });
  addForestBand(S, {
    z: 1800, name: 'a-band-hill', alpha, x0: 700, x1: 1420, base: refPts([[620, 470], [800, 460], [1000, 520], [1150, 570], [1240, 600]]),
    heights: [80, 220], rows: 2, density: 0.95, colors: [FOLIAGE.forest, FOLIAGE.sage], weights: [5, 1], haze: '#506a88', hazeAmt: [0.22, 0], seed: 23, midMin: 60, skirt: false, width: 0.24, tones: [0.1, 0.5],
  });
  addForestBand(S, {
    z: 1400, name: 'a-band-near', alpha, x0: 640, x1: 1180, base: refPts([[620, 660], [900, 650], [1100, 670]]),
    heights: [200, 320], rows: 1, density: 0.9, colors: [FOLIAGE.forest, FOLIAGE.sage], weights: [5, 1], hazeAmt: [0, 0], seed: 24, midMin: 60, skirt: false, width: 0.24, tones: [0.08, 0.5],
  });
  // The left cluster: dark spruces behind, the two-tone spruce, then the giant.
  S.plane(1300, {
    name: 'a-back-spruces', x: 160, y: -40, w: 520, h: 900,
    draw(ctx) {
      coniferMid(ctx, 300, 760, 780, { palette: FOLIAGE.teal, light: S.light, seed: 31, width: 0.2, tones: [0.06, 0.3] });
      coniferMid(ctx, 520, 780, 640, { palette: FOLIAGE.teal, light: S.light, seed: 32, width: 0.2, tones: [0.06, 0.32] });
    },
  }, { alpha });
  addTree(S, { z: 1150, name: 'a-spruce-b', alpha, detail: 'mid', x: 408, y: 680, h: 700, width: 0.22, tiers: 12, palette: FOLIAGE.night, seed: 33, tones: [0.06, 0.46] });
  addHeroConifer(S, {
    z: 1000, name: 'a-giant', alpha, x: 80, y: 700, h: 1560, width: 0.22, tiers: 14, trunkFrac: 0.21, trunkWidth: 0.08,
    palette: FOLIAGE.night, bark: BARK.night, seed: 34, bias: 0.7, front: 0.35, interior: false, fronds: 2,
  });
  S.plane(800, {
    name: 'a-ground', x: -300, y: 620, w: W + 600, h: 760, edge: false, shadow: false,
    draw(ctx) {
      piece(ctx, [[-300, 700], [W + 300, 760], [W + 300, H + 300], [-300, H + 300]], { fill: '#1e3320' });
    },
  }, { alpha });
}

// --- ref03 ------------------------------------------------------------------------

function fireflyForest(S) {
  const alpha = page(1);
  // Trunks left of the star are lit on their right flank, trunks right of it on their left.
  const fromLeft = [0.6, -0.8], fromRight = [-0.6, -0.8];
  S.plane(20000, {
    name: 'b-sky', x: -200, y: -200, w: W + 400, h: H + 400, mat: 'sky', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = linear(ctx, 0, 0, 0, 700, ['#0a1434', '#13204e', '#1d2c5c']);
      ctx.fillRect(-200, -200, W + 400, H + 400);
      flecks(ctx, 500, -200, 1000, 700, 600, 8, { max: 1.3 });
    },
  }, { alpha });
  addForestBand(S, {
    z: 2600, name: 'b-mist-spruces', alpha, x0: 560, x1: 1500, base: 560, heights: [260, 430], rows: 2, density: 0.75,
    colors: FOLIAGE.teal, haze: '#5a7c9c', hazeAmt: [0.55, 0.4], seed: 41, midMin: 90, skirt: 80,
  });
  S.plane(1900, {
    name: 'b-teal-spruces', x: 600, y: -40, w: 900, h: 700,
    draw(ctx) {
      const o = { palette: FOLIAGE.teal, light: fromLeft, width: 0.24, tones: [0.06, 0.34] };
      coniferMid(ctx, 873, 600, 640, { ...o, seed: 42 });
      coniferMid(ctx, 1206, 590, 470, { ...o, seed: 43, light: fromRight });
      coniferMid(ctx, 988, 610, 620, { ...o, seed: 44, tones: [0.1, 0.42] });
    },
  }, { alpha });
  S.plane(1600, {
    name: 'b-thin-trunks', x: 680, y: -60, w: 820, h: 720,
    draw(ctx) {
      trunk(ctx, 746, -40, 620, 46, { bark: hazePalette(BARK.redwood, '#1a2440', 0.35), light: fromLeft, seed: 45, taper: 0.9, flare: 0.2 });
      trunk(ctx, 1435, -40, 600, 28, { bark: hazePalette(BARK.redwood, '#1a2440', 0.35), light: fromRight, seed: 46, taper: 0.9, flare: 0.15 });
      trunk(ctx, 1085, 300, 600, 16, { bark: hazePalette(BARK.redwood, '#1a2440', 0.5), light: fromLeft, seed: 47, taper: 0.9, flare: 0.1 });
    },
  }, { alpha });
  // Canopy hanging from the middle trunks, behind the big ones.
  S.plane(1300, {
    name: 'b-canopy-mid', x: 560, y: -120, w: 1000, h: 500,
    draw(ctx) {
      canopy(ctx, { x0: 650, x1: 1000, y: -50, sag: 20, len: [170, 300], rows: 2, density: 1.4, dir: 1, palette: FOLIAGE.night, light: fromLeft, seed: 48, bias: 0.62 });
      canopy(ctx, { x0: 1180, x1: 1460, y: -60, sag: 10, len: [160, 260], rows: 2, density: 1.4, dir: -1, palette: FOLIAGE.teal, light: fromRight, seed: 49, bias: 0.58 });
    },
  }, { alpha });
  // The four redwoods.
  const redwood = (name, z, x, w, light, foliage, seed) => S.plane(z, {
    name, x: x - w * 1.6 - 380, y: -160, w: w * 3.2 + 760, h: 860,
    draw(ctx) { bigTrunk(ctx, x, -60, 640, w, { light, seed, foliage }); },
  }, { alpha });
  redwood('b-redwood-2', 1100, 563, 184, fromLeft, [], 51);
  redwood('b-redwood-4', 1080, 1808, 172, fromRight, [], 52);
  redwood('b-redwood-1', 1000, 226, 235, fromLeft, [{ x0: -120, x1: 560, y: -60, sag: 40, len: [160, 290], rows: 3, palette: FOLIAGE.night, bias: 0.6 }], 53);
  redwood('b-redwood-3', 1000, 1547, 172, fromRight, [{ x0: 1300, x1: 2000, y: -50, sag: 60, len: [180, 320], rows: 3, palette: FOLIAGE.teal, bias: 0.66 }], 54);
  S.plane(800, {
    name: 'b-ground', x: -300, y: 500, w: W + 600, h: 880, edge: false, shadow: false,
    draw(ctx) { piece(ctx, [[-300, 600], [W + 300, 620], [W + 300, H + 300], [-300, H + 300]], { fill: '#1a2a1c' }); },
  }, { alpha });
}

// --- ref10 ------------------------------------------------------------------------

function dawn(S) {
  const alpha = page(2);
  const light = [0.75, -0.66]; // low sun on the right
  // Sky, mountains and hills: flat context for the trees, one sprite.
  S.plane(20000, {
    name: 'c-backdrop', x: -200, y: -200, w: W + 400, h: H + 400, mat: 'sky', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = linear(ctx, 0, -200, 0, 700, ['#a9b4d8', '#e8c6a0', '#f6cf8c', '#f9dca0']);
      ctx.fillRect(-200, -200, W + 400, H + 400);
      const top = ridge(-200, W + 200, 400, { amp: 120, freq: 0.0035, sharp: 0.8, seed: 61, step: 10 });
      piece(ctx, closeDown(top, 760), { fill: linear(ctx, 0, 280, 0, 600, ['#c4a6c4', '#8c84b4', '#6c6ca0']) });
      const hill = ridge(-200, W + 200, 520, { amp: 60, freq: 0.002, sharp: 0.2, seed: 62, step: 12 });
      piece(ctx, closeDown(hill, 760), { fill: linear(ctx, 0, 460, 0, 700, ['#a8b05a', '#7a8a40', '#5a6a34']) });
    },
  }, { alpha });
  addForestBand(S, {
    z: 2500, name: 'c-band-hills', alpha, x0: 500, x1: 2100, base: refPts([[450, 470], [800, 455], [1100, 475], [1400, 470], [1700, 455]]),
    heights: [40, 90], rows: 3, density: 1.1, colors: FOLIAGE.dawn, haze: '#8496ae', hazeAmt: [0.6, 0.3], seed: 63, midMin: 999, light, tones: [0.12, 0.45],
  });
  S.plane(2200, {
    name: 'c-lake', x: 900, y: 560, w: 1200, h: 300,
    draw(ctx) { piece(ctx, refPts([[880, 520], [1672, 505], [1760, 505], [1760, 700], [880, 700]]), { fill: linear(ctx, 0, 590, 0, 760, ['#a8c4d8', '#5f8fc0']) }); },
  }, { alpha });
  addForestBand(S, {
    z: 2000, name: 'c-band-island', alpha, x0: 1170, x1: 1430, base: refPts([[1010, 552], [1130, 548], [1250, 556]]),
    heights: [50, 110], rows: 2, density: 1.2, colors: FOLIAGE.dawn, haze: '#8496ae', hazeAmt: [0.35, 0.12], seed: 64, midMin: 999, light, skirt: 14,
  });
  addForestBand(S, {
    z: 2000, name: 'c-band-shore', alpha, x0: 1580, x1: 2100, base: refPts([[1380, 545], [1672, 535]]),
    heights: [50, 120], rows: 2, density: 1.1, colors: FOLIAGE.dawn, haze: '#8496ae', hazeAmt: [0.35, 0.12], seed: 65, midMin: 999, light, skirt: 14,
  });
  // The hillside spruces right of the fox (ref x 680-1000).
  addForestBand(S, {
    z: 1500, name: 'c-band-slope', alpha, x0: 760, x1: 1180, base: refPts([[650, 600], [800, 620], [1000, 680]]),
    heights: [130, 300], rows: 2, density: 0.85, colors: [FOLIAGE.dawn, FOLIAGE.dusk], weights: [2, 1], haze: '#8496ae', hazeAmt: [0.18, 0], seed: 66, light, skirt: false, width: 0.24, tones: [0.06, 0.55],
  });
  // The three spruces stepping down behind the fox's rock (ref x 450-650).
  S.plane(1250, {
    name: 'c-spruces', x: 460, y: 120, w: 340, h: 640,
    draw(ctx) {
      const o = { palette: FOLIAGE.dawn, light, tones: [0.05, 0.5] };
      coniferMid(ctx, 597, 740, 570, { ...o, seed: 67, width: 0.15 });
      coniferMid(ctx, 689, 740, 480, { ...o, seed: 68, width: 0.14, tones: [0.08, 0.58] });
    },
  }, { alpha });
  addTree(S, { z: 1150, name: 'c-spruce-b', alpha, detail: 'mid', x: 459, y: 760, h: 735, width: 0.17, tiers: 12, palette: FOLIAGE.dawn, seed: 69, tones: [0.03, 0.48], light });
  addHeroConifer(S, {
    z: 1000, name: 'c-giant', alpha, x: 112, y: 760, h: 1560, width: 0.24, tiers: 13, trunkFrac: 0.3, trunkWidth: 0.08,
    palette: FOLIAGE.dawn, bark: BARK.dusk, seed: 70, bias: 0.5, contrast: 1.5, front: 0.3, interior: false, fronds: 2, light,
  });
  S.plane(800, {
    name: 'c-ground', x: -300, y: 620, w: W + 600, h: 760, edge: false, shadow: false,
    draw(ctx) { piece(ctx, [[-300, 690], [W + 300, 740], [W + 300, H + 300], [-300, H + 300]], { fill: '#3a4a20' }); },
  }, { alpha });
}

export default function () {
  return new Scene({
    id: 'trees',
    duration: 6,
    background: '#141a3a',
    light: [0.55, -0.83],
    post: { bloom: 0.3, vignette: 0.15, grain: 0.04 },
    build(S) {
      nightLake(S);
      fireflyForest(S);
      dawn(S);
    },
  });
}
