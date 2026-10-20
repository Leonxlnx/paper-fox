// Clouds family test sheet. Five 1.6-second segments, each recreating the clouds of one
// reference at their original positions and scale (film px = ref px * 1.1483):
//   0.0-1.6  ref02 night: moon bank and the long left cloud
//   1.6-3.2  ref01 sunset: towering cloud, streaks and small clouds by the low sun
//   3.2-4.8  ref10 dawn: cream banks over lavender, streaks
//   4.8-6.4  ref07 storm: ceiling with the lit opening, blue-grey banks, mist bands
//   6.4-8.0  ref08 cloud sea filling the valleys, cloud wall on the left
// Skies, moon, sun, star and hills are plain stand-ins so the clouds can be judged in
// context; the real ones come from the sky and terrain families.

import { Scene, W, H } from '../core/stage.js';
import { piece, linear, radial, glow } from '../core/piece.js';
import { ellipse, ridge, closeDown, TAU } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { smoothstep } from '../core/ease.js';
import { addCloud, addStreak, addCloudSea } from '../elements/clouds.js';
import { addStormCeiling, addMist, DECKLE } from '../elements/clouds-storm.js';

const SEG = 1.6;
const FADE = 0.12;
const N = 5;
const mid = (i) => i * SEG + SEG / 2;

function segAlpha(i) {
  const a = i * SEG, b = a + SEG;
  return (t) => (i === 0 ? 1 : smoothstep(a - FADE, a + FADE, t)) * (i === N - 1 ? 1 : 1 - smoothstep(b - FADE, b + FADE, t));
}

// Run fn(S) and gate every plane it adds by the segment's visibility.
function segment(S, i, fn) {
  const first = S.layers.length;
  fn(S, mid(i));
  const vis = segAlpha(i);
  for (const L of S.layers.slice(first)) {
    const base = L.alpha;
    L.alpha = typeof base === 'function' ? (t, env) => base(t, env) * vis(t) : (t) => base * vis(t);
  }
}

// Stand-in sky: vertical gradient, an optional warm/cool halo, gold flecks at night.
function sky(S, { stops, halo = null, flecksN = 0 }) {
  S.plane(20000, {
    name: 'sky', x: -260, y: -260, w: W + 520, h: H + 520, edge: false, shadow: false,
    mat: [{ tex: 'fiber', amt: 0.7 }, { tex: 'crumple', amt: 0.3, scale: 0.28 }],
    draw(ctx) {
      ctx.fillStyle = linear(ctx, 0, 0, 0, H, stops);
      ctx.fillRect(-260, -260, W + 520, H + 520);
      if (halo) {
        ctx.fillStyle = radial(ctx, halo.x, halo.y, 0, halo.r, [[0, halo.color], [1, 'rgba(0,0,0,0)']]);
        ctx.fillRect(-260, -260, W + 520, H + 520);
      }
      if (flecksN) flecks(ctx, -260, -260, W + 520, H * 0.7, flecksN, 5, { max: 1.1, alpha: 0.6 });
    },
  });
}

function disc(S, { x, y, r, colors, glowColor, glowR, z = 14000 }) {
  S.add({ name: 'disc-glow', z, blend: 'lighter', render(ctx) { glow(ctx, x, y, glowR, glowColor, 0.45); } });
  S.plane(z, {
    name: 'disc', x: x - r - 30, y: y - r - 30, w: r * 2 + 60, h: r * 2 + 60, mat: 'crumpled', shadow: { blur: 16 },
    draw(ctx) { piece(ctx, ellipse(x, y, r, r, 96), { fill: radial(ctx, x - r * 0.3, y - r * 0.3, 5, r * 1.3, colors) }); },
  });
}

function star4(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.22;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

// Plain paper ridge standing in for mountains or hills.
function hills(S, { z, y, amp, freq = 0.003, sharp = 0.5, colors, seed }) {
  S.plane(z, {
    name: 'hills', x: -260, y: y - amp * 2.5, w: W + 520, h: H - y + amp * 2.5 + 260, mat: 'paper', shadow: { blur: 12 },
    draw(ctx) {
      const top = ridge(-260, W + 260, y, { amp, freq, sharp, seed, step: 8 });
      piece(ctx, closeDown(top, H + 260), { fill: linear(ctx, 0, y - amp, 0, H, colors) });
    },
  });
}

export default function () {
  return new Scene({
    id: 'clouds',
    duration: SEG * N,
    background: '#0f1a38',
    light: [0.55, -0.83],
    shadow: { alpha: 0.5, dist: 8, blur: 10 },
    // No vignette: post.js darkens corners by (1 - vignette), which would skew colour checks.
    post: { bloom: 0.3, threshold: 0.66, vignette: 0, grain: 0.035 },
    build(S) {
      // ref02: navy night, moon behind the right bank.
      segment(S, 0, (S, t0) => {
        sky(S, { stops: ['#0d1834', '#17234a', '#1d2a55'], halo: { x: 1562, y: 166, r: 520, color: 'rgba(60,78,130,0.55)' }, flecksN: 700 });
        disc(S, { x: 1562, y: 166, r: 118, colors: ['#fff1cc', '#fbe1aa', '#eecb8c'], glowColor: '#ffe6b0', glowR: 380 });
        addCloud(S, {
          name: 'moonbank', z: 9000, t0, x: 1382, y: 137, w: 640, h: 170, tiers: 3, seed: 'ref02-moonbank',
          palette: 'night', light: [-0.45, -0.89],
          warm: { x: 1562, y: 166, r: 260, color: '#ffd7a8', amt: 0.2 },
          tierOpts: [
            {
              crown: [[1405, 288, 24, 0.55], [1452, 285, 26, 0.55], [1500, 280, 27, 0.6], [1542, 260, 30, 0.95], [1595, 260, 27], [1662, 245, 55], [1792, 214, 77], [1905, 215, 76], [2000, 222, 70]],
              lobes: 0, tone: 0.12, merge: true,
            },
            { profile: [[0.28, 0], [0.31, 0.25], [0.42, 0.38], [0.52, 0.5], [0.6, 0.62], [0.68, 0.8], [0.8, 0.82], [0.88, 0.74], [1, 0.75]], size: 0.36, minR: 14, lobes: 6, lumpy: 0.15, tone: 0.42 },
            { profile: [[0, 0.04], [0.12, 0.07], [0.3, 0.11], [0.4, 0.2], [0.5, 0.28], [0.6, 0.34], [0.8, 0.32], [1, 0.34]], size: 0.6, minR: 12, lobes: 6, lumpy: 0.15, tone: 0.5, under: true, underR: 0.6 },
          ],
        });
        addCloud(S, {
          name: 'leftcloud', z: 9500, t0, x: 290, y: 0, w: 710, h: 195, tiers: 3, seed: 'ref02-left',
          palette: 'night', light: [0.8, -0.6], lit: 0.55,
          tierOpts: [
            {
              crown: [[310, 100, 45], [360, 62, 60], [450, 40, 80], [540, 30, 75], [620, 92, 30], [717, 114, 72], [815, 143, 38], [870, 168, 22, 0.8], [905, 171, 20, 0.7], [940, 174, 18, 0.62], [975, 178, 15, 0.55]],
              lobes: 0, tone: 0.2, merge: true,
            },
            { profile: [[0, 0.62], [0.06, 0.66], [0.13, 0.58], [0.225, 0.55], [0.366, 0.5], [0.507, 0.36], [0.6, 0.22], [0.66, 0]], size: 0.4, minR: 14, lobes: 6, lumpy: 0.15, tone: 0.5, dy: 40, under: true },
            { profile: [[0.42, 0], [0.47, 0.16], [0.6, 0.22], [0.75, 0.2], [0.9, 0.13], [1, 0.05]], size: 0.75, minR: 12, lobes: 5, lumpy: 0.12, tone: 0.2, under: true, underR: 0.6 },
          ],
        });
      });
      // ref01: periwinkle to peach dusk, sun low on the right.
      segment(S, 1, (S, t0) => {
        sky(S, { stops: [[0, '#5268b4'], [0.12, '#7a74bc'], [0.24, '#d690a8'], [0.36, '#fbb27c'], [0.5, '#ffc88a']], halo: { x: 1626, y: 363, r: 700, color: 'rgba(255,190,120,0.55)' } });
        disc(S, { x: 1626, y: 363, r: 84, colors: ['#fff6d8', '#ffe2a0', '#fbc77a'], glowColor: '#ffd090', glowR: 420, z: 13000 });
        hills(S, { z: 5000, y: 330, amp: 90, freq: 0.004, sharp: 0.85, colors: ['#9c8ac8', '#6a68ab'], seed: 3 });
        const sun = [1626, 363];
        const torn = { amp: 1.6, freq: 0.12 }, rim = { width: 1.2, color: '#ffe3b8' };
        addCloud(S, {
          name: 'tower', z: 9000, t0, x: 287, y: 10, w: 884, h: 270, tiers: 2, seed: 'ref01-tower',
          palette: 'sunset', lightPos: sun, light: [0.9, 0.42], flatBase: true, accent: 0.3,
          tierOpts: [
            {
              crown: [[300, 60, 55], [350, 20, 70], [430, 10, 75], [478, 92, 35], [522, 100, 40], [565, 108, 35], [640, 97, 47], [740, 93, 70], [833, 122, 50], [905, 192, 38], [962, 200, 42], [1020, 207, 38], [1075, 242, 26, 0.8], [1120, 252, 22, 0.7], [1165, 260, 18, 0.6]],
              lobes: 4, lumpy: 0.05, tone: 0.34, merge: true,
            },
            { profile: [[0, 0.2], [0.03, 0.62], [0.08, 0.74], [0.18, 0.67], [0.31, 0.56], [0.41, 0.48], [0.535, 0.41], [0.65, 0.3], [0.75, 0.2], [0.8, 0]], size: 0.42, minR: 18, spacing: 1.3, lobes: 6, lumpy: 0.1, tone: 0.44 },
            { profile: [[0, 0.3], [0.2, 0.26], [0.45, 0.22], [0.7, 0.2], [0.88, 0.12], [0.95, 0]], size: 0.6, minR: 14, lobes: 5, lumpy: 0.1, tone: 0.4 },
          ],
        });
        addStreak(S, {
          name: 'streakA', z: 8000, t0, x: 1450, y: 50, w: 520, h: 95, seed: 'ref01-streakA', palette: 'sunset',
          lightPos: sun, light: [0, 1], torn, rim,
          tierOpts: [
            { profile: [[0, 0], [0.12, 0.25], [0.3, 0.48], [0.4, 0.72], [0.5, 0.5], [0.65, 0.55], [0.8, 0.82], [0.92, 1], [1, 1]], tone: 0.42, dy: -18 },
            { profile: [[0.15, 0], [0.22, 0.16], [0.4, 0.36], [0.6, 0.4], [0.66, 0.3], [0.7, 0]], tone: 0.12 },
          ],
        });
        addStreak(S, {
          name: 'smallB', z: 8500, t0, x: 1295, y: 165, w: 240, h: 58, seed: 'ref01-small', palette: 'sunset',
          lightPos: sun, light: [0.3, 0.95], torn, rim,
          tierOpts: [
            { profile: [[0.25, 0], [0.33, 0.6], [0.45, 0.95], [0.58, 0.8], [0.7, 0.3], [0.78, 0]], tone: 0.4, dy: -14, size: 0.45, lobes: 5, lumpy: 0.08 },
            { profile: [[0, 0], [0.1, 0.22], [0.4, 0.42], [0.7, 0.36], [0.9, 0.18], [1, 0]], tone: 0.1 },
          ],
        });
        addCloud(S, {
          name: 'puffsC', z: 8500, t0, x: 1675, y: 125, w: 330, h: 125, tiers: 3, seed: 'ref01-puffs', palette: 'sunset',
          lightPos: sun, light: [-0.3, 0.95], flatBase: true, merge: true, torn, rim,
          tierOpts: [
            { crown: [[1840, 190, 38], [1905, 165, 48], [1970, 160, 50]], lobes: 4, lumpy: 0.05, tone: 0.18 },
            { profile: [[0.1, 0], [0.18, 0.2], [0.4, 0.32], [0.65, 0.36], [0.8, 0.3], [1, 0.32]], size: 0.5, tone: 0.32, lobes: 5, lumpy: 0.08 },
            { profile: [[0, 0], [0.05, 0.08], [0.35, 0.12], [0.55, 0.1], [0.7, 0]], body: 1, tone: 0.12 },
          ],
        });
        addStreak(S, {
          name: 'streakD', z: 7500, t0, x: 1260, y: 250, w: 290, h: 26, seed: 'ref01-streakD', palette: 'sunset',
          profile: 'lens', lightPos: sun, light: [0.5, 0.86], torn, rim, tiers: 1, tones: [0.12],
        });
      });
      // ref10: blue sky warming to gold at the horizon, sun rising behind the hills.
      segment(S, 2, (S, t0) => {
        sky(S, { stops: [[0, '#5a8fc4'], [0.14, '#86a2c4'], [0.26, '#e9c08e'], [0.4, '#fcc677'], [0.55, '#ffd28a']], halo: { x: 1507, y: 356, r: 760, color: 'rgba(255,210,130,0.55)' } });
        disc(S, { x: 1507, y: 356, r: 80, colors: ['#fff8e0', '#ffeab0', '#fcd789'], glowColor: '#ffe0a0', glowR: 420, z: 13000 });
        const sun = [1507, 356];
        addCloud(S, {
          name: 'lavback', z: 10000, t0, x: 270, y: 46, w: 660, h: 240, tiers: 2, seed: 'ref10-back',
          profile: [[0, 0.55], [0.15, 0.8], [0.3, 1], [0.45, 0.85], [0.62, 0.62], [0.8, 0.4], [1, 0.25]],
          frontHeight: 0.7, size: 0.4, minR: 12, palette: 'dawn', tone: 0.5, flatBase: true, lightPos: sun, light: [0.9, 0.3],
          lobes: [5, 6], lumpy: 0.05,
        });
        addCloud(S, {
          name: 'creamtop', z: 9000, t0, x: 520, y: 14, w: 730, h: 134, tiers: 2, seed: 'ref10-top',
          profile: [[0, 0.3], [0.12, 0.62], [0.25, 0.85], [0.42, 0.9], [0.55, 1], [0.66, 0.62], [0.8, 0.3], [1, 0.08]],
          frontHeight: 0.55, size: 0.46, minR: 8, palette: 'dawn', flatBase: true, lightPos: sun, light: [0.6, 0.8],
          lobes: [0, 5], lumpy: [0.02, 0.05],
        });
        addCloud(S, {
          name: 'creamlow', z: 9200, t0, x: 840, y: 150, w: 480, h: 100, tiers: 2, seed: 'ref10-low',
          profile: [[0, 0.15], [0.2, 0.5], [0.45, 0.8], [0.65, 1], [0.85, 0.6], [1, 0.2]],
          frontHeight: 0.6, size: 0.45, minR: 8, palette: 'dawn', flatBase: true, lightPos: sun, light: [0.6, 0.8],
          lobes: [0, 5], lumpy: [0.02, 0.05],
        });
        addCloud(S, {
          name: 'creamleft', z: 9100, t0, x: 250, y: -60, w: 420, h: 128, tiers: 2, seed: 'ref10-left',
          profile: [[0, 0.6], [0.3, 1], [0.6, 0.9], [1, 0.4]], size: 0.45, minR: 8, palette: 'dawn', flatBase: true, lightPos: sun,
        });
        addStreak(S, { name: 'streakTop', z: 8000, t0, x: 1600, y: -20, w: 360, h: 112, seed: 'ref10-streak', palette: 'dawn', lightPos: sun, light: [-0.3, 0.95] });
        addCloud(S, {
          name: 'rightcu', z: 8500, t0, x: 1650, y: 110, w: 330, h: 160, tiers: 3, seed: 'ref10-right', profile: 'rise',
          size: 0.42, minR: 6, flatBase: true, palette: 'dawn', lightPos: sun, light: [-0.4, 0.9], lobes: [0, 5, 6], lumpy: 0.04,
        });
        addStreak(S, { name: 'streakLow', z: 7500, t0, x: 1270, y: 248, w: 150, h: 34, seed: 'ref10-low-streak', profile: 'lens', palette: 'dawn', lightPos: sun });
      });

      // ref07: storm ceiling with the opening, blue-grey banks on the left, mist below.
      segment(S, 3, (S, t0) => {
        sky(S, { stops: [[0, '#141d30'], [0.3, '#26324c'], [0.5, '#3b4c68'], [1, '#2a3550']] });
        hills(S, { z: 5000, y: 360, amp: 80, freq: 0.0035, sharp: 0.9, colors: ['#8e8fc0', '#4a5078'], seed: 11 });
        hills(S, { z: 2200, y: 470, amp: 30, freq: 0.006, sharp: 0.2, colors: ['#1d3338', '#0f1d22'], seed: 12 });
        S.add({ name: 'star-glow', z: 14000, blend: 'lighter', render(ctx) { glow(ctx, 1501, 138, 150, '#ffd590', 0.8); } });
        S.plane(14000, {
          name: 'star', x: 1430, y: 60, w: 150, h: 160, mat: 'paper', shadow: { blur: 6 },
          draw(ctx) { piece(ctx, star4(1501, 138, 58), { fill: '#fde6b0' }); },
        });
        addStormCeiling(S, { z: 9000, t0, seed: 'ref07', gap: { x: 1505, y: 140, rx: 175, ry: 125 }, bottom: 320, sag: 30 });
        const bank = { palette: 'stormBank', light: [0.9, -0.35], torn: { amp: 2.2, freq: 0.09, fine: 1.2, step: 2.5 }, rim: { width: 1 }, merge: true, accent: 0.25, lobes: 3, lumpy: 0.06, creases: 2 };
        addCloud(S, {
          ...bank, name: 'bankA', z: 7600, t0, x: 330, y: 80, w: 620, h: 200, tiers: 2, seed: 'ref07-bankA',
          tierOpts: [
            { profile: [[0, 0.3], [0.1, 0.62], [0.3, 0.85], [0.42, 0.98], [0.55, 0.7], [0.7, 0.52], [0.85, 0.35], [1, 0.2]], size: 0.42, minR: 34, spacing: 1.1, tone: 0.42 },
            { profile: [[0.05, 0.2], [0.15, 0.42], [0.35, 0.52], [0.55, 0.45], [0.75, 0.35], [0.95, 0.2]], size: 0.5, minR: 30, tone: 0.32, under: true, underR: 0.45 },
          ],
        });
        addCloud(S, {
          ...bank, name: 'bankB', z: 7400, t0, x: 620, y: 130, w: 560, h: 200, tiers: 2, seed: 'ref07-bankB',
          tierOpts: [
            { profile: [[0, 0.5], [0.15, 0.85], [0.3, 1], [0.45, 0.8], [0.62, 0.55], [0.8, 0.4], [1, 0.25]], size: 0.42, minR: 34, spacing: 1.1, tone: 0.36 },
            { profile: [[0.1, 0.3], [0.3, 0.42], [0.5, 0.36], [0.7, 0.28], [0.9, 0.22], [1, 0.12]], size: 0.5, minR: 26, tone: 0.24, under: true, underR: 0.45 },
          ],
        });
        addMist(S, { name: 'mist-far', z: 3000, t0, x: -300, y: 330, w: 2520, h: 170, seed: 'ref07-mist1', color: '#a3acc8', alpha: 0.7 });
        addMist(S, { name: 'mist-near', z: 1800, t0, x: -300, y: 420, w: 2520, h: 160, seed: 'ref07-mist2', color: '#b8c0d8', alpha: 0.65 });
      });
      // ref08: cloud sea between night hills, a cloud wall behind the left trees.
      segment(S, 4, (S, t0) => {
        sky(S, { stops: [[0, '#0d1838'], [0.35, '#1e2c5c'], [0.6, '#3a4a80']], flecksN: 500 });
        addCloud(S, {
          name: 'wall', z: 9000, t0, x: 120, y: 20, w: 760, h: 300, tiers: 3, seed: 'ref08-wall', palette: 'sea',
          profile: [[0, 0.95], [0.2, 1], [0.4, 0.85], [0.6, 0.62], [0.8, 0.4], [1, 0.25]], size: 0.3, minR: 14, light: [0.7, -0.7],
        });
        hills(S, { z: 5000, y: 420, amp: 120, freq: 0.003, sharp: 0.85, colors: ['#5b5f9e', '#30386a'], seed: 21 });
        addCloudSea(S, { name: 'valley', x: 940, w: 1100, y0: 500, y1: 560, h0: 50, h1: 70, rows: 2, z0: 4200, z1: 3600, seed: 'ref08-valley', light: [0.6, -0.8] });
        hills(S, { z: 3000, y: 560, amp: 70, freq: 0.004, sharp: 0.5, colors: ['#2c4a5c', '#152834'], seed: 22 });
        addCloudSea(S, { name: 'under', x: 700, w: 1000, y0: 760, y1: 1000, h0: 90, h1: 150, rows: 3, z0: 2200, z1: 1300, seed: 'ref08-under', light: [0.6, -0.8] });
      });
    },
  });
}
