// Terrain test sheet. Three 2 s segments, each recreating a reference crop at its
// film position: the ref05 snow range, the ref02 mountains/hills/rocks band and the
// ref04 canyon. The camera sways through each segment and rests at its midpoint.
// Sky and water here are flat stand-ins; they belong to other element families.

import { Scene, W, H } from '../core/stage.js';
import { piece, linear } from '../core/piece.js';
import { flecks } from '../core/paper.js';
import { clamp, smoothstep } from '../core/ease.js';
import { addRange, addHills, addBoulders, addCliff, drawTrail, drawCliff } from '../elements/terrain.js';

const SEG = 2;
const FADE = 0.35;

// Opacity of segment i at time t: crossfades at the joins.
const seg = (i) => (t) => {
  const a = i * SEG, b = a + SEG;
  const fin = i === 0 ? 1 : smoothstep(a - FADE / 2, a + FADE / 2, t);
  const fout = i === 2 ? 1 : 1 - smoothstep(b - FADE / 2, b + FADE / 2, t);
  return clamp(Math.min(fin, fout));
};

function sky(S, i, stops) {
  S.plane(20000, {
    name: `sky${i}`, x: -300, y: -300, w: W + 600, h: H + 600, mat: 'sky', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = linear(ctx, 0, -300, 0, H + 300, stops);
      ctx.fillRect(-300, -300, W + 600, H + 600);
      flecks(ctx, -300, -300, W + 600, H * 0.7, 500, 5 + i, { max: 1.2 });
    },
  }, { alpha: seg(i) });
}

// Flat stand-in for a lake or river surface.
function water(S, i, z, pts, stops) {
  const top = Math.min(...pts.map((p) => p[1]));
  S.plane(z, {
    name: `water${i}`, x: -300, y: top - 20, w: W + 600, h: H + 320 - top, mat: 'smooth', edge: false, shadow: false,
    draw(ctx) { piece(ctx, pts, { fill: linear(ctx, 0, top, 0, H, stops) }); },
  }, { alpha: seg(i) });
}

// ref05: the snow range above the valley, the fox's granite cliff and the rocky trail.
function snowRange(S) {
  const A = seg(0);
  sky(S, 0, ['#0c1a3c', '#13234e', '#1b2a5c']);
  const L = [0.5, -0.866];
  addRange(S, {
    name: 'r05-far', z: 9000, palette: 'night', haze: 0.5, hazeColor: '#b8a8d0', light: L, snow: 0.75, snowline: 1, detail: 0.6, contrast: 0.7,
    peaks: [
      { x: 480, y: 226, left: 380, right: 360, baseY: 560, seed: 5 },
      { x: 1925, y: 330, left: 260, right: 200, baseY: 520, seed: 6 },
      { x: 850, y: 324, left: 300, right: 230, baseY: 520, seed: 1 },
      { x: 1195, y: 296, left: 210, right: 300, baseY: 520, seed: 3 },
      { x: 1025, y: 302, left: 230, right: 220, baseY: 520, seed: 2 },
      { x: 1660, y: 358, left: 260, right: 300, baseY: 560, seed: 4 },
    ],
    layer: { alpha: A },
  });
  addRange(S, {
    name: 'r05-peak', z: 6500, palette: 'night', light: L, snow: 0.55, snowline: 0.9, detail: 1,
    peaks: [{ x: 1395, y: 218, left: 520, right: 760, baseY: 620, profile: 1.15, profileR: 1.45, seed: 11 }],
    layer: { alpha: A },
  });
  addRange(S, {
    name: 'r05-mid', z: 4500, palette: 'night', light: L, snow: 0.42, detail: 1,
    peaks: [
      { x: 1110, y: 400, left: 230, right: 220, baseY: 580, seed: 21 },
      { x: 1840, y: 450, left: 360, right: 320, baseY: 660, profile: 1.1, seed: 24 },
      { x: 1270, y: 450, left: 300, right: 330, baseY: 660, profile: 1.1, seed: 23 },
      { x: 900, y: 445, left: 310, right: 280, baseY: 650, profile: 1.1, seed: 22 },
    ],
    layer: { alpha: A },
  });
  addRange(S, {
    name: 'r05-ridges', z: 3200, palette: 'ridge', light: L, snow: 0, detail: 0.8,
    peaks: [
      { x: 1470, y: 500, left: 300, right: 360, baseY: 660, profile: 1.05, seed: 31 },
      { x: 1300, y: 590, left: 330, right: 300, baseY: 740, profile: 1.05, seed: 32 },
    ],
    layer: { alpha: A },
  });
  addHills(S, {
    name: 'r05-hills', z: 2600, palette: 'teal', light: L, strips: 4, crest: 6,
    hills: [{ x0: 900, x1: 1560, y: 640, baseY: 760, peakX: 1180, round: 1.3 }],
    layer: { alpha: A },
  });
  water(S, 0, 2000, [[400, 700], [2200, 700], [2200, 1400], [400, 1400]], ['#3e5e94', '#1e3a68']);
  addHills(S, {
    name: 'r05-forest', z: 1600, palette: 'forest', light: L, strips: 3, crest: 4, shadeAmt: 0.5,
    hills: [
      { x0: 500, x1: 1300, y: 760, baseY: 900, peakX: 800, round: 1.2, bottom: 300 },
      { x0: 1500, x1: 2300, y: 780, baseY: 920, peakX: 1900, round: 1.2, bottom: 300 },
    ],
    layer: { alpha: A },
  });
  S.plane(1050, {
    name: 'r05-cliff', x: -140, y: 400, w: 720, h: 820, res: 1.25, mat: 'stone',
    draw(ctx) {
      drawCliff(ctx, { x: -80, y: 520, w: 540, h: 520, palette: 'granite', light: L, cols: 120, step: 26, snow: 0.9, moss: 0.25, plateau: 22, seed: 81 });
    },
  }, { alpha: A });
  S.plane(950, {
    name: 'r05-trail', x: 280, y: 440, w: 560, h: 720, res: 1.25, mat: 'stone',
    draw(ctx) {
      drawTrail(ctx, { path: [[640, 1110], [600, 990], [560, 880], [520, 780], [485, 690], [455, 610], [435, 540]], width: 180, taper: 0.5, light: L, seed: 5 });
    },
  }, { alpha: A });
}

// ref02: the moonlit range, green hills, the fox's flat-topped perch and river rocks.
function lakeBand(S) {
  const A = seg(1);
  sky(S, 1, ['#0e1838', '#152250', '#1e2c5e']);
  const L = [-0.5, -0.866];
  addRange(S, {
    name: 'r02-far', z: 8000, palette: 'lake', haze: 0.35, light: L, snow: 0.6, detail: 0.6,
    peaks: [
      { x: 640, y: 282, left: 200, right: 160, baseY: 420, seed: 41 },
      { x: 905, y: 262, left: 200, right: 220, baseY: 430, seed: 42 },
      { x: 755, y: 266, left: 220, right: 200, baseY: 440, seed: 43 },
      { x: 1665, y: 355, left: 260, right: 300, baseY: 470, seed: 45 },
      { x: 1460, y: 335, left: 220, right: 260, baseY: 470, seed: 44 },
    ],
    layer: { alpha: A },
  });
  addRange(S, {
    name: 'r02-peak', z: 6000, palette: 'lake', light: L, snow: 0.5, ridge: 0.5, detail: 1,
    peaks: [{ x: 1115, y: 205, left: 430, right: 620, baseY: 460, profile: 1.3, seed: 46 }],
    layer: { alpha: A },
  });
  addRange(S, {
    name: 'r02-ridge', z: 4200, palette: 'lake', light: L, snow: 0, detail: 0.8,
    peaks: [{ x: 1190, y: 398, left: 420, right: 420, baseY: 520, seed: 47 }],
    layer: { alpha: A },
  });
  addHills(S, {
    name: 'r02-forest', z: 3400, palette: 'forest', light: L, strips: 3, crest: 4, shadeAmt: 0.4,
    hills: [
      { x0: 380, x1: 1050, y: 420, baseY: 600, peakX: 600, round: 1.2 },
      { x0: 850, x1: 1500, y: 470, baseY: 620, peakX: 1150, round: 1.2 },
    ],
    layer: { alpha: A },
  });
  addHills(S, {
    name: 'r02-hills-far', z: 3000, palette: 'night', haze: 0.55, light: L, strips: 3, crest: 5,
    hills: [
      { x0: 1500, x1: 2250, y: 372, baseY: 590, peakX: 1900, round: 1.4 },
      { x0: 1200, x1: 1620, y: 478, baseY: 600, peakX: 1400, round: 1.2 },
    ],
    layer: { alpha: A },
  });
  addHills(S, {
    name: 'r02-hills', z: 2200, palette: 'night', light: L, strips: 5, crest: 10,
    hills: [{ x0: 600, x1: 1440, y: 440, baseY: 640, peakX: 880, round: 1.7 }],
    layer: { alpha: A },
  });
  water(S, 1, 1500, [[600, 585], [2200, 585], [2200, 1400], [600, 1400]], ['#4a6ea8', '#2d4f8c']);
  addBoulders(S, {
    name: 'r02-river-rocks', z: 820, palette: 'river', light: L, moss: 0.25,
    rocks: [
      { x: 1137, y: 805, w: 100, h: 52, shape: 'round' },
      { x: 1378, y: 832, w: 128, h: 56, shape: 'round' },
      { x: 1550, y: 852, w: 150, h: 60, shape: 'flat' },
      { x: 1090, y: 900, w: 140, h: 70, shape: 'pointy' },
      { x: 1390, y: 912, w: 160, h: 70, shape: 'round' },
      { x: 1757, y: 900, w: 160, h: 66, shape: 'flat' },
      { x: 1320, y: 1010, w: 150, h: 70, shape: 'round' },
      { x: 1480, y: 1020, w: 140, h: 80, shape: 'pointy' },
    ],
    layer: { alpha: A },
  });
  addBoulders(S, {
    name: 'r02-perch', z: 950, palette: 'perch', light: [0.5, -0.866], moss: 0.2,
    rocks: [
      { x: 545, y: 800, w: 540, h: 100, shape: 'slab', tilt: 0.16, sides: 9, rough: 0.08, seed: 7 },
      { x: 745, y: 816, w: 170, h: 90, shape: 'block', tilt: 0.3, seed: 8 },
      { x: 770, y: 1080, w: 460, h: 190, shape: 'flat', tilt: 0.2, seed: 9 },
    ],
    layer: { alpha: A },
  });
}

// ref04: canyon walls stepping down to the river, the fox's ledge and dark river rocks.
function canyon(S) {
  const A = seg(2);
  sky(S, 2, ['#0e1a40', '#1a2a62', '#3a3a7a']);
  const L = [0.5, -0.866];
  addRange(S, {
    name: 'r04-far', z: 8000, palette: 'dusk', haze: 0.25, light: L, snow: 0.35, detail: 0.6,
    peaks: [
      { x: 1225, y: 285, left: 260, right: 260, baseY: 470, seed: 61 },
      { x: 1320, y: 282, left: 200, right: 240, baseY: 470, seed: 62 },
      { x: 1640, y: 330, left: 230, right: 300, baseY: 490, seed: 63 },
      { x: 1360, y: 345, left: 240, right: 280, baseY: 500, seed: 64 },
    ],
    layer: { alpha: A },
  });
  addHills(S, {
    name: 'r04-forest', z: 3000, palette: 'forest', light: L, strips: 3, crest: 4, shadeAmt: 0.4,
    hills: [{ x0: 900, x1: 1800, y: 430, baseY: 620, peakX: 1150, round: 1.3 }],
    layer: { alpha: A },
  });
  water(S, 2, 1500, [[900, 560], [1600, 560], [2200, 1400], [800, 1400]], ['#3c6cc0', '#2a50a0']);
  addCliff(S, { name: 'r04-cliff-back', z: 2400, x: 240, y: 230, w: 370, h: 520, seed: 71, layer: { alpha: A } });
  addCliff(S, { name: 'r04-cliff-r2', z: 2200, x: 1040, y: 458, w: 330, h: 150, cols: 80, step: 30, seed: 74, layer: { alpha: A } });
  addCliff(S, { name: 'r04-cliff-center', z: 1900, x: 610, y: 340, w: 430, h: 270, seed: 72, layer: { alpha: A } });
  addCliff(S, { name: 'r04-cliff-right', z: 1700, x: 1570, y: 340, w: 420, h: 520, cols: 100, step: 50, seed: 73, layer: { alpha: A } });
  addCliff(S, { name: 'r04-cliff-low', z: 1600, x: 370, y: 450, w: 200, h: 170, cols: 70, step: 10, seed: 75, layer: { alpha: A } });
  addBoulders(S, {
    name: 'r04-river-rocks', z: 1100, palette: 'river', light: L, moss: 0.15,
    rocks: [
      { x: 1075, y: 765, w: 150, h: 90, shape: 'pointy' },
      { x: 1240, y: 760, w: 140, h: 95, shape: 'round' },
      { x: 1490, y: 815, w: 150, h: 75, shape: 'round' },
      { x: 1560, y: 845, w: 180, h: 85, shape: 'pointy' },
      { x: 1660, y: 880, w: 210, h: 100, shape: 'round' },
      { x: 1140, y: 925, w: 170, h: 80, shape: 'pointy' },
      { x: 1335, y: 935, w: 140, h: 75, shape: 'round' },
      { x: 1670, y: 1065, w: 200, h: 120, shape: 'pointy' },
    ],
    layer: { alpha: A },
  });
  addCliff(S, { name: 'r04-ledge', z: 900, res: 1.25, x: 390, y: 718, w: 520, h: 170, cols: 110, step: 8, plateau: 34, deck: 'stone', moss: 0.7, seed: 76, layer: { alpha: A } });
}

export default function () {
  return new Scene({
    id: 'terrain',
    duration: 6,
    background: '#13234e',
    light: [0.5, -0.866],
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.25, threshold: 0.7, vignette: 0.2, grain: 0.04 },
    // A slow sway that passes through rest at each segment's midpoint (t = 1, 3, 5).
    camera: (t) => ({ x: 40 * Math.sin((Math.PI * (t - 1)) / SEG), y: 0 }),
    build(S) {
      snowRange(S);
      lakeBand(S);
      canyon(S);
    },
  });
}
