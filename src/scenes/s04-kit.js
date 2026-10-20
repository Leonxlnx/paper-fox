// Scene-local kit for s04 (waterfall canyon): sampled palettes and the canyon wall.
//
// The library cliff (terrain-cliffs.js) builds boxy walls of square-topped columns. The
// ref04 canyon is cut from tall slabs of charcoal-violet paper: each wall follows a
// free silhouette, splits into leaning columns with dark crevices, each column folded
// into a lit and a shaded face, all brushed vertically and crowned with a thick torn
// moss mat that drips over the edge.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands } from '../core/piece.js';
import { flecks } from '../core/paper.js';
import { blob } from '../core/geom.js';
import { vary, mix, rgba } from '../core/color.js';
import { brush, sliver, boxOf } from '../elements/terrain.js';

// Light toward the moon, upper left. Every painter in this scene uses it.
export const LIGHT = [-0.42, -0.91];

// Canyon rock, sampled from the ref04 walls: crevice, shaded face, body, lit faces.
export const ROCK = {
  crack: '#0b090c', deep: '#17141a', side: '#221e23', mid: '#332e31', face: '#2d282c', lit: '#6c6460', hi: '#8e847d',
  fleck: '#cbb06a',
};

// Moss mats on the wall tops: shaded under-mat, olive body, sunlit yellow tufts.
export const MOSS = { deep: '#2f3412', dark: '#4a4e1a', mid: '#676b22', light: '#8d8e2a', hi: '#b4a62e' };

// Atmospheric haze of the canyon (toward the twilight blue of the far valley).
export const HAZE = '#5a6ca8';

// Pull a whole palette toward a haze colour.
export function hazed(pal, t, color = HAZE) {
  if (!t) return pal;
  const out = {};
  for (const [k, v] of Object.entries(pal)) out[k] = typeof v === 'string' && v.startsWith('#') ? mix(v, color, t) : v;
  return out;
}

// Sample a left-to-right polyline at x (linear, flat beyond the ends).
export function yAt(line, x) {
  if (x <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    if (line[i][0] >= x) {
      const a = line[i - 1], b = line[i];
      return a[1] + (b[1] - a[1]) * ((x - a[0]) / ((b[0] - a[0]) || 1));
    }
  }
  return line[line.length - 1][1];
}

// Resample a polyline to points every `step` px of x, with slow noise added to y.
function wobbleLine(line, step, amp, nz, k = 0) {
  const out = [];
  const x0 = line[0][0], x1 = line[line.length - 1][0];
  for (let x = x0; x <= x1 + 0.01; x += step) {
    const xx = Math.min(x, x1);
    out.push([xx, yAt(line, xx) + nz.fbm(xx * 0.02 + k, 3.3, 3) * amp]);
  }
  return out;
}

// A vertical seam from y0 to y1 near x, kinked every ~50 px and leaning by `lean`.
function seam(x, y0, y1, rng, wob, lean) {
  const pts = [];
  const n = Math.max(2, Math.round((y1 - y0) / 50));
  for (let j = 0; j <= n; j++) {
    const k = j / n;
    pts.push([x + lean * k * (y1 - y0) + (j > 0 && j < n ? rng.range(-wob, wob) : 0), y0 + (y1 - y0) * k]);
  }
  return pts;
}

// x of a top-to-bottom polyline at y.
function xOn(s, y) {
  if (y <= s[0][1]) return s[0][0];
  for (let i = 1; i < s.length; i++) {
    if (s[i][1] >= y) {
      const a = s[i - 1], b = s[i];
      return a[0] + (b[0] - a[0]) * ((y - a[1]) / ((b[1] - a[1]) || 1));
    }
  }
  return s[s.length - 1][0];
}

// The strip between two seams, from the top line down to y1.
function strip(A, B, top, y1) {
  const ta = yAt(top, A[0][0]) - 6, tb = yAt(top, B[0][0]) - 6;
  const left = A.filter((p) => p[1] > ta && p[1] < y1);
  const right = B.filter((p) => p[1] > tb && p[1] < y1);
  return [[xOn(A, ta), ta], [xOn(B, tb), tb], ...right, [xOn(B, y1), y1], [xOn(A, y1), y1], ...left.reverse()];
}

// Paint a canyon wall inside a sprite's draw(ctx).
//   top       left-to-right polyline of the wall's front top edge
//   bottom    y the body runs down to (hide it behind nearer planes)
//   left/right optional top-to-bottom polylines for the side silhouettes (default: vertical)
//   cols      mean column width; lean: how much columns tilt (px of x per px of y)
//   palette   ROCK-like palette; moss: 0..1 (thickness of the mat), mossPal
//   light, seed, detail (0..1 brush and specks)
// Returns { top, outline } (the wobbled top line actually cut).
export function drawCanyonWall(ctx, opts) {
  const {
    top: topIn, bottom, left = null, right = null, cols = 70, lean = 0.02, palette = ROCK, moss = 1, mossPal = MOSS,
    light = LIGHT, seed = 1, detail = 1, cast = { blur: 14, y: 8 }, plateau = 10, drips = 1, ledges = moss > 0 ? 1 : 0,
  } = opts;
  const P = palette;
  const rng = new RNG(`wall:${seed}`);
  const nz = noise(`wall:${seed}`);
  const top = wobbleLine(topIn, 8, 3, nz);
  const x0 = top[0][0], x1 = top[top.length - 1][0];
  const lsd = left ?? [[x0, top[0][1]], [x0, bottom]];
  const rsd = right ?? [[x1, top[top.length - 1][1]], [x1, bottom]];
  const outline = [...top, ...rsd.slice(1), [rsd[rsd.length - 1][0], bottom], [lsd[lsd.length - 1][0], bottom], ...lsd.slice(1).reverse()];
  const sil = pathOf(outline);
  piece(ctx, outline, { fill: P.deep, shadow: cast ? { color: 'rgba(4,4,12,0.55)', blur: cast.blur, x: -light[0] * 6, y: cast.y ?? 8 } : null });

  const bb = boxOf(outline);
  const yTop = bb.y - 10;
  const litSide = light[0] >= 0 ? 1 : -1;
  ctx.save();
  ctx.clip(sil);
  // Columns: seams leaning a little, spaced irregularly across the whole box.
  const xs = [bb.x - cols * 0.5];
  while (xs[xs.length - 1] < bb.x + bb.w + cols * 0.5) xs.push(xs[xs.length - 1] + cols * rng.range(0.55, 1.45));
  const seams = xs.map((sx) => seam(sx, yTop, bottom + 20, rng, 4, lean + rng.range(-0.025, 0.025)));
  for (let i = 0; i < seams.length - 1; i++) {
    const A = seams[i], B = seams[i + 1];
    const [Lt, Sh] = litSide > 0 ? [B, A] : [A, B];
    const body = piece(ctx, strip(A, B, top, bottom + 20), { fill: vary(rng.chance(0.5) ? P.mid : P.side, rng, 0.04) });
    if (detail) brush(ctx, body, { angle: Math.PI / 2, amt: 0.22 * detail, seed: rng.int(1, 1e9) });
    // Folded faces: slabs stacked down the column, lit ones hugging the lit seam.
    const colTop = Math.min(yAt(top, A[0][0]), yAt(top, B[0][0]));
    let yy = colTop - 10;
    const span = bottom - colTop;
    while (yy < bottom) {
      const len = rng.range(0.07, 0.28) * span + 22;
      const y1 = Math.min(bottom + 20, yy + len);
      const lit = rng.chance(0.5);
      const k0 = lit ? rng.range(0, 0.08) : rng.range(0.3, 0.5);
      const k1 = lit ? rng.range(0.45, 0.85) : rng.range(0.6, 0.95);
      const mixSeam = (k) => Lt.map((p, j) => [p[0] + (Sh[j][0] - p[0]) * Math.max(0, Math.min(1, k + (j > 0 && j < Lt.length - 1 ? rng.range(-0.05, 0.05) : 0))), p[1]]);
      const a = mixSeam(k0), b = mixSeam(k1);
      const s0 = rng.range(-10, 10), s1 = rng.range(-16, 16);
      const pts = [
        [xOn(a, yy), yy - s0], [xOn(b, yy), yy + s0],
        ...b.filter((p) => p[1] > yy + 2 && p[1] < y1 - 2), [xOn(b, y1), y1 + s1], [xOn(a, y1), y1 - s1],
        ...a.filter((p) => p[1] > yy + 2 && p[1] < y1 - 2).reverse(),
      ];
      const tone = lit ? (rng.chance(0.3) ? P.hi : P.lit) : rng.chance(0.5) ? P.face : P.side;
      const path = piece(ctx, pts, {
        fill: vary(tone, rng, 0.05),
        shadow: { color: 'rgba(0,0,0,0.45)', blur: 3, x: -litSide * 1.5, y: 2 },
        bevel: lit ? { light, width: 1.3, hi: 0.2, lo: 0.06 } : null,
      });
      if (detail) brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.12, 0.12), amt: 0.26 * detail, seed: rng.int(1, 1e9) });
      yy = y1 + rng.range(-12, 16);
    }
    // Crevice down the seam toward the next column.
    if (rng.chance(0.85)) {
      const c0 = colTop + rng.range(4, 30), c1 = Math.min(bottom, c0 + rng.range(0.4, 1.1) * span);
      const pts = B.filter((p) => p[1] > c0 && p[1] < c1);
      if (pts.length > 1) piece(ctx, sliver([[xOn(B, c0), c0], ...pts, [xOn(B, c1), c1]], rng.range(2, 6), { bias: -litSide * 0.4 }), { fill: rgba(P.crack, 0.95) });
    }
  }
  if (detail) {
    const n = (bb.w * bb.h) / 280;
    flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(n * 0.5 * detail), rng.int(1, 1e6), { color: P.fleck, max: 1.2, alpha: 0.55 });
    flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(n * detail), rng.int(1, 1e6), { color: '#000000', max: 1.2, alpha: 0.35 });
    flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(n * 0.5 * detail), rng.int(1, 1e6), { color: '#d8d0e0', max: 0.9, alpha: 0.25 });
  }
  ctx.restore();
  // Mossy ledges breaking up the face, each a short torn moss mat on a crack.
  if (ledges > 0) {
    ctx.save();
    ctx.clip(sil);
    const n = Math.round((bb.w / 240) * ledges);
    for (let i = 0; i < n; i++) {
      const lx = bb.x + 20 + rng.next() * Math.max(1, bb.w - 40);
      const ty = yAt(top, lx);
      const ly = ty + (bottom - ty) * rng.range(0.22, 0.62);
      const len = rng.range(50, 150), tilt = rng.range(-0.12, 0.12);
      const seg = [];
      for (let k = 0; k <= 6; k++) { const dx = -len / 2 + (len * k) / 6; seg.push([lx + dx, ly + dx * tilt + rng.range(-2.5, 2.5)]); }
      piece(ctx, sliver(seg, 5, { bias: 0.6 }), { fill: rgba(P.crack, 0.9) });
      drawMossMat(ctx, seg, { pal: mossPal, thick: 7, plateau: 3, light, seed: rng.int(1, 1e6), drips: 0.7, grass: 0.5 });
    }
    ctx.restore();
  }
  bevelBands(ctx, sil, { light, width: 1.8, hi: 0.28, lo: 0.3 });
  if (moss > 0) drawMossMat(ctx, top, { pal: mossPal, thick: 8 + 14 * moss, plateau, light, seed: rng.int(1, 1e6), drips });
  return { top, outline };
}

// A thick moss mat along a left-to-right edge: dark under-mat, olive body, yellow-lit
// tufts, tongues dripping down the face and blades of grass standing on the rim.
export function drawMossMat(ctx, line, { pal = MOSS, thick = 18, plateau = 10, light = LIGHT, seed = 1, drips = 1, grass = 1 } = {}) {
  const rng = new RNG(`moss:${seed}`);
  const nz = noise(`moss:${seed}`);
  const up = line.map(([x, y]) => [x, y - plateau]);
  const mat = (k, lift) => {
    const low = line.map(([x, y], i) => [x, y + thick * k * (0.35 + 0.8 * Math.abs(nz.fbm(x * 0.012 + k * 3, 1.7, 2)))]);
    return [...up.map(([x, y]) => [x, y + lift]), ...low.reverse()];
  };
  piece(ctx, mat(1.25, 1), {
    fill: vary(pal.dark, rng, 0.04), torn: { amp: 4, freq: 0.2, fine: 1.4, seed: rng.int(1, 1e6), step: 2 },
    shadow: { color: 'rgba(0,0,0,0.55)', blur: 6, x: -light[0] * 3, y: 4 },
  });
  // Tongues of moss dripping down the face.
  const n = Math.round(((line[line.length - 1][0] - line[0][0]) / 60) * drips);
  for (let i = 0; i < n; i++) {
    const x = line[0][0] + rng.next() * (line[line.length - 1][0] - line[0][0]);
    const y = yAt(line, x) + thick * 0.4;
    const len = rng.range(14, 50) * (0.6 + 0.4 * drips);
    const pts = [];
    for (let d = 0; d <= len; d += 6) pts.push([x + rng.range(-2, 2), y + d]);
    piece(ctx, sliver(pts, rng.range(3, 8), { bias: rng.range(-0.4, 0.4) }), {
      fill: vary(rng.chance(0.6) ? pal.dark : pal.mid, rng, 0.05), torn: { amp: 1.2, freq: 0.3, fine: 0.6, seed: rng.int(1, 1e6), step: 2 },
      shadow: { color: 'rgba(0,0,0,0.4)', blur: 2, x: 0, y: 1.5 },
    });
  }
  piece(ctx, mat(0.85, 0), {
    fill: vary(pal.mid, rng, 0.04), torn: { amp: 3.2, freq: 0.22, fine: 1.3, seed: rng.int(1, 1e6), step: 2 },
    shadow: { color: 'rgba(0,0,0,0.4)', blur: 3, x: 0, y: 2 },
    bevel: { light, width: 1.4, hi: 0.3, lo: 0.12 },
  });
  // Lit tufts piled on the mat.
  const span = line[line.length - 1][0] - line[0][0];
  const tufts = Math.round(span / 16);
  for (let i = 0; i < tufts; i++) {
    const x = line[0][0] + rng.next() * span;
    const y = yAt(line, x) - plateau * rng.range(0, 0.9) + thick * rng.range(-0.1, 0.35);
    const r = rng.range(4, 11);
    piece(ctx, blob(x, y, r * 1.7, r * 0.65, rng, { n: 14, irregular: 0.45 }), {
      fill: vary(rng.chance(0.35) ? pal.hi : pal.light, rng, 0.07), torn: { amp: 1.6, freq: 0.35, fine: 0.8, seed: rng.int(1, 1e6), step: 2 },
      shadow: { color: 'rgba(0,0,0,0.35)', blur: 2, x: 0, y: 1.5 },
    });
  }
  // Blades of grass standing on the rim.
  const blades = Math.round((span / 9) * grass);
  for (let i = 0; i < blades; i++) {
    const x = line[0][0] + rng.next() * span;
    const y = yAt(line, x) - plateau * rng.range(0.2, 1);
    const h = rng.range(5, 16), a = rng.range(-0.5, 0.5), w = rng.range(0.8, 1.8);
    const tx = x + Math.sin(a) * h, ty = y - Math.cos(a) * h;
    piece(ctx, [[x - w, y], [tx, ty], [x + w, y]], { fill: vary(rng.chance(0.5) ? pal.light : pal.hi, rng, 0.08) });
  }
  const bb = boxOf(mat(0.85, 0));
  flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(span / 2.2), rng.int(1, 1e6), { color: pal.hi, max: 1.6, alpha: 0.8 });
  flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(span / 3), rng.int(1, 1e6), { color: pal.deep, max: 1.4, alpha: 0.6 });
}
