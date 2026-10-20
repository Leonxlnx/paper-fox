// Paper flowers: coneflower (echinacea), daisy, tansy, astilbe and lupine.
// Every function paints flat pieces in authored coordinates, so it can be used inside
// any sprite's draw(ctx). Colours come from a flora palette (see flora-kit.js).

import { RNG } from '../core/rng.js';
import { piece } from '../core/piece.js';
import { blob, ellipse, transform, along, TAU } from '../core/geom.js';
import { mix, shade, rgba, adjust } from '../core/color.js';
import {
  DEFAULT_LIGHT, floraPalette, foldedBlade, feltDots, shadeOver, bevelOf, linearAlong,
  drawStem, curve, creaseLine,
} from './flora-kit.js';

// --- Coneflower ------------------------------------------------------------------------

// Petal layout of a coneflower head. The paper flowers in the references are built as
// a fan: the main petals hang in an arc below the cone (from just above horizontal on
// one side, through straight down, to the other side) and a few shorter back petals
// peek out above it. Petals nearer the front of the fan are broader and lie on top.
function coneflowerLayout({ size, petals, back, spread, roll }, r) {
  const list = [];
  const a0 = Math.PI / 2 - spread / 2;
  for (let i = 0; i < petals; i++) {
    const u = petals === 1 ? 0.5 : i / (petals - 1);
    const ang = a0 + spread * u + r.range(-0.07, 0.07) + roll;
    const front = 1 - Math.abs(u - 0.5) * 2;             // 1 at the bottom of the fan
    list.push({ ang, front, len: size * (1 - 0.1 * front) * r.range(0.9, 1.04), w: 0.72 + 0.28 * front, order: front + r.range(-0.25, 0.25) });
  }
  // Back petals continue the fan above the horizontal on both sides, half hidden by the cone.
  for (let i = 0; i < back; i++) {
    const left = i % 2 === 0;
    const step = Math.floor(i / 2) + 1;
    const ang = (left ? a0 + spread + 0.32 * step : a0 - 0.32 * step) + r.range(-0.1, 0.1) + roll;
    list.push({ ang, front: -1, len: size * r.range(0.72, 0.9), w: 0.7, order: -2 + r.next() * 0.1 });
  }
  return list.sort((p, q) => p.order - q.order);
}

// The fan of drooping petals of a coneflower, without the cone.
//   x, y    centre of the petal ring (where the cone sits)
//   size    petal length in px      width  petal half-width as a fraction of size
//   petals  petals in the hanging fan (8-10)    back  short petals behind the cone
//   spread  angular span of the fan, radians    roll  head rotation
export function drawEchinaceaPetals(ctx, o = {}) {
  const { x = 0, y = 0, size = 110, petals = 8, back = 2, spread = 3.4, roll = 0, width = 0.27, seed = 1, light = DEFAULT_LIGHT } = o;
  const P = floraPalette(o.palette).echinacea;
  const r = new RNG(seed);
  const ring = size * 0.12;
  const last = P.petals.length - 1;
  for (const p of coneflowerLayout({ size, petals, back, spread, roll }, r)) {
    // Front petals face up into the light: pinker and lighter. Side and back ones purpler.
    const k = Math.max(0, Math.min(last, Math.round(((p.front + 1) / 2) ** 1.6 * last + r.range(-0.8, 0.8))));
    const col = adjust(P.petals[k], { l: r.range(-0.035, 0.03), h: r.range(-0.012, 0.012) });
    const bx = x + Math.cos(p.ang) * ring, by = y + Math.sin(p.ang) * ring * 0.6;
    const tx = bx + Math.cos(p.ang) * p.len, ty = by + Math.sin(p.ang) * p.len;
    // Broad spatulate petals with blunt, often notched tips.
    foldedBlade(ctx, p.len, size * width * p.w,
      { base: 0.28, belly: 0.64, round: 0.5, tip: 0.3, curl: r.range(-0.06, 0.06), notch: r.chance(0.6) ? r.range(0.04, 0.08) : 0, skew: r.range(-0.1, 0.1), n: 18 },
      { x: bx, y: by, rot: p.ang + Math.PI / 2 },
      {
        fill: linearAlong(ctx, [bx, by], [tx, ty], [mix(col, P.petalDark, 0.45), col, col, mix(col, P.petalLight, 0.18)]),
        light,
        shadow: { color: 'rgba(40,0,24,0.45)', blur: 4, x: -light[0] * 1.5, y: 2.5 },
        dark: 0.2, lift: 0.06, crease: 0.34,
        bevel: { width: 1.3, hi: 0.28, lo: 0.26, soft: 0.4 },
      });
  }
  // The raised cone shades the petal bases.
  const coneW = size * 0.66;
  shadeOver(ctx, x, y + coneW * 0.08, coneW * 0.75, coneW * 0.36, 0.55, '#2a0418');
}

// The raised felt cone: a bumpy dome with a quilled spiral on top.
//   x, y  centre of the cone's base     w, h  width and dome height     tilt as above
export function drawConeflowerCone(ctx, o = {}) {
  const { x = 0, y = 0, w = 72, tilt = 0.55, roll = 0, seed = 1, light = DEFAULT_LIGHT, turns = 4.2 } = o;
  const h = o.h ?? w * 0.64;
  const P = floraPalette(o.palette).echinacea;
  const r = new RNG(seed);
  const rx = w / 2, ryb = rx * Math.sin(tilt) * 0.55;
  const local = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI + (i / N) * Math.PI;  // upper dome, left to right
    const s = Math.sin(th);
    local.push([rx * Math.cos(th), -h * Math.pow(Math.abs(s), 0.72)]);
  }
  for (let i = 1; i < N; i++) {
    const th = (i / N) * Math.PI;            // base, right to left
    local.push([rx * Math.cos(th), ryb * Math.sin(th)]);
  }
  const pts = transform(local, { x, y, rot: roll });
  const hx = x + light[0] * rx * 0.3, hy = y - h * 0.62 + light[1] * h * 0.18;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, w * 0.86);
  g.addColorStop(0, P.coneLight);
  g.addColorStop(0.5, P.cone);
  g.addColorStop(0.85, mix(P.cone, P.coneDark, 0.4));
  g.addColorStop(1, P.coneDark);
  const path = piece(ctx, pts, {
    fill: g,
    torn: { amp: w * 0.012, freq: 0.32, fine: w * 0.008, seed: r.int(1, 1e6), step: 2.5 },
    shadow: { color: 'rgba(40,6,0,0.5)', blur: 5, x: -light[0] * 2, y: 3 },
  });
  ctx.save();
  ctx.clip(path);
  // Quilled spiral: a groove with a lit ridge beside it, centred on the dome's crown.
  const cx = x + rx * r.range(-0.05, 0.08), cy = y - h * 0.6;
  const spiral = [];
  const steps = Math.round(turns * 48);
  const a0 = r.range(0, TAU);
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const a = a0 + s * turns * TAU;
    const rr = 0.06 + s * 1.15;
    spiral.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * h * 0.5 * rr]);
  }
  const sp = new Path2D();
  spiral.forEach(([px, py], i) => (i ? sp.lineTo(px, py) : sp.moveTo(px, py)));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.filter = `blur(${w * 0.006 * (ctx.__res || 1)}px)`;
  ctx.strokeStyle = rgba(P.coneDark, 0.38);
  ctx.lineWidth = w * 0.032;
  ctx.stroke(sp);
  ctx.translate(light[0] * w * 0.02, light[1] * w * 0.02);
  ctx.strokeStyle = rgba(P.coneLight, 0.45);
  ctx.lineWidth = w * 0.022;
  ctx.stroke(sp);
  ctx.filter = 'none';
  ctx.restore();
  // Underside of the dome falls into shade.
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = linearAlong(ctx, [x, y - h * 0.3], [x, y + ryb], [rgba(P.coneDark, 0), rgba('#5a1800', 0.38)]);
  ctx.fillRect(x - rx - 4, y - h, w + 8, h + ryb + 4);
  ctx.restore();
  feltDots(ctx, path, { cx: x, cy: y - h * 0.45, rx: rx * 1.05, ry: h * 0.65, n: Math.round(w * w * 0.06), size: w * 0.016, light, hi: '#ffd08a', lo: '#5a1a00', alpha: 0.22, seed: r.int(1, 1e6) });
  bevelOf(ctx, path, light, { width: 1.6, hi: 0.35, lo: 0.3, soft: 0.6, hiColor: '#ffe2b0' });
  return path;
}

// Whole coneflower head (petals + cone) for static use. In animated beds the two are
// baked separately so the felt cone gets its own material.
export function drawEchinacea(ctx, o = {}) {
  drawEchinaceaPetals(ctx, o);
  const size = o.size ?? 110;
  drawConeflowerCone(ctx, { ...o, w: o.coneW ?? size * 0.66, seed: (o.seed ?? 1) + 7 });
}

// --- Daisy --------------------------------------------------------------------------------

// White daisy / anemone: broad round-tipped petals around a yellow felt centre.
//   r       flower radius in px     petals  8 (daisy) or 5 (wood anemone, ref03)
//   squash  vertical flattening of the tilted face (1 = facing the camera)
//   rot     petal ring rotation     center  centre radius as a fraction of r
export function drawDaisy(ctx, o = {}) {
  const { x = 0, y = 0, r = 28, petals = 8, squash = 0.88, rot = 0, center = 0.27, seed = 1, light = DEFAULT_LIGHT } = o;
  const P = floraPalette(o.palette).daisy;
  const rng = new RNG(seed);
  const broad = petals <= 6 ? 0.44 : 0.33 * Math.min(1, 8.5 / petals);
  const list = [];
  for (let i = 0; i < petals; i++) {
    const a = rot + (i / petals) * TAU + rng.range(-0.1, 0.1);
    list.push({ a, len: r * rng.range(0.86, 1.02), wid: r * broad * rng.range(0.9, 1.1), curl: rng.range(-0.06, 0.06), tone: rng.range(-0.03, 0.03) });
  }
  // Petals pointing up sit behind the centre on a tilted face: draw them first.
  list.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
  for (const p of list) {
    const back = Math.sin(p.a) < 0;
    const col = adjust(P.petal, { l: p.tone - (back ? 0.04 : 0) });
    const bx = x + Math.cos(p.a) * r * 0.1, by = y + Math.sin(p.a) * r * 0.1 * squash;
    const tx = x + Math.cos(p.a) * (p.len + r * 0.1), ty = y + Math.sin(p.a) * (p.len + r * 0.1) * squash;
    foldedBlade(ctx, p.len, p.wid, { base: 0.38, belly: 0.55, round: 0.85, curl: p.curl, skew: rng.range(-0.08, 0.08), n: 14 },
      { x: bx, y: by, rot: p.a + Math.PI / 2, squash },
      {
        fill: linearAlong(ctx, [bx, by], [tx, ty], [mix(col, P.shade, 0.6), col, P.tip]),
        light,
        shadow: { color: 'rgba(30,20,50,0.38)', blur: 3, x: -light[0] * 1.2, y: 2 },
        dark: 0.1, lift: 0.06, crease: 0.18,
        bevel: { width: 1, hi: 0.25, lo: 0.24, soft: 0.3 },
      });
  }
  shadeOver(ctx, x, y + r * 0.04, r * center * 2.1, r * center * 1.9 * squash, 0.32, '#2a2040');
  // Felt centre: a small dome.
  const cr = r * center;
  const cpts = blob(x, y, cr, cr * (0.75 + squash * 0.2), rng.fork('c'), { n: 22, irregular: 0.06 });
  const hx = x + light[0] * cr * 0.4, hy = y + light[1] * cr * 0.4;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, cr * 1.5);
  g.addColorStop(0, shade(P.center, 0.3));
  g.addColorStop(0.45, P.center);
  g.addColorStop(1, P.centerDark);
  const path = piece(ctx, cpts, { fill: g, smooth: true, shadow: { color: 'rgba(60,30,0,0.5)', blur: 3, x: -light[0] * 1.2, y: 1.6 } });
  feltDots(ctx, path, { cx: x, cy: y, rx: cr, ry: cr, n: Math.round(cr * cr * 1.6), size: Math.max(0.45, cr * 0.07), light, hi: '#fff0a0', lo: '#6a3a00', alpha: 0.22, seed: rng.int(1, 1e6) });
  bevelOf(ctx, path, light, { width: 1, hi: 0.35, lo: 0.3, soft: 0.3 });
}

// --- Tansy / billy button ---------------------------------------------------------------

// A yellow felt ball on a little green calyx.
export function drawTansy(ctx, o = {}) {
  const { x = 0, y = 0, r = 18, seed = 1, light = DEFAULT_LIGHT } = o;
  const P = floraPalette(o.palette);
  const T = P.tansy;
  const rng = new RNG(seed);
  // Calyx
  const calyx = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 4));
    calyx.push(transform([[0, 0], [-r * 0.12, -r * 0.3], [0, -r * 0.42], [r * 0.12, -r * 0.3]], { x, y: y + r * 0.72, rot: a - Math.PI / 2 + Math.PI }));
  }
  for (const c of calyx) piece(ctx, c, { fill: shade(P.stem, -0.1) });
  const pts = blob(x, y, r, r * 0.96, rng, { n: 30, irregular: 0.035 });
  const hx = x + light[0] * r * 0.38, hy = y + light[1] * r * 0.38;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 1.5);
  g.addColorStop(0, T.light);
  g.addColorStop(0.5, T.ball);
  g.addColorStop(0.88, mix(T.ball, T.dark, 0.55));
  g.addColorStop(1, T.dark);
  const path = piece(ctx, pts, {
    fill: g,
    torn: { amp: r * 0.025, freq: 0.7, fine: r * 0.02, seed: rng.int(1, 1e6), step: 2 },
    shadow: { color: 'rgba(50,30,0,0.5)', blur: 4, x: -light[0] * 1.5, y: 2.5 },
  });
  feltDots(ctx, path, { cx: x, cy: y, rx: r, ry: r, n: Math.round(r * r * 1.7), size: r * 0.05, light, hi: '#fff6c0', lo: '#7a4a00', alpha: 0.2, seed: rng.int(1, 1e6) });
  bevelOf(ctx, path, light, { width: 1.4, hi: 0.35, lo: 0.32, soft: 0.6, hiColor: '#fff4c8' });
}

// --- Marigold -----------------------------------------------------------------------------

// Ruffled yellow pompom (ref01): short frilled petals packed in a sunflower spiral, from
// the rim inward, so inner petals sit higher on the dome and overlap the outer ones.
export function drawMarigold(ctx, o = {}) {
  const { x = 0, y = 0, r = 40, squash = 0.9, seed = 1, light = DEFAULT_LIGHT } = o;
  const P = floraPalette(o.palette).marigold;
  const rng = new RNG(seed);
  const base = blob(x, y, r * 0.95, r * 0.95 * squash, rng, { n: 24, irregular: 0.06 });
  piece(ctx, base, { fill: P.dark, smooth: true, shadow: { color: 'rgba(60,30,0,0.5)', blur: 5, x: -light[0] * 2, y: 3 } });
  const len = r * 0.36;
  const count = Math.round(r * 1.5);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = count - 1; i >= 0; i--) {
    const k = i / count;                          // 0 at the crown, 1 at the rim
    const rr = r * Math.sqrt(k) * 0.98 + len * 0.15;
    const a = i * golden + rng.range(-0.15, 0.15);
    const l = len * rng.range(0.8, 1.1) * (0.6 + 0.4 * Math.sqrt(k));
    const bx = x + Math.cos(a) * Math.max(0, rr - l), by = y + Math.sin(a) * Math.max(0, rr - l) * squash;
    const tx = x + Math.cos(a) * rr, ty = y + Math.sin(a) * rr * squash;
    // Dome lighting: petals on the lit side of the ball and on its crown are brighter.
    const lit = 0.5 + 0.5 * (Math.cos(a) * light[0] + Math.sin(a) * light[1]) * Math.sqrt(k);
    const col = mix(mix(P.petal, P.dark, 0.4 * (1 - lit)), P.light, Math.max(0, lit - 0.5) * 0.9 + (1 - k) * 0.2 + rng.range(-0.05, 0.05));
    foldedBlade(ctx, l, l * 0.55, { base: 0.55, belly: 0.5, round: 0.9, notch: rng.chance(0.5) ? 0.14 : 0, curl: rng.range(-0.15, 0.15), n: 10 },
      { x: bx, y: by, rot: a + Math.PI / 2, squash },
      {
        fill: linearAlong(ctx, [bx, by], [tx, ty], [mix(col, P.dark, 0.5), col, shade(col, 0.1)]),
        light,
        shadow: { color: 'rgba(90,30,0,0.5)', blur: 2.2, x: -light[0], y: 1.4 },
        dark: 0.2, lift: 0.08, crease: 0.3,
        bevel: { width: 0.8, hi: 0.3, lo: 0.3 },
      });
  }
}

// --- Zinnia -------------------------------------------------------------------------------

// Layered star of pointed red petals with a small dark heart (ref01).
export function drawZinnia(ctx, o = {}) {
  const { x = 0, y = 0, r = 40, squash = 0.85, layers = 3, petals = 10, rot = 0, seed = 1, light = DEFAULT_LIGHT } = o;
  const P = floraPalette(o.palette).zinnia;
  const rng = new RNG(seed);
  for (let k = 0; k < layers; k++) {
    const rr = r * (1 - k * 0.22);
    const a0 = rot + k * (Math.PI / petals) + rng.range(-0.1, 0.1);
    const ring = Array.from({ length: petals }, (_, i) => a0 + (i / petals) * TAU + rng.range(-0.1, 0.1)).sort((a, b) => Math.sin(a) - Math.sin(b));
    for (const a of ring) {
      const len = rr * rng.range(0.85, 1.02);
      const col = adjust(P.petals[Math.min(P.petals.length - 1, k + rng.int(0, 1))], { l: rng.range(-0.04, 0.04) });
      const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len * squash;
      foldedBlade(ctx, len, len * 0.28, { base: 0.25, belly: 0.55, taper: 1.5, notch: rng.chance(0.5) ? 0.08 : 0, curl: rng.range(-0.08, 0.08), n: 12 },
        { x, y, rot: a + Math.PI / 2, squash },
        {
          fill: linearAlong(ctx, [x, y], [tx, ty], [P.dark, col, shade(col, 0.1)]),
          light,
          shadow: { color: 'rgba(60,0,10,0.45)', blur: 3, x: -light[0] * 1.2, y: 2 },
          dark: 0.22, lift: 0.08, crease: 0.32,
          bevel: { width: 1, hi: 0.28, lo: 0.26, soft: 0.3 },
        });
    }
  }
  const cr = r * 0.17;
  const path = piece(ctx, blob(x, y, cr, cr * squash, rng, { n: 14, irregular: 0.1 }), { fill: P.center, smooth: true, shadow: { color: 'rgba(60,0,10,0.5)', blur: 3, x: -light[0], y: 1.5 } });
  feltDots(ctx, path, { cx: x, cy: y, rx: cr, ry: cr, n: Math.round(cr * cr * 1.4), size: Math.max(0.5, cr * 0.12), light, hi: '#ffe080', lo: '#4a0a00', alpha: 0.3, seed: rng.int(1, 1e6) });
}

// --- Astilbe ------------------------------------------------------------------------------

// A tapered, branched plume of tiny crimson florets on a thin stem.
//   x, y   stem base       h  total height     w  plume width at its base
//   lean   top offset as a fraction of h       plume  fraction of h covered by florets
export function drawAstilbe(ctx, o = {}) {
  const { x = 0, y = 0, h = 150, w = 64, lean = 0, plume = 0.62, bow = 0, seed = 1, light = DEFAULT_LIGHT, stem = true } = o;
  const P = floraPalette(o.palette).astilbe;
  const rng = new RNG(seed);
  const top = [x + lean * h, y - h];
  const axis = curve([x, y], top, bow * h, 24);
  if (stem) drawStem(ctx, axis, { width: Math.max(1.6, w * 0.05), tipWidth: 1, color: mix(P.stem, '#6a7a34', 0.35), light, seed: rng.int(1, 1e6) });
  const florets = [];
  const fs = w * 0.048 + 1.7;
  const branches = Math.max(5, Math.round((plume * h) / Math.max(w * 0.11, fs * 2.4)));
  let side = rng.sign();
  for (let k = 0; k < branches; k++) {
    const s = k / (branches - 1);
    const { p, ang } = along(axis, 1 - plume + plume * s * 0.9);
    side = -side;
    const len = w * 0.5 * Math.pow(1 - s, 0.85) * rng.range(0.72, 1.06) + w * 0.05;
    // Branches leave the axis upward and outward, bending up at the ends.
    const bAng = ang + side * rng.range(0.6, 1.0);
    const end = [p[0] + Math.cos(bAng) * len, p[1] + Math.sin(bAng) * len];
    const twig = curve(p, end, side * len * 0.14, 6);
    drawStem(ctx, twig, { width: Math.max(1, w * 0.02), tipWidth: 0.6, color: P.stem, light, shadow: false, seed: k });
    // Florets gather in tight clusters along each twig, the biggest at its tip.
    const clusters = Math.max(1, Math.round(len / (fs * 3.2)));
    for (let c = 0; c < clusters; c++) {
      const t = clusters === 1 ? 1 : 0.35 + 0.65 * (c / (clusters - 1));
      const q = along(twig, t).p;
      const rad = fs * (1 - s * 0.3) * rng.range(0.85, 1.1);
      const count = Math.round((2 + t * 3) * rng.range(0.8, 1.2));
      for (let i = 0; i < count; i++) {
        const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * rad * 1.25;
        florets.push({ x: q[0] + Math.cos(a) * d, y: q[1] + Math.sin(a) * d * 0.9 - rad * 0.3, rad: rad * rng.range(0.8, 1.05), depth: rng.next() });
      }
    }
  }
  // A dense tapering cap of florets along the top of the axis.
  for (let i = 0; i < 16; i++) {
    const s = 0.84 + 0.16 * (i / 15);
    const q = along(axis, s).p;
    const rad = fs * (1.05 - (s - 0.84) * 3.2) * rng.range(0.85, 1.1);
    florets.push({ x: q[0] + rng.range(-1, 1) * rad * 0.8, y: q[1], rad: Math.max(rad, fs * 0.42), depth: rng.next() });
  }
  florets.sort((a, b) => a.depth - b.depth);
  for (const f of florets) {
    const base = P.florets[rng.int(0, P.florets.length - 1)];
    // Florets further back sit in the plume's shade.
    const col = adjust(base, { l: (f.depth - 0.6) * 0.12 });
    const pts = rosette(f.x, f.y, f.rad, rng);
    const hx = f.x + light[0] * f.rad * 0.4, hy = f.y + light[1] * f.rad * 0.4;
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, f.rad * 1.4);
    g.addColorStop(0, mix(col, P.light, 0.4));
    g.addColorStop(0.5, col);
    g.addColorStop(1, mix(col, P.dark, 0.55));
    piece(ctx, pts, { fill: g, smooth: true, shadow: { color: 'rgba(40,0,12,0.55)', blur: 1.6, x: -light[0] * 0.7, y: 1.1 } });
  }
}

// A tiny five-lobed floret outline.
function rosette(x, y, r, rng, lobes = 5) {
  const pts = [];
  const a0 = rng.range(0, TAU);
  for (let i = 0; i < lobes * 2; i++) {
    const a = a0 + (i / (lobes * 2)) * TAU;
    const rr = r * (i % 2 ? 0.8 : 1) * rng.range(0.9, 1.08);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92]);
  }
  return pts;
}

// --- Lupine -------------------------------------------------------------------------------

// A spike of pea-flowers: open violet florets at the bottom, tight buds at the top.
//   x, y  stem base     h  total height     w  spike width     spike  fraction of h in flower
export function drawLupine(ctx, o = {}) {
  const { x = 0, y = 0, h = 160, w = 36, lean = 0, spike = 0.58, bow = 0, seed = 1, light = DEFAULT_LIGHT, stem = true } = o;
  const pal = floraPalette(o.palette);
  const P = pal.lupine;
  const rng = new RNG(seed);
  const top = [x + lean * h, y - h];
  const axis = curve([x, y], top, bow * h, 24);
  if (stem) drawStem(ctx, axis, { width: Math.max(2, w * 0.1), tipWidth: 1.4, color: P.stem, light, seed: rng.int(1, 1e6) });
  // A dark tapering core behind the florets, so the gaps between them read as depth.
  const core = [];
  for (let i = 0; i <= 12; i++) {
    const { p, ang } = along(axis, 1 - spike + spike * (i / 12));
    const half = w * 0.3 * (1 - (i / 12) * 0.8);
    core.push([p[0] + Math.cos(ang + Math.PI / 2) * half, p[1] + Math.sin(ang + Math.PI / 2) * half]);
    core.unshift([p[0] - Math.cos(ang + Math.PI / 2) * half, p[1] - Math.sin(ang + Math.PI / 2) * half]);
  }
  piece(ctx, core, { fill: P.dark, smooth: true });
  const whorls = Math.max(6, Math.round((spike * h) / (w * 0.24)));
  // Top to bottom, so lower (larger, nearer) florets overlap the ones above.
  for (let k = whorls - 1; k >= 0; k--) {
    const s = k / (whorls - 1);
    const { p, ang } = along(axis, 1 - spike + spike * s * 0.97);
    const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
    const fs = w * (0.31 - 0.17 * s) * rng.range(0.9, 1.08);
    const spread = w * (0.42 - 0.27 * s);
    const bud = s > 0.72;
    // Alternate whorls are offset, as the florets spiral up the spike.
    const slots = bud ? [-0.7, 0.7, 0] : (k % 2 ? [-1, 1, 0.05] : [-0.55, 0.6]);
    for (const sd of slots) {
      const fx = p[0] + nx * sd * spread + rng.range(-1, 1) * fs * 0.1;
      const fy = p[1] + ny * sd * spread + rng.range(-1, 1) * fs * 0.1 + Math.abs(sd) * fs * 0.12;
      if (bud) lupineBud(ctx, fx, fy, fs, ang + sd * 0.45, P, light, rng);
      else lupineFloret(ctx, fx, fy, fs, sd, ang, P, light, rng);
    }
  }
  return axis;
}

// --- Larkspur / violet spike ----------------------------------------------------------------

// A loose spike of five-petalled violet flowers (ref03): open florets alternate up the
// stem, turned this way and that, shrinking into buds at the tip.
//   x, y  stem base     h  total height     w  spike width     spike  fraction of h in flower
export function drawLarkspur(ctx, o = {}) {
  const { x = 0, y = 0, h = 200, w = 70, lean = 0, spike = 0.65, bow = 0, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const P = pal.larkspur;
  const rng = new RNG(seed);
  const axis = curve([x, y], [x + lean * h, y - h], bow * h, 24);
  drawStem(ctx, axis, { width: Math.max(2, w * 0.05), tipWidth: 1.2, color: pal.stem, light, seed: rng.int(1, 1e6) });
  const n = Math.max(4, Math.round((spike * h) / (w * 0.26)));
  let side = rng.sign();
  // Top down, so the larger lower florets overlap the ones above.
  for (let k = n - 1; k >= 0; k--) {
    const s = k / (n - 1);
    const { p, ang } = along(axis, 1 - spike + spike * s);
    side = -side;
    const fr = w * (0.44 - 0.24 * s) * rng.range(0.85, 1.1);
    const off = side * w * 0.2 * (1 - s * 0.7);
    const fx = p[0] + Math.cos(ang + Math.PI / 2) * off, fy = p[1] + Math.sin(ang + Math.PI / 2) * off;
    drawStem(ctx, [p, [fx, fy]], { width: Math.max(1, w * 0.025), color: pal.stem, light, shadow: false });
    if (s > 0.8) {
      const bud = piece(ctx, transform(ellipse(0, -fr * 0.3, fr * 0.32, fr * 0.55, 14), { x: fx, y: fy, rot: ang + Math.PI / 2 + side * 0.4 }), {
        fill: linearAlong(ctx, [fx, fy + fr * 0.3], [fx, fy - fr * 0.8], [P.dark, P.petal, P.light]), smooth: true,
        shadow: { color: 'rgba(16,8,40,0.45)', blur: 2, x: -light[0], y: 1.4 },
      });
      bevelOf(ctx, bud, light, { width: 0.9, hi: 0.3, lo: 0.2 });
      continue;
    }
    const rot = rng.range(0, TAU), squash = rng.range(0.55, 0.95);
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * TAU + rng.range(-0.1, 0.1);
      const col = adjust(P.petal, { l: rng.range(-0.05, 0.05) + (Math.sin(a) < 0 ? -0.04 : 0.02) });
      const tx = fx + Math.cos(a) * fr, ty = fy + Math.sin(a) * fr * squash;
      foldedBlade(ctx, fr, fr * 0.42, { base: 0.35, belly: 0.6, taper: 1.2, round: 0.5, curl: rng.range(-0.1, 0.1), n: 12 },
        { x: fx, y: fy, rot: a + Math.PI / 2, squash },
        {
          fill: linearAlong(ctx, [fx, fy], [tx, ty], [P.dark, col, mix(col, P.light, 0.3)]),
          light,
          shadow: { color: 'rgba(16,8,40,0.45)', blur: 2.5, x: -light[0], y: 1.5 },
          dark: 0.2, lift: 0.08, crease: 0.3,
          bevel: { width: 0.9, hi: 0.28, lo: 0.24 },
        });
    }
    const eye = piece(ctx, ellipse(fx, fy, fr * 0.14, fr * 0.14 * squash, 10), { fill: P.center });
    bevelOf(ctx, eye, light, { width: 0.7, hi: 0.3, lo: 0.3 });
  }
  return axis;
}

// One open pea-flower: an upright banner petal behind a pouch of two darker wings.
// side -1..1 turns it toward the left or right edge of the spike; ang is the axis angle.
function lupineFloret(ctx, x, y, s, side, ang, P, light, rng) {
  const rot = ang + Math.PI / 2 + side * 0.75 + rng.range(-0.12, 0.12);
  // Florets cut from slightly different violet and blue sheets.
  const col = adjust(P.florets[rng.int(0, P.florets.length - 1)], { h: rng.range(-0.02, 0.02), l: rng.range(-0.05, 0.05) });
  const at = (pts) => transform(pts, { x, y, rot });
  // Banner: a broad, slightly heart-shaped hood standing up behind the wings.
  const banner = at([[0, s * 0.1], [-s * 0.48, -s * 0.05], [-s * 0.52, -s * 0.42], [-s * 0.22, -s * 0.66], [0, -s * 0.56], [s * 0.22, -s * 0.66], [s * 0.52, -s * 0.42], [s * 0.48, -s * 0.05]]);
  const hx = x + light[0] * s * 0.3, hy = y - s * 0.45;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, s * 0.9);
  g.addColorStop(0, P.light);
  g.addColorStop(0.35, P.banner);
  g.addColorStop(1, mix(P.banner, col, 0.75));
  const bp = piece(ctx, banner, { fill: g, smooth: true, shadow: { color: 'rgba(10,6,40,0.45)', blur: 2.4, x: -light[0], y: 1.5 } });
  creaseLine(ctx, bp, at([[0, -s * 0.5], [0, -s * 0.05]]), light, 0.35, Math.max(0.6, s * 0.05));
  bevelOf(ctx, bp, light, { width: 0.9, hi: 0.3, lo: 0.2, soft: 0.3 });
  // Wings: two overlapping rounded lobes in the floret's deeper colour.
  for (const sx of [-1, 1]) {
    const wing = at(ellipse(sx * s * 0.17, s * 0.12, s * 0.27, s * 0.3, 16, sx * 0.25));
    const wp = piece(ctx, wing, {
      fill: linearAlong(ctx, [x, y - s * 0.2], [x, y + s * 0.45], [mix(col, P.banner, 0.25), col, mix(col, P.dark, 0.5)]),
      smooth: true,
      shadow: { color: 'rgba(10,6,40,0.5)', blur: 2, x: -light[0] * 0.8, y: 1.3 },
    });
    bevelOf(ctx, wp, light, { width: 0.8, hi: 0.28, lo: 0.25, soft: 0.25 });
  }
}

function lupineBud(ctx, x, y, s, ang, P, light, rng) {
  const pts = transform(ellipse(0, -s * 0.2, s * 0.3, s * 0.48, 16), { x, y, rot: ang + Math.PI / 2 + rng.range(-0.2, 0.2) });
  const path = piece(ctx, pts, {
    fill: linearAlong(ctx, [x, y + s * 0.3], [x, y - s * 0.6], [mix(P.bud, P.dark, 0.35), P.bud, P.budTip]),
    smooth: true,
    shadow: { color: 'rgba(10,6,40,0.45)', blur: 2, x: -light[0], y: 1.4 },
  });
  bevelOf(ctx, path, light, { width: 0.9, hi: 0.3, lo: 0.2, soft: 0.3 });
}
