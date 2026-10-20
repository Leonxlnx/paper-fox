// s02 night lake: the near side of the shot. The spruce cluster on the left, the dark
// conifers behind the fox, its flat grey perch, the goldenrod shrubs, the boulders
// along the bank and the flower cluster framing the bottom-left corner.

import { FOLIAGE, BARK, coniferMid, addTree, addHeroConifer } from '../elements/trees.js';
import { addFlowerBed, FLOWER_BEDS } from '../elements/flora.js';
import { goldShrub, drawBoulder, topOval, ROCK } from './s02-props.js';

function leftTrees(S) {
  // Shadowed forest behind the giant spruce: fills the left edge (also for overscan).
  S.plane(1120, {
    name: 'left-dark', x: -520, y: 120, w: 820, h: 1200, shadow: { blur: 12 },
    draw(ctx) {
      ctx.fillStyle = '#0a1812';
      ctx.fillRect(-520, 640, 820, 680);
      for (const [x, y, h, seed] of [[-380, 1000, 1000, 61], [-200, 980, 1080, 62], [-40, 900, 860, 63], [120, 760, 560, 64]]) {
        coniferMid(ctx, x, y, h, { palette: FOLIAGE.teal, light: S.light, seed, width: 0.3, tones: [0.02, 0.2], flecks: false });
      }
    },
  });
  S.plane(1300, {
    name: 'back-spruces', x: 160, y: -40, w: 700, h: 900,
    draw(ctx) {
      coniferMid(ctx, 300, 760, 780, { palette: FOLIAGE.teal, light: S.light, seed: 31, width: 0.2, tones: [0.04, 0.24] });
      coniferMid(ctx, 525, 700, 560, { palette: FOLIAGE.teal, light: S.light, seed: 32, width: 0.2, tones: [0.04, 0.26] });
      coniferMid(ctx, 610, 700, 500, { palette: FOLIAGE.forest, light: S.light, seed: 35, width: 0.2, tones: [0.05, 0.34] });
      coniferMid(ctx, 695, 690, 420, { palette: FOLIAGE.forest, light: S.light, seed: 36, width: 0.2, tones: [0.06, 0.4] });
    },
  });
  addTree(S, { z: 1150, name: 'spruce-b', detail: 'mid', x: 408, y: 680, h: 700, width: 0.22, tiers: 12, palette: FOLIAGE.night, seed: 33, tones: [0.04, 0.4] });
  addHeroConifer(S, {
    z: 1000, name: 'giant', x: 80, y: 700, h: 1560, width: 0.22, tiers: 14, trunkFrac: 0.21, trunkWidth: 0.08,
    palette: FOLIAGE.night, bark: BARK.night, seed: 34, bias: 0.7, front: 0.35, interior: false, fronds: 2,
  });
}

// Goldenrod masses: [x, base y, w, h, seed].
function shrubPlane(S, z, name, list, box) {
  S.plane(z, {
    name, ...box, mat: 'paper', shadow: { blur: 9 }, edge: { width: 1.2, hi: 0.3, lo: 0.25, soft: 0.6 },
    draw(ctx) { for (const [x, y, w, h, seed, warm] of list) goldShrub(ctx, { x, y, w, h, seed, warm: (warm ?? 0) - 0.1, size: 0.72 }); },
  });
}

function shrubs(S) {
  // Behind the perch, between it and the tall conifers.
  shrubPlane(S, 990, 'shrubs-perch', [
    [700, 752, 210, 120, 1, -0.05], [960, 790, 220, 150, 3], [835, 760, 300, 165, 2, 0.05],
  ], { x: 560, y: 560, w: 540, h: 260 });
  // Under the giant spruce, behind the flowers.
  shrubPlane(S, 1080, 'shrubs-left', [
    [70, 640, 240, 150, 4, -0.08], [250, 660, 260, 150, 5, -0.04],
  ], { x: -120, y: 470, w: 540, h: 220 });
  // River banks: below the tall row and on the right bank above the rapids.
  shrubPlane(S, 1180, 'shrubs-bank', [
    [1010, 800, 180, 90, 6], [1630, 812, 120, 70, 7], [1760, 862, 200, 110, 8], [1915, 858, 260, 130, 9, 0.04], [2080, 860, 240, 120, 10],
  ], { x: 900, y: 680, w: 1340, h: 200 });
}

// Faceted boulders: the fox's flat-topped perch, the block below it, the big front rock.
const ROCK_PLANE = { mat: 'paper', shadow: { blur: 12 }, edge: { width: 1.2, hi: 0.3, lo: 0.25, soft: 0.6 } };

// The perch's top plane, film px (fox paws at y 706 sit in its middle).
const PERCH_TOP = [[298, 724], [330, 694], [440, 678], [560, 670], [690, 673], [790, 686], [818, 712], [760, 736], [620, 744], [470, 748], [340, 744]];

function rocks(S) {
  S.plane(960, {
    name: 'perch', x: 230, y: 630, w: 660, h: 300, ...ROCK_PLANE,
    draw(ctx) { drawBoulder(ctx, { top: PERCH_TOP, drop: 84, spread: 1.0, bulge: 24, seed: 7, pal: ROCK.perch, moss: 0.9, cracks: 4 }); },
  });
  S.plane(955, {
    name: 'perch-block', x: 650, y: 730, w: 420, h: 250, ...ROCK_PLANE,
    draw(ctx) {
      drawBoulder(ctx, { top: topOval(1000, 806, 80, 20, { seed: 12, n: 7, square: 1, rough: 0.14 }), drop: 36, spread: 1.0, bulge: 12, seed: 12, pal: ROCK.charcoal, moss: 0.3, cracks: 1 });
      drawBoulder(ctx, { top: topOval(812, 786, 150, 38, { seed: 8, tilt: -0.04, n: 8, square: 0.9, rough: 0.12 }), drop: 118, spread: 1.1, bulge: 30, seed: 8, pal: ROCK.charcoal, moss: 0.5 });
    },
  });
  S.plane(780, {
    name: 'front-rock', x: 530, y: 850, w: 560, h: 350, ...ROCK_PLANE,
    draw(ctx) { drawBoulder(ctx, { top: topOval(796, 910, 340, 50, { seed: 9, tilt: 0.04, n: 10, square: 0.85, rough: 0.1 }), drop: 215, spread: 1.08, bulge: 38, seed: 9, pal: ROCK.charcoal, moss: 0.55, cracks: 4 }); },
  });
}

// The night-lake preset, made lusher and opened up so the perch's left end shows.
const RED = { astilbe: { florets: ['#d8304a', '#e4444e', '#ee5a56', '#f47264'], light: '#ffb090' } };
const SERR = { count: 8, depth: 0.14 };

function bedRows() {
  const rows = FLOWER_BEDS['night-lake'].rows.map((r) => r.map((it) => ({ ...it })));
  rows[0][0].edge = [[0, 575], [170, 592], [250, 668], [292, 760], [370, 806], [480, 816], [580, 826], [690, 852], [760, 940]];
  rows[1] = rows[1].filter((it) => !(it.type === 'shrub' && it.seed === 49));
  for (const it of rows[1]) if (it.type === 'undergrowth') it.edge = [[0, 650], [180, 668], [300, 772], [400, 812], [480, 828], [720, 870]];
  rows[1].push(
    { type: 'astilbe', x: 112, y: 900, h: 290, w: 72, lean: -0.1, plume: 0.45, seed: 101 },
    { type: 'tansy', base: [300, 940], head: [312, 792], r: 15, seed: 103 },
    { type: 'daisy', base: [100, 930], head: [92, 790], r: 24, rot: 0.5, seed: 108 },
    { type: 'leaf', x: 520, y: 885, len: 135, width: 0.24, rot: -0.25, tone: '#c4bc3a', serrate: SERR, seed: 104 },
    { type: 'leaf', x: 705, y: 905, len: 120, width: 0.24, rot: -0.4, tone: '#b4b432', serrate: SERR, seed: 105 },
    { type: 'leaf', x: 745, y: 915, len: 105, width: 0.22, rot: 0.45, tone: '#a8b032', serrate: SERR, seed: 106 },
    { type: 'tuft', x: 585, y: 905, n: 7, len: 120, spread: 1, tones: ['lime', 'light', 'mid'], seed: 107 },
  );
  rows[2].push(
    { type: 'tansy', base: [365, 1010], head: [356, 838], r: 18, seed: 110 },
    { type: 'blade', x: 90, y: 1110, len: 290, width: 0.12, rot: 0.08, curl: 0.05, tone: 'light', seed: 112 },
  );
  rows[3].push({ type: 'tansy', base: [455, 1100], head: [462, 1000], r: 18, seed: 113 });
  for (const it of rows[4]) if (it.type === 'leaf' && it.seed === 38) Object.assign(it, { tone: '#9c9832', speckle: 1 });
  return rows;
}

// Red astilbe and lime grass right of the front rock, before the river rocks.
const RIGHT_BED = [
  [{ type: 'undergrowth', x0: 960, x1: 1270, y: 1100, h: 150, density: 1.3, tones: ['lime', 'light', 'mid'], stems: 0.3, seed: 201 }],
  [
    { type: 'tuft', x: 1010, y: 1100, n: 7, len: 170, spread: 1, tones: ['lime', 'light', 'mid'], seed: 202 },
    { type: 'tuft', x: 1190, y: 1100, n: 6, len: 150, spread: 0.9, tones: ['lime', 'light'], seed: 203 },
    { type: 'astilbe', x: 1035, y: 1090, h: 140, w: 40, plume: 0.5, palette: RED, seed: 204 },
    { type: 'astilbe', x: 1072, y: 1090, h: 185, w: 52, lean: -0.03, plume: 0.5, palette: RED, seed: 205 },
    { type: 'astilbe', x: 1112, y: 1090, h: 160, w: 46, lean: 0.04, plume: 0.5, palette: RED, seed: 206 },
    { type: 'astilbe', x: 1150, y: 1090, h: 125, w: 38, plume: 0.5, palette: RED, seed: 207 },
    { type: 'tansy', base: [1210, 1100], head: [1214, 992], r: 13, seed: 208 },
  ],
];

export function buildNear(S, tag) {
  leftTrees(S);
  rocks(S);
  shrubs(S);
  tag(['fg'], () => {
    addFlowerBed(S, { preset: 'night-lake', rows: bedRows(), z: 480 });
    addFlowerBed(S, { rows: RIGHT_BED, palette: 'night', z: 700 });
  });
}
