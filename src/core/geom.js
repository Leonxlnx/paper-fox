// Geometry helpers. Shapes are arrays of [x, y] points in authored pixels.

import { noise } from './rng.js';

export const TAU = Math.PI * 2;

export function bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, x1, y1 };
}

export function polyPath(ctx, pts, closed = true) {
  if (!pts.length) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}

// Catmull-Rom spline through the points, emitted as bezier segments.
export function smoothPath(ctx, pts, closed = true, tension = 0.5) {
  const n = pts.length;
  if (n < 3) return polyPath(ctx, pts, closed);
  const get = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  const k = tension / 3;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  if (closed) ctx.closePath();
}

// Split edges so no segment is longer than maxLen (needed before displacing edges).
export function subdivide(pts, maxLen = 6, closed = true) {
  const out = [];
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(d / maxLen));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}

// Signed area: positive when the polygon winds clockwise in screen space (y down).
export function area(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

// Outward unit normals for each vertex of a closed polygon.
export function normals(pts, closed = true) {
  const n = pts.length;
  const sgn = closed && area(pts) < 0 ? -1 : 1;
  return pts.map((p, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    // Rotate tangent by -90deg (screen space) for the outward normal of a clockwise polygon.
    return [(dy / l) * sgn, (-dx / l) * sgn];
  });
}

// Torn-paper edge: subdivide, then push each vertex along its normal by layered noise.
// amp: displacement in px. fine: extra high-frequency fibre jitter in px.
export function tear(pts, { amp = 3, freq = 0.08, fine = 0.8, seed = 1, closed = true, step = 4 } = {}) {
  const sub = subdivide(pts, step, closed);
  const nm = normals(sub, closed);
  const nz = noise(seed);
  let dist = 0;
  return sub.map((p, i) => {
    if (i > 0) dist += Math.hypot(p[0] - sub[i - 1][0], p[1] - sub[i - 1][1]);
    const d = nz.fbm(dist * freq, seed * 0.13, 3) * amp + nz.n2(dist * 0.9, 3.7) * fine;
    return [p[0] + nm[i][0] * d, p[1] + nm[i][1] * d];
  });
}

// Grow (d > 0) or shrink a polygon along vertex normals. Good enough for gentle shapes.
export function inflate(pts, d, closed = true) {
  const nm = normals(pts, closed);
  return pts.map((p, i) => [p[0] + nm[i][0] * d, p[1] + nm[i][1] * d]);
}

// Irregular closed blob around (cx, cy).
export function blob(cx, cy, rx, ry, rng, { n = 18, irregular = 0.15, rot = 0 } = {}) {
  const pts = [];
  const nz = noise(rng.int(1, 1e9));
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const k = 1 + nz.n2(Math.cos(a) * 1.3, Math.sin(a) * 1.3) * irregular;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

export function ellipse(cx, cy, rx, ry, n = 32, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

// Pointed leaf / petal / fur-scale outline. Base at origin, tip at (0, -len).
// width: max half-width, belly: 0..1 where the widest point sits, curl: bends the tip sideways.
export function leaf(len, width, { belly = 0.4, curl = 0, n = 10, tipRound = 0 } = {}) {
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Width profile: rises to 1 at belly, falls to tipRound at the tip.
    const w = t < belly
      ? Math.sin((t / belly) * Math.PI / 2)
      : tipRound + (1 - tipRound) * Math.cos(((t - belly) / (1 - belly)) * Math.PI / 2);
    const bend = curl * t * t * len;
    const y = -t * len;
    left.push([-w * width + bend, y]);
    right.push([w * width + bend, y]);
  }
  return [...left, ...right.reverse()];
}

export function transform(pts, { x = 0, y = 0, rot = 0, sx = 1, sy = sx } = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([px, py]) => {
    const X = px * sx, Y = py * sy;
    return [x + X * c - Y * s, y + X * s + Y * c];
  });
}

// A horizon/ridge line from x0 to x1: returns points along the top edge.
// Combines sharp peaks (abs noise) with rolling fbm so silhouettes read as mountains.
export function ridge(x0, x1, baseY, { amp = 80, freq = 0.004, sharp = 0.6, seed = 1, step = 6, octaves = 4 } = {}) {
  const nz = noise(seed);
  const pts = [];
  for (let x = x0; x <= x1 + step; x += step) {
    const xx = Math.min(x, x1);
    const roll = nz.fbm(xx * freq, 0.5, octaves);
    const peak = 1 - Math.abs(nz.n2(xx * freq * 0.7, 9.1));
    const v = roll * (1 - sharp) + (peak * 2 - 1) * sharp;
    pts.push([xx, baseY - v * amp]);
  }
  return pts;
}

// Close an open top-edge into a filled shape down to y = bottom.
export function closeDown(top, bottom) {
  const a = top[0], b = top[top.length - 1];
  return [...top, [b[0], bottom], [a[0], bottom]];
}

export function lerpPt(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

// Sample a point at parameter t (0..1) along an open polyline.
export function along(pts, t) {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = lens[lens.length - 1] * Math.max(0, Math.min(1, t));
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] >= L) {
      const k = (L - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1);
      const a = pts[i - 1], b = pts[i];
      return { p: lerpPt(a, b, k), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return { p: b.slice(), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
