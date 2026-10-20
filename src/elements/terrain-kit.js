// Shared helpers for the terrain family: polyline sampling, polygon tools (hull,
// Voronoi cells, inset), slivers, and the brushed-paper texture laid over pieces.

import { mulberry32 } from '../core/rng.js';
import { surface } from '../core/canvas.js';
import { pathOf } from '../core/piece.js';

export const DEFAULT_LIGHT = [0.5, -0.866];

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

// --- polylines ------------------------------------------------------------------

// Cumulative arc lengths of an open polyline.
export function lengths(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return L;
}

// Point at arc length d along an open polyline (L from lengths()).
export function pointAt(pts, L, d) {
  if (d <= 0) return pts[0].slice();
  for (let i = 1; i < pts.length; i++) {
    if (L[i] >= d) {
      const k = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    }
  }
  return pts[pts.length - 1].slice();
}

// The part of a polyline between arc lengths d0 < d1, endpoints interpolated.
export function segment(pts, L, d0, d1) {
  const out = [pointAt(pts, L, d0)];
  for (let i = 1; i < pts.length - 1; i++) if (L[i] > d0 && L[i] < d1) out.push(pts[i].slice());
  out.push(pointAt(pts, L, d1));
  return out;
}

// Unit direction of a polyline around arc length d.
export function dirAt(pts, L, d) {
  const a = pointAt(pts, L, Math.max(0, d - 12)), b = pointAt(pts, L, d + 12);
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

// x of a top-to-bottom polyline at height y.
export function xAtY(s, y) {
  if (y <= s[0][1]) return s[0][0];
  for (let i = 1; i < s.length; i++) {
    if (s[i][1] >= y) {
      const k = (y - s[i - 1][1]) / ((s[i][1] - s[i - 1][1]) || 1);
      return s[i - 1][0] + (s[i][0] - s[i - 1][0]) * k;
    }
  }
  return s[s.length - 1][0];
}

// A sliver along a polyline: width w in the middle, pointed at both ends.
// bias -1..1 pushes the width to one side of the line.
export function sliver(pts, w, { bias = 0 } = {}) {
  const L = lengths(pts), total = L[L.length - 1];
  const left = [], right = [];
  const n = Math.max(3, Math.ceil(total / 8));
  for (let i = 0; i <= n; i++) {
    const d = (i / n) * total;
    const p = pointAt(pts, L, d), t = dirAt(pts, L, d);
    const k = Math.sin((i / n) * Math.PI) ** 0.7 * w;
    left.push([p[0] + t[1] * k * (1 + bias), p[1] - t[0] * k * (1 + bias)]);
    right.push([p[0] - t[1] * k * (1 - bias), p[1] + t[0] * k * (1 - bias)]);
  }
  return [...left, ...right.reverse()];
}

// --- polygons -------------------------------------------------------------------

export function boxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function areaOf(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s / 2);
}

export function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

// Convex hull (monotone chain).
export function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// Keep the part of a convex polygon where a*x + b*y <= c.
function clipHalf(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length];
    const fp = a * P[0] + b * P[1] - c, fq = a * Q[0] + b * Q[1] - c;
    if (fp <= 0) out.push(P);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  }
  return out;
}

// Voronoi cells of seed points inside a convex polygon. sy < 1 stretches cells
// vertically (distances measured with y squashed), sy > 1 flattens them.
// Returns [{ seed, i, pts }] for the cells that are not empty.
export function voronoi(poly, seeds, { sy = 1 } = {}) {
  const P = poly.map(([x, y]) => [x, y * sy]);
  const S = seeds.map(([x, y]) => [x, y * sy]);
  const out = [];
  S.forEach((s, i) => {
    let cell = P;
    for (let j = 0; j < S.length && cell.length >= 3; j++) {
      if (j === i) continue;
      const t = S[j];
      cell = clipHalf(cell, t[0] - s[0], t[1] - s[1], (t[0] * t[0] + t[1] * t[1] - s[0] * s[0] - s[1] * s[1]) / 2);
    }
    if (cell.length >= 3) out.push({ seed: seeds[i], i, pts: cell.map(([x, y]) => [x, y / sy]) });
  });
  return out;
}

// Shrink a polygon toward its centroid by d px: the gaps read as cut seams.
export function inset(pts, d) {
  const [cx, cy] = centroid(pts);
  return pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, l - d) / l;
    return [cx + dx * k, cy + dy * k];
  });
}

// A canvas used only for point-in-path tests in authored coordinates.
let probe = null;
export function insidePath(path, x, y) {
  if (!probe) probe = surface(1, 1).ctx;
  return probe.isPointInPath(path, x, y);
}

// Random points inside a polygon, at least `gap` px apart.
export function scatterIn(poly, n, rng, { gap = 0 } = {}) {
  const b = boxOf(poly);
  const path = pathOf(poly);
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 30; tries++) {
    const p = [b.x + rng.next() * b.w, b.y + rng.next() * b.h];
    if (!insidePath(path, p[0], p[1])) continue;
    if (gap && out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < gap)) continue;
    out.push(p);
  }
  return out;
}

// --- brushed paper --------------------------------------------------------------

// One tileable sheet of short light and dark strokes, all running along +x. Filling
// a piece with it (rotated to the piece's grain) gives the layered, brushed look of
// the reference rock, snow and grass in a single draw call per piece.
const TILE = 384;
let brushTile = null;
function brushSheet() {
  if (brushTile) return brushTile;
  const { canvas, ctx } = surface(TILE, TILE);
  const r = mulberry32(4711);
  ctx.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = r() * TILE, y = r() * TILE;
    const len = 5 + r() * r() * 22, a = (r() - 0.5) * 0.45;
    const light = r() < 0.5;
    ctx.strokeStyle = light ? `rgba(255,255,255,${0.25 + r() * 0.5})` : `rgba(0,0,0,${0.25 + r() * 0.5})`;
    ctx.lineWidth = 0.9 + r() * 1.9;
    const dx = Math.cos(a) * len, dy = Math.sin(a) * len;
    for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
      const X = x + ox, Y = y + oy;
      if (X < -30 || Y < -30 || X > TILE + 30 || Y > TILE + 30) continue;
      ctx.beginPath();
      ctx.moveTo(X, Y);
      ctx.lineTo(X + dx, Y + dy);
      ctx.stroke();
    }
  }
  brushTile = canvas;
  return canvas;
}

// Brush strokes over a piece (clipped to its path).
//   angle  grain direction in radians (strokes run along it)
//   amt    strength 0..1; scale: stroke size multiplier; seed: offsets the pattern
export function brush(ctx, path, { angle = Math.PI / 2, amt = 0.25, scale = 1, seed = 0 } = {}) {
  if (amt <= 0) return;
  const pat = ctx.createPattern(brushSheet(), 'repeat');
  const r = mulberry32(seed >>> 0);
  pat.setTransform(new DOMMatrix().translateSelf(r() * TILE, r() * TILE).rotateSelf((angle * 180) / Math.PI).scaleSelf(scale));
  ctx.save();
  ctx.globalAlpha *= amt;
  ctx.fillStyle = pat;
  ctx.fill(path);
  ctx.restore();
}

// Cheap contact shadow: the path filled offset in a translucent dark colour, unblurred.
// For small pieces this reads the same as a blurred shadow at a fraction of the cost.
export function lift(ctx, path, { dx = 0, dy = 1.5, color = 'rgba(0,0,0,0.3)' } = {}) {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}
