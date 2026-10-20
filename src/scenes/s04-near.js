// s04 near: the river with its rapids and boulders, the grassy slope under the big
// spruces on the left, the stone ledge path the fox walks along, the spruces at the
// foot of the falls and the dark rocks closing the bottom of the frame.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf } from '../core/piece.js';
import { blob } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { vary } from '../core/color.js';
import { addRiver, addLake, addWaterfall, addRapids, addReflection, addMist, WATER } from '../elements/water.js';
import { addFoamBands, addFlowStrips } from './s04-water.js';

// ref04 river: bright saturated azure cut in long curving strips, long white swirl strips
// on top, the white bands of foam hugging the rocks.
const RIVER_PAL = { ...WATER.canyon, deep: '#1864c8', base: '#2a7ad8', mid: '#4a98e8', light: '#7cbaf2', pale: '#b8dcf8', shadow: '#06204a' };
const RIVER_TIERS = [
  { cols: ['deep', 'base', 'base'], cover: 1.1, len: [280, 680], th: [11, 22], bow: [-2.2, 2.2], hi: 0.12 },
  { cols: ['base', 'mid', 'mid'], cover: 0.75, len: [200, 520], th: [7, 14], bow: [-2.8, 2.8], hi: 0.22 },
  { cols: ['mid', 'light'], cover: 0.36, len: [140, 380], th: [4, 9], bow: [-3.2, 3.2], hi: 0.3 },
  { cols: ['pale', 'foam'], cover: 0.1, len: [100, 280], th: [2.5, 5], bow: [-3.6, 3.6], rim: true, hi: 0.4 },
];
const POOL = [[918, 676], [1000, 664], [1120, 660], [1260, 664], [1400, 676], [1500, 700], [1510, 840], [910, 840]];
import { addFlowerBed } from '../elements/flora.js';

// Charcoal river boulders of ref04: near-black sides, cool grey lit tops, gold specks.
const BOULDER = {
  ramp: ['#070609', '#0f0d11', '#18151a', '#241f26', '#3a343c', '#58515a'], fleck: '#c9aa62',
  moss: ['#4a4a1a', '#6a6a20', '#94902e'],
};
import { addBoulders, drawBoulder, brush } from '../elements/terrain.js';
import { addHeroConifer, bigTrunk, BARK } from '../elements/trees.js';
import { LIGHT, MOSS, drawCanyonWall, drawMossMat, yAt } from './s04-kit.js';
import { spruces } from './s04-canyon.js';

// The ledge path: far (back) and near (front) edges of its walkable top, left to right.
export const LEDGE_BACK = [[330, 748], [470, 716], [560, 700], [650, 686], [740, 676], [820, 675], [880, 682], [944, 702]];
export const LEDGE_FRONT = [[330, 806], [400, 814], [480, 816], [580, 804], [680, 786], [780, 766], [870, 744], [944, 712]];
// Where the fox's paws meet the path (it climbs gently to the right).
export const ledgeY = (x) => 732 - 0.16 * (x - 640);

// Warm grey-brown rock of the ledge and the near rocks (ref04 ledge face).
const LEDGE_ROCK = {
  crack: '#161011', deep: '#2a2220', side: '#3e3431', mid: '#4e433e', face: '#5e524b', lit: '#86766a', hi: '#a28f7e', fleck: '#cbb06a',
};
// Warm taupe flagstones of the ref04 path, lit edges catching the moon.
const PATH_STONES = ['#94806e', '#a08a76', '#ac957f', '#8a7766', '#b59e86', '#7e6c5e'];
// The stepped blocks under the ledge lip: dark sides, warm grey-brown lit tops.
const LEDGE_BOULDER = {
  ramp: ['#141010', '#251f1d', '#3a312d', '#54483f', '#76675a', '#9c8a78'], fleck: '#cbb06a',
  moss: ['#5a6418', '#7e8a22', '#a8b02c'],
};
// The near rocks under the ledge: dark brown with warm lit tops.
const NEAR_ROCK = {
  ramp: ['#110d0c', '#201a19', '#322b28', '#4a403b', '#6a5d54', '#8e7e72'], fleck: '#cbb06a',
  moss: ['#4a4a1a', '#6a6a20', '#94902e'],
};
// Sunlit yellow-green moss heaped on the ledge's far end (ref04).
const BRIGHT_MOSS = { deep: '#3a4212', dark: '#5a6418', mid: '#7e8a22', light: '#a8b02c', hi: '#d0c636' };

// A clump of long arching fern / grass blades rising from (x, y).
function fernClump(ctx, x, y, n, len, rng, cols) {
  for (let i = 0; i < n; i++) {
    // Blades arch outward and droop at the tips, thin as cut paper slivers.
    const a = rng.range(-1.25, 1.25), h = len * rng.range(0.45, 1), w = rng.range(1.4, 2.8);
    const bx = x + rng.range(-16, 16);
    const mx = bx + Math.sin(a) * h * 0.5, my = y - Math.cos(a) * h * 0.62;
    const tx = bx + Math.sin(a) * h * 1.05, ty = y - Math.cos(a) * h * 0.62 - h * 0.08 + Math.abs(Math.sin(a)) * h * 0.42;
    piece(ctx, [[bx - w, y], [mx - w * 0.9, my], [tx, ty], [mx + w * 0.9, my], [bx + w, y]], {
      fill: vary(rng.pick(cols), rng, 0.07), shadow: { color: 'rgba(0,0,0,0.35)', blur: 2, x: 1, y: 1.5 },
      bevel: { light: LIGHT, width: 1, hi: 0.3, lo: 0.1 },
    });
  }
}

// Bright spring-green of the big left spruce (ref04 top-left).
const HERO_GREEN = { deep: '#0e3020', dark: '#1f5530', mid: '#357a3e', lit: '#5a9c4c', hi: '#8cc066', fleck: '#e0c460' };

const MAT_GRASS = [{ tex: 'fiber', amt: 0.8 }, { tex: 'crumple', amt: 0.55, scale: 0.4 }];
const MAT_LEDGE = [{ tex: 'stone', amt: 0.75 }, { tex: 'crumple', amt: 0.5, scale: 0.36 }, { tex: 'fiber', amt: 0.35 }];

// Blades of grass scattered under a top line.
function grass(ctx, top, x0, x1, depth, n, rng, cols) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rng.next() * (x1 - x0);
    const y = yAt(top, x) + 6 + Math.pow(rng.next(), 1.6) * depth;
    const h = rng.range(8, 26) * (1 + (y - yAt(top, x)) / 500), a = rng.range(-0.45, 0.45), w = rng.range(1, 2.4);
    piece(ctx, [[x - w, y], [x + Math.sin(a) * h, y - Math.cos(a) * h], [x + w, y]], { fill: vary(rng.pick(cols), rng, 0.08) });
  }
}

// Torn grass bands following a top line, stacked downward, alternating tones.
function grassBands(ctx, top, bottom, rng, tones, { gap = 46, amp = 14 } = {}) {
  const nz = noise(`bands:${rng.int(1, 1e6)}`);
  const x0 = top[0][0], x1 = top[top.length - 1][0];
  for (let k = 1, d = gap * 0.6; d < 640; k++, d += gap * rng.range(0.7, 1.3)) {
    const line = [];
    for (let x = x0; x <= x1; x += 14) line.push([x, yAt(top, x) + d + nz.fbm(x * 0.006 + k, k * 1.7, 2) * amp]);
    piece(ctx, [...line, [x1, bottom], [x0, bottom]], {
      fill: vary(tones[k % tones.length], rng, 0.05), torn: { amp: 3, freq: 0.12, fine: 1, seed: rng.int(1, 1e6), step: 3 },
      shadow: { color: 'rgba(8,14,4,0.45)', blur: 7, x: 1.5, y: -3 },
      bevel: { light: LIGHT, width: 1.4, hi: 0.22, lo: 0.1 },
    });
  }
}

// --- the grassy slope under the big spruces, left of the ledge ---
const SLOPE_TOP = [[-470, 446], [-200, 454], [0, 466], [120, 482], [230, 504], [320, 534], [400, 572], [470, 622], [530, 690], [585, 752], [625, 830], [650, 920], [660, 1420]];

export function addLeftSlope(S) {
  return S.plane(1060, {
    name: 'slope-left', x: -480, y: 400, w: 1160, h: 1030, mat: MAT_GRASS,
    edge: { width: 1.6, hi: 0.28, lo: 0.3, soft: 0.6 }, shadow: { blur: 14 },
    draw(ctx) {
      const rng = new RNG('s04-slope');
      piece(ctx, [...SLOPE_TOP, [-470, 1420]], { fill: '#3e5620' });
      ctx.save();
      ctx.clip(pathOf([...SLOPE_TOP, [-470, 1420]]));
      grassBands(ctx, SLOPE_TOP, 1430, rng, ['#64822a', '#527024', '#7a962e', '#466222', '#8a9e32']);
      grass(ctx, SLOPE_TOP, -470, 660, 520, 900, rng, ['#8f9a30', '#6e8a2a', '#a8a436', '#4f6a24', '#b8b040']);
      // Moss cushions and yellow tufts.
      for (let i = 0; i < 70; i++) {
        const x = rng.range(-460, 640), y = yAt(SLOPE_TOP, x) + rng.range(20, 420), r = rng.range(8, 22);
        piece(ctx, blob(x, y, r * 1.6, r * 0.7, rng, { n: 14, irregular: 0.45 }), {
          fill: vary(rng.pick([MOSS.light, MOSS.hi, MOSS.mid]), rng, 0.06), torn: { amp: 1.6, freq: 0.3, fine: 0.8, seed: rng.int(1, 1e6), step: 2 },
          shadow: { color: 'rgba(0,0,0,0.38)', blur: 3, x: 1, y: 2 },
        });
      }
      // The grey outcrops in the grass (ref04 film 264-425, 586-712).
      drawBoulder(ctx, { x: 352, y: 712, w: 200, h: 130, shape: 'block', palette: 'canyon', light: LIGHT, moss: 0.55, seed: 41, tilt: 0.3 });
      drawBoulder(ctx, { x: 214, y: 652, w: 110, h: 60, shape: 'round', palette: 'canyon', light: LIGHT, moss: 0.6, seed: 42 });
      drawBoulder(ctx, { x: 520, y: 780, w: 120, h: 70, shape: 'flat', palette: 'canyon', light: LIGHT, moss: 0.5, seed: 43 });
      grass(ctx, SLOPE_TOP, 150, 640, 300, 260, rng, ['#9aa232', '#7c922c', '#b4aa3a']);
      flecks(ctx, -470, 440, 1130, 980, 2600, 4411, { color: '#e4c860', max: 1.4, alpha: 0.6 });
      flecks(ctx, -470, 440, 1130, 980, 2600, 4412, { color: '#0a1404', max: 1.3, alpha: 0.4 });
      ctx.restore();
      drawMossMat(ctx, SLOPE_TOP.slice(0, 10), { thick: 20, plateau: 6, drips: 0.4, seed: 17 });
    },
  });
}

// Irregular flat slabs scattered over the path surface, far ones first so nearer slabs
// overlap them (each a low-sided flattened blob with its own bevel and contact shadow).
function flagstones(ctx, back, front, rng, n = 70) {
  const x0 = back[0][0], x1 = back[back.length - 1][0];
  const list = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + 10 + rng.next() * (x1 - x0 - 30), v = rng.range(0.06, 0.94);
    const yb = yAt(back, x), yf = yAt(front, x);
    list.push({ x, y: yb + (yf - yb) * v, depth: yf - yb });
  }
  list.sort((a, b) => a.y - b.y);
  for (const s of list) {
    const r = rng.range(30, 54) * (0.8 + 0.4 * (s.y - 670) / 140);
    const pts = blob(s.x, s.y, r, Math.min(r * 0.36, s.depth * 0.32), rng, { n: rng.int(5, 8), irregular: 0.28 });
    const path = piece(ctx, pts, {
      fill: vary(rng.pick(PATH_STONES), rng, 0.05), shadow: { color: 'rgba(12,6,4,0.5)', blur: 3, x: 0.6, y: 2 },
      bevel: { light: LIGHT, width: 1.3, hi: 0.34, lo: 0.22 },
    });
    brush(ctx, path, { angle: 0.1, amt: 0.18, seed: rng.int(1, 1e9) });
  }
}

// --- the ledge path, its rock face down to the river bank, moss on its lips ---
export function addLedge(S) {
  return S.plane(980, {
    name: 'ledge', x: 300, y: 620, w: 700, h: 660, res: 1.1, mat: MAT_LEDGE,
    edge: { width: 1.8, hi: 0.32, lo: 0.32, soft: 0.6 }, shadow: { blur: 16 },
    draw(ctx) {
      const rng = new RNG('s04-ledge');
      const front = LEDGE_FRONT.filter((p) => p[0] >= 480);
      drawCanyonWall(ctx, {
        top: front, bottom: 1270, cols: 96, lean: 0.03, palette: LEDGE_ROCK, moss: 0, cast: null, seed: 404, detail: 1,
        left: [[480, 816], [470, 900], [486, 1050], [476, 1270]], right: [[944, 712], [962, 790], [952, 900], [968, 1270]],
      });
      // Big blocks stepping down under the lip toward the river (ref04's stair of slabs).
      drawBoulder(ctx, { x: 905, y: 832, w: 132, h: 98, shape: 'block', palette: LEDGE_BOULDER, light: LIGHT, moss: 0.45, seed: 93 });
      drawBoulder(ctx, { x: 770, y: 884, w: 214, h: 124, shape: 'block', palette: LEDGE_BOULDER, light: LIGHT, moss: 0.35, seed: 92, tilt: -0.1 });
      drawBoulder(ctx, { x: 598, y: 904, w: 232, h: 104, shape: 'block', palette: LEDGE_BOULDER, light: LIGHT, moss: 0.35, seed: 91, tilt: 0.15 });
      // Top surface: grout, big warm flagstones, moss on both lips.
      piece(ctx, [...LEDGE_BACK, ...LEDGE_FRONT.slice().reverse()], {
        fill: '#4a3e38', shadow: { color: 'rgba(0,0,0,0.5)', blur: 8, x: 0, y: 4 }, bevel: { light: LIGHT, width: 1.6, hi: 0.3, lo: 0.3 },
      });
      flagstones(ctx, LEDGE_BACK, LEDGE_FRONT, rng, 64);
      flecks(ctx, 330, 670, 620, 150, 900, 4421, { color: '#e2cc98', max: 1.2, alpha: 0.5 });
      flecks(ctx, 330, 670, 620, 150, 900, 4422, { color: '#000000', max: 1.2, alpha: 0.3 });
      // A grassy bank along the back edge: olive mat, yellow tufts, grass standing on it.
      drawMossMat(ctx, LEDGE_BACK.map(([x, y]) => [x, y + 3]), { thick: 12, plateau: 14, drips: 0, seed: 18, grass: 2.2 });
      fernClump(ctx, 420, 726, 10, 34, rng, ['#8a9e2c', '#a8b23a', '#6e8a26']);
      fernClump(ctx, 610, 694, 8, 30, rng, ['#8a9e2c', '#a8b23a', '#6e8a26']);
      drawMossMat(ctx, LEDGE_FRONT.filter((p) => p[0] >= 480 && p[0] < 700).map(([x, y]) => [x, y + 2]), { thick: 18, plateau: 4, drips: 1.8, seed: 19, grass: 0.8 });
      // The far end heaped with sunlit moss spilling over the lip, back edge too.
      drawMossMat(ctx, [[660, 792], [740, 776], [800, 762], [870, 744], [944, 714]], { pal: BRIGHT_MOSS, thick: 32, plateau: 8, drips: 3, seed: 23, grass: 2 });
      drawMossMat(ctx, [[740, 682], [820, 677], [880, 684], [944, 704]], { pal: BRIGHT_MOSS, thick: 16, plateau: 14, drips: 0.4, seed: 24, grass: 2.4 });
      // The sunlit grassy bank under the path's left end, behind the daisies (ref04).
      const bank = [[330, 806], [400, 814], [480, 816], [500, 860], [470, 930], [420, 980], [330, 990]];
      piece(ctx, bank, { fill: '#6e7e22', torn: { amp: 3, freq: 0.1, fine: 1, seed: 31, step: 3 }, shadow: { color: 'rgba(0,0,0,0.45)', blur: 8, x: 1, y: 3 } });
      ctx.save();
      ctx.clip(pathOf(bank));
      grassBands(ctx, bank.slice(0, 3), 1000, rng, ['#8a9a2a', '#a4ae34', '#76882a', '#b8b83c'], { gap: 30, amp: 8 });
      grass(ctx, bank.slice(0, 3), 330, 500, 160, 160, rng, ['#b4b23a', '#9aa832', '#c8c448', '#7e922c']);
      ctx.restore();
      drawMossMat(ctx, bank.slice(0, 3), { pal: BRIGHT_MOSS, thick: 26, plateau: 4, drips: 2.2, seed: 32, grass: 1.6 });
      // Ferny grass rising in front of the blocks below the lip.
      const ferns = ['#9ab030', '#b8c040', '#7c9a2a', '#c8c848', '#6a8a26'];
      fernClump(ctx, 400, 900, 18, 80, rng, ferns);
      fernClump(ctx, 470, 940, 16, 70, rng, ferns);
      fernClump(ctx, 560, 900, 20, 70, rng, ferns);
      fernClump(ctx, 690, 870, 30, 90, rng, ferns);
      fernClump(ctx, 770, 858, 34, 100, rng, ferns);
      fernClump(ctx, 850, 832, 26, 80, rng, ferns);
      fernClump(ctx, 920, 800, 18, 64, rng, ferns);
      // A few moss patches on the stones and grass in the cracks.
      for (let i = 0; i < 6; i++) {
        const x = rng.range(360, 900), v = rng.range(0.1, 0.9);
        const y = yAt(LEDGE_BACK, x) + (yAt(LEDGE_FRONT, x) - yAt(LEDGE_BACK, x)) * v, r = rng.range(5, 12);
        piece(ctx, blob(x, y, r * 1.8, r * 0.55, rng, { n: 12, irregular: 0.5 }), {
          fill: vary(rng.pick([MOSS.mid, MOSS.light, MOSS.hi]), rng, 0.06), torn: { amp: 1.4, freq: 0.3, fine: 0.7, seed: rng.int(1, 1e6), step: 2 },
          shadow: { color: 'rgba(0,0,0,0.4)', blur: 2, x: 0.5, y: 1.5 },
        });
      }
    },
  });
}

// --- spruces at the foot of the big fall and on the river's left bank ---
export function addFallSpruces(S) {
  const row = [
    [735, 694, 118], [762, 700, 96, 'teal'], [790, 704, 140], [822, 700, 112], [852, 706, 128, 'sage'], [884, 704, 104],
    [914, 708, 132], [946, 712, 96, 'teal'], [978, 716, 112], [1010, 720, 86], [1040, 726, 78, 'teal'],
  ];
  const a = S.plane(1600, {
    name: 'fall-spruces', x: 660, y: 540, w: 460, h: 300, mat: 'paper',
    edge: { width: 1.5, hi: 0.3, lo: 0.3, soft: 0.6 }, shadow: { blur: 12 },
    draw(ctx) {
      const ground = [[680, 712], [760, 698], [860, 702], [960, 712], [1060, 724], [1100, 740]];
      spruces(ctx, row, { seed: 160 });
      piece(ctx, [...ground, [1100, 830], [680, 830]], { fill: '#13261b', shadow: { color: 'rgba(0,0,0,0.5)', blur: 8, x: 0, y: -2 } });
      drawMossMat(ctx, ground, { thick: 12, plateau: 4, drips: 0.5, seed: 21, grass: 0.8 });
    },
  });
  const bank = [[905, 892, 196], [946, 906, 172, 'teal'], [988, 918, 150], [1030, 934, 134, 'sage'], [868, 880, 150, 'teal'], [1066, 950, 110]];
  const b = S.plane(1080, {
    name: 'bank-spruces', x: 780, y: 660, w: 360, h: 400, mat: 'paper',
    edge: { width: 1.5, hi: 0.3, lo: 0.3, soft: 0.6 }, shadow: { blur: 12 },
    draw(ctx) {
      const ground = [[820, 886], [900, 890], [980, 912], [1060, 940], [1110, 960]];
      spruces(ctx, bank, { seed: 170 });
      // The bank slopes down into the water: ragged right edge instead of a straight cut.
      piece(ctx, [...ground, [1104, 990], [1080, 1020], [1050, 1060], [820, 1060]], {
        fill: '#344016', torn: { amp: 4, freq: 0.08, fine: 1.2, seed: 22, step: 3 }, shadow: { color: 'rgba(0,0,0,0.45)', blur: 6, x: 1, y: 2 },
      });
      grass(ctx, ground, 830, 1100, 60, 90, new RNG('s04-bank-grass'), ['#7c922c', '#9aa232', '#5e7a26']);
      drawMossMat(ctx, ground, { thick: 20, plateau: 6, drips: 0.8, seed: 22 });
    },
  });
  return [a, b];
}

// --- the river: far reach under the moonlit sheen, the rapids pool, the wide sweep to the viewer ---
export function addRiverSystem(S) {
  const layers = [];
  const push = (r) => { layers.push(...[r.layers ?? r].flat()); return r; };
  // The pool behind the rapids, spreading left to the foot of the falls (flat strips).
  push(addLake(S, {
    z: 1295, x0: 900, x1: 1520, top: 662, bottom: 840, palette: { ...RIVER_PAL, lake: ['#4a94e2', '#2a7ad6'] },
    shape: POOL, density: 1.2, scale: 0.8, seed: 's04-pool',
  }));
  // The river: the far reach straight toward us, fanning wide as it nears (flow stays
  // near vertical so the ribbon's width lies across the frame).
  const river = push(addRiver(S, {
    z: 1280, palette: RIVER_PAL, tiers: RIVER_TIERS, texH: 300, blend: [70, 0], speed: 40, current: 0.1,
    path: [[1494, 548], [1486, 600], [1468, 660], [1446, 730], [1440, 820], [1490, 940], [1580, 1070], [1660, 1260]],
    width: [30, 84, 196, 460, 640, 800, 980, 1120],
    seed: 's04-river',
  }));
  // Long white swirl strips sweeping over the water, open spirals where it turns.
  push(addFlowStrips(S, {
    z: 1276, palette: RIVER_PAL, seed: 's04-flow',
    regions: [
      {
        clip: river.clip, box: [850, 540, 1200, 640], y0: 556, y1: 1170, span: (y) => (y < 700 ? [1380, 1610] : [850, 2050]), density: 0.85,
        swirls: [{ x: 1300, y: 872, r: 70 }, { x: 1530, y: 972, r: 92 }, { x: 1226, y: 1024, r: 78 }, { x: 1720, y: 1014, r: 80 }],
      },
      { shape: POOL, box: [900, 650, 620, 200], y0: 668, y1: 846, span: () => [900, 1520], density: 0.9 },
    ],
  }));
  // The moon's path: a long cream-gold streak down the middle of the far reach.
  push(addReflection(S, { z: 1270, x: 1486, top: 552, bottom: 800, width: 34, widthBottom: 132, count: 42, palette: WATER.canyon, glow: 0.8, speed: 0.8 }));

  // Little falls stepping down between the rocks of the rapids (their foam is cut below).
  const small = (x, top, bottom, width, seed) => push(addWaterfall(S, {
    z: 1145, palette: WATER.canyon, seed, x, top, bottom, width, round: 12, bandWidth: 8, speed: 80, accel: 0.3,
    bands: ['pale', 'foam', 'light', 'pale', 'mid', 'foam', 'light'], streaks: 1.6,
    foam: false, mist: { strength: 0.24 },
  }));
  small(984, 696, 800, 84, 's04-fall-r1');
  small(1150, 686, 768, 92, 's04-fall-r2');
  small(1772, 790, 886, 76, 's04-fall-r3');

  // Rocks of the rapids at their ref04 places (x centre, y the waterline foot).
  const riverRocks = [
    { x: 1070, y: 786, w: 140, h: 112, shape: 'pointy', rough: 0.3, seed: 51 },
    { x: 1236, y: 764, w: 140, h: 96, shape: 'round', seed: 52 },
    { x: 1145, y: 940, w: 172, h: 92, shape: 'round', seed: 53 },
    { x: 1345, y: 936, w: 148, h: 78, shape: 'pointy', rough: 0.25, seed: 54 },
    { x: 1468, y: 828, w: 136, h: 90, shape: 'round', seed: 55 },
    { x: 1645, y: 882, w: 222, h: 108, shape: 'block', seed: 56 },
    { x: 1556, y: 840, w: 176, h: 92, shape: 'round', seed: 58 },
    { x: 1330, y: 758, w: 62, h: 40, shape: 'round', seed: 57 },
  ];
  // Dark canyon floor behind the water: fills every gap down the banks.
  layers.push(S.plane(1350, {
    name: 'canyon-floor', x: 560, y: 740, w: 1700, h: 600, mat: MAT_LEDGE, edge: false, shadow: false,
    draw(ctx) {
      const rng = new RNG('s04-floor');
      piece(ctx, [[560, 772], [1000, 762], [1300, 772], [1500, 800], [2240, 800], [2240, 1330], [560, 1330]], { fill: '#1b1c19', torn: { amp: 4, freq: 0.05, seed: 3 } });
      for (let i = 0; i < 60; i++) {
        const x = rng.range(580, 2220), y = rng.range(800, 1300), r = rng.range(14, 40);
        piece(ctx, blob(x, y, r * 1.6, r * 0.6, rng, { n: 12, irregular: 0.4 }), { fill: vary(rng.pick(['#2a2c22', '#33352a', '#3e4a1e', '#24221f']), rng, 0.05), shadow: { color: 'rgba(0,0,0,0.4)', blur: 4, x: 0, y: 2 } });
      }
    },
  }));
  layers.push(addBoulders(S, {
    z: 1150, name: 'rocks-bank-l', palette: BOULDER, light: LIGHT, moss: 0.6, res: 1,
    rocks: [
      { x: 1040, y: 1004, w: 150, h: 88, shape: 'round', seed: 82 },
      { x: 1080, y: 1084, w: 150, h: 84, shape: 'block', seed: 83 },
    ],
  }));
  layers.push(addBoulders(S, { z: 1130, name: 'rocks-river', palette: BOULDER, light: LIGHT, moss: 0.15, rocks: riverRocks }));
  push(addRapids(S, {
    z: 1135, zFront: 1125, palette: RIVER_PAL, seed: 's04-rapids', thick: 12, rings: 1, wake: false,
    rocks: riverRocks.map((r) => ({ x: r.x, y: r.y - 6, rx: r.w * 0.52, ry: r.w * 0.11 })),
  }));
  // White water: torn crescents piled at the falls' feet, bands hugging each rock's foot.
  const hug = (r, k = 1) => ({ x: r.x + 6, y: r.y - 5, w: r.w * 1.16, h: Math.max(13, Math.min(34, r.w * 0.2)) * k, bend: -r.w * 0.08 });
  push(addFoamBands(S, {
    z: 1122, seed: 's04-foam-river',
    items: [
      { x: 1004, y: 804, w: 140, h: 54, bend: 10, pile: true }, { x: 1034, y: 820, w: 200, h: 22, bend: -4 },
      { x: 1170, y: 772, w: 136, h: 50, bend: 10, pile: true }, { x: 1196, y: 786, w: 184, h: 20, bend: -4 },
      { x: 1754, y: 890, w: 140, h: 54, bend: 10, pile: true }, { x: 1732, y: 906, w: 196, h: 22, bend: -4 },
      { x: 1290, y: 934, w: 124, h: 36, bend: 6, pile: true }, { x: 1548, y: 852, w: 140, h: 36, bend: 6, pile: true },
      ...riverRocks.map((r) => hug(r)),
      { x: 1046, y: 1008, w: 170, h: 22, bend: -9 }, { x: 1086, y: 1088, w: 170, h: 22, bend: -9 },
    ],
  }));
  push(addMist(S, { z: 1120, x: 1110, y: 770, w: 420, h: 150, count: 6, strength: 0.22, seed: 's04-mist-rapids' }));
  push(addMist(S, { z: 1120, x: 1600, y: 860, w: 360, h: 120, count: 5, strength: 0.16, seed: 's04-mist-rapids-r' }));
  return layers;
}

// --- dark rocks across the bottom of the frame ---
export function addNearRocks(S) {
  const layers = [];
  layers.push(addBoulders(S, {
    z: 820, name: 'rocks-near-c', palette: NEAR_ROCK, light: LIGHT, moss: 0.55, res: 1,
    rocks: [
      { x: 880, y: 1130, w: 300, h: 190, shape: 'block', seed: 61 },
      { x: 690, y: 1062, w: 270, h: 104, shape: 'slab', tilt: 0.3, seed: 62 },
      { x: 580, y: 940, w: 200, h: 76, shape: 'slab', tilt: 0.28, seed: 64 },
    ],
  }));
  const right = [
    { x: 1700, y: 1104, w: 300, h: 164, shape: 'block', seed: 71 },
    { x: 1512, y: 1062, w: 96, h: 62, shape: 'round', seed: 72 },
    { x: 1304, y: 1104, w: 186, h: 112, shape: 'round', seed: 73 },
    { x: 2060, y: 1080, w: 280, h: 260, shape: 'block', seed: 74 },
  ];
  layers.push(addBoulders(S, { z: 860, name: 'rocks-near-r', palette: BOULDER, light: LIGHT, moss: 0.2, res: 1, rocks: right }));
  const rap = addRapids(S, {
    z: 870, zFront: 850, palette: RIVER_PAL, seed: 's04-rapids-near', thick: 13, rings: 1, wake: false,
    rocks: right.slice(0, 3).map((r) => ({ x: r.x, y: r.y - 8, rx: r.w * 0.52, ry: r.w * 0.1 })),
  });
  layers.push(...[rap].flat());
  // The white water boiling between the near rocks (ref04 bottom centre).
  layers.push(...addFoamBands(S, {
    z: 848, seed: 's04-foam-near',
    items: [
      { x: 1460, y: 1080, w: 250, h: 46, bend: 10, pile: true }, { x: 1590, y: 1096, w: 190, h: 30, bend: 4 },
      { x: 1706, y: 1110, w: 336, h: 34, bend: -14 }, { x: 1516, y: 1068, w: 116, h: 18, bend: -6 },
      { x: 1310, y: 1110, w: 214, h: 30, bend: -12 }, { x: 1200, y: 1092, w: 160, h: 26, bend: 6, pile: true },
    ],
  }));
  return layers;
}

// --- the big spruces framing the top-left corner ---
export function addHeroSpruces(S) {
  const a = addHeroConifer(S, {
    name: 'hero-far', z: 860, x: -150, y: 560, h: 1250, palette: { ...HERO_GREEN, lit: '#3f7a3e', hi: '#5f9450' }, bark: BARK.redwood,
    light: LIGHT, seed: 405, width: 0.24, sway: { amp: 0.003 },
  });
  const b = addHeroConifer(S, {
    name: 'hero-left', z: 780, x: 96, y: 500, h: 1060, palette: HERO_GREEN, bark: BARK.redwood, light: LIGHT, seed: 404, width: 0.25, tones: [0.25, 0.85],
    tierSway: { amp: 0.014 },
  });
  // The thick red trunk below the lowest whorls (ref04 film x 46-126, y 276-574).
  const c = S.plane(800, {
    name: 'hero-trunk', x: 20, y: 150, w: 160, h: 560, mat: [{ tex: 'fiber', amt: 0.9 }, { tex: 'crumple', amt: 0.4, scale: 0.4 }],
    edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.6 }, shadow: { blur: 12 },
    draw(ctx) { bigTrunk(ctx, 92, 170, 690, 74, { bark: BARK.redwood, light: LIGHT, seed: 7, flare: 0.25, rim: '#c87a48' }); },
  });
  return [a, c, b];
}

// --- the wildflowers in the bottom-left corner (ref04: two coneflowers, red astilbe,
// daisies, tansy buttons, broad dark leaves) ---
export function addFlowers(S) {
  const daisy = (bx, by, hx, hy, r) => ({ type: 'daisy', base: [bx, by], head: [hx, hy], r });
  const tansy = (bx, by, hx, hy, r) => ({ type: 'tansy', base: [bx, by], head: [hx, hy], r });
  const rows = [
    [{ type: 'backing', x0: -330, y0: 600, x1: 760, y1: 1380, anchor: 'left', density: 0.6, tones: { top: '#a4ae3c', bottom: '#2c4a1c' },
      edge: [[-330, 740], [-60, 780], [60, 810], [170, 850], [300, 905], [420, 960], [540, 1010], [660, 1060], [760, 1090]] }],
    [
      // Sunlit moss cushions and ferny grass behind the flowers (ref04's yellow-green bank).
      { type: 'moss', x: 90, y: 820, w: 300, h: 84 }, { type: 'moss', x: 330, y: 900, w: 260, h: 74 },
      { type: 'moss', x: 520, y: 1000, w: 230, h: 64 }, { type: 'moss', x: -60, y: 790, w: 240, h: 70 },
      { type: 'fern', x: 10, y: 900, len: 250, rot: -0.55 }, { type: 'fern', x: 470, y: 1010, len: 220, rot: 0.55 },
      { type: 'fern', x: 250, y: 960, len: 200, rot: 0.2 },
      { type: 'tuft', x: 230, y: 920, len: 150, n: 10 }, { type: 'tuft', x: 400, y: 990, len: 140, n: 9 }, { type: 'tuft', x: 80, y: 880, len: 130, n: 8 },
      { type: 'leaf', x: -30, y: 930, len: 250, width: 0.26, rot: -0.75, dark: 0.3 },
      { type: 'leaf', x: 40, y: 1060, len: 300, width: 0.24, rot: -0.3, dark: 0.15 },
      { type: 'leaf', x: 200, y: 1090, len: 260, width: 0.25, rot: 0.15 },
      { type: 'leaf', x: 380, y: 1100, len: 250, width: 0.27, rot: 0.42, dark: 0.2 },
      { type: 'leaf', x: 520, y: 1100, len: 220, width: 0.26, rot: 0.7 },
      { type: 'leaf', x: 600, y: 1110, len: 190, width: 0.24, rot: 0.95, dark: 0.25 },
      { type: 'tuft', x: 560, y: 1010, len: 150, n: 8 },
      { type: 'tuft', x: 470, y: 930, len: 120, n: 7 },
      { type: 'blade', x: 130, y: 1080, len: 330, rot: -0.12 },
      { type: 'blade', x: 340, y: 1090, len: 280, rot: 0.2 },
    ],
    [
      // Fat crimson plumes (ref04: one over the first coneflower, two by the trunk, a
      // dense clump at the bottom by the ledge).
      { type: 'astilbe', x: 150, y: 830, h: 200, w: 92, plume: 0.8, lean: -0.08, seed: 11 },
      { type: 'astilbe', x: 232, y: 840, h: 214, w: 96, plume: 0.8, lean: 0.07, seed: 12 },
      { type: 'astilbe', x: 172, y: 835, h: 240, w: 104, plume: 0.8, lean: -0.03, seed: 13 },
      { type: 'astilbe', x: 208, y: 835, h: 232, w: 100, plume: 0.8, lean: 0.02, seed: 14 },
      { type: 'astilbe', x: 190, y: 830, h: 262, w: 124, plume: 0.8, seed: 15 },
      { type: 'astilbe', x: 236, y: 640, h: 150, w: 72, plume: 0.8, lean: 0.05, seed: 16 },
      { type: 'astilbe', x: 166, y: 640, h: 130, w: 62, plume: 0.8, lean: -0.06, seed: 17 },
      { type: 'astilbe', x: 200, y: 640, h: 160, w: 76, plume: 0.8, seed: 18 },
      { type: 'astilbe', x: 640, y: 1110, h: 190, w: 110, plume: 0.8, lean: -0.08, seed: 21 },
      { type: 'astilbe', x: 760, y: 1110, h: 200, w: 112, plume: 0.8, lean: 0.08, seed: 22 },
      { type: 'astilbe', x: 672, y: 1110, h: 232, w: 120, plume: 0.8, lean: -0.03, seed: 23 },
      { type: 'astilbe', x: 730, y: 1110, h: 236, w: 120, plume: 0.8, lean: 0.04, seed: 24 },
      { type: 'astilbe', x: 700, y: 1110, h: 256, w: 140, plume: 0.8, seed: 25 },
      daisy(150, 640, 150, 548, 12), daisy(175, 640, 186, 566, 11), daisy(130, 650, 122, 580, 10),
      daisy(205, 650, 214, 560, 10), daisy(110, 655, 96, 596, 9),
      daisy(300, 930, 262, 748, 22), daisy(320, 930, 300, 766, 20), daisy(330, 940, 338, 794, 19),
      daisy(300, 950, 282, 806, 17), daisy(350, 950, 362, 828, 18), daisy(280, 940, 238, 724, 18),
      daisy(380, 960, 396, 846, 16), daisy(260, 950, 228, 790, 15), daisy(340, 950, 318, 736, 16),
      daisy(370, 960, 376, 772, 14), daisy(400, 970, 420, 806, 13), daisy(250, 950, 212, 750, 13),
      daisy(240, 930, 196, 790, 15), daisy(380, 960, 430, 770, 15), daisy(420, 980, 456, 846, 14),
      daisy(300, 950, 350, 712, 14), daisy(270, 940, 262, 700, 13), daisy(230, 950, 186, 836, 13),
      tansy(460, 1110, 444, 950, 22), tansy(486, 1110, 520, 884, 18), tansy(440, 1110, 410, 880, 20),
      tansy(500, 1110, 484, 1022, 20), tansy(420, 1110, 380, 1010, 17),
      tansy(520, 1110, 560, 930, 20), tansy(470, 1110, 470, 856, 19), tansy(540, 1110, 592, 1004, 18), tansy(400, 1110, 352, 958, 18),
    ],
    [
      { type: 'echinacea', base: [150, 1110], head: [104, 792], size: 104 },
      { type: 'echinacea', base: [300, 1130], head: [266, 906], size: 98 },
    ],
  ];
  // Hot magenta-pink coneflowers and coral-crimson astilbe, as saturated as ref04's.
  const palette = {
    echinacea: { petals: ['#a82a8a', '#c8389c', '#e24aa8', '#f060ae', '#fa7cb6'], petalDark: '#7a1060', petalLight: '#ffb2d2' },
    astilbe: { florets: ['#d41a3a', '#e62c48', '#f04458', '#fa6266'], light: '#ffa48c', dark: '#7a0a22' },
  };
  return addFlowerBed(S, { rows, palette, z: 480, planes: 2, light: LIGHT, wind: { amp: 0.04 } });
}
