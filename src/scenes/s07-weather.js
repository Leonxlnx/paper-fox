// s07 storm coast: the weather. Slanting rain at several depths and lightning (a
// jagged paper bolt, light blooming inside the clouds and a cold flash over the frame).
//
// Rain is a seamless tile of streaks scrolled along the fall direction, so it never
// loops visibly and costs one pattern fill per plane. Lightning is a list of strikes,
// each with its own envelope; every plane that reacts to it reads the same envelope.

import { W, H } from '../core/stage.js';
import { RNG } from '../core/rng.js';
import { surface } from '../core/canvas.js';
import { pathOf, setShadow, clearShadow } from '../core/piece.js';
import { tear } from '../core/geom.js';
import { rgba, mix } from '../core/color.js';
import { clamp, smoothstep } from '../core/ease.js';
import { drawGlow } from '../elements/sky.js';

// --- lightning envelope -------------------------------------------------------------

// One strike: a fast rise, a hold, an exponential fall and a fainter re-strike, the
// flicker of a real discharge. Zero before `at` and continuous everywhere.
//   at        strike time (s); power: peak 0..1
//   decay     time constant of the fall (s); restrike: delay of the second pulse
export function strikeEnvelope(t, { at, power = 1, decay = 0.05, restrike = 0.09, hold = 0.03 }) {
  const d = t - at;
  if (d < 0) return 0;
  const rise = smoothstep(0, 0.025, d);
  const main = rise * (d < hold ? 1 : Math.exp(-(d - hold) / decay));
  const d2 = d - restrike;
  const second = d2 < 0 ? 0 : 0.6 * smoothstep(0, 0.02, d2) * Math.exp(-d2 / (decay * 1.3));
  return power * Math.min(1, main + second);
}

// Sum of all strikes (clamped), and the strike nearest in time for placing glows.
export function flashLevel(t, strikes) {
  let s = 0;
  for (const k of strikes) s += strikeEnvelope(t, k);
  return clamp(s);
}

// --- rain ---------------------------------------------------------------------------

// Seamless tile of rain streaks falling along dir.
//   size      tile size in authored px; count: streaks per tile
//   len, width  [min, max] streak length and width (px)
//   alpha     [min, max] opacity; color: streak colour; drops: extra round specks
function rainTile({ size, count, len, width, alpha, dir, color, drops, soft, seed }) {
  const { canvas, ctx } = surface(size, size);
  const rng = new RNG(seed);
  ctx.lineCap = 'round';
  if (soft) ctx.filter = `blur(${soft}px)`;
  const wrap = (x, y, pad, fn) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const X = x + ox, Y = y + oy;
      if (X < -pad || Y < -pad || X > size + pad || Y > size + pad) continue;
      fn(X, Y);
    }
  };
  for (let i = 0; i < count; i++) {
    const L = rng.range(len[0], len[1]) * (rng.chance(0.15) ? 1.6 : 1);
    const w = rng.range(width[0], width[1]);
    const a = rng.range(alpha[0], alpha[1]);
    const x = rng.next() * size, y = rng.next() * size;
    wrap(x, y, L, (X, Y) => {
      // A streak is brightest at its head (the leading, lower end) and fades up its tail.
      const g = ctx.createLinearGradient(X, Y, X - dir[0] * L, Y - dir[1] * L);
      g.addColorStop(0, rgba(color, a));
      g.addColorStop(0.35, rgba(color, a * 0.7));
      g.addColorStop(1, rgba(color, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(X, Y);
      ctx.lineTo(X - dir[0] * L, Y - dir[1] * L);
      ctx.stroke();
    });
  }
  for (let i = 0; i < drops; i++) {
    const x = rng.next() * size, y = rng.next() * size, r = rng.range(0.6, 1.8);
    ctx.fillStyle = rgba(rng.chance(0.2) ? '#f2dca0' : color, rng.range(0.25, 0.7));
    wrap(x, y, r, (X, Y) => { ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill(); });
  }
  return canvas;
}

// The authored-space rectangle the current transform maps onto the canvas.
function visibleRect(ctx) {
  const m = ctx.getTransform().inverse();
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const pts = [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// A plane of falling rain.
//   z, speed (px/s along dir), dir (unit vector of the fall), alpha (number or t => number)
//   flash     extra brightness while lightning is up (0..1), read from strikes
// plus rainTile options. Returns the layer.
export function addRain(S, opts) {
  const o = {
    name: 'rain', z: 1500, size: 768, count: 220, len: [30, 80], width: [0.8, 1.6], alpha: [0.18, 0.4],
    dir: [-0.38, 0.925], color: '#dfe6f2', drops: 60, soft: 0, speed: 1400, flash: 0.6, strikes: [],
    seed: 'rain', opacity: 0.75, ...opts,
  };
  const tile = rainTile(o);
  let pattern = null;
  const base = typeof o.opacity === 'function' ? o.opacity : null;
  return S.add({
    name: o.name, z: o.z, tags: ['rain'],
    alpha: (t) => Math.min(1, (base ? base(t) : o.opacity) * (1 + o.flash * flashLevel(t, o.strikes))),
    render(ctx, t) {
      pattern ??= ctx.createPattern(tile, 'repeat');
      const d = (t * o.speed) % o.size;
      pattern.setTransform(new DOMMatrix().translateSelf(o.dir[0] * d, o.dir[1] * d));
      const r = visibleRect(ctx);
      ctx.fillStyle = pattern;
      ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    },
  });
}

// --- lightning bolt -----------------------------------------------------------------

// Jagged bolt from a to b by midpoint displacement, with a few forks.
//   rough     sideways jag as a fraction of each segment's length
//   forks     number of side branches
function boltGeometry(a, b, { rough = 0.28, depth = 6, forks = 3, seed = 'bolt' } = {}) {
  const rng = new RNG(seed);
  const split = (p, q, d, amt) => {
    if (d === 0) return [p, q];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const nx = -(q[1] - p[1]) / (L || 1), ny = (q[0] - p[0]) / (L || 1);
    const off = rng.range(-1, 1) * L * amt;
    const m = [mx + nx * off, my + ny * off];
    const left = split(p, m, d - 1, amt);
    return [...left.slice(0, -1), ...split(m, q, d - 1, amt)];
  };
  const main = split(a, b, depth, rough);
  const branches = [];
  for (let i = 0; i < forks; i++) {
    const k = Math.floor(rng.range(0.15, 0.7) * main.length);
    const p = main[k];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + rng.sign() * rng.range(0.35, 0.8);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * rng.range(0.18, 0.38);
    branches.push({ pts: split(p, [p[0] + Math.cos(ang) * L, p[1] + Math.sin(ang) * L], depth - 2, rough * 1.1), w: rng.range(0.35, 0.55), from: k / main.length });
  }
  return { main, branches };
}

// A polyline thickened into a tapering ribbon (w0 at the start, w1 at the end).
function taperRibbon(pts, w0, w1) {
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    const dx = q[0] - o[0], dy = q[1] - o[1], L = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    left.push([p[0] - (dy / L) * w, p[1] + (dx / L) * w]);
    right.push([p[0] + (dy / L) * w, p[1] - (dx / L) * w]);
  }
  return [...left, ...right.reverse()];
}

// Paint a paper bolt: a pale blue cut-out with a torn edge, a white core strip and a
// soft halo baked around it.
function paintBolt(ctx, geo, { width = 9, seed = 1 }) {
  const parts = [{ pts: geo.main, w: 1, from: 0 }, ...geo.branches];
  const k = ctx.__res || 1;
  ctx.save();
  ctx.filter = `blur(${10 * k}px)`;
  for (const p of parts) {
    ctx.fillStyle = rgba('#9fbaff', 0.55);
    ctx.fill(pathOf(taperRibbon(p.pts, width * 3.2 * p.w * (1 - p.from * 0.6), width * 0.8)));
  }
  ctx.restore();
  parts.forEach((p, i) => {
    const w0 = width * p.w * (1 - p.from * 0.6);
    const outer = tear(taperRibbon(p.pts, w0, Math.max(1.2, w0 * 0.18)), { amp: 1.2, freq: 0.25, fine: 0.6, seed: seed + i, step: 3 });
    setShadow(ctx, { color: 'rgba(120,150,255,0.9)', blur: 6, x: 0, y: 0 });
    ctx.fillStyle = '#c9dcff';
    ctx.fill(pathOf(outer));
    clearShadow(ctx);
    ctx.fillStyle = '#fbfdff';
    ctx.fill(pathOf(taperRibbon(p.pts, w0 * 0.42, Math.max(0.6, w0 * 0.08))));
  });
}

// Lightning: bolt planes inside the clouds, light blooming in the clouds around each
// bolt, and a cold flash over the whole frame.
//   strikes   [{ at, power, decay, restrike, bolt: { from, to, width, forks, seed } | null, glow: { x, y, r } }]
//   zBolt     depth of the bolts; zGlow: depth of the cloud light; zFlash: the frame flash
//   color     flash colour; flash: peak opacity of the frame flash
export function addLightning(S, opts) {
  const o = { zBolt: 6800, zGlow: 7000, zFlash: 430, color: '#a9c0ee', flash: 0.42, strikes: [], ...opts };
  const layers = [];
  o.strikes.forEach((k, i) => {
    if (!k.bolt) return;
    const geo = boltGeometry(k.bolt.from, k.bolt.to, { forks: k.bolt.forks ?? 3, seed: k.bolt.seed ?? `bolt${i}` });
    const xs = [...geo.main, ...geo.branches.flatMap((b) => b.pts)].map((p) => p[0]);
    const ys = [...geo.main, ...geo.branches.flatMap((b) => b.pts)].map((p) => p[1]);
    const pad = 60;
    const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    const s = S.sprite({
      name: `bolt${i}`, ...box, mat: [{ tex: 'fiber', amt: 0.4 }], edge: false, shadow: false,
      draw: (ctx) => paintBolt(ctx, geo, { width: k.bolt.width ?? 9, seed: i * 13 + 1 }),
    });
    // The bolt itself only shows for its own strike, a little shorter than the light.
    const env = (t) => strikeEnvelope(t, { ...k, power: 1, decay: k.boltDecay ?? (k.decay ?? 0.05) * 0.8 });
    layers.push(S.add({ name: `bolt${i}`, z: o.zBolt, tags: ['cloud'], sprites: [{ s }], alpha: env }));
  });
  // Light inside the clouds: an additive bloom around each strike's glow point.
  layers.push(S.add({
    name: 'lightning-glow', z: o.zGlow, blend: 'lighter', tags: ['cloud'],
    render(ctx, t) {
      for (const k of o.strikes) {
        const e = strikeEnvelope(t, k);
        if (e < 0.004 || !k.glow) continue;
        drawGlow(ctx, k.glow.x, k.glow.y, k.glow.r, '#b8ccff', e * 0.8, { falloff: 'wide' });
      }
    },
  }));
  // The cold flash over everything (screen blend keeps it a light, not a white-out).
  layers.push(S.add({
    name: 'lightning-flash', z: o.zFlash, blend: 'screen',
    alpha: (t) => flashLevel(t, o.strikes) * o.flash,
    render(ctx) {
      ctx.fillStyle = mix(o.color, '#ffffff', 0.15);
      ctx.fillRect(-W, -H, W * 3, H * 3);
    },
  }));
  return layers;
}
