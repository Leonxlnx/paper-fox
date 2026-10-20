// Foreground of s10: the flower bank framing the bottom-left corner (magenta coneflowers,
// cream daisies, red astilbe, yellow tansy among dark leaves and lime foliage) and the
// boulders and gold grass at the bottom edge by the river.

import { RNG } from '../core/rng.js';
import { addFlowerBed } from '../elements/flora.js';
import { drawBoulders } from '../elements/terrain.js';
import { drawTuft } from '../elements/flora.js';
import { RIVER_STONE } from './s10-water.js';
import { LIGHT, OVER } from './s10-layout.js';

// Cream daisy heads traced on the reference: [x, y, r].
const DAISIES = [
  [16, 664, 24], [72, 674, 25], [126, 706, 24], [22, 726, 23],
  [306, 766, 24], [346, 796, 23], [410, 830, 25], [456, 874, 24],
  [632, 914, 25], [580, 956, 25], [690, 950, 24], [632, 996, 26], [712, 1004, 24],
];
const TANSIES = [[258, 712, 22], [495, 923, 23], [537, 985, 19], [452, 950, 15], [810, 1010, 12]];

function daisy([x, y, r], i) {
  return { type: 'daisy', base: [x - 10 + (i % 3) * 8, 1130], head: [x, y], r, petals: 8, rot: (i * 0.37) % 0.6 - 0.3, seed: 200 + i };
}

function tansy([x, y, r], i) {
  return { type: 'tansy', base: [x + 6, 1130], head: [x, y], r, seed: 300 + i };
}

export function buildFlowers(S) {
  const rows = [
    // Shadow sheet of leaves behind everything, open toward the rock and the river; it
    // stays below the rock's left shoulder so the fox's tail tip shows draped over it.
    [{ type: 'backing', x0: -OVER, y0: 600, x1: 900, y1: 1400, anchor: 'left',
      edge: [[-OVER, 560], [0, 560], [150, 604], [236, 668], [290, 726], [400, 760], [520, 784], [640, 796], [740, 822], [820, 880], [900, 1000]], seed: 1 }],
    // Tall pieces at the back: the left astilbe, long dark blades, lime foliage by the rock.
    [
      { type: 'astilbe', x: 200, y: 1060, h: 520, w: 120, plume: 0.36, lean: -0.04, seed: 11 },
      { type: 'blade', x: 300, y: 1120, len: 470, width: 0.07, rot: 0.75, curl: 0.12, color: 'dark', seed: 12 },
      { type: 'blade', x: 120, y: 1120, len: 420, width: 0.08, rot: 0.32, curl: 0.15, color: 'mid', seed: 13 },
      { type: 'blade', x: 20, y: 1100, len: 480, width: 0.09, rot: -0.15, curl: -0.1, color: 'dark', seed: 14 },
      { type: 'leaf', x: 650, y: 980, len: 150, width: 0.32, rot: 0.2, serrate: { count: 7, depth: 0.12 }, color: '#b8b03a', seed: 15 },
      { type: 'leaf', x: 720, y: 960, len: 170, width: 0.3, rot: 0.75, serrate: { count: 7, depth: 0.12 }, color: '#c8b83c', seed: 16 },
      { type: 'leaf', x: 780, y: 990, len: 140, width: 0.3, rot: 1.1, serrate: { count: 6, depth: 0.12 }, color: '#a8a436', seed: 17 },
      { type: 'leaf', x: 600, y: 990, len: 160, width: 0.3, rot: -0.35, serrate: { count: 7, depth: 0.12 }, color: '#9c9c34', seed: 18 },
      { type: 'tuft', x: 860, y: 1050, n: 8, len: 160, lean: 0.3, tones: ['#c8b040', '#a89a34', '#e0c450'], seed: 19 },
    ],
    // Upper flowers: the big coneflower, the high daisies and tansy.
    [
      { type: 'echinacea', base: [150, 1160], head: [180, 768], size: 150, petals: 9, seed: 21 },
      ...DAISIES.slice(0, 6).map(daisy),
      tansy(TANSIES[0], 0),
      { type: 'blade', x: 470, y: 1130, len: 400, width: 0.08, rot: 0.55, curl: 0.15, color: 'mid', seed: 22 },
      { type: 'leaf', x: 380, y: 1100, len: 300, width: 0.16, rot: 0.42, color: 'dark', seed: 23 },
    ],
    // Lower flowers: the second astilbe, the low coneflower, more daisies and tansy.
    [
      { type: 'astilbe', x: 562, y: 1120, h: 360, w: 120, plume: 0.55, lean: 0.03, seed: 31 },
      ...DAISIES.slice(6).map((d, i) => daisy(d, i + 6)),
      ...TANSIES.slice(1).map((d, i) => tansy(d, i + 1)),
      { type: 'echinacea', base: [320, 1170], head: [335, 908], size: 124, petals: 8, seed: 32 },
    ],
    // Front blades and leaves crossing the bottom edge.
    [
      { type: 'leaf', x: 30, y: 1140, len: 280, width: 0.17, rot: 0.12, color: 'mid', seed: 41 },
      { type: 'leaf', x: 230, y: 1150, len: 240, width: 0.15, rot: -0.3, color: 'dark', seed: 42 },
      { type: 'blade', x: 120, y: 1140, len: 260, width: 0.08, rot: 0.15, curl: 0.2, color: 'light', seed: 43 },
      { type: 'leaf', x: 740, y: 1150, len: 220, width: 0.15, rot: 0.55, color: 'dark', seed: 44 },
      { type: 'blade', x: 560, y: 1150, len: 240, width: 0.07, rot: -0.2, curl: -0.2, color: 'lime', seed: 45 },
      { type: 'blade', x: 420, y: 1150, len: 200, width: 0.07, rot: 0.3, curl: 0.2, color: 'light', seed: 46 },
    ],
  ];
  const bed = addFlowerBed(S, { palette: 'dawn', rows, z: 480, planes: 2, depth: 120, res: 1.25, wind: { amp: 0.03 } });
  for (const L of bed) L.tags = ['fg'];

  bottomRocks(S);
}

// Boulders on the near bank at the bottom edge, gold grass in front of them.
function bottomRocks(S) {
  S.plane(760, {
    name: 'bank-rocks', x: 740, y: 880, w: 900, h: 520, res: 1.25, mat: [{ tex: 'stone', amt: 1 }, { tex: 'crumple', amt: 0.6, scale: 0.32 }],
    shadow: { blur: 14 },
    draw(ctx) {
      const rng = new RNG('s10-bank');
      drawBoulders(ctx, {
        palette: RIVER_STONE, light: LIGHT, seed: 95, moss: 0.15,
        rocks: [
          { x: 880, y: 1110, w: 230, h: 170, shape: 'pointy', seed: 1 },
          { x: 1060, y: 1120, w: 150, h: 140, shape: 'round', seed: 2 },
          { x: 1220, y: 1130, w: 240, h: 150, shape: 'pointy', seed: 3 },
        ],
      });
      for (let i = 0; i < 9; i++) {
        drawTuft(ctx, { x: rng.range(800, 1500), y: rng.range(1080, 1140), n: 7, len: rng.range(90, 150), lean: rng.range(-0.3, 0.4), tones: ['#d8b844', '#b89a34', '#eccf5a'], light: LIGHT, seed: rng.int(1, 1e6) });
      }
    },
  }, { tags: ['fg'] });
}
