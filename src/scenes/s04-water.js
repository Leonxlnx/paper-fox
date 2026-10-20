// s04 water extras: the torn white foam bands hugging the boulders and the falls' feet,
// and the long flowing swirl strips laid over the river (ref04).
//
// ref04's white water is not a heap of round puffs: it is cut as continuous torn white
// bands and crescents, ragged crests on top, a pale blue under-layer, blue creases inside
// and thin white tails trailing downstream. Each band is baked once and only breathes.

import { RNG } from '../core/rng.js';
import { piece, pathOf, linear } from '../core/piece.js';
import { drawSprites } from '../core/sprite.js';
import { mix, rgba } from '../core/color.js';
import { TAU } from '../core/geom.js';
import { WATER } from '../elements/water.js';
import { LIGHT } from './s04-kit.js';

const MAT = [{ tex: 'crumple', amt: 0.55, scale: 0.3 }, { tex: 'fiber', amt: 0.45 }];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Centre line of a band: a quadratic arc through (x, y - bend) at its middle.
function centre({ x, y, w, bend = 0, skew = 0, tilt = 0 }) {
  const P0 = [x - w / 2, y - (tilt * w) / 2], P2 = [x + w / 2, y + (tilt * w) / 2], P1 = [x + skew, y - 2 * bend];
  return (s) => {
    const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    return [a * P0[0] + b * P1[0] + c * P2[0], a * P0[1] + b * P1[1] + c * P2[1]];
  };
}

// A tapered strip following f(s) for s in [s0, s1], offset dy, th thick.
function along(f, s0, s1, dy, th, n = 18, taper = 0.7) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, s = s0 + (s1 - s0) * k, [px, py] = f(s);
    const t = th * Math.pow(Math.sin(Math.PI * k), taper);
    top.push([px, py + dy - t * 0.5]);
    bot.push([px, py + dy + t * 0.5]);
  }
  return [...top, ...bot.reverse()];
}

// The outline of a band: ragged crests above the centre line, a smooth belly below.
function bandPts(it, crests, { up = 1, down = 1, dy = 0 } = {}) {
  const f = centre(it);
  const n = Math.max(16, Math.round(it.w / 5));
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, [px, py] = f(s);
    const env = Math.pow(Math.sin(Math.PI * s), 0.55);
    // Rounded billows (not spikes): each crest a dome, valleys pinched between them.
    let crest = 0;
    for (const c of crests) {
      const d = Math.abs(s - c.s) / c.wd;
      if (d < 1) crest = Math.max(crest, c.ht * Math.pow(1 - d * d, 0.6));
    }
    const u = it.h * (0.32 + 0.04 * Math.sin(s * 9 + it.x * 0.01) + 0.8 * crest) * env * up;
    top.push([px, py - u + dy]);
    bot.push([px, py + it.h * (0.22 + 0.05 * Math.sin(s * 13 + it.y * 0.02)) * Math.pow(env, 0.8) * down + dy]);
  }
  return [...top, ...bot.reverse()];
}

function drawBand(ctx, it, rng, pal, light, { tails = true, under = true } = {}) {
  const f = centre(it);
  const nc = Math.max(2, Math.round((it.w / 34) * (it.crests ?? 1)));
  const crests = [];
  for (let i = 0; i < nc; i++) crests.push({ s: clamp((i + 0.5 + rng.range(-0.3, 0.3)) / nc, 0.06, 0.94), wd: rng.range(0.6, 0.85) / nc + 0.03, ht: rng.range(0.4, 0.9) });
  const shadow = (a, b) => ({ color: rgba(pal.shadow, a), blur: b, x: -light[0] * 2, y: 2.4 });
  // Trailing white tails and pale strips: the water streaming on past the foam.
  if (tails) {
    const nt = Math.max(2, Math.round(it.w / 60));
    for (let i = 0; i < nt; i++) {
      const s0 = rng.range(-0.1, 0.55), s1 = s0 + rng.range(0.35, 0.8);
      piece(ctx, along(f, s0, s1, it.h * rng.range(0.42, 1.0), rng.range(2, 4.5) * (it.h / 26 + 0.4), 18, 0.8), {
        fill: rng.chance(0.55) ? pal.foam : mix(pal.pale, pal.foam, 0.4), torn: { amp: 0.6, freq: 0.2, fine: 0.4, seed: rng.int(1, 1e6), step: 3 },
        shadow: shadow(0.35, 2), bevel: { light, width: 1, hi: 0.4, lo: 0.1, hiColor: '#ffffff' },
      });
    }
  }
  // Pale blue back layer peeking above and beside the white crests (their shaded side).
  if (under) {
    piece(ctx, bandPts({ ...it, x: it.x + it.w * 0.03, w: it.w * 0.97 }, crests, { up: 1.18, down: 0.6, dy: -it.h * 0.05 }), {
      fill: mix(pal.pale, pal.light, 0.4), torn: { amp: 1.3, freq: 0.16, fine: 0.8, seed: rng.int(1, 1e6), step: 2 },
      shadow: shadow(0.45, 4), bevel: { light, width: 1, hi: 0.35, lo: 0.12, hiColor: '#ffffff' },
    });
  }
  // The white band itself.
  piece(ctx, bandPts(it, crests), {
    fill: linear(ctx, 0, it.y - it.h * 1.2, 0, it.y + it.h * 0.4, ['#ffffff', '#fbfdff', pal.foam, mix(pal.foam, pal.foamShade, 0.4)]),
    torn: { amp: 1.5, freq: 0.18, fine: 0.8, seed: rng.int(1, 1e6), step: 2 },
    shadow: shadow(0.4, 3.5), bevel: { light, width: 1.3, hi: 0.55, lo: 0.14, hiColor: '#ffffff', soft: 0.4 },
  });
  // Blue creases inside the white, following the curve.
  const nk = Math.max(1, Math.round(it.w / 70));
  for (let i = 0; i < nk; i++) {
    const s0 = rng.range(0.05, 0.5), s1 = Math.min(0.97, s0 + rng.range(0.25, 0.5));
    piece(ctx, along(f, s0, s1, it.h * rng.range(-0.05, 0.2), rng.range(1.4, 3) * (it.h / 30 + 0.5), 16, 0.9), {
      fill: rng.chance(0.5) ? pal.foamShade : mix(pal.pale, pal.foamShade, 0.5), torn: { amp: 0.4, freq: 0.2, fine: 0.3, seed: rng.int(1, 1e6), step: 3 },
    });
  }
}

// One foam band (with an optional second, smaller crest layer piled on top of it).
function drawFoamBand(ctx, it, pal, light, seed) {
  const rng = new RNG(seed);
  drawBand(ctx, it, rng, pal, light);
  if (it.pile) {
    const sub = { ...it, x: it.x + it.w * rng.range(-0.12, 0.12), y: it.y - it.h * 0.42, w: it.w * rng.range(0.5, 0.66), h: it.h * 0.72, bend: (it.bend ?? 0) * 0.5 + it.h * 0.1 };
    drawBand(ctx, sub, rng, pal, light, { tails: false });
  }
}

// Foam bands as one animated layer: each band breathes on its own cycle, spray droplets
// rise from the crests and fall back.
//   items  [{ x, y, w, h, bend, skew, tilt, pile, crests }] (y = the band's waterline)
export function addFoamBands(S, { z, name = 'foam-bands', items, palette = WATER.canyon, seed = 's04-foam', spray = 1 }) {
  const rng = new RNG(seed);
  const L = LIGHT;
  const parts = items.map((it, i) => {
    const b = Math.abs(it.bend ?? 0) + (Math.abs(it.tilt ?? 0) * it.w) / 2;
    const x0 = it.x - it.w * 0.62 - 20, y0 = it.y - b - it.h * (it.pile ? 2.6 : 1.9) - 14;
    const s = S.sprite({
      name: `${name}-${i}`, x: x0, y: y0, w: it.w * 1.24 + 40, h: it.y + b + it.h * 1.6 + 18 - y0,
      res: 1.25, mat: MAT, edge: { width: 1.1, hi: 0.35, lo: 0.14 }, shadow: { blur: 4, alpha: 0.38 },
      draw: (ctx) => drawFoamBand(ctx, it, palette, L, rng.int(1, 1e6)),
    });
    return { s, ax: it.x, ay: it.y + it.h * 0.3, p1: rng.range(1.6, 2.6), p2: rng.range(2.4, 3.8), ph: rng.next() };
  });
  const drops = [];
  for (const it of items) {
    const n = Math.round((it.w / 18) * spray);
    for (let i = 0; i < n; i++) {
      drops.push({ x: it.x + rng.range(-0.42, 0.42) * it.w, y: it.y - it.h * 0.5, vx: rng.range(-1, 1) * it.w * 0.12, up: rng.range(0.6, 1.6) * it.h, r: rng.range(0.7, 1.9), period: rng.range(0.9, 1.7), ph: rng.next() });
    }
  }
  const dot = S.sprite({
    name: `${name}-spray`, x: -3, y: -3, w: 6, h: 6, mat: 'none', edge: false, shadow: false,
    draw: (ctx) => { ctx.fillStyle = palette.foam; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); },
  });
  const sh = { dx: -L[0] * 3, dy: -L[1] * 3, alpha: 0.4 };
  return [S.add({
    name, z,
    render(ctx, t) {
      drawSprites(ctx, parts.map((p) => {
        const a = TAU * (t / p.p1 + p.ph), b = TAU * (t / p.p2 + p.ph * 1.7);
        return { s: p.s, ax: p.ax, ay: p.ay, sx: 1 + 0.012 * Math.sin(b), sy: 1 + 0.05 * Math.sin(a) };
      }), sh);
      const base = ctx.globalAlpha;
      for (const d of drops) {
        const f = (((t / d.period + d.ph) % 1) + 1) % 1;
        ctx.globalAlpha = base * Math.sin(Math.PI * f) * 0.9;
        ctx.drawImage(dot.canvas, d.x + d.vx * f - d.r, d.y - d.up * 4 * f * (1 - f) - d.r, d.r * 2, d.r * 2);
      }
      ctx.globalAlpha = base;
    },
  })];
}

// --- long flowing strips over the river -------------------------------------------------

// Perspective scale of the water at screen height y (far reach small, near big).
const persp = (y) => clamp(0.36 + ((y - 540) / 540) * 1.0, 0.32, 1.4);

// A tapered strip along a polyline (offset `off` px to its left normal).
function polyStrip(pts, th, off = 0) {
  const top = [], bot = [];
  const n = pts.length - 1;
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const t = th * Math.pow(Math.sin((Math.PI * i) / n), 0.7);
    const [px, py] = pts[i];
    top.push([px + nx * (off - t * 0.5), py + ny * (off - t * 0.5)]);
    bot.push([px + nx * (off + t * 0.5), py + ny * (off + t * 0.5)]);
  }
  return [...top, ...bot.reverse()];
}

// Strip kinds from the thick blue underlay to the thin white top strips.
const KINDS = [
  { col: (p) => p.mid, th: [6, 12], len: [160, 420], share: 0.3 },
  { col: (p) => p.light, th: [4.5, 9], len: [140, 440], share: 0.36 },
  { col: (p) => p.pale, th: [3, 6], len: [110, 380], share: 0.22 },
  { col: (p) => p.white, th: [2, 4], len: [100, 340], share: 0.12, rim: true },
];

function drawStrips(ctx, region, pal, light, rng) {
  ctx.save();
  ctx.clip(region.clip);
  const strips = KINDS.map(() => []);
  // Lanes: gently waving lines across the water, rising to the right (the current sweeps
  // in from the upper right and swings toward the lower left).
  for (let y = region.y0; y < region.y1; y += (7 + 20 * persp(y)) * rng.range(0.8, 1.2)) {
    const sc = persp(y);
    const [x0, x1] = region.span(y);
    const A = (5 + 16 * sc) * rng.range(0.5, 1.2), lam = rng.range(260, 560) * sc, ph = rng.range(0, TAU), slope = region.slope + rng.range(-0.04, 0.04);
    const laneY = (x) => y + A * Math.sin((TAU * (x - x0)) / lam + ph) + slope * (x - region.pivot);
    const n = Math.round(((x1 - x0) / (95 * sc)) * region.density);
    for (let i = 0; i < n; i++) {
      let r = rng.next(), k = 0;
      while (k < KINDS.length - 1 && r > KINDS[k].share) { r -= KINDS[k].share; k++; }
      const K = KINDS[k];
      const L = rng.range(K.len[0], K.len[1]) * sc, sx = rng.range(x0 - L * 0.5, x1);
      const off = rng.range(-0.5, 0.5) * (7 + 20 * sc);
      const pts = [];
      for (let x = sx; x <= sx + L; x += 8) pts.push([x, laneY(x) + off]);
      if (pts.length < 3) continue;
      strips[k].push({ pts, th: rng.range(K.th[0], K.th[1]) * sc, K });
    }
  }
  // Open spirals where the current turns between the rocks.
  for (const sw of region.swirls ?? []) {
    const sc = persp(sw.y);
    for (let j = 0; j < 4; j++) {
      const r0 = sw.r * (0.35 + 0.24 * j), a0 = rng.range(0, TAU), sweep = rng.range(1.1, 1.8) * Math.PI;
      const pts = [];
      for (let a = 0; a <= sweep; a += 0.12) {
        const rr = r0 * (1 + 0.28 * (a / sweep));
        pts.push([sw.x + Math.cos(a0 + a) * rr, sw.y + Math.sin(a0 + a) * rr * 0.36]);
      }
      const k = j % 2 ? 3 : 2;
      strips[k].push({ pts, th: rng.range(2.4, 4.6) * sc, K: KINDS[k] });
    }
  }
  strips.forEach((list) => {
    for (const s of list) {
      piece(ctx, polyStrip(s.pts, s.th), {
        fill: s.K.col(pal), torn: { amp: 0.5, freq: 0.18, fine: 0.3, seed: rng.int(1, 1e6), step: 4 },
        shadow: { color: rgba(pal.shadow, 0.42), blur: 2.2, x: -light[0] * 1.6, y: 1.8 },
        bevel: { light, width: 1, hi: s.K.rim ? 0.5 : 0.32, lo: 0.12, hiColor: '#ffffff' },
      });
    }
  });
  ctx.restore();
}

// regions: [{ clip (Path2D) or shape (polygon), box: [x, y, w, h], y0, y1, span: (y) => [x0, x1],
//            slope, pivot, density, swirls: [{ x, y, r }] }]
export function addFlowStrips(S, { z, regions, palette, seed = 's04-flow', drift = 3 }) {
  const rng = new RNG(seed);
  const pal = { white: '#eef6fd', ...palette };
  const sprites = regions.map((rg, i) => {
    const region = { slope: -0.07, pivot: 1400, density: 1, ...rg, clip: rg.clip ?? pathOf(rg.shape) };
    const [x, y, w, h] = region.box;
    return S.sprite({ name: `river-flow-${i}`, x, y, w, h, mat: 'smooth', edge: false, shadow: false, draw: (ctx) => drawStrips(ctx, region, pal, LIGHT, rng.fork(`r${i}`)) });
  });
  return [S.add({
    name: 'river-flow', z,
    render(ctx, t) {
      // A slow sway along the current; zero offset at the camera rest pose (t = 4.25).
      const k = Math.sin((TAU * (t - 4.25)) / 4.25);
      for (const s of sprites) ctx.drawImage(s.canvas, s.x - k * drift, s.y + k * drift * 0.4, s.w, s.h);
    },
  })];
}
