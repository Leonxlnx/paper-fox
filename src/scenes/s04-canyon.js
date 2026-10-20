// s04 canyon: the stepped walls on both sides of the river, the spruces crowding their
// mossy tops and ledges, and the waterfalls pouring off them.

import { W } from '../core/stage.js';
import { coniferMid, FOLIAGE, BARK } from '../elements/trees.js';
import { addWaterfall, addMist, WATER } from '../elements/water.js';
import { LIGHT, ROCK, MOSS, HAZE, hazed, drawCanyonWall, yAt } from './s04-kit.js';
import { addFoamBands } from './s04-water.js';

// Spruce palettes of the canyon: dark blue-green, a teal variant and the sunlit sage
// ones dotted between them.
// Band order across the falls: saturated ref04 blues with only thin white streaks.
const FALL_BANDS = ['base', 'mid', 'light', 'pale', 'mid', 'base', 'light', 'mid', 'foam', 'mid'];
// The big fall is the brightest thing in the canyon: layered white and pale strips on the
// lit (left) half, light blues in the middle, a darker blue edge in shade.
const BIG_BANDS = ['base', 'pale', 'foam', 'light', 'mid', 'foam', 'pale', 'light', 'mid', 'foam', 'light', 'pale', 'mid', 'base'];
// Bright saturated blues for the big sheet, deeper at both edges.
const BIG_PAL = { ...WATER.canyon, deep: '#1f6cc4', base: '#2f7ad4', mid: '#4f98e2', light: '#86bff0', pale: '#c0def8', foam: '#f6fafe' };
// The slender left falls read pale, almost white, against the dark wall.
const LEFT_BANDS = ['pale', 'foam', 'light', 'pale', 'mid', 'foam', 'light'];

const SPRUCE = {
  dark: { ...FOLIAGE.forest, lit: '#355a44', hi: '#4f7a58' },
  teal: { ...FOLIAGE.teal },
  sage: { ...FOLIAGE.sage, lit: '#6f8a40', hi: '#93ad55' },
};

// Paint spruces [x, baseY, h, kind?, width?] back to front (higher bases first).
export function spruces(ctx, list, { light = LIGHT, haze = 0, seed = 1 } = {}) {
  const sorted = list.map((t, i) => ({ t, i })).sort((a, b) => a.t[1] - b.t[1]);
  for (const { t: [x, y, h, kind = 'dark', width = 0.25], i } of sorted) {
    const palette = haze ? hazed(SPRUCE[kind], haze, HAZE) : SPRUCE[kind];
    coniferMid(ctx, x, y, h, {
      palette, bark: haze ? hazed(BARK.night, haze, HAZE) : BARK.night, light, seed: seed * 100 + i,
      width, tones: kind === 'sage' ? [0.12, 0.62] : [0.06, 0.5],
    });
  }
}

// One canyon wall with the spruces standing on and in front of it, baked as one plane.
//   wall    drawCanyonWall options (top, bottom, left, right, cols, ...)
//   behind  spruces standing on the wall top (painted first, the moss rim covers their feet)
//   front   spruces standing in front of the face
function wallPlane(S, z, name, { wall, behind = [], front = [], haze = 0, res = 1 }) {
  const xs = wall.top.map((p) => p[0]), ys = wall.top.map((p) => p[1]);
  const trees = [...behind, ...front];
  const tx = trees.flatMap(([x, , h, , wd = 0.25]) => [x - h * wd * 1.2 - 20, x + h * wd * 1.2 + 20]);
  const ty = trees.map(([, y, h]) => y - h * 1.06 - 20);
  const x0 = Math.min(...xs, ...tx, ...(wall.left ?? []).map((p) => p[0])) - 40;
  const x1 = Math.max(...xs, ...tx, ...(wall.right ?? []).map((p) => p[0])) + 40;
  const y0 = Math.min(...ys, ...ty) - 40;
  const y1 = Math.max(wall.bottom, ...trees.map(([, y]) => y + 30)) + 20;
  return S.plane(z, {
    name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, res, mat: [{ tex: 'stone', amt: 0.7 }, { tex: 'crumple', amt: 0.5, scale: 0.36 }, { tex: 'fiber', amt: 0.4 }],
    edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.6 }, shadow: { blur: 14 },
    draw(ctx) {
      spruces(ctx, behind, { haze, seed: z });
      drawCanyonWall(ctx, { palette: hazed(ROCK, haze), mossPal: hazed(MOSS, haze * 0.8), seed: z, ...wall });
      spruces(ctx, front, { haze, seed: z + 1 });
    },
  });
}

export function addCanyon(S) {
  // --- far reaches downstream (hazier, smaller columns) ---
  wallPlane(S, 2600, 'wall-d3', {
    haze: 0.32,
    wall: { top: [[1355, 602], [1400, 596], [1462, 606]], bottom: 700, cols: 34, moss: 0.4 },
    behind: [[1372, 600, 44], [1398, 598, 52], [1428, 602, 40], [1450, 604, 36, 'teal']],
  });
  wallPlane(S, 2350, 'wall-d2', {
    haze: 0.26,
    wall: { top: [[1198, 528], [1240, 516], [1300, 520], [1335, 530], [1372, 545]], bottom: 700, cols: 48, moss: 0.7,
      right: [[1372, 545], [1366, 600], [1372, 700]] },
    behind: [[1215, 525, 70], [1240, 518, 96], [1268, 520, 80, 'teal'], [1296, 520, 104], [1322, 526, 74], [1350, 536, 62, 'teal']],
  });
  wallPlane(S, 2100, 'wall-d1', {
    haze: 0.18,
    wall: { top: [[1040, 458], [1090, 450], [1140, 452], [1180, 462], [1212, 476]], bottom: 700, cols: 56, moss: 0.8,
      right: [[1212, 476], [1206, 560], [1214, 700]] },
    behind: [[1058, 455, 84], [1080, 450, 110], [1104, 451, 96, 'teal'], [1128, 452, 120], [1152, 455, 88], [1176, 460, 104, 'teal'], [1198, 470, 76]],
  });
  // Right bank, far: the low wall where the river bends out of sight.
  wallPlane(S, 2250, 'wall-r2', {
    haze: 0.22,
    wall: { top: [[1572, 486], [1610, 474], [1660, 470], [1710, 476]], bottom: 720, cols: 44, moss: 0.6,
      left: [[1572, 486], [1566, 560], [1560, 720]] },
    behind: [[1590, 482, 64], [1616, 474, 88, 'teal'], [1646, 471, 72], [1676, 472, 96], [1700, 474, 70, 'teal']],
  });

  // --- the wall the big fall pours from, and its spruces ---
  wallPlane(S, 1850, 'wall-bc', {
    wall: {
      top: [[556, 322], [600, 312], [650, 314], [700, 332], [760, 338], [820, 330], [880, 326], [940, 328], [1000, 334], [1050, 348]],
      bottom: 760, cols: 74, moss: 1, right: [[1050, 348], [1044, 420], [1050, 520], [1046, 760]],
    },
    behind: [
      [572, 316, 150], [604, 312, 170], [636, 314, 120, 'teal'], [668, 320, 150], [736, 334, 110], [768, 336, 132],
      [800, 332, 120, 'teal'], [834, 330, 140], [866, 327, 96], [900, 326, 128], [936, 328, 116, 'teal'], [972, 331, 104], [1006, 336, 92], [1036, 344, 70],
    ],
  });
  // The sheet pours straight off the mossy lip and bows down, widening as it falls into
  // the trees (ref04): tall, wide and bright, layered white strips on its lit side.
  addWaterfall(S, {
    z: 1840, palette: BIG_PAL, seed: 's04-bigfall', speed: 130, round: 30, bands: BIG_BANDS, bandWidth: 10, streaks: 2.6, accel: 0.45,
    path: [[722, 332], [730, 354], [746, 410], [764, 480], [780, 552], [792, 628]], width: [120, 132, 142, 150, 154, 158],
    foam: false, mist: { strength: 0.3, w: 300, h: 130 },
  });
  // Torn white crescents piled where it lands, spray hanging over the plunge pool.
  addFoamBands(S, {
    z: 1836, seed: 's04-foam-bigfall', spray: 0.8,
    items: [
      { x: 850, y: 644, w: 210, h: 56, bend: 12, pile: true }, { x: 930, y: 654, w: 170, h: 42, bend: 8, pile: true },
      { x: 786, y: 660, w: 170, h: 34, bend: 6 }, { x: 990, y: 664, w: 150, h: 30, bend: 5 },
    ],
  });
  addMist(S, { z: 1835, x: 830, y: 600, w: 280, h: 110, count: 5, strength: 0.12, seed: 's04-bigfall-veil' });

  // --- the tall wall on the left with the slender double fall ---
  wallPlane(S, 1700, 'wall-a', {
    wall: {
      top: [[180, 228], [240, 214], [300, 206], [360, 200], [420, 198], [480, 202], [530, 208], [575, 218], [598, 230]],
      bottom: 780, cols: 80, moss: 1.1, right: [[598, 230], [604, 330], [598, 440], [606, 780]],
    },
    behind: [
      [226, 214, 210], [268, 208, 190, 'teal'], [306, 205, 150], [356, 200, 270], [404, 199, 160, 'sage'], [452, 201, 190],
      [500, 205, 130, 'teal'], [540, 210, 110], [578, 220, 90],
    ],
  });
  addWaterfall(S, {
    z: 1690, palette: WATER.canyon, seed: 's04-leftfall', speed: 110, bandWidth: 8, bands: LEFT_BANDS, streaks: 1.6, round: 18,
    path: [[290, 234], [308, 254], [326, 314], [346, 378], [364, 446]], width: [48, 54, 58, 62, 64],
    foam: false, mist: { strength: 0.34, w: 130, h: 70 },
  });
}

// The near spruces and the lower step of the left wall, between the walls and the ledge.
export function addCanyonNear(S) {
  wallPlane(S, 1420, 'wall-a2', {
    wall: {
      top: [[372, 452], [420, 440], [470, 436], [520, 444], [560, 458]], bottom: 760, cols: 60, moss: 1,
      left: [[372, 452], [366, 520], [372, 760]], right: [[560, 458], [568, 560], [562, 760]],
    },
    behind: [[396, 446, 110], [446, 438, 96, 'sage']],
    front: [
      [300, 440, 160], [334, 470, 170], [436, 452, 128, 'sage'], [512, 470, 110], [566, 590, 230], [626, 590, 160],
      [880, 560, 80, 'sage'], [920, 568, 70],
    ],
  });
  // White water where the upper fall lands on the step before pouring on.
  addFoamBands(S, { z: 1415, seed: 's04-leftfall-step', spray: 0.6, items: [{ x: 386, y: 452, w: 104, h: 22, bend: 5, pile: true }] });
  addWaterfall(S, {
    z: 1410, palette: WATER.canyon, seed: 's04-leftfall2', speed: 110, bandWidth: 8, bands: LEFT_BANDS, streaks: 1.6, round: 16,
    path: [[400, 444], [410, 468], [418, 530], [426, 604]], width: [48, 52, 56, 60],
    foam: false, mist: { strength: 0.3, w: 120, h: 70 },
  });
}

// The tall near wall on the right bank, its crown of big spruces, and the forest on the
// slope below it running down to the water.
export function addRightBank(S) {
  wallPlane(S, 1500, 'wall-r1', {
    wall: {
      top: [[1712, 352], [1760, 338], [1820, 332], [1880, 334], [1940, 330], [2040, 326], [W + 320, 330]],
      bottom: 1000, cols: 90, moss: 1.1, lean: 0.03,
      left: [[1712, 352], [1702, 420], [1708, 500], [1696, 600], [1700, 1000]],
    },
    behind: [
      [1736, 344, 110], [1770, 337, 90, 'teal'], [1812, 333, 175], [1850, 334, 120], [1890, 334, 150], [1930, 331, 128, 'teal'],
      [1975, 329, 160], [2020, 327, 120], [2070, 328, 150], [2120, 329, 110, 'teal'], [2170, 330, 140],
    ],
  });
  wallPlane(S, 1320, 'bank-r', {
    wall: {
      top: [[1500, 700], [1560, 672], [1620, 660], [1700, 664], [1780, 672], [1840, 690], [1880, 708]],
      bottom: 820, cols: 50, moss: 1.6, plateau: 18, drips: 1.6,
      left: [[1500, 700], [1494, 760], [1500, 820]], right: [[1880, 708], [1886, 760], [1880, 820]],
    },
    behind: [
      [1520, 690, 120], [1552, 676, 150, 'teal'], [1590, 666, 110], [1626, 662, 170], [1662, 662, 130, 'teal'],
      [1700, 664, 150], [1740, 668, 116], [1780, 672, 140], [1820, 684, 120, 'teal'], [1860, 700, 100],
    ],
  });
  // Spruces climbing the foot of the right wall.
  wallPlane(S, 1180, 'bank-r-near', {
    wall: {
      top: [[1790, 700], [1840, 660], [1900, 640], [1980, 630], [W + 320, 630]],
      bottom: 1000, cols: 70, moss: 1.2, plateau: 14,
      left: [[1790, 700], [1800, 760], [1790, 860], [1804, 1000]],
    },
    behind: [[1830, 668, 210], [1880, 646, 240, 'teal'], [1930, 636, 200], [1990, 632, 230], [2060, 630, 190, 'teal'], [2120, 630, 220]],
  });
}
