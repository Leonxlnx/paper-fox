// s01 land: snowy dusk ranges, blue foothills, green rolling hills with conifer
// forests, the lake winding off toward the sunset, and the big conifers that frame
// the left edge.

import { W, H } from '../core/stage.js';
import { addRange, addHills, drawRange, rangeBox } from '../elements/terrain.js';
import { surface } from '../core/canvas.js';
import { RNG } from '../core/rng.js';
import { piece } from '../core/piece.js';
import { addForestBand, addTree, FOLIAGE, BARK } from '../elements/trees.js';
import { addLake, WATER } from '../elements/water.js';
import { addTexturedHills, addHorizonHaze } from './s01-meadow.js';

const OVER = 260;

// ref01 snow peaks: periwinkle rock, snow lavender-blue on the faces turned away from
// the sun and warm peach-pink on the faces turned to it (ramp runs shade -> lit).
const SNOW_PAL = {
  rock: ['#313c92', '#3b48a0', '#4756ac', '#5866b8', '#6e78c4'],
  snow: ['#5f64b2', '#787cc8', '#9394da', '#b0ade8', '#d8caee', '#f8d8dc', '#ffeee4'],
  rim: '#fff6f2', haze: '#b6a4d8', shadow: 'rgba(24,20,70,0.45)',
};

// Painterly snow: once a range is drawn, lay mottled near-white blotches and a few
// larger torn sheets over its snow only. The snow mask comes from the lightness of the
// painted pixels, so the pieces follow the caps and bands exactly. Pieces lean down the
// fall line away from each summit.
function mottleSnow(ctx, peaks, { seed, amt = 1, big = 0.07 }) {
  const cv = ctx.canvas, w = cv.width, h = cv.height;
  const T = ctx.getTransform();
  const d = ctx.getImageData(0, 0, w, h).data;
  const lum = (i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  const m = surface(w, h);
  const md = m.ctx.createImageData(w, h);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    md.data[i + 3] = 255 * Math.min(1, Math.max(0, (lum(i) - 146) / 26));
  }
  m.ctx.putImageData(md, 0, 0);
  const at = (x, y) => {
    const px = Math.round(T.a * x + T.e), py = Math.round(T.d * y + T.f);
    if (px < 0 || py < 0 || px >= w || py >= h) return -1;
    const i = (py * w + px) * 4;
    return d[i + 3] < 200 ? -1 : lum(i);
  };
  const o = surface(w, h);
  const g = o.ctx;
  g.setTransform(T);
  const rng = new RNG(`snow-mottle:${seed}`);
  for (const pk of peaks) {
    const H = pk.baseY - pk.y;
    const n = Math.round(((H * (pk.left + pk.right)) / 700) * amt);
    for (let i = 0; i < n; i++) {
      const x = pk.x + rng.range(-pk.left, pk.right) * 0.85;
      const y = pk.y + Math.pow(rng.next(), 1.4) * H * 0.8;
      const L = at(x, y);
      if (L < 150) continue;
      let fx = x - pk.x, fy = y - pk.y + 60;
      const fl = Math.hypot(fx, fy) || 1;
      fx /= fl; fy /= fl;
      const lit = L > 190;
      const isBig = lit && rng.chance(big);
      const len = isBig ? rng.range(36, 80) : rng.range(7, 26);
      const wid = len * (isBig ? rng.range(0.28, 0.42) : rng.range(0.35, 0.7));
      const col = lit ? rng.pick(['#ffffff', '#fffaf4', '#fff3ee', '#fdeef0']) : rng.pick(['#dedaf8', '#d4d2f6', '#e6e0f8', '#c9c8f0']);
      const ph = rng.range(0, 6.28), nn = isBig ? 22 : 12;
      const pts = Array.from({ length: nn }, (_, j) => {
        const a = (j / nn) * Math.PI * 2;
        const r = 1 + 0.22 * Math.sin(3 * a + ph) + rng.range(-0.1, 0.1);
        const lx = Math.cos(a) * len * 0.5 * r, ly = Math.sin(a) * wid * 0.5 * r;
        return [x + fx * lx - fy * ly, y + fy * lx + fx * ly];
      });
      piece(g, pts, {
        fill: col, alpha: isBig ? 0.92 : rng.range(0.3, 0.65),
        torn: { amp: isBig ? 1.5 : 0.8, freq: 0.2, fine: 0.5, seed: rng.int(1, 1e6), step: 2 },
        shadow: isBig ? { color: 'rgba(70,60,140,0.35)', blur: 3, x: 1, y: 2 } : null,
        rim: isBig ? { color: '#ffffff', width: 0.6 } : null,
      });
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(m.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(o.canvas, 0, 0);
  ctx.restore();
}

// addRange with the painterly snow pass baked into the same sheet.
function addSnowRange(S, { z, name, mottle = {}, res = 1, shadow = { blur: 14 }, ...opts }) {
  return S.plane(z, {
    name, ...rangeBox(opts.peaks, opts), res, mat: 'paper', shadow,
    edge: { width: 1.4, hi: 0.3, lo: 0.2, soft: 0.6 },
    draw: (ctx) => {
      drawRange(ctx, { light: S.light, ...opts });
      mottleSnow(ctx, opts.peaks, { seed: name, ...mottle });
    },
  });
}
// The bare blue ridges in front of the snow peaks: rock only, the deepest blue-violet.
const RIDGE_MTN = {
  rock: ['#1d2870', '#253683', '#2f4393', '#3b51a0', '#4c60ac'],
  snow: SNOW_PAL.snow, rim: '#e4dcf6', haze: '#8a8cc4', shadow: 'rgba(16,18,60,0.5)',
};
// Broad massifs: few spurs so each flank is a couple of big faces, snow laid as large
// torn caps (short spur bands, few rock slivers) instead of white diagonal stripes.
const MASSIF = {
  spurs: 3, crease: 0.25, jag: 0.28, shoulder: 0.9, profile: 1.02, fan: 0.8,
  ridge: 0.2, drips: 0.6, detail: 0.22, snowline: 1,
};
// Peaks east of the sun take their light from the west.
const FROM_WEST = [-0.8, -0.6];

const HILLS_FAR = [
  { x0: 1500, x1: W + OVER, y: 440, baseY: 640, peakX: 1980, round: 1.3, seed: 31 },
  { x0: 640, x1: 1560, y: 430, baseY: 660, peakX: 860, round: 1.4, seed: 32 },
];
const HILLS_MID = [
  { x0: 1520, x1: W + OVER, y: 520, baseY: 760, peakX: 2100, round: 1.5, seed: 33 },
  { x0: 560, x1: 1420, y: 470, baseY: 720, peakX: 760, round: 1.4, seed: 34 },
];

const tagAll = (layers, ...tags) => {
  for (const L of [layers].flat()) L.tags.push(...tags);
  return layers;
};

export function buildLand(S, { sun }) {
  const L = S.light;

  // Three layers receding into the sunset (ref01): hazed secondary peaks, three broad
  // snow massifs (dominant left-centre, centre and right), then bare blue ridges.
  addSnowRange(S, {
    name: 'range-far', z: 8000, palette: SNOW_PAL, haze: 0.4, hazeColor: '#d2abd2', light: L, ...MASSIF, mottle: { amt: 0.8, big: 0.04 },
    snow: 0.62, snowLow: 0.56, contrast: 0.9, foot: 0.2, bottom: 140, edge: 0.25,
    peaks: [
      { x: 470, y: 214, left: 280, right: 250, baseY: 380, seed: 3 },
      { x: 850, y: 252, left: 250, right: 280, baseY: 410, seed: 4 },
      { x: 1490, y: 346, left: 220, right: 200, baseY: 470, spurs: 2, seed: 5 },
      { x: 1596, y: 374, left: 180, right: 180, baseY: 480, spurs: 2, seed: 6 },
    ],
  });
  addSnowRange(S, {
    name: 'range-main', z: 6200, palette: SNOW_PAL, haze: 0.08, light: L, ...MASSIF, mottle: { amt: 2.2, big: 0.08 },
    snow: 0.6, snowLow: 0.56, contrast: 1.1, foot: 0.3, bottom: 160,
    peaks: [
      { x: 632, y: 181, left: 380, right: 400, baseY: 420, seed: 11 },
      { x: 1815, y: 298, left: 330, right: 380, baseY: 500, light: FROM_WEST, seed: 12 },
      { x: 1175, y: 250, left: 400, right: 420, baseY: 480, seed: 13 },
    ],
  });
  addRange(S, {
    name: 'range-ridges', z: 4200, palette: RIDGE_MTN, light: L, snow: 0, detail: 0.3, contrast: 0.9, jag: 0.4, shoulder: 0.8,
    spurs: 3, profile: 0.8, fan: 0.9, foot: 0.45, bottom: 120, edge: 0.4,
    fade: { color: '#7c82c0', from: 430, to: 640, alpha: 0.42 },
    peaks: [
      { x: 470, y: 326, left: 320, right: 500, baseY: 560, seed: 21 },
      { x: 1050, y: 378, left: 360, right: 360, baseY: 580, seed: 22 },
      { x: 1930, y: 384, left: 380, right: 320, baseY: 600, seed: 24 },
      { x: 1420, y: 402, left: 300, right: 280, baseY: 590, seed: 23 },
      { x: 1680, y: 428, left: 260, right: 260, baseY: 610, seed: 25 },
    ],
  });
  // Far green hills, then the lake between them.
  // Run the haze down behind the ridges so its foot never shows between the peaks.
  addHorizonHaze(S, { y1: 470 });
  addTexturedHills(S, { name: 'hills-far', z: 3200, palette: 'dusk', light: L, strips: 4, crest: 8, hills: HILLS_FAR, tex: { scale: 0.4, density: 0.6, flowers: 0.5, shrubs: 1.4, haze: 0.22 } });
  addForestBand(S, {
    name: 'forest-far', z: 3000, x0: 1480, x1: W + OVER, base: [[1480, 600], [1700, 520], [1900, 470], [2200, 450]],
    heights: [30, 70], rows: 2, density: 1.4, colors: FOLIAGE.dusk, haze: '#7a86b0', hazeAmt: [0.4, 0.15], seed: 41, midMin: 999, light: L,
  });
  addLake(S, {
    name: 'lake', z: 2600, x0: 1240, x1: W + OVER, top: 528, bottom: 700, palette: { ...WATER.dusk, lake: ['#efc0ae', '#7a90c8'] },
    shape: [[1240, 540], [1500, 528], [1800, 520], [W + OVER, 520], [W + OVER, 600], [1760, 610], [1640, 640], [1560, 700], [1400, 700], [1300, 600]],
    light: { x: 1470, width: 150, widthBottom: 110, top: 530, bottom: 690, count: 34 },
    seed: 's01-lake',
  });
  addTexturedHills(S, { name: 'hills-mid', z: 2300, palette: 'dusk', light: L, strips: 5, crest: 10, hills: HILLS_MID, tex: { scale: 0.55, density: 0.8, flowers: 0.8, shrubs: 1.6, haze: 0.08 } });
  addForestBand(S, {
    name: 'forest-mid', z: 2100, x0: 1440, x1: W + OVER, base: [[1440, 700], [1600, 650], [1800, 590], [2200, 560]],
    heights: [60, 150], rows: 2, density: 1.1, colors: FOLIAGE.dusk, haze: '#7a86b0', hazeAmt: [0.2, 0], seed: 42, midMin: 80, light: L,
  });
  addForestBand(S, {
    name: 'forest-hill', z: 2000, x0: 640, x1: 1340, base: [[640, 520], [800, 500], [1000, 560], [1200, 620], [1340, 650]],
    heights: [60, 150], rows: 2, density: 0.9, colors: FOLIAGE.dusk, haze: '#7a86b0', hazeAmt: [0.2, 0], seed: 43, midMin: 70, light: L,
  });

  // Big conifers framing the left edge.
  const trees = [
    { x: 62, y: 392, h: 720, width: 0.3, trunkWidth: 0.115, trunkFrac: 0.22, bias: 0.6, interior: false, tiers: 14, fronds: 3, thick: 0.55, seed: 51, z: 1250 },
    { x: 278, y: 402, h: 540, width: 0.26, trunkWidth: 0.09, trunkFrac: 0.17, bias: 0.62, interior: false, tiers: 12, fronds: 3, thick: 0.55, seed: 52, z: 1300 },
    { x: 405, y: 398, h: 290, width: 0.25, seed: 53, z: 1400, detail: 'mid' },
    { x: 486, y: 420, h: 205, seed: 54, z: 1450, detail: 'mid' },
    { x: 552, y: 432, h: 170, seed: 55, z: 1450, detail: 'mid' },
    { x: 612, y: 442, h: 140, seed: 57, z: 1460, detail: 'mid' },
    { x: 210, y: 540, h: 250, seed: 56, z: 1200, detail: 'mid' },
  ];
  for (const t of trees) {
    tagAll(addTree(S, {
      name: `tree-${t.seed}`, detail: t.detail ?? 'near', palette: FOLIAGE.dusk, bark: BARK.dusk, light: L, ...t,
    }), 'trees');
  }
}
