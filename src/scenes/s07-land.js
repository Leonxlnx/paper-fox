// s07 storm coast: everything that is not sea or weather.
//
//   sky + guiding star, the storm ceiling with its lit opening, blue-grey banks
//   distant snowy peaks, the forested far shore and headland, mist bands
//   the dark conifers at the left, the mossy bank behind the fox
//   the fox's mossy rock and the dark shore rocks, surf bursting on them with spray
//   foreground leaves with red berry plumes (bottom left)
//
// All positions are film px with the camera at rest (ref07 px x 1.1483).

import { RNG, noise } from '../core/rng.js';
import { piece, linear, radial, glow, pathOf } from '../core/piece.js';
import { sliver, brush } from '../elements/terrain-kit.js';
import { foamHook } from './s07-sea.js';
import { leaf, transform, ellipse, TAU } from '../core/geom.js';
import { mix, rgba } from '../core/color.js';
import { clamp, lerp, smoothstep } from '../core/ease.js';
import { drawSprites } from '../core/sprite.js';
import { addSky, addGuidingStar, GUIDE_PRESETS } from '../elements/sky.js';
import { addCloud, CLOUD_PALETTES } from '../elements/clouds.js';
import { addStormCeiling, addMist } from '../elements/clouds-storm.js';
import { addRange, drawBoulder, bouldersBox, ROCK_MAT } from '../elements/terrain.js';
import { addForestBand, addHeroConifer, addTree, FOLIAGE, BARK } from '../elements/trees.js';
import { addFlowerBed, generateBed } from '../elements/flora.js';
import { drawMoss, drawFern, drawTuft } from '../elements/flora-foliage.js';
import { FLORA_PAPER, FLORA_PALETTES } from '../elements/flora-kit.js';

// Key light: the guiding star in the cloud opening, upper right.
export const STAR = { x: 1499, y: 138 };
export const LIGHT = [0.8, -0.6];
export const HORIZON = 570;
export const FOX = { x: 690, y: 634, scale: 0.8, yaw: 0.3 };

// Wet slate shore rock: charcoal planes, pale rain-wet specks, olive moss.
const STONE = {
  ramp: ['#0a090c', '#161418', '#211e23', '#2e2a30', '#403b42', '#57515a'],
  fleck: '#a9a3a8', moss: ['#46561f', '#6c7f2a', '#9eaa3c'],
};

// Surge of the shore swell (0..1), shared by the surf so bursts follow the waves in.
export const SWELL = 5.6;
const surge = (t, phase) => 0.5 - 0.5 * Math.cos(TAU * (t / SWELL + phase));

// --- sky and clouds -----------------------------------------------------------------

export function addSkyAndClouds(S) {
  // Slate storm sky: it only shows in the opening and under the cloud base, so a plain
  // crumpled gradient with a warm pool round the star is enough.
  S.plane(20000, {
    name: 'sky', x: -300, y: -300, w: 2520, h: 1100, mat: 'sky', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = linear(ctx, 0, -300, 0, 800, [[0, '#111829'], [0.4, '#1d2840'], [0.75, '#36435f'], [1, '#46526e']]);
      ctx.fillRect(-300, -300, 2520, 1100);
      ctx.fillStyle = radial(ctx, STAR.x, STAR.y, 0, 400, [[0, 'rgba(214,190,140,0.4)'], [1, 'rgba(214,190,140,0)']]);
      ctx.fillRect(-300, -300, 2520, 1100);
    },
  });
  const star = addGuidingStar(S, { x: STAR.x, y: STAR.y, size: 55, ...GUIDE_PRESETS.storm });
  star.layers?.forEach?.((L) => L.tags.push('celestial'));
  const ceiling = addStormCeiling(S, {
    z: 9000, seed: 's07-ceiling', gap: { x: 1505, y: 142, rx: 178, ry: 124 }, bottom: 318, sag: 34,
    drift: 2.5, t0: 4.25, glow: { color: '#ffd89a', alpha: 0.18, r: 1.25 }, gapSky: '#2a3c56', reach: 0.8,
    palette: { ...CLOUD_PALETTES.storm, ramp: ['#f8e8c8', '#e8cfa8', '#c8ae90', '#8a8a94', '#5e6680', '#444e6c', '#343e5a', '#283048', '#1c2438', '#121828'] },
  });
  const bank = {
    palette: 'stormBank', light: [0.9, -0.35], torn: { amp: 2.2, freq: 0.09, fine: 1.2, step: 2.5 },
    rim: { width: 0.7 }, merge: true, accent: 0.25, lobes: 3, lumpy: 0.06, creases: 2, t0: 4.25, drift: 4,
    lightPos: [STAR.x, STAR.y], warm: { x: STAR.x, y: STAR.y, r: 640, color: '#f2d6a2', amt: 0.28 },
  };
  // More of the heavy layered ceiling: torn banks stacked over the whole sky, each with
  // a pale lit rim on the side facing the star.
  const RIDGE = [[0, 0.25], [0.12, 0.6], [0.28, 0.9], [0.4, 1], [0.55, 0.78], [0.7, 0.6], [0.86, 0.42], [1, 0.2]];
  const RIDGE2 = [[0, 0.2], [0.15, 0.5], [0.32, 0.62], [0.5, 0.55], [0.68, 0.44], [0.85, 0.3], [1, 0.15]];
  const extra = [
    { name: 'bankL', z: 7700, x: -200, y: 10, w: 720, h: 250, seed: 's07-bankL', tone: 0.5 },
    { name: 'bankTop', z: 7820, x: 420, y: -70, w: 820, h: 190, seed: 's07-bankTop', tone: 0.5 },
    { name: 'bankTopR', z: 7840, x: 1720, y: -60, w: 560, h: 200, seed: 's07-bankTopR', tone: 0.5 },
    { name: 'bankC', z: 7300, x: 880, y: 170, w: 330, h: 150, seed: 's07-bankC', tone: 0.58 },
    { name: 'bankR', z: 7350, x: 1640, y: 190, w: 600, h: 175, seed: 's07-bankR', tone: 0.64 },
    { name: 'bankLow', z: 6600, x: 1280, y: 280, w: 480, h: 105, seed: 's07-bankLow', tone: 0.5 },
  ];
  for (const e of extra) {
    addCloud(S, {
      ...bank, name: e.name, z: e.z, x: e.x, y: e.y, w: e.w, h: e.h, tiers: 2, seed: e.seed,
      tierOpts: [
        { profile: RIDGE, size: 0.42, minR: 30, spacing: 1.1, tone: e.tone + 0.08 },
        { profile: RIDGE2, size: 0.5, minR: 26, tone: e.tone, under: true, underR: 0.45 },
      ],
    });
  }
  addCloud(S, {
    ...bank, name: 'bankA', z: 7600, x: 330, y: 80, w: 620, h: 200, tiers: 2, seed: 's07-bankA',
    tierOpts: [
      { profile: [[0, 0.3], [0.1, 0.62], [0.3, 0.85], [0.42, 0.98], [0.55, 0.7], [0.7, 0.52], [0.85, 0.35], [1, 0.2]], size: 0.42, minR: 34, spacing: 1.1, tone: 0.42 },
      { profile: [[0.05, 0.2], [0.15, 0.42], [0.35, 0.52], [0.55, 0.45], [0.75, 0.35], [0.95, 0.2]], size: 0.5, minR: 30, tone: 0.32, under: true, underR: 0.45 },
    ],
  });
  addCloud(S, {
    ...bank, name: 'bankB', z: 7400, x: 640, y: 120, w: 560, h: 200, tiers: 2, seed: 's07-bankB',
    tierOpts: [
      { profile: [[0, 0.5], [0.15, 0.85], [0.3, 1], [0.45, 0.8], [0.62, 0.55], [0.8, 0.4], [1, 0.25]], size: 0.42, minR: 34, spacing: 1.1, tone: 0.36 },
      { profile: [[0.1, 0.3], [0.3, 0.42], [0.5, 0.36], [0.7, 0.28], [0.9, 0.22], [1, 0.12]], size: 0.5, minR: 26, tone: 0.24, under: true, underR: 0.45 },
    ],
  });
  // Deepen the ceiling to the slate of the reference, leaving the lit opening clear.
  const shadeS = S.sprite({
    name: 'ceiling-shade', x: -300, y: -300, w: 2520, h: 800, mat: 'none', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = radial(ctx, 1505, 150, 140, 620, [[0, '#ffffff'], [0.5, '#c6c9da'], [1, '#9a9fba']]);
      ctx.fillRect(-300, -300, 2520, 800);
      ctx.fillStyle = linear(ctx, 0, 300, 0, 470, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,1)']]);
      ctx.fillRect(-300, 300, 2520, 200);
    },
  });
  S.add({ name: 'ceiling-shade', z: 7640, blend: 'multiply', sprites: [{ s: shadeS }] });
  return { star, ceiling };
}

// --- low mist banks ----------------------------------------------------------------

// A low bank of sea mist: soft tissue billows along a base line (densest where the band
// noise is high), a paler crisp-topped layer on the biggest billows, a few wisps lifting
// off the top and a feathered foot that melts into whatever is below.
//   x0, x1, y   extent and base line; h: billow height; color, alpha; seed
function drawMistBank(ctx, { x0, x1, y, h, color = '#c4cadf', alpha = 0.8, seed = 'mistbank', soft = 9, wisps = 4 }) {
  const rng = new RNG(seed);
  const nz = noise(seed);
  const k = ctx.__res || 1;
  ctx.save();
  // Feathered foot.
  ctx.filter = `blur(${soft * 1.6 * k}px)`;
  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse((x0 + x1) / 2, y - h * 0.12, (x1 - x0) * 0.5, h * 0.2, 0, 0, TAU);
  ctx.fill();
  const n = Math.round((x1 - x0) / (h * 0.42));
  for (const pass of [0, 1]) {
    for (let i = 0; i < n; i++) {
      const u = (i + rng.next()) / n;
      const x = lerp(x0, x1, u);
      const dens = 0.5 + 0.5 * nz.n1(x * 0.0045 + 3.1);
      const env = Math.pow(Math.sin(Math.PI * u), 0.35);
      const r = h * rng.range(0.22, 0.5) * (0.45 + dens) * env;
      if (r < 5 || (pass && dens < 0.45)) continue;
      ctx.filter = `blur(${(pass ? soft * 0.3 : soft) * rng.range(0.7, 1.2) * k}px)`;
      ctx.globalAlpha = alpha * (pass ? 0.42 : 0.62) * (0.45 + 0.75 * dens);
      ctx.fillStyle = pass ? mix(color, '#ffffff', 0.45) : mix(color, '#ffffff', rng.range(-0.05, 0.12));
      const ry = r * (pass ? 0.5 : 0.75);
      ctx.beginPath();
      ctx.ellipse(x, y - ry - (pass ? r * 0.35 : 0), r * rng.range(1.3, 2.1) * (pass ? 0.7 : 1), ry, 0, 0, TAU);
      ctx.fill();
    }
  }
  // Wisps: thin lenses lifting off the top.
  for (let i = 0; i < wisps; i++) {
    const cx = lerp(x0, x1, rng.range(0.1, 0.9)), len = (x1 - x0) * rng.range(0.1, 0.22);
    const cy = y - h * rng.range(0.7, 1.05), th = h * rng.range(0.05, 0.1);
    ctx.filter = `blur(${soft * 0.6 * k}px)`;
    ctx.globalAlpha = alpha * rng.range(0.3, 0.55);
    ctx.fillStyle = mix(color, '#ffffff', 0.25);
    ctx.beginPath();
    ctx.ellipse(cx, cy, len / 2, th, rng.range(-0.08, 0.04), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function addMistBank(S, o) {
  const pad = o.h + 40;
  const s = S.sprite({
    name: o.name, x: o.x0 - pad, y: o.y - o.h * 1.5 - 30, w: o.x1 - o.x0 + pad * 2, h: o.h * 1.5 + 30 + o.h * 0.6 + 30,
    mat: [{ tex: 'fiber', amt: 0.4 }], edge: false, shadow: false,
    draw: (ctx) => drawMistBank(ctx, o),
  });
  const drift = o.drift ?? 8;
  return S.add({
    name: o.name, z: o.z, sprites: [{ s }],
    alpha: (t) => 0.9 + 0.1 * Math.sin(TAU * t / 7.3 + o.z),
    anim: (t) => ({ x: drift * (t - 4.25), y: 2 * Math.sin(TAU * (t - 4.25) / 9) }),
  });
}

// --- distance: peaks, far shore, headland, mist --------------------------------------

export function addDistance(S) {
  addRange(S, {
    z: 5200, name: 'peaks', palette: 'night', light: LIGHT, detail: 1,
    fade: { color: '#5a6488', from: 400, to: 520, alpha: 0.8 },
    peaks: [
      { x: 1716, y: 374, baseY: 480, left: 210, right: 280, haze: 0.22, snow: 0.55, seed: 72 },
      { x: 1536, y: 386, baseY: 480, left: 170, right: 160, haze: 0.16, snow: 0.6, seed: 73 },
      { x: 1414, y: 372, baseY: 480, left: 170, right: 160, haze: 0.08, snow: 0.65, seed: 74 },
      { x: 1252, y: 314, baseY: 480, left: 290, right: 230, snow: 0.6, seed: 75, ridge: 0.9, profile: 1.5 },
    ],
  });
  addMist(S, { name: 'mist-far', z: 3400, t0: 4.25, x: -300, y: 250, w: 2520, h: 200, seed: 's07-mist1', color: '#a3acc8', alpha: 0.62, drift: 9 });
  // Forested slopes at the feet of the peaks, half in mist (hides the range's foot).
  addForestBand(S, {
    z: 3000, name: 'far-forest', seed: 's07-farforest', light: LIGHT,
    x0: 880, x1: 1600, rows: 3, rowLift: 14, heights: [24, 50], density: 1.4, gaps: 0.9,
    base: [[880, 556], [1050, 536], [1250, 522], [1450, 528], [1600, 540]],
    colors: FOLIAGE.blue, haze: '#6a789c', hazeAmt: [0.6, 0.32], tones: [0.15, 0.5], skirt: 70, midMin: 999,
    box: { x: 820, y: 420, w: 860, h: 220 },
  });
  // Far right shore: a forested hill climbing to the right edge.
  addForestBand(S, {
    z: 2700, name: 'shore-right', seed: 's07-shore', light: LIGHT,
    x0: 1540, x1: 2320, rows: 4, rowLift: 26, heights: [40, 82], density: 1.5, gaps: 0.85,
    base: [[1540, 566], [1640, 544], [1780, 508], [1920, 476], [2320, 448]],
    colors: [FOLIAGE.forest, FOLIAGE.blue], weights: [3, 1], haze: '#5d6d8e', hazeAmt: [0.5, 0.15],
    tones: [0.12, 0.5], skirt: 160, midMin: 999,
    box: { x: 1440, y: 300, w: 940, h: 460 },
  });
  addMist(S, { name: 'mist-shore', z: 2450, t0: 4.25, x: -300, y: 400, w: 2520, h: 220, seed: 's07-mist3', color: '#b4bcd6', alpha: 0.7, drift: 11, gaps: 0.4 });
  // Low sea mist wrapping the foot of the headland and the valley under the peaks.
  addMistBank(S, { name: 'mist-valley', z: 4400, x0: 560, x1: 2260, y: 512, h: 120, color: '#c4cae2', alpha: 0.42, seed: 's07-mv', drift: 6, wisps: 6, soft: 6 });
  addMistBank(S, { name: 'mist-headland', z: 2560, x0: 1380, x1: 2280, y: 590, h: 110, color: '#ccd2e6', alpha: 0.66, seed: 's07-mh', drift: 9 });
  addMistBank(S, { name: 'mist-islet-back', z: 2120, x0: 880, x1: 1480, y: 596, h: 95, color: '#c2c8de', alpha: 0.8, seed: 's07-mib', drift: 10 });
  // The wooded islet off the point.
  addForestBand(S, {
    z: 2050, name: 'islet', seed: 's07-islet', light: LIGHT,
    x0: 1120, x1: 1380, rows: 2, rowLift: 18, heights: [62, 124], density: 1.6, gaps: 0.5,
    base: [[1120, 598], [1220, 590], [1300, 594], [1380, 600]],
    colors: [FOLIAGE.forest, FOLIAGE.sage], weights: [5, 1], haze: '#62729a', hazeAmt: [0.35, 0.05],
    tones: [0.08, 0.48], skirt: 16, midMin: 76,
    box: { x: 1060, y: 440, w: 400, h: 190 },
  });
  // The islet's rock shelf under the trees.
  S.plane(2040, {
    name: 'islet-rock', x: 1060, y: 560, w: 420, h: 70, mat: ROCK_MAT, res: 1,
    edge: { width: 1.2, hi: 0.3, lo: 0.25 }, shadow: { blur: 8 },
    draw(ctx) {
      const rng = new RNG('islet');
      const top = [];
      for (let x = 1080; x <= 1440; x += 12) top.push([x, 590 + 4 * Math.sin(x * 0.05) + rng.range(-2, 2)]);
      piece(ctx, [...top, [1440, 606], [1420, 612], [1090, 612], [1075, 600]], {
        fill: linear(ctx, 0, 586, 0, 612, ['#3c4a40', '#1d2226', '#121418']),
        torn: { amp: 1.4, freq: 0.15, seed: 4 },
      });
      for (let i = 0; i < 14; i++) {
        const x = lerp(1090, 1420, rng.next());
        piece(ctx, [[x, 600], [x + rng.range(8, 20), 596], [x + rng.range(20, 34), 606], [x + 4, 609]], { fill: rng.pick(['#2c3034', '#3a4044', '#23272b']) });
      }
    },
  });
  addMist(S, { name: 'mist-near', z: 1800, t0: 4.25, x: -300, y: 420, w: 2520, h: 150, seed: 's07-mist2', color: '#c0c8de', alpha: 0.4, drift: 14, gaps: 0.45 });
  addMistBank(S, { name: 'mist-islet', z: 2000, x0: 940, x1: 1500, y: 614, h: 55, color: '#ccd2e6', alpha: 0.72, seed: 's07-mi', drift: 12, wisps: 3 });
  addMistBank(S, { name: 'mist-cove', z: 1420, x0: 760, x1: 1120, y: 604, h: 90, color: '#c4cae0', alpha: 0.62, seed: 's07-mc', drift: 12 });
}

// --- the woods at the left ---------------------------------------------------------

export function addLeftWoods(S) {
  const wind = { amp: 0.009, period: 4.6 };
  // Behind the fox: tall dark spruces getting smaller toward the shore.
  const mids = [
    { x: 880, y: 612, h: 118, z: 1260 }, { x: 812, y: 600, h: 150, z: 1270 }, { x: 742, y: 596, h: 200, z: 1290 },
    { x: 640, y: 610, h: 300, z: 1320 }, { x: 538, y: 600, h: 410, z: 1350 }, { x: 446, y: 596, h: 500, z: 1380 },
  ];
  mids.forEach((m, i) => addTree(S, {
    ...m, name: `spruce-mid${i}`, detail: 'mid', seed: `s07-mid${i}`, light: LIGHT,
    palette: i % 3 === 1 ? FOLIAGE.teal : FOLIAGE.forest, tones: [0.05, 0.42], width: 0.25,
    haze: '#3a4a60', hazeAmt: 0.12, sway: { ...wind, amp: 0.012 },
  }));
  // Second big spruce: open whorls on a bare trunk (no backing silhouette), so the sky,
  // clouds and the smaller spruces show between its tiers.
  addHeroConifer(S, {
    name: 'spruce-back', x: 410, y: 600, h: 1080, z: 1160, seed: 's07-back', light: LIGHT,
    palette: FOLIAGE.forest, bark: BARK.night, width: 0.17, interior: false, bias: 0.55, contrast: 1.25, trunkFrac: 0.12, front: false, tiers: 10, slope: 0.5,
    haze: '#2c3a50', hazeAmt: 0.12, sway: { amp: 0.007, period: 4.9 }, tierSway: { amp: 0.024, period: 3.1, lag: 0.08 },
  });
  // Hero spruce at the left edge: whorls rock in the gusts.
  addHeroConifer(S, {
    name: 'hero-spruce', x: 104, y: 540, h: 1350, z: 1030, seed: 's07-hero', light: LIGHT,
    palette: FOLIAGE.night, bark: BARK.night, width: 0.22, interior: false, bias: 0.85, contrast: 1.35, trunkFrac: 0.1, front: false, tiers: 9, slope: 0.55,
    sway: { amp: 0.006, period: 5.2 }, tierSway: { amp: 0.022, period: 3.3, lag: 0.09 },
  });
}

// --- mossy bank behind the fox -----------------------------------------------------

export function addBank(S) {
  S.plane(1090, {
    name: 'bank', x: -340, y: 380, w: 1180, h: 640, mat: FLORA_PAPER, res: 1,
    edge: { width: 1.4, hi: 0.3, lo: 0.25 }, shadow: { blur: 12 },
    draw(ctx) {
      const rng = new RNG('s07-bank');
      const nz = noise('s07-bank');
      const top = [];
      for (let x = -340; x <= 820; x += 10) {
        const k = smoothstep(-100, 700, x);
        top.push([x, lerp(462, 652, k) + 10 * nz.n1(x * 0.012)]);
      }
      piece(ctx, [...top, [820, 1020], [-340, 1020]], {
        fill: linear(ctx, 0, 460, 0, 820, ['#7c8c30', '#3e5222', '#162210']),
        torn: { amp: 2.5, freq: 0.08, seed: 3 },
      });
      // Moss cushions and grass along the slope, ferns arching over toward the light.
      for (let i = 0; i < 6; i++) {
        const x = lerp(-60, 560, i / 5) + rng.range(-20, 20);
        const y = top[Math.round((x + 340) / 10)]?.[1] ?? 600;
        drawMoss(ctx, { x, y: y + rng.range(14, 30), w: rng.range(110, 160), h: rng.range(30, 46), palette: 'dusk', light: LIGHT, seed: 30 + i });
      }
      for (let i = 0; i < 6; i++) {
        const x = lerp(-60, 560, i / 5) + rng.range(-25, 25);
        const y = (top[Math.round((x + 340) / 10)]?.[1] ?? 600) + rng.range(20, 50);
        drawFern(ctx, { x, y, len: rng.range(120, 200), rot: rng.range(0.5, 1.1), curl: 0.3, color: rng.pick(['light', 'mid', 'light']), palette: 'dusk', light: LIGHT, seed: 50 + i });
      }
      for (let i = 0; i < 9; i++) {
        const x = lerp(-60, 720, rng.next());
        const y = (top[Math.round((x + 340) / 10)]?.[1] ?? 600) + rng.range(8, 30);
        drawTuft(ctx, { x, y, len: rng.range(40, 80), n: 7, lean: rng.range(-0.1, 0.4), tones: ['lime', 'light', 'yellow'], palette: 'dusk', light: LIGHT, seed: 70 + i });
      }
    },
  }, { tags: ['ground'] });
}

// --- rocks -------------------------------------------------------------------------

// Rocks back to front; z is set a little in front of the sea row at their waterline.
const ROCKS = [
  { name: 'rock-D', z: 1000, x: 980, y: 800, w: 200, h: 165, shape: 'pointy', tilt: 0.22, lean: 18, sides: 5, rough: 0.34, seed: 41 },
  { name: 'rock-F', z: 975, x: 1280, y: 906, w: 84, h: 58, shape: 'pointy', sides: 5, seed: 43 },
  { name: 'rock-E', z: 960, x: 1126, y: 952, w: 196, h: 172, shape: 'pointy', tilt: 0.24, sides: 6, rough: 0.32, seed: 44, lean: -10 },
  { name: 'rock-H', z: 925, x: 1718, y: 1000, w: 116, h: 66, shape: 'pointy', sides: 5, seed: 45 },
  { name: 'rock-G', z: 885, x: 1472, y: 1038, w: 320, h: 170, shape: 'pointy', tilt: 0.2, sides: 5, rough: 0.36, seed: 47, lean: -40 },
  { name: 'rock-C', z: 850, x: 824, y: 1104, w: 336, h: 236, shape: 'block', tilt: 0.22, sides: 5, rough: 0.3, seed: 48, moss: 0.25 },
  { name: 'rock-I', z: 820, x: 1060, y: 1160, w: 400, h: 210, shape: 'flat', tilt: 0.2, sides: 6, rough: 0.3, seed: 49 },
];

// --- the fox's perch: a natural mossy outcrop ---------------------------------------
//
// Fractured wet slate in two tiers. The upper tier is an uneven shelf (the fox stands
// on its back half) carpeted in yellow-green moss that drapes over the front lip; its
// front is split into leaning planes by cracks and small ledges, with a lit right
// shoulder facing the star. A lower tier steps forward and down toward the surf.
const PERCH = [
  {
    back: [[280, 652], [340, 637], [410, 628], [490, 621], [570, 616], [650, 614], [720, 616], [790, 621], [850, 628], [900, 639], [934, 656]],
    lip: [[280, 698], [350, 686], [430, 679], [510, 675], [590, 673], [670, 675], [745, 678], [815, 682], [880, 688], [930, 697], [952, 702]],
    right: [[952, 702], [964, 736], [970, 774], [956, 808]],
    bottom: [[956, 808], [880, 814], [800, 804], [700, 796], [600, 794], [480, 796], [380, 804], [280, 812]],
    moss: [[280, 600, 1], [612, 700, 0.55], [748, 912, 0.9]],
  },
  {
    back: [[506, 774], [570, 757], [640, 748], [712, 747], [784, 753], [842, 766]],
    lip: [[498, 796], [570, 783], [640, 777], [712, 776], [786, 781], [852, 792]],
    right: [[852, 792], [864, 828], [852, 862]],
    bottom: [[852, 862], [792, 886], [700, 894], [610, 890], [530, 872], [494, 838]],
    moss: [[506, 640, 0.8], [700, 790, 0.5]],
  },
];

// y of a polyline (sorted by x) at x.
function yAt(line, x) {
  if (x <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    const [x1, y1] = line[i];
    if (x <= x1) { const [x0, y0] = line[i - 1]; return lerp(y0, y1, (x - x0) / (x1 - x0)); }
  }
  return line[line.length - 1][1];
}
const sample = (line, a, b, step = 8) => {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => { const x = lerp(a, b, i / n); return [x, yAt(line, x)]; });
};
const bottomOf = (T) => T.bottom.slice().sort((p, q) => p[0] - q[0]);

function paintTier(ctx, T, rng, nz) {
  const R = STONE.ramp;
  const x0 = T.lip[0][0], xr = T.right[0][0];
  const sil = [...T.back, ...T.right.slice(T.back[T.back.length - 1][0] === T.right[0][0] ? 1 : 0), ...T.bottom, ...T.lip.slice(0, 1)];
  piece(ctx, sil, { fill: R[1], torn: { amp: 1.4, freq: 0.12, fine: 0.6, seed: rng.int(1, 1e6), step: 4 }, shadow: { color: 'rgba(4,3,8,0.6)', blur: 10, x: -LIGHT[0] * 5, y: 6 } });
  ctx.save();
  ctx.clip(pathOf(sil));
  // Front planes between leaning seams.
  const bot = bottomOf(T);
  const seams = [x0 - 20];
  for (let x = x0 + rng.range(40, 90); x < xr - 50; x += rng.range(75, 150)) seams.push(x);
  seams.push(xr - 30);
  const lean = seams.map(() => rng.range(-55, 40));
  for (let i = 0; i < seams.length - 1; i++) {
    const a = seams[i], b = seams[i + 1];
    const top = sample(T.lip, a, b), low = sample(bot, b + lean[i + 1], a + lean[i]);
    const poly = [...top.map(([x, y]) => [x, y - 2]), ...low.map(([x, y]) => [x, y + 30])];
    // Neighbouring planes alternate clearly between shadowed and half-lit.
    const t = clamp((i % 2 ? rng.range(0.55, 0.85) : rng.range(0.0, 0.25)) + 0.2 * smoothstep(x0, xr, a) * rng.next());
    const tone = mix(R[Math.round(1 + t * 3)], '#3a3029', 0.2);
    const yl = yAt(T.lip, a);
    const path = piece(ctx, poly, {
      fill: linear(ctx, 0, yl, 0, yl + 140, [mix(tone, R[5], 0.3), tone, R[0]]),
      shadow: { color: 'rgba(0,0,0,0.35)', blur: 3, x: -LIGHT[0] * 1.5, y: 1.5 },
      bevel: { light: LIGHT, width: 1.2, hi: 0.18, lo: 0.1 },
    });
    brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.4, 0.4), amt: 0.22, scale: 0.6, seed: rng.int(1, 1e9) });
    // Chisel the plane: a lighter upper-right facet split off on a diagonal, facing the
    // star, so the face reads as fractured stone rather than a wall.
    if (rng.chance(0.75)) {
      const ya = yAt(T.lip, a) + rng.range(20, 70), xb2 = lerp(a, b, rng.range(0.55, 1));
      const facet = [...sample(T.lip, lerp(a, b, rng.range(0, 0.35)), b, 6).map(([x, y]) => [x, y - 1]), [b + lean[i + 1] * 0.5, yAt(T.lip, b) + rng.range(50, 110)], [xb2, ya + rng.range(20, 50)], [a + lean[i] * 0.3, ya]];
      const fp = piece(ctx, facet, {
        fill: linear(ctx, a, yl, b, yl + 90, [mix(R[5], '#a09284', 0.55), mix(R[5], '#5a4e44', 0.3)]),
        torn: { amp: 0.7, freq: 0.2, fine: 0.3, seed: rng.int(1, 1e6), step: 4 },
        shadow: { color: 'rgba(0,0,0,0.4)', blur: 2.5, x: -LIGHT[0] * 1.5, y: 1.5 }, bevel: { light: LIGHT, width: 1.2, hi: 0.3, lo: 0.12 },
      });
      brush(ctx, fp, { angle: Math.PI / 2 + rng.range(-0.5, 0.5), amt: 0.2, scale: 0.6, seed: rng.int(1, 1e9) });
    }
    // A small ledge catching the light partway down some planes.
    if (rng.chance(0.55)) {
      const d = rng.range(18, 48);
      const la = lerp(a, b, rng.range(0, 0.3)), lb = lerp(a, b, rng.range(0.6, 1));
      const ledge = [...sample(T.lip, la, lb, 6).map(([x, y]) => [x, y + d]), ...sample(T.lip, lb, la, 6).map(([x, y]) => [x + 3, y + d + rng.range(3, 6)])];
      piece(ctx, ledge, { fill: R[4], torn: { amp: 0.8, freq: 0.3, fine: 0.4, seed: rng.int(1, 1e6), step: 3 }, shadow: { color: 'rgba(0,0,0,0.6)', blur: 2, x: 0, y: 2.5 } });
    }
    // Crack along the seam.
    if (i > 0 && rng.chance(0.35)) {
      const p = [a, yAt(T.lip, a)], q = [a + lean[i], yAt(bot, a + lean[i]) + 10];
      const mid = [lerp(p[0], q[0], 0.5) + rng.range(-6, 6), lerp(p[1], q[1], 0.5)];
      piece(ctx, sliver([p, mid, q], rng.range(1.2, 2.4)), { fill: rgba(R[0], 0.95) });
    }
  }
  // The lit right shoulder facing the star.
  const xs = T.right[0][0] - rng.range(40, 60);
  const sh = [...sample(T.lip, xs, T.right[0][0], 6), ...T.right.slice(1), [xs + 10, yAt(bot, xs) + 20]];
  const shp = piece(ctx, sh, {
    fill: linear(ctx, xs, 0, T.right[0][0] + 20, 0, [R[3], R[4], mix(R[5], '#8a8478', 0.3)]),
    bevel: { light: LIGHT, width: 1.4, hi: 0.35, lo: 0.1 }, shadow: { color: 'rgba(0,0,0,0.4)', blur: 3, x: -2, y: 1 },
  });
  brush(ctx, shp, { angle: Math.PI / 2, amt: 0.22, scale: 0.6, seed: rng.int(1, 1e9) });
  // The top shelf: lighter slate plates.
  const shelf = [...T.back, ...T.lip.slice().reverse()];
  piece(ctx, shelf, { fill: linear(ctx, 0, T.back[0][1] - 20, 0, T.lip[0][1], [mix(R[5], '#8c8378', 0.45), mix(R[5], '#6e665e', 0.3), R[4]]), shadow: { color: 'rgba(0,0,0,0.5)', blur: 3, x: -LIGHT[0] * 1.5, y: 2.5 }, bevel: { light: LIGHT, width: 1.4, hi: 0.4, lo: 0.2 } });
  for (let x = x0 + rng.range(30, 70); x < xr - 20; x += rng.range(60, 130)) {
    const w = rng.range(30, 80);
    const pl = [...sample(T.back, x, x + w, 6).map(([px, py]) => [px, py + 4]), ...sample(T.lip, x + w + 10, x + 6, 6).map(([px, py]) => [px, py - 3])];
    const pp = piece(ctx, pl, { fill: mix(R[rng.chance(0.5) ? 4 : 5], '#6c665e', rng.range(0, 0.2)), torn: { amp: 0.8, freq: 0.2, fine: 0.4, seed: rng.int(1, 1e6), step: 4 }, shadow: { color: 'rgba(0,0,0,0.3)', blur: 2, x: 0, y: 1 } });
    brush(ctx, pp, { angle: rng.range(-0.15, 0.15), amt: 0.2, scale: 0.7, seed: rng.int(1, 1e9) });
  }
  // The front lip catches the starlight: a broken pale edge.
  ctx.lineCap = 'round';
  for (let x = x0; x < T.right[0][0];) {
    const len = rng.range(30, 90);
    ctx.strokeStyle = rgba('#c8bcae', rng.range(0.35, 0.7));
    ctx.lineWidth = rng.range(1.2, 2.2);
    ctx.beginPath();
    sample(T.lip, x, Math.min(T.right[0][0], x + len), 6).forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    x += len + rng.range(8, 40);
  }
  // Rain-wet specks.
  const ys = sil.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let i = 0; i < (xr - x0) * (y1 - y0) / 90; i++) {
    const x = lerp(x0 - 20, xr + 20, rng.next()), y = lerp(y0, y1, rng.next());
    ctx.fillStyle = rng.chance(0.55) ? rgba(rng.chance(0.8) ? STONE.fleck : '#d8cfc4', rng.range(0.4, 0.9)) : rgba('#000000', rng.range(0.3, 0.55));
    ctx.fillRect(x, y, rng.range(0.7, 2.2), rng.range(0.6, 1.6));
  }
  ctx.restore();
  for (const [a, b, amt] of T.moss) paintMossCarpet(ctx, T, a, b, amt, rng, nz);
}

// Moss carpet over the shelf between a and b: fuzzy top edge just above the back rim,
// lobes draping over the lip, dark olive under a lighter yellow-green top with fibres.
function paintMossCarpet(ctx, T, a, b, amt, rng, nz) {
  const n = Math.ceil((b - a) / 4);
  const drapes = Array.from({ length: Math.round((b - a) / 45 * amt) + 1 }, () => ({ x: lerp(a, b, rng.range(0.05, 0.95)), w: rng.range(10, 30), d: rng.range(8, 34) * amt }));
  const top = [], low = [], mid = [];
  const ph = rng.range(0, 100);
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = lerp(a, b, u);
    // Lens-shaped patch lying on the shelf: its back edge wanders over the shelf (only
    // in places reaching the rim), its ends pinch toward the lip.
    const env = Math.pow(Math.sin(Math.PI * u), 0.5);
    const yb = yAt(T.back, x), yl = yAt(T.lip, x);
    let drape = 0;
    for (const d of drapes) drape += d.d * Math.exp(-Math.pow((x - d.x) / d.w, 2));
    const reachBack = clamp(0.25 + 0.55 * (0.5 + 0.5 * nz.n1(x * 0.012 + ph)) * env, 0, 0.95);
    const fuzz = 1 + 2 * Math.abs(nz.n1(x * 0.23 + ph)) + (i % 3 === 0 ? rng.range(0, 2.5) : 0);
    const yt = lerp(yl, yb, reachBack) - fuzz;
    const yd = yl + (2 + drape * 0.6) * env * (0.5 + 0.6 * Math.abs(nz.n1(x * 0.05 + ph)));
    top.push([x, yt]);
    low.push([x, Math.max(yd, yt + 3)]);
    mid.push([x, lerp(yt, yl, 0.75 + 0.15 * nz.n1(x * 0.04 + ph))]);
  }
  const shadow = { color: 'rgba(0,0,0,0.45)', blur: 3, x: -LIGHT[0] * 1.5, y: 2.5 };
  piece(ctx, [...top, ...low.slice().reverse()], {
    fill: linear(ctx, 0, top[0][1] - 10, 0, low[0][1] + 20, ['#5c5e1c', '#3c4214', '#262a0c']),
    torn: { amp: 1.6, freq: 0.3, fine: 0.9, seed: rng.int(1, 1e6), step: 2 }, shadow,
  });
  piece(ctx, [...top, ...mid.slice().reverse()], {
    fill: linear(ctx, 0, top[0][1] - 8, 0, mid[0][1] + 6, ['#aea23c', '#868a2c', '#5e6620']),
    torn: { amp: 1.4, freq: 0.32, fine: 0.9, seed: rng.int(1, 1e6), step: 2 },
    shadow: { color: 'rgba(0,0,0,0.3)', blur: 2, x: 0, y: 1.5 }, bevel: { light: LIGHT, width: 1, hi: 0.3, lo: 0.1 },
  });
  // Fibres: short ticks in light and dark moss tones.
  ctx.lineCap = 'round';
  for (let i = 0; i < (b - a) * 1.4; i++) {
    const j = rng.int(0, n), k = rng.next();
    const x = top[j][0] + rng.range(-2, 2), y = lerp(top[j][1] + 2, low[j][1] - 2, Math.pow(k, 1.3));
    ctx.strokeStyle = k < 0.45 ? rgba(rng.pick(['#d4c658', '#bcae46', '#a0a03a']), 0.8) : rgba(rng.pick(['#2a3010', '#4a521c', '#6c7228']), 0.7);
    ctx.lineWidth = rng.range(0.8, 1.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rng.range(-2.5, 2.5), y - rng.range(2, 5) * (k < 0.45 ? 1 : -1));
    ctx.stroke();
  }
}

function addPerch(S) {
  const s = S.sprite({
    name: 'perch', x: 230, y: 560, w: 790, h: 380, mat: ROCK_MAT, res: 1,
    edge: { width: 1.6, hi: 0.32, lo: 0.3, soft: 0.6 }, shadow: { blur: 14 },
    draw(ctx) {
      const rng = new RNG('s07-perch');
      const nz = noise('s07-perch');
      for (const T of PERCH) paintTier(ctx, T, rng, nz);
      // Grass tufts at the right end where the spray reaches, and on the lower ledge.
      for (let i = 0; i < 7; i++) {
        const x = i < 5 ? lerp(770, 930, rng.next()) : lerp(520, 640, rng.next());
        drawTuft(ctx, { x, y: yAt(PERCH[i < 5 ? 0 : 1].lip, x) - rng.range(0, 12), len: rng.range(30, 64), n: 6, lean: rng.range(0, 0.5), tones: ['lime', 'yellow', 'light'], palette: 'dusk', light: LIGHT, seed: 110 + i });
      }
    },
  });
  return S.add({ name: 'perch', z: 990, tags: ['rocks'], sprites: [{ s }] });
}

export function addRocks(S) {
  addPerch(S);
  for (const r of ROCKS) {
    const box = bouldersBox([r], {}, 40);
    S.plane(r.z, {
      name: r.name, ...box, mat: ROCK_MAT, res: 1,
      edge: { width: 1.6, hi: 0.32, lo: 0.3, soft: 0.6 }, shadow: { blur: 14 },
      draw(ctx) {
        drawBoulder(ctx, { ...r, palette: STONE, light: LIGHT, contrast: 1.8, specks: 1.8, cracks: 1.3 });
// Deepen the flanks and the shaded side so the lit top planes stand out.
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        const top = r.y - r.h;
        ctx.fillStyle = linear(ctx, 0, top - r.w * 0.1, 0, r.y + r.w * 0.15, [[0, 'rgba(255,246,236,0.12)'], [0.3, 'rgba(0,0,0,0)'], [1, 'rgba(4,2,8,0.6)']]);
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = linear(ctx, r.x - r.w * 0.6, 0, r.x + r.w * 0.5, 0, [[0, 'rgba(4,2,8,0.4)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
        ctx.fillRect(box.x, box.y, box.w, box.h);
        // Wet, warm-dark slate like the reference, with pale rain-wet specks.
        ctx.fillStyle = 'rgba(22,15,12,0.28)';
        ctx.fillRect(box.x, box.y, box.w, box.h);
        const sr = new RNG(`specks:${r.name}`);
        for (let i = 0; i < r.w * r.h / 70; i++) {
          ctx.fillStyle = sr.chance(0.6) ? rgba(sr.chance(0.8) ? STONE.fleck : '#d8cfc4', sr.range(0.35, 0.85)) : rgba('#000000', sr.range(0.3, 0.5));
          ctx.fillRect(r.x + sr.range(-0.6, 0.6) * r.w, r.y - sr.range(-0.1, 1.05) * r.h, sr.range(0.7, 2.2), sr.range(0.6, 1.6));
        }
        ctx.restore();
        if (r.name === 'rock-fox') paintPerchMoss(ctx, r);
      },
    }, { tags: ['rocks'] });
  }
}

// Moss and grass on the fox's rock: a lip of moss along the top front edge, tufts at the
// right end where the rock meets the spray.
function paintPerchMoss(ctx, r) {
  const rng = new RNG('perch-moss');
  const top = r.y - r.h;
  for (let i = 0; i < 4; i++) {
    const x = lerp(r.x - r.w * 0.4, r.x + r.w * 0.42, i / 3) + rng.range(-14, 14);
    drawMoss(ctx, { x, y: top + r.w * r.tilt * 0.45 + rng.range(-4, 8), w: rng.range(60, 120), h: rng.range(14, 26), palette: 'dusk', light: LIGHT, seed: 90 + i });
  }
  for (let i = 0; i < 6; i++) {
    const x = lerp(r.x + 40, r.x + r.w * 0.5, rng.next());
    drawTuft(ctx, { x, y: top + rng.range(4, 30), len: rng.range(34, 70), n: 6, lean: rng.range(0, 0.5), tones: ['lime', 'yellow', 'light'], palette: 'dusk', light: LIGHT, seed: 110 + i });
  }
}

// --- surf --------------------------------------------------------------------------

// Torn white foam mound: overlapping lobes with blue-grey undersides, a shaded base band,
// fingers of spray clawing upward and flecks thrown off the top.
// A burst of surf on a rock, cut from torn white paper: blue-grey sheets of spray thrown
// up and fanning out behind, curling foam hooks at the top, a ragged white body with a
// flame-like top edge, crisp scalloped lobes and lace holes low down, churned water at
// its foot and a wide scatter of torn droplets and flecks over the rocks.
function paintSurf(ctx, b, light) {
  const rng = new RNG(`surf:${b.name}`);
  const shade = { color: 'rgba(36,58,92,0.5)', blur: 3, x: -light[0] * 2, y: 3 };
  const lean = b.lean ?? 0;
  const tear = (amp = 2.2) => ({ amp, freq: 0.26, fine: 1.1, seed: rng.int(1, 1e6), step: 2.5 });
  // Faint veil of fine spray.
  ctx.save();
  ctx.filter = `blur(${12 * (ctx.__res || 1)}px)`;
  ctx.fillStyle = 'rgba(232,240,248,0.12)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y - b.h * 0.8, b.w * 0.44, b.h * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Back sheets of spray, tall and fanning, shaded blue-grey so the white reads in front.
  const sheets = Math.max(4, Math.round(b.w / 45));
  for (let i = 0; i < sheets; i++) {
    const u = rng.range(-0.85, 0.85);
    const env = Math.pow(1 - Math.abs(u), 0.5);
    const len = b.h * rng.range(0.35, 0.7) * (0.4 + 0.75 * env);
    const pts = transform(leaf(len, len * rng.range(0.14, 0.24), { belly: 0.45, curl: Math.sign(u + lean || 1) * rng.range(0.6, 1.1), tipRound: 0.35, n: 14 }), {
      x: b.x + u * b.w * 0.4, y: b.y - b.h * (0.25 + 0.3 * env), rot: (u * 0.95 + lean) * 0.85 + rng.range(-0.18, 0.18),
    });
    piece(ctx, pts, {
      fill: linear(ctx, 0, b.y - b.h * 1.1, 0, b.y, [rng.chance(0.5) ? '#e9eff4' : '#d3dfe8', '#b4c6d6', '#8ca4bb']),
      torn: tear(2.4), shadow: shade,
    });
  }
  // Curling hooks of foam at the top of the burst, thrown outward.
  const hooks = Math.max(2, Math.round(b.w / 70));
  for (let i = 0; i < hooks; i++) {
    const u = lerp(-0.7, 0.7, i / (hooks - 1)) + rng.range(-0.1, 0.1);
    const R = b.h * rng.range(0.1, 0.19) * (0.7 + 0.5 * (1 - Math.abs(u)));
    foamHook(ctx, {
      x: b.x + u * b.w * 0.45, y: b.y - b.h * (0.5 + 0.38 * Math.pow(1 - Math.abs(u), 0.7)) * rng.range(0.9, 1.05),
      R, dir: u + lean * 0.6 >= 0 ? 1 : -1, th: R * 0.5, sweep: rng.range(3.2, 4.1), rng, light,
      hollow: 'rgba(120,146,172,0.9)', claws: 2, flecks: 10, scale: 1,
    });
  }
  // The body: ragged white mass with a flame-like top edge.
  // Froth: a run of scallops of different sizes along a lumpy dome.
  const top = [];
  const xL = b.x - b.w * 0.56, xR = b.x + b.w * 0.56;
  for (let x = xL; x < xR;) {
    const step = rng.range(10, 28);
    const xe = Math.min(xR, x + step);
    const level = (xx) => {
      const u = ((xx - b.x) / (b.w * 0.56));
      return b.y - 6 - b.h * 0.58 * Math.pow(Math.max(0, 1 - u * u), 0.7) * (0.75 + 0.3 * Math.sin(xx * 0.037 + b.x));
    };
    for (let k = 0; k <= 5; k++) {
      const xx = lerp(x, xe, k / 5);
      top.push([xx, lerp(level(x), level(xe), k / 5) - Math.sin(Math.PI * k / 5) * (xe - x) * rng.range(0.32, 0.5)]);
    }
    x = xe;
  }
  piece(ctx, [...top, [b.x + b.w * 0.58, b.y + 12], [b.x - b.w * 0.58, b.y + 12]], {
    fill: linear(ctx, 0, b.y - b.h * 0.62, 0, b.y + 10, ['#ffffff', '#eef3f6', '#c6d4df', '#8aa2b8']),
    torn: tear(2.6), shadow: shade,
  });
  // Crisp scalloped lobes in the lower body, top first so lower ones overlap.
  const lobes = [];
  const n = Math.round(b.w / 16);
  for (let i = 0; i < n; i++) {
    const u = rng.range(-1, 1);
    const env = Math.pow(1 - Math.abs(u), 0.5);
    const r = b.h * rng.range(0.07, 0.15) * (0.6 + env);
    lobes.push({ x: b.x + u * b.w * 0.52, y: b.y - env * b.h * rng.range(0.05, 0.5) + r * 0.3, r });
  }
  lobes.sort((p, q) => p.y - q.y);
  for (const l of lobes) {
    const low = clamp((l.y - (b.y - b.h * 0.6)) / (b.h * 0.6));
    const bumps = rng.int(4, 7), ph = rng.range(0, TAU);
    const pts = [];
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU;
      const rr = l.r * (0.8 + 0.22 * Math.abs(Math.sin(a * bumps * 0.5 + ph)));
      pts.push([l.x + Math.cos(a) * rr * 1.3, l.y + Math.sin(a) * rr * 0.8]);
    }
    piece(ctx, pts, {
      fill: linear(ctx, 0, l.y - l.r, 0, l.y + l.r, ['#ffffff', mix('#f2f6f8', '#d4e0e9', low), mix('#c4d3df', '#8fa7bd', low)]),
      torn: tear(1.6), shadow: shade,
    });
  }
  // Lace holes: the dark water showing through the foam low down.
  for (let i = 0; i < Math.round(b.w / 22); i++) {
    const x = b.x + rng.range(-0.45, 0.45) * b.w, y = b.y - rng.range(2, b.h * 0.3);
    const r = rng.range(2, 6);
    const pts = Array.from({ length: 9 }, (_, k) => [x + Math.cos(k / 9 * TAU) * r * rng.range(1.2, 2.2), y + Math.sin(k / 9 * TAU) * r * rng.range(0.6, 1)]);
    piece(ctx, pts, { fill: rng.pick(['#5d7a98', '#46627e', '#7c96ae']), torn: tear(0.8) });
  }
  // Base band of churned water.
  const base = [];
  for (let i = 0; i <= 24; i++) {
    const x = b.x - b.w * 0.6 + (b.w * 1.2) * (i / 24);
    base.push([x, b.y - 10 - 8 * Math.sin(i * 1.7) - 6 * rng.next()]);
  }
  piece(ctx, [...base, [b.x + b.w * 0.6, b.y + 14], [b.x - b.w * 0.6, b.y + 14]], {
    fill: linear(ctx, 0, b.y - 20, 0, b.y + 14, ['#f2f6f8', '#c6d4df', '#7f98ae']),
    torn: tear(2), shadow: shade,
  });
  // Torn droplets and flecks thrown wide over the rocks.
  for (let i = 0; i < b.w / 10; i++) {
    const u = rng.range(-1, 1);
    const x = b.x + u * b.w * 0.7, y = b.y - b.h * (1.05 - Math.abs(u) * 0.55) * rng.range(0.3, 1.3);
    const r = rng.range(2, 5);
    const pts = Array.from({ length: 5 }, (_, k) => [x + Math.cos(k / 5 * TAU + u) * r * rng.range(0.6, 1.4), y + Math.sin(k / 5 * TAU + u) * r * rng.range(0.6, 1.4)]);
    piece(ctx, pts, { fill: rng.chance(0.7) ? '#f4f7f8' : '#d0dce6', shadow: shade });
  }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < b.w / 1.3; i++) {
    const u = rng.range(-1, 1);
    const x = b.x + u * b.w * 0.75, y = b.y - b.h * (1.1 - Math.abs(u) * 0.6) * rng.range(0.2, 1.3);
    ctx.beginPath();
    ctx.arc(x, y, rng.range(0.7, 2.6), 0, TAU);
    ctx.fill();
  }
}

// Surf bursts (base centre x, y; size w, h). Each rides the swell: it heaves up, spreads
// and throws spray when its surge peaks, then sinks back. Phases put the big bursts
// near the top of their surge at the rest pose (t = 4.25).
const SURF = [
  { name: 'surf-D', z: 1040, x: 1030, y: 800, w: 380, h: 180, phase: 0.68, lean: 0.15 },
  { name: 'surf-Dl', z: 995, x: 905, y: 745, w: 190, h: 150, phase: 0.9, lean: -0.25 },
  { name: 'surf-EG', z: 930, x: 1255, y: 1000, w: 330, h: 205, phase: 0.74 },
  { name: 'surf-GR', z: 905, x: 1640, y: 1012, w: 260, h: 115, phase: 0.55, lean: 0.2 },
  { name: 'surf-low', z: 835, x: 990, y: 1100, w: 380, h: 120, phase: 0.85 },
  { name: 'surf-Er', z: 950, x: 1215, y: 905, w: 160, h: 130, phase: 0.62, lean: 0.1 },
];

export function addSurf(S) {
  const layers = [];
  for (const b of SURF) {
    const pad = 40;
    const s = S.sprite({
      name: b.name, x: b.x - b.w * 0.8 - pad, y: b.y - b.h * 1.95 - pad, w: b.w * 1.6 + pad * 2, h: b.h * 1.95 + pad * 2 + 20,
      res: 1, mat: [{ tex: 'fiber', amt: 0.6 }, { tex: 'crumple', amt: 0.4, scale: 0.4 }],
      edge: { width: 1, hi: 0.25, lo: 0.12 }, shadow: { blur: 10 },
      draw: (ctx) => paintSurf(ctx, b, LIGHT),
    });
    // Spray: droplets launched from the crest, each on its own slot in the swell cycle.
    const rng = new RNG(`spray:${b.name}`);
    const drops = Array.from({ length: Math.round(b.w / 5) }, () => ({
      x: b.x + rng.range(-0.45, 0.45) * b.w, y: b.y - b.h * rng.range(0.5, 0.9),
      vx: rng.range(-60, 60) + 70 * (b.lean ?? 0) * 3, vy: rng.range(120, 300) * (b.h / 150),
      off: rng.range(0.25, 0.65), life: rng.range(0.7, 1.3), r: rng.range(0.8, 2.8),
    }));
    layers.push(S.add({
      name: b.name, z: b.z, tags: ['sea', 'surf'],
      render(ctx, t, env) {
        const k = surge(t, b.phase);
        const sy = 0.74 + 0.28 * Math.pow(k, 1.4), sx = 0.95 + 0.08 * k;
        drawSprites(ctx, [{ s, ax: b.x, ay: b.y + 10, x: b.x, y: b.y + 10, sx, sy, alpha: 0.88 + 0.12 * k }], env.shadow);
        ctx.fillStyle = '#f4f8fa';
        for (const d of drops) {
          const a = ((t / SWELL + b.phase - d.off) % 1 + 1) % 1 * SWELL;
          if (a > d.life) continue;
          const f = Math.sin(Math.PI * a / d.life);
          ctx.globalAlpha = 0.85 * f * (env.alpha ?? 1);
          ctx.beginPath();
          ctx.arc(d.x + d.vx * a, d.y - d.vy * a + 260 * a * a, d.r, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = env.alpha ?? 1;
        glow(ctx, b.x, b.y - b.h * 0.5, b.w * 0.7, '#cfe0ff', 0.08 + 0.1 * k);
      },
    }));
  }
  return layers;
}

// --- foreground --------------------------------------------------------------------

// Scarlet berry plumes (astilbe cut in rowan-berry reds). Item palettes merge onto night.
const LEAVES = {
  ...FLORA_PALETTES.dusk,
  leaf: { light: '#93b846', mid: '#5a9238', dark: '#2c6230', deep: '#14361c', yellow: '#d6b23a', lime: '#a6c440' },
};
const BERRY = {
  astilbe: { florets: ['#5e100c', '#8e1c14', '#b8301e', '#dc5028'], light: '#f07a40', dark: '#3a0806', stem: '#4a2a1a' },
};

export function addForeground(S) {
  const bed = generateBed({
    region: [-150, 660, 780, 1080], anchor: 'left', density: 1.05,
    mix: { astilbe: 6, leaf: 12, blade: 1 }, seed: 's07-bed',
  });
  for (const row of bed.rows) for (const it of row) {
    if (it.type === 'leaf') {
      it.len = (it.len ?? 120) * 1.3;
      it.width = Math.max(it.width ?? 0.22, 0.27);
      const r = ((it.x * 7.13 + it.y * 3.7) % 10 + 10) % 10;
      if (r < 1.2) it.color = 'yellow';
      else if (r < 5) it.color = 'light';
    }
    if (it.type === 'astilbe') { it.h = (it.h ?? 150) * 0.85; it.w = (it.w ?? 64) * 1.8; it.palette = BERRY; }
  }
  // Ferns and moss draping the front of the perch, behind the leaves.
  bed.rows.splice(1, 0, [
    { type: 'fern', x: 330, y: 760, len: 230, rot: 0.9, curl: 0.35, color: 'light', seed: 3 },
    { type: 'fern', x: 430, y: 790, len: 200, rot: 1.25, curl: 0.3, color: 'light', seed: 4 },
    { type: 'fern', x: 250, y: 720, len: 210, rot: 0.6, curl: 0.3, color: 'mid', seed: 5 },
    { type: 'tuft', x: 560, y: 800, len: 90, n: 8, lean: 0.3, tones: ['lime', 'yellow', 'light'], seed: 6 },
    { type: 'tuft', x: 760, y: 940, len: 110, n: 8, lean: 0.4, tones: ['lime', 'light', 'mid'], seed: 7 },
    { type: 'tuft', x: 905, y: 1080, len: 130, n: 9, lean: 0.35, tones: ['lime', 'light', 'mid'], seed: 8 },
  ]);
  return addFlowerBed(S, {
    rows: bed.rows, palette: LEAVES, z: 500, planes: 2, depth: 110, res: 1,
    wind: { amp: 0.06, period: 3.4, gust: 1.6, speed: 320 },
  });
}

// Leaves and ferns spilling down the left side between the big spruce and the perch.
export function addLeftFoliage(S) {
  const bed = { rows: [[
    { type: 'fern', x: 40, y: 660, len: 250, rot: 0.75, curl: 0.3, color: 'light', seed: 11 },
    { type: 'fern', x: 170, y: 640, len: 210, rot: 1.0, curl: 0.3, color: 'light', seed: 12 },
    { type: 'fern', x: -20, y: 580, len: 230, rot: 0.55, curl: 0.25, color: 'mid', seed: 13 },
    { type: 'fern', x: 260, y: 650, len: 170, rot: 1.2, curl: 0.3, color: 'light', seed: 14 },
  ], [
    { type: 'tuft', x: 120, y: 690, len: 110, n: 9, lean: 0.3, tones: ['lime', 'yellow', 'light'], seed: 15 },
    { type: 'tuft', x: 300, y: 700, len: 90, n: 8, lean: 0.4, tones: ['lime', 'light', 'yellow'], seed: 16 },
    { type: 'leaf', x: -10, y: 720, len: 150, width: 0.24, rot: 0.9, color: 'mid', seed: 17 },
    { type: 'leaf', x: 60, y: 740, len: 130, width: 0.22, rot: 0.4, color: 'light', seed: 18 },
    { type: 'leaf', x: 10, y: 640, len: 170, width: 0.3, rot: 1.15, color: 'light', seed: 19 },
    { type: 'leaf', x: 140, y: 610, len: 150, width: 0.3, rot: -0.35, color: 'light', seed: 20 },
    { type: 'leaf', x: 230, y: 700, len: 140, width: 0.28, rot: 0.75, color: 'lime', seed: 21 },
    { type: 'astilbe', x: 70, y: 770, h: 120, w: 120, palette: BERRY, seed: 22 },
    { type: 'astilbe', x: 250, y: 790, h: 110, w: 110, palette: BERRY, seed: 23 },
  ]] };  return addFlowerBed(S, { rows: bed.rows, palette: LEAVES, z: 700, planes: 1, res: 1, wind: { amp: 0.05, period: 3.6, gust: 1.4 } });
}

// The star's reflection: a soft gold column laid over the sea (screen), broken into
// horizontal glints, breathing with the star.
export function addReflectionGlow(S) {
  const s = S.sprite({
    name: 'reflection-glow', x: 1250, y: 560, w: 500, h: 300, mat: 'none', edge: false, shadow: false,
    draw(ctx) {
      const rng = new RNG('refl-glow');
      ctx.filter = 'blur(6px)';
      for (let i = 0; i < 70; i++) {
        const v = Math.pow(rng.next(), 1.3);
        const y = 574 + v * 250, half = lerp(55, 120, v) * rng.range(0.3, 1);
        const x = 1493 + rng.range(-1, 1) * lerp(40, 90, v);
        ctx.fillStyle = rgba(rng.chance(0.5) ? '#ffe2a0' : '#f0c878', (1 - v * 0.8) * rng.range(0.4, 0.85));
        ctx.beginPath();
        ctx.ellipse(x, y, half, lerp(2, 5, v), 0, 0, TAU);
        ctx.fill();
      }
      ctx.filter = 'blur(26px)';
      ctx.fillStyle = radial(ctx, 1493, 580, 0, 200, [[0, 'rgba(255,224,160,0.7)'], [1, 'rgba(255,224,160,0)']]);
      ctx.fillRect(1250, 560, 500, 300);
      ctx.filter = 'none';
    },
  });
  return S.add({ name: 'reflection-glow', z: 1050, blend: 'screen', sprites: [{ s }], alpha: (t) => 0.85 + 0.15 * Math.sin(TAU * t / 3.7) });
}
