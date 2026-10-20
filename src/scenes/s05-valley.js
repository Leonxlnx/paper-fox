// s05 snow peaks: the valley on the right. A green-ridged hill and slate hills
// around a winding silver lake, dark spruce forests on every slope, the mossy
// granite outcrop in the bottom-right corner and the snowy slopes below the trail.

import { addRange } from '../elements/terrain.js';
import { addLake, WATER } from '../elements/water.js';
import { addForestBand, coniferMid } from '../elements/trees.js';
import { RNG } from '../core/rng.js';
import { piece } from '../core/piece.js';
import { mix } from '../core/color.js';
import { rockFace, snowDrape, grassClump, GRANITE, SPRUCE, SPRUCE_FAR, hazed } from './s05-kit.js';

// Near spruces: deep green with lit tiers, matching the slope's spruces.
const SPRUCE_NEAR = { deep: '#0b281b', dark: '#18462c', mid: '#28603a', lit: '#3d7c46', hi: '#5f9c56', fleck: '#d6c27a' };

const L = [0.45, -0.89];

// Ridges that hold moss instead of snow: the drawMountain "snow" pieces become the
// lit green crests, the rock facets the blue-teal forested flanks.
const GREEN_HILL = {
  rock: ['#062a44', '#0c3a58', '#18506a', '#286274', '#3c7478'],
  snow: ['#2c5650', '#3a6656', '#4a765c', '#5c8466', '#729676'],
  rim: '#a4bca0', haze: '#2c4c78', shadow: 'rgba(4,14,30,0.55)',
};
const SLATE_HILL = {
  rock: ['#141a30', '#242840', '#363852', '#4e4a64', '#6e6480'],
  snow: ['#2e3e44', '#3c4c4c', '#4c5c52', '#5e6c5a', '#748064'],
  rim: '#c0b8c8', haze: '#2c4c78', shadow: 'rgba(4,10,24,0.55)',
};

// Silver night water: dark navy strips under pale moonlit ones.
const LAKE = {
  ...WATER.nightLake,
  deep: '#14325a', base: '#24487a', mid: '#3e6496', light: '#8ea4c4', pale: '#e2e2de',
  lake: ['#6c86ac', '#28467a'], shore: '#06182a',
  glow: ['#c8ccd0', '#e6e2d6', '#fbf8ee'],
};

// Lake outline: the far shore runs under the ridges; the hills in front carve the
// winding river out of it.
const LAKE_SHAPE = [
  [1370, 630], [1450, 617], [1560, 613], [1660, 618], [1740, 628],
  [1724, 642], [1694, 656], [1660, 672], [1668, 694], [1708, 716], [1714, 744], [1684, 770], [1638, 792], [1626, 820],
  [1646, 846], [1618, 880], [1584, 920], [1594, 962],
  [1478, 962], [1470, 920], [1440, 888], [1456, 858], [1506, 832], [1498, 804], [1450, 780], [1430, 752], [1446, 726],
  [1520, 712], [1598, 700], [1560, 684], [1480, 664], [1410, 648],
];

const tag = (L0, t = 'valley') => { for (const l of [L0].flat()) l.tags = [t]; return L0; };

export function addLakeValley(S) {
  tag(addLake(S, {
    z: 2900, x0: 1300, x1: 2140, top: 612, bottom: 960, shape: LAKE_SHAPE, palette: LAKE, seed: 's05-lake',
    density: 1.15, scale: 0.8, shore: { height: 12, ranges: [[1350, 1480], [1660, 2140]] },
    light: { x: 1640, width: 200, widthBottom: 110, top: 614, bottom: 940, count: 70, glow: 0.3, thick: 0.75 },
  }), 'water');

  // The big green-crested hill left of the river and the one beyond it on the right.
  tag(addRange(S, {
    name: 'hill-green', z: 3000, palette: GREEN_HILL, light: L, snow: 0.55, snowline: 0.9, ridge: 0.7, detail: 0.9, drips: 0.6,
    peaks: [
      { x: 2040, y: 612, left: 420, right: 300, baseY: 702, bottom: 40, profile: 1.0, seed: 543 },
      { x: 1286, y: 592, left: 780, right: 330, baseY: 744, bottom: 300, profile: 0.95, seed: 542 },
    ],
  }));
  // The forested bank right of the river.
  tag(addRange(S, {
    name: 'hill-bank', z: 2600, palette: GREEN_HILL, light: L, snow: 0.6, snowline: 1, ridge: 0.6, detail: 0.8, drips: 0.4,
    peaks: [{ x: 1890, y: 704, left: 250, right: 420, baseY: 900, profile: 1.0, seed: 552 }],
  }));
}

export function addValleyForests(S) {
  // Forests: blue-black spires on the far slopes, darker and taller nearer the camera.
  const far = { colors: SPRUCE_FAR, haze: '#1f4a6a', midMin: 999, skirt: true, gaps: 0.7, tones: [0.15, 0.5], shadow: 0.5 };
  tag(addForestBand(S, { ...far, z: 2950, name: 'forest-green-hill', seed: 561, x0: 900, x1: 1520,
    base: [[900, 840], [1100, 800], [1300, 790], [1430, 830], [1520, 884]], heights: [22, 54], rows: 3, density: 1.4, hazeAmt: [0.35, 0.15] }));
  // Spires climbing the green hill's near slope above the lower forest.
  tag(addForestBand(S, { ...far, z: 2980, name: 'forest-green-slope', seed: 566, x0: 940, x1: 1460,
    base: [[940, 770], [1060, 738], [1180, 722], [1300, 740], [1400, 774], [1460, 800]], heights: [16, 36], rows: 2, density: 1.0, hazeAmt: [0.4, 0.2] }));
  tag(addForestBand(S, { ...far, z: 2950, name: 'forest-far-hill', seed: 562, x0: 1660, x1: 2200,
    base: [[1660, 724], [1760, 700], [1900, 676], [2200, 668]], heights: [14, 34], rows: 2, density: 1.6, hazeAmt: [0.3, 0.15] }));
  tag(addForestBand(S, { ...far, z: 2400, name: 'forest-lake-spit', seed: 563, x0: 1440, x1: 1600, skirt: false,
    base: [[1440, 716], [1520, 708], [1596, 698]], heights: [14, 30], rows: 2, density: 2, hazeAmt: [0.25, 0.1] }));
  tag(addForestBand(S, { ...far, z: 2380, name: 'forest-lake-bend', seed: 567, x0: 1430, x1: 1510, skirt: false,
    base: [[1436, 790], [1476, 812], [1506, 838]], heights: [14, 30], rows: 2, density: 2, hazeAmt: [0.25, 0.1] }));
  tag(addForestBand(S, { ...far, z: 2550, name: 'forest-bank', seed: 565, x0: 1730, x1: 2200,
    base: [[1730, 840], [1820, 800], [1920, 776], [2200, 764]], heights: [26, 64], rows: 3, density: 1.5, hazeAmt: [0.25, 0.1] }));
  tag(addForestBand(S, { ...far, z: 2100, name: 'forest-valley-floor', seed: 564, x0: 1080, x1: 2200,
    base: [[1080, 900], [1300, 905], [1450, 962], [1600, 992], [1720, 962], [2200, 960]], heights: [40, 96], rows: 3, density: 1.7, hazeAmt: [0.25, 0.05],
    colors: SPRUCE_FAR, midMin: 70 }));
}

// The mossy granite outcrop in the bottom-right corner with spruces at its foot.
export function addRightOutcrop(S) {
  const outline = [[1560, 1180], [1590, 990], [1640, 900], [1700, 836], [1760, 808], [1850, 812], [1930, 826], [2200, 840], [2200, 1180]];
  const moss = [[1700, 838], [1760, 806], [1850, 810], [1930, 824], [2200, 838], [2200, 880], [1960, 872], [1860, 862], [1780, 860], [1720, 870]];
  S.plane(1600, {
    name: 'outcrop-right', x: 1520, y: 760, w: 720, h: 460, mat: 'stone', res: 1, shadow: { blur: 14 },
    draw(ctx) {
      rockFace(ctx, outline, { light: L, seed: 571, palette: { ...GRANITE, ramp: ['#0e0c14', '#211d28', '#332d38', '#4a404a', '#665a5c', '#86766c'] }, sy: 0.6, tilt: 0.35, lit: 0.45 });
      const rng = new RNG('s05-moss');
      piece(ctx, moss, {
        fill: '#6e7448', torn: { amp: 2.5, freq: 0.08, fine: 1, seed: 7 },
        shadow: { color: 'rgba(0,0,0,0.5)', blur: 5, x: -1, y: 3 }, bevel: { light: L, width: 1.6, hi: 0.4, lo: 0.2 },
      });
      for (let i = 0; i < 40; i++) {
        const x = 1720 + rng.next() * 480, y = 822 + rng.next() * 40;
        piece(ctx, [[x, y], [x + rng.range(8, 20), y - rng.range(1, 4)], [x + rng.range(10, 24), y + rng.range(2, 6)]], {
          fill: mix('#8a8a50', '#5a6038', rng.next()), torn: { amp: 1, freq: 0.3, seed: i + 3 },
        });
      }
      for (let i = 0; i < 6; i++) grassClump(ctx, 1730 + i * 70 + rng.range(-20, 20), 832 + rng.range(0, 14), { len: rng.range(14, 24), n: 6, light: L, seed: 580 + i });
    },
  }).tags = ['valley'];

  // Spruces at the outcrop's foot and between it and the valley.
  S.plane(1450, {
    name: 'spruce-outcrop', x: 1460, y: 720, w: 760, h: 420, mat: 'paper', shadow: { blur: 10 },
    draw(ctx) {
      const rng = new RNG('s05-spruce-outcrop');
      const pal = hazed(SPRUCE, '#1a3a50', 0.25);
      const spots = [[1540, 1010, 190], [1600, 1060, 230], [1660, 1090, 170], [1720, 1100, 150], [1500, 960, 150], [1840, 1110, 130], [1960, 1100, 150], [2060, 1110, 170]];
      for (const [x, y, h] of spots) coniferMid(ctx, x + rng.range(-8, 8), y, h, { palette: pal, light: L, seed: rng.int(1, 1e6), width: 0.2, tones: [0.08, 0.5] });
    },
  }).tags = ['valley'];
}

// Spruces standing behind the slope's crest: the tall dark stand right of the fox's
// outcrop and a row of smaller ones stepping down the valley side behind the rock
// masses, then a hazier row further down toward the river.
export function addSnowSlopes(S) {
  S.plane(1300, {
    name: 'snow-slopes-back', x: 700, y: 400, w: 1000, h: 780, mat: 'paper', res: 1, shadow: { blur: 12 },
    draw(ctx) {
      const rng = new RNG('s05-slopes-back');
      const tree = (x, y, h, k) => coniferMid(ctx, x + rng.range(-5, 5), y, h, { palette: hazed(SPRUCE_NEAR, '#163a4c', k), light: L, seed: rng.int(1, 1e6), width: 0.2, tones: [0.08, 0.55] });
      for (const [x, y, h] of [[1100, 800, 96], [1146, 812, 92], [1196, 828, 90], [1250, 846, 86], [1304, 868, 84], [1360, 892, 80], [1416, 916, 78], [1470, 940, 76], [1524, 962, 74]]) tree(x, y, h, 0.3);
      for (const [x, y, h] of [[1080, 836, 132], [1128, 852, 124], [1176, 866, 130], [1228, 884, 118], [1280, 904, 122], [1334, 926, 112], [1390, 950, 114], [1446, 972, 106], [1504, 996, 102], [1560, 1020, 98]]) tree(x, y, h, 0.14);
      for (const [x, y, h] of [[796, 780, 272], [828, 780, 300], [866, 790, 250], [920, 800, 282], [978, 812, 222], [1030, 824, 196], [1066, 840, 170]]) tree(x, y, h, 0.04);
    },
  }).tags = ['valley'];
}