// Moving water along a path. A river or a waterfall is a ribbon: a centre line
// sampled from a spline, with a width and a texture coordinate u that runs along the
// flow. Two things travel down it:
//
//   - a seamless strip texture (opaque), scrolled through the ribbon in thin slices;
//     it repeats exactly every `period` texture px, paper grain included, so the
//     flow never shows a loop seam (waterfalls);
//   - loose paper strips ("riders"), baked sprites placed along the ribbon each frame,
//     which cast real drop shadows on what lies below (rivers, streaks on falls).

import { surface } from '../core/canvas.js';
import { texture } from '../core/paper.js';
import { hashString, mulberry32 } from '../core/rng.js';
import { pathOf, setShadow, clearShadow } from '../core/piece.js';
import { tear } from '../core/geom.js';
import { rgba } from '../core/color.js';

// Extra texture columns past the period that repeat its start, so a slice can always
// be copied in one piece without wrapping.
export const MARGIN = 160;

const TEX_TILE = 1024;

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Catmull-Rom spline through pts, sampled about every `step` px. Each sample keeps
// its fractional control-point index `c`, so per-point values can be interpolated.
export function spline(pts, step = 6) {
  const out = [];
  const n = pts.length;
  const get = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(2, Math.ceil(len / step));
    // Same tangents as geom.smoothPath (tension 0.5), so outlines and ribbons agree.
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let j = 0; j < m; j++) {
      const t = j / m, s = 1 - t;
      const a = s * s * s, b = 3 * s * s * t, c = 3 * s * t * t, d = t * t * t;
      out.push({ x: a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0], y: a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1], c: i + t });
    }
  }
  out.push({ x: pts[n - 1][0], y: pts[n - 1][1], c: n - 1 });
  return out;
}

// Resolve a width option into (k, c) => px, k = 0..1 along the length, c = control index.
function widthFn(width) {
  if (typeof width === 'function') return (k) => width(k);
  if (Array.isArray(width)) {
    return (k, c) => {
      const i = Math.min(width.length - 2, Math.floor(c));
      const f = Math.min(1, c - i);
      return width[i] + (width[i + 1] - width[i]) * f;
    };
  }
  return () => width;
}

// Sample a ribbon along `path`.
//   width   px: number, one value per control point, or (k) => px
//   texH    texture px mapped across the full width
//   uScale  screen px per texture px along the flow: (k, w) => number.
//           Default w / texH: the texture keeps its aspect and grows with the width,
//           which is right for a river receding in perspective.
export function ribbon(path, { width = 100, texH = 256, uScale = null, step = 6 } = {}) {
  const raw = spline(path, step);
  const wf = widthFn(width);
  const pts = [];
  let s = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) s += Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
    pts.push({ ...raw[i], s });
  }
  const L = s || 1;
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    p.ang = Math.atan2(b.y - a.y, b.x - a.x);
    p.k = p.s / L;
    p.w = wf(p.k, p.c);
    p.us = uScale ? uScale(p.k, p.w) : p.w / texH;
    if (i > 0) u += (p.s - pts[i - 1].s) / ((p.us + pts[i - 1].us) / 2);
    p.u = u;
  }
  // Mean flow direction, for orienting baked light and shadows in texture space.
  let cx = 0, cy = 0;
  for (const p of pts) { cx += Math.cos(p.ang); cy += Math.sin(p.ang); }
  return { pts, length: L, uLength: u, texH, angle: Math.atan2(cy, cx) };
}

// Softer perspective for loose strips. Strips scale with (w / texH)^p rather than
// w / texH, so the near end of a widening river does not get giant strips. Each sample
// also gets .sig, a coordinate along the flow in which strips are spread evenly (and ride
// at constant speed) yet still cover the river evenly on screen: where the river is wide
// they sit closer together in u and move more slowly, as a widening river does.
export function warp(rb, p = 0.5) {
  const P = rb.pts;
  let sig = 0, area = 0, sc2 = 0;
  for (let i = 0; i < P.length; i++) {
    const q = P[i], k = q.w / rb.texH;
    q.sc = Math.pow(k, p);
    q.g = Math.pow(k, 2 - 2 * p);
    if (i > 0) {
      const a = P[i - 1], ds = (q.u - a.u) * (q.g + a.g) / 2;
      sig += ds;
      sc2 += ds * (q.sc * q.sc + a.sc * a.sc) / 2;
      area += (q.s - a.s) * (q.w + a.w) / 2;
    }
    q.sig = sig;
  }
  rb.sigLength = sig;
  rb.area = area;              // screen area of the river
  rb.meanSc2 = sc2 / (sig || 1); // mean squared strip scale over an even spread in sig
  return rb;
}

// Texture coordinate u at warped coordinate sig (extrapolated past the ends).
export function uAtSig(rb, s) {
  const P = rb.pts, n = P.length - 1;
  if (s <= 0) return s / P[0].g;
  if (s >= rb.sigLength) return rb.uLength + (s - rb.sigLength) / P[n].g;
  let lo = 0, hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P[mid].sig <= s) lo = mid; else hi = mid;
  }
  const a = P[lo], b = P[hi];
  return a.u + (b.u - a.u) * ((s - a.sig) / ((b.sig - a.sig) || 1));
}

// Ribbon sample at texture coordinate u (clamped to the ends), interpolated.
export function atU(rb, u) {
  const P = rb.pts;
  if (u <= 0) return P[0];
  if (u >= rb.uLength) return P[P.length - 1];
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P[mid].u <= u) lo = mid; else hi = mid;
  }
  const a = P[lo], b = P[hi];
  const f = (u - a.u) / ((b.u - a.u) || 1);
  return {
    x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f,
    ang: a.ang + angDiff(b.ang, a.ang) * f,
    sa: a.sa === undefined ? undefined : a.sa + angDiff(b.sa, a.sa) * f,
    sc: a.sc === undefined ? undefined : a.sc + (b.sc - a.sc) * f,
    w: a.w + (b.w - a.w) * f, us: a.us + (b.us - a.us) * f, k: a.k + (b.k - a.k) * f,
  };
}

// Map a point in texture space (u along, v across 0..texH) to the screen.
export function project(rb, u, v) {
  const q = atU(rb, u);
  const off = (v / rb.texH - 0.5) * q.w;
  return { ...q, x: q.x - Math.sin(q.ang) * off, y: q.y + Math.cos(q.ang) * off };
}

// Closed outline of the ribbon: the v = 0 bank forward, the v = texH bank back.
//   inset     shrink px per side
//   round     px over which the start is rounded off into an arch (a waterfall's lip)
export function outline(rb, { inset = 0, round = 0 } = {}) {
  const left = [], right = [];
  for (const p of rb.pts) {
    const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
    let h = p.w / 2 - inset;
    if (round > 0 && p.s < round) h *= Math.sqrt(Math.max(0, 1 - (1 - p.s / round) ** 2));
    left.push([p.x - nx * h, p.y - ny * h]);
    right.push([p.x + nx * h, p.y + ny * h]);
  }
  return [...left, ...right.reverse()];
}

// Rotate a screen-space vector into the texture frame of a ribbon (u along, v across).
export function toTexFrame(rb, [x, y]) {
  const c = Math.cos(rb.angle), s = Math.sin(rb.angle);
  return [x * c + y * s, -x * s + y * c];
}

// Lay a batch of flat pieces at once: hundreds of strips for the price of a few.
// paint(add) calls add(pts, { fill, torn, rim }) for every piece. The whole batch gets
// one soft contact shadow (a single shadowed fill of all outlines), then each piece is
// filled in its own colour with a lit upper edge and a dark lower edge. Pieces in one
// batch do not shadow each other, so build depth from several batches, back to front.
//   shadow  { color, alpha, blur, dx, dy }
//   edge    { width, hi, lo } strength of the lit and unlit edge lines
export function sheet(ctx, paint, { light = [0.4, -0.9], shadow = null, edge = null } = {}) {
  const items = [];
  paint((pts, o = {}) => items.push({ ...o, pts: o.torn ? tear(pts, o.torn) : pts }));
  if (!items.length) return;
  const paths = items.map((it) => pathOf(it.pts));
  ctx.save();
  if (shadow) {
    const all = new Path2D();
    for (const p of paths) all.addPath(p);
    setShadow(ctx, { color: rgba(shadow.color ?? '#000', shadow.alpha ?? 0.45), blur: shadow.blur ?? 3, x: shadow.dx ?? 0, y: shadow.dy ?? 2 });
    ctx.fillStyle = items[0].fill;
    ctx.fill(all);
    clearShadow(ctx);
  }
  ctx.lineJoin = 'round';
  items.forEach((it, i) => {
    if (it.rim) {
      ctx.strokeStyle = it.rim.color ?? '#fff';
      ctx.lineWidth = (it.rim.width ?? 1) * 2;
      ctx.stroke(paths[i]);
    }
    ctx.fillStyle = it.fill;
    ctx.fill(paths[i]);
  });
  if (edge) {
    // Strip outlines run along the upper edge first, then back along the lower one. Each
    // line is nudged inward so it sits on the paper like a bevel instead of outlining it.
    const w = edge.width ?? 1.1, ix = light[0] * w * 0.5, iy = light[1] * w * 0.5;
    ctx.lineWidth = w;
    const pass = (alpha, color, upper, dx, dy) => {
      if (!alpha) return;
      ctx.strokeStyle = rgba(color, alpha);
      ctx.beginPath();
      for (const { pts } of items) {
        const h = pts.length >> 1;
        const [from, to] = upper ? [0, h] : [h, pts.length - 1];
        ctx.moveTo(pts[from][0] + dx, pts[from][1] + dy);
        for (let k = from + 1; k <= to; k++) ctx.lineTo(pts[k][0] + dx, pts[k][1] + dy);
      }
      ctx.stroke();
    };
    pass(edge.hi ?? 0.35, '#ffffff', true, -ix, -iy);
    pass(edge.lo ?? 0.2, '#000000', false, ix, iy);
  }
  ctx.restore();
}

// Paper grain laid with an exact horizontal period: like paper.applyTexture, but the
// pattern is scaled so a whole number of tiles fits the period and never rotated.
function periodicPaper(canvas, { res, period, seed, recipe }) {
  const ctx = canvas.getContext('2d');
  const tmp = surface(canvas.width, canvas.height);
  const r = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
  for (const layer of recipe) {
    const reps = Math.max(1, Math.round(period / (TEX_TILE * (layer.scale ?? 1))));
    const sc = (period * res) / (TEX_TILE * reps);
    const t = tmp.ctx;
    t.globalCompositeOperation = 'copy';
    const pat = t.createPattern(texture(layer.tex), 'repeat');
    pat.setTransform(new DOMMatrix().translateSelf(0, r() * TEX_TILE * sc).scaleSelf(sc, sc * (r() < 0.5 ? 1 : -1)));
    t.fillStyle = pat;
    t.fillRect(0, 0, canvas.width, canvas.height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = layer.mode ?? 'soft-light';
    ctx.globalAlpha = Math.min(1, layer.amt);
    ctx.drawImage(tmp.canvas, 0, 0);
    ctx.restore();
  }
}

export const FLOW_PAPER = [{ tex: 'fiber', amt: 0.55 }, { tex: 'crumple', amt: 0.3, scale: 0.4 }];

// Paint a seamless flow texture, period x h texture px (plus MARGIN).
// paint(ctx, wrap): wrap(u0, u1, fn) calls fn(offset) once for every copy of a piece
// spanning u0..u1 that lands on the canvas, so pieces crossing the seam repeat exactly.
export function flowTexture({ period, h, res = 1.5, seed = 1, paint, recipe = FLOW_PAPER }) {
  const W = period + MARGIN;
  const { canvas, ctx } = surface(Math.ceil(W * res), Math.ceil(h * res));
  ctx.__res = res;
  ctx.scale(res, res);
  const pad = 24;
  const wrap = (u0, u1, fn) => {
    for (const o of [-period, 0, period]) if (u1 + o >= -pad && u0 + o <= W + pad) fn(o);
  };
  paint(ctx, wrap);
  ctx.__res = undefined;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  periodicPaper(canvas, { res, period, seed, recipe });
  return { canvas, res, period, h, width: W };
}

// Draw a flow texture through the ribbon, scrolled downstream by `offset` texture px.
// Each slice overlaps the next a little (more on bends) so no gaps open between them.
export function drawSlices(ctx, rb, tex, offset) {
  const { canvas, res, period, h } = tex;
  const P = rb.pts;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    const ds = b.s - a.s;
    if (ds <= 0.01) continue;
    const du = b.u - a.u;
    const ext = 1.5 + Math.abs(angDiff(b.ang, a.ang)) * a.w * 0.5;
    const span = Math.min(MARGIN - 1, (du * (ds + ext)) / ds);
    let u0 = (a.u - offset) % period;
    if (u0 < 0) u0 += period;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.ang);
    ctx.drawImage(canvas, u0 * res, 0, span * res, h * res, 0, -a.w / 2, (span * ds) / du, a.w);
    ctx.restore();
  }
}

// Placements for loose strips riding the current (atlas items).
//   items   [{ cell, hl, p, v, speed, flip }]: p = 0..1 starting phase along the ribbon,
//           v = position across (0..texH), hl = half length (texture px)
//   offset  distance travelled (texture px); each item moves at offset * speed
//   orient  'flow' (lie along the ribbon) or 'field' (lie along each sample's .sa angle;
//           strips are nudged inward so they never poke past the banks). A warped
//           ribbon (see warp) spreads and moves 'field' riders in its .sig coordinate.
//   fade    [in, out] texture px over which riders fade in / out at the ends
export function riders(rb, items, offset, { orient = 'flow', fade = [0, 0], pad = 220 } = {}) {
  const out = [];
  const warped = orient === 'field' && rb.sigLength !== undefined;
  const P = rb.pts;
  const padA = warped ? pad * P[0].g : pad, padB = warped ? pad * P[P.length - 1].g : pad;
  const L = (warped ? rb.sigLength : rb.uLength) + padA + padB;
  const H = rb.texH;
  for (const it of items) {
    let pos = (it.p * L + offset * (it.speed ?? 1)) % L;
    if (pos < 0) pos += L;
    pos -= padA;
    const u = warped ? uAtSig(rb, pos) : pos;
    if (u < -pad * 0.6 || u > rb.uLength + pad * 0.6) continue;
    let alpha = 1;
    if (fade[0] > 0) alpha *= Math.max(0, Math.min(1, u / fade[0]));
    if (fade[1] > 0) alpha *= Math.max(0, Math.min(1, (rb.uLength - u) / fade[1]));
    if (alpha <= 0.01) continue;
    let v = it.v;
    if (orient === 'field') {
      const q0 = atU(rb, u);
      const k = (q0.sc ?? 1) / (q0.w / H);
      const reach = (it.hl ?? 0) * k * Math.abs(Math.sin(angDiff(q0.sa, q0.ang))) + 3;
      v = Math.max(reach, Math.min(H - reach, v));
    }
    const q = project(rb, u, v);
    const lat = q.w / H;
    if (orient === 'field') {
      const sc = q.sc ?? lat;
      out.push({ cell: it.cell, x: q.x, y: q.y, rot: q.sa, sx: sc * (it.flip ? -1 : 1), sy: sc, alpha });
    } else {
      out.push({ cell: it.cell, x: q.x, y: q.y, rot: q.ang, sx: q.us * (it.flip ? -1 : 1), sy: lat, alpha });
    }
  }
  return out;
}

// --- Atlas ---------------------------------------------------------------------------
// Many small pieces (strips, dashes, puffs) baked once into one sprite and drawn as
// sub-rectangles: one bake instead of hundreds, and each draw only fills its own cell.

// cells: [{ hx, hy, draw(ctx) }] half extents of each piece around its origin; draw paints
// it centred on (0, 0). spriteOpts: the usual S.sprite options (mat, edge, shadow, res...).
// Cells keep a margin wide enough that neighbouring shadows never bleed into each other.
export function bakeAtlas(S, cells, spriteOpts = {}) {
  const blur = spriteOpts.shadow ? spriteOpts.shadow.blur ?? 3 : 0;
  const m = Math.ceil(blur * 3 + 3);
  const maxW = 1400;
  const placed = [];
  let x = 0, y = 0, rowH = 0, width = 0;
  for (const c of cells) {
    const w = (c.hx + m) * 2, h = (c.hy + m) * 2;
    if (x + w > maxW && x > 0) { x = 0; y += rowH; rowH = 0; }
    placed.push({ x: x + w / 2, y: y + h / 2, hx: c.hx + m, hy: c.hy + m });
    x += w; rowH = Math.max(rowH, h); width = Math.max(width, x);
  }
  const s = S.sprite({
    ...spriteOpts, x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, y + rowH),
    draw: (ctx) => cells.forEach((c, i) => { ctx.save(); ctx.translate(placed[i].x, placed[i].y); c.draw(ctx); ctx.restore(); }),
  });
  return { s, cells: placed };
}

// Draw atlas cells: every shadow first, then the paper, like drawSprites.
//   items  [{ cell, x, y, rot, sx, sy, alpha }]: cell origin lands at (x, y)
//   shadow { dx, dy, alpha } in plane coordinates
export function drawAtlas(ctx, A, items, { dx = 0, dy = 2, alpha = 0.45 } = {}) {
  const s = A.s, sh = s.shadow, res = s.res;
  const M = ctx.getTransform();
  const base = ctx.globalAlpha;
  const put = (it, ox, oy) => {
    const r = it.rot || 0, sx = it.sx ?? 1, sy = it.sy ?? 1;
    const c = Math.cos(r), n = Math.sin(r);
    const a = c * sx, b = n * sx, cc = -n * sy, d = c * sy, e = it.x + ox, f = it.y + oy;
    ctx.setTransform(M.a * a + M.c * b, M.b * a + M.d * b, M.a * cc + M.c * d, M.b * cc + M.d * d, M.a * e + M.c * f + M.e, M.b * e + M.d * f + M.f);
  };
  if (sh && alpha > 0) {
    const kx = sh.canvas.width / (s.w + 2 * sh.pad), ky = sh.canvas.height / (s.h + 2 * sh.pad);
    for (const it of items) {
      const c = A.cells[it.cell];
      put(it, dx, dy);
      ctx.globalAlpha = base * alpha * (it.alpha ?? 1);
      ctx.drawImage(sh.canvas, (c.x - c.hx + sh.pad) * kx, (c.y - c.hy + sh.pad) * ky, c.hx * 2 * kx, c.hy * 2 * ky, -c.hx, -c.hy, c.hx * 2, c.hy * 2);
    }
  }
  for (const it of items) {
    const c = A.cells[it.cell];
    put(it, 0, 0);
    ctx.globalAlpha = base * (it.alpha ?? 1);
    ctx.drawImage(s.canvas, (c.x - c.hx) * res, (c.y - c.hy) * res, c.hx * 2 * res, c.hy * 2 * res, -c.hx, -c.hy, c.hx * 2, c.hy * 2);
  }
  ctx.setTransform(M);
  ctx.globalAlpha = base;
}

// Draw only the drop shadow of a baked sprite (for silhouettes whose paper is drawn
// some other way, like a waterfall built from slices).
export function drawShadowOnly(ctx, s, { dx = 0, dy = 8, alpha = 0.45 } = {}) {
  if (!s.shadow) return;
  const p = s.shadow.pad;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(s.shadow.canvas, s.x - p + dx, s.y - p + dy, s.w + 2 * p, s.h + 2 * p);
  ctx.restore();
}
