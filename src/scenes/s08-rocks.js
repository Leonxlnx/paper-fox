// Stone of s08 (ref08): the left blocks and the fox's ledge, the natural arch with its
// leg, the pillars and the right cliff. Every cliff is a face of split slabs (leaning
// crevices, slanted cross fractures, a shaded side face per slab; each piece a sheet of
// Voronoi facets lit by random normals, brushed grain, granite specks and valley shade);
// the arch is one curved span whose underside is a smooth irregular arc, split by a few
// joints into huge chunks. Tops carry a lit walkable face and clumps of yellow moss:
// leaf scales, yellow flowers, grass blades and hanging tongues.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands } from '../core/piece.js';
import { bounds, transform, tear } from '../core/geom.js';
import { mix, shade, rgba } from '../core/color.js';
import { voronoi, inset, hull, brush, lengths, pointAt, segment } from '../elements/terrain.js';

// Granite speckle and a fine crumple over the cut facets.
const ROCK_MAT = [{ tex: 'stone', amt: 1 }, { tex: 'crumple', amt: 0.6, scale: 0.26 }];

// Sampled from ref08: dark warm grey faces, pale grey lit facets, gold-green lichen specks.
export const STONE = {
  crack: '#120f10',
  ramp: ['#110e0f', '#1f1918', '#2f2825', '#433933', '#5c5047', '#7c6e61', '#a2917f'],
  fleck: ['#c9bea9', '#aeb04a', '#120f10'],
};
// Leafy cushions: deep olive under, yellow-green leaves, butter-yellow lit tops.
export const MOSS = {
  deep: '#30300e', dark: '#625e18', mid: '#a6961e', light: '#d4b42a', hi: '#f6d64e',
  flower: ['#f4da48', '#eac334', '#fbe98c', '#f0b83a'],
  grass: ['#9fae2e', '#c6cc52', '#7f8f22', '#d8d66a'],
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Cut a convex polygon in two along a chord between two of its edges.
function splitPoly(pts, rng) {
  const n = pts.length;
  const P = (k) => pts[((k % n) + n) % n];
  const lerp = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
  const i = rng.int(0, n - 1);
  const j = (i + 1 + rng.int(0, n - 2)) % n;
  const jj = j > i ? j : j + n;
  const a = lerp(P(i), P(i + 1), rng.range(0.25, 0.75)), b = lerp(P(jj), P(jj + 1), rng.range(0.25, 0.75));
  const A = [a], B = [b];
  for (let k = i + 1; k <= jj; k++) A.push(P(k));
  A.push(b);
  for (let k = jj + 1; k <= i + n; k++) B.push(P(k));
  B.push(a);
  return [A, B].filter((p) => p.length >= 3);
}
function stoneTone(v) {
  const R = STONE.ramp;
  const f = clamp(v, 0, 1) * (R.length - 1);
  const i = Math.min(R.length - 2, Math.floor(f));
  return mix(R[i], R[i + 1], f - i);
}

// One faceted stone mass. outline: closed polygon in film px.
//   cell     [w, h] mean facet size     bias  brightness shift on the ramp
//   valley   [y0, y1, alpha] blue shade growing toward y1 (the cloud-filled depths)
//   under    darken toward the bottom of the piece (arch blocks), 0..1
export function paintStone(ctx, outline, { light, seed = 1, cell = [64, 96], bias = -0.12, contrast = 1, valley = null, under = 0, specks = 1, form = 1, pillars = 0, cracks: crackAmt = 1 } = {}) {
  const rng = new RNG(`s08-stone-${seed}`);
  const path = pathOf(outline);
  const b = bounds(outline);
  ctx.save();
  ctx.fillStyle = STONE.crack;
  ctx.fill(path);
  ctx.clip(path);
  const cw = cell[0] * 1.1, ch = cell[1] * 1.1;
  const seeds = [];
  for (let y = b.y - ch * 0.3; y < b.y + b.h + ch * 0.5; y += ch) {
    for (let x = b.x - cw * 0.3; x < b.x + b.w + cw * 0.5; x += cw) {
      seeds.push([x + rng.range(-0.45, 0.45) * cw, y + rng.range(-0.45, 0.45) * ch]);
    }
  }
  // Facet edges facing the light / away from it, stroked in one pass each at the end.
  const litEdges = new Path2D(), darkEdges = new Path2D();
  const edgeLines = (pts) => {
    const n = pts.length;
    let area = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    const s = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey) || 1;
      const nx = (s * ey) / l, ny = (-s * ex) / l;   // outward normal
      const f = nx * light[0] + ny * light[1];
      if (Math.abs(f) < 0.15) continue;
      const P = f > 0 ? litEdges : darkEdges;
      const o = f > 0 ? -1 : -1;   // pull the line just inside the facet
      P.moveTo(p[0] + nx * o, p[1] + ny * o);
      P.lineTo(q[0] + nx * o, q[1] + ny * o);
    }
  };
  for (const c of voronoi(hull(outline), seeds)) {
    const cellPts = inset(c.pts, rng.range(0.3, 0.65));
    // Most cells are chiselled again along a chord: two facets catching the light differently.
    const parts = cellPts.length >= 3 && rng.chance(0.65) ? splitPoly(cellPts, rng) : [cellPts];
    for (const pts of parts) {
      const nx = rng.range(-1, 1), ny = rng.range(-1, 0.55);
      const dot = (nx * light[0] + ny * light[1]) / (Math.hypot(nx, ny) || 1);
      // Bimodal: faces turned to the light are clearly lit, the others fall into shade.
      const v = clamp((dot > 0 ? 0.52 + dot * 0.42 : 0.3 + dot * 0.26) * contrast + bias + rng.range(-0.08, 0.08), 0.02, 1);
      const base = stoneTone(v);
      const bb = bounds(pts);
      const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, r = Math.max(bb.w, bb.h) * 0.6;
      const g = ctx.createLinearGradient(cx + light[0] * r, cy + light[1] * r, cx - light[0] * r, cy - light[1] * r);
      g.addColorStop(0, shade(base, 0.14));
      g.addColorStop(1, shade(base, -0.3));
      ctx.fillStyle = g;
      ctx.fill(pathOf(pts));
      edgeLines(pts);
    }
  }
  brush(ctx, path, { angle: Math.PI / 2, amt: 0.16, scale: 0.7, seed: rng.int(1, 1e6) });
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,244,226,0.2)';
  ctx.stroke(litEdges);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.24)';
  ctx.stroke(darkEdges);
  // Form light: the mass (or each pillar of it) is lit on its top-right, shaded bottom-left.
  const formShade = (x0, x1) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `rgba(6,6,14,${0.55 * form})`);
    g.addColorStop(0.4, `rgba(6,6,14,${0.18 * form})`);
    g.addColorStop(0.82, `rgba(255,246,228,${0.22 * form})`);
    g.addColorStop(1, `rgba(6,6,14,${0.3 * form})`);
    ctx.fillStyle = g;
    ctx.fillRect(x0, b.y - 30, x1 - x0, b.h + 60);
  };
  const vg = ctx.createLinearGradient(0, b.y, 0, b.y + Math.min(b.h, 420));
  vg.addColorStop(0, `rgba(255,246,228,${0.16 * form})`);
  vg.addColorStop(1, `rgba(6,6,14,${0.3 * form})`);
  ctx.fillStyle = vg;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  if (pillars) {
    // Split into standing pillars separated by deep crevices.
    let x0 = b.x - rng.range(0, pillars * 0.5);
    while (x0 < b.x + b.w) {
      const x1 = x0 + pillars * rng.range(0.7, 1.35);
      formShade(x0, x1);
      let x = x1, y = b.y + rng.range(0, 30);
      const pts = [[x, y]];
      while (y < b.y + b.h) { y += rng.range(40, 90); x += rng.range(-9, 9); pts.push([x, y]); }
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.strokeStyle = rgba(STONE.crack, 0.9);
      ctx.lineWidth = rng.range(5, 9);
      ctx.stroke();
      x0 = x1;
    }
  } else {
    formShade(b.x, b.x + b.w);
  }
  // Long dark cracks down the face.
  const cracks = Math.round((b.w / 70) * crackAmt);
  for (let i = 0; i < cracks; i++) {
    let x = b.x + rng.next() * b.w, y = b.y + rng.range(0.02, 0.4) * b.h;
    const len = rng.range(0.3, 0.8) * b.h;
    const pts = [[x, y]];
    for (let s = 0; s < 8; s++) { x += rng.range(-10, 10); y += len / 8; pts.push([x, y]); }
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.strokeStyle = rgba(STONE.crack, 0.85);
    ctx.lineWidth = rng.range(2.5, 6);
    ctx.stroke();
    // Lit lip on the light side of the crevice.
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + 3.5, py) : ctx.moveTo(px + 3.5, py)));
    ctx.strokeStyle = 'rgba(230,222,205,0.18)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  // Granite and lichen specks.
  const n = Math.round(((b.w * b.h) / 150) * specks);
  for (let i = 0; i < n; i++) {
    const k = rng.next();
    const col = k < 0.55 ? STONE.fleck[0] : k < 0.75 ? STONE.fleck[1] : STONE.fleck[2];
    ctx.fillStyle = rgba(col, rng.range(0.25, 0.65));
    const s = rng.range(0.8, 2);
    ctx.fillRect(b.x + rng.next() * b.w, b.y + rng.next() * b.h, s, s);
  }
  if (under) {
    const g = ctx.createLinearGradient(0, b.y + b.h * 0.25, 0, b.y + b.h);
    g.addColorStop(0, 'rgba(10,10,28,0)');
    g.addColorStop(1, `rgba(10,10,28,${under})`);
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  if (valley) {
    const g = ctx.createLinearGradient(0, valley[0], 0, valley[1]);
    g.addColorStop(0, 'rgba(10,18,48,0)');
    g.addColorStop(1, `rgba(10,18,48,${valley[2] ?? 0.6})`);
    ctx.fillStyle = g;
    ctx.fillRect(b.x, valley[0], b.w, Math.max(1, b.y + b.h - valley[0]));
  }
  ctx.restore();
  bevelBands(ctx, path, { light, width: 2, hi: 0.34, lo: 0.4, soft: 0 });
  return path;
}

// The lit walkable top face above a front edge (left to right).
export function paintDeck(ctx, top, { light, seed = 1, depth = 14 } = {}) {
  const rng = new RNG(`s08-deck-${seed}`);
  const back = top.map(([x, y]) => [x + rng.range(-3, 3), y - depth * rng.range(0.65, 1.15)]).reverse();
  const pts = [...top, ...back];
  const b = bounds(pts);
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, STONE.ramp[5]);
  g.addColorStop(1, STONE.ramp[3]);
  const path = piece(ctx, pts, { fill: g, torn: { amp: 1.2, freq: 0.2, fine: 0.8, seed: rng.int(1, 1e6) } });
  ctx.save();
  ctx.clip(path);
  brush(ctx, path, { angle: 0.05, amt: 0.22, scale: 0.8, seed: rng.int(1, 1e6) });
  for (let x = b.x + rng.range(20, 60); x < b.x + b.w; x += rng.range(40, 90)) {
    ctx.beginPath();
    ctx.moveTo(x, b.y - 2);
    ctx.lineTo(x + rng.range(-12, 12), b.y + b.h + 2);
    ctx.strokeStyle = rgba(STONE.crack, 0.55);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  for (let i = 0; i < (b.w * b.h) / 60; i++) {
    ctx.fillStyle = rgba(rng.chance(0.6) ? '#e4dccb' : '#2a2626', rng.range(0.25, 0.6));
    ctx.fillRect(b.x + rng.next() * b.w, b.y + rng.next() * b.h, 1.4, 1.4);
  }
  ctx.restore();
  bevelBands(ctx, path, { light, width: 1.6, hi: 0.4, lo: 0.3, soft: 0 });
}

function leaflet(ctx, x, y, len, rot, color) {
  const p = transform([[0, 0], [-len * 0.26, -len * 0.45], [0, -len], [len * 0.26, -len * 0.45]], { x, y, rot });
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath();
  ctx.fill();
}

function blade(ctx, x, y, len, w, rot, color) {
  const curl = rot * 0.5;
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    pts.push([-w * (1 - u) * 0.5 + curl * u * u * len * 0.4, -u * len]);
  }
  for (let i = 6; i >= 0; i--) {
    const u = i / 6;
    pts.push([w * (1 - u) * 0.5 + curl * u * u * len * 0.4, -u * len]);
  }
  const p = transform(pts, { x, y, rot });
  const path = pathOf(p);
  ctx.save();
  ctx.translate(1.2, 1.4);
  ctx.fillStyle = 'rgba(10,12,4,0.35)';
  ctx.fill(path);
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fill(path);
}

// Small rounded leaves batched per row: one shadow pass, a few tone buckets (deep ->
// highlight), then a lit spot on the upper leaves.
const LEAF_TONES = 7;
const LEAF_COLORS = Array.from({ length: LEAF_TONES }, (_, i) => {
  const u = i / (LEAF_TONES - 1);
  return u < 0.34 ? mix(MOSS.deep, MOSS.dark, u / 0.34) : u < 0.67 ? mix(MOSS.dark, MOSS.light, (u - 0.34) / 0.33) : mix(MOSS.light, MOSS.hi, (u - 0.67) / 0.33);
});
function fillLeafRow(ctx, leaves, light) {
  const sh = new Path2D(), hi = new Path2D();
  const B = Array.from({ length: LEAF_TONES }, () => new Path2D());
  const circ = (P, x, y, r) => { P.moveTo(x + r, y); P.arc(x, y, r, 0, Math.PI * 2); };
  for (const l of leaves) {
    circ(sh, l.x - light[0] * 1.5, l.y + 1.8, l.r * 1.05);
    circ(B[Math.round(clamp(l.t, 0, 1) * (LEAF_TONES - 1))], l.x, l.y, l.r);
    if (l.t > 0.5) circ(hi, l.x + light[0] * l.r * 0.34, l.y + light[1] * l.r * 0.34, l.r * 0.42);
  }
  ctx.fillStyle = 'rgba(16,20,2,0.6)';
  ctx.fill(sh);
  B.forEach((P, i) => { ctx.fillStyle = LEAF_COLORS[i]; ctx.fill(P); });
  ctx.fillStyle = 'rgba(252,248,176,0.34)';
  ctx.fill(hi);
}
// Unblurred offset shadow (cheap for hundreds of pieces).
function liftShadow(ctx, path, light, d = 3, a = 0.45) {
  ctx.save();
  ctx.translate(-light[0] * d * 0.8, d);
  ctx.fillStyle = `rgba(10,8,4,${a})`;
  ctx.fill(path);
  ctx.restore();
}

// One leafy cushion on (x, y): a lumpy dome of small rounded leaves piled in rows from the
// back (top, lit by the star) to the front (bottom, in shade), each row overlapping the
// one behind it so the single leaves read.
function cushion(ctx, x, y, rx, ry, rng, light, lum = 1) {
  const n = 20, ph = rng.range(0, 6), lobes = rng.int(2, 4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, up = Math.sin(a) < 0;
    const k = 1 + 0.14 * Math.sin(a * lobes + ph) + rng.range(-0.06, 0.06);
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * (up ? ry : ry * 0.5) * k]);
  }
  const path = pathOf(pts, { smooth: true });
  liftShadow(ctx, path, light, 4, 0.55);
  ctx.fillStyle = MOSS.deep;
  ctx.fill(path);
  const s = clamp(Math.min(rx, ry * 1.6) / 26, 0.5, 1.25);
  const count = Math.round(((rx * ry * 0.75) / (16 * s * s)) * 1.8);
  const leaves = [];
  const leaf = (px, py, r, t) => leaves.push({ x: px, y: py, r, t: clamp(t, 0, 1) });
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2, rr = Math.sqrt(rng.next()) * 0.9, up = Math.sin(a) < 0;
    const py = y + Math.sin(a) * (up ? ry : ry * 0.5) * rr;
    const h = clamp((y + ry * 0.5 - py) / (ry * 1.5), 0, 1);
    leaf(x + Math.cos(a) * rx * rr, py, rng.range(2.2, 4.6) * s, (0.12 + h * 0.9) * lum + rng.range(-0.2, 0.14));
  }
  // Bigger leaves along the outline give the cushion its scalloped edge.
  for (let i = 0; i < n * 1.3; i++) {
    const a = rng.next() * Math.PI * 2, up = Math.sin(a) < 0;
    const dy = Math.sin(a) * (up ? ry : ry * 0.5) * 0.95;
    const h = clamp((ry * 0.5 - dy) / (ry * 1.5), 0, 1);
    leaf(x + Math.cos(a) * rx * 0.95, y + dy, rng.range(3.4, 5.8) * s, (0.05 + h * 0.95) * lum + rng.range(-0.15, 0.1));
  }
  leaves.sort((p, q) => p.y - q.y);
  const rows = 4;
  for (let k = 0; k < rows; k++) fillLeafRow(ctx, leaves.slice(Math.floor((k * leaves.length) / rows), Math.floor(((k + 1) * leaves.length) / rows)), light);
}

// One clump of moss sitting on (x, y): a cushion, maybe with a leafy tongue of smaller
// cushions hanging down the face below it, grass blades and tiny yellow flowers.
function mossClump(ctx, x, y, rx, ry, rng, { light, flowers, grass, drape, drapeLen = 1 }) {
  if (rng.chance(drape)) {
    let cx = x + rng.range(-0.35, 0.35) * rx, cy = y, r = rx * rng.range(0.45, 0.62);
    const steps = Math.max(1, Math.round(rng.range(1, 3.2) * drapeLen));
    const hang = [];
    for (let i = 0; i < steps && r > 4; i++) {
      cy += r * rng.range(0.8, 1.1);
      cx += rng.range(-5, 5);
      r *= rng.range(0.68, 0.86);
      hang.push([cx, cy, r]);
    }
    for (let i = hang.length - 1; i >= 0; i--) {
      const [hx, hy, hr] = hang[i];
      cushion(ctx, hx, hy, hr * 1.1, hr * 0.9, rng, light, 0.62 + 0.08 * (hang.length - 1 - i));
    }
  }
  cushion(ctx, x, y, rx, ry, rng, light, 1);
  if (rng.chance(grass)) {
    const k = rng.int(3, 7);
    for (let i = 0; i < k; i++) blade(ctx, x + rng.range(-0.7, 0.7) * rx, y - ry * 0.4, rng.range(10, 26), rng.range(1.6, 3), rng.range(-0.55, 0.55), rng.pick(MOSS.grass));
  }
  if (rng.chance(0.55 * flowers)) {
    const k = rng.int(2, 6);
    for (let i = 0; i < k; i++) {
      const fx = x + rng.range(-0.75, 0.75) * rx, fy = y - ry * rng.range(0.3, 1);
      const r = rng.range(1.4, 2.8);
      const dot = (cx, cy, rr, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); };
      dot(fx + 0.7, fy + 1.1, r, 'rgba(30,24,4,0.45)');
      dot(fx, fy, r, rng.pick(MOSS.flower));
      dot(fx - r * 0.3, fy - r * 0.3, r * 0.38, 'rgba(255,250,215,0.85)');
    }
  }
}

// Moss along a polyline (left to right): separate leafy cushions, a back row of smaller
// ones piled behind the front row, bare stone showing between the groups.
//   density  clumps per length    size  clump scale     gaps  share of bare stretches
export function paintMoss(ctx, line, { light, seed = 1, density = 1, size = 1, drape = 0.35, flowers = 1, grass = 0.4, gaps = 0.25, lift = 0, drapeLen = 1 } = {}) {
  const rng = new RNG(`s08-moss-${seed}`);
  const nz = noise(`s08-moss-${seed}`);
  const L = lengths(line), total = L[L.length - 1];
  const spots = [];
  for (let d = rng.range(0, 8); d < total; d += (rng.range(28, 46) * size) / density) {
    if (nz.n1(d * 0.012) < Math.min(0.9, gaps + 0.12) * 2 - 1) continue;
    const p = pointAt(line, L, d);
    spots.push([p[0] + rng.range(-4, 4), p[1] + rng.range(-2, 4) - lift]);
  }
  for (const [x, y] of spots) {
    if (rng.chance(0.55)) mossClump(ctx, x + rng.range(-14, 14), y - rng.range(8, 15) * size, rng.range(15, 26) * size, rng.range(12, 19) * size, rng, { light, flowers, grass: grass * 0.5, drape: 0 });
  }
  for (const [x, y] of spots) {
    mossClump(ctx, x, y, rng.range(19, 33) * size, rng.range(14, 24) * size, rng, { light, flowers, grass, drape: drape * 0.55, drapeLen });
  }
}

// --- split rock -------------------------------------------------------------------

const jit = (rng, k) => rng.range(-k, k);

// x of a top-to-bottom polyline at height y.
function xAt(line, y) {
  if (y <= line[0][1]) return line[0][0];
  for (let i = 1; i < line.length; i++) {
    const [xa, ya] = line[i - 1], [xb, yb] = line[i];
    if (y <= yb) return xa + ((xb - xa) * (y - ya)) / (yb - ya || 1);
  }
  return line[line.length - 1][0];
}
// The part of a top-to-bottom polyline between heights ya < yb.
function stretch(line, ya, yb) {
  const out = [[xAt(line, ya), ya]];
  for (const p of line) if (p[1] > ya && p[1] < yb) out.push(p);
  out.push([xAt(line, yb), yb]);
  return out;
}
// A wandering crack from p to q.
function jagged(p, q, rng, amp = 5, step = 16) {
  const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, n = Math.max(1, Math.round(l / step));
  const nx = -(q[1] - p[1]) / l, ny = (q[0] - p[0]) / l;
  const out = [p];
  for (let i = 1; i < n; i++) {
    const u = i / n, d = jit(rng, amp);
    out.push([p[0] + (q[0] - p[0]) * u + nx * d, p[1] + (q[1] - p[1]) * u + ny * d]);
  }
  out.push(q);
  return out;
}
// Extra points every ~step px along an open polyline.
function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
// Catmull-Rom curve through control points, sampled every ~step px (open).
function spline(ctrl, step) {
  const out = [];
  const C = (i) => ctrl[clamp(i, 0, ctrl.length - 1)];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = C(i - 1), p1 = C(i), p2 = C(i + 1), p3 = C(i + 2);
    const n = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1].slice());
  return out;
}
function strokeLine(ctx, pts, width, color) {
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}
// A dark crevice with a pale lip on the edge of the stone below / right of it.
function crevice(ctx, pts, width) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokeLine(ctx, pts, width, rgba(STONE.crack, 0.92));
  const o = width * 0.5 + 1.2;
  strokeLine(ctx, pts.map(([x, y]) => [x + o * 0.8, y + o * 0.6]), 1.3, 'rgba(236,226,206,0.22)');
}
// One piece of split rock: the faceted face, warmed toward ref08's brown-grey.
function rockPiece(ctx, poly, { light, seed, bias, contrast = 1.5, valley = null, under = 0.1, form = 0.3, cracks = 0.35, chunk = 0 }) {
  const bb = bounds(poly);
  paintStone(ctx, poly, {
    light, seed, bias, contrast, valley, under, form, cracks, specks: 1.6,
    cell: [clamp(bb.w * 0.2, 20, 44), clamp(bb.h * 0.15, 22, 48)],
  });
  ctx.fillStyle = 'rgba(120,76,36,0.3)';
  ctx.fill(pathOf(poly));
  boulderShade(ctx, poly, light, chunk);
}
// Several closed polygons in one path (for even-odd differences).
function polysPath(list) {
  const P = new Path2D();
  for (const pts of list) {
    P.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) P.lineTo(pts[i][0], pts[i][1]);
    P.closePath();
  }
  return P;
}
// A boulder's volume: rounded light on the face turned to the star, a deep shadow side
// along the far edges (the stone minus its copy pushed d px toward the light) and a pale
// lit rim on the near ones.
function boulderShade(ctx, poly, light, d) {
  if (!d) return;
  const path = pathOf(poly);
  const b = bounds(poly);
  const shift = (k) => poly.map(([x, y]) => [x + light[0] * k, y + light[1] * k]);
  ctx.save();
  ctx.clip(path);
  const cx = b.x + b.w / 2 + light[0] * b.w * 0.2, cy = b.y + b.h / 2 + light[1] * b.h * 0.2;
  const R = Math.max(b.w, b.h) * 0.75;
  const g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
  g.addColorStop(0, 'rgba(255,236,208,0.16)');
  g.addColorStop(0.5, 'rgba(255,236,208,0)');
  g.addColorStop(1, 'rgba(12,8,10,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(14,10,12,0.3)';
  ctx.fill(polysPath([poly, shift(d * 2)]), 'evenodd');
  ctx.fillStyle = 'rgba(12,8,10,0.6)';
  ctx.fill(polysPath([poly, shift(d)]), 'evenodd');
  ctx.fillStyle = 'rgba(255,238,210,0.22)';
  ctx.fill(polysPath([poly, shift(-Math.max(3, d * 0.2))]), 'evenodd');
  ctx.restore();
}

// A cliff of split slabs: leaning crevices run down the face, a few slanted fractures
// cut each slab into tall irregular pieces, and every slab shows a narrow shaded side
// face on its left (away from the star) behind a lit arris.
//   col  [min, max] slab width     cut   [min, max] spacing of the cross fractures
//   lean drift of the crevices     side  [min, max] side face width, share of the slab
export function paintSlabs(ctx, outline, { light, seed = 1, col = [130, 230], cut = [220, 420], lean = 0.12, side = [0.14, 0.32], bias = -0.1, contrast = 1.25, valley = null, under = 0.1 } = {}) {
  const rng = new RNG(`s08-slabs-${seed}`);
  const path = pathOf(outline);
  const b = bounds(outline);
  const y0 = b.y - 30, y1 = b.y + b.h + 30;
  const tilt = jit(rng, lean);
  const wall = (x) => {
    const d = tilt + jit(rng, 0.05), pts = [];
    for (let y = y0, cx = x; ; y += rng.range(28, 56)) {
      const yy = Math.min(y, y1);
      pts.push([cx, yy]);
      if (yy >= y1) break;
      cx += d * 42 + jit(rng, 7);
    }
    return pts;
  };
  const walls = [];
  for (let x = b.x - rng.range(0.2, 0.7) * col[1]; ; x += rng.range(col[0], col[1])) {
    walls.push(wall(x));
    if (x > b.x + b.w) break;
  }
  ctx.save();
  ctx.fillStyle = STONE.crack;
  ctx.fill(path);
  ctx.clip(path);
  const seams = [];
  for (let i = 0; i < walls.length - 1; i++) {
    const L = walls[i], R = walls[i + 1];
    const w = xAt(R, b.y + b.h / 2) - xAt(L, b.y + b.h / 2);
    const cuts = [[y0, y0]];
    for (let y = b.y + rng.range(0.35, 1) * cut[1]; y < y1 - 90; y += rng.range(cut[0], cut[1])) {
      const s = jit(rng, 0.45) * w;
      cuts.push([y - s / 2, y + s / 2]);
    }
    cuts.push([y1, y1]);
    const sb = bias + jit(rng, 0.06);
    for (let k = 0; k < cuts.length - 1; k++) {
      const [la, ra] = cuts[k], [lb, rb] = cuts[k + 1];
      const poly = [...stretch(L, la, lb), ...stretch(R, ra, rb).reverse()];
      rockPiece(ctx, poly, { light, seed: `${seed}-${i}-${k}`, bias: sb + jit(rng, 0.05), contrast, valley, under, form: 0.55, chunk: 16 });
      // The slab's side face, turned away from the light, and its lit arris.
      const sw = w * rng.range(side[0], side[1]);
      const lft = stretch(L, Math.min(la, ra) - 4, Math.max(lb, rb) + 4);
      const arris = lft.map(([x, y]) => [x + sw + jit(rng, 2), y]);
      ctx.save();
      ctx.clip(pathOf(poly));
      ctx.fillStyle = 'rgba(8,8,22,0.5)';
      ctx.fill(pathOf([...lft.map(([x, y]) => [x - 8, y]), ...arris.slice().reverse()]));
      strokeLine(ctx, arris, 1.8, 'rgba(255,244,224,0.3)');
      // The top of the piece under a fracture catches the starlight.
      if (k > 0) strokeLine(ctx, [[xAt(L, la) - 10, la + 7], [xAt(R, ra) + 10, ra + 7]], 14, 'rgba(255,244,224,0.14)');
      ctx.restore();
      if (k > 0) seams.push(jagged([xAt(L, la), la], [xAt(R, ra), ra], rng, 4, 14));
    }
  }
  for (const W of walls) crevice(ctx, W, rng.range(4.5, 8));
  for (const s of seams) crevice(ctx, s, rng.range(3.5, 5.5));
  ctx.restore();
  bevelBands(ctx, path, { light, width: 2, hi: 0.3, lo: 0.4, soft: 0 });
  return path;
}

// A stone mass on its own plane: a face of split slabs, optional deck and moss lines.
function mass(S, { name, z, outline, deck = null, moss = [], seed, valley = null, bias = -0.22, slabs = {}, tags = ['rock'] }) {
  const b = bounds(outline);
  return S.plane(z, {
    name, x: b.x - 40, y: b.y - 60, w: b.w + 80, h: b.h + 100, res: 1, mat: ROCK_MAT,
    edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.6 }, shadow: { blur: 16 },
    draw(ctx) {
      const light = S.light;
      paintSlabs(ctx, outline, { light, seed, valley, bias, ...slabs });
      if (deck) paintDeck(ctx, deck.top, { light, seed, depth: deck.depth });
      moss.forEach((m, i) => paintMoss(ctx, m.line, { light, seed: `${seed}-${i}`, ...m }));
    },
  }, { tags });
}

// The natural arch (film px at rest), traced from ref08. Its top runs from behind the
// fox's ledge over the wedge stone, the big raised stone and the step stone to the mossy
// shoulder, then down the outer face of the leg; the underside is one smooth irregular
// arc running into the inner face of the leg. Joints split it into a few huge chunks.
const ARCH_TOP = [
  [836, 538], [880, 538], [930, 542], [975, 552], [1010, 560], [1046, 568], [1066, 576], [1074, 588],
  [1080, 566], [1100, 554], [1150, 556], [1190, 572], [1208, 600], [1214, 650], [1240, 662], [1290, 676],
  [1332, 692], [1342, 716], [1366, 722], [1420, 734], [1470, 752], [1514, 772], [1540, 794], [1552, 830],
  [1556, 880], [1546, 940], [1532, 1000], [1538, 1090], [1548, 1240],
];
const ARCH_WALK = 22;   // ARCH_TOP points that form the walkable top (to the shoulder's end)
const ARCH_UNDER = [
  [838, 726], [866, 698], [904, 680], [956, 666], [1012, 666], [1066, 678], [1112, 700], [1156, 728],
  [1196, 764], [1230, 808], [1262, 862], [1284, 924], [1296, 1000], [1304, 1100], [1310, 1240],
];
// Joints [point on the top, point on the underside], left to right then down the leg.
const ARCH_JOINTS = [
  [[922, 541], [912, 678]], [[1004, 559], [992, 666]], [[1074, 588], [1090, 688]], [[1214, 650], [1180, 742]],
  [[1342, 716], [1250, 836]], [[1554, 860], [1286, 940]], [[1534, 1060], [1300, 1040]],
];
// Brightness of each chunk: the big raised stone catches the most light.
const ARCH_BIAS = [-0.23, -0.19, -0.17, -0.1, -0.2, -0.23, -0.28, -0.31];

export function archTopY(x) {
  const T = ARCH_TOP.slice(0, ARCH_WALK);
  if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (x - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
}

// Push the points of an open polyline out along its normal: a swell of amp px between
// consecutive break indices and a pinch of dip px at each inner break. side 1: the normal
// left of travel (out of the arch's top), -1: right of travel (out of its underside).
function lobe(A, breaks, amp, dip, side) {
  const N = A.map((p, i) => {
    const q = A[Math.max(0, i - 1)], r = A[Math.min(A.length - 1, i + 1)];
    const dx = r[0] - q[0], dy = r[1] - q[1], l = Math.hypot(dx, dy) || 1;
    return [(side * dy) / l, (-side * dx) / l];
  });
  const off = new Array(A.length).fill(0);
  for (let k = 0; k < breaks.length - 1; k++) {
    const a = breaks[k], b = breaks[k + 1];
    for (let i = a + 1; i < b; i++) off[i] = amp * Math.pow(Math.sin((Math.PI * (i - a)) / (b - a)), 0.6);
  }
  for (let k = 1; k < breaks.length - 1; k++) {
    const a = breaks[k];
    off[a] = -dip;
    off[a - 1] = Math.min(off[a - 1], -dip * 0.45);
    off[a + 1] = Math.min(off[a + 1], -dip * 0.45);
  }
  A.forEach((p, i) => { p[0] += N[i][0] * off[i]; p[1] += N[i][1] * off[i]; });
}

function addArch(S, { z = 1015 } = {}) {
  return S.plane(z, {
    name: 'arch', x: 790, y: 460, w: 790, h: 800, res: 1, mat: ROCK_MAT,
    edge: { width: 1.6, hi: 0.32, lo: 0.3, soft: 0.6 }, shadow: { blur: 16 },
    draw(ctx) {
      const light = S.light;
      const rng = new RNG('s08-arch');
      const wob = (A, k) => A.map(([x, y], i) => (i && i < A.length - 1 ? [x + jit(rng, k), y + jit(rng, k)] : [x, y]));
      const T = wob(densify(ARCH_TOP, 9), 1.2);
      const U = wob(spline(ARCH_UNDER, 9), 0.7);
      const near = (A, p) => {
        let bi = 0, bd = Infinity;
        A.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
        return bi;
      };
      const idx = ARCH_JOINTS.map(([tp, up]) => [near(T, tp), near(U, up)]);
      // Each chunk swells a little between its joints and the joints pinch in: the span
      // reads as a few huge fused boulders while the underside stays one smooth arc.
      lobe(T, [0, ...idx.map((p) => p[0]), T.length - 1], 12, 17, 1);
      lobe(U, [0, ...idx.map((p) => p[1]), U.length - 1], 4, 8, -1);
      const joints = idx.map(([a, b]) => ({ a, b, line: jagged(T[a], U[b], rng, 4, 14) }));
      const ends = [{ a: 0, b: 0, line: [T[0], U[0]] }, ...joints, { a: T.length - 1, b: U.length - 1, line: [T[T.length - 1], U[U.length - 1]] }];
      const path = pathOf([...T, ...U.slice().reverse()]);
      ctx.save();
      ctx.fillStyle = STONE.crack;
      ctx.fill(path);
      ctx.clip(path);
      for (let k = 0; k < ends.length - 1; k++) {
        const A = ends[k], B = ends[k + 1];
        const poly = [...T.slice(A.a, B.a + 1), ...B.line.slice(1, -1), ...U.slice(A.b, B.b + 1).reverse(), ...A.line.slice(1, -1).reverse()];
        rockPiece(ctx, poly, { light, seed: `arch-${k}`, bias: ARCH_BIAS[k], contrast: 1.3, valley: [880, 1240, 0.55], cracks: 0.35, form: 0.6, chunk: 26 });
      }
      // The span's form: a lit crown along the top, the underside curving away into shadow.
      ctx.lineJoin = 'round';
      strokeLine(ctx, T, 34, 'rgba(255,240,214,0.15)');
      strokeLine(ctx, U, 64, 'rgba(8,8,24,0.3)');
      strokeLine(ctx, U, 26, 'rgba(6,6,18,0.36)');
      strokeLine(ctx, U.map(([x, y]) => [x + 2, y - 15]), 1.4, 'rgba(255,240,220,0.12)');
      for (const j of joints) crevice(ctx, j.line, 11);
      ctx.restore();
      bevelBands(ctx, path, { light, width: 2, hi: 0.34, lo: 0.4, soft: 0 });
      // Moss on the span and draped over the shoulder of the leg.
      paintMoss(ctx, [[836, 540], [880, 540], [930, 544], [975, 554], [1004, 560]], { light, seed: 'arch-a', density: 1.25, gaps: 0.12, drape: 0.55, drapeLen: 1.25 });
      paintMoss(ctx, [[1004, 560], [1046, 570], [1068, 577]], { light, seed: 'arch-b', density: 0.9, size: 0.85, gaps: 0.3, drape: 0.6, drapeLen: 1.2 });
      paintMoss(ctx, [[1084, 562], [1100, 556], [1150, 558], [1188, 574]], { light, seed: 'arch-c', density: 0.6, size: 0.8, gaps: 0.5, drape: 0.45 });
      paintMoss(ctx, [[1215, 653], [1240, 664], [1290, 678], [1334, 694]], { light, seed: 'arch-d', density: 1.2, size: 0.95, gaps: 0.15, drape: 0.75, drapeLen: 1.5 });
      paintMoss(ctx, [[1344, 720], [1366, 724], [1420, 736], [1470, 754], [1530, 782]], { light, seed: 'arch-e', density: 1.8, size: 1.25, gaps: 0, drape: 0.65, drapeLen: 1.2, grass: 0.6 });
      paintMoss(ctx, [[1352, 746], [1420, 760], [1470, 776], [1524, 806]], { light, seed: 'arch-f', density: 1.3, size: 0.95, gaps: 0.1, drape: 0.6, drapeLen: 1.3 });
    },
  }, { tags: ['rock', 'arch'] });
}

export function addRocks(S) {
  const valley = [700, 1200, 0.6];
  // Right cliff: tall split slabs under a thick moss mat (in front of the right spruces).
  const crTop = [[1684, 674], [1730, 656], [1790, 648], [1860, 652], [1930, 644], [2000, 650], [2260, 648]];
  mass(S, {
    name: 'cliff-right', z: 1040, seed: 'cr', valley, slabs: { col: [120, 210], cut: [240, 420] },
    outline: [...crTop, [2260, 1200], [1704, 1200], [1716, 1060], [1694, 960], [1708, 860], [1690, 800], [1678, 740]],
    deck: { top: crTop, depth: 12 },
    moss: [
      { line: [[1674, 678], [1730, 660], [1790, 652], [1860, 656], [1930, 648], [2120, 652]], density: 2, size: 1.35, gaps: 0, drape: 0.6, drapeLen: 1.15 },
      { line: [[1690, 700], [1760, 690], [1860, 684], [2000, 680]], density: 1.4, size: 1, gaps: 0.1, drape: 0.5, drapeLen: 1.1 },
      { line: [[1680, 702], [1688, 752], [1700, 802]], density: 1.4, size: 0.75, gaps: 0, drape: 0.9, drapeLen: 1.5, flowers: 0.6 },
    ],
  });
  // Right pillar rising out of the cloud sea.
  mass(S, {
    name: 'pillar-right', z: 1100, seed: 'pr', valley: [950, 1200, 0.55], slabs: { col: [80, 120], cut: [180, 300] },
    outline: [[1540, 902], [1590, 888], [1650, 886], [1704, 898], [1712, 1000], [1716, 1200], [1536, 1200], [1530, 1000]],
    deck: { top: [[1540, 902], [1590, 888], [1650, 886], [1704, 898]], depth: 10 },
    moss: [{ line: [[1534, 904], [1590, 890], [1650, 888], [1710, 900]], density: 1.8, size: 1.2, gaps: 0, drape: 0.6, drapeLen: 1.15 }],
  });
  addArch(S);
  // Left: tall block, middle block, the fox's ledge, the low mossy shelf, the front pillar.
  mass(S, {
    name: 'block-left', z: 1040, seed: 'bl', valley: [500, 780, 0.4], slabs: { col: [100, 170], cut: [200, 360] },
    outline: [[150, 378], [190, 360], [250, 352], [320, 350], [380, 358], [412, 376], [420, 480], [430, 620], [420, 780], [150, 780], [140, 600], [145, 470]],
    deck: { top: [[150, 378], [190, 360], [250, 352], [320, 350], [380, 358], [412, 376]], depth: 10 },
    moss: [{ line: [[140, 380], [190, 362], [250, 354], [320, 352], [380, 360], [416, 378]], density: 1.5, size: 1.1, gaps: 0.05, drape: 0.7, drapeLen: 1.3 }],
  });
  mass(S, {
    name: 'block-mid', z: 1030, seed: 'bm', valley: [560, 720, 0.4], slabs: { col: [90, 150], cut: [180, 300] },
    outline: [[378, 474], [420, 462], [480, 456], [530, 460], [556, 472], [562, 560], [555, 720], [372, 720], [368, 560]],
    deck: { top: [[378, 474], [420, 462], [480, 456], [530, 460], [556, 472]], depth: 10 },
    moss: [{ line: [[372, 476], [420, 464], [480, 458], [530, 462], [560, 474]], density: 1.2, size: 1, gaps: 0.2, drape: 0.6, drapeLen: 1.2 }],
  });
  const ledgeTop = [[430, 552], [500, 546], [580, 542], [660, 540], [740, 539], [810, 537], [860, 534], [884, 538]];
  mass(S, {
    name: 'ledge', z: 1000, seed: 'lg', valley, slabs: { col: [120, 200], cut: [240, 420] },
    outline: [...ledgeTop, [890, 600], [868, 690], [856, 780], [852, 880], [862, 1000], [880, 1200], [330, 1200], [330, 800], [390, 640]],
    deck: { top: ledgeTop, depth: 16 },
    moss: [{ line: ledgeTop.map(([x, y]) => [x, y + 3]), density: 0.9, size: 0.95, gaps: 0.42, drape: 0.6, flowers: 1.2, drapeLen: 1.3 },
      { line: [[800, 540], [890, 540]], density: 1.6, size: 1.15, gaps: 0, drape: 0.8, drapeLen: 1.4 }],
  });
  const shelfTop = [[-340, 652], [-100, 640], [60, 622], [170, 606], [280, 598], [380, 590], [460, 580], [530, 570], [566, 566]];
  mass(S, {
    name: 'shelf-left', z: 985, seed: 'sl', valley: [700, 1100, 0.5], slabs: { col: [130, 230], cut: [220, 400] },
    outline: [...shelfTop, [580, 620], [560, 740], [610, 880], [650, 1200], [-340, 1200]],
    deck: { top: shelfTop, depth: 12 },
    moss: [{ line: shelfTop, density: 1.5, size: 1.2, gaps: 0.08, drape: 0.7, grass: 0.7, drapeLen: 1.3 }],
  });
  mass(S, {
    name: 'pillar-front', z: 950, seed: 'pf', valley: [950, 1200, 0.5], slabs: { col: [80, 120], cut: [180, 300] },
    outline: [[768, 906], [820, 890], [880, 888], [936, 900], [948, 1000], [962, 1200], [756, 1200], [764, 1000]],
    deck: { top: [[768, 906], [820, 890], [880, 888], [936, 900]], depth: 10 },
    moss: [{ line: [[762, 908], [820, 892], [880, 890], [940, 902]], density: 1.4, size: 1.05, gaps: 0.05, drape: 0.6, drapeLen: 1.3 }],
  });
}
