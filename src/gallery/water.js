// Water test sheet, three 2 s segments at the references' own positions and scale:
//   0-2 s  ref02  moonlit lake with its reflection column, the river and its ledge
//   2-4 s  ref04  tall canyon waterfall, rapids and the wide river
//   4-6 s  ref10  dawn waterfall arcing over a rock into the river, gold lake
// Rocks, banks, trees and sky are simple stand-ins; the water is the subject.

import { Scene, W, H } from '../core/stage.js';
import { RNG } from '../core/rng.js';
import { piece, linear, glow } from '../core/piece.js';
import { ridge, closeDown, ellipse, blob } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { vary, mix } from '../core/color.js';
import { WATER, addLake, addRiver, addWaterfall, addRapids, addEddies, addRipples } from '../elements/water.js';

const SEG = 2;
const gate = (k) => (t) => (Math.min(2, Math.floor(t / SEG)) === k ? 1 : 0);

// --- stand-ins ----------------------------------------------------------------------

function firs(ctx, list, rng, colors) {
  for (const [x, base, h] of list) {
    const w = h * 0.36;
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const k0 = i / tiers;
      const ty = base - h + h * k0 * 0.85;
      const tw = w * (0.35 + 0.65 * (i + 1) / tiers);
      piece(ctx, [[x, ty], [x + tw, ty + h * 0.32], [x - tw, ty + h * 0.32]], { fill: vary(rng.pick(colors), rng, 0.06), torn: { amp: 1.2, freq: 0.3, seed: rng.int(1, 1e5) }, shadow: { color: 'rgba(0,0,0,0.35)', blur: 3, y: 2 } });
    }
  }
}

function rock(ctx, cx, cy, rx, ry, rng, tone = '#3f3a3c', lit = '#6b6566') {
  const outline = blob(cx, cy, rx, ry, rng, { n: 9, irregular: 0.18 });
  outline.forEach((p) => { if (p[1] > cy) p[1] = cy + (p[1] - cy) * 0.55; });
  piece(ctx, outline, { fill: tone, shadow: { color: 'rgba(0,0,0,0.5)', blur: 6, y: 4 } });
  const top = outline.filter((p) => p[1] < cy + ry * 0.1);
  for (let i = 0; i < top.length - 1; i++) {
    const a = top[i], b = top[i + 1];
    const mid = [cx + rng.range(-rx, rx) * 0.3, cy + rng.range(-ry, ry) * 0.15];
    piece(ctx, [a, b, mid], { fill: vary(i % 2 ? lit : mix(tone, lit, 0.5), rng, 0.06), alpha: 0.9 });
  }
}

// Where a stand-in rock meets the water, as addRapids wants it.
const waterline = ([x, y, rx, ry]) => ({ x, y: y + ry * 0.3, rx: rx * 0.9, ry: ry * 0.32 });

function sky(S, k, top, bottom) {
  S.plane(20000, {
    name: 'sky', x: -240, y: -240, w: W + 480, h: H + 480, res: 0.5, mat: 'sky', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = linear(ctx, 0, 0, 0, H, [top, bottom]);
      ctx.fillRect(-240, -240, W + 480, H + 480);
      if (k !== 2) flecks(ctx, -240, -240, W + 480, H * 0.7, 700, 5 + k, { max: 1.1 });
    },
  }, { alpha: gate(k) });
}

function hills(S, k, z, baseY, amp, fill, seed, name = 'hills') {
  S.plane(z, {
    name, x: -240, y: baseY - amp * 2.5, w: W + 480, h: H - baseY + amp * 2.5 + 240, res: 0.5, mat: 'paper', shadow: { blur: 10 },
    draw(ctx) { piece(ctx, closeDown(ridge(-240, W + 240, baseY, { amp, freq: 0.004, sharp: 0.4, seed, step: 10 }), H + 240), { fill, torn: { amp: 1.4, seed } }); },
  }, { alpha: gate(k) });
}

function decor(S, k, z, name, box, draw, res = 1) {
  S.plane(z, { name, ...box, mat: 'paper', res, shadow: { blur: 10 }, draw }, { alpha: gate(k) });
}

// --- segment 0: ref02 night lake and river ----------------------------------------------

function nightLake(S) {
  const k = 0, pal = WATER.night;
  sky(S, k, '#141a40', '#2a3270');
  S.add({ name: 'moonglow', z: 14000, blend: 'lighter', alpha: gate(k), render(ctx) { glow(ctx, 1490, 190, 380, '#ffe9b0', 0.3); } });
  S.plane(14000, { name: 'moon', x: 1360, y: 60, w: 260, h: 260, mat: 'crumpled', draw(ctx) { piece(ctx, ellipse(1490, 190, 115, 115, 64), { fill: '#f6e3a8' }); } }, { alpha: gate(k) });
  hills(S, k, 3200, 520, 60, '#5d6aa0', 11, 'mtn');
  hills(S, k, 2200, 575, 40, '#3c6a52', 12);
  // Far shore: dark forest along the horizon line of the lake.
  decor(S, k, 1700, 'far-forest', { x: 1000, y: 460, w: 1160, h: 160 }, (ctx) => {
    const rng = new RNG('ff');
    piece(ctx, [[1000, 585], [1080, 560], [1250, 572], [1500, 566], [1720, 555], [2160, 545], [2160, 600], [1000, 600]], { fill: '#1f4a3c' });
    const list = [];
    for (let x = 1010; x < 1230; x += rng.range(12, 22)) list.push([x, rng.range(588, 600), rng.range(40, 70)]);
    for (let x = 1720; x < 2150; x += rng.range(14, 24)) list.push([x, rng.range(560, 580), rng.range(50, 90)]);
    firs(ctx, list, rng, ['#1d4a3a', '#24553f', '#183f33']);
  });
  addLake(S, {
    z: 1500, x0: 1000, x1: 2160, top: 582, bottom: 800, palette: WATER.nightLake, seed: 'n-lake', alpha: gate(k),
    shore: { height: 18, ranges: [[1000, 1250], [1700, 2160]] }, light: { x: 1478, width: 140, widthBottom: 90, bottom: 760, count: 40 },
  });
  // Forested shores: a peninsula between lake and river on the left, trees on the right.
  decor(S, k, 1260, 'near-trees', { x: 900, y: 520, w: 1260, h: 360 }, (ctx) => {
    const rng = new RNG('nt');
    piece(ctx, [[930, 640], [1100, 650], [1300, 700], [1420, 760], [1300, 772], [1100, 768], [930, 790]], { fill: '#24472c' });
    piece(ctx, [[1440, 800], [1480, 772], [1700, 760], [2160, 750], [2160, 880], [1440, 880]], { fill: '#2e5a2c' });
    const list = [];
    for (let x = 940; x < 1400; x += rng.range(18, 32)) list.push([x, rng.range(745, 775) - Math.max(0, 1200 - x) * 0.12, rng.range(70, 130)]);
    for (let x = 1530; x < 2140; x += rng.range(26, 46)) list.push([x, rng.range(775, 800), rng.range(80, 150)]);
    firs(ctx, list, rng, ['#1f4d33', '#2a5e3a', '#3d7040', '#173f2e']);
  });
  const river = addRiver(S, {
    z: 1300, palette: pal, seed: 'n-river', alpha: gate(k), speed: 30, texH: 200, align: 'along',
    path: [[1440, 778], [1300, 788], [1150, 802], [1030, 828], [985, 868], [1030, 900], [1200, 885], [1420, 875], [1660, 880], [1900, 872], [2160, 868]],
    width: [60, 110, 150, 170, 165, 150, 130, 120, 120, 120, 120],
  });
  // The ledge: small falls between the rocks, then the wide lower river.
  addRiver(S, {
    z: 1240, palette: pal, seed: 'n-river2', alpha: gate(k), speed: 34, texH: 240,
    path: [[1150, 955], [1400, 990], [1650, 1030], [1900, 1070], [2160, 1100]],
    width: [150, 300, 380, 440, 480], blend: [90, 0],
  });
  addWaterfall(S, { z: 1230, palette: pal, seed: 'n-ledge1', alpha: gate(k), x: 1252, top: 872, bottom: 935, width: 115, round: 16, bandWidth: 8, speed: 70, accel: 0.3, mist: { strength: 0.18 }, foam: { size: 0.5, count: 12, flat: 0.42 } });
  addWaterfall(S, { z: 1230, palette: pal, seed: 'n-ledge2', alpha: gate(k), x: 1573, top: 880, bottom: 945, width: 185, round: 18, bandWidth: 8, speed: 70, accel: 0.3, mist: { strength: 0.18 }, foam: { size: 0.5, count: 16, flat: 0.42 } });
  const rocks = [[1097, 905, 98, 50], [1384, 828, 75, 28], [1544, 850, 86, 28], [1395, 900, 86, 36], [1751, 918, 86, 36], [1349, 990, 86, 42], [1532, 1030, 98, 48], [1880, 945, 70, 40]];
  addRapids(S, { z: 1210, zFront: 1150, palette: pal, alpha: gate(k), seed: 'n-rapids', angle: 0.25, rocks: [5, 6, 7].map((i) => waterline(rocks[i])) });
  decor(S, k, 1180, 'rocks', { x: 900, y: 760, w: 1300, h: 340 }, (ctx) => {
    const rng = new RNG('nr');
    for (const r of rocks) rock(ctx, ...r, rng);
  }, 1);
  // Foreground bank on the left of the river.
  decor(S, k, 1000, 'bank', { x: 700, y: 700, w: 520, h: 400 }, (ctx) => {
    piece(ctx, [[700, 760], [930, 780], [1000, 860], [980, 960], [1120, 1100], [700, 1100]], { fill: '#4a6a28', torn: { amp: 3, seed: 2 } });
  });
  return river;
}

// --- segment 1: ref04 canyon waterfall and rapids ----------------------------------------

function canyon(S) {
  const k = 1, pal = WATER.canyon;
  sky(S, k, '#121a44', '#2c2f6c');
  hills(S, k, 3600, 470, 90, '#5a5d9a', 21, 'mtn');
  hills(S, k, 2400, 560, 40, '#2c4a4a', 22);
  addLake(S, {
    z: 1800, x0: 1380, x1: 1640, top: 545, bottom: 640, palette: pal, seed: 'c-lake', alpha: gate(k), scale: 0.7,
    shape: [[1430, 545], [1560, 545], [1640, 640], [1380, 640]], light: { x: 1500, width: 40, widthBottom: 50, count: 16 },
  });
  // Cliffs behind the fall.
  decor(S, k, 1350, 'cliff', { x: 560, y: 300, w: 560, h: 420 }, (ctx) => {
    const rng = new RNG('cl');
    piece(ctx, [[590, 330], [720, 345], [1040, 345], [1060, 700], [600, 700]], { fill: '#4a4548' });
    for (let i = 0; i < 14; i++) {
      const x = rng.range(600, 1040), y = rng.range(360, 640);
      piece(ctx, [[x, y], [x + rng.range(20, 50), y + rng.range(-10, 10)], [x + rng.range(10, 40), y + rng.range(60, 160)], [x - rng.range(0, 20), y + rng.range(50, 140)]], { fill: vary(rng.pick(['#5c5658', '#3a3638', '#6a6466']), rng, 0.05), alpha: 0.9 });
    }
    piece(ctx, [[580, 325], [1050, 338], [1050, 352], [580, 345]], { fill: '#6e8a2e' });
  });
  addWaterfall(S, {
    z: 1320, palette: pal, seed: 'c-fall', alpha: gate(k), speed: 130,
    path: [[712, 352], [738, 368], [752, 410], [766, 480], [790, 572]], width: [80, 88, 96, 106, 114],
    foam: { w: 240, h: 60, size: 1.05, count: 12 }, mist: { strength: 0.3 },
  });
  const river = addRiver(S, {
    z: 1280, palette: pal, seed: 'c-river', alpha: gate(k), speed: 34, texH: 300,
    path: [[1500, 620], [1430, 680], [1330, 750], [1260, 840], [1280, 960], [1360, 1130]], blend: [60, 0],
    width: [60, 130, 290, 470, 640, 760],
    swirls: [{ x: 1400, y: 820, r: 80 }, { x: 1560, y: 960, r: 110 }, { x: 1170, y: 985, r: 70, spin: 2 }],
  });
  addEddies(S, { z: 1275, palette: pal, alpha: gate(k), seed: 'c-eddy', eddies: [{ x: 1345, y: 905, r: 60 }] });
  addWaterfall(S, { z: 1270, palette: pal, seed: 'c-small1', alpha: gate(k), x: 1000, top: 700, bottom: 770, width: 76, round: 14, bandWidth: 11, speed: 90, accel: 0.4, foam: { w: 130, h: 40 } });
  addWaterfall(S, { z: 1270, palette: pal, seed: 'c-small2', alpha: gate(k), x: 1170, top: 685, bottom: 755, width: 70, round: 14, bandWidth: 11, speed: 90, accel: 0.4, foam: { w: 110, h: 36 } });
  const rocks = [[1065, 735, 75, 60], [1260, 720, 60, 45], [1180, 880, 90, 55], [1440, 880, 85, 50], [1300, 1025, 70, 40], [1700, 860, 120, 70]];
  addRapids(S, { z: 1265, zFront: 1200, palette: pal, alpha: gate(k), seed: 'c-rapids', rocks: [2, 3, 4].map((i) => waterline(rocks[i])) });
  decor(S, k, 1220, 'rocks', { x: 900, y: 600, w: 1100, h: 500 }, (ctx) => {
    const rng = new RNG('cr');
    for (const r of rocks) rock(ctx, ...r, rng, '#36323a', '#5e5862');
  });
  decor(S, k, 1000, 'bank', { x: 300, y: 560, w: 760, h: 540 }, (ctx) => {
    const rng = new RNG('cb');
    piece(ctx, [[300, 690], [800, 680], [930, 760], [1010, 1100], [300, 1100]], { fill: '#5a5250', torn: { amp: 2, seed: 4 } });
    firs(ctx, [[820, 700, 120], [880, 720, 110], [940, 760, 100]], rng, ['#1f4d33', '#2a5e3a']);
  });
  return river;
}

// --- segment 2: ref10 dawn waterfall -----------------------------------------------------------

function dawn(S) {
  const k = 2, pal = WATER.dawn;
  sky(S, k, '#9fb4d0', '#f2c27a');
  hills(S, k, 3400, 470, 80, '#8f86b4', 31, 'mtn');
  hills(S, k, 2300, 560, 40, '#8aa044', 32);
  addLake(S, {
    z: 1600, x0: 1100, x1: 2160, top: 585, bottom: 760, palette: pal, seed: 'd-lake', alpha: gate(k),
    shore: { height: 12, alpha: 0.5 }, light: { x: 1470, width: 120, widthBottom: 90, count: 30 },
  });
  decor(S, k, 1500, 'far-isle', { x: 1100, y: 540, w: 1060, h: 140 }, (ctx) => {
    const rng = new RNG('fi');
    piece(ctx, [[1160, 640], [1220, 625], [1420, 630], [1440, 645]], { fill: '#56622e' });
    firs(ctx, Array.from({ length: 14 }, (_, i) => [1180 + i * 17, 636, rng.range(30, 60)]), rng, ['#2b5a3a', '#3a6a40']);
    piece(ctx, [[1600, 620], [1800, 600], [2160, 595], [2160, 640], [1600, 640]], { fill: '#3e5a30' });
  });
  const river = addRiver(S, {
    z: 1350, palette: pal, seed: 'd-river', alpha: gate(k), speed: 28, texH: 230,
    path: [[1550, 725], [1470, 795], [1440, 860], [1330, 925], [1170, 990], [1040, 1100]],
    width: [150, 210, 250, 290, 340, 400], sheen: { v: 0.5, width: 0.45, amount: 0.65 }, blend: [110, 0],
  });
  decor(S, k, 1300, 'rocks', { x: 720, y: 600, w: 1400, h: 500 }, (ctx) => {
    const rng = new RNG('dr');
    rock(ctx, 860, 760, 150, 110, rng, '#6a5448', '#a08672');
    rock(ctx, 1110, 790, 120, 70, rng, '#6a5448', '#a08672');
    rock(ctx, 1640, 880, 90, 40, rng, '#5e4c44', '#9a7e6a');
    rock(ctx, 1780, 910, 110, 45, rng, '#5e4c44', '#9a7e6a');
    rock(ctx, 1230, 860, 80, 30, rng, '#5e4c44', '#9a7e6a');
  });
  addWaterfall(S, {
    z: 1280, palette: pal, seed: 'd-fall', alpha: gate(k), speed: 110,
    path: [[905, 745], [960, 770], [990, 840], [1005, 915]], width: [96, 104, 112, 118],
    foam: { w: 200, h: 52, size: 1.1, count: 11 }, mist: { strength: 0.35, color: '#fff6e6' },
  });
  // Swatch: the cave-pool palette with spreading ripples and a gold reflection (ref06).
  addLake(S, {
    z: 1100, x0: 80, x1: 560, top: 880, bottom: 1040, shape: ellipse(320, 960, 240, 80, 48), palette: WATER.cave, seed: 'd-pool', alpha: gate(k),
    light: { x: 330, width: 46, widthBottom: 70, count: 14, glow: 0.5 },
  });
  addRipples(S, { z: 1100, order: 0.1, x: 360, y: 985, rx: 130, ry: 36, palette: WATER.cave, color: WATER.cave.glow[1], alpha: gate(k) });
  decor(S, k, 1000, 'bank', { x: 600, y: 860, w: 700, h: 240 }, (ctx) => {
    const rng = new RNG('db');
    rock(ctx, 920, 1010, 160, 70, rng, '#6a5448', '#a08672');
    piece(ctx, [[600, 900], [800, 920], [860, 1100], [600, 1100]], { fill: '#8a9a34', torn: { amp: 3, seed: 7 } });
  }, 1);
}

export default function () {
  return new Scene({
    id: 'water',
    duration: 6,
    background: '#141a3a',
    light: [0.55, -0.83],
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.3, threshold: 0.66, vignette: 0.22, grain: 0.04 },
    build(S) {
      nightLake(S);
      canyon(S);
      dawn(S);
    },
  });
}
