// s01 stream: the rushing creek that runs under the bridge and widens toward the
// bottom right. ref01: light blue water with white swirls, and one continuous white
// cascade running from under the arch, over a ledge and through the boulders all the
// way down to the bottom-right frame edge.

import { addRiver, addWaterfall, addRapids, addFoam, WATER } from '../elements/water.js';
import { addBoulders } from '../elements/terrain.js';
import { RNG } from '../core/rng.js';
import { piece } from '../core/piece.js';
import { drawSprites } from '../core/sprite.js';

const tagAll = (layers, ...tags) => {
  for (const L of [layers].flat()) L.tags.push(...tags);
  return layers;
};

// ref01 river boulders: warm brown-grey with olive moss on their tops.
export const WARM_STONE = {
  ramp: ['#1b1411', '#31261f', '#47392f', '#5e4d41', '#7a6656', '#968070'],
  fleck: '#d8b060', moss: ['#56661f', '#82942a', '#b0b636'],
};

// Lighter, clearer blues than the stock dusk water, with near-white foam.
const PAL = {
  ...WATER.dusk,
  deep: '#1f56b8', base: '#2c6ccc', mid: '#4688de', light: '#78b0ee', pale: '#bcdaf8',
  foam: '#fbfdff', foamShade: '#b4c8e2', shadow: '#17265c',
};

// Bed strips: soft blue tiers, then white swirl strips riding on top.
const TIERS = [
  { cols: ['base', 'mid', 'mid'], cover: 0.9, len: [220, 560], th: [11, 22], bow: [0, 0.4], hi: 0.12 },
  { cols: ['mid', 'mid', 'light'], cover: 0.55, len: [150, 420], th: [7, 15], bow: [0.1, 0.6], hi: 0.22 },
  { cols: ['light', 'light', 'pale'], cover: 0.22, len: [100, 300], th: [5, 10], bow: [0.2, 0.7], hi: 0.32 },
  { cols: ['pale', 'foam', 'foam'], cover: 0.3, len: [70, 240], th: [3.5, 8], bow: [0.2, 0.9], rim: true, hi: 0.45 },
];

// The cascade sheet: mostly white water with a few blue bands, blue at both edges so
// it melts into the river on either side.
const CASCADE_BANDS = ['pale', 'foam', 'foam', 'pale', 'foam', 'foam', 'foam', 'pale', 'foam', 'foam', 'foam', 'foam', 'pale'];
const CASCADE = [[700, 728], [770, 768], [828, 822], [872, 878], [950, 928], [1050, 984], [1150, 1036], [1262, 1090], [1360, 1136]];
const CASCADE_W = [70, 92, 104, 112, 130, 150, 176, 200, 220];

// Point on a polyline at u in 0..1: position, interpolated width and unit direction.
function sampler(path, widths) {
  const L = [0];
  for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = L[L.length - 1];
  const at = (u) => {
    const d = u * total;
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
    const a = path[i - 1], b = path[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    return { x: a[0] + dx * k, y: a[1] + dy * k, w: widths[i - 1] + (widths[i] - widths[i - 1]) * k, dx: dx / len, dy: dy / len };
  };
  return { total, at };
}

// One torn white foam piece around the origin (x across the flow, +y downstream).
//   crest: a breaking wave, bumpy lit top over a cool blue under-fold
//   puff:  a few overlapping round bumps;  tongue: a long torn sliver of falling water
function drawFoamPiece(ctx, kind, rng, light) {
  const torn = (amp) => ({ amp, freq: 0.24, fine: 0.5, seed: rng.int(1, 1e6), step: 2 });
  const bevel = { light, width: 1, hi: 0.5, lo: 0.08, hiColor: '#ffffff', soft: 0.4 };
  const shade = { color: 'rgba(40,80,150,0.35)', blur: 2.5, x: 0, y: 2 };
  if (kind === 'crest') {
    const hw = rng.range(30, 42), hh = rng.range(10, 16), ph = rng.range(0, 6.28), nb = rng.int(3, 5);
    const top = [], bot = [];
    for (let i = 0; i <= 20; i++) {
      const s = -1 + (2 * i) / 20, x = s * hw;
      const dome = Math.sqrt(Math.max(0, 1 - s * s));
      top.push([x, -hh * dome * (0.75 + 0.35 * Math.abs(Math.sin(s * nb * 1.6 + ph)))]);
      bot.push([x, hh * 0.35 * dome + 2]);
    }
    const body = [...top, ...bot.reverse()];
    piece(ctx, body.map(([x, y]) => [x * 1.04, y + 4]), { fill: '#a6c2e8', torn: torn(0.9) });
    const g = ctx.createLinearGradient(0, -hh, 0, hh * 0.5);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#f4f9ff'); g.addColorStop(1, '#cfe0f5');
    piece(ctx, body, { fill: g, torn: torn(1), shadow: shade, bevel });
    for (let j = 0; j < 2; j++) {
      const cx = rng.range(-0.5, 0.5) * hw, r = rng.range(4, 8);
      piece(ctx, Array.from({ length: 12 }, (_, i) => [cx + Math.cos((i / 12) * 6.283) * r * 1.6, -hh * 0.35 + Math.sin((i / 12) * 6.283) * r * 0.6]), { fill: '#ffffff', torn: torn(0.6), shadow: { ...shade, blur: 1.5, y: 1 } });
    }
  } else if (kind === 'puff') {
    const n = rng.int(3, 5);
    const bumps = Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * rng.range(11, 15), y: rng.range(-6, 4), r: rng.range(8, 14) })).sort((a, b) => a.y - b.y);
    for (const b of bumps) {
      const g = ctx.createLinearGradient(0, b.y - b.r, 0, b.y + b.r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.65, '#f2f7ff'); g.addColorStop(1, '#bcd2ee');
      piece(ctx, Array.from({ length: 18 }, (_, i) => [b.x + Math.cos((i / 18) * 6.283) * b.r, b.y + Math.sin((i / 18) * 6.283) * b.r * 0.8]), { fill: g, torn: torn(0.8), shadow: shade, bevel });
    }
  } else {
    const hl = rng.range(16, 22), hw = rng.range(4, 7), bend = rng.range(-4, 4);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * 6.283;
      const y = Math.sin(a) * hl;
      pts.push([Math.cos(a) * hw * (1 - Math.abs(y / hl) * 0.4) + bend * (y / hl) ** 2, y]);
    }
    const g = ctx.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d4e4f7');
    piece(ctx, pts, { fill: g, torn: torn(0.7), shadow: shade, bevel });
  }
}

// The cascade as tumbling white water: torn foam pieces riding down the cascade path,
// stacked downstream over upstream, growing as the cascade widens.
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

function addTumble(S, { z, path, widths, count = 110, speed = 58, from = 0.14, seed = 's01-tumble' }) {
  const rng = new RNG(seed);
  const light = S.light;
  const kinds = ['crest', 'crest', 'crest', 'puff', 'crest', 'tongue', 'crest', 'crest', 'tongue', 'crest', 'crest', 'crest'];
  const cells = kinds.map((kind, i) => S.sprite({
    name: `tumble-${i}`, x: -50, y: -28, w: 100, h: 56, res: 1.6, light,
    mat: [{ tex: 'crumple', amt: 0.55, scale: 0.3 }, { tex: 'fiber', amt: 0.5 }],
    edge: { width: 1, hi: 0.35, lo: 0.15 }, shadow: { blur: 3 },
    draw(ctx) { drawFoamPiece(ctx, kind, rng.fork(`cell${i}`), light); },
  }));
  const { total, at } = sampler(path, widths);
  const parts = Array.from({ length: count }, () => {
    const cell = rng.int(0, cells.length - 1);
    const tongue = kinds[cell] === 'tongue';
    return {
      cell, u0: rng.next(), sp: speed * rng.range(0.8, 1.25),
      v: (rng.next() + rng.next() - 1) * (tongue ? 0.35 : 0.42),
      k: rng.range(0.7, 1.15), rot: rng.range(-0.25, 0.25), flip: rng.chance(0.5) ? -1 : 1, sy: rng.range(0.85, 1.15),
    };
  });
  return S.add({
    name: 'cascade-foam', z,
    render(ctx, t) {
      const items = [];
      for (const p of parts) {
        const u = (((p.u0 + (t * p.sp) / total) % 1) + 1) % 1;
        const q = at(u);
        // White water starts where the stream tips over the ledge and runs out of frame.
        const a = smooth(from, from + 0.1, u) * (1 - smooth(0.92, 1, u));
        if (a <= 0.01) continue;
        const off = p.v * q.w;
        const s = Math.max(0.7, q.w / 92) * p.k;
        // The stream comes toward the viewer, so crests lie closer to level than square
        // to the flow line.
        items.push({
          s: cells[p.cell], ax: 0, ay: 0, x: q.x - q.dy * off, y: q.y + q.dx * off,
          rot: Math.atan2(-q.dx, q.dy) * 0.4 + p.rot, sx: s * p.flip, sy: s * p.sy * 0.9,
          alpha: a, shadowDx: 1.5, shadowDy: 3,
        });
      }
      items.sort((a, b) => a.y - b.y);
      drawSprites(ctx, items, { alpha: 0.4 });
    },
  });
}

export function buildStream(S) {
  const L = S.light;
  // Boulders seen through the arch, behind the water's far edge.
  tagAll(addBoulders(S, {
    name: 'rocks-arch', z: 1080, palette: WARM_STONE, light: L, moss: 0.45, res: 1,
    rocks: [
      { x: 640, y: 748, w: 170, h: 54, shape: 'round', seed: 1 },
      { x: 812, y: 760, w: 96, h: 46, shape: 'round', seed: 2 },
      { x: 885, y: 778, w: 124, h: 62, shape: 'pointy', seed: 3 },
      { x: 1060, y: 790, w: 150, h: 70, shape: 'round', seed: 4 },
    ],
  }), 'rocks');

  const river = addRiver(S, {
    z: 1060, palette: PAL, texH: 210, align: 0.65, speed: 52, seed: 's01-river', current: 0.36, tiers: TIERS, bank: 10,
    // The far end swings right so the water opens out across the bottom right of the
    // frame, its bank running down to the big corner boulder (ref01).
    path: [[700, 690], [790, 760], [870, 840], [970, 925], [1090, 1010], [1200, 1100], [1300, 1210], [1420, 1360]],
    width: [260, 260, 300, 420, 600, 700, 900, 1100],
    swirls: [
      { x: 690, y: 726, r: 42, flat: 0.4, rings: 5 },
      { x: 1010, y: 905, r: 46, flat: 0.36, rings: 5 },
      { x: 905, y: 1040, r: 62, flat: 0.34, rings: 6 },
      { x: 1350, y: 1060, r: 84, flat: 0.32, rings: 6, spin: 1.8 },
    ],
  });
  tagAll(river.layers, 'water');

  // One continuous white cascade from under the arch to the bottom-right frame edge.
  tagAll(addWaterfall(S, {
    z: 1050, palette: PAL, path: CASCADE, width: CASCADE_W, bands: CASCADE_BANDS, bandWidth: 26, round: 30,
    speed: 70, accel: 0.25, streaks: 1.6, shadow: { alpha: 0.22, dist: 0.6 }, foam: false, mist: false, seed: 's01-cascade',
  }).layers, 'water');
  // Tumbling white water riding the cascade: layered torn foam pieces.
  tagAll(addTumble(S, { z: 1048, path: CASCADE, widths: CASCADE_W.map((w) => w * 0.92) }), 'water');
  // The ledge: a short steep drop riding on the cascade.
  tagAll(addWaterfall(S, {
    z: 1046, palette: PAL, x: 842, top: 818, bottom: 896, width: 124, round: 16, bandWidth: 9, speed: 80, accel: 0.3,
    bands: ['light', 'foam', 'pale', 'foam', 'foam', 'pale', 'foam'],
    foam: { size: 0.75, count: 16, flat: 0.42, res: 1 }, mist: { strength: 0.18 }, seed: 's01-fall1',
  }).layers, 'water');

  // White water churning down the cascade toward the bottom right.
  const foam = [
    { x: 960, y: 950, w: 150, h: 26, seed: 's01-foamA' },
    { x: 1075, y: 1004, w: 190, h: 30, seed: 's01-foamB' },
    { x: 1190, y: 1062, w: 230, h: 32, seed: 's01-foamC' },
    { x: 760, y: 790, w: 110, h: 20, seed: 's01-foamD' },
    // Bottom right: white water breaking around the boulders in the open stream.
    { x: 1500, y: 1050, w: 170, h: 26, seed: 's01-foamE' },
    { x: 1660, y: 1010, w: 150, h: 22, seed: 's01-foamF' },
    { x: 1330, y: 1062, w: 150, h: 24, seed: 's01-foamG' },
  ];
  for (const f of foam) tagAll(addFoam(S, { z: 1000, palette: PAL, flat: 0.36, size: 0.6, spray: 10, churn: 0.8, res: 1, ...f }), 'water');

  tagAll(addRapids(S, {
    z: 1010, zFront: 970, palette: PAL, angle: Math.PI * 0.3, thick: 11, rings: 1, seed: 's01-rapids',
    rocks: [
      { x: 915, y: 928, rx: 54, ry: 18 }, { x: 1230, y: 966, rx: 84, ry: 26 }, { x: 1015, y: 1038, rx: 58, ry: 17 },
      { x: 1120, y: 1076, rx: 54, ry: 16 }, { x: 1060, y: 884, rx: 90, ry: 22, rings: 0 }, { x: 1372, y: 1010, rx: 112, ry: 26 },
      { x: 1592, y: 1046, rx: 62, ry: 18 }, { x: 1745, y: 972, rx: 76, ry: 20 },
    ],
  }), 'water');

  // River boulders on the near side of the water.
  tagAll(addBoulders(S, {
    name: 'rocks-river', z: 960, palette: WARM_STONE, light: L, moss: 0.55,
    rocks: [
      { x: 705, y: 898, w: 140, h: 104, shape: 'round', seed: 11 },
      { x: 915, y: 940, w: 104, h: 74, shape: 'round', seed: 12 },
      { x: 1060, y: 862, w: 184, h: 112, shape: 'round', seed: 13 },
      { x: 1230, y: 962, w: 168, h: 118, shape: 'round', seed: 14 },
      { x: 1418, y: 902, w: 226, h: 120, shape: 'round', seed: 15 },
      { x: 1372, y: 992, w: 232, h: 114, shape: 'round', moss: 0.9, seed: 16 },
      { x: 1015, y: 1042, w: 112, h: 56, shape: 'round', seed: 17 },
      { x: 1122, y: 1080, w: 106, h: 48, shape: 'round', seed: 18 },
      { x: 1592, y: 1042, w: 96, h: 60, shape: 'round', seed: 19 },
      { x: 1745, y: 968, w: 136, h: 76, shape: 'round', moss: 0.7, seed: 21 },
    ],
  }), 'rocks');
}
