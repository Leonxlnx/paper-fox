// Rolling paper hills: a smooth dome cut from green paper, contour strips of slowly
// darkening greens stacked down the slope (each torn along its top with a pale paper
// core), torn shadow sheets over the flank turned from the light, and a light crest
// strip along the top edge.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands, linear } from '../core/piece.js';
import { mix, vary, shade } from '../core/color.js';
import { DEFAULT_LIGHT, brush } from './terrain-kit.js';

// crest: the lit top edge; ramp: lit -> deep greens down the slope; shade: shadow
// patches; haze: distance colour; rim: torn paper core.
export const HILL_PALETTES = {
  // ref02: moonlit grass, pale olive on top turning teal-green down the slope.
  night: {
    crest: '#b4bc6c', ramp: ['#a2ac66', '#86a060', '#5f8a5a', '#467458', '#365f50'],
    shade: '#294a46', haze: '#4e6d89', rim: '#e0e6b4',
  },
  // ref01: olive-yellow meadows in warm evening light, grey-green shadows.
  dusk: {
    crest: '#d0c050', ramp: ['#b6ac44', '#9e9e48', '#7e8e4c', '#607654', '#475f50'],
    shade: '#36524a', haze: '#7a86b0', rim: '#f4ecb4',
  },
  // ref10: golden sunrise slopes with teal shadows.
  dawn: {
    crest: '#f0d060', ramp: ['#e6bc46', '#caac44', '#9e9848', '#708050', '#4b6650'],
    shade: '#3a5a50', haze: '#a4a0b8', rim: '#fff4c0',
  },
  // ref05: far valley hills, teal and grey-green.
  teal: {
    crest: '#7c9c78', ramp: ['#6c8c74', '#5a7c6a', '#4a6c60', '#3a5a56', '#2a4a4c'],
    shade: '#1e3a44', haze: '#3c5c88', rim: '#b8ccb0',
  },
  // ref02 / ref05: dark teal slopes under distant tree lines.
  forest: {
    crest: '#3a5c62', ramp: ['#33525a', '#2b4852', '#243f4a', '#1d3642', '#172e3a'],
    shade: '#10222e', haze: '#3c5c88', rim: '#6a8a90',
  },
};

export function hillPalette(p = 'night', haze = 0) {
  const P = typeof p === 'string' ? HILL_PALETTES[p] : p;
  if (!haze) return P;
  const h = P.haze;
  return {
    ...P, crest: mix(P.crest, h, haze), ramp: P.ramp.map((c) => mix(c, h, haze)),
    shade: mix(P.shade, h, haze), rim: mix(P.rim, h, haze * 0.7),
  };
}

// Top edge of a hill: an asymmetric dome from (x0, baseY) over (peakX, y) to (x1, baseY),
// with a slow wobble so it never looks drawn with a compass.
export function hillCrest({ x0, x1, y, baseY, peakX = (x0 + x1) / 2, round = 1.6, wobble = 6, seed = 1, step = 8 }) {
  const nz = noise(`hill:${seed}`);
  const pts = [];
  for (let x = x0; x <= x1 + step; x += step) {
    const xx = Math.min(x, x1);
    const u = xx < peakX ? (peakX - xx) / (peakX - x0) : (xx - peakX) / (x1 - peakX);
    // Smooth bell: rounded top, soft shoulders, feet that run out along the ground.
    const bell = Math.pow(Math.cos(Math.min(1, u) * Math.PI / 2), round);
    const w = nz.fbm(xx * 0.004, 1.7, 3) * wobble * Math.sin(Math.min(1, u) * Math.PI) + nz.n1(xx * 0.03) * wobble * 0.15;
    pts.push([xx, baseY - (baseY - y) * bell + w]);
  }
  return pts;
}

// The crest pushed down toward the base by fraction k, flattening as it goes,
// with noise so each strip is torn by hand.
function contour(top, baseY, k, nz, amp) {
  return top.map(([x, y]) => [x, y + (baseY - y) * k + nz.n1(x * 0.012 + k * 9) * amp]);
}

// Draw one hill (inside a sprite's draw). Returns its crest polyline.
//   x0, x1, y, baseY, peakX, round   dome shape (see hillCrest); bottom: how far it runs below baseY
//   palette, haze                    HILL_PALETTES name or object
//   light                            unit vector toward the light: which flank is shaded
//   strips                           number of contour strips down the slope
//   crest                            width of the lit crest strip in px (0 = none)
//   shadeAmt                         0..1 shadow patches on the far flank
//   cast                             drop shadow onto what was drawn before it
export function drawHill(ctx, opts = {}) {
  const {
    x0, x1, y, baseY, bottom = 200, palette = 'night', haze = 0, light = DEFAULT_LIGHT,
    strips = 5, crest = 10, cast = { blur: 12, y: 6 }, seed = 1, detail = 1, shadeAmt = 1,
  } = opts;
  const P = hillPalette(palette, haze);
  const rng = new RNG(`hill-draw:${seed}`);
  const nz = noise(`hill-strip:${seed}`);
  const top = hillCrest({ ...opts, seed });
  const yb = baseY + bottom;
  const body = [...top, [x1, yb], [x0, yb]];
  const sil = pathOf(body);
  const peakX = opts.peakX ?? (x0 + x1) / 2;
  const H = baseY - y;
  const span = x1 - x0;
  const rampAt = (t) => {
    const f = Math.max(0, Math.min(0.999, t)) * (P.ramp.length - 1);
    return mix(P.ramp[Math.floor(f)], P.ramp[Math.floor(f) + 1], f - Math.floor(f));
  };

  piece(ctx, body, {
    fill: linear(ctx, 0, y, 0, baseY, [P.ramp[1], P.ramp[3]]),
    torn: { amp: 1.2, freq: 0.08, fine: 0.5, seed: rng.int(1, 1e6) },
    shadow: cast ? { color: 'rgba(10,20,20,0.5)', blur: cast.blur, x: cast.x ?? 0, y: cast.y ?? 6 } : null,
  });

  ctx.save();
  ctx.clip(sil);
  // Contour strips, each laid over the one above it.
  const ks = [];
  for (let i = 1; i <= strips; i++) ks.push(Math.pow(i / (strips + 1), 1.1) + rng.range(-0.03, 0.03));
  let prev = top.map(([px, py]) => [px, py - 4]);
  ks.push(1.4);
  ks.forEach((k, i) => {
    const next = contour(top, yb, Math.min(1.4, k), nz, H * 0.05);
    const band = [...prev, ...next.slice().reverse()];
    const col = vary(rampAt(0.12 + (i / ks.length) * 0.8), rng, 0.03);
    const path = piece(ctx, band, {
      fill: col,
      torn: { amp: 1.4, freq: 0.06, fine: 0.6, seed: rng.int(1, 1e6) },
      rim: i > 0 ? { color: shade(col, 0.25), width: 0.7 } : null,
      shadow: i > 0 ? { color: 'rgba(10,24,10,0.3)', blur: 3, x: 0, y: -1.5 } : null,
    });
    if (detail > 0) brush(ctx, path, { angle: rng.range(-0.08, 0.08), amt: 0.14 * detail, seed: rng.int(1, 1e9) });
    prev = next;
  });

  // Shaded flank: two torn sheets over the slope turned from the light, the second
  // darker and deeper in. Their edges curve from near the summit down to the foot.
  if (shadeAmt > 0) {
    const away = light[0] >= 0 ? -1 : 1;
    const far = away < 0 ? x0 - 30 : x1 + 30;
    const halfW = away < 0 ? peakX - x0 : x1 - peakX;
    [[0.15, 0.45], [0.45, 0.75]].forEach(([k0, darkness], layer) => {
      const wn = noise(`hill-shade:${seed}:${layer}`);
      const edge = [];
      for (let i = 0; i <= 16; i++) {
        const v = i / 16;
        const yy = y - 10 + (yb - y + 10) * v;
        const off = halfW * (k0 + (0.35 + 0.3 * layer) * Math.pow(v, 0.8));
        edge.push([peakX + away * off + wn.n1(v * 4) * halfW * 0.06, yy]);
      }
      const pts = [[edge[0][0], y - 60], ...edge, [far, yb + 10], [far, y - 60]];
      const path = piece(ctx, pts, {
        fill: vary(mix(rampAt(0.55), P.shade, darkness), rng, 0.02),
        alpha: Math.min(1, 0.55 + 0.45 * shadeAmt),
        torn: { amp: 4, freq: 0.04, fine: 0.8, seed: rng.int(1, 1e6) },
        shadow: { color: 'rgba(10,24,10,0.25)', blur: 4, x: -away * 1.5, y: 1 },
      });
      if (detail > 0) brush(ctx, path, { angle: away * 0.35, amt: 0.12 * detail, seed: rng.int(1, 1e9) });
    });
  }
  // Lit crest: a pale torn strip along the top edge with a white paper core.
  if (crest > 0) {
    const lower = top.map(([px, py], i) => [px, py + crest * (0.5 + 0.5 * Math.abs(nz.n1(i * 0.21))) * (0.4 + 0.6 * Math.max(0, 1 - Math.abs(px - peakX) / (span * 0.6)))]);
    piece(ctx, [...top.map(([px, py]) => [px, py - 4]), ...lower.reverse()], {
      fill: P.crest,
      torn: { amp: 1.6, freq: 0.1, fine: 0.6, seed: rng.int(1, 1e6) },
      rim: { color: P.rim, width: 0.8 },
      shadow: { color: 'rgba(20,30,10,0.35)', blur: 3, x: 0, y: 2 },
    });
  }
  ctx.restore();
  bevelBands(ctx, sil, { light, width: 1.6, hi: 0.4, lo: 0.2 });
  return top;
}

// Several hills on one sheet, back to front.
export function drawHills(ctx, { hills = [], ...common } = {}) {
  return hills.map((h, i) => drawHill(ctx, { seed: (common.seed ?? 1) * 31 + i * 7, ...common, ...h }));
}

export function hillsBox(hills, common = {}, pad = 40) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const h of hills) {
    const o = { ...common, ...h };
    x0 = Math.min(x0, o.x0); x1 = Math.max(x1, o.x1);
    y0 = Math.min(y0, o.y); y1 = Math.max(y1, o.baseY + (o.bottom ?? 200));
  }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
}

// Add a row of hills as one baked plane.
export function addHills(S, { z = 2500, name = 'hills', box = null, res = 1, mat = 'paper', layer = {}, shadow = { blur: 14 }, ...opts } = {}) {
  const b = box ?? hillsBox(opts.hills ?? [], opts);
  return S.plane(z, {
    name, ...b, res, mat, shadow,
    edge: { width: 1.4, hi: 0.3, lo: 0.2, soft: 0.6 },
    draw: (ctx) => drawHills(ctx, { light: S.light, ...opts }),
  }, layer);
}
