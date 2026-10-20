// Canyon walls and the rock arch. A cliff is a row of stone columns with stepped,
// sloping tops and ragged sides. Every column is a prism: a vertical ridge splits it
// into a lit face and a shadow face, both broken into blocks by slanted cracks whose
// lower block shows a thin lit ledge. Dark crevices open between some columns and a
// ragged, overhanging moss mat crowns the wall.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands } from '../core/piece.js';
import { flecks } from '../core/paper.js';
import { blob } from '../core/geom.js';
import { vary, rgba } from '../core/color.js';
import { DEFAULT_LIGHT, clamp01, boxOf, areaOf, voronoi, inset, sliver, xAtY, brush } from './terrain-kit.js';
import { STONE_PALETTES, ROCK_MAT, snowSlab } from './terrain-rocks.js';

// Stone tone for t in 0..1 (shadow -> lit), skipping the crack colour.
const stone = (P, t) => P.ramp[Math.max(1, Math.min(P.ramp.length - 1, Math.round(1 + clamp01(t) * (P.ramp.length - 2))))];

// A polyline from top to bottom at x, kinked every ~40 px.
function seam(x, y0, y1, rng, wob) {
  const pts = [];
  const n = Math.max(2, Math.round((y1 - y0) / 40));
  for (let j = 0; j <= n; j++) pts.push([x + (j > 0 && j < n ? rng.range(-wob, wob) : 0), y0 + ((y1 - y0) * j) / n]);
  return pts;
}

// Draw a cliff wall (inside a sprite's draw). Returns { top, outline }.
//   x, y, w, h     front face: left edge, top line, width, visible height; bottom: hidden extra
//   palette        STONE_PALETTES name or object
//   light          unit vector toward the light
//   cols           mean column width; step: how much column tops vary (px)
//   ragged         how far the side silhouettes step in and out (px)
//   plateau        depth of the top surface seen from above (px); deck: 'moss' or 'stone'
//   moss           0..1 moss mat along the top and tongues down the seams
//   snow           0..1 snow slabs lying on the column tops
export function drawCliff(ctx, opts = {}) {
  const {
    x, y, w, h, bottom = 120, palette = 'canyon', light = DEFAULT_LIGHT, cols = 90, step = 18, ragged = 18,
    plateau = 14, moss = 1, deck = 'moss', snow = 0, seed = 1, detail = 1, cast = { blur: 14, x: 0, y: 8 },
  } = opts;
  const P = typeof palette === 'string' ? STONE_PALETTES[palette] : palette;
  const rng = new RNG(`cliff:${seed}`);
  const nz = noise(`cliff:${seed}`);
  const yb = y + h + bottom;
  const lit = light[0] >= 0 ? 1 : -1;

  // Columns with stepped, sloping tops.
  const xs = [x];
  while (xs[xs.length - 1] < x + w - cols * 0.45) xs.push(xs[xs.length - 1] + cols * rng.range(0.5, 1.5));
  xs[xs.length - 1] = x + w;
  const ncol = xs.length - 1;
  const tops = [];
  for (let i = 0; i < ncol; i++) {
    const base = y + nz.n1(i * 0.8 + 2) * step + rng.range(-0.5, 0.5) * step;
    const slope = rng.range(-0.18, 0.18) * (xs[i + 1] - xs[i]);
    tops.push([base - slope / 2, base + slope / 2]);
  }
  const colTop = tops.map(([a, b]) => Math.min(a, b));
  const topLine = [];
  tops.forEach(([a, b], i) => {
    topLine.push([xs[i], a]);
    if (rng.chance(0.4)) topLine.push([xs[i] + (xs[i + 1] - xs[i]) * rng.range(0.3, 0.7), Math.min(a, b) - rng.range(2, step * 0.4)]);
    topLine.push([xs[i + 1], b]);
  });
  // Ragged sides: the outermost columns step in and out on the way down.
  const side = (sx, dir, yTop) => {
    const pts = [];
    let yy = yTop, xx = sx;
    while (yy < yb) {
      pts.push([xx, yy]);
      yy += rng.range(40, 120);
      pts.push([xx, Math.min(yb, yy)]);
      xx = sx + dir * rng.range(-ragged, ragged * 0.4);
    }
    return pts;
  };
  const rightSide = side(x + w, 1, tops[ncol - 1][1]);
  const leftSide = side(x, -1, tops[0][0]).reverse();
  const outline = [...topLine, ...rightSide, [x + w, yb], [x, yb], ...leftSide];
  const sil = pathOf(outline);
  piece(ctx, outline, { fill: P.ramp[0], shadow: cast ? { color: 'rgba(5,5,10,0.55)', blur: cast.blur, x: cast.x ?? 0, y: cast.y ?? 8 } : null });

  const yTop = Math.min(...colTop) - step - 30;
  const seams = xs.map((sx) => seam(sx, yTop, yb, rng, 5));
  ctx.save();
  ctx.clip(sil);
  // A zigzag line between two seams at fraction k (0 = A, 1 = B).
  const between = (A, B, k, wob) => A.map((p, j) => [p[0] + (B[j][0] - p[0]) * clamp01(k + (j > 0 && j < A.length - 1 ? rng.range(-wob, wob) : 0)), p[1]]);
  // Polygon between two top-to-bottom lines from y0 to y1, with slanted ends.
  const band = (L, R, y0, y1, s0 = 0, s1 = 0) => [
    [xAtY(L, y0), y0 - s0], [xAtY(R, y0), y0 + s0],
    ...R.filter((p) => p[1] > y0 && p[1] < y1), [xAtY(R, y1), y1 + s1], [xAtY(L, y1), y1 - s1],
    ...L.filter((p) => p[1] > y0 && p[1] < y1).reverse(),
  ];
  for (let i = 0; i < ncol; i++) {
    const A = seams[i], B = seams[i + 1];
    // Lit side seam first: planes grow inward from it.
    const [Lt, Sh] = lit > 0 ? [B, A] : [A, B];
    const base = piece(ctx, band(A, B, yTop, yb + 10), { fill: vary(stone(P, rng.range(0.18, 0.32)), rng, 0.04) });
    if (detail > 0) brush(ctx, base, { angle: Math.PI / 2, amt: 0.2 * detail, seed: rng.int(1, 1e9) });
    // Shadow face along the far seam.
    const sk = rng.range(0.15, 0.35);
    const shadowFace = piece(ctx, band(Sh, between(Sh, Lt, sk, 0.06), yTop, yb + 10), { fill: vary(stone(P, rng.range(0.02, 0.1)), rng, 0.04) });
    if (detail > 0) brush(ctx, shadowFace, { angle: Math.PI / 2, amt: 0.18 * detail, seed: rng.int(1, 1e9) });
    // Planes: irregular slabs stacked down the face, the lit ones hugging the lit seam.
    let yy = colTop[i] - 4;
    while (yy < y + h) {
      const len = rng.range(0.12, 0.4) * h + 20;
      const y1 = Math.min(yb + 10, yy + len);
      const litPlane = rng.chance(0.7);
      const k0 = litPlane ? rng.range(0, 0.06) : rng.range(0.25, 0.45);
      const k1 = litPlane ? rng.range(0.4, 0.8) : rng.range(0.55, 0.75);
      const outer = between(Lt, Sh, k0, 0.03), inner = between(Lt, Sh, k1, 0.1);
      const pts = band(outer, inner, yy, y1, rng.range(-8, 8), rng.range(-14, 14));
      const t = litPlane ? rng.range(0.55, 0.95) - ((yy - y) / h) * 0.15 : rng.range(0.3, 0.45);
      const path = piece(ctx, pts, {
        fill: vary(stone(P, t), rng, 0.05),
        shadow: { color: 'rgba(0,0,0,0.5)', blur: 3, x: -lit * 1.5, y: 2 },
        bevel: litPlane ? { light, width: 1.3, hi: 0.22, lo: 0.05 } : null,
      });
      if (detail > 0) brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.15, 0.15), amt: 0.22 * detail, seed: rng.int(1, 1e9) });
      yy = y1 + rng.range(-10, 18);
    }
    // A tapering crevice down the seam to the next column.
    if (i < ncol - 1 && rng.chance(0.8)) {
      const y0 = colTop[i + 1] + rng.range(-4, 30), y1 = Math.min(yb, y0 + rng.range(h * 0.4, h * 1.2));
      const pts = B.filter((p) => p[1] > y0 && p[1] < y1);
      if (pts.length > 1) {
        piece(ctx, sliver([[xAtY(B, y0), y0], ...pts, [xAtY(B, y1), y1]], rng.chance(0.3) ? rng.range(5, 10) : rng.range(1.5, 3.5), { bias: lit * 0.5 }), { fill: rgba(P.ramp[0], 0.95) });
      }
    }
  }
  if (detail > 0) {
    const bb = boxOf(outline);
    flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(((bb.w * bb.h) / 300) * detail), rng.int(1, 1e6), { color: P.fleck, max: 1.3, alpha: 0.7 });
    flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(((bb.w * bb.h) / 260) * detail), rng.int(1, 1e6), { color: '#000000', max: 1.2, alpha: 0.4 });
    flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(((bb.w * bb.h) / 500) * detail), rng.int(1, 1e6), { color: '#d8d0c8', max: 0.9, alpha: 0.3 });
  }
  ctx.restore();
  bevelBands(ctx, sil, { light, width: 1.8, hi: 0.3, lo: 0.3 });

  // Plateau: the top surface of the wall seen slightly from above.
  if (plateau > 0) {
    const up = topLine.map(([px, py], i) => [px, py - plateau * (0.65 + 0.35 * Math.abs(nz.n1(i * 0.37 + 3)))]);
    const top = [...up, ...topLine.slice().reverse().map(([px, py]) => [px, py + 2])];
    const dp = piece(ctx, top, {
      fill: vary(deck === 'moss' ? P.moss[1] : P.ramp[5], rng, 0.04),
      torn: { amp: 1.5, freq: 0.1, fine: 0.6, seed: rng.int(1, 1e6) },
      shadow: { color: 'rgba(0,0,0,0.3)', blur: 3, x: 0, y: 2 },
      bevel: { light, width: 1.4, hi: 0.35, lo: 0.1 },
    });
    if (deck !== 'moss' && detail > 0) drawPaving(ctx, dp, boxOf(top), P, rng, light);
  }
  if (moss > 0) drawMossCap(ctx, topLine, xs, colTop, P, rng, { moss, plateau, light, h, deck });
  if (snow > 0) {
    for (let i = 0; i < ncol; i++) {
      if (!rng.chance(0.75 * snow)) continue;
      const slab = blob((xs[i] + xs[i + 1]) / 2, colTop[i] - plateau * 0.3, (xs[i + 1] - xs[i]) * 0.62, 8 + plateau * 0.5, rng, { n: 16, irregular: 0.25 });
      snowSlab(ctx, slab, rng, { light, thick: 5 });
    }
  }
  return { top: topLine, outline };
}

// A stone ledge top cut into flat plates (the fox's walkway in ref04).
function drawPaving(ctx, deckPath, bb, P, rng, light) {
  const n = Math.max(3, Math.round(bb.w / 70));
  const seeds = Array.from({ length: n }, () => [bb.x + rng.next() * bb.w, bb.y + rng.next() * bb.h]);
  const plates = voronoi([[bb.x, bb.y], [bb.x + bb.w, bb.y], [bb.x + bb.w, bb.y + bb.h], [bb.x, bb.y + bb.h]], seeds, { sy: 2.2 });
  ctx.save();
  ctx.clip(deckPath);
  for (const c of plates) {
    const pts = inset(c.pts, 1.2);
    const pp = piece(ctx, pts, { fill: vary(P.ramp[rng.chance(0.5) ? 4 : 5], rng, 0.05), bevel: { light, width: 1.2, hi: 0.2, lo: 0.12 } });
    brush(ctx, pp, { angle: rng.range(-0.1, 0.1), amt: 0.25, scale: 0.7, seed: rng.int(1, 1e9) });
  }
  flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round((bb.w * bb.h) / 160), rng.int(1, 1e6), { color: '#000000', max: 1.4, alpha: 0.4 });
  ctx.restore();
}

// Moss: a dark under-mat and a lighter top mat along the top edge, tufts, and
// tongues running down some seams.
function drawMossCap(ctx, topLine, xs, colTop, P, rng, { moss, plateau, light, h, deck }) {
  const nz = noise(`moss:${rng.int(1, 1e6)}`);
  const thick = 6 + 12 * moss;
  // On a stone deck the moss only fringes the front edge.
  const upper = topLine.map(([px, py]) => [px, py - (deck === 'moss' ? plateau + 2 : 2 + 5 * moss)]);
  const mat = (k, amp) => {
    const lower = topLine.map(([px, py], i) => [px, py + thick * k * (0.3 + 0.9 * Math.abs(nz.n1(i * 0.45 + k * 7)))]);
    return [...upper, ...lower.slice().reverse()].map(([px, py]) => [px, py + amp]);
  };
  piece(ctx, mat(1.3, 2), {
    fill: vary(P.moss[0], rng, 0.05),
    torn: { amp: 4, freq: 0.22, fine: 1.4, seed: rng.int(1, 1e6), step: 2 },
    shadow: { color: 'rgba(0,0,0,0.55)', blur: 5, x: 0, y: 4 },
  });
  const top = mat(0.9, 0);
  piece(ctx, top, {
    fill: vary(P.moss[1], rng, 0.05),
    torn: { amp: 3.5, freq: 0.2, fine: 1.4, seed: rng.int(1, 1e6), step: 2 },
    shadow: { color: 'rgba(0,0,0,0.4)', blur: 3, x: 0, y: 2 },
    bevel: { light, width: 1.4, hi: 0.3, lo: 0.15 },
  });
  // Lighter tufts on top of the mat.
  for (let i = 0; i < topLine.length; i++) {
    if (!rng.chance(0.6)) continue;
    const [px, py] = topLine[i];
    const r = rng.range(5, 12) * (0.6 + moss * 0.5);
    piece(ctx, blob(px + rng.range(-12, 12), py - (deck === 'moss' ? plateau * rng.range(0.1, 0.8) : 0), r * 1.6, r * 0.6, rng, { n: 14, irregular: 0.45 }), {
      fill: vary(P.moss[2], rng, 0.07),
      torn: { amp: 1.8, freq: 0.35, fine: 0.9, seed: rng.int(1, 1e6), step: 2 },
      shadow: { color: 'rgba(0,0,0,0.35)', blur: 2, x: 0, y: 1.5 },
    });
  }
  // Tongues of moss running down a few seams.
  for (let i = 1; i < xs.length - 1; i++) {
    if (!rng.chance(0.4 * moss)) continue;
    const y0 = colTop[Math.min(i, colTop.length - 1)] + 6, len = rng.range(24, h * 0.3);
    const pts = [];
    for (let d = 0; d <= len; d += 8) pts.push([xs[i] + rng.range(-2.5, 2.5), y0 + d]);
    if (pts.length < 2) continue;
    piece(ctx, sliver(pts, rng.range(3, 7), { bias: rng.range(-0.4, 0.4) }), {
      fill: vary(P.moss[rng.int(0, 1)], rng, 0.06),
      torn: { amp: 1.2, freq: 0.3, fine: 0.6, seed: rng.int(1, 1e6), step: 2 },
      shadow: { color: 'rgba(0,0,0,0.35)', blur: 2, x: 0, y: 1 },
    });
  }
  const bb = boxOf(top);
  flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(bb.w / 2.5), rng.int(1, 1e6), { color: P.moss[2], max: 1.8, alpha: 0.85 });
  flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round(bb.w / 4), rng.int(1, 1e6), { color: P.moss[0], max: 1.6, alpha: 0.7 });
}

// Add a cliff wall as one baked plane.
export function addCliff(S, { z = 1400, name = 'cliff', res = 1, mat = ROCK_MAT, layer = {}, shadow = { blur: 16 }, ...opts } = {}) {
  const { x, y, w, h, bottom = 120, plateau = 14, step = 18, ragged = 18 } = opts;
  const pad = ragged + 40;
  return S.plane(z, {
    name, x: x - pad, y: y - plateau - step * 2 - 50, w: w + pad * 2, h: h + bottom + plateau + step * 2 + 90, res, mat, shadow,
    edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.6 },
    draw: (ctx) => drawCliff(ctx, { light: S.light, ...opts }),
  }, layer);
}

// The rock arch of ref08: chunky blocks set along a curve from (x0, y0) to (x1, y1),
// rising by `rise`, each cut into facets and topped with a walkable face and moss.
//   thick   band thickness (px); blocks: number of stones; deck: top face depth
export function drawArch(ctx, opts = {}) {
  const {
    x0, y0, x1, y1, rise = 80, thick = 70, blocks = 9, deck = 14, palette = 'arch', light = DEFAULT_LIGHT,
    moss = 1, seed = 1, detail = 1, cast = { blur: 14, x: 0, y: 10 },
  } = opts;
  const P = typeof palette === 'string' ? STONE_PALETTES[palette] : palette;
  const rng = new RNG(`arch:${seed}`);
  const at = (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - rise * 4 * t * (1 - t)];
  // Block boundaries along the curve; the band thickens toward the ends.
  const ts = [0];
  for (let i = 1; i < blocks; i++) ts.push((i + rng.range(-0.25, 0.25)) / blocks);
  ts.push(1);
  const thickAt = (t) => thick * (1 + 0.55 * Math.pow(Math.abs(t - 0.5) * 2, 2));
  const cut = ts.map((t) => {
    const [cx, cy] = at(t);
    return { top: [cx + rng.range(-3, 3), cy - rng.range(0, 6)], bot: [cx + rng.range(-8, 8), cy + thickAt(t) + rng.range(-6, 6)] };
  });
  const outline = [...cut.map((c) => c.top), ...cut.slice().reverse().map((c) => c.bot)];
  piece(ctx, outline, { fill: P.ramp[0], shadow: cast ? { color: 'rgba(5,5,10,0.55)', blur: cast.blur, x: cast.x ?? 0, y: cast.y ?? 10 } : null });
  for (let i = 0; i < cut.length - 1; i++) {
    const a = cut[i], b = cut[i + 1];
    const mid = [(a.top[0] + b.top[0]) / 2 + rng.range(-4, 4), (a.top[1] + b.top[1]) / 2 - rng.range(2, 10)];
    const block = [a.top, mid, b.top, b.bot, [(a.bot[0] + b.bot[0]) / 2, (a.bot[1] + b.bot[1]) / 2 + rng.range(-4, 8)], a.bot];
    const bp = piece(ctx, inset(block, 1), { fill: P.ramp[1], shadow: { color: 'rgba(0,0,0,0.5)', blur: 4, x: -light[0] * 3, y: 3 } });
    // Facets inside the block, lighter toward its top.
    const bb = boxOf(block);
    const n = Math.max(3, Math.round(areaOf(block) / 1400));
    const seeds = Array.from({ length: n }, () => [bb.x + rng.next() * bb.w, bb.y + rng.next() * bb.h]);
    const blockLean = rng.range(-0.5, 0.5);
    ctx.save();
    ctx.clip(bp);
    for (const c of voronoi(block, seeds)) {
      const s = (bb.y + bb.h - c.seed[1]) / bb.h;
      const I = (blockLean + rng.range(-0.3, 0.3)) * light[0] + (s * 0.6 + rng.range(-0.15, 0.15)) * -light[1];
      const path = piece(ctx, inset(c.pts, 1), {
        fill: vary(stone(P, 0.42 + I * 0.7), rng, 0.05),
        shadow: { color: 'rgba(0,0,0,0.45)', blur: 3, x: -light[0] * 1.5, y: 2 },
        bevel: I > 0.1 ? { light, width: 1.3, hi: 0.18, lo: 0.05 } : null,
      });
      if (detail > 0) brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.3, 0.3), amt: 0.22 * detail, scale: 0.7, seed: rng.int(1, 1e9) });
    }
    ctx.restore();
    // Walkable top face.
    const deckPts = [a.top, [a.top[0] + 3, a.top[1] - deck * rng.range(0.6, 1)], [mid[0], mid[1] - deck], [b.top[0] - 3, b.top[1] - deck * rng.range(0.6, 1)], b.top, mid];
    const dp = piece(ctx, deckPts, { fill: vary(P.ramp[5], rng, 0.04), bevel: { light, width: 1.2, hi: 0.35, lo: 0.15 } });
    if (detail > 0) brush(ctx, dp, { angle: 0, amt: 0.22 * detail, scale: 0.7, seed: rng.int(1, 1e9) });
  }
  if (detail > 0) {
    const bb = boxOf(outline);
    flecks(ctx, bb.x, bb.y - deck, bb.w, bb.h + deck, Math.round(((bb.w * bb.h) / 260) * detail), rng.int(1, 1e6), { color: P.fleck, max: 1.3, alpha: 0.7 });
  }
  if (moss > 0) {
    const tops = cut.map((c) => [c.top[0], c.top[1] - deck * 0.6]);
    for (let i = 0; i < tops.length - 1; i++) {
      if (!rng.chance(0.7 * moss)) continue;
      const [ax, ay] = tops[i], [bx, by] = tops[i + 1];
      const cx = (ax + bx) / 2 + rng.range(-10, 10), cy = (ay + by) / 2 - 4;
      const rx = Math.abs(bx - ax) * rng.range(0.3, 0.6), ry = rng.range(6, 12);
      piece(ctx, blob(cx, cy, rx, ry, rng, { n: 16, irregular: 0.4 }), {
        fill: vary(P.moss[rng.int(1, 2)], rng, 0.06),
        torn: { amp: 2, freq: 0.3, fine: 1, seed: rng.int(1, 1e6), step: 2 },
        shadow: { color: 'rgba(0,0,0,0.4)', blur: 3, x: 0, y: 2 },
      });
      if (rng.chance(0.5)) {
        // Moss hanging over the front edge.
        const hx = cx + rng.range(-rx * 0.5, rx * 0.5);
        piece(ctx, sliver([[hx, cy], [hx + rng.range(-3, 3), cy + 12], [hx + rng.range(-4, 4), cy + rng.range(20, 40)]], rng.range(3, 6)), {
          fill: vary(P.moss[1], rng, 0.06),
          torn: { amp: 1, freq: 0.3, fine: 0.5, seed: rng.int(1, 1e6), step: 2 },
        });
      }
    }
  }
  bevelBands(ctx, pathOf(outline), { light, width: 1.8, hi: 0.3, lo: 0.25 });
  return { outline, cut };
}

// Add an arch as one baked plane.
export function addArch(S, { z = 1000, name = 'arch', res = 1.25, mat = ROCK_MAT, layer = {}, shadow = { blur: 16 }, ...opts } = {}) {
  const { x0, y0, x1, y1, rise = 80, thick = 70 } = opts;
  const pad = 60;
  const top = Math.min(y0, y1) - rise - pad, bot = Math.max(y0, y1) + thick * 1.6 + pad;
  return S.plane(z, {
    name, x: Math.min(x0, x1) - pad, y: top, w: Math.abs(x1 - x0) + pad * 2, h: bot - top, res, mat, shadow,
    edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.6 },
    draw: (ctx) => drawArch(ctx, { light: S.light, ...opts }),
  }, layer);
}
