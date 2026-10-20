// s02 night lake: the valley floor between the far hills and the fox. The moonlit green
// hill sloping down to the lake, the wooded spits reaching into it, the conifers along
// the near shore, the cliff on the right, and the row of tall spruces that steps down
// from the fox's perch to the water. Trees are placed one by one from the reference.

import { RNG } from '../core/rng.js';
import { piece, linear } from '../core/piece.js';
import { vary } from '../core/color.js';
import { lerp } from '../core/ease.js';
import { drawHill, drawCliff, drawBoulders } from '../elements/terrain.js';
import { FOLIAGE, coniferMid } from '../elements/trees.js';
import { drawPromontory } from './s02-props.js';

// Trees and terrain down here are lit from the upper left, like the reference.
const L = [-0.5, -0.866];

// Tree looks: palette and [shade, lit] ramp positions.
const KINDS = {
  dark: { palette: FOLIAGE.forest, tones: [0.04, 0.42] },
  deep: { palette: FOLIAGE.night, tones: [0.03, 0.3] },
  sage: { palette: FOLIAGE.sage, tones: [0.12, 0.56] },
  lit: { palette: FOLIAGE.sage, tones: [0.45, 0.9] },
};

// The green hill: teal-green on its shaded left shoulder, lit olive down its long
// right slope to the lake.
const HILL_PALETTE = {
  crest: '#b8bc70', ramp: ['#a8ae62', '#90a45e', '#64905c', '#4c7a56', '#3c6650'],
  shade: '#2e5448', haze: '#4e6d89', rim: '#e4e8b8',
};

// [x, ground y, height, kind] in film px.
const TALL_ROW = [
  [778, 640, 200, 'dark'], [808, 690, 215, 'sage'], [872, 722, 268, 'dark'], [928, 718, 282, 'dark'],
  [982, 722, 196, 'dark'], [1050, 752, 152, 'dark'], [1100, 762, 112, 'dark'], [1146, 770, 102, 'sage'],
  [1192, 776, 96, 'dark'],
];

const RIGHT_WOOD = [
  [1462, 800, 150, 'dark'], [1500, 806, 196, 'dark'], [1556, 802, 205, 'dark'], [1600, 808, 150, 'sage'],
  [1640, 812, 170, 'dark'], [1694, 816, 160, 'lit'], [1742, 814, 175, 'dark'], [1790, 820, 150, 'dark'],
  [1858, 790, 400, 'dark'], [1925, 780, 420, 'dark'], [1985, 800, 380, 'dark'], [2050, 810, 360, 'dark'],
];

function drawTrees(ctx, list, seed, extra = {}) {
  const rng = new RNG(seed);
  for (const [x, y, h, kind] of list) {
    coniferMid(ctx, x, y, h, { ...KINDS[kind], light: L, seed: rng.int(1, 1e9), width: rng.range(0.26, 0.31), ...extra });
  }
}

// A row of small trees along a ground line from (x0, y0) to (x1, y1).
function treeRow(rng, x0, x1, y0, y1, h0, h1, step, kinds) {
  const out = [];
  for (let x = x0; x <= x1; x += step * rng.range(0.7, 1.3)) {
    const k = (x - x0) / (x1 - x0);
    out.push([x, lerp(y0, y1, k) + rng.range(-6, 6), lerp(h0, h1, k) * rng.range(0.78, 1.18), rng.pick(kinds)]);
  }
  return out;
}

// A flat torn strip of shore: olive grass over grey stones, the stones' fronts in the water.
function shore(ctx, pts, rng) {
  piece(ctx, pts, { fill: linear(ctx, 0, pts[0][1] - 20, 0, pts[0][1] + 30, ['#b4b064', '#8a8c3c']), torn: { amp: 2, freq: 0.1, seed: rng.int(1, 1e6) }, shadow: { color: 'rgba(5,15,20,0.5)', blur: 4, y: 2 } });
}

function greenHill(S) {
  S.plane(2200, {
    name: 'green-hill', x: 540, y: 380, w: 1000, h: 520, mat: 'paper', shadow: { blur: 14 },
    edge: { width: 1.4, hi: 0.3, lo: 0.2, soft: 0.6 },
    draw(ctx) {
      const rng = new RNG('s02-hill');
      drawHill(ctx, { x0: 580, x1: 1500, y: 438, baseY: 640, peakX: 860, round: 1.9, palette: HILL_PALETTE, light: [0.5, -0.866], strips: 5, crest: 10, seed: 31, bottom: 200 });
      // The dark tree line running down the hill between its lit upper shoulder and
      // the long lower slope, and a few dark clumps on the shoulder.
      const crest = [
        ...treeRow(rng, 880, 1160, 478, 540, 56, 34, 24, ['dark', 'deep', 'dark']),
        ...treeRow(rng, 1010, 1100, 452, 462, 36, 30, 26, ['deep']),
      ];
      drawTrees(ctx, crest, 's02-crest', { flecks: false });
    },
  });
}

function spits(S) {
  S.plane(1480, {
    name: 'spits', x: 900, y: 470, w: 1060, h: 210, mat: 'paper', shadow: { blur: 8 },
    edge: { width: 1.2, hi: 0.25, lo: 0.2, soft: 0.5 },
    draw(ctx) {
      const rng = new RNG('s02-spits');
      // The foot of the green hill where it meets the water (in front of the lake so
      // the far shore follows the slope), with its rows of conifers.
      piece(ctx, [[930, 576], [1100, 588], [1250, 596], [1380, 600], [1436, 598], [1446, 606], [1340, 640], [1000, 662], [930, 662]],
        { fill: linear(ctx, 0, 584, 0, 650, ['#8a9e52', '#4a6a40']), torn: { amp: 2, freq: 0.1, seed: 9 } });
      const slope = [
        ...treeRow(rng, 930, 1020, 600, 610, 120, 96, 22, ['dark', 'dark', 'deep']),
        ...treeRow(rng, 1030, 1360, 604, 614, 58, 40, 19, ['dark', 'deep', 'dark']),
        ...treeRow(rng, 1050, 1330, 624, 634, 64, 44, 21, ['dark', 'dark', 'sage']),
      ];
      drawTrees(ctx, slope, 's02-slope', { flecks: false });
      // Left spit: olive shore under dark conifers, stones along its front.
      shore(ctx, [[990, 640], [1100, 612], [1200, 606], [1290, 620], [1368, 642], [1330, 652], [1180, 656], [1000, 660]], rng);
      drawBoulders(ctx, { palette: 'river', light: L, seed: 4, detail: 0.5, rocks: [[1150, 656, 50], [1215, 658, 46], [1270, 652, 40], [1320, 652, 34]].map(([x, y, w]) => ({ x, y, w, h: w * 0.4, shape: 'round' })) });
      drawTrees(ctx, treeRow(rng, 1010, 1330, 628, 640, 78, 44, 16, ['dark', 'deep', 'dark']), 's02-spit-l', { flecks: false });
      // Right spit: a dark wooded tongue on the far shore.
      piece(ctx, [[1560, 600], [1620, 582], [1720, 574], [1800, 580], [1800, 600]], { fill: '#0c1c1c' });
      drawTrees(ctx, treeRow(rng, 1572, 1790, 598, 590, 46, 70, 13, ['deep', 'deep', 'dark']), 's02-spit-r', { flecks: false, grain: 0 });
    },
  });
}

function nearShore(S) {
  S.plane(1350, {
    name: 'near-shore', x: 980, y: 340, w: 1260, h: 520, mat: 'paper', shadow: { blur: 10 },
    edge: { width: 1.4, hi: 0.3, lo: 0.2, soft: 0.6 },
    draw(ctx) {
      const rng = new RNG('s02-near-shore');
      // The cliff on the right, mossy on top, dropping into the lake.
      drawPromontory(ctx);
      // Dense dark conifers right of the lake: a back row at the cliff's foot, the placed
      // wood, then a front row along the river bank, as thick as the reference's.
      piece(ctx, [[1490, 800], [1500, 756], [1560, 738], [1680, 728], [1760, 732], [1900, 760], [2200, 780], [2200, 850], [1490, 850]], { fill: '#0e2018', torn: { amp: 2, seed: 11 } });
      drawTrees(ctx, treeRow(rng, 1508, 1730, 744, 760, 190, 240, 24, ['dark', 'deep', 'dark', 'sage']), 's02-right-back');
      drawTrees(ctx, [[1668, 750, 260, 'dark'], [1712, 772, 220, 'lit'], [1774, 778, 190, 'dark']], 's02-cliff-trees');
      drawTrees(ctx, RIGHT_WOOD, 's02-right-wood');
      drawTrees(ctx, treeRow(rng, 1470, 1850, 818, 836, 118, 176, 25, ['dark', 'dark', 'lit', 'deep', 'sage']), 's02-right-front');
      // Conifers on the bank between the lake and the river, stones at their feet.
      const bank = [
        ...treeRow(rng, 1035, 1430, 748, 764, 128, 100, 16, ['dark', 'dark', 'deep', 'dark', 'sage']),
        ...treeRow(rng, 1050, 1420, 766, 780, 92, 74, 21, ['dark', 'lit', 'dark']),
      ];
      piece(ctx, [[1000, 744], [1100, 734], [1250, 740], [1440, 746], [1480, 800], [1000, 806]], { fill: linear(ctx, 0, 736, 0, 800, ['#24402c', '#122218']), torn: { amp: 2, seed: 3 } });
      drawTrees(ctx, bank, 's02-bank');
      drawBoulders(ctx, { palette: 'river', light: L, seed: 6, detail: 0.6, rocks: [[1240, 790, 70], [1310, 790, 60], [1372, 788, 64], [1432, 786, 56]].map(([x, y, w]) => ({ x, y, w, h: w * 0.42, shape: 'round' })) });
    },
  });
}

function tallRow(S) {
  S.plane(1200, {
    name: 'tall-row', x: 640, y: 380, w: 640, h: 440, mat: 'paper', shadow: { blur: 12 },
    edge: { width: 1.4, hi: 0.3, lo: 0.2, soft: 0.6 },
    draw(ctx) { drawTrees(ctx, TALL_ROW, 's02-tall-row'); },
  });
}

export function buildValley(S) {
  greenHill(S);
  spits(S);
  nearShore(S);
  tallRow(S);
}

export { vary };
