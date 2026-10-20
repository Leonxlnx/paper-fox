// Painting the paper fox. Silhouette first, then fur:
//
//   1. Each body part is ONE smooth cut-out (a closed spline through hand-placed points
//      traced from the references) filled with the base orange, with soft paper
//      overlays for its light and shade clipped to it.
//   2. Over it lie rows of torn fur flakes that follow the anatomy: few, large, broad
//      pointed pieces of felt, the rows laid from the rump toward the head so every row
//      laps over the one behind it like shingles. Each row casts one soft contact shadow
//      on the row beneath (castGroup), never one around every piece, so smooth paper
//      shows between rows. Tips may break the outline a little, so the silhouette reads
//      as torn fur rather than a clean line.
//
// Painters only collect flat shapes into a Paint; the sprite bake adds paper texture,
// the cut-edge light and the drop shadows.
//
// Coordinates are "fox units": film px at scale 1, origin on the ground between the
// paws, the fox facing +x, y down (see fox-rig.js).

import { piece } from '../core/piece.js';
import { transform, ellipse, TAU } from '../core/geom.js';
import { mix, hex, toHex, rgba } from '../core/color.js';
import { clamp, lerp, smoothstep } from '../core/ease.js';

// ---------------------------------------------------------------------------
// Geometry helpers

// Catmull-Rom curve through control points, sampled into a dense polygon.
export function spline(pts, { closed = true, n = 6 } = {}) {
  const N = pts.length;
  const get = (i) => (closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))]);
  const out = [];
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t
        + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push(pts[N - 1].slice());
  return out;
}

export function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function polyBounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

// Distance from (x, y) to the nearest edge of a polygon.
function edgeDist(poly, x, y) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
    if (d < best) best = d;
  }
  return best;
}

// Vertical extent of a polygon at x: [top, bottom], or null outside.
function scanY(poly, x) {
  let top = Infinity, bot = -Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((xi > x) !== (xj > x)) {
      const y = yi + ((x - xi) / (xj - xi)) * (yj - yi);
      if (y < top) top = y;
      if (y > bot) bot = y;
    }
  }
  return top < bot ? [top, bot] : null;
}

// Open curve through control points, parametrised by arc length: s in [0, 1] -> [x, y].
function curveAt(pts) {
  const d = spline(pts, { closed: false, n: 10 });
  const lens = [0];
  for (let i = 1; i < d.length; i++) lens.push(lens[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
  const total = lens[lens.length - 1] || 1;
  return (s) => {
    const L = clamp(s) * total;
    let i = 1;
    while (i < lens.length - 1 && lens[i] < L) i++;
    const k = (L - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1);
    return [lerp(d[i - 1][0], d[i][0], k), lerp(d[i - 1][1], d[i][1], k)];
  };
}

const dirOf = (a) => [Math.cos(a), Math.sin(a)];

// Colour ramp: v in [0, 1] across evenly spaced stops.
export function ramp(stops, v) {
  const x = clamp(v) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

// ---------------------------------------------------------------------------
// Paint: a recorded list of cut-outs whose bounds come from the shapes themselves,
// so every sprite box fits its pieces exactly. A style's fill may be a function of
// the context (for gradients). `custom(fn)` records a raw drawing step (soft overlays).

export class Paint {
  constructor() {
    this.ops = [];
    this.b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  }
  grow(x0, y0, x1, y1) {
    const b = this.b;
    b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0);
    b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1);
  }
  shape(pts, style) {
    const { x0, y0, x1, y1 } = polyBounds(pts);
    this.grow(x0, y0, x1, y1);
    this.ops.push({ pts, style });
    return this;
  }
  custom(fn) {
    this.ops.push({ fn });
    return this;
  }
  box(margin = 10) {
    const b = this.b;
    return { x: Math.floor(b.x0 - margin), y: Math.floor(b.y0 - margin), w: Math.ceil(b.x1 - b.x0 + margin * 2), h: Math.ceil(b.y1 - b.y0 + margin * 2) };
  }
  draw(ctx) {
    for (const op of this.ops) {
      if (op.fn) { ctx.save(); op.fn(ctx); ctx.restore(); continue; }
      const { pts, style } = op;
      piece(ctx, pts, typeof style.fill === 'function' ? { ...style, fill: style.fill(ctx) } : style);
    }
  }
}

const radialFill = (cx, cy, r, stops) => (ctx) => {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};
const linearFill = (x0, y0, x1, y1, stops) => (ctx) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};

// A part's panel shading as ramp values: radial from the lit point (cx, cy) over r.
function panelShade(pal, cx, cy, r, values) {
  const at = (x, y) => {
    const d = clamp(Math.hypot(x - cx, y - cy) / r) * (values.length - 1);
    const i = Math.min(values.length - 2, Math.floor(d));
    return lerp(values[i], values[i + 1], d - i);
  };
  return { at, fill: radialFill(cx, cy, r, values.map((v) => ramp(pal.fur, v))) };
}

// Soft light and shade laid over what is already painted (source-atop), as blurred
// paper overlays: spots = [[x, y, rx, ry, rot, k]], k > 0 light (hi), k < 0 shade (lo).
function softSpots(P, spots, hi, lo, gain = 2.3) {
  P.custom((ctx) => {
    ctx.globalCompositeOperation = 'source-atop';
    for (const [cx, cy, rx, ry, rot, k] of spots) {
      const col = k > 0 ? hi : lo;
      const a = Math.min(0.85, Math.abs(k) * gain);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.7);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.45, rgba(col, a * 0.6));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1.7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  });
}

// Shade value of the spots at (x, y), matching softSpots.
function spotValue(spots, x, y) {
  let v = 0;
  for (const [cx, cy, rx, ry, rot, k] of spots) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const dx = x - cx, dy = y - cy;
    const u = (dx * c + dy * s) / rx, w = (-dx * s + dy * c) / ry;
    const d2 = u * u + w * w;
    if (d2 < 4) v += k * Math.exp(-d2 * 1.1);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Fur tufts

// A torn fur tuft: a cluster of pointed tips on one shared base, the base at the
// origin, the tips toward (0, -len). `width` is the half-width.
//   tips    [min, max] number of points (2-5 for body fur, 1 for a single tongue)
//   notch   [min, max] depth of the cuts between tips, as a fraction of len
//   bulge   how far the sides swell past the width
//   spread  how far the outer tips sit toward the sides (fraction of width)
//   teeth   chance of a small barb torn into each side
//   curl    sideways bend toward the tips (fraction of len)
export function tuft(rng, len, width, { tips = [2, 3], notch = [0.14, 0.3], bulge = 0.2, spread = 0.72, teeth = 0.15, curl = 0 } = {}) {
  const k = rng.int(tips[0], tips[1]);
  const T = [];
  for (let i = 0; i < k; i++) {
    const u = k === 1 ? 0 : (i / (k - 1)) * 2 - 1;
    const L = len * (1 - Math.abs(u) * rng.range(0.1, 0.36)) * rng.range(0.86, 1.04);
    T.push([u * width * spread + rng.range(-0.12, 0.12) * width, -L]);
  }
  const sw = width * (1 + bulge);
  const bw = width * rng.range(0.55, 0.7);
  // The base narrows to a point upstream, like a quill, so a base left uncovered reads as
  // the strip emerging from under the coat rather than as a round scale.
  const pts = [[bw, 0], [bw * 0.3, len * 0.2], [0, len * 0.28], [-bw * 0.3, len * 0.2], [-bw, 0]];
  // Leaf-like sides: swelling out low down, curving in again toward the outer tip,
  // now and then with a small barb torn into them.
  const side = (sgn, tip) => {
    const s0 = [sgn * sw * rng.range(0.92, 1.02), -len * rng.range(0.2, 0.28)];
    const s1 = [sgn * lerp(sw, Math.abs(tip[0]), 0.35) * rng.range(0.95, 1.03), -len * rng.range(0.5, 0.58)];
    const out = [s0, s1];
    if (rng.chance(teeth)) {
      const f = rng.range(0.3, 0.5);
      const p = [lerp(s1[0], tip[0], f), lerp(s1[1], tip[1], f)];
      out.push(p, [p[0] + sgn * width * rng.range(0.16, 0.26), p[1] - len * rng.range(0.08, 0.13)], [p[0] - sgn * width * 0.1, p[1] - len * 0.04]);
    }
    return out;
  };
  pts.push(...side(-1, T[0]));
  for (let i = 0; i < k; i++) {
    pts.push(T[i]);
    if (i < k - 1) {
      const a = T[i], b = T[i + 1];
      pts.push([lerp(a[0], b[0], rng.range(0.38, 0.62)), Math.max(a[1], b[1]) + len * rng.range(notch[0], notch[1])]);
    }
  }
  pts.push(...side(1, T[k - 1]).reverse());
  if (curl) for (const p of pts) { const t = -p[1] / len; p[0] += curl * t * t * len; }
  return pts;
}

// The old single-flake shape, kept for tools: a tuft with one to four tips.
export function flake(rng, len, width, { points = [1, 1], notch = 0.42, bulge = 0.3, curl = 0, spread = 0.75 } = {}) {
  return tuft(rng, len, width, { tips: points, notch: [notch * 0.75, notch * 1.25], bulge, spread, curl });
}

// Draw style for a tuft pointing along `dir`: torn outline, a contact shadow cast
// downstream onto the row beneath, faint lit / unlit bevel.
export function flakeStyle(fill, dir, rng, { ink, light = null, blur = 2, drop = 2.2, torn = 0.5, bevel = 0.13 } = {}) {
  return {
    fill,
    torn: torn ? { amp: torn, freq: 0.45, fine: 0.45, seed: rng.int(1, 64), step: 1.8 } : null,
    shadow: ink ? { color: ink, blur, x: dir[0] * drop, y: dir[1] * drop + 0.6 } : null,
    bevel: light && bevel ? { light, width: 1, hi: bevel, lo: bevel * 1.4 } : null,
  };
}

// A palette ink ('rgba(r,g,b,a)') at another alpha.
const inkA = (c, a) => c.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, (m, r, g, b) => `rgba(${r},${g},${b},${a})`);

// Signed area (shoelace): the sign gives the winding.
function area(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  return s / 2;
}

// One soft contact shadow for a whole group of pieces (one row of fur): call before laying
// the group (its pieces drawn without shadows of their own), then call the returned
// function with the downstream direction. The group's union is blurred and cast onto what
// lies beneath, so pieces of one row cast nothing on each other and the only seams are
// where a row laps over the one before it.
//   sh = { color, blur, drop }
function castGroup(P, sh) {
  const op = { fn: () => {} };
  P.ops.push(op);
  const start = P.ops.length;
  return (dir) => {
    const polys = [];
    for (let i = start; i < P.ops.length; i++) if (P.ops[i].pts) polys.push(P.ops[i].pts);
    if (!polys.length) return;
    const dx = dir[0] * sh.drop, dy = dir[1] * sh.drop + 0.5;
    op.fn = (ctx) => {
      const k = ctx.__res || 1;
      const p = new Path2D();
      for (const pts of polys) {
        const q = area(pts) < 0 ? pts.slice().reverse() : pts;
        q.forEach(([x, y], i) => (i ? p.lineTo(x + dx, y + dy) : p.moveTo(x + dx, y + dy)));
        p.closePath();
      }
      ctx.filter = `blur(${(sh.blur * k) / 2}px)`;
      ctx.fillStyle = sh.color;
      ctx.fill(p);
    };
  };
}

// A long jagged blade along path(s) (s 0 = root .. 1 = point; path returns { p, n }): half
// width w0 at the root, tapering to the point, each side torn into `teeth` barbs whose
// spikes point toward the tip. The pieces of the tail's white brush.
function blade(path, w0, rng, teeth) {
  const prof = (s) => Math.pow(clamp(1 - s), 0.85) * (1 + 0.28 * Math.sin(Math.PI * clamp(s)));
  const D = teeth + 0.35;
  const side = (sg) => {
    const out = [];
    for (let j = 0; j < teeth; j++) {
      const sa = Math.max(0, (j + (j ? rng.range(-0.08, 0.08) : 0)) / D), sb = (j + rng.range(0.72, 0.86)) / D;
      const a = path(sa), b = path(sb);
      const wa = w0 * prof(sa) * (j ? rng.range(0.5, 0.66) : 1), wb = w0 * prof(sb) * rng.range(1.02, 1.18);
      out.push([a.p[0] + a.n[0] * wa * sg, a.p[1] + a.n[1] * wa * sg], [b.p[0] + b.n[0] * wb * sg, b.p[1] + b.n[1] * wb * sg]);
    }
    return out;
  };
  const back = path(-0.05).p;
  return [back, ...side(1), path(1).p, ...side(-1).reverse()];
}

// How far the points of a shape reach past a region (0 when they all lie inside).
function overflow(region, pts) {
  let m = 0;
  for (const [x, y] of pts) if (!inside(region, x, y)) m = Math.max(m, edgeDist(region, x, y));
  return m;
}

// Place one tuft with its root at (x, y), pointing at angle a. With `fit = { region, out,
// min }` the tuft is shrunk about its root (down to `min` of its size, default 0.4, else
// dropped) until no point of it reaches more than `out` units past `region`, so a ragged
// edge stays subtle instead of inflating the silhouette. Returns whether it was laid.
export function addTuft(P, rng, x, y, a, len, width, fill, style = {}, shape = {}, fit = null) {
  const local = tuft(rng, len, width, shape);
  const rot = a + Math.PI / 2;
  let pts = transform(local, { x, y, rot });
  if (fit) {
    let k = 1;
    while (overflow(fit.region, pts) > fit.out) {
      k *= 0.85;
      if (k < (fit.min ?? 0.4)) return false;
      pts = transform(local, { x, y, rot, sx: k });
    }
  }
  P.shape(pts, flakeStyle(fill, dirOf(a), rng, style));
  return true;
}
export const addFlake = addTuft;

// Rows of tufts lofted between two cross-section curves. `from` is the downstream row
// (laid first), `to` the upstream row (laid last); optional `mid` bends the flow lines.
// Tufts point downstream; near the ends of each row they tilt out of the part, so
// their tips break the outline by up to `out` units.
//   n, gap   number of rows, spacing of tufts along a row
//   size     (x, y, s, k) -> tuft length (s across the row 0..1, k along the flow 0..1)
//   width    half-width as a fraction of length
//   color    (x, y, rng, s, k) -> fill, sampled at the tuft's middle
//   region   polygon the roots must lie in
//   under    { chance, color(x, y, rng) }: a darker tuft laid first, turned, so rust
//            points peek out between the tufts
//   turn     optional (x, y, s, k) -> extra angle
//   keep     optional (x, y, s, k) -> 0..1 chance of laying a tuft (lets smooth felt show)
export function furRows(P, rng, R) {
  const { from, to, mid = null, n, gap, size, color, region = null, out = 12, tilt = 0.55, edge = 0.2, under = null,
    width = 0.38, shape = {}, style = {}, turn = null, ends = [0, 1], keep = null, fit = null, cast = null } = R;
  const st = cast ? { ...style, ink: null } : style;
  const A = curveAt(from), B = curveAt(to), M = mid ? curveAt(mid) : null;
  const at = (s, k) => {
    const a = A(s), b = B(s);
    if (!M) return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
    const m = M(s);
    const wa = (1 - k) * (1 - 2 * k), wm = 4 * k * (1 - k), wb = k * (2 * k - 1);
    return [a[0] * wa + m[0] * wm + b[0] * wb, a[1] * wa + m[1] * wm + b[1] * wb];
  };
  let count = 0;
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    let L = 0, prev = at(ends[0], k);
    for (let q = 1; q <= 8; q++) { const p = at(lerp(ends[0], ends[1], q / 8), k); L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
    const m = Math.max(1, Math.round(L / gap));
    const row = [];
    for (let j = 0; j <= m; j++) {
      if (i % 2 && j === m) continue;
      const s = lerp(ends[0], ends[1], clamp((j + (i % 2 ? 0.5 : 0) + rng.range(-0.22, 0.22)) / m));
      // With `stagger`, roots wander along the flow by up to that fraction of a row, so a
      // row's tips do not line up into one straight shelf.
      const [x, y] = at(s, k + (R.stagger && n > 1 ? rng.range(-R.stagger, R.stagger) / (n - 1) : 0));
      const q0 = at(s, k - 0.04), q1 = at(s, k + 0.04);
      let dx = q0[0] - q1[0], dy = q0[1] - q1[1];
      let dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      const we = Math.max(smoothstep(edge, 0, s), smoothstep(1 - edge, 1, s));
      if (we > 0) {
        const e0 = at(s < 0.5 ? 0 : 1, k), e1 = at(s < 0.5 ? 0.15 : 0.85, k);
        const ox = e0[0] - e1[0], oy = e0[1] - e1[1], ol = Math.hypot(ox, oy) || 1;
        dx += (ox / ol) * tilt * we; dy += (oy / ol) * tilt * we;
        dl = Math.hypot(dx, dy) || 1;
        dx /= dl; dy /= dl;
      }
      row.push({ x, y, s, a: Math.atan2(dy, dx) + rng.range(-0.12, 0.12) + (turn ? turn(x, y, s, k) : 0) });
    }
    // Within a row the upper tufts lap over the lower ones.
    row.sort((p, q) => q.y - p.y);
    const done = cast ? castGroup(P, cast) : null;
    let ax = 0, ay = 0;
    for (const t of row) {
      if (region && !inside(region, t.x, t.y) && edgeDist(region, t.x, t.y) > 3) continue;
      if (keep && rng.next() > keep(t.x, t.y, t.s, k)) continue;
      let len = size(t.x, t.y, t.s, k) * rng.range(0.85, 1.15);
      if (region) {
        let ok = false;
        for (let tries = 0; tries < 4 && !ok; tries++) {
          const tx = t.x + Math.cos(t.a) * len * 0.95, ty = t.y + Math.sin(t.a) * len * 0.95;
          if (inside(region, tx, ty) || edgeDist(region, tx, ty) <= out) ok = true; else len *= 0.8;
        }
        if (!ok) continue;
      }
      const cx = t.x + Math.cos(t.a) * len * 0.5, cy = t.y + Math.sin(t.a) * len * 0.5;
      if (under && rng.chance(under.chance)) {
        addTuft(P, rng, t.x, t.y, t.a + rng.sign() * rng.range(0.16, 0.32), len * rng.range(0.95, 1.1), len * width * 0.8,
          under.color(cx, cy, rng), st, { ...shape, tips: [1, 3] }, fit);
      }
      addTuft(P, rng, t.x, t.y, t.a, len, len * width * rng.range(0.85, 1.15), color(cx, cy, rng, t.s, k), st,
        { ...shape, curl: (shape.curl ?? 0.1) * rng.range(-1, 1) }, fit);
      ax += Math.cos(t.a); ay += Math.sin(t.a);
      count++;
    }
    if (done) { const al = Math.hypot(ax, ay) || 1; done([ax / al, ay / al]); }
  }
  return count;
}

// A field of tufts rooted inside `region` on a jittered hex grid, drawn downstream
// first so that upstream tufts overlap them like shingles (head and neck fur).
export function furField(P, rng, f) {
  const { region, step, flow, size, width = 0.32, color, shape = {}, style = {}, density = null, jitter = 0.35, contain = null, under = null, fit = null,
    cast = null, band = step } = f;
  const b = polyBounds(region);
  const seeds = [];
  let row = 0;
  for (let y = b.y0; y <= b.y1; y += step * 0.866, row++) {
    for (let x = b.x0 + (row % 2) * step * 0.5; x <= b.x1; x += step) {
      const px = x + rng.range(-jitter, jitter) * step, py = y + rng.range(-jitter, jitter) * step;
      if (!inside(region, px, py)) continue;
      if (density && rng.next() > density(px, py)) continue;
      const a = flow(px, py);
      const d = dirOf(a);
      const o = f.order ? f.order(px, py) : -(px * d[0] + py * d[1]);
      seeds.push({ x: px, y: py, a, o: o + rng.range(-0.5, 0.5) * step * (f.orderJitter ?? 0.6) });
    }
  }
  seeds.sort((p, q) => p.o - q.o);
  // With `cast`, the field is laid in bands `band` units deep along the order, each band
  // casting one soft shadow on the bands before it (see castGroup).
  const st = cast ? { ...style, ink: null } : style;
  let n = 0, done = null, b0 = -Infinity, ax = 0, ay = 0;
  const close = () => { if (done) { const al = Math.hypot(ax, ay) || 1; done([ax / al, ay / al]); } ax = ay = 0; };
  for (const s of seeds) {
    if (cast && s.o - b0 > band) { close(); done = castGroup(P, cast); b0 = s.o; }
    const len = size(s.x, s.y) * rng.range(0.85, 1.15);
    const a = s.a + rng.range(-0.1, 0.1);
    if (contain && !inside(contain, s.x + Math.cos(a) * len * 0.8, s.y + Math.sin(a) * len * 0.8)) continue;
    if (under && rng.chance(under.chance)) {
      const ua = a + rng.sign() * rng.range(0.14, 0.28), ul = len * rng.range(1.0, 1.1);
      addTuft(P, rng, s.x, s.y, ua, ul, ul * width * 0.85, under.color(s.x, s.y, rng), st, { ...shape, tips: [1, 3] }, fit);
    }
    addTuft(P, rng, s.x, s.y, a, len, len * width * rng.range(0.85, 1.15), color(s.x, s.y, rng), st,
      { ...shape, curl: (shape.curl ?? 0.1) * rng.range(-1, 1) }, fit);
    ax += Math.cos(a); ay += Math.sin(a);
    n++;
  }
  close();
  return n;
}

// Tufts rooted along a polyline, pointing at angle(x, y). Used for fringes: the
// jagged lower edge of the head, the ruff, the belly line, the cape over the haunch.
export function fringe(P, rng, line, { step, angle, size, width = 0.32, color, shape = {}, style: style0 = {}, under = null, fit = null, cast = null }) {
  // With `cast` the whole fringe is one row casting one soft shadow (see castGroup).
  const style = cast ? { ...style0, ink: null } : style0;
  const done = cast ? castGroup(P, cast) : null;
  let ax = 0, ay = 0;
  let acc = step * rng.range(0, 0.5);
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1], [x1, y1] = line[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    while (acc <= d) {
      const t = acc / d;
      const x = lerp(x0, x1, t), y = lerp(y0, y1, t);
      const len = size(x, y) * rng.range(0.85, 1.15);
      const a = angle(x, y) + rng.range(-0.14, 0.14);
      if (under && rng.chance(under.chance)) {
        addTuft(P, rng, x, y, a + rng.sign() * rng.range(0.2, 0.35), len * 1.06, len * width * 0.85, under.color(x, y, rng), style, { ...shape, tips: [1, 3] }, fit);
      }
      addTuft(P, rng, x, y, a, len, len * width * rng.range(0.85, 1.15), color(x, y, rng), style,
        { ...shape, curl: (shape.curl ?? 0.1) * rng.range(-1, 1) }, fit);
      ax += Math.cos(a); ay += Math.sin(a);
      acc += step * rng.range(0.75, 1.25);
    }
    acc -= d;
  }
  if (done) { const al = Math.hypot(ax, ay) || 1; done([ax / al, ay / al]); }
}

// ---------------------------------------------------------------------------
// Styles and colours

// Fur colour at ramp value v. Values above 1 run on into the light highlight orange
// (`pal.furHi`), used for the lit tops of the back, shoulder, haunch and crown.
const furColor = (pal, v, rng, spread = 0.07) => {
  const x = v + rng.range(-spread, spread);
  return x > 1 && pal.furHi ? mix(pal.fur[pal.fur.length - 1], pal.furHi, clamp((x - 1) / 0.2)) : ramp(pal.fur, x);
};
const whiteColor = (pal, v, rng, spread = 0.05) => ramp(pal.white, v + rng.range(-spread, spread));
const rustColor = (pal, v, rng) => ramp(pal.fur, v - rng.range(0.26, 0.4));

const furStyle = (pal, light) => ({ ink: pal.ink, light, drop: 2, blur: 1.7, torn: 0.5, bevel: 0.12 });
const smallFur = (pal, light) => ({ ink: pal.ink, light, drop: 1.7, blur: 1.4, torn: 0.45 });
const whiteStyle = (pal, light) => ({ ink: pal.whiteInk, light, drop: 2, blur: 1.7, bevel: 0.12, torn: 0.5 });
const legStyle = (pal, light) => ({ ink: pal.legInk, light, blur: 1.6, drop: 1.4, bevel: 0.16, torn: 0.4 });

// Tuft shapes. The references' fur is cut as fringe strips: a broad base split into
// long, thin, sharp points. Face and leg tufts are smaller with fewer points.
const FRINGE = { tips: [2, 4], notch: [0.2, 0.34], bulge: 0.16, spread: 0.78, teeth: 0.2 };  // back, haunch, neck
const BODY = { tips: [2, 3], notch: [0.18, 0.32], bulge: 0.16, spread: 0.76, teeth: 0.2 };  // shorter body fringes
const SMALL = { tips: [1, 3], notch: [0.2, 0.36], bulge: 0.16, teeth: 0.15 };                // face, ears, legs
const WHITE = { tips: [2, 3], notch: [0.22, 0.4], bulge: 0.16, teeth: 0.3, spread: 0.8 };   // ruff, cheek, brush
// Body and tail coat: fewer, larger, cleaner pieces, as in the references: broad pointed
// flakes with one to three short points and a barb or two torn into the sides.
const FLAKE = { tips: [1, 3], notch: [0.14, 0.26], bulge: 0.12, spread: 0.5, teeth: 0.45 };
const PLUME = { tips: [1, 2], notch: [0.16, 0.3], bulge: 0.12, spread: 0.55, teeth: 0.5 };
const RUFFW = { tips: [1, 3], notch: [0.16, 0.3], bulge: 0.18, teeth: 0.35, spread: 0.72 };
// The soft shadow one row of coat casts on the row it laps over (see castGroup).
const rowCast = (pal, a = 0.4, blur = 3.4, drop = 2.8) => ({ color: inkA(pal.ink, a), blur, drop });
const coatStyle = (pal, light) => ({ ink: null, light, torn: 0.5, bevel: 0.08 });

// Lit point of a part's radial shading, offset toward the light.
const litPoint = (c, rx, ry, light, k = 0.45) => [c[0] + light[0] * rx * k, c[1] + light[1] * ry * k - ry * 0.15];

// ---------------------------------------------------------------------------
// Body: one silhouette for neck, back, rump, haunch, belly and chest.

// Shade value (fur ramp) over the body: lighter on top, darker underneath, plus the
// rig's light and shade spots.
function bodyShade(T, poly) {
  return (x, y) => {
    const s = scanY(poly, x);
    const h = s ? clamp((y - s[0]) / (s[1] - s[0])) : 0.5;
    return 0.84 - 0.28 * h + spotValue(T.shades, x, y);
  };
}

// The haunch of a trimmed rig: its own cut-out laid inside the body silhouette (clipped
// to it), lit on its upper front, with a cut-edge bevel and a soft shadow on the flank, so
// the thigh reads as a crisp, defined shape; a few torn strips lie on it, kept inside.
function paintHaunch(P, poly, haunch, pal, rng, light) {
  const hb = polyBounds(haunch);
  const rx = (hb.x1 - hb.x0) / 2, ry = (hb.y1 - hb.y0) / 2;
  const lp = litPoint([(hb.x0 + hb.x1) / 2, (hb.y0 + hb.y1) / 2], rx, ry, light, 0.6);
  const S = panelShade(pal, lp[0], lp[1], Math.max(rx, ry) * 1.9, [0.92, 0.72, 0.46]);
  const Q = new Paint();
  Q.shape(haunch, {
    fill: S.fill,
    torn: { amp: 0.9, freq: 0.15, fine: 0.4, seed: 21 },
    shadow: { color: pal.ink, blur: 3, x: -light[0] * 2.6, y: -light[1] * 2.6 },
    bevel: { light, width: 1.2, hi: 0.3, lo: 0.16 },
  });
  // A few big flakes fanning over the thigh, smooth lit paper between them.
  furField(Q, rng.fork('haunch'), {
    region: haunch, step: 25, jitter: 0.3,
    flow: (x) => lerp(2.35, 1.8, clamp((x - hb.x0) / (hb.x1 - hb.x0))),
    size: () => 40, width: 0.38, density: () => 0.6,
    color: (x, y, r) => furColor(pal, S.at(x, y) + (r.chance(0.3) ? 0.1 : 0), r, 0.05),
    fit: { region: haunch, out: 1, min: 0.5 },
    shape: FLAKE, style: coatStyle(pal, light), cast: rowCast(pal, 0.34), band: 22,
  });
  P.custom((ctx) => {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    Q.draw(ctx);
  });
}

export function paintBody(P, rig, pal, rng, light) {
  const T = rig.torso;
  const poly = spline(T.outline, { n: 6 });
  const b = polyBounds(poly);
  const shade = bodyShade(T, poly);
  const coat = coatStyle(pal, light);
  const fur = (dv = 0, spread = 0.06) => (x, y, r) => furColor(pal, shade(x, y) + dv, r, spread);
  const rust = (x, y, r) => rustColor(pal, shade(x, y), r);
  const [s0, s1] = T.size;
  // Trimmed rigs (stand, walk): every body tuft is fitted so its tips reach at most a few
  // units past the outline (a subtle ragged edge, not a fuzzy ball), and the haunch is its
  // own crisp cut-out. The sitting rig keeps the looser fur.
  const trim = !!rig.trim;
  const fit = (out) => (trim ? { region: poly, out } : null);
  const haunch = trim && T.haunch ? spline(T.haunch, { n: 5 }) : null;

  // The silhouette: base orange, lighter over the back, with soft light and shade.
  P.shape(poly, {
    fill: linearFill(0, b.y0, 0, b.y1, [ramp(pal.fur, 0.8), ramp(pal.fur, 0.62), ramp(pal.fur, 0.42)]),
    torn: { amp: 1.2, freq: 0.1, fine: 0.4, seed: 2 },
  });
  softSpots(P, T.shades, pal.furHi, pal.fur[0]);

  // Belly line: strips hanging down and back below the outline.
  fringe(P, rng.fork('bellyline'), spline(T.bellyLine, { closed: false, n: 3 }), {
    step: 17, angle: () => 2.25, size: () => (trim ? 27 : 31), width: 0.38,
    color: (x, y, r) => furColor(pal, shade(x, y) - 0.04, r), style: coat, shape: FLAKE,
    under: { chance: 0.1, color: rust }, fit: fit(7), cast: rowCast(pal, 0.36),
  });
  if (T.belly) {
    const belly = spline(T.belly, { n: 4 });
    P.shape(belly, { fill: pal.white[1], torn: { amp: 1, freq: 0.2, seed: 6 } });
    fringe(P, rng.fork('belly'), [T.belly[0], T.belly[1], T.belly[2]], {
      step: 10, angle: () => 1.95, size: () => 22, width: 0.3,
      color: (x, y, r) => whiteColor(pal, 0.5, r), style: whiteStyle(pal, light), shape: WHITE, fit: fit(8),
    });
  }

  // Back: rows of long fringe strips along the spine, laid from the rump forward, the
  // top ones catching the light. Over the flank and the haunch the smooth shaded felt
  // shows, with only a few strips scattered on it.
  // Fewer, larger flakes than the rig's row count and spacing ask for: about 1.5x the size,
  // in clear shingled rows, each row casting one soft shadow on the row it laps over.
  const thighZone = haunch ?? [...spline(T.thigh.to, { closed: false, n: 3 }), ...spline(T.thigh.from, { closed: false, n: 3 }).reverse()];
  furRows(P, rng.fork('body'), {
    ...T.rows, n: Math.round(T.rows.n * 0.8), gap: T.gap * 1.3, region: poly, out: 7, tilt: 0.15, width: 0.34, ends: [0, 0.58],
    size: (x, y, s) => lerp(s1, s0 * 0.95, s / 0.58) * 1.28,
    keep: (x, y) => (inside(thighZone, x, y) ? 0.1 : 1),
    color: (x, y, r, s) => furColor(pal, shade(x, y) + (s < 0.22 && r.chance(0.5) ? 0.15 : 0.03), r),
    under: { chance: 0.05, color: rust }, shape: FLAKE, style: coat, fit: fit(6), cast: rowCast(pal), stagger: 0.35,
  });
  furRows(P, rng.fork('flank'), {
    ...T.rows, n: Math.ceil(T.rows.n * 0.4), gap: T.gap * 1.9, region: poly, out: 8, tilt: 0.3, width: 0.4, ends: [0.6, 0.95],
    size: () => s0 * 1.2,
    keep: (x, y) => (inside(thighZone, x, y) ? 0 : 0.35),
    color: fur(-0.02), shape: FLAKE, style: coat, fit: fit(6), cast: rowCast(pal, 0.34),
  });

  // Shoulder: smooth felt whose back edge and elbow break into flakes hanging down.
  const sh = T.shoulder;
  const back = [sh.to[0], [lerp(sh.to[0][0], sh.from[0][0], 0.5) - 4, lerp(sh.to[0][1], sh.from[0][1], 0.5)], sh.from[0]];
  fringe(P, rng.fork('shoulder'), spline(back, { closed: false, n: 4 }), {
    step: T.gap * 1.5, angle: () => 2.0, size: () => s0 * 1.1, width: 0.4,
    color: fur(0.06), style: coat, shape: FLAKE, under: { chance: 0.08, color: rust }, fit: fit(6), cast: rowCast(pal),
  });
  fringe(P, rng.fork('elbow'), spline(sh.from, { closed: false, n: 3 }), {
    step: T.gap * 1.1, angle: () => 1.85, size: () => s0 * 0.95, width: 0.38,
    color: fur(0), style: coat, shape: FLAKE, under: { chance: 0.08, color: rust }, fit: fit(9), cast: rowCast(pal),
  });

  // Haunch: rows of big strips over its top and smooth lit felt below, so it reads as one
  // rounded mass of the body; the rump rows lap over its back edge.
  const th = T.thigh;
  if (haunch) paintHaunch(P, poly, haunch, pal, rng, light);
  else furRows(P, rng.fork('thigh'), {
    ...th, n: Math.max(3, Math.round(th.n * 0.7)), gap: T.gap * 1.5, region: poly, out: 10, tilt: 0.3, width: 0.4,
    size: () => s1 * 1.35,
    keep: (x, y, s, k) => (k > 0.62 ? 0.9 : 0.04),
    color: (x, y, r, s, k) => furColor(pal, shade(x, y) + (r.chance(0.5) ? 0.12 : 0.03), r),
    under: { chance: 0.06, color: rust }, shape: FLAKE, style: coat, cast: rowCast(pal),
  });
  // Cape: a row of body fur lapping over the top of the haunch, so the thigh reads as
  // tucked under the coat.
  const cape = spline(T.cape, { closed: false, n: 4 });
  const c0 = cape[0][0], c1 = cape[cape.length - 1][0];
  fringe(P, rng.fork('cape'), cape, {
    step: T.gap * 1.35, angle: (x) => lerp(2.25, 1.75, clamp((x - c0) / (c1 - c0))), size: () => (trim ? s0 * 1.15 : s1 * 1.3), width: 0.38,
    color: (x, y, r) => furColor(pal, shade(x, y) + 0.06, r, 0.05), style: coat, shape: FLAKE,
    under: { chance: 0.12, color: rust }, fit: fit(6), cast: rowCast(pal),
  });
}

// Tail geometry: dense spine samples with tangent, normal and half-width.
export function tailFrame(rig) {
  const { spine, width } = rig.tail;
  const pts = spline(spine, { closed: false, n: 12 });
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  const halfAt = (u) => {
    const x = clamp(u) * (width.length - 1);
    const i = Math.min(width.length - 2, Math.floor(x));
    const k = x - i, s = k * k * (3 - 2 * k);
    return lerp(width[i], width[i + 1], s) / 2;
  };
  const at = (u) => {
    const L = clamp(u) * total;
    let i = 1;
    while (i < lens.length - 1 && lens[i] < L) i++;
    const k = (L - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1);
    const p0 = pts[i - 1], p1 = pts[i];
    const tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1;
    return { p: [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k)], t: [tx / tl, ty / tl], n: [-ty / tl, tx / tl], h: halfAt(u) };
  };
  return { at, total };
}

// Outline of the tail between u0 and u1 at a fraction k of its half-width.
function tailBand(F, u0, u1, k = 1, n = 24) {
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const f = F.at(lerp(u0, u1, i / n));
    left.push([f.p[0] + f.n[0] * f.h * k, f.p[1] + f.n[1] * f.h * k]);
    right.push([f.p[0] - f.n[0] * f.h * k, f.p[1] - f.n[1] * f.h * k]);
  }
  return [...left, ...right.reverse()];
}

// One tail segment covering u in [u0, u1] (0 = root, 1 = tip): the smooth orange band,
// then (tip segment) the white brush, then herringbone rows of long pointed flakes up to
// `rig.tail.white`, laid tip-first so each row laps over the next.
export function paintTailSegment(P, rig, pal, rng, light, u0, u1) {
  const F = tailFrame(rig);
  const whiteAt = rig.tail.white ?? 0.65;
  const isTip = u1 >= 0.999;
  const lo = Math.max(0, u0 - 0.04);
  const hi = Math.min(1, u1 + (isTip ? 0 : 0.03));
  const nside = F.at(0.4).n;
  const facing = Math.sign(nside[0] * light[0] + nside[1] * light[1]) || 1;
  const mid = F.at((lo + hi) / 2);
  const across = (c0, c1) => linearFill(mid.p[0] - mid.n[0] * mid.h * facing, mid.p[1] - mid.n[1] * mid.h * facing,
    mid.p[0] + mid.n[0] * mid.h * facing, mid.p[1] + mid.n[1] * mid.h * facing, [c0, c1]);
  if (lo < whiteAt) {
    P.shape(tailBand(F, lo, Math.min(hi, whiteAt + 0.02), 0.84), {
      fill: across(ramp(pal.fur, 0.36), ramp(pal.fur, 0.7)), torn: { amp: 1.2, freq: 0.1, seed: 8 },
    });
  }
  // The white brush (tip segment): a few long jagged blades converging on the point.
  if (isTip) paintBrush(P, F, pal, rng.fork('brush'), light, whiteAt, facing);
  // The orange plume: herringbone rows of big pointed flakes, laid tip-first so each row
  // laps over the next, each row casting one soft shadow; the outer flakes angle out so
  // the plume's edge is serrated, and the last rows lap over the white brush in points.
  const step = rig.tail.step ?? 26;
  const du = step / F.total;
  const outline = tailBand(F, 0, 1, 1.02, 40);
  const rows = [];
  for (let u = u0, r = 0; u < Math.min(u1, whiteAt); u += du * rng.range(0.9, 1.08), r++) rows.push([u, r]);
  rows.reverse();
  const fstyle = coatStyle(pal, light);
  const cast = rowCast(pal, 0.4, 3.6, 3);
  for (const [u, r] of rows) {
    const f = F.at(u);
    const n = Math.max(2, Math.round((f.h * 2) / 30));
    const seeds = [];
    for (let j = 0; j <= n; j++) {
      const v = ((j + (r % 2) * 0.5) / n) * 2 - 1;
      if (v > 1.02) continue;
      const vv = clamp(v + rng.range(-0.08, 0.08), -1, 1);
      // Herringbone: the outer flakes sit a little further back and angle out, so each
      // row's tips form a chevron pointing down the tail.
      const uu = u + (rng.range(-0.15, 0.15) - Math.abs(vv) * 0.45) * du;
      const g = F.at(uu);
      const spread = lerp(0.46, 0.2, smoothstep(0.15, whiteAt, uu));
      const d = [g.t[0] + g.n[0] * vv * spread, g.t[1] + g.n[1] * vv * spread];
      seeds.push({ x: g.p[0] + g.n[0] * vv * g.h * 0.6, y: g.p[1] + g.n[1] * vv * g.h * 0.6, u: uu, v: vv, a: Math.atan2(d[1], d[0]) });
    }
    // Outer flakes first, the middle of the row on top.
    seeds.sort((p, q) => Math.abs(q.v) - Math.abs(p.v));
    const done = castGroup(P, cast);
    for (const s of seeds) {
      const grow = smoothstep(0, 0.4, s.u);
      const lap = Math.max(0, whiteAt - s.u) * F.total + 30;
      const len = Math.min(lap, lerp(rig.tail.size[0], rig.tail.size[1], grow) * rng.range(0.88, 1.12));
      if (len < 12) continue;
      const lit = 0.7 + s.v * facing * 0.2 - smoothstep(0.75, 1, Math.abs(s.v)) * 0.08 - (1 - smoothstep(0, 0.3, s.u)) * 0.12 + (rng.chance(0.22) ? 0.12 : 0);
      const fit = { region: outline, out: 5, min: 0.55 };
      if (rng.chance(0.08)) {
        addTuft(P, rng, s.x, s.y, s.a + rng.sign() * rng.range(0.15, 0.28), len * 1.04, len * 0.26, rustColor(pal, lit, rng), fstyle, { ...PLUME, tips: [1, 2] }, fit);
      }
      addTuft(P, rng, s.x, s.y, s.a + rng.range(-0.06, 0.06), len, len * rng.range(0.26, 0.31), furColor(pal, lit, rng, 0.05), fstyle,
        { ...PLUME, curl: rng.range(-0.08, 0.08) }, fit);
    }
    done(f.t);
  }
}

// The tail's white brush: a smooth white base closing to the point under six or seven
// long jagged blades that run with the curve of the tail and converge on the tip, the
// outer ones shorter; cream on the lit side, lavender grey on the other.
function paintBrush(P, F, pal, rng, light, whiteAt, facing) {
  const ub = whiteAt - 0.04;
  const f0 = F.at((ub + 1) / 2);
  P.shape(tailBand(F, ub, 1, 0.8, 32), {
    fill: linearFill(f0.p[0] - f0.n[0] * f0.h * facing, f0.p[1] - f0.n[1] * f0.h * facing, f0.p[0] + f0.n[0] * f0.h * facing, f0.p[1] + f0.n[1] * f0.h * facing,
      [pal.white[1], pal.white[3]]),
    torn: { amp: 1.2, freq: 0.1, seed: 7 },
  });
  const ws = { ...whiteStyle(pal, light), blur: 2.6, drop: 2.2, bevel: 0.1 };
  const N = 7;
  const vs = Array.from({ length: N }, (_, i) => (i / (N - 1)) * 2 - 1).sort((a, b) => Math.abs(b) - Math.abs(a) || a * facing - b * facing);
  for (const v0 of vs) {
    const v = clamp(v0 + rng.range(-0.07, 0.07), -1, 1);
    const av = Math.abs(v);
    const ur = ub + rng.range(0, 0.05) + av * 0.03;
    const ue = av < 0.4 ? 1 : 1 - av * rng.range(0.1, 0.17);
    const vr = v * 0.7, ve = v * (av < 0.4 ? 0 : 0.5);
    const path = (s) => {
      const g = F.at(lerp(ur, ue, s));
      const k = lerp(vr, ve, clamp(s)) * g.h;
      return { p: [g.p[0] + g.n[0] * k, g.p[1] + g.n[1] * k], n: g.n };
    };
    const pts = blade(path, F.at(ur).h * rng.range(0.34, 0.42), rng, rng.int(3, 4));
    P.shape(pts, flakeStyle(whiteColor(pal, 0.52 + v * facing * 0.38, rng, 0.04), F.at(ue).t, rng, ws));
  }
}

// Leg segment from joint a to joint b with half-widths w0 -> w1. `dark` in [0, 1] is
// where along the bone the dark stocking starts (0 = all dark).
export function paintLegBone(P, pal, rng, light, a, b, w0, w1, dark, { far = false, bulge = 0.12 } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy), t = [dx / L, dy / L], n = [-t[1], t[0]];
  const wAt = (s) => lerp(w0, w1, s) * (1 + Math.sin(s * Math.PI) * bulge);
  const side = [], other = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10, w = wAt(s);
    const p = [a[0] + dx * s, a[1] + dy * s];
    side.push([p[0] + n[0] * w, p[1] + n[1] * w]);
    other.push([p[0] - n[0] * w, p[1] - n[1] * w]);
  }
  const cap = (p, w, sgn) => Array.from({ length: 7 }, (_, k) => {
    const th = (k / 6) * Math.PI;
    return [p[0] + w * sgn * (n[0] * Math.cos(th) + t[0] * Math.sin(th)), p[1] + w * sgn * (n[1] * Math.cos(th) + t[1] * Math.sin(th))];
  });
  const outline = [...side, ...cap(b, w1, 1), ...other.reverse(), ...cap(a, w0, -1)];
  const dim = far ? -0.16 : 0;
  const ls = Math.sign(n[0] * light[0] + n[1] * light[1]) || 1;
  P.shape(outline, {
    fill: linearFill(a[0] - n[0] * w0 * ls, a[1] - n[1] * w0 * ls, a[0] + n[0] * w0 * ls, a[1] + n[1] * w0 * ls, [ramp(pal.leg, 0.25 + dim), ramp(pal.leg, 0.62 + dim)]),
    torn: { amp: 0.7, freq: 0.15, fine: 0.3, seed: rng.int(1, 40) },
  });
  const down = Math.atan2(t[1], t[0]);
  if (dark > 0) {
    // Orange upper part ending in a torn, pointed edge over the stocking.
    const sEnd = dark;
    const top = [];
    for (let i = 0; i <= 8; i++) {
      const s = (i / 8) * sEnd, w = wAt(s) * 1.06;
      top.push([a[0] + dx * s + n[0] * w, a[1] + dy * s + n[1] * w]);
    }
    const teeth = 3;
    for (let k = 0; k <= teeth * 2; k++) {
      const o = 1 - (k / (teeth * 2)) * 2;
      const s = sEnd + (k % 2 === 0 ? rng.range(0.08, 0.16) : -rng.range(0.02, 0.06));
      const w = wAt(Math.min(1, s)) * 1.06;
      top.push([a[0] + dx * s + n[0] * w * o, a[1] + dy * s + n[1] * w * o]);
    }
    for (let i = 8; i >= 0; i--) {
      const s = (i / 8) * sEnd, w = wAt(s) * 1.06;
      top.push([a[0] + dx * s - n[0] * w, a[1] + dy * s - n[1] * w]);
    }
    top.push(...cap(a, w0 * 1.06, -1));
    P.shape(top, {
      fill: linearFill(a[0] - n[0] * w0 * ls, a[1] - n[1] * w0 * ls, a[0] + n[0] * w0 * ls, a[1] + n[1] * w0 * ls, [ramp(pal.fur, 0.36 + dim), ramp(pal.fur, 0.68 + dim)]),
      torn: { amp: 0.6, freq: 0.3, fine: 0.3, seed: rng.int(1, 40) },
      shadow: { color: pal.ink, blur: 2.4, x: t[0] * 2, y: t[1] * 2 },
    });
  }
  // Dark fur tufts down the stocking: small, two or three points, lit on one side.
  const from = Math.max(dark, 0);
  const n1 = Math.max(1, Math.round((L * (1 - from)) / 22));
  for (let i = n1 - 1; i >= 0; i--) {
    const s = from + ((i + 0.3) / n1) * (1 - from) * 0.9;
    const off = rng.range(-0.35, 0.35);
    addTuft(P, rng, a[0] + dx * s + n[0] * wAt(s) * off, a[1] + dy * s + n[1] * wAt(s) * off, down + rng.range(-0.12, 0.12),
      wAt(s) * rng.range(1.7, 2.3), wAt(s) * 0.7, ramp(pal.leg, 0.45 + off * ls * 0.4 + dim + rng.range(-0.06, 0.06)), legStyle(pal, light),
      { ...SMALL, tips: [1, 3] });
  }
}

// Paw: a rounded pad block from the ankle forward to the toe, a shade lighter than
// the stocking, with toe knuckles.
export function paintPaw(P, pal, rng, light, ankle, toe, { far = false, size = 1.18 } = {}) {
  const dx = toe[0] - ankle[0], dy = toe[1] - ankle[1];
  const L = Math.hypot(dx, dy), t = [dx / L, dy / L], n = [-t[1], t[0]];
  const h = 9.5 * size;
  const at = (s, o) => [ankle[0] + t[0] * L * s + n[0] * o, ankle[1] + t[1] * L * s + n[1] * o];
  const outline = spline([at(-0.4, -h * 0.8), at(0.25, -h * 1.0), at(0.85, -h * 0.75), at(1.15, -h * 0.1), at(1.1, h * 0.55), at(0.6, h * 0.8), at(0.0, h * 0.8), at(-0.45, h * 0.2)], { n: 4 });
  const dim = far ? -0.16 : 0;
  P.shape(outline, {
    fill: ramp(pal.leg, 0.5 + dim), torn: { amp: 0.6, freq: 0.2, fine: 0.3, seed: rng.int(1, 40) },
    shadow: { color: pal.legInk, blur: 2, x: 0, y: 1 }, bevel: { light, width: 1.1, hi: 0.24, lo: 0.2 },
  });
  for (let i = 0; i < 3; i++) {
    const p = at(0.5 + i * 0.22, h * (0.15 + i * 0.07));
    P.shape(ellipse(p[0], p[1], h * 0.55, h * 0.48, 14), {
      fill: ramp(pal.leg, 0.62 + dim + rng.range(-0.04, 0.06)), torn: { amp: 0.4, freq: 0.3, fine: 0.2, seed: rng.int(1, 40) },
      shadow: { color: pal.legInk, blur: 1.5, x: t[0] * 1.2, y: 0.8 }, bevel: { light, width: 0.9, hi: 0.2, lo: 0.2 },
    });
  }
}

// ---------------------------------------------------------------------------
// Head group (canonical ref02 position; the rig moves it as a whole)

// Head: a big round skull raised high, chin up, a slim snout pointing up and right,
// the white cheek sweeping back under the eye, crown tufts flowing back to the ears.
export const HEAD = {
  skull: [[-46, -262], [-42, -284], [-24, -302], [4, -312], [36, -311], [62, -302], [84, -296], [104, -294], [121, -293], [133, -290],
    [131, -282], [120, -272], [108, -259], [94, -244], [76, -229], [52, -216], [24, -211], [-6, -214], [-30, -227], [-44, -244]],
  cheek: [[134, -286], [126, -276], [113, -262], [99, -248], [82, -234], [62, -222], [40, -214], [30, -224], [42, -238], [60, -250],
    [80, -260], [96, -270], [110, -279], [122, -286]],
  fringe: [[-44, -244], [-32, -230], [-10, -220], [16, -216], [40, -218]],
  center: [40, -262],
  eye: [100, -279],
  nose: [131, -289],
};

export function paintHead(P, rig, pal, rng, light) {
  const skull = spline(HEAD.skull, { n: 4 });
  const c = HEAD.center;
  const lp = litPoint(c, 75, 50, light, 0.55);
  const S = panelShade(pal, lp[0], lp[1], 125, [0.9, 0.74, 0.52]);
  const style = smallFur(pal, light);
  // Locks hanging below the back of the head, the jagged edge throwing a shadow on the neck.
  fringe(P, rng.fork('fringe'), spline(HEAD.fringe, { closed: false, n: 4 }), {
    step: 12, angle: (x) => lerp(2.3, 1.75, clamp((x + 44) / 84)), size: (x) => (rig.trim ? lerp(21, 17, clamp((x + 44) / 84)) : lerp(30, 22, clamp((x + 44) / 84))), width: 0.34,
    color: (x, y, r) => furColor(pal, S.at(x, y) - 0.05, r, 0.04), style, shape: BODY,
    under: { chance: 0.4, color: (x, y, r) => rustColor(pal, S.at(x, y), r) },
  });
  P.shape(skull, { fill: S.fill, torn: { amp: 0.9, freq: 0.15, fine: 0.4, seed: 12 } });
  // Crown tufts sweeping back from the face over the head and down behind the cheek,
  // none on the snout, the top rows catching the light.
  const from = [112, -284];
  furField(P, rng.fork('crown'), {
    region: spline([[-40, -270], [-26, -294], [0, -306], [34, -306], [62, -296], [82, -286], [80, -268], [62, -252], [36, -240], [4, -232], [-28, -238], [-42, -252]], { n: 3 }),
    step: 15,
    jitter: 0.25,
    flow: (x, y) => Math.atan2(y - from[1] + 30, x - from[0]) + 0.3,
    size: (x, y) => lerp(24, 36, clamp(Math.hypot(x - from[0], y - from[1]) / 150)),
    width: 0.3,
    order: (x, y) => -Math.hypot(x - from[0], y - from[1]),
    density: (x) => lerp(0.97, 0.75, clamp((x + 20) / 100)),
    contain: skull,
    color: (x, y, r) => furColor(pal, S.at(x, y) + 0.03 + (y < -285 && r.chance(0.45) ? 0.16 : 0), r, 0.05),
    under: { chance: 0.2, color: (x, y, r) => rustColor(pal, S.at(x, y), r) },
    shape: FRINGE,
    style,
  });
  // White cheek: under the eye and down the jaw, shaded lavender-grey toward the throat.
  const cheek = spline(HEAD.cheek, { n: 3 });
  P.shape(cheek, {
    fill: linearFill(46, -218, 118, -280, [pal.white[1], pal.white[3]]),
    torn: { amp: 0.9, freq: 0.2, fine: 0.4, seed: 9 },
    shadow: { color: pal.ink, blur: 2, x: -1, y: 1.2 },
  });
  // Long jagged cream tufts sweeping back and down from the cheek over the neck.
  fringe(P, rng.fork('jaw'), [[118, -268], [104, -254], [88, -240], [72, -229], [58, -221]], {
    step: 9, angle: (x) => lerp(2.1, 1.8, clamp((x - 58) / 60)), size: (x) => lerp(30, 22, clamp((x - 58) / 60)), width: 0.34,
    color: (x, y, r) => whiteColor(pal, 0.48 + clamp((x - 40) / 70) * 0.45, r), style: whiteStyle(pal, light), shape: WHITE,
  });
  fringe(P, rng.fork('cheekw'), [[108, -276], [94, -264], [78, -252], [60, -240]], {
    step: 10, angle: () => 2.5, size: () => 20, width: 0.34,
    color: (x, y, r) => whiteColor(pal, 0.74, r), style: whiteStyle(pal, light), shape: WHITE,
  });
  // Orange locks overlapping the top of the white cheek.
  fringe(P, rng.fork('cheek'), [[54, -252], [68, -262], [84, -272], [98, -281]], {
    step: 11, angle: () => 2.45, size: () => 20, width: 0.34,
    color: (x, y, r) => furColor(pal, S.at(x, y) - 0.02, r, 0.03), style, shape: SMALL,
  });
  // Muzzle bridge: a smooth lighter strip along the slim snout to the nose.
  P.shape(spline([[86, -298], [106, -296], [124, -294], [131, -290], [108, -287], [88, -289]], { n: 3 }), {
    fill: ramp(pal.fur, 0.86), torn: { amp: 0.5, freq: 0.3, seed: 14 }, shadow: { color: pal.ink, blur: 1.5, x: -0.5, y: 0.8 },
    bevel: { light, width: 0.8, hi: 0.25, lo: 0.1 },
  });
  // Eye: a small dark almond, nearly closed, gazing up, under a lighter lid.
  const [ex, ey] = HEAD.eye;
  P.shape(transform([[-8.5, 0.4], [-4, -2.2], [3, -2.5], [8, -0.6], [3.5, 1.3], [-3.5, 1.4]], { x: ex, y: ey, rot: 0.3 }), {
    fill: pal.eye, smooth: true, shadow: { color: 'rgba(40,10,0,0.5)', blur: 1.2, x: 0, y: 0.6 },
  });
  P.shape(transform([[-9.5, -2.6], [8.5, -3], [8, -1.2], [-9.5, -0.8]], { x: ex, y: ey, rot: 0.3 }), { fill: ramp(pal.fur, 0.95) });
  // Mouth line on the white chin.
  P.shape([[125, -280], [118, -273], [110.5, -265], [110, -263.5], [117.5, -271.5], [124, -278.5]], { fill: pal.eye });
  // Nose.
  const [nx, ny] = HEAD.nose;
  P.shape(transform(ellipse(0, 0, 5.8, 5, 18), { x: nx, y: ny, rot: 0.3 }), {
    fill: pal.nose, shadow: { color: 'rgba(30,8,0,0.5)', blur: 1.5, x: -0.5, y: 1 }, bevel: { light, width: 1, hi: 0.35, lo: 0.2 },
  });
  P.shape(ellipse(nx + 1.3, ny - 1.9, 1.6, 0.9, 8), { fill: 'rgba(255,240,225,0.4)' });
}

// Ears (canonical), seen from behind: orange backs with black-brown upper halves; the
// near ear shows a strip of cream inner fur along its front edge.
export const EARS = {
  near: {
    outline: [[70, -354], [78, -336], [82, -312], [83, -290], [77, -274], [60, -266], [40, -272], [31, -288], [37, -312], [52, -336], [63, -350]],
    dark: [[70, -354], [78, -336], [81, -312], [74, -302], [62, -305], [50, -297], [36, -300], [44, -324], [56, -341], [63, -350]],
    inner: [[73, -344], [79, -330], [83, -310], [84, -290], [80, -278], [77, -292], [77, -312], [75, -330]],
    base: [56, -282],
  },
  far: {
    outline: [[-50, -336], [-34, -326], [-16, -312], [-2, -296], [-3, -280], [-18, -268], [-34, -268], [-44, -288], [-50, -312]],
    dark: [[-50, -336], [-34, -326], [-14, -308], [-17, -296], [-30, -288], [-42, -284], [-48, -298], [-51, -318]],
    base: [-22, -282],
  },
};

// Ears are cut larger than the canonical outlines, about their base (the default; each
// rig sets its own earScale).
const EAR_SCALE = 1.12;

export function paintEar(P, pal, rng, light, which, scale = EAR_SCALE) {
  const E0 = EARS[which];
  const grow = (pts) => pts && pts.map(([x, y]) => [E0.base[0] + (x - E0.base[0]) * scale, E0.base[1] + (y - E0.base[1]) * scale]);
  const E = { ...E0, outline: grow(E0.outline), dark: grow(E0.dark), inner: grow(E0.inner) };
  const outline = spline(E.outline, { n: 3 });
  const dim = which === 'far' ? -0.1 : 0;
  const b = polyBounds(outline);
  P.shape(outline, {
    fill: linearFill(b.x0, b.y1, b.x1, b.y0, [ramp(pal.fur, 0.5 + dim), ramp(pal.fur, 0.8 + dim)]),
    torn: { amp: 0.6, freq: 0.2, fine: 0.3, seed: 3 },
    bevel: { light, width: 1.1, hi: 0.25, lo: 0.2 },
  });
  if (E.inner) {
    P.shape(spline(E.inner, { n: 3 }), {
      fill: pal.white[2], torn: { amp: 0.6, freq: 0.4, fine: 0.3, seed: 4 }, shadow: { color: pal.whiteInk, blur: 1.2, x: -0.8, y: 0.6 },
      bevel: { light, width: 0.8, hi: 0.3, lo: 0.1 },
    });
  }
  P.shape(spline(E.dark, { n: 3 }), {
    fill: pal.ear, torn: { amp: 1.1, freq: 0.35, fine: 0.4, seed: 8 },
    shadow: { color: 'rgba(30,8,0,0.35)', blur: 1.5, x: 0, y: 1 }, bevel: { light, width: 0.9, hi: 0.2, lo: 0.1 },
  });
  // Locks of head fur lapping over the base of the ear.
  const bs = E.base;
  for (let i = 0; i < 3; i++) {
    addTuft(P, rng, bs[0] - 12 + i * 11 + rng.range(-2, 2), bs[1] + 14, -1.9 + i * 0.18 + rng.range(-0.1, 0.1), rng.range(20, 26), 7,
      furColor(pal, 0.66 + dim, rng, 0.03), smallFur(pal, light), SMALL);
  }
}

// Neck: the orange fur from the back of the head down to the shoulders, in rows of
// tufts pointing down the back, with the far cheek's white tuft peeking out behind.
export const MANE = {
  region: [[-36, -262], [-44, -240], [-42, -216], [-28, -200], [-6, -190], [22, -186], [50, -192], [66, -208], [66, -234], [44, -250], [10, -260], [-14, -266]],
  tuft: [-42, -234],
  // Trimmed rigs: the mane's tufts may spill over the shoulders and down the back, but
  // reach at most 8 units past this line along the back of the neck.
  fit: [[-36, -264], [-42, -240], [-42, -214], [-46, -200], [-62, -190], [-60, -150], [40, -150], [70, -200], [70, -236], [46, -252], [10, -262], [-14, -268]],
};

export function paintMane(P, rig, pal, rng, light) {
  const region = spline(MANE.region, { n: 4 });
  const [tx, ty] = MANE.tuft;
  const tr = rng.fork('tuft');
  for (let i = 0; i < 4; i++) {
    addTuft(P, tr, tx + tr.range(0, 8), ty + i * 5 - 8, 2.85 + (i - 1.5) * 0.18, rig.trim ? tr.range(15, 20) : tr.range(24, 32), tr.range(7, 9),
      whiteColor(pal, 0.6 + i * 0.05, tr), whiteStyle(pal, light), WHITE);
  }
  const shade = (x, y) => 0.74 + clamp((x + 50) / 116) * 0.16 - clamp((y + 250) / 70) * 0.18;
  P.shape(region, { fill: linearFill(-50, -200, 60, -250, [ramp(pal.fur, 0.5), ramp(pal.fur, 0.74)]), torn: { amp: 1, freq: 0.15, seed: 15 } });
  furField(P, rng.fork('mane'), {
    region, step: 20, jitter: 0.22, flow: (x) => lerp(2.45, 1.9, clamp((x + 50) / 116)), size: () => (rig.trim ? 40 : 46), width: 0.36,
    fit: rig.trim ? { region: spline(MANE.fit, { n: 3 }), out: 5 } : null,
    color: (x, y, r) => furColor(pal, shade(x, y) + (y < -235 && r.chance(0.35) ? 0.16 : 0.02), r, 0.05),
    under: { chance: 0.08, color: (x, y, r) => rustColor(pal, shade(x, y), r) },
    shape: FLAKE, style: coatStyle(pal, light), cast: rowCast(pal, 0.38), band: 17,
  });
}

// Chest ruff: a full bib of long jagged cream tufts under the jaw that tapers as it
// flows down the front of the chest, each row casting a lavender-grey shadow on the
// row below; the side turned from the light is greyer.
export const RUFF = [[62, -232], [78, -242], [92, -248], [102, -244], [104, -226], [99, -202], [92, -178], [85, -152], [78, -128], [70, -106],
  [64, -112], [66, -140], [68, -170], [66, -204]];

export function paintRuff(P, rig, pal, rng, light) {
  // Trimmed rigs wear a narrower bib: its front edge is pulled back toward the chest so the
  // white band runs down the front of the chest as in ref02 / ref01 instead of a wide bib.
  const K = rig.trim ? 0.62 : 1;
  const sq = ([x, y]) => [x > 72 ? 72 + (x - 72) * K : x, y];
  const un = (x) => (x > 72 ? 72 + (x - 72) / K : x);
  const R0 = RUFF.map(sq);
  const region = spline(R0, { n: 4 });
  const across = (x0, y) => { const x = un(x0), d = Math.max(0, y + 240); return clamp((x - 64 + d * 0.015) / Math.max(10, 38 - d * 0.22)); };
  const ws = whiteStyle(pal, light);
  P.shape(region, { fill: linearFill(62, 0, 102, 0, [pal.white[0], pal.white[2]]), torn: { amp: 1.2, freq: 0.2, seed: 16 } });
  furField(P, rng.fork('ruff'), {
    region, step: 17, jitter: 0.3,
    flow: (x, y) => 1.72 - across(x, y) * 0.3 + clamp((y + 240) / 130) * 0.12,
    size: (x, y) => lerp(38, 52, clamp((y + 240) / 130)) * (rig.trim ? 0.82 : 1), width: 0.3,
    order: (x, y) => -y,
    contain: spline(R0.map(([x, y]) => [x + (x > 70 ? 4 : 0), y + 12]), { n: 3 }),
    color: (x, y, r) => whiteColor(pal, 0.4 + across(x, y) * 0.58, r),
    under: { chance: 0.06, color: (x, y, r) => whiteColor(pal, 0.1, r) },
    shape: RUFFW, style: ws,
  });
  // Jagged points spilling over the front edge of the ruff, angled out and down the
  // chest, longest under the jaw.
  fringe(P, rng.fork('edge'), [[100, -238], [98, -214], [92, -190], [86, -164], [79, -138], [70, -114]].map(sq), {
    step: 17, angle: (x, y) => lerp(1.3, 1.6, clamp((y + 238) / 124)), size: (x, y) => lerp(29, 20, clamp((y + 238) / 124)) * (rig.trim ? 0.75 : 1), width: 0.38,
    color: (x, y, r) => whiteColor(pal, 0.86, r), style: ws, shape: RUFFW,
  });
  // The ruff's lowest tufts hanging into the orange chest.
  fringe(P, rng.fork('tip'), [[64, -118], [68, -108], [74, -112]], {
    step: 7, angle: () => 1.62, size: () => 32, width: 0.3,
    color: (x, y, r) => whiteColor(pal, 0.6, r), style: ws, shape: WHITE,
  });
}

// A small tuft of 2-3 pieces rooted at (x, y): the loose fur that flutters.
export function paintTuft(P, pal, rng, light, x, y, angle, len, white = false) {
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const L = len * rng.range(0.85, 1.15);
    addTuft(P, rng, x + rng.range(-3, 3), y + rng.range(-3, 3), angle + rng.range(-0.25, 0.25), L, L * 0.3,
      white ? whiteColor(pal, 0.65, rng) : furColor(pal, 0.8, rng), white ? whiteStyle(pal, light) : furStyle(pal, light), white ? WHITE : FRINGE);
  }
}

// Soft ground contact shadow (drawn into the drop-shadow mask).
export function paintGroundShadow(ctx, c, rx, ry) {
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Tint a palette entry (colour string or list of them) toward a grade colour.
export function tintColor(c, tint) {
  if (!tint || !tint.amount) return c;
  if (Array.isArray(c)) return c.map((x) => tintColor(x, tint));
  if (typeof c !== 'string' || !c.startsWith('#')) return c;
  if ((tint.mode ?? 'multiply') === 'mix') return mix(c, tint.color, tint.amount);
  const A = hex(c), B = hex(tint.color);
  return mix(c, toHex(A.map((v, i) => (v * B[i]) / 255)), tint.amount);
}