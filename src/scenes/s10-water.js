// The valley water of s10: the lake with its sun column and forested island, the river
// that leaves the lake, swings left under the fox's rock and turns right along the bottom
// of the frame, and the waterfall that drops from beneath the rock into it.

import { RNG } from '../core/rng.js';
import { piece, linear } from '../core/piece.js';
import { WATER, addLake, addRiver, addWaterfall, addRapids } from '../elements/water.js';
import { forestBand, coniferMid, FOLIAGE, BARK } from '../elements/trees.js';
import { drawBoulders } from '../elements/terrain.js';
import { drawShrub } from '../elements/flora.js';
import { drawGlow } from '../elements/sky.js';
import { LIGHT, SUN, LAKE } from './s10-layout.js';

// Saturated sunrise blues (sampled on the lake and river), gold sun path, cream foam.
const PAL = {
  ...WATER.dawn,
  deep: '#1c56a6', base: '#2e6cc0', mid: '#4a8cd6', light: '#7cb6ea', pale: '#c0dcf6',
  foam: '#f8f6ee', foamShade: '#a8bcd6', shadow: '#0a1a34', shore: '#1e3a3a',
  glint: '#fff4c6', glow: ['#f0bc5c', '#fad890', '#fff4cc'],
  lake: ['#6c9ad2', '#2f68b6'],
};
const HAZE = '#8a96b4';

// The waterfall: near-white sheet with pale sky-blue bands, pure white foam.
const FALL_PAL = { ...PAL, mid: '#6aa6e2', light: '#94c6f0', pale: '#cfe6fa', foam: '#fdfeff', foamShade: '#a8c2e0', fall: ['light', 'foam', 'pale', 'mid', 'foam', 'pale', 'light', 'foam', 'pale', 'light'] };

// Dark river stones with warm sunlit tops (sampled on the boulders in the river).
export const RIVER_STONE = {
  ramp: ['#140c08', '#2a1a12', '#40281c', '#583826', '#744c32', '#9a6a44'],
  fleck: '#f0c672', moss: ['#5e6a28', '#8e9a34', '#c0b848'],
};

// Goldenrod-like autumn shrubs along the banks.
export const GOLD_SHRUB = { shrub: { top: '#f0b424', mid: '#cc8816', low: '#8e5a12', stem: '#5a4818', dark: '#4e360e' } };

// The river: out of the lake, down-left past the fall, then right along the bottom edge.
// It starts heading straight down, so its head is cut level across the lake (a slanted
// cap left a pale wedge poking up into the sun column).
const RIVER_PATH = [[1505, 702], [1498, 772], [1440, 850], [1392, 932], [1450, 1012], [1520, 1100], [1560, 1180]];
const RIVER_WIDTH = [230, 240, 330, 520, 760, 1000, 1100];

export function buildWater(S) {
  // Dark ground under everything below the horizon, so no gap ever shows the backdrop.
  S.plane(1760, {
    name: 'valley-floor', x: -420, y: 560, w: 2760, h: 900, mat: 'paper', edge: false, shadow: false,
    draw(ctx) { ctx.fillStyle = linear(ctx, 0, 560, 0, 1460, ['#3c4c2a', '#24301c']); ctx.fillRect(-420, 560, 2760, 900); },
  });

  addLake(S, {
    z: 1700, x0: LAKE.x0, x1: LAKE.x1, top: LAKE.top, bottom: 800, palette: PAL, seed: 's10-lake',
    shore: { height: 14, alpha: 0.45, ranges: [[1150, 1460], [1560, 2180]] },
    // The sun column ends above the river head, so the river melts into blue water.
    // Broken dashes with blue water between them, so it reads as glitter, not a slab.
    light: { x: SUN.x - 24, width: 170, widthBottom: 240, top: LAKE.top + 2, bottom: 704, count: 64, glow: 0.4, thick: 0.85, colors: ['#e9b04e', '#ffe0a0', '#fff6dc'] },
  });

  island(S);
  farShore(S);

  addRiver(S, {
    z: 1480, palette: PAL, seed: 's10-river', speed: 26, texH: 220, smooth: 340, current: 0.32,
    path: RIVER_PATH, width: RIVER_WIDTH, blend: [120, 0],
    sheen: { v: 0.42, width: 0.3, amount: 0.4 },
    swirls: [{ x: 1460, y: 850, r: 60, rings: 5 }, { x: 1300, y: 960, r: 90 }, { x: 1560, y: 1040, r: 90 }, { x: 1250, y: 1060, r: 80 }],
  });

  leftBank(S);
  bankBoulders(S);
  rightBank(S);
  riverRocks(S);

  // Two-step cascade: an upper sheet off the lip of the fox's rock, a ledge of foam, and
  // a wider lower sheet crashing into a broad white churn on the river.
  addWaterfall(S, {
    z: 1125, palette: FALL_PAL, seed: 's10-fall-up', speed: 110, streaks: 1.4,
    path: [[878, 724], [912, 740], [932, 780], [940, 824]], width: [118, 124, 130, 136],
    foam: { w: 170, h: 28, size: 0.7, count: 8, flat: 0.45, y: 824 }, mist: false,
  });
  addWaterfall(S, {
    z: 1115, palette: FALL_PAL, seed: 's10-fall', speed: 120, streaks: 1.4,
    path: [[935, 818], [972, 834], [998, 878], [1012, 930]], width: [142, 152, 168, 188],
    foam: { w: 330, h: 50, size: 0.72, count: 19, flat: 0.38, y: 934 }, mist: { strength: 0.32, color: '#fffaf0' },
  });

  // Warm light pooled on the lake around the sun column.
  S.add({
    name: 'lake-sun-glow', z: 1695,
    render(ctx, t) {
      const b = 1 + 0.05 * Math.sin(t * 1.3);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, SUN.x - 24, 650, 240 * b, '#ffd27a', 0.1, { sx: 0.62, sy: 0.7 });
      drawGlow(ctx, SUN.x - 24, 650, 200 * b, '#fff0c0', 0.05, { sx: 0.4, sy: 0.7 });
      drawGlow(ctx, SUN.x - 24, 626, 130 * b, '#fff4cc', 0.1, { sx: 1, sy: 0.55 });
      ctx.globalCompositeOperation = 'source-over';
    },
  });
}

// Forested island in the lake, its rocky skirt reflected below.
function island(S) {
  S.plane(1680, {
    name: 'island', x: 1100, y: 470, w: 420, h: 200, edge: { width: 1.2, hi: 0.25, lo: 0.2 }, shadow: { blur: 8 },
    draw(ctx) {
      piece(ctx, [[1150, 648], [1172, 634], [1236, 624], [1330, 620], [1420, 626], [1456, 642], [1436, 652], [1170, 654]], {
        fill: linear(ctx, 0, 618, 0, 654, ['#a8964a', '#5e5432', '#3a3424']), torn: { amp: 1.4, freq: 0.2, seed: 3 },
      });
      forestBand(ctx, {
        x0: 1166, x1: 1448, base: [[1166, 642], [1240, 630], [1320, 624], [1400, 630], [1448, 642]], heights: [40, 100], rows: 3, rowLift: 9,
        density: 1.7, colors: [FOLIAGE.dawn, FOLIAGE.forest], weights: [2, 1], haze: HAZE, hazeAmt: [0.2, 0.04],
        seed: 71, midMin: 999, skirt: 10, light: LIGHT, tones: [0.1, 0.64], gaps: 1,
      });
    },
  });
}

// The wooded far shore on the right of the lake.
function farShore(S) {
  S.plane(1690, {
    name: 'far-shore', x: 1500, y: 480, w: 720, h: 180, edge: { width: 1.2, hi: 0.25, lo: 0.2 }, shadow: { blur: 8 },
    draw(ctx) {
      piece(ctx, [[1580, 632], [1620, 616], [1720, 606], [1900, 600], [2200, 596], [2200, 640], [1580, 640]], {
        fill: linear(ctx, 0, 598, 0, 640, ['#8a7c40', '#4a4430', '#3a3424']), torn: { amp: 1.4, freq: 0.2, seed: 4 },
      });
      forestBand(ctx, {
        x0: 1600, x1: 2200, base: [[1600, 626], [1750, 610], [2200, 604]], heights: [36, 86], rows: 2, rowLift: 12,
        density: 1.3, colors: [FOLIAGE.dawn, FOLIAGE.forest], weights: [1, 2], haze: HAZE, hazeAmt: [0.25, 0.08],
        seed: 72, midMin: 999, skirt: 12, light: LIGHT, tones: [0.08, 0.5], gaps: 0.85,
      });
    },
  });
}

// The near-left bank: a wooded point between the fox's rock and the river, lit gold.
function leftBank(S) {
  S.plane(1380, {
    name: 'left-bank', x: 860, y: 470, w: 640, h: 470, shadow: { blur: 12 },
    draw(ctx) {
      const rng = new RNG('s10-left-bank');
      piece(ctx, [[880, 610], [1060, 616], [1180, 650], [1290, 712], [1400, 770], [1320, 830], [1200, 870], [880, 900]], {
        fill: linear(ctx, 0, 610, 0, 900, ['#7a8a30', '#55652a', '#2e3a22']), torn: { amp: 2, freq: 0.1, seed: 5 },
      });
      forestBand(ctx, {
        x0: 900, x1: 1330, base: [[900, 660], [1060, 672], [1200, 726], [1330, 800]], heights: [40, 96], rows: 3, rowLift: 16,
        density: 1.4, colors: [FOLIAGE.dawn, FOLIAGE.dusk], weights: [3, 1], haze: HAZE, hazeAmt: [0.12, 0], seed: 73,
        midMin: 60, skirt: false, width: 0.28, light: LIGHT, tones: [0.08, 0.62],
      });
      for (const [x, y, w, h] of [[1070, 752, 210, 86], [1210, 772, 200, 80], [1330, 800, 160, 60], [960, 740, 160, 70]]) {
        drawShrub(ctx, { x, y, w, h, leaf: 12, palette: GOLD_SHRUB, light: LIGHT, seed: rng.int(1, 1e6) });
      }
    },
  });
}

// Brown boulders along the left edge of the river, right of the fall (reference: big block by the foam).
function bankBoulders(S) {
  S.plane(1290, {
    name: 'bank-boulders', x: 980, y: 700, w: 520, h: 250, mat: [{ tex: 'stone', amt: 1 }, { tex: 'crumple', amt: 0.6, scale: 0.32 }],
    shadow: { blur: 12 },
    draw(ctx) {
      drawBoulders(ctx, {
        palette: RIVER_STONE, light: LIGHT, seed: 83, moss: 0.12, contrast: 1.7, cracks: 1.5,
        rocks: [
          { x: 1128, y: 912, w: 240, h: 170, shape: 'block', seed: 1, contrast: 1.7, cracks: 1.5 }, { x: 1290, y: 892, w: 130, h: 76, shape: 'round', seed: 2 },
          { x: 1380, y: 878, w: 96, h: 52, shape: 'round', seed: 3 }, { x: 1446, y: 862, w: 70, h: 36, shape: 'flat', seed: 4 },
        ],
      });
    },
  });
}

// The near-right bank: spruces stepping down from the far shore to the water, rocks and
// gold shrubs at its edge.
function rightBank(S) {
  S.plane(1360, {
    name: 'right-bank', x: 1480, y: 520, w: 760, h: 520, shadow: { blur: 12 },
    draw(ctx) {
      const rng = new RNG('s10-right-bank');
      piece(ctx, [[1470, 760], [1520, 744], [1620, 720], [1720, 700], [1860, 690], [2240, 680], [2240, 1000], [1900, 990], [1740, 960], [1610, 880], [1560, 800]], {
        fill: linear(ctx, 0, 690, 0, 1000, ['#6a7a2c', '#44542a', '#26321c']), torn: { amp: 2, freq: 0.1, seed: 6 },
      });
      // Small spruces on the point by the water, tall ones stepping up toward the edge.
      forestBand(ctx, {
        x0: 1590, x1: 1790, base: [[1590, 730], [1700, 716], [1790, 728]], heights: [40, 86], rows: 2, rowLift: 12,
        density: 1.2, colors: [FOLIAGE.dawn, FOLIAGE.dusk], weights: [3, 1], haze: HAZE, hazeAmt: [0.16, 0.02], seed: 74,
        midMin: 60, skirt: false, width: 0.26, light: LIGHT, tones: [0.06, 0.6],
      });
      forestBand(ctx, {
        x0: 1770, x1: 2240, base: [[1770, 736], [1850, 750], [2000, 800], [2240, 830]], heights: [120, 220], rows: 3, rowLift: 20,
        density: 1.2, colors: [FOLIAGE.dawn, FOLIAGE.dusk], weights: [3, 1], haze: HAZE, hazeAmt: [0.12, 0], seed: 75,
        midMin: 60, skirt: false, width: 0.26, light: LIGHT, tones: [0.06, 0.6],
      });
      drawBoulders(ctx, {
        palette: RIVER_STONE, light: LIGHT, seed: 81, moss: 0.2,
        rocks: [{ x: 1600, y: 800, w: 80, h: 40, shape: 'round' }, { x: 1660, y: 840, w: 110, h: 48, shape: 'flat' }, { x: 1720, y: 900, w: 100, h: 46, shape: 'round' }, { x: 1580, y: 770, w: 60, h: 26, shape: 'flat' }],
      });
      for (const [x, y, w, h] of [[1800, 870, 200, 90], [1950, 910, 240, 110], [2100, 940, 220, 100], [1740, 830, 130, 64]]) {
        drawShrub(ctx, { x, y, w, h, leaf: 13, palette: GOLD_SHRUB, light: LIGHT, seed: rng.int(1, 1e6) });
      }
    },
  });
}

// Dark boulders standing in the river, white water curling round them.
function riverRocks(S) {
  const rocks = [
    { x: 1600, y: 1010, w: 120, h: 62, shape: 'pointy' }, { x: 1700, y: 1000, w: 100, h: 54, shape: 'round' },
    { x: 1810, y: 1030, w: 150, h: 72, shape: 'round' }, { x: 1920, y: 1050, w: 140, h: 70, shape: 'pointy' },
    { x: 1480, y: 1020, w: 90, h: 40, shape: 'flat' },
  ];
  addRapids(S, {
    z: 1300, zFront: 1260, palette: PAL, seed: 's10-rapids', angle: 0.25, thick: 6,
    rocks: rocks.map((r) => ({ x: r.x, y: r.y - 6, rx: r.w * 0.5, ry: r.h * 0.22 })),
  });
  S.plane(1280, {
    name: 'river-rocks', x: 1400, y: 920, w: 640, h: 160, mat: [{ tex: 'stone', amt: 1 }, { tex: 'crumple', amt: 0.6, scale: 0.32 }],
    shadow: { blur: 10 },
    draw(ctx) { drawBoulders(ctx, { palette: RIVER_STONE, light: LIGHT, seed: 82, moss: 0.1, contrast: 1.6, rocks }); },
  });
}
