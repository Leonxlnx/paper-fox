// Conifers and big trunks: huge foreground spruces built from drooping needle fronds,
// two-tone tiered spruces for the midground, spiky silhouettes for far forests, and
// redwood trunks made of overlapping bark strips.
//
// The ctx-level functions (frond, frondTier, conifer, coniferMid, coniferFar,
// forestBand, trunk, bigTrunk) paint flat pieces in authored coordinates: call them
// inside a sprite's draw(ctx). The add* factories bake them into planes that sway.

import { RNG, noise } from '../core/rng.js';
import { surface } from '../core/canvas.js';
import { piece, linear, setShadow, clearShadow } from '../core/piece.js';
import { transform, area, bounds } from '../core/geom.js';
import { mix, shade, vary, rgba } from '../core/color.js';
import { clamp, lerp, smoothstep, osc } from '../core/ease.js';
import { drawSprites } from '../core/sprite.js';

export const LIGHT = [0.55, -0.83];

// --- Palettes -------------------------------------------------------------------
// Five-step foliage ramps (deep shade .. sunlit tip) sampled from the references.

export const FOLIAGE = {
  // ref02 left cluster: lit fronds #8aaa6b..#94ac64, shadowed fronds #0b3525..#0f3a2a.
  night: { deep: '#05221a', dark: '#103a2a', mid: '#335a3e', lit: '#6a8c56', hi: '#96b472', fleck: '#dcb85c' },
  // ref02 / ref04 midground spruces: dark side #1c3a30, lit side #4a6a45.
  forest: { deep: '#0a2219', dark: '#142f26', mid: '#22402f', lit: '#3a5a40', hi: '#557a4c', fleck: '#d8b45a' },
  // The lighter yellow-green spruces mixed into the ref02 hillside (#607737).
  sage: { deep: '#1c2c18', dark: '#34482a', mid: '#4c6232', lit: '#66803c', hi: '#86a04c', fleck: '#e2c060' },
  // ref03 background spruces: dark teal.
  teal: { deep: '#031a1c', dark: '#08292b', mid: '#143f3e', lit: '#2a5a52', hi: '#467a68', fleck: '#e4bc62' },
  // ref01 sunset: warm lit fronds #77904f..#7a984e, shade #205037.
  dusk: { deep: '#0d2c1f', dark: '#205037', mid: '#3d6a42', lit: '#77904f', hi: '#a0b465', fleck: '#f0c46a' },
  // ref10 sunrise: sun-struck fronds turn yellow-green #c4bf4d.
  dawn: { deep: '#0a1a0c', dark: '#1a3618', mid: '#506a2a', lit: '#aaa83e', hi: '#dcc858', fleck: '#ffd77a' },
  // ref05 snowy slopes: deep winter green.
  snow: { deep: '#0a2418', dark: '#163f2a', mid: '#25583a', lit: '#3f7748', hi: '#5c9157', fleck: '#d6c27a' },
  // Distant blue-green forest before haze (ref02 far shore #1a3a47).
  blue: { deep: '#0c2530', dark: '#16323f', mid: '#22454f', lit: '#35585c', hi: '#4a6c68', fleck: '#c8b47a' },
};

// Bark ramps (crevice .. lit ridge).
export const BARK = {
  // ref02 left trunk: lit #b16638, mid #884c30, shade #6c371e, crevices #471f19.
  night: { dark: '#3e1b12', mid: '#7c4329', lit: '#a75e35', hi: '#c98250' },
  // ref03 redwoods: crevices #2f180e, mid #6b4334, firelit edges #cb7e3f.
  redwood: { dark: '#2c140b', mid: '#673821', lit: '#a5623a', hi: '#d98e4e' },
  // ref01 / ref10 sunlit trunks (#954a2b, #a15131).
  dusk: { dark: '#3a1c12', mid: '#7a3e24', lit: '#a2532f', hi: '#d08050' },
  // Plain brown for small trunks.
  brown: { dark: '#3a2616', mid: '#6b4a2f', lit: '#8c6440', hi: '#ad8458' },
};

// Colour along a palette ramp: t = 0 deepest shade .. 1 brightest highlight.
export function tone(pal, t) {
  const stops = [pal.deep, pal.dark, pal.mid, pal.lit, pal.hi];
  const x = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

// Pull every colour of a palette toward a haze colour (atmospheric depth).
export function hazePalette(pal, color, t) {
  if (!t) return pal;
  const out = {};
  for (const k of Object.keys(pal)) out[k] = mix(pal[k], color, t);
  return out;
}

// Options with their palette and bark pulled toward opts.haze by opts.hazeAmt.
function hazed(o) {
  if (!o.haze || !o.hazeAmt) return o;
  return { ...o, palette: hazePalette(o.palette, o.haze, o.hazeAmt), bark: hazePalette(o.bark, o.haze, o.hazeAmt) };
}

const asRng = (seed) => (seed instanceof RNG ? seed : new RNG(seed));
const contact = (alpha, blur, light, drop) => ({ color: `rgba(2,10,6,${alpha})`, blur, x: -light[0] * drop * 0.5, y: drop });

// --- Needle fronds ----------------------------------------------------------------

// --- Embossed paper grain ---------------------------------------------------------------

// Tileable grey (128 = neutral) tiles of pressed creases, overlaid onto cut pieces so a
// frond reads as embossed needle paper and a bark plate as fibrous bark.
const EMBOSS = {
  // Short bent creases, loosely aligned along x.
  needle: { count: 1300, len: [6, 18], spread: 0.5, bend: 0.4, width: 1.3, light: 0.75, dark: 0.6 },
  // Long, nearly vertical fibres and slits.
  bark: { count: 420, len: [16, 60], spread: 0.1, bend: 0.12, width: 1.6, light: 0.5, dark: 0.75, angle: Math.PI / 2 },
};
const embossTiles = new Map();

function embossTile(kind) {
  let tile = embossTiles.get(kind);
  if (tile) return tile;
  const spec = EMBOSS[kind];
  const N = 256;
  const { canvas, ctx } = surface(N, N);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, N, N);
  const rng = new RNG(`emboss-${kind}`);
  ctx.lineCap = 'round';
  ctx.lineWidth = spec.width;
  const lines = [];
  for (let i = 0; i < spec.count; i++) {
    const cx = rng.next() * N, cy = rng.next() * N;
    const a = (spec.angle ?? 0) + rng.range(-spec.spread, spec.spread), L = rng.range(spec.len[0], spec.len[1]);
    const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2, b = rng.range(-spec.bend, spec.bend);
    lines.push([cx - dx, cy - dy, cx - dy * b, cy + dx * b, cx + dx, cy + dy]);
  }
  // Each crease: a dark groove with a light ridge beside it, drawn wrapped so the tile repeats.
  const pass = (color, off) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (const [ax, ay, mx, my, bx, by] of lines) {
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        if (Math.max(ax, bx) + ox < -20 || Math.min(ax, bx) + ox > N + 20 || Math.max(ay, by) + oy < -20 || Math.min(ay, by) + oy > N + 20) continue;
        ctx.moveTo(ax + ox + off, ay + oy + off);
        ctx.quadraticCurveTo(mx + ox + off, my + oy + off, bx + ox + off, by + oy + off);
      }
    }
    ctx.stroke();
  };
  pass(`rgba(0,0,0,${spec.dark})`, spec.width);
  pass(`rgba(255,255,255,${spec.light})`, 0);
  tile = canvas;
  embossTiles.set(kind, tile);
  return tile;
}

// Overlay embossed grain inside path. angle aligns the creases; scale sizes them;
// box is { x, y, w, h } covering the path in the current coordinates.
export function emboss(ctx, path, box, { kind = 'needle', alpha = 0.3, angle = 0, scale = 1, seed = 1 } = {}) {
  if (!alpha) return;
  const rng = asRng(seed);
  const pat = ctx.createPattern(embossTile(kind), 'repeat');
  pat.setTransform(new DOMMatrix().translateSelf(rng.next() * 256, rng.next() * 256).rotateSelf(angle * 180 / Math.PI).scaleSelf(scale));
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

function boxOf(pts, pad = 2) {
  const b = bounds(pts);
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
}

// The spine of a drooping frond pointing along +x from its root: a low arc that sags to
// the tip and curls down at the end, with a little hand-cut wobble.
function frondSpine(len, rng, { droop = 0.2, arch = 0.05, curl = 0.12 } = {}) {
  const nz = noise(rng.int(1, 1e6));
  const n0 = nz.n1(0);
  return (s) => droop * len * s * s - arch * len * s * (1 - s)
    + curl * len * Math.pow(Math.max(0, s - 0.75) / 0.25, 2) * 0.25 + (nz.n1(s * 3) - n0) * len * 0.012;
}

// Outline of a frond along its spine: the top edge follows the spine (with a few small
// nicks), the lower edge is a curtain of hanging needles cut as irregular serrations
// leaning toward the tip, and a few deep cuts split it into sub-lobes.
function frondOutline(len, thick, topY, rng, { teeth, depth = 0.2, hang = 0.08, nicks = 2, splits = 1, taper = 0.9 } = {}) {
  const nTeeth = teeth ?? clamp(Math.round(len / 13), 4, 26);
  const thk = (s) => thick * Math.pow(Math.max(0, 1 - s), taper);
  const marks = [];
  const N = clamp(Math.round(len / 10), 6, 40);
  for (let i = 0; i < N; i++) marks.push([i / N, 0]);
  for (let k = 0; k < nicks; k++) {
    const s = rng.range(0.3, 0.9), w = rng.range(0.012, 0.026);
    marks.push([s - w, 0], [s, rng.range(0.1, 0.22)], [s + w * 0.25, 0]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const pts = marks.map(([s, d]) => [s * len, topY(s) + d * thk(s)]);
  pts.push([len, topY(1)]);
  // A few deep cuts split the needle curtain into sub-lobes.
  const cuts = [];
  for (let k = 0; k < splits; k++) cuts.push(rng.range(0.25, 0.75));
  // Lower edge, tip to root: hanging tabs, some pointed, some cut blunt.
  const step = 0.96 / nTeeth;
  const lowY = (s) => topY(s) + thk(s);
  let so = 1;
  while (so > 0.05) {
    const si = so - step * rng.range(0.5, 1.7);
    const w = so - si;
    const drop = (s) => Math.min(thk(s) * 0.8, hang * thick * rng.range(0.2, 1.4) + 1);
    const st = Math.max(0.02, si + w * rng.range(0.62, 0.9));
    const lean = w * len * rng.range(0.1, 0.35);
    pts.push([st * len + lean, lowY(st) + drop(st)]);
    if (rng.chance(0.55)) {
      const sb = Math.max(0.02, st - w * rng.range(0.2, 0.35));
      pts.push([sb * len + lean * 0.7, lowY(sb) + drop(sb) * rng.range(0.5, 0.9)]);
    }
    if (si > 0.04) {
      const cut = cuts.some((c) => c <= so && c > si);
      const rise = cut ? thk(si) * rng.range(0.5, 0.7) : Math.min(thk(si) * 0.5, Math.max(1.5, depth * thk(si) * rng.range(0.5, 1.5)));
      pts.push([si * len, lowY(si) - rise]);
    }
    so = si;
  }
  pts.push([0, thick]);
  return pts;
}

// One needle frond cut from paper, root at (x, y), built from two stacked pieces: a
// darker curtain of hanging needles behind, and a lighter top blade with its own
// serrated edge laid over it, casting a thin contact shadow.
//   ang     droop of the whole frond below horizontal (radians); flip mirrors it to point left
//   color   top-blade colour; rootColor / tipColor shade it along its length
//   under   colour of the needle curtain (default: color darkened)
//   layers  1 for a single piece (cheaper, for small fronds), 2 for curtain + blade
//   grain   strength of the embossed needle grain (0 = none)
//   shape   { droop, arch, curl } spine and { teeth, depth, hang, nicks, splits } edge options
export function frond(ctx, x, y, len, thick, opts = {}) {
  const {
    ang = 0.4, flip = false, color = FOLIAGE.night.mid, light = LIGHT, seed = 1, shape = {},
    rootColor = shade(color, -0.5), tipColor = shade(color, 0.18), under = null, layers = 2,
    grain = 0.55, bevel = true, shadow = null, flecks = 0, fleckColor = FOLIAGE.night.fleck,
  } = opts;
  const rng = asRng(seed);
  const topY = frondSpine(len, rng, shape);
  const xf = { x, y, rot: flip ? -ang : ang, sx: flip ? -1 : 1, sy: 1 };
  const tip = transform([[len, topY(1)]], xf)[0];
  const along = (c0, c1, c2) => linear(ctx, x, y, tip[0], tip[1], [[0, c0], [0.22, mix(c0, c1, 0.75)], [0.5, c1], [1, c2]]);
  const bev = bevel ? { light, width: clamp(thick * 0.022, 0.8, 2.2), hi: 0.45, lo: 0.32 } : null;
  const gscale = clamp(thick / 70, 0.5, 1.4);
  const gangle = xf.rot + (flip ? Math.PI - 0.5 : 0.5);

  const base = transform(frondOutline(len, thick, topY, rng, shape), xf);
  const curtain = under ?? mix(color, rootColor, 0.45);
  const path = piece(ctx, base, {
    fill: layers > 1 ? along(mix(rootColor, curtain, 0.3), curtain, mix(curtain, tipColor, 0.35)) : along(rootColor, color, tipColor),
    shadow, bevel: bev,
  });
  emboss(ctx, path, boxOf(base), { alpha: grain, angle: gangle, scale: gscale, seed: rng.int(1, 1e6) });
  let top = path, topPts = base;
  if (layers > 1) {
    const k = rng.range(0.5, 0.64);
    topPts = transform(frondOutline(len * rng.range(0.94, 0.99), thick * k, topY, rng, {
      ...shape, teeth: Math.round((shape.teeth ?? clamp(Math.round(len / 13), 4, 26)) * 1.25), hang: (shape.hang ?? 0.08) * 1.6, splits: 0,
    }), xf);
    top = piece(ctx, topPts, {
      fill: along(rootColor, color, tipColor), bevel: bev,
      shadow: { color: 'rgba(0,10,4,0.45)', blur: clamp(thick * 0.06, 1.5, 6), x: -light[0] * 1.2, y: clamp(thick * 0.035, 1, 4) },
    });
    emboss(ctx, top, boxOf(topPts), { alpha: grain, angle: gangle, scale: gscale, seed: rng.int(1, 1e6) });
  }
  if (flecks) {
    // Gold-leaf specks caught on the needles.
    const b = bounds(topPts);
    ctx.save();
    ctx.clip(top);
    for (let i = 0; i < flecks; i++) {
      ctx.fillStyle = rgba(fleckColor, rng.range(0.45, 0.9));
      ctx.beginPath();
      ctx.arc(b.x + rng.next() * b.w, b.y + rng.next() * b.h, rng.range(0.4, 1.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  return path;
}

// A pinnate spray (fir / hemlock branchlet) cut as one piece: a stem from (x, y) that
// arcs downward, with pointed leaflets along both sides, longest a little before the
// middle, leaning toward the tip. Light creases mark the stem and each leaflet.
//   ang     initial direction of the stem (radians, 0 = right, positive = down)
//   bend    how much the stem curls downward over its length (radians)
//   leaf    leaflet length (default from len);  gap: leaflet spacing as a fraction of leaf
//   color, rootColor, tipColor   shading along the stem
export function spray(ctx, x, y, len, opts = {}) {
  const {
    ang = 0.6, bend = 0.6, leaf = len * 0.2, gap = 0.46, lean = 0.75, color = FOLIAGE.night.mid,
    rootColor = shade(color, -0.4), tipColor = shade(color, 0.15), light = LIGHT, seed = 1,
    grain = 0.5, shadow = null, flecks = 0, fleckColor = FOLIAGE.night.fleck, veins = 0.18,
  } = opts;
  const rng = asRng(seed);
  // Stem as a polyline with its tangent angle.
  const N = 24, stem = [];
  let px = x, py = y;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = ang + bend * t * t + rng.range(-0.03, 0.03);
    stem.push({ x: px, y: py, a, t });
    px += Math.cos(a) * len / N;
    py += Math.sin(a) * len / N;
  }
  const at = (t) => {
    const f = clamp(t) * N, i = Math.min(N - 1, Math.floor(f)), k = f - i;
    const A = stem[i], B = stem[i + 1];
    return { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), a: lerp(A.a, B.a, k) };
  };
  const sw = Math.max(1, leaf * 0.09);
  const step = (leaf * gap) / len;
  const sides = [[], []];
  const leaflets = [];
  for (const [si, sgn] of [[0, -1], [1, 1]]) {
    const pts = sides[si];
    let t = 0.06 + rng.range(0, step * 0.5);
    pts.push((() => { const p = at(0); return [p.x - Math.sin(p.a) * sw * sgn, p.y + Math.cos(p.a) * sw * sgn]; })());
    while (t < 0.97) {
      const p = at(t);
      // Leaflet size profile: small at the root, full a little before the middle, small at the tip.
      const prof = Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * 0.75 + 0.25;
      const L = leaf * prof * rng.range(0.85, 1.12);
      const W = L * rng.range(0.36, 0.46);
      const la = p.a + sgn * (Math.PI / 2 - lean * 0.75) + rng.range(-0.12, 0.12);
      const nx = -Math.sin(p.a) * sgn, ny = Math.cos(p.a) * sgn;
      const bx = p.x + nx * sw, by = p.y + ny * sw;
      const ca = Math.cos(la), sa = Math.sin(la);
      // Leaflet's own sideways axis, pointing toward the stem tip.
      const ex = sa * sgn, ey = -ca * sgn;
      const off = (f, w) => [bx + ca * L * f + ex * W * w, by + sa * L * f + ey * W * w];
      // Back shoulder, tip, front shoulder, then the notch before the next leaflet.
      pts.push(off(0.25, -0.75), off(0.6, -0.8), off(0.88, -0.4));
      const tip = off(1, 0);
      pts.push(tip, off(0.85, 0.42), off(0.55, 0.62), off(0.22, 0.55));
      const q = at(t + step * 0.6);
      pts.push([q.x + (-Math.sin(q.a) * sgn) * sw * 1.2, q.y + Math.cos(q.a) * sgn * sw * 1.2]);
      leaflets.push([bx, by, tip[0], tip[1]]);
      t += step * rng.range(0.85, 1.15);
    }
    const e = at(1);
    pts.push([e.x + Math.cos(e.a) * leaf * 0.3, e.y + Math.sin(e.a) * leaf * 0.3]);
  }
  const outline = [...sides[0], ...sides[1].reverse()];
  const end = at(1);
  const path = piece(ctx, outline, {
    fill: linear(ctx, x, y, end.x, end.y, [[0, rootColor], [0.35, mix(rootColor, color, 0.8)], [0.7, color], [1, tipColor]]),
    shadow, bevel: { light, width: clamp(leaf * 0.03, 0.8, 1.8), hi: 0.42, lo: 0.3 },
  });
  const box = boxOf(outline, 4);
  emboss(ctx, path, box, { alpha: grain, angle: ang + 0.4, scale: clamp(leaf / 40, 0.4, 1.1), seed: rng.int(1, 1e6) });
  if (veins) {
    // Pressed creases: the stem and a midrib down each leaflet.
    ctx.save();
    ctx.clip(path);
    ctx.lineCap = 'round';
    ctx.lineWidth = clamp(leaf * 0.035, 0.7, 2);
    ctx.strokeStyle = rgba('#fff5d8', veins);
    ctx.beginPath();
    stem.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    for (const [bx, by, tx, ty] of leaflets) { ctx.moveTo(bx, by); ctx.lineTo(lerp(bx, tx, 0.8), lerp(by, ty, 0.8)); }
    ctx.stroke();
    ctx.restore();
  }
  if (flecks) {
    ctx.save();
    ctx.clip(path);
    for (let i = 0; i < flecks; i++) {
      ctx.fillStyle = rgba(fleckColor, rng.range(0.45, 0.9));
      ctx.beginPath();
      ctx.arc(box.x + rng.next() * box.w, box.y + rng.next() * box.h, rng.range(0.4, 1.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  return path;
}

// One whorl of fronds around a trunk at (cx, cy), seen from the side: fronds fan from
// pointing away (short, dark, behind) through the sides (long) to pointing at the
// viewer (short and steep), drawn back to front with contact shadows between them.
//   R       reach of the longest side frond
//   fronds  fronds per side (default from R);  front: add one pointing at the viewer
//   bias    overall brightness on the palette ramp (0..1); contrast: lit/shade spread
//   slope   droop of the side fronds (radians); thick: frond depth as a fraction of length
//   sides   'both' | 'left' | 'right'
//   layers  1 or 2 pieces per frond (see frond);  grain: embossed needle grain strength
export function frondTier(ctx, cx, cy, R, opts = {}) {
  const {
    palette = FOLIAGE.night, light = LIGHT, seed = 1, fronds, bias = 0.5, contrast = 1,
    droop = 0.1, slope = 0.45, thick = 0.46, sides = 'both', front = true, grain = 0.55, flecks = true,
    shadow = 0.6, spread = 0, layers = R > 70 ? 2 : 1,
  } = opts;
  const rng = asRng(seed);
  const m = fronds ?? clamp(Math.round(R / 150) + 1, 2, 3);
  const list = [];
  for (const side of [-1, 1]) {
    if ((sides === 'left' && side > 0) || (sides === 'right' && side < 0)) continue;
    for (let j = 0; j < m; j++) list.push({ side, phi: lerp(1.95, 0.7, (j + rng.range(0.25, 0.75)) / m) });
  }
  if (front && R > 60 && sides === 'both') list.push({ side: rng.sign(), phi: rng.range(0.15, 0.35) });
  list.sort((a, b) => b.phi - a.phi);
  const lx = light[0];
  for (const f of list) {
    const sp = Math.sin(f.phi);
    const len = R * (0.35 + 0.65 * sp) * rng.range(0.78, 1.1);
    const back = Math.max(0, -Math.cos(f.phi));
    const ang = slope + (1 - sp) * 0.8 - back * 0.12 + rng.range(-0.2, 0.2);
    const t = bias + contrast * (0.32 * f.side * lx * sp - 0.35 * back) + rng.range(-0.08, 0.08);
    const color = vary(tone(palette, t), rng, 0.05);
    const th = len * thick * (0.9 + 0.4 * (1 - sp)) * rng.range(0.78, 1.18);
    frond(ctx, cx + f.side * spread, cy, len, th, {
      ang, flip: f.side < 0, color, light, seed: rng.int(1, 1e9),
      rootColor: mix(color, palette.deep, 0.6), tipColor: mix(color, palette.hi, 0.6),
      under: mix(color, palette.deep, 0.35), layers, grain,
      shape: { droop, arch: 0.015, curl: 0.06, teeth: clamp(Math.round(len / 16), 4, 22) }, flecks: flecks ? Math.round((len * th) / 1400) : 0, fleckColor: palette.fleck,
      shadow: shadow ? contact(shadow, clamp(len * 0.06, 3, 16), light, clamp(len * 0.04, 2, 12)) : null,
    });
  }
}

// --- Trunks -------------------------------------------------------------------------

// Bark trunk centred on x from yTop down to yBase: a dark core showing through the
// crevices, covered by long vertical strips of paper that taper and overlap, shaded
// round the cylinder toward the light, with a flared root at the base.
//   w       width at the base before flare;  taper: width at the top as a fraction
//   flare   extra width at the very base (fraction of w), over the lowest flareH of the height
//   lean    sideways offset of the top relative to the base (px), the trunk bows smoothly
//   strips  bark plates across the trunk (default from w);  grain: embossed fibre strength
//   rim     colour of a warm edge light on the lit flank (e.g. firelight), or null
export function trunk(ctx, x, yTop, yBase, w, opts = {}) {
  const {
    bark = BARK.night, light = LIGHT, seed = 1, strips, taper = 0.75, flare = 0.3, flareH = 0.14, lean = 0,
    rim = null, segments = true, cracks = true, shadow = true, grain = 0.45,
  } = opts;
  const rng = asRng(seed);
  const nz = noise(rng.int(1, 1e9));
  const H = yBase - yTop;
  const hw = (yy) => {
    const v = clamp((yy - yTop) / H);
    const f = smoothstep(1 - flareH, 1, v);
    return (w / 2) * (lerp(taper, 1, v) + flare * f * f);
  };
  // Centre line: bows from the base toward the lean at the top.
  const cxAt = (yy) => x + lean * Math.pow(1 - clamp((yy - yTop) / H), 1.6);
  const step = clamp(H / 50, 5, 18);
  const ys = [];
  for (let yy = yTop; yy < yBase; yy += step) ys.push(yy);
  ys.push(yBase);
  const outline = [...ys.map((yy) => [cxAt(yy) - hw(yy), yy]), ...ys.slice().reverse().map((yy) => [cxAt(yy) + hw(yy), yy])];
  const body = piece(ctx, outline, { fill: bark.dark });

  const n = strips ?? clamp(Math.round(w / 16), 3, 20);
  // Strip boundaries across the trunk (0..1), with uneven widths.
  const widths = [];
  for (let k = 0; k < n; k++) widths.push(rng.range(0.5, 1.6));
  const total = widths.reduce((a, b) => a + b, 0);
  const bnd = [0];
  for (let k = 0; k < n; k++) bnd.push(bnd[k] + widths[k] / total);
  const lx = light[0];
  const ramp = [bark.dark, bark.mid, bark.lit, bark.hi];
  const barkTone = (t) => {
    const s = clamp(t) * 3, i = Math.min(2, Math.floor(s));
    return mix(ramp[i], ramp[i + 1], s - i);
  };
  // Round the cylinder: dark on the far flank, brightening toward the lit edge, with a
  // narrow falloff right at the rim.
  const ls = Math.sign(lx || 1);
  const lumAt = (c) => 0.36 + 0.36 * c * ls * Math.min(1, Math.abs(lx) * 1.6) + 0.24 * smoothstep(0.4, 0.85, c * ls)
    - 0.16 * smoothstep(0.86, 1, Math.abs(c));
  const bevel = { light, width: clamp(w * 0.012, 1, 2.4), hi: rim ? 0.6 : 0.4, lo: 0.4, hiColor: rim ?? '#fff1d8' };
  const plateShadow = shadow ? { color: 'rgba(10,2,0,0.65)', blur: clamp(w * 0.02, 2, 5), x: -lx * 1.6, y: 1.8 } : null;
  const gap = clamp(w * 0.007, 0.6, 2);
  // One bark plate between fractions u0..u1 of the trunk width, from ya to yb, with
  // pointed ends where it tucks under its neighbours, and a lighter ridge along it.
  const plate = (u0, u1, ya, yb, lum, k) => {
    const capTop = ya > yTop + 1, capBot = yb < yBase - 1;
    const tipLen = Math.min(70, (yb - ya) * 0.35);
    const left = [], right = [], ridgeL = [], ridgeR = [];
    const sstep = clamp((yb - ya) / 28, 3, 14);
    const skew = rng.range(-0.25, 0.25);
    const rpos = rng.range(0.15, 0.45) * ls, rw = rng.range(0.25, 0.45);
    for (let yy = ya; yy <= yb + 0.01; yy += sstep) {
      const half = hw(yy), cx = cxAt(yy);
      let k0 = 1;
      if (capTop) k0 = Math.min(k0, Math.sqrt(clamp((yy - ya) / tipLen)));
      if (capBot) k0 = Math.min(k0, Math.sqrt(clamp((yb - yy) / tipLen)));
      const wob = nz.n2(k * 3.1, yy * 0.01) * w * 0.018;
      const xl = cx + half * (2 * u0 - 1), xr = cx + half * (2 * u1 - 1);
      const hwid = Math.max(0.6, (xr - xl) / 2 - gap * rng.range(0.5, 1.6));
      const xm = (xl + xr) / 2 + wob + skew * hwid * (1 - k0);
      left.push([xm - hwid * k0, yy]);
      right.push([xm + hwid * k0, yy]);
      const rm = xm + rpos * hwid * k0, rh = hwid * k0 * rw * (0.6 + 0.4 * nz.n2(k * 7.7, yy * 0.02 + 3));
      ridgeL.push([rm - rh, yy]);
      ridgeR.push([rm + rh, yy]);
    }
    const pts = [...left, ...right.reverse()];
    const color = vary(barkTone(lum), rng, 0.07);
    const path = piece(ctx, pts, {
      fill: color,
      torn: { amp: clamp(w * 0.016, 0.8, 3.5), freq: 0.09, fine: 0.7, seed: rng.int(1, 1e6) },
      bevel, shadow: plateShadow,
    });
    const box = boxOf(pts, 4);
    const gs = clamp(w / 160, 0.5, 1.3);
    emboss(ctx, path, box, { kind: 'bark', alpha: grain, scale: gs, seed: rng.int(1, 1e6) });
    if (w > 60 && (right[0][0] - left[left.length - 1][0]) > 8) {
      // The raised ridge of the plate catches more light.
      const rp = piece(ctx, [...ridgeL, ...ridgeR.reverse()], {
        fill: vary(barkTone(lum + 0.16), rng, 0.06), alpha: 0.85,
        torn: { amp: clamp(w * 0.008, 0.6, 1.6), freq: 0.15, fine: 0.5, seed: rng.int(1, 1e6) },
      });
      emboss(ctx, rp, box, { kind: 'bark', alpha: grain, scale: gs, seed: rng.int(1, 1e6) });
    }
  };
  for (let k = 0; k < n; k++) {
    const u0 = bnd[k], u1 = bnd[k + 1];
    const lum = lumAt(u0 + u1 - 1);
    let ya = yTop - 2;
    while (ya < yBase) {
      const seg = segments ? rng.range(0.12, 0.4) * H + 30 : H + 10;
      const yb = Math.min(yBase + 1, ya + seg);
      plate(u0, u1, ya, yb, lum + rng.range(-0.1, 0.1), k);
      if (yb >= yBase) break;
      ya = yb - rng.range(8, 22);
    }
  }
  if (segments) {
    // Loose narrow plates lying across the seams, for a rougher, layered bark.
    const count = Math.round(n * H / 220);
    for (let i = 0; i < count; i++) {
      const u = rng.range(0.03, 0.97), du = rng.range(0.25, 0.5) / n;
      const ya = yTop + rng.range(-0.05, 0.95) * H, len = rng.range(0.05, 0.16) * H + 20;
      plate(Math.max(0, u - du), Math.min(1, u + du), ya, Math.min(yBase, ya + len), lumAt(2 * u - 1) + rng.range(-0.05, 0.15), 100 + i);
    }
  }
  if (cracks) {
    // Short dark slits and pale flecks in the bark plates.
    const count = Math.round((w * H) / 700);
    for (let i = 0; i < count; i++) {
      const yy = yTop + rng.next() * H, half = hw(yy);
      const cx = cxAt(yy) + half * rng.range(-0.92, 0.92);
      const len = rng.range(5, 24), wd = rng.range(0.7, 2);
      ctx.fillStyle = rng.chance(0.7) ? rgba(bark.dark, rng.range(0.5, 0.9)) : rgba(bark.hi, rng.range(0.2, 0.45));
      ctx.beginPath();
      ctx.moveTo(cx, yy); ctx.lineTo(cx + wd, yy + len * 0.5); ctx.lineTo(cx, yy + len); ctx.lineTo(cx - wd * 0.6, yy + len * 0.5);
      ctx.fill();
    }
  }
  if (rim) {
    // Warm light wrapping round the lit flank.
    const b = bounds(outline);
    const x0 = ls > 0 ? b.x : b.x1, x1 = ls > 0 ? b.x1 : b.x;
    ctx.save();
    ctx.clip(body);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = linear(ctx, x0, 0, x1, 0, [[0, rgba(rim, 0)], [0.62, rgba(rim, 0)], [0.9, rgba(rim, 0.28)], [1, rgba(rim, 0.5)]]);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }
}

// A side branch stub: a tapered stick of bark from (x, y) at angle ang (radians, 0 = right).
export function branch(ctx, x, y, len, width, ang, opts = {}) {
  const { bark = BARK.night, light = LIGHT, seed = 1, twigs = 0 } = opts;
  const rng = asRng(seed);
  const stick = (x0, y0, L, wd, a) => {
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    const bend = rng.range(-0.08, 0.08) * L;
    const pts = [
      [x0 + nx * wd / 2, y0 + ny * wd / 2],
      [x0 + c * L * 0.5 + nx * (wd * 0.32 + bend), y0 + s * L * 0.5 + ny * (wd * 0.32 + bend)],
      [x0 + c * L, y0 + s * L],
      [x0 + c * L * 0.5 - nx * (wd * 0.32 - bend), y0 + s * L * 0.5 - ny * (wd * 0.32 - bend)],
      [x0 - nx * wd / 2, y0 - ny * wd / 2],
    ];
    piece(ctx, pts, {
      fill: vary(bark.mid, rng, 0.06), smooth: true,
      bevel: { light, width: 1.2, hi: 0.4, lo: 0.3, hiColor: bark.hi },
      shadow: { color: 'rgba(8,2,0,0.5)', blur: 4, x: -light[0] * 2, y: 3 },
    });
  };
  stick(x, y, len, width, ang);
  for (let i = 0; i < twigs; i++) {
    const t = rng.range(0.35, 0.85);
    const a = ang + rng.sign() * rng.range(0.4, 0.9);
    stick(x + Math.cos(ang) * len * t, y + Math.sin(ang) * len * t, len * rng.range(0.2, 0.4), width * 0.35, a);
  }
}

// --- Near conifer ---------------------------------------------------------------------

// Tier layout shared by conifer() and addHeroConifer(): tiers crowd near the apex and
// spread out toward the base.
export function coniferPlan(x, y, h, opts = {}) {
  const { width = 0.3, tiers, trunkFrac = 0.12, trunkWidth = 0.06, seed = 1, curve = 1.25 } = opts;
  const rng = asRng(seed).fork('plan');
  const n = tiers ?? clamp(Math.round(h / 80), 5, 16);
  const apex = y - h, base = y - h * trunkFrac;
  const R = h * width;
  const list = [];
  for (let i = 0; i < n; i++) {
    const v = (i + 0.45) / n, u = (i + 1) / n;
    const cy = apex + (base - apex) * Math.pow(v, curve);
    list.push({
      i, u, cx: x, cy,
      R: R * (0.14 + 0.86 * Math.pow(u, 0.9)) * rng.range(0.86, 1.1),
      // Half-width of the trunk at this height, where the fronds take root.
      root: (h * trunkWidth / 2) * lerp(0.75, 1, (cy - apex) / h),
      seed: rng.int(1, 1e9),
    });
  }
  return { x, y, h, apex, base, R, tiers: list };
}

function tierOpts(T, o) {
  return {
    ...o, seed: T.seed,
    bias: (o.bias ?? 0.5) + 0.12 * (1 - T.u) - 0.06 * T.u,
    spread: o.spread ?? T.root * 0.8,
    // front: true/false, or the fraction of whorls from the top that get a front frond.
    front: typeof o.front === 'number' ? T.u <= o.front : o.front ?? true,
    slope: (o.slope ?? 0.45) + new RNG(T.seed).range(-0.16, 0.16),
  };
}

// The apex leader: a narrow serrated spike.
function leader(ctx, x, apex, size, pal, light, rng) {
  const pts = [[x, apex - size * 0.15]];
  const n = 3;
  for (let j = 1; j <= n; j++) pts.push([x + size * 0.22 * (j / n), apex + size * 0.5 * (j / n)], [x + size * 0.1 * (j / n), apex + size * 0.5 * (j / n) + size * 0.06]);
  pts.push([x, apex + size * 0.62]);
  for (let j = n; j >= 1; j--) pts.push([x - size * 0.1 * (j / n), apex + size * 0.5 * (j / n) + size * 0.06], [x - size * 0.22 * (j / n), apex + size * 0.5 * (j / n)]);
  piece(ctx, pts, { fill: vary(pal.lit, rng, 0.05), bevel: { light, width: 1, hi: 0.3, lo: 0.25 }, shadow: contact(0.45, 3, light, 2) });
}

// Trunk and the dark inner volume of a near conifer (everything behind the tiers).
export function coniferBody(ctx, plan, opts = {}) {
  const { palette = FOLIAGE.night, bark = BARK.night, light = LIGHT, seed = 1, trunkWidth = 0.06, interior = true, trunk: trunkOpts = {} } = opts;
  const { x, y, h, apex, base, R } = plan;
  if (trunkWidth > 0) trunk(ctx, x, apex + h * 0.1, y, h * trunkWidth, { bark, light, seed, ...trunkOpts });
  if (interior) {
    piece(ctx, [[x, apex + h * 0.02], [x + R * 0.78, base + R * 0.18], [x + R * 0.2, base + R * 0.3], [x - R * 0.2, base + R * 0.3], [x - R * 0.78, base + R * 0.18]], {
      fill: shade(palette.deep, -0.2), smooth: true,
    });
  }
}

// Near, detailed spruce/fir standing on (x, y), h tall: stacked whorls of drooping
// serrated fronds over a bark trunk.
//   width       reach of the lowest tier as a fraction of h
//   tiers       number of whorls (default from h)
//   trunkFrac   bare trunk below the lowest whorl (fraction of h); trunkWidth: fraction of h
//   bias        brightness on the palette ramp; contrast: lit/shade spread
//   fronds      fronds per side in each whorl; front: true/false or the fraction of whorls
//               from the top that also get a frond pointing at the viewer (it hides the trunk)
//   interior    dark inner volume behind the whorls (turn off to see the trunk between them)
//   sides       'both' | 'left' | 'right' (half trees at the frame edge)
//   haze, hazeAmt   pull palette and bark toward a haze colour
export function conifer(ctx, x, y, h, opts = {}) {
  const o = hazed({ palette: FOLIAGE.night, bark: BARK.night, light: LIGHT, seed: 1, ...opts });
  const plan = coniferPlan(x, y, h, o);
  coniferBody(ctx, plan, o);
  for (let k = plan.tiers.length - 1; k >= 0; k--) {
    const T = plan.tiers[k];
    frondTier(ctx, T.cx, T.cy, T.R, tierOpts(T, o));
  }
  leader(ctx, x, plan.apex, plan.tiers[0].R * 1.4, o.palette, o.light, new RNG(o.seed));
}

// --- Midground conifer --------------------------------------------------------------

// Right half of one tier (mirror for the left): a drooping branch from the axis at
// (0, 0). Its upper edge runs nearly straight down-out to a pointed tip at (R, th);
// its underside climbs steeply back toward the axis, split by deep notches into
// hanging sub-branches, each with its own tip and a few small needle teeth.
function skirtHalf(R, th, rng, { lobes, depth = 0.45, teeth = th > 12 } = {}) {
  const m = lobes ?? clamp(Math.round(R / 40 + rng.range(0.5, 1.5)), 1, 4);
  const pts = [[0, 0]];
  const bulge = rng.range(1.1, 1.45);
  for (const s of [0.3, 0.6, 0.85]) pts.push([R * s, th * Math.pow(s, bulge) + rng.range(-0.02, 0.02) * th]);
  const tip = [R * rng.range(1, 1.06), th * rng.range(1.02, 1.12)];
  pts.push(tip);
  // Underside height at fraction s of the reach: high near the axis, low at the tip.
  const under = (s) => th * (0.42 + 0.58 * s);
  // Small hanging needle teeth along a stretch of the underside from a to b.
  const size = th * 0.06;
  const serrate = (a, b) => {
    if (!teeth) return;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(L / (size * 2.8));
    for (let q = 1; q <= n; q++) {
      const f = (q - rng.range(0.2, 0.5)) / (n + 0.5), g = Math.min(0.98, f + rng.range(0.3, 0.5) / (n + 0.5));
      const px = lerp(a[0], b[0], f), py = lerp(a[1], b[1], f);
      const d = size * rng.range(0.6, 1.4);
      pts.push([px + d * 0.4, py + d]);
      pts.push([lerp(a[0], b[0], g), lerp(a[1], b[1], g)]);
    }
  };
  // Sub-branches from the tip inward, each ending in a drooping point.
  const spans = [];
  for (let j = 0; j < m; j++) spans.push(rng.range(0.7, 1.3) * (j === 0 ? 1.4 : 1));
  const total = spans.reduce((a, b) => a + b, 0) / 0.92;
  let s = 1, prev = tip;
  for (let j = 0; j < m; j++) {
    const span = spans[j] / total;
    const sn = s - span * rng.range(0.45, 0.65);
    const notch = [R * sn, under(sn) - th * depth * rng.range(0.5, 1) * (0.4 + 0.6 * sn)];
    serrate(prev, notch);
    pts.push(notch);
    s -= span;
    const sub = j < m - 1
      ? [R * s + th * rng.range(0.06, 0.16), under(s) + th * rng.range(0.08, 0.2)]
      : [0, under(0)];
    serrate(notch, sub);
    pts.push(sub);
    prev = sub;
  }
  return pts;
}

// Midground spruce on (x, y), h tall: tiers of two-tone skirts (shade half and lit half
// meeting on the axis), each with hanging serrated lobes and a contact shadow on the
// tier below, over a slim trunk.
//   width   half-width of the lowest tier as a fraction of h
//   tiers   number of tiers (default: many fine tiers for small trees, about 12 for big ones)
//   tones   [shade, lit] positions on the palette ramp for the two halves
//   lobes   lobes per half tier (default from size)
//   grain   embossed needle grain strength (default by size)
//   haze, hazeAmt   pull the palette toward a haze colour for distance
export function coniferMid(ctx, x, y, h, opts = {}) {
  const {
    bark: bark0 = BARK.night, light = LIGHT, seed = 1, width = 0.26, tiers,
    trunkFrac = 0.07, trunkWidth = 0.03, lobes, shadow = 0.62, grain, bias = 0, flecks = true,
    tones = [0.2, 0.62], haze = null, hazeAmt = 0,
  } = opts;
  const palette = hazePalette(opts.palette ?? FOLIAGE.forest, haze, hazeAmt);
  const bark = hazePalette(bark0, haze, hazeAmt);
  const rng = asRng(seed);
  // Small trees keep many fine tiers; big ones stop adding tiers and grow them instead.
  const n = tiers ?? clamp(Math.round(3 + h / 28), 4, 12);
  const apex = y - h, base = y - h * trunkFrac;
  const R = h * width, crownH = base - apex;
  const litSide = light[0] >= 0 ? 1 : -1;
  const gr = grain ?? (h > 150 ? 0.5 : 0);
  if (trunkWidth > 0 && trunkFrac > 0) {
    // A slim trunk running up into the crown, shaded half and lit half.
    const tw = Math.max(1.2, h * trunkWidth) / 2, tt = apex + crownH * 0.5;
    const dark = vary(mix(bark.mid, palette.deep, 0.5), rng, 0.05), lit = vary(mix(bark.lit, palette.deep, 0.25), rng, 0.05);
    piece(ctx, [[x - tw * 0.6, tt], [x + tw * 0.6, tt], [x + tw, y], [x - tw, y]], { fill: dark });
    piece(ctx, [[x, tt], [x + litSide * tw * 0.6, tt], [x + litSide * tw, y], [x, y]], { fill: lit });
  }
  const f = (v) => Math.pow(v, 1.12);
  for (let i = n - 1; i >= 0; i--) {
    const u = (i + 1) / n;
    const top = apex + crownH * f(i / n);
    const th = crownH * (f(u) - f(i / n)) + crownH / n * 0.75;
    const Ri = R * (0.15 + 0.85 * Math.pow(u, 0.9)) * rng.range(0.82, 1.12);
    const lift = 0.06 * (1 - u) + bias;
    for (const side of [-litSide, litSide]) {
      const lit = side === litSide;
      const color = vary(lit ? tone(palette, tones[1] + lift + rng.range(-0.05, 0.05)) : tone(palette, tones[0] + lift * 0.5), rng, 0.05);
      const local = skirtHalf(Ri, th, rng, { lobes });
      const pts = local.map(([px, py]) => [x + side * (px + (lit ? 0 : -0.8)), top + py]);
      const path = piece(ctx, pts, {
        fill: color,
        bevel: { light, width: clamp(th * 0.03, 0.7, 1.6), hi: 0.28, lo: 0.22 },
        shadow: shadow ? contact(shadow, clamp(th * 0.12, 1.5, 9), light, clamp(th * 0.07, 1, 5)) : null,
      });
      if (gr) emboss(ctx, path, boxOf(pts), { alpha: gr, angle: side > 0 ? 0.7 : Math.PI - 0.7, scale: clamp(th / 60, 0.4, 1), seed: rng.int(1, 1e6) });
      if (flecks && th > 14) {
        ctx.save();
        ctx.clip(path);
        const count = Math.round((Ri * th) / 1500);
        for (let k = 0; k < count; k++) {
          ctx.fillStyle = rgba(palette.fleck ?? '#dcb85c', rng.range(0.35, 0.8));
          ctx.beginPath();
          ctx.arc(x + side * Ri * rng.next(), top + th * rng.next(), rng.range(0.4, 1.1), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
}

// --- Far conifer ------------------------------------------------------------------

// Outline of a far spruce: a spire whose sides step out in jagged tiers.
// Returns { full, lit } point lists (whole silhouette and the half facing the light).
export function spire(x, y, h, rng, { width = 0.24, steps, litSide = 1, trunk: withTrunk = true } = {}) {
  const n = steps ?? clamp(Math.round(h / 13), 2, 8);
  const top = y - h, R = h * width;
  const side = (sgn) => {
    const pts = [];
    for (let j = 1; j <= n; j++) {
      const v = clamp((j + (j < n ? rng.range(-0.25, 0.2) : 0)) / n);
      const yy = top + h * 0.9 * Math.pow(v, 0.92);
      const w = R * (0.14 + 0.86 * v);
      pts.push([x + sgn * w * rng.range(0.8, 1.12), yy + rng.range(0, 0.03) * h]);
      if (j < n) pts.push([x + sgn * w * rng.range(0.38, 0.6), yy + h * rng.range(0.01, 0.045)]);
    }
    return pts;
  };
  const right = side(1), left = side(-1);
  const tw = Math.max(0.8, h * 0.028), yb = y - h * 0.07;
  const foot = withTrunk ? [[x + tw, yb], [x + tw, y], [x - tw, y], [x - tw, yb]] : [[x, y - h * 0.05]];
  const full = [[x, top], ...right, ...foot, ...left.reverse()];
  const half = litSide > 0 ? right : left.slice().reverse();
  const lit = [[x, top], ...half, [x, y - h * 0.08]];
  return { full, lit };
}

// Far spruce: a jagged spire, shade colour with a lit half, hazed for distance.
//   tones   [shade, lit] positions on the palette ramp (lit null for a flat silhouette)
//   shadow  contact shadow (setShadow options) on what is behind, or null
export function coniferFar(ctx, x, y, h, opts = {}) {
  const { light = LIGHT, seed = 1, width = 0.24, tones = [0.18, 0.55], shadow = null, haze = null, hazeAmt = 0 } = opts;
  const palette = hazePalette(opts.palette ?? FOLIAGE.blue, haze, hazeAmt);
  const rng = asRng(seed);
  const { full, lit } = spire(x, y, h, rng, { width, litSide: light[0] >= 0 ? 1 : -1 });
  piece(ctx, full, { fill: vary(tone(palette, tones[0]), rng, 0.05), shadow });
  if (tones[1] != null) piece(ctx, lit, { fill: vary(tone(palette, tones[1]), rng, 0.06) });
}

// --- Forest band -------------------------------------------------------------------

// Linear interpolation through a polyline [[x, y], ...] sorted by x.
function polyAt(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const a = pts[i - 1], b = pts[i];
      return lerp(a[1], b[1], (x - a[0]) / ((b[0] - a[0]) || 1));
    }
  }
  return pts[pts.length - 1][1];
}

// Rows of trees along a ridge or shoreline. Back rows are smaller, higher and hazier;
// each row is one strip of paper with a contact shadow on the row behind.
//   base       y, or a polyline [[x, y], ...] the front row stands on
//   heights    [min, max] tree height of the front row
//   density    trees per tree-width (1 = tips just touching)
//   rows       number of rows; rowLift: how far up each row behind sits (default from heights)
//   colors     palette, or array of palettes picked at random (weights: matching array)
//   haze       haze colour; hazeAmt [back, front] amount
//   midMin     trees at least this tall get two-tone tiered detail (coniferMid)
//   skirt      depth of the dark ground strip under each row (px), or false
export function forestBand(ctx, opts = {}) {
  const {
    x0 = -220, x1 = 2140, base = 700, heights = [40, 90], density = 1, rows = 3,
    colors = FOLIAGE.forest, weights = null, haze = '#5a7090', hazeAmt = [0.55, 0.1], seed = 1,
    light = LIGHT, rowLift = null, backScale = 0.62, width = 0.25, skirt = true, midMin = 90,
    shadow = 0.4, bark = BARK.night, trunks = true, gaps = 0.55, tones = [0.18, 0.55], scatter = 0.3,
  } = opts;
  const rng = asRng(seed);
  const nz = noise(rng.int(1, 1e9));
  const baseAt = typeof base === 'number' ? () => base : (x) => polyAt(base, x);
  const pals = Array.isArray(colors) ? colors : [colors];
  const wsum = weights ? weights.reduce((a, b) => a + b, 0) : pals.length;
  const pickPal = () => {
    let r = rng.next() * wsum;
    for (let i = 0; i < pals.length; i++) { r -= weights ? weights[i] : 1; if (r <= 0) return i; }
    return pals.length - 1;
  };
  const [h0, h1] = heights;
  const lift = rowLift ?? h1 * 0.32;
  const litSide = light[0] >= 0 ? 1 : -1;
  const clockwise = (pts) => (area(pts) < 0 ? pts.slice().reverse() : pts);

  for (let r = 0; r < rows; r++) {
    const k = rows === 1 ? 1 : r / (rows - 1);
    const scale = lerp(backScale, 1, k);
    const dy = -lift * (rows - 1 - r);
    const hz = lerp(hazeAmt[0], hazeAmt[1], k);
    const hp = pals.map((p) => hazePalette(p, haze, hz));
    const spacing = ((h0 + h1) / 2) * scale * width * 2 * 0.55 / density;
    const trees = [];
    for (let x = x0 - spacing * rng.next(); x < x1 + spacing; x += spacing * rng.range(0.4, 1.5)) {
      // Clumps and clearings: slow noise thins the row out and swells or shrinks the trees.
      const clump = nz.n1(x * 0.007 + r * 13.7);
      if (clump < -gaps) continue;
      const h = lerp(h0, h1, Math.pow(rng.next(), 1.5)) * scale * (1 + 0.3 * clump);
      trees.push({
        x, y: baseAt(x) + dy + Math.pow(rng.next(), 1.5) * scatter * h, h, p: pickPal(), seed: rng.int(1, 1e9),
        w: width * rng.range(0.75, 1.3), shade: rng.range(-0.1, 0.1),
      });
    }
    trees.sort((a, b) => a.y - b.y);
    const far = trees.filter((t) => t.h < midMin), mid = trees.filter((t) => t.h >= midMin);
    const rowShadow = contact(shadow, clamp(h1 * scale * 0.05, 2, 8), light, clamp(h1 * scale * 0.035, 1.5, 6));

    // One strip of paper: the far silhouettes and the ground skirt as a single shape.
    const strip = new Path2D();
    const add = (pts) => {
      const p = clockwise(pts);
      strip.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) strip.lineTo(p[i][0], p[i][1]);
      strip.closePath();
    };
    if (skirt !== false) {
      const depth = typeof skirt === 'number' ? skirt : h1 * scale * 0.4;
      const top = [], bot = [];
      for (let x = x0; x <= x1 + 20; x += 20) {
        top.push([x, baseAt(x) + dy - h0 * scale * 0.12]);
        bot.push([x, baseAt(x) + dy + depth]);
      }
      add([...top, ...bot.reverse()]);
    }
    const shapes = far.map((t) => ({ t, ...spire(t.x, t.y, t.h, new RNG(t.seed), { width: t.w, litSide, trunk: trunks }) }));
    for (const s of shapes) add(s.full);
    ctx.save();
    setShadow(ctx, rowShadow);
    ctx.fillStyle = tone(hp[0], tones[0] * 0.6);
    ctx.fill(strip);
    clearShadow(ctx);
    ctx.restore();
    for (const s of shapes) {
      const p = hp[s.t.p];
      const rr = new RNG(s.t.seed + 1);
      piece(ctx, s.full, { fill: vary(tone(p, tones[0] + s.t.shade), rr, 0.05) });
      piece(ctx, s.lit, { fill: vary(tone(p, tones[1] + s.t.shade * 1.5), rr, 0.06) });
    }
    for (const t of mid) {
      coniferMid(ctx, t.x, t.y, t.h, {
        palette: hp[t.p], light, seed: t.seed, width: t.w, bark: hazePalette(bark, haze, hz),
        shadow: shadow * 0.9, trunkWidth: trunks ? 0.03 : 0, tones: [tones[0] + t.shade * 0.5, tones[1] + t.shade],
      });
    }
  }
}

// --- Big trunk and canopy (ref03) ------------------------------------------------

// A curtain of fronds hanging from boughs above the frame: rows of broad fronds rooted
// along a sagging line from x0 to x1, sweeping steeply down and outward, back rows
// darker, front rows catching the light.
//   y       root line (usually above the frame);  sag: how far its middle dips
//   len     [min, max] frond length;  rows: layers back to front;  density: fronds per 100 px per row
//   dir     -1 / 1 to sweep every frond one way, 0 to sweep away from the middle
//   kind    'spray' (pinnate fir sprays, ref03) or 'frond' (broad serrated blades)
export function canopy(ctx, opts = {}) {
  const {
    x0 = 0, x1 = 400, y = -40, sag = 40, len = [140, 260], rows = 3, density = 1.4, dir = 0,
    palette = FOLIAGE.night, light = LIGHT, seed = 1, bias = 0.55, grain = 0.45, kind = 'spray',
  } = opts;
  const rng = asRng(seed);
  for (let r = 0; r < rows; r++) {
    const k = rows === 1 ? 1 : r / (rows - 1);
    const count = Math.max(1, Math.round(((x1 - x0) / 100) * density));
    for (let i = 0; i < count; i++) {
      const u = (i + rng.range(0.1, 0.9)) / count;
      const rx = lerp(x0, x1, u);
      const ry = y + sag * Math.sin(Math.PI * u) + r * 34 + rng.range(-14, 14);
      const side = dir || (u < 0.5 ? -1 : 1) * (rng.chance(0.25) ? -1 : 1);
      const L = rng.range(len[0], len[1]) * lerp(0.85, 1, k);
      const t = bias - 0.25 * (1 - k) + 0.25 * side * light[0] + rng.range(-0.08, 0.08);
      const color = vary(tone(palette, t), rng, 0.05);
      if (kind === 'spray') {
        const a = rng.range(0.35, 0.9) + 0.2 * (1 - k), b = rng.range(0.25, 0.65);
        spray(ctx, rx, ry, L, {
          ang: side > 0 ? a : Math.PI - a, bend: side > 0 ? b : -b, color, light, seed: rng.int(1, 1e9),
          rootColor: mix(color, palette.deep, 0.55), tipColor: mix(color, palette.hi, 0.5), grain,
          flecks: Math.round((L * L * 0.3) / 1400), fleckColor: palette.fleck,
          shadow: contact(0.6, clamp(L * 0.05, 3, 12), light, clamp(L * 0.035, 2, 9)),
        });
        continue;
      }
      frond(ctx, rx, ry, L, L * rng.range(0.38, 0.5), {
        ang: rng.range(0.3, 0.85) + 0.15 * (1 - k), flip: side < 0, color, light, seed: rng.int(1, 1e9),
        rootColor: mix(color, palette.deep, 0.5), tipColor: mix(color, palette.hi, 0.55), under: mix(color, palette.deep, 0.35),
        shape: { droop: 0.2, teeth: clamp(Math.round(L / 16), 4, 20) }, grain,
        flecks: Math.round((L * L * 0.45) / 1400), fleckColor: palette.fleck,
        shadow: contact(0.6, clamp(L * 0.06, 3, 14), light, clamp(L * 0.04, 2, 10)),
      });
    }
  }
}

// Redwood trunk from yTop (usually above the frame) down to the ground at yBase, w wide,
// with a root flare, a warm rim on the lit flank, and optional canopy curtains on top.
//   lean     sideways offset of the top (px)
//   foliage  array of canopy() options drawn over the trunk
//   branches [{ y, side, len, width, ang, twigs }] bare branch stubs
export function bigTrunk(ctx, x, yTop, yBase, w, opts = {}) {
  const { bark = BARK.redwood, light = LIGHT, seed = 1, flare = 0.45, flareH = 0.2, lean = 0, rim = '#e89a52', foliage = [], branches = [] } = opts;
  const rng = asRng(seed);
  for (const b of branches) {
    const side = b.side ?? 1;
    branch(ctx, x + side * w * 0.42, b.y, b.len ?? w, b.width ?? w * 0.12, b.ang ?? (side > 0 ? -0.5 : Math.PI + 0.5), { bark, light, seed: rng.int(1, 1e9), twigs: b.twigs ?? 2 });
  }
  trunk(ctx, x, yTop, yBase, w, { bark, light, seed: rng.int(1, 1e9), taper: 0.9, flare, flareH, lean, rim, strips: Math.round(w / 24) });
  for (const c of foliage) canopy(ctx, { light, seed: rng.int(1, 1e9), ...c });
}

// --- Motion ---------------------------------------------------------------------------

// Slow sway angle (radians): two incommensurate sines and a little noise, so trees never
// visibly loop.
export function sway(t, { amp = 0.004, period = 6.5, phase = 0, seed = 1 } = {}) {
  const nz = noise(typeof seed === 'number' ? seed + 77 : seed);
  return amp * (0.6 * osc(t, period, phase) + 0.3 * osc(t, period * 0.61, phase + 0.37) + 0.3 * nz.n1(t * 0.3 + phase * 10));
}

// Layer anim(t) rotating a plane about (ox, oy), the base of the trunk.
export function swayAnim(ox, oy, opts = {}) {
  return (t) => ({ rot: sway(t, opts), ox, oy });
}

// Authored box a tree drawing fits in, with room for its rims and shadows.
export function treeBounds(x, y, h, { detail = 'near', width } = {}) {
  const w = width ?? (detail === 'near' ? 0.3 : detail === 'mid' ? 0.26 : 0.24);
  const reach = h * w * (detail === 'near' ? 1.12 : 1.1) + 24;
  return { x: x - reach, y: y - h * 1.04 - 20, w: reach * 2, h: h * 1.04 + 40 };
}

// Bake one tree onto its own plane, swaying about its base.
//   detail  'near' (conifer) | 'mid' (coniferMid) | 'far' (coniferFar); other opts go to the tree
//   sway    sway() options, or false
export function addTree(S, { z = 1000, x, y, h, detail = 'near', name = 'tree', res = 1, sway: sw = {}, alpha, shadow, ...tree }) {
  const draw = detail === 'near' ? conifer : detail === 'mid' ? coniferMid : coniferFar;
  const o = { light: S.light, ...tree };
  return S.plane(z, { name, ...treeBounds(x, y, h, { detail, width: tree.width }), res, draw: (ctx) => draw(ctx, x, y, h, o) }, {
    anim: sw === false ? null : swayAnim(x, y, { seed: tree.seed ?? 1, ...sw }),
    alpha, shadow,
  });
}

// A hero spruce whose whorls are separate sprites: the whole tree sways about its base
// and each whorl bobs about its root with a lag down the tree, as if a breeze were
// moving through it. Upper whorls cast real shadows onto the ones below.
//   sway  { amp, period } for the whole tree; tierSway { amp, period, lag } per whorl
export function addHeroConifer(S, { z = 900, x, y, h, name = 'hero-conifer', res = 1, sway: sw = {}, tierSway = {}, alpha, ...tree }) {
  const o = hazed({ palette: FOLIAGE.night, bark: BARK.night, light: S.light, seed: 1, ...tree });
  const plan = coniferPlan(x, y, h, o);
  const { R, apex } = plan;
  const body = S.sprite({
    name: `${name}-body`, x: x - R - 20, y: apex - 20, w: R * 2 + 40, h: y - apex + 40, res,
    draw: (ctx) => coniferBody(ctx, plan, o),
  });
  const tiers = plan.tiers.map((T, i) => ({
    T,
    s: S.sprite({
      name: `${name}-tier${i}`, x: T.cx - T.R * 1.15 - 16, y: T.cy - T.R * 0.2 - 14, w: T.R * 2.3 + 32, h: T.R * 1.2 + 40, res,
      draw: (ctx) => {
        frondTier(ctx, T.cx, T.cy, T.R, tierOpts(T, o));
        if (i === 0) leader(ctx, x, apex, T.R * 1.4, o.palette, o.light, new RNG(o.seed));
      },
    }),
  }));
  const { amp: tAmp = 0.012, period: tPeriod = 4.2, lag = 0.07 } = tierSway;
  return S.add({
    z, name, alpha,
    render(ctx, t, env) {
      const rot = sw === false ? 0 : sway(t, { seed: o.seed, ...sw });
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot); ctx.translate(-x, -y);
      drawSprites(ctx, [{ s: body }], env.shadow);
      for (let i = tiers.length - 1; i >= 0; i--) {
        const { T, s } = tiers[i];
        const r = sway(t, { amp: tAmp * (0.4 + 0.6 * T.u), period: tPeriod, phase: -i * lag, seed: o.seed + i * 13 });
        drawSprites(ctx, [{ s, x: T.cx, y: T.cy, ax: T.cx, ay: T.cy, rot: r }], env.shadow);
      }
      ctx.restore();
    },
  });
}

// Bake a forest band onto its own plane.
//   box  authored box { x, y, w, h } the band fits in (default: full width around its base)
export function addForestBand(S, { z = 2000, name = 'forest', res = 1, box = null, alpha, shadow, ...band }) {
  const b = band.base ?? 700;
  const ys = typeof b === 'number' ? [b] : b.map((p) => p[1]);
  const h1 = (band.heights ?? [40, 90])[1], rows = band.rows ?? 3;
  const lift = band.rowLift ?? h1 * 0.32;
  const top = Math.min(...ys) - h1 * 1.3 - lift * (rows - 1) - 20;
  const bottom = Math.max(...ys) + h1 * 0.6 + 30;
  const x0 = band.x0 ?? -220, x1 = band.x1 ?? 2140;
  const bx = box ?? { x: x0 - 40, y: top, w: x1 - x0 + 80, h: bottom - top };
  return S.plane(z, { name, ...bx, res, draw: (ctx) => forestBand(ctx, { light: S.light, ...band }) }, { alpha, shadow });
}
