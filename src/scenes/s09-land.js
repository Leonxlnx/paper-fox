// Star portal (s09): everything behind the stone circle and the water around it.
// Clouds, lavender snow peaks, forest bands and hills, the big conifers framing the left
// and right, the grey cliffs with their waterfalls, the grassy rise the stones stand on,
// and the reflecting pool with its gold light column, lily pads and stones.

import { RNG, noise } from '../core/rng.js';
import { piece, linear } from '../core/piece.js';
import { TAU } from '../core/geom.js';
import { drawGlow } from '../elements/sky.js';
import { flecks } from '../core/paper.js';
import { vary, rgba } from '../core/color.js';
import { osc, lerp } from '../core/ease.js';
import { addRange, addHills, addBoulders, addCliff } from '../elements/terrain.js';
import { addForestBand, addTree, FOLIAGE } from '../elements/trees.js';
import { addLake, addReflection, addWaterfall, addFoam, WATER } from '../elements/water.js';
import { addCloud } from '../elements/clouds.js';
import { drawMossPatch } from './s09-stones.js';

const tagAll = (layers, ...tags) => {
  for (const L of [].concat(layers)) if (L) L.tags = [...(L.tags || []), ...tags];
  return layers;
};
const layersOf = (r) => (Array.isArray(r) ? r : r && r.layers ? r.layers : [r]);

// Lavender night peaks (sampled from ref09: lit #9e96d2, shade #6a64a8, snow #e8e4f4).
const LAVENDER = {
  rock: ['#3c3a76', '#534f98', '#6c68b2', '#8882c6', '#a69edb'],
  snow: ['#a29ad2', '#bab2e2', '#d2caee', '#e7e1f7', '#f8f4fc'],
  rim: '#ffffff',
  haze: '#8a86c4',
  shadow: 'rgba(20,18,60,0.5)',
};

// ---------------------------------------------------------------- sky clouds
export function addSkyClouds(S, { moon }) {
  const lightPos = [moon.x, moon.y];
  const warm = { x: moon.x, y: moon.y, r: 1100, color: '#ffe4b0', amt: 0.35 };
  const out = [];
  out.push(addCloud(S, {
    name: 's09-cloud-left', z: 8600, seed: 's09-cloud-left', palette: 'night', t0: 4.25, drift: 3,
    x: 180, y: -50, w: 620, h: 240, tiers: 3, tone: -0.3, lightPos, warm,
    profile: [[0, 0.7], [0.15, 0.95], [0.32, 1], [0.5, 0.8], [0.68, 0.5], [0.85, 0.22], [1, 0.08]],
  }));
  out.push(addCloud(S, {
    name: 's09-cloud-right', z: 9200, seed: 's09-cloud-right', palette: 'night', t0: 4.25, drift: -3,
    x: 1380, y: 60, w: 700, h: 215, tiers: 3, tone: -0.3, lightPos, warm,
    profile: [[0, 0.12], [0.18, 0.3], [0.38, 0.62], [0.55, 0.95], [0.72, 0.85], [0.88, 0.7], [1, 0.75]],
  }));
  return tagAll(out, 'sky', 'clouds');
}

// ---------------------------------------------------------------- far land
export function addFarLand(S) {
  const L = S.light;
  const out = [];
  out.push(addRange(S, {
    name: 's09-peaks', z: 5600, palette: LAVENDER, light: L, snow: 0.24, snowline: 0.6, ridge: 0.3, detail: 0.85, haze: 0.18, hazeColor: "#8c88c8",
    peaks: [
      { x: 60, y: 240, baseY: 440, left: 320, right: 220, seed: 12 },
      { x: 436, y: 156, baseY: 430, left: 300, right: 270, seed: 3 },
      { x: 1665, y: 290, baseY: 440, left: 210, right: 190, seed: 5 },
      { x: 1890, y: 282, baseY: 440, left: 170, right: 200, seed: 6 },
      { x: 2110, y: 300, baseY: 440, left: 160, right: 200, seed: 13 },
      { x: 625, y: 228, baseY: 445, left: 210, right: 200, seed: 7 },
      { x: 1424, y: 300, baseY: 450, left: 170, right: 170, seed: 8 },
      { x: 780, y: 270, baseY: 450, left: 150, right: 170, seed: 9 },
      { x: 1240, y: 322, baseY: 450, left: 160, right: 150, seed: 10 },
      { x: 1560, y: 332, baseY: 455, left: 130, right: 130, seed: 11 },
    ],
  }));
  out.push(addForestBand(S, {
    name: 's09-forest-far', z: 3000, x0: -280, x1: 2200, seed: 91, light: L,
    base: [[-280, 470], [300, 468], [620, 478], [900, 470], [1200, 452], [1500, 428], [1800, 425], [2200, 440]],
    heights: [36, 84], rows: 3, density: 1.25, colors: [FOLIAGE.forest, FOLIAGE.blue], weights: [3, 2],
    haze: '#4a5688', hazeAmt: [0.55, 0.18], gaps: 0.78, midMin: 999,
  }));
  out.push(addHills(S, {
    name: 's09-hills', z: 2500, palette: 'forest', light: L, strips: 5, crest: 6, shadeAmt: 0.5, haze: 0.15,
    hills: [
      { x0: 1280, x1: 2300, y: 372, baseY: 500, peakX: 1760, round: 1.25, seed: 4 },
      { x0: 380, x1: 1000, y: 455, baseY: 540, peakX: 640, round: 1.3, seed: 5 },
    ],
  }));
  out.push(addForestBand(S, {
    name: 's09-forest-near', z: 2050, x0: -200, x1: 2140, seed: 92, light: L,
    base: [[-200, 545], [450, 548], [700, 560], [1000, 548], [1300, 520], [1520, 490], [1750, 470], [2140, 470]],
    heights: [56, 128], rows: 2, density: 1.05, colors: [FOLIAGE.forest, FOLIAGE.sage], weights: [4, 1],
    haze: '#3c4c70', hazeAmt: [0.3, 0.06], gaps: 0.62, midMin: 80, tones: [0.12, 0.5],
  }));
  return tagAll(out, 'land');
}

// ---------------------------------------------------------------- trees framing the shot
export function addFramingTrees(S) {
  const L = S.light;
  const night = { deep: "#1a3a22", dark: "#2c5830", mid: "#4c7f3e", lit: "#7cae56", hi: "#aad272", fleck: "#e8c860" };
  const out = [];
  // Left: the big lit spruces cut by the frame, darker ones behind the falls.
  out.push(addTree(S, { name: 's09-tree-l4', z: 1720, detail: 'mid', x: 470, y: 420, h: 230, palette: FOLIAGE.forest, light: L, seed: 44, tones: [0.08, 0.42] }));
  out.push(addTree(S, { name: 's09-tree-l3', z: 1560, detail: 'mid', x: 272, y: 372, h: 270, palette: FOLIAGE.forest, light: L, seed: 43, tones: [0.1, 0.48] }));
  out.push(addTree(S, { name: 's09-tree-l2', z: 1520, detail: 'mid', x: 150, y: 400, h: 340, width: 0.3, palette: FOLIAGE.forest, light: L, seed: 42, tones: [0.1, 0.5] }));
  out.push(addTree(S, { name: 's09-tree-l1', z: 1060, detail: 'near', x: 30, y: 700, h: 800, width: 0.24, tiers: 10, palette: night, light: L, seed: 41, bias: 0.72, sides: 'right' }));
  out.push(addTree(S, { name: 's09-tree-l5', z: 1010, detail: 'near', x: 214, y: 668, h: 250, width: 0.3, palette: night, light: L, seed: 45, bias: 0.72 }));
  // Right: a stand of spruces above the right falls.
  out.push(addTree(S, { name: 's09-tree-r3', z: 1620, detail: 'mid', x: 1608, y: 512, h: 190, palette: FOLIAGE.forest, light: L, seed: 53, tones: [0.12, 0.52] }));
  out.push(addTree(S, { name: 's09-tree-r2', z: 1470, detail: 'mid', x: 1742, y: 535, h: 300, palette: night, light: L, seed: 52, tones: [0.15, 0.6] }));
  out.push(addTree(S, { name: 's09-tree-r1', z: 1330, detail: 'near', x: 1846, y: 590, h: 440, width: 0.24, palette: night, light: L, seed: 51, bias: 0.7 }));
  out.push(addTree(S, { name: 's09-tree-r4', z: 1180, detail: 'mid', x: 1980, y: 700, h: 600, width: 0.24, palette: night, light: L, seed: 54, tones: [0.25, 0.7] }));
  return tagAll(out, 'trees');
}

// ---------------------------------------------------------------- the grassy rise
function drawRise(ctx, light) {
  const rng = new RNG('s09-rise');
  const nz = noise('s09-rise');
  const top = (x) => {
    // Grass line: high at the left behind the far stone, low in the middle, up again on the right.
    const base = x < 760 ? lerp(470, 540, (x - 500) / 260) : x < 1400 ? 548 : lerp(548, 500, (x - 1400) / 180);
    return base + nz.fbm(x * 0.012, 0.5, 3) * 10;
  };
  const x0 = 480, x1 = 1600;
  const rows = [
    { dy: 0, fill: ['#5e6c2e', '#3e4c26'] },
    { dy: 22, fill: ['#748232', '#4a5828'] },
    { dy: 48, fill: ['#4e5c28', '#2e3a22'] },
    { dy: 76, fill: ['#66742e', '#3c4a24'] },
  ];
  for (const r of rows) {
    const pts = [];
    for (let x = x0; x <= x1; x += 8) pts.push([x, top(x) + r.dy + nz.n1(x * 0.03 + r.dy) * 5]);
    pts.push([x1, 860], [x0, 860]);
    piece(ctx, pts, {
      fill: linear(ctx, 0, 470 + r.dy, 0, 700 + r.dy, r.fill),
      torn: { amp: 2.2, freq: 0.22, fine: 0.9, seed: rng.int(1, 1e6), step: 3 },
      shadow: { color: 'rgba(10,14,4,0.45)', blur: 6, x: 0, y: 4 },
      bevel: { light, width: 1.4, hi: 0.3, lo: 0.15 },
    });
  }
  flecks(ctx, x0, 470, x1 - x0, 380, 1600, rng.int(1, 1e6), { color: '#c4c45a', max: 1.4, alpha: 0.6 });
  flecks(ctx, x0, 470, x1 - x0, 380, 900, rng.int(1, 1e6), { color: '#1c2410', max: 1.2, alpha: 0.45 });
  for (let i = 0; i < 40; i++) {
    const x = rng.range(x0 + 20, x1 - 20);
    drawMossPatch(ctx, x, top(x) + rng.range(14, 110), rng.range(14, 34), rng.range(4, 8), rng, light);
  }
}

// ---------------------------------------------------------------- cliffs, falls and rise
export function addCliffsAndFalls(S) {
  const L = S.light;
  const out = [];
  const pal = WATER.night;
  // Moonlit falls: mostly white water with pale blue shadows (ref09).
  const white = { ...WATER.canyon, fall: ['pale', 'foam', 'light', 'foam', 'pale', 'foam', 'mid', 'pale', 'foam'] };
  // Left: an upper cliff and a lower one with a two-step fall, in dark charcoal stone.
  out.push(addCliff(S, { name: 's09-cliff-lu', z: 1500, x: 150, y: 336, w: 336, h: 132, palette: 'granite', cols: 58, step: 14, plateau: 14, moss: 0.45, light: L, seed: 61 }));
  out.push(...layersOf(addWaterfall(S, { z: 1494, x: 350, top: 330, bottom: 456, width: [72, 90], lip: 7, round: 18, bandWidth: 10, speed: 90, palette: white, foam: false, mist: false })));
  out.push(addCliff(S, { name: 's09-cliff-ll', z: 1390, x: 96, y: 458, w: 490, h: 205, palette: 'granite', cols: 70, step: 16, plateau: 12, moss: 0.45, light: L, seed: 62 }));
  // The big block right of the falls (behind the fox's rock).
  out.push(addBoulders(S, { name: 's09-fall-block', z: 1388, palette: 'granite', light: L, moss: 0.3, rocks: [
    { x: 488, y: 520, w: 170, h: 132, shape: 'block', seed: 65 },
    { x: 250, y: 470, w: 120, h: 60, shape: 'block', seed: 66 },
  ] }));
  out.push(...layersOf(addFoam(S, { z: 1386, x: 354, y: 458, w: 180, h: 42, palette: WATER.canyon, seed: 's09-foam-u', size: 0.85, flat: 0.5 })));
  out.push(...layersOf(addWaterfall(S, { z: 1384, x: 380, top: 452, bottom: 640, width: [82, 100], lip: 6, round: 20, speed: 110, palette: white, foam: false, mist: { strength: 0.28 } })));
  // Right: the tall fall, then a small one over the lower ledge into the pool.
  out.push(addCliff(S, { name: 's09-cliff-r', z: 1400, x: 1548, y: 498, w: 440, h: 170, palette: 'arch', cols: 72, step: 14, plateau: 12, moss: 1, light: L, seed: 63 }));
  out.push(...layersOf(addWaterfall(S, { z: 1394, x: 1702, top: 494, bottom: 650, width: [74, 88], lip: 6, round: 18, speed: 100, palette: white, foam: false, mist: { strength: 0.2 } })));
  out.push(...layersOf(addFoam(S, { z: 1256, x: 1704, y: 650, w: 170, h: 40, palette: pal, seed: 's09-foam-r', size: 0.7 })));
  out.push(addCliff(S, { name: 's09-cliff-rl', z: 1250, x: 1474, y: 672, w: 380, h: 84, palette: 'arch', cols: 60, step: 10, plateau: 10, moss: 1, light: L, seed: 64 }));
  out.push(...layersOf(addWaterfall(S, { z: 1246, palette: pal, x: 1622, top: 668, bottom: 756, width: [54, 62], lip: 5, round: 12, bandWidth: 8, speed: 80, foam: false, mist: false })));
  // The grassy rise under the stones (between the cliffs).
  out.push(S.plane(1300, {
    name: 's09-rise', x: 470, y: 440, w: 1140, h: 430, mat: 'paper', light: L, shadow: { blur: 12 },
    draw(ctx) { drawRise(ctx, L); },
  }));
  // The small fall off the ledge rock at the left of the pool.
  out.push(addBoulders(S, { name: 's09-ledge-rocks', z: 1188, palette: 'arch', light: L, moss: 0.45, rocks: [
    { x: 690, y: 690, w: 120, h: 56, shape: 'block', seed: 1 },
    { x: 800, y: 712, w: 150, h: 104, shape: 'block', seed: 2 },
  ] }));
  out.push(...layersOf(addWaterfall(S, { z: 1183, palette: pal, x: 690, top: 672, bottom: 722, width: 36, round: 10, bandWidth: 7, speed: 60, foam: false, mist: false })));
  return tagAll(out, 'land');
}

// ---------------------------------------------------------------- pool
const POOL = [[-360, 652], [250, 642], [520, 652], [640, 700], [900, 738], [1300, 738], [1460, 752], [1820, 756], [1900, 724], [2260, 700], [2260, 1140], [-360, 1140]];

function drawLilyPads(ctx, pads, light) {
  const rng = new RNG('s09-lily');
  for (const p of pads) {
    const notch = rng.range(0, TAU);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = notch + 0.32 + (i / 40) * (TAU - 0.64);
      pts.push([p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r * 0.34]);
    }
    pts.push([p.x, p.y]);
    // Pads nearer the portal catch its warm light.
    const warm = Math.max(0, 1 - Math.abs(p.x - 1110) / 560);
    const path = piece(ctx, pts, {
      fill: linear(ctx, 0, p.y - p.r * 0.34, 0, p.y + p.r * 0.34, [vary(rng.pick(['#7aa23a', '#86ac40', '#6c9634']), rng, 0.05), vary(rng.pick(['#4b6e2a', '#557a2e', '#5e8432']), rng, 0.05)]),
      shadow: { color: 'rgba(2,12,34,0.65)', blur: 4, x: 0, y: 2.5 },
      bevel: { light, width: 1.4, hi: 0.5, lo: 0.25 },
    });
    ctx.save();
    ctx.clip(path);
    ctx.strokeStyle = rgba('#c4d468', 0.5);
    ctx.lineWidth = 0.9;
    for (let k = 0; k < 9; k++) {
      const a = notch + 0.5 + (k * (TAU - 1)) / 8;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r * 0.34); ctx.stroke();
    }
    // A pale rim and a warm sheen from the portal.
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba('#d8e080', 0.55);
    ctx.stroke(path);
    if (warm > 0) {
      ctx.fillStyle = rgba('#ffc45c', 0.38 * warm); ctx.fill(path);
      // A gold rim on the side facing the portal.
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = rgba('#ffd27a', 0.75 * warm);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.34, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    ctx.restore();
    if (p.flower) {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        piece(ctx, [[p.x + 4, p.y - 3], [p.x + 4 + Math.cos(a) * 7, p.y - 3 + Math.sin(a) * 3 - 3], [p.x + 4 + Math.cos(a + 0.4) * 5, p.y - 3 + Math.sin(a + 0.4) * 2.5]], {
          fill: k % 2 ? '#f4d6e2' : '#e8a8c4', shadow: { color: 'rgba(30,10,30,0.4)', blur: 1.5, x: 0, y: 1 },
        });
      }
      ctx.fillStyle = '#f0c040';
      ctx.beginPath(); ctx.arc(p.x + 4, p.y - 4, 2, 0, TAU); ctx.fill();
    }
  }
}

export function addPool(S, { portal }) {
  const L = S.light;
  const out = [];
  out.push(...layersOf(addLake(S, {
    z: 1176, x0: -360, x1: 2260, top: 640, bottom: 1010, shape: POOL, palette: WATER.nightLake, seed: 's09-pool', density: 0.5, shimmer: 90,
  })));
  out.push(...layersOf(addReflection(S, {
    z: 1172, x: portal.x - 10, top: 744, bottom: 990, width: 170, widthBottom: 135, count: 62, glints: 110,
    colors: ['#a0641a', '#e8a63a', '#ffd877'], glow: 0.2, speed: 0.8,
  })));
  // The warm wash of portal light across the pool and wide ripples of gold.
  const rr = new RNG('s09-pool-gold');
  const ripples = Array.from({ length: 150 }, () => {
    const y = 750 + Math.pow(rr.next(), 1.3) * 230;
    const spread = 150 + (y - 750) * 0.9;
    return {
      x: portal.x - 10 + rr.gauss() * spread * 0.55, y, len: rr.range(14, 70) * (1 + (y - 750) / 300), th: rr.range(1.6, 3.6),
      a: rr.range(0.2, 0.55), c: rr.pick(['#ffcc5c', '#ffb848', '#ffe3a0', '#f09a3a']), ph: rr.next(), per: rr.range(2.4, 5),
    };
  });
  out.push(S.add({
    name: 's09-pool-gold', z: 1169, blend: 'lighter',
    render(ctx, t) {
      drawGlow(ctx, portal.x - 10, 790, 420, '#ffa840', 0.09, { falloff: 'soft', sy: 0.26 });
      drawGlow(ctx, portal.x - 10, 770, 200, '#ffc458', 0.07, { falloff: 'soft', sy: 0.18 });
      const base = ctx.globalAlpha;
      for (const p of ripples) {
        const d = Math.abs(p.x - portal.x) / (220 + (p.y - 750));
        const a = p.a * Math.max(0, 1 - d * 0.8) * (0.65 + 0.35 * osc(t, p.per, p.ph));
        if (a < 0.03) continue;
        const x = p.x + 4 * osc(t, p.per * 1.3, p.ph + 0.3);
        ctx.globalAlpha = base * a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.ellipse(x, p.y, p.len / 2, p.th / 2, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = base;
    },
  }));
  // Foam where the falls meet the pool.
  out.push(...layersOf(addFoam(S, { z: 1171, x: 386, y: 642, w: 240, h: 56, palette: WATER.canyon, seed: 's09-foam-l', size: 1.1 })));
  out.push(...layersOf(addFoam(S, { z: 1171, x: 1624, y: 756, w: 140, h: 32, palette: WATER.night, seed: 's09-foam-r2', size: 0.6, flat: 0.45 })));
  out.push(...layersOf(addFoam(S, { z: 1171, x: 690, y: 722, w: 70, h: 16, palette: WATER.night, seed: 's09-foam-s', size: 0.4, flat: 0.4 })));
  // Lily pads bob very slightly on the water.
  const pads = [
    { x: 1222, y: 788, r: 28 }, { x: 1274, y: 794, r: 34, flower: true }, { x: 1180, y: 812, r: 20 },
    { x: 1392, y: 818, r: 38 }, { x: 1462, y: 828, r: 42, flower: true }, { x: 1534, y: 820, r: 36 }, { x: 1590, y: 810, r: 26 },
    { x: 1508, y: 852, r: 24 }, { x: 1150, y: 858, r: 22 }, { x: 868, y: 768, r: 32 }, { x: 930, y: 776, r: 22, flower: true },
    { x: 1640, y: 868, r: 28 }, { x: 1062, y: 834, r: 18 },
  ];
  const lily = S.sprite({
    name: 's09-lily', x: 800, y: 740, w: 900, h: 160, mat: 'paper', light: L, shadow: { blur: 5, alpha: 0.4 },
    draw(ctx) { drawLilyPads(ctx, pads, L); },
  });
  out.push(S.add({ name: 's09-lily', z: 1166, sprites: [{ s: lily }], anim: (t) => ({ y: 1.2 * osc(t, 5.3, 0.2), x: 1.5 * osc(t, 7.1, 0.6) }) }));
  out.push(addBoulders(S, { name: 's09-pool-rocks', z: 1160, palette: 'arch', light: L, moss: 0.35, rocks: [
    { x: 1356, y: 770, w: 84, h: 86, shape: 'pointy', seed: 3, lean: -6 },
    { x: 1456, y: 798, w: 110, h: 42, shape: 'flat', seed: 4 },
    { x: 1724, y: 870, w: 96, h: 40, shape: 'flat', seed: 5 },
  ] }));
  return tagAll(out, 'water');
}
