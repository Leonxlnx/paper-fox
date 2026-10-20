// Firefly forest (s03): the forest floor. Far and mid undergrowth bands behind the fox,
// ferns crowding the redwood roots (they sway), the stream stepping down two little
// cascades between dark mossy rocks, the big mossy boulder the fox stands on and the
// mossy log on the right.

import { W } from '../core/stage.js';
import { RNG, noise } from '../core/rng.js';
import { piece, linear, radial, pathOf } from '../core/piece.js';
import { mix, vary, shade, rgba } from '../core/color.js';
import { clamp, lerp } from '../core/ease.js';
import { drawSprites } from '../core/sprite.js';
import { drawBoulder } from '../elements/terrain.js';
import { addWaterfall, addRipples, drawEddy, WATER } from '../elements/water.js';
import { TAU } from '../core/geom.js';
import { drawFern, drawShrub, drawLupine, drawDaisy, drawTuft, breeze } from '../elements/flora.js';
import { drawRedwood } from './s03-redwood.js';
import { addWaterGlints } from './s03-fireflies.js';

// Dark charcoal stone of the ref03 rocks (#1c1817 shade, #4a403a lit facets).
// Rock paper: fibre and crumple only (the boulder painter adds its own specks), which skips
// generating the granite texture just for this scene.
const ROCK_PAPER = [{ tex: 'fiber', amt: 0.9 }, { tex: 'crumple', amt: 0.6, scale: 0.35 }];
export const STONE = { ramp: ['#0a0909', '#141211', '#1e1a18', '#2a2421', '#38302c', '#4a403a'], fleck: '#c8a458', moss: ['#55661f', '#86962c', '#b2b440'] };
// Moss from shade to the star-lit tips (ref: #3f5a1e .. #c8c454).
const MOSS = ['#262c0f', '#424a17', '#646a21', '#88882c', '#aaa53a', '#cbc252'];
// Night stream: deep blue with pale threads and the cream sheen of the star (ref03).
const STREAM = { ...WATER.night, deep: '#0a2350', base: '#15386c', mid: '#22508a', light: '#3d6ea6', pale: '#8eaeca', foam: '#dbe6ee', foamShade: '#8ea2bf', glow: ['#d8c48e', '#efdcae', '#fff4d8'] };


// Undergrowth palettes: the far band pushed back into the blue night, the mid band warmer.
const FAR_FLORA = {
  fern: { light: '#5a7240', mid: '#465f36', teal: '#1f4844', dark: '#163329' },
  shrub: { top: '#5a7038', mid: '#465c30', low: '#334a28', stem: '#3a522a', dark: '#1c3220' },
  leaf: { light: '#4f6a48', mid: '#3a5640', dark: '#1c3a32', deep: '#0e2620' },
  lupine: { florets: ['#3e3488', '#483c96', '#5446a2'], banner: '#6e62b0', light: '#8e84c8', dark: '#201a50', stem: '#3c5430' },
};
const MID_FLORA = {
  fern: { light: '#a4ac40', mid: '#7a9234', teal: '#2c6c5e', dark: '#21483a' },
  shrub: { top: '#8ea444', mid: '#6c8838', low: '#4c6a30', stem: '#5f7a34', dark: '#29421f' },
  leaf: { light: '#7f9a5a', mid: '#4f7a4c', dark: '#24503e', deep: '#12332c' },
  daisy: { petal: '#ece4d6', tip: '#f6f0e6', shade: '#a9a6b8', center: '#f0a82a' },
  lupine: { florets: ['#5a44b4', '#6a52c0', '#7a62c8'], banner: '#9a86dc', light: '#bfb0ee', dark: '#2c2270', bud: '#6a52b8', budTip: '#a08ad8' },
};

// drawFern takes a CSS colour, not a palette key: resolve keys here.
const fc = (pal, c) => pal.fern[c] ?? c;

function fillPoly(ctx, pts, fill, ox = 0, oy = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
  ctx.closePath();
  ctx.fill();
}

// A cheap fern for the undergrowth bands: a curved rachis with serrated pinnae, each
// creased into a lit and a shaded half over a dark offset (no blur), so dozens bake fast.
function quickFern(ctx, { x, y, len, rot = 0, curl = 0.3, color, light, rng, pinnae = 13 }) {
  const rach = [];
  let px = x, py = y;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, a = rot + curl * t * t * 1.6;
    if (i) { px += (Math.sin(a) * len) / 20; py -= (Math.cos(a) * len) / 20; }
    rach.push([px, py, a]);
  }
  const lit = shade(color, 0.14), dark = shade(color, -0.3);
  for (let i = 0; i < pinnae; i++) {
    const t = 0.08 + 0.88 * (i / (pinnae - 1));
    const prof = t < 0.3 ? 0.65 + 0.35 * (t / 0.3) : Math.pow((1 - t) / 0.7, 0.85);
    const k = Math.min(19, Math.floor(t * 20)), f = t * 20 - k;
    const bx = lerp(rach[k][0], rach[k + 1][0], f), by = lerp(rach[k][1], rach[k + 1][1], f), a = rach[k][2];
    for (const s of [-1, 1]) {
      const pl = len * 0.27 * Math.max(0.12, prof) * rng.range(0.85, 1.08);
      const pa = a + s * (Math.PI / 2 - 0.5);
      const dx = Math.sin(pa), dy = -Math.cos(pa), nx = -dy, ny = dx;
      const wdt = pl * 0.21, teeth = Math.max(3, Math.round(pl / 10));
      const plus = [], minus = [];
      for (let j = 1; j <= teeth; j++) {
        const u = j / (teeth + 0.4), w = wdt * (1 - u * 0.8) * (j % 2 ? 1 : 0.68);
        plus.push([bx + dx * pl * u + nx * w, by + dy * pl * u + ny * w]);
        minus.push([bx + dx * pl * u - nx * w, by + dy * pl * u - ny * w]);
      }
      const tip = [bx + dx * pl, by + dy * pl];
      const pts = [[bx, by], ...plus, tip, ...minus.reverse()];
      fillPoly(ctx, pts, 'rgba(3,9,5,0.5)', 1.5, 2.5);
      const c = vary(t > 0.55 ? lit : color, rng, 0.05);
      fillPoly(ctx, pts, c);
      // The half turned away from the light is creased into shade.
      const away = nx * light[0] + ny * light[1] > 0 ? minus : plus;
      fillPoly(ctx, [[bx, by], ...(away === minus ? minus.slice().reverse() : plus), tip], rgba(dark, 0.45));
    }
  }
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.2, len * 0.012);
  ctx.beginPath();
  rach.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
  ctx.stroke();
}

// --- small geometry helpers ---------------------------------------------------------

function ellipsePts(cx, cy, rx, ry, n = 14, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

// The upper (or lower) silhouette of a polygon sampled every `step` px in x.
function chain(poly, step, upper = true) {
  let x0 = Infinity, x1 = -Infinity;
  for (const [x] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const out = [];
  for (let x = x0 + 2; x <= x1 - 2; x += step) {
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
      if ((ax - x) * (bx - x) > 0 || ax === bx) continue;
      const y = ay + ((x - ax) / (bx - ax)) * (by - ay);
      if (best === null || (upper ? y < best : y > best)) best = y;
    }
    if (best !== null) out.push([x, best]);
  }
  return out;
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Fuzzy moss: hundreds of tiny upright tufts inside a polygon, mottled by noise and
// brighter toward the light.
function mossFur(ctx, poly, rng, { density = 1, lit = 1, seed = 1, size = 1 } = {}) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const nz = noise(seed);
  const n = Math.round((((x1 - x0) * (y1 - y0)) / 46) * density);
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), y = rng.range(y0, y1);
    if (!inside(poly, x, y)) continue;
    const v = clamp(0.38 + 0.4 * nz.n2(x * 0.018, y * 0.04) + rng.range(-0.22, 0.22) + 0.14 * lit - 0.25 * ((y - y0) / (y1 - y0 + 1)));
    const h = rng.range(4, 10) * size, w = rng.range(2, 4.5) * size, lean = rng.range(-2.5, 2.5);
    ctx.fillStyle = MOSS[clamp(Math.round(v * 5), 0, 5)];
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + lean, y - h); ctx.fill();
  }
}

// --- moss ----------------------------------------------------------------------------

// A mossy band laid along an edge polyline (left to right): a torn cap rising `cap` px
// above it, cushions on the cap and a fringe of strands hanging `hang` px below it.
function mossDrape(ctx, edge, rng, { cap = 18, hang = 1, lit = 1, seed = 1, strands = 1 } = {}) {
  if (edge.length < 2) return;
  const nz = noise(seed);
  const top = edge.map(([x, y], i) => [x, y - cap * (0.55 + 0.6 * (0.5 + 0.5 * nz.n1(i * 0.31)))]);
  const bot = edge.map(([x, y], i) => [x, y + 3 + 6 * (0.5 + 0.5 * nz.n1(i * 0.5 + 9))]).reverse();
  const yT = Math.min(...top.map((p) => p[1])), yB = Math.max(...edge.map((p) => p[1])) + 10;
  piece(ctx, [...top, ...bot], {
    fill: linear(ctx, 0, yT, 0, yB, [[0, mix(MOSS[3], MOSS[5], 0.5 * lit)], [0.55, MOSS[3]], [1, MOSS[1]]]),
    torn: { amp: 3.5, freq: 0.09, fine: 1.2, seed: rng.int(1, 1e6) },
    shadow: { color: 'rgba(8,6,0,0.55)', blur: 5, x: 0, y: 3 },
  });
  // Hanging strands: short most of the way, long drapes in clumps.
  for (let i = 0; i < edge.length - 1; i++) {
    const [ax, ay] = edge[i], [bx, by] = edge[i + 1];
    const seg = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round((seg / 6) * strands));
    for (let k = 0; k < n; k++) {
      const u = (k + rng.next()) / n;
      const sx = ax + (bx - ax) * u, sy = ay + (by - ay) * u + 4;
      const clump = Math.max(0, nz.n1(sx * 0.012 + 3));
      const len = (rng.range(6, 18) + clump * clump * rng.range(20, 70)) * hang;
      const w = rng.range(3, 7);
      const drift = rng.range(-0.15, 0.15) * len;
      const tone = MOSS[clamp(Math.round(rng.range(0.6, 2.6) + lit * 0.5), 0, 4)];
      ctx.fillStyle = 'rgba(6,5,0,0.45)';
      ctx.beginPath(); ctx.moveTo(sx - w / 2 + 1.5, sy + 2); ctx.lineTo(sx + w / 2 + 1.5, sy + 2); ctx.lineTo(sx + drift + 1.5, sy + len + 3); ctx.fill();
      ctx.fillStyle = vary(tone, rng, 0.06);
      ctx.beginPath(); ctx.moveTo(sx - w / 2, sy - 2); ctx.lineTo(sx + w / 2, sy - 2); ctx.lineTo(sx + drift * 0.5 + w * 0.2, sy + len * 0.55); ctx.lineTo(sx + drift, sy + len); ctx.fill();
    }
  }
  mossFur(ctx, [...top, ...bot], rng, { lit, seed: seed + 5, size: 0.9 });
  // A few cushions on the cap, brighter toward the top.
  const nC = Math.round(edge.length * 0.12);
  for (let i = 0; i < nC; i++) {
    const j = rng.int(0, edge.length - 1);
    const [x, y] = edge[j];
    const r = rng.range(5, 12);
    const cy = y - rng.range(0, cap * 0.9);
    const v = clamp(0.35 + 0.5 * lit * (y - cy) / cap + rng.range(-0.2, 0.25));
    piece(ctx, ellipsePts(x + rng.range(-4, 4), cy, r, r * 0.6, 10), {
      fill: vary(MOSS[clamp(Math.round(1 + v * 4), 1, 5)], rng, 0.05), torn: { amp: 1.6, freq: 0.3, seed: rng.int(1, 1e6) },
      shadow: { color: 'rgba(8,6,0,0.4)', blur: 3, x: 0, y: 2 },
    });
  }
}

// Moss over a flat rock top: a torn cap inset in the plate plus cushions, then a drape
// along its front edge.
const PLATE_BANDS = [[0.04, 0.4, 62], [0.5, 0.9, 48], [0.2, 0.55, 120]];
function mossPlate(ctx, plate, rng, { lit = 1, seed = 1, hang = 1, bands = PLATE_BANDS, bandCap = 9, bandLit = 0.6, cushion = 1 } = {}) {
  const cx = plate.reduce((a, p) => a + p[0], 0) / plate.length;
  const cy = plate.reduce((a, p) => a + p[1], 0) / plate.length;
  const pts = plate.map(([x, y]) => [cx + (x - cx) * 0.97, cy + (y - cy) * 0.9 - 2]);
  const ys = pts.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const xs = pts.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  piece(ctx, pts, {
    fill: linear(ctx, 0, y0, 0, y1, [[0, mix(MOSS[2], MOSS[3], lit)], [1, MOSS[1]]]),
    torn: { amp: 6, freq: 0.05, fine: 1.6, seed: rng.int(1, 1e6) },
    shadow: { color: 'rgba(8,6,0,0.5)', blur: 6, x: 0, y: 3 },
  });
  mossFur(ctx, pts, rng, { lit, seed: seed + 3, density: 1.2 });
  const n = Math.round((((x1 - x0) * (y1 - y0)) / 4000) * cushion);
  for (let i = 0; i < n; i++) {
    const x = rng.range(x0, x1), y = rng.range(y0, y1);
    const r = rng.range(7, 18);
    const v = clamp(0.5 + 0.35 * lit + rng.range(-0.35, 0.3) - 0.3 * (y - y0) / (y1 - y0 + 1));
    piece(ctx, ellipsePts(x, y, r, r * 0.5, 10), {
      fill: vary(MOSS[clamp(Math.round(1 + v * 4), 1, 5)], rng, 0.05), torn: { amp: 2, freq: 0.25, seed: rng.int(1, 1e6) },
      shadow: { color: 'rgba(8,6,0,0.4)', blur: 3, x: 0, y: 2 },
    });
  }
  const front = chain(pts, 9, false);
  mossDrape(ctx, front, rng, { cap: 10, hang, lit, seed });
  // Patches of moss lower on the face, hanging in long fringes (ref03 boulder).
  for (const [a, b, dy] of bands) {
    const k0 = Math.floor(front.length * a), k1 = Math.ceil(front.length * b);
    mossDrape(ctx, front.slice(k0, k1).map(([x, y], i) => [x, y + dy + 10 * Math.sin(i * 0.4)]), rng, { cap: bandCap, hang: hang * 0.8, lit: lit * bandLit, seed: seed + dy });
  }
}

// A boulder with moss on its crown (flat rocks get a moss plate, round ones a drape
// following their upper silhouette).
function mossyRock(ctx, r, rng, light) {
  const g = drawBoulder(ctx, { palette: STONE, light, tilt: 0.28, contrast: 1.45, specks: 0.7, moss: 0.08, ...r });
  if (r.mossPlate && g.plate) mossPlate(ctx, g.plate, rng, { lit: r.lit ?? 1, seed: rng.int(1, 1e6), hang: r.hang ?? 1, ...(r.plateMoss ?? {}) });
  else if (r.mossTop) {
    const up = chain(g.outline, 9, true);
    const k0 = Math.floor(up.length * (r.mossFrom ?? 0.08)), k1 = Math.ceil(up.length * (r.mossTo ?? 0.92));
    mossDrape(ctx, up.slice(k0, k1).map(([x, y]) => [x, y + (r.mossTop ?? 10)]), rng, { cap: r.mossTop ?? 10, lit: r.lit ?? 1, seed: rng.int(1, 1e6), hang: r.hang ?? 0.8 });
  }
  return g;
}

function rockBox(rocks, pad = 60) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const r of rocks) {
    x0 = Math.min(x0, r.x - r.w * 0.62); x1 = Math.max(x1, r.x + r.w * 0.62);
    y0 = Math.min(y0, r.y - r.h - r.w * 0.2); y1 = Math.max(y1, r.y + r.w * 0.2 + 90);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

function rockPlane(S, z, name, rocks, extra) {
  const box = rockBox(rocks);
  return S.plane(z, {
    name, ...box, res: z < 900 ? 1.2 : 1, mat: ROCK_PAPER,
    edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.7 }, shadow: { blur: 14, alpha: 0.6 },
    draw(ctx) {
      const rng = new RNG(`s03-${name}`);
      for (const r of [...rocks].sort((a, b) => a.y - b.y)) mossyRock(ctx, r, rng, S.light);
      extra?.(ctx, rng);
    },
  }, { tags: ['rocks'] });
}

// --- swaying ferns -------------------------------------------------------------------

function fernSprite(S, f, palette) {
  const L = f.len, pad = L * 0.8;
  return S.sprite({
    name: 'fern', x: f.x - pad, y: f.y - L * 1.12, w: pad * 2, h: L * 1.12 + 40,
    edge: { width: 1.2, hi: 0.28, lo: 0.22, soft: 0.6 }, shadow: { blur: 9, alpha: 0.5 },
    draw(ctx) { drawFern(ctx, { palette, light: S.light, seed: f.seed, x: f.x, y: f.y, len: L, rot: f.rot ?? 0, curl: f.curl ?? 0.3, pinnae: 14, color: fc(palette, f.color ?? 'mid') }); },
  });
}

function addSwayingFerns(S, { z, name, ferns, palette, tags = [] }) {
  const items = ferns.map((f, i) => ({ f, s: fernSprite(S, { seed: 40 + i, ...f }, palette), phase: i * 0.37 }));
  return S.add({
    name, z, tags,
    render(ctx, t, env) {
      drawSprites(ctx, items.map(({ f, s, phase }) => ({ s, ax: f.x, ay: f.y, x: f.x, y: f.y, rot: breeze(t, f.x, { phase, amp: 0.028 }) })), env.shadow);
    },
  });
}

// --- the stream --------------------------------------------------------------------------

// Stream water (ref03): mid blue brightening toward the light, swirling light blue strips that
// curl at their ends, broad gold patches where the star and the fireflies are mirrored, dark
// ripples in the shade under the banks.
const RIVER = { deep: '#10305e', base: '#1b4c8e', mid: '#2864a8', light: '#4686c8', pale: '#86bde8', ice: '#c6e3f6', foam: '#eef6fc', shadow: '#030a1c' };
const GOLD = ['#a07a3c', '#d2a656', '#efcb80', '#fbe5b0', '#fff6dc'];
// Cascades: pale blue and white bands over a light blue sheet.
const FALL = { ...STREAM, deep: '#1c4a88', base: '#2c64a6', mid: '#4583c4', light: '#6eaade', pale: '#acd4f2', foam: '#eef6fc' };
const FALL_BANDS = ['light', 'pale', 'mid', 'foam', 'light', 'pale', 'base', 'light', 'foam', 'pale', 'mid'];

// A tapered strip along a curve that bends more and more toward its end, so it can finish in a
// swirl's hook. The curve is flattened vertically (the water is seen at a low angle).
function curlStrip(x, y, len, th, { ang = 0, bend = 0, curl = 0, taper = 0.6, flat = 0.55, n = 26 } = {}) {
  const c = [];
  let px = x, py = y;
  for (let i = 0; i <= n; i++) {
    const f = i / n, a = ang + bend * f + curl * f * f * f;
    if (i) { px += (Math.cos(a) * len) / n; py += (Math.sin(a) * len * flat) / n; }
    c.push([px, py, a]);
  }
  const outer = [], inner = [];
  c.forEach(([cx, cy, a], i) => {
    const tx = Math.cos(a), ty = Math.sin(a) * flat, tl = Math.hypot(tx, ty) || 1;
    const w = th * 0.5 * Math.pow(Math.sin((Math.PI * i) / n), taper);
    outer.push([cx - (ty / tl) * w, cy + (tx / tl) * w]);
    inner.push([cx + (ty / tl) * w, cy - (tx / tl) * w]);
  });
  return [...outer, ...inner.reverse()];
}

// A strip bowed into an arch (arch > 0 bulges up) from xa to xb.
function arcStrip(xa, xb, y, th, arch, taper = 0.45) {
  const top = [], bot = [];
  for (let i = 0; i <= 24; i++) {
    const f = i / 24, x = lerp(xa, xb, f), yy = y - arch * Math.sin(Math.PI * f);
    const w = th * 0.5 * Math.pow(Math.sin(Math.PI * f), taper);
    top.push([x, yy - w]);
    bot.push([x, yy + w]);
  }
  return [...top, ...bot.reverse()];
}

const szAt = (y) => lerp(0.4, 1.5, clamp((y - 540) / 520));
const sgn = (rng) => (rng.chance(0.5) ? 1 : -1);

// The stream at rest, top to bottom: the source run, the run to the first cascade, the upper
// pool and the wide lower pool. skip: boxes where the bank leaves the water open (the lips of
// the cascades); glints: warm reflections of the fireflies; lips / churn: [x, y, width] of
// the cascade lips leaving a pool and the white water where one lands; swirls: [x, y, r].
const POOLS = {
  source: {
    z: 1700, name: 'source', shimmer: 4, shape: [[1312, 540], [1324, 540], [1334, 566], [1330, 597], [1292, 599], [1300, 566]],
    light: { x: 1314, width: 14, widthBottom: 24 }, skip: [[1288, 1336, 586, 612]], lips: [[1311, 595, 34]],
  },
  run: {
    z: 1650, name: 'run', shimmer: 8, shape: [[1291, 601], [1331, 599], [1340, 628], [1338, 670], [1222, 670], [1234, 644], [1266, 620]],
    light: { x: 1292, width: 26, widthBottom: 50 }, skip: [[1285, 1337, 590, 612], [1212, 1346, 660, 682]],
    glints: [{ x: 1302, y: 646, w: 34 }], lips: [[1276, 666, 104]], churn: [[1311, 606, 40]], swirls: [[1246, 652, 12]],
  },
  upper: {
    z: 1300, name: 'pool-upper', shimmer: 22,
    shape: [[1218, 707], [1340, 705], [1428, 722], [1452, 760], [1422, 800], [1330, 818], [1200, 826], [1100, 824], [1040, 806], [1050, 768], [1120, 730]],
    light: { x: 1262, width: 80, widthBottom: 120 }, skip: [[1208, 1346, 698, 716], [1026, 1194, 800, 838]],
    glints: [{ x: 1120, y: 772, w: 60 }, { x: 1392, y: 752, w: 50 }],
    lips: [[1120, 816, 146]], churn: [[1276, 716, 112]], swirls: [[1150, 764, 26], [1372, 774, 24], [1076, 796, 18]],
  },
  lower: {
    z: 1100, name: 'pool-lower', shimmer: 56,
    shape: [[1000, 874], [1110, 868], [1230, 872], [1330, 886], [1440, 904], [1490, 960], [1520, 1060], [1560, 1200], [1580, 1290], [820, 1290], [850, 1150], [880, 1020], [912, 930]],
    light: { x: 1205, width: 120, widthBottom: 200 }, skip: [[1020, 1200, 856, 892]],
    glints: [{ x: 1350, y: 962, w: 80 }, { x: 1130, y: 1040, w: 90 }, { x: 1300, y: 1050, w: 70 }, { x: 980, y: 930, w: 60 }],
    churn: [[1104, 886, 172]], swirls: [[978, 948, 30], [1392, 934, 28], [1290, 1016, 40], [1010, 1052, 38], [1430, 1052, 34]],
  },
};

function bounds(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

// The pool's water at rest, clipped to its shape.
function paintWater(ctx, P, rng, light) {
  const Lt = P.light, sh = P.shape;
  const { x0, x1, y0, y1 } = bounds(sh);
  const yEnd = Math.min(y1, 1160);
  const spreadAt = (y) => lerp(Lt.width, Lt.widthBottom, clamp((y - y0) / (yEnd - y0 + 1)));
  const drop = (a = 0.45) => ({ color: rgba(RIVER.shadow, a), blur: 2, x: 0.6, y: 1.4 });
  ctx.save();
  ctx.clip(pathOf(sh));

  // Wash: light blue at the far end where the run comes in, deepening toward us, brightened
  // round the mirrored light; darker in the shade under the banks.
  ctx.fillStyle = linear(ctx, 0, y0, 0, yEnd, [[0, RIVER.light], [0.3, RIVER.mid], [1, mix(RIVER.base, RIVER.deep, 0.3)]]);
  ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
  ctx.fillStyle = radial(ctx, Lt.x, lerp(y0, yEnd, 0.35), 0, spreadAt(yEnd) * 2, [[0, rgba(GOLD[2], 0.28)], [0.45, rgba(RIVER.light, 0.12)], [1, rgba(RIVER.light, 0)]]);
  ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
  const bankW = 10 * szAt((y0 + yEnd) / 2);
  ctx.lineJoin = 'round';
  for (const [w, a] of [[bankW * 3.2, 0.35], [bankW * 1.6, 0.5]]) {
    ctx.strokeStyle = rgba(RIVER.deep, a); ctx.lineWidth = w;
    ctx.stroke(pathOf(sh));
  }

  // Flow strips: light blue and pale arcs everywhere, many ending in a curl.
  for (let y = y0 + 2; y < yEnd;) {
    const sz = szAt(y);
    const n = Math.max(1, Math.round((x1 - x0) / (70 * sz)));
    for (let k = 0; k < n; k++) {
      const x = rng.range(x0 - 40 * sz, x1 - 10 * sz);
      const len = rng.range(30, 120) * sz, th = rng.range(3, 8) * sz;
      const c = rng.pick(['light', 'light', 'mid', 'pale', 'light', 'pale', 'deep', 'deep', 'ice']);
      const curl = rng.chance(0.4) ? sgn(rng) * rng.range(2.6, 5) : 0;
      piece(ctx, curlStrip(x, y + rng.range(-3, 3) * sz, len, th, { ang: rng.range(-0.3, 0.3), bend: rng.range(-0.6, 0.6), curl }), {
        fill: c === 'deep' ? rgba(RIVER.deep, 0.75) : vary(RIVER[c], rng, 0.05), shadow: c === 'deep' ? null : drop(), torn: { amp: 0.5 * sz, freq: 0.14, seed: rng.int(1, 1e6) },
      });
    }
    y += rng.range(6, 13) * sz;
  }

  // Dark ripples: thin navy cuts between the lit strips, thicker toward the banks.
  for (let y = y0 + 4; y < yEnd;) {
    const sz = szAt(y), sp = spreadAt(y);
    const n = Math.max(1, Math.round((x1 - x0) / (60 * sz)));
    for (let k = 0; k < n; k++) {
      const x = rng.range(x0 - 20 * sz, x1), len = rng.range(26, 90) * sz;
      const edge = clamp(Math.abs(x + len / 2 - Lt.x) / (sp * 1.5));
      piece(ctx, curlStrip(x, y + rng.range(-3, 3) * sz, len, rng.range(1.6, 3.2 + 2 * edge) * sz, { ang: rng.range(-0.2, 0.2), bend: rng.range(-0.5, 0.5), curl: rng.chance(0.25) ? sgn(rng) * rng.range(2.5, 4.5) : 0, taper: 0.5 }), {
        fill: rgba(edge > 0.5 ? RIVER.deep : RIVER.base, 0.85),
      });
    }
    y += rng.range(5, 10) * sz;
  }

  // Swirls in the eddies beside the current.
  for (const [x, y, r] of P.swirls ?? []) {
    drawEddy(ctx, x, y, r, { flat: 0.42, rings: 4, spin: 1.8, palette: RIVER, seed: rng.int(1, 1e6), light });
  }

  // Gold: the star and the fireflies mirrored in broad broken patches down the middle.
  for (let y = y0 + 3; y < yEnd;) {
    const sz = szAt(y), sp = spreadAt(y);
    const n = 2 + (rng.chance(0.6) ? 1 : 0) + (sz > 0.9 && rng.chance(0.6) ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const off = rng.gauss() * sp * 0.4;
      const heat = clamp(1 - Math.abs(off) / (sp * 0.85));
      const len = sp * rng.range(0.4, 1.05) * (rng.chance(0.15) ? 1.4 : 1), th = rng.range(5, 13) * sz;
      const fill = GOLD[clamp(Math.round(0.8 + heat * 3.2 + rng.range(-0.6, 0.6)), 0, 4)];
      const curl = rng.chance(0.12) ? sgn(rng) * rng.range(2, 3.5) : 0;
      piece(ctx, curlStrip(Lt.x + off - len / 2, y + rng.range(-3, 3) * sz, len, th, { ang: rng.range(-0.12, 0.12), bend: rng.range(-0.35, 0.35), curl, taper: 0.4 }), {
        fill: vary(fill, rng, 0.04), shadow: { color: 'rgba(30,18,0,0.35)', blur: 2, x: 0.5, y: 1.2 }, torn: { amp: 0.6 * sz, freq: 0.12, seed: rng.int(1, 1e6) },
      });
    }
    y += rng.range(7, 16) * sz;
  }
  // Warm flecks of the fireflies scattered over the blue.
  for (const g of P.glints ?? []) {
    const sz = szAt(g.y);
    for (let k = 0; k < 3; k++) {
      const len = g.w * rng.range(0.25, 0.6), y = g.y + rng.range(-6, 6) * sz;
      piece(ctx, curlStrip(g.x - len / 2 + rng.range(-10, 10) * sz, y, len, rng.range(3, 6) * sz, { bend: rng.range(-0.4, 0.4) }), { fill: GOLD[rng.int(2, 4)], shadow: { color: 'rgba(30,18,0,0.3)', blur: 2, x: 0.5, y: 1 } });
    }
  }

  // Lips: the water brightens and bows over the edge of each cascade.
  for (const [x, y, w] of P.lips ?? []) {
    const sz = szAt(y);
    for (let k = 0; k < 4; k++) {
      const ww = w * (1.05 - k * 0.12), yy = y - (3 + k * 5) * sz;
      piece(ctx, arcStrip(x - ww / 2, x + ww / 2, yy, (5 - k) * sz, 5 * sz), { fill: [RIVER.foam, RIVER.ice, RIVER.pale, RIVER.light][k], shadow: drop(0.35) });
    }
  }
  // Churn: white water curling outward where a cascade lands.
  for (const [x, y, w] of P.churn ?? []) {
    const sz = szAt(y);
    for (let k = 0; k < 5; k++) {
      const ww = w * (0.95 + k * 0.14), yy = y + (2 + k * 6) * sz;
      piece(ctx, arcStrip(x - ww / 2, x + ww / 2, yy, (6 - k * 0.8) * sz, -4 * sz), { fill: [RIVER.foam, RIVER.ice, RIVER.foam, RIVER.pale, RIVER.ice][k], shadow: drop(0.4) });
    }
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const len = w * rng.range(0.3, 0.45);
        const ang = s > 0 ? 0.15 : Math.PI - 0.15;
        piece(ctx, curlStrip(x + s * w * (0.25 + k * 0.12), y + (8 + k * 12) * sz, len, (5 - k) * sz, { ang, curl: s * 3.6, taper: 0.5 }), { fill: k ? RIVER.ice : RIVER.foam, shadow: drop(0.4) });
      }
    }
  }
  ctx.restore();
}

// Highlights that sway slowly side to side and pulse: gold down the light, pale blue elsewhere.
function addShimmer(S, P) {
  const rng = new RNG(`s03-${P.name}-shimmer`);
  const { x0, x1, y0, y1 } = bounds(P.shape);
  const yEnd = Math.min(y1, 1150), Lt = P.light;
  const items = [];
  for (let i = 0; i < P.shimmer; i++) {
    const gold = rng.chance(0.55);
    const y = rng.range(y0 + 4, yEnd - 4), sz = szAt(y);
    const sp = lerp(Lt.width, Lt.widthBottom, clamp((y - y0) / (yEnd - y0 + 1)));
    const x = gold ? Lt.x + rng.gauss() * sp * 0.4 : rng.range(x0, x1);
    const len = rng.range(14, 46) * sz, th = rng.range(2, 4.5) * sz;
    if (!inside(P.shape, x - len / 2, y) || !inside(P.shape, x + len / 2, y)) continue;
    const fill = gold ? rng.pick([GOLD[3], GOLD[4], GOLD[2]]) : rng.pick([RIVER.pale, RIVER.ice]);
    const pts = curlStrip(x - len / 2, y, len, th, { bend: rng.range(-0.4, 0.4) });
    const s = S.sprite({
      name: 'shimmer', x: x - len / 2 - 6, y: y - th - len * 0.2 - 6, w: len + 12, h: th * 2 + len * 0.4 + 12, mat: 'smooth', res: 1.5,
      edge: { width: 0.8, hi: 0.4, lo: 0.2, soft: 0 }, shadow: { blur: 1.6 },
      draw: (c) => piece(c, pts, { fill, torn: { amp: 0.35, freq: 0.15, seed: i + 1 } }),
    });
    items.push({ s, x, y, amp: 2 + 5 * sz, period: rng.range(3, 6.5), phase: rng.next(), pulse: rng.range(0.3, 0.7) });
  }
  return S.add({
    name: `${P.name}-shimmer`, z: P.z - 0.5, tags: ['stream'],
    render(ctx, t) {
      drawSprites(ctx, items.map((it) => {
        const a = TAU * (t / it.period + it.phase);
        return { s: it.s, ax: it.x, ay: it.y, x: it.x + Math.sin(a) * it.amp, y: it.y, alpha: 1 - it.pulse * (0.5 + 0.5 * Math.sin(a * 1.43 + it.phase * 9)) };
      }), { dx: 0.6, dy: 1.3, alpha: 0.35 });
    },
  });
}

// A pool: its water, the moving highlights and firefly glints, and a bank of dark pebbles.
function addPool(S, P) {
  const { x0, x1, y0, y1 } = bounds(P.shape);
  S.plane(P.z, {
    name: `${P.name}-water`, x: x0 - 4, y: y0 - 4, w: x1 - x0 + 8, h: y1 - y0 + 8, mat: 'smooth', edge: false, shadow: false, res: 1.2,
    draw(ctx) { paintWater(ctx, P, new RNG(`s03-${P.name}-water`), S.light); },
  }, { tags: ['stream'] });
  addShimmer(S, P);
  if (P.glints) addWaterGlints(S, { z: P.z - 1, name: `${P.name}-glints`, glints: P.glints, tags: ['stream'] });
  // Bank: pebbles along every edge except where a cascade enters or leaves, bigger toward us.
  S.plane(P.z - 2, {
    name: `${P.name}-bank`, x: x0 - 50, y: y0 - 50, w: x1 - x0 + 100, h: Math.min(y1, 1200) - y0 + 100, mat: ROCK_PAPER,
    edge: { width: 1.2, hi: 0.32, lo: 0.3, soft: 0.6 }, shadow: { blur: 8, alpha: 0.55 },
    draw(ctx) {
      const rng = new RNG(`s03-${P.name}-bank`);
      const sh = P.shape;
      for (let i = 0; i < sh.length; i++) {
        const [ax, ay] = sh[i], [bx, by] = sh[(i + 1) % sh.length];
        const len = Math.hypot(bx - ax, by - ay);
        for (let s = rng.range(0, 8); s < len;) {
          const x = ax + ((bx - ax) * s) / len, y = ay + ((by - ay) * s) / len;
          const sz = szAt(y);
          s += rng.range(18, 46) * sz;
          if (rng.chance(0.3)) continue;
          if (y > 1180 || (P.skip ?? []).some(([a, b, c, d]) => x > a && x < b && y > c && y < d)) continue;
          const r = rng.range(8, 19) * sz * (rng.chance(0.25) ? 1.8 : 1), cx = x + rng.range(-3, 3) * sz, cy = y + rng.range(-1, 3) * sz;
          const pts = ellipsePts(cx, cy, r, r * rng.range(0.45, 0.68), 9, rng.range(-0.35, 0.35));
          piece(ctx, pts, {
            fill: linear(ctx, cx, cy - r * 0.6, cx, cy + r * 0.5, [vary(STONE.ramp[5], rng, 0.06), STONE.ramp[2], STONE.ramp[0]]),
            torn: { amp: 1.2 * sz, freq: 0.2, seed: rng.int(1, 1e6) }, shadow: { color: 'rgba(0,4,16,0.6)', blur: 4, x: 0, y: 2 },
          });
          // Cream catch-light of the star on the wet tops, and a little moss on some.
          if (rng.chance(0.4)) piece(ctx, ellipsePts(cx - r * 0.1, cy - r * 0.32, r * 0.45, r * 0.12, 8), { fill: rgba('#d8c08e', 0.45) });
          else if (rng.chance(0.3)) piece(ctx, ellipsePts(cx, cy - r * 0.35, r * 0.6, r * 0.2, 8), { fill: vary(MOSS[3], rng, 0.08), torn: { amp: 1, freq: 0.3, seed: rng.int(1, 1e6) } });
        }
      }
    },
  }, { tags: ['stream', 'rocks'] });
}

// A cascade between two pools, with rings spreading where it lands.
function addStep(S, o) {
  for (const L of addWaterfall(S, { palette: FALL, bands: FALL_BANDS, speed: 70, accel: 0.3, mist: false, foam: false, ...o }).layers) L.tags.push('stream');
  // The water rolling over the lip in an arch, and pale strands fanning down the sheet.
  const [w0, w1] = Array.isArray(o.width) ? o.width : [o.width, o.width];
  const H = o.bottom - o.top, sz = szAt(o.top), tx = o.x - (o.lip ?? 0);
  S.plane(o.z - 1, {
    name: 'fall-strands', x: Math.min(o.x, tx) - w1, y: o.top - 24, w: w1 * 2 + Math.abs(tx - o.x), h: H + 34, mat: 'smooth', res: 1.5,
    edge: { width: 0.9, hi: 0.4, lo: 0.2, soft: 0 }, shadow: { blur: 2, alpha: 0.4 },
    draw(ctx) {
      const rng = new RNG(`s03-strands-${o.x}`);
      const n = Math.max(3, Math.round(w0 / 16));
      for (let i = 0; i < n; i++) {
        const f = ((i + 0.5) / n) * 2 - 1 + rng.range(-0.06, 0.06);
        const xa = tx + f * w0 * 0.44, xb = o.x + f * w1 * 0.5, Lh = H * rng.range(0.35, 0.8), th = rng.range(2, 4.2) * sz;
        const ya = o.top + 3 * sz - 5 * sz * (1 - f * f);
        const left = [], right = [];
        for (let j = 0; j <= 16; j++) {
          const u = j / 16, x = lerp(xa, xb, u) + f * 5 * sz * Math.sin(Math.PI * u), y = ya + u * Lh;
          const w = th * 0.5 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * u)), 0.6);
          left.push([x - w, y]); right.push([x + w, y]);
        }
        piece(ctx, [...left, ...right.reverse()], { fill: rng.pick([FALL.foam, FALL.pale, FALL.foam, RIVER.ice]) });
      }
      piece(ctx, arcStrip(tx - w0 * 0.53, tx + w0 * 0.53, o.top + 4 * sz, 8 * sz, 7 * sz), { fill: FALL.foam });
      piece(ctx, arcStrip(tx - w0 * 0.47, tx + w0 * 0.47, o.top + 11 * sz, 5 * sz, 6 * sz), { fill: FALL.pale });
    },
  }, { tags: ['stream'] });
  if (o.rings) for (const L of addRipples(S, { z: o.z - 3, palette: RIVER, color: RIVER.pale, rim: RIVER.foam, count: 3, period: 3.6, width: 4, arcs: 3, seed: `s03-rings-${o.x}`, ...o.rings })) L.tags.push('stream');
}

// A fallen redwood log from a to b (film px), bark lit along its top and moss over it.
function mossyLog(S, { z, name, a, b, w, seed }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const th = Math.atan2(-u[0], u[1]);
  const c = [Math.cos(th), Math.sin(th)];
  const up = c[1] < 0 ? 1 : -1;
  const { x0, x1, y0, y1 } = bounds([a, b]);
  S.plane(z, {
    name, x: x0 - w - 40, y: y0 - w - 60, w: x1 - x0 + w * 2 + 80, h: y1 - y0 + w * 2 + 140, res: 1.1,
    edge: { width: 1.5, hi: 0.3, lo: 0.3, soft: 0.7 }, shadow: { blur: 14, alpha: 0.6 },
    draw(ctx) {
      const rng = new RNG(seed);
      ctx.save();
      ctx.translate(a[0], a[1]);
      ctx.rotate(th);
      drawRedwood(ctx, { x: 0, yTop: 0, yBase: len, w, lit: up, flare: [0.02, 0.02], flareH: 0.02, seed, rim: 0.5, detail: 0.6 });
      ctx.restore();
      const edge = [];
      for (let s = 10; s <= len - 10; s += 9) edge.push([a[0] + u[0] * s + up * c[0] * w * 0.4, a[1] + u[1] * s + up * c[1] * w * 0.4]);
      mossDrape(ctx, edge, rng, { cap: 14, hang: 1.2, lit: 1, seed: 91 });
    },
  }, { tags: ['rocks'] });
}

// Moss-covered mounds and a log between the trunks either side of the stream, lit ferns
// crowding round them (ref03 mid-ground).
function addMossMounds(S) {
  const light = S.light;
  const rocks = [
    { x: 1072, y: 652, w: 196, h: 70, shape: 'round', seed: 71, mossTop: 24, lit: 1.25, hang: 1.4, mossFrom: 0.04, mossTo: 0.96 },
    { x: 1172, y: 624, w: 104, h: 46, shape: 'round', seed: 72, mossTop: 16, lit: 1.1, mossFrom: 0.04, mossTo: 0.96 },
    { x: 1452, y: 642, w: 186, h: 74, shape: 'round', seed: 73, mossTop: 22, lit: 1.05, hang: 1.3, mossFrom: 0.04, mossTo: 0.96 },
    { x: 1688, y: 652, w: 150, h: 60, shape: 'round', seed: 74, mossTop: 18, lit: 0.9 },
    { x: 410, y: 592, w: 140, h: 52, shape: 'round', seed: 75, mossTop: 18, lit: 1.15, mossFrom: 0.04, mossTo: 0.96 },
  ];
  // Ferns behind the mounds, filling the gaps between the trunks.
  const back = [
    [395, 598, 210, -0.35, 'light'], [462, 590, 180, 0.45, 'mid'], [690, 612, 200, 0.5, 'light'], [990, 642, 210, -0.45, 'light'],
    [1118, 636, 190, 0.35, 'mid'], [1206, 612, 150, -0.6, 'light'], [1398, 628, 200, 0.5, 'light'], [1500, 646, 180, -0.25, 'mid'],
    [1672, 646, 210, 0.2, 'light'], [1650, 652, 160, -0.55, 'teal'], [40, 624, 210, 0.3, 'mid'], [1890, 660, 200, -0.3, 'light'],
  ];
  // Small lit ferns in front of the mounds' feet.
  const front = [[1010, 676, 120, -0.6, 'light'], [1130, 664, 100, 0.55, 'mid'], [1390, 668, 120, -0.5, 'light'], [1530, 672, 110, 0.5, 'light'], [455, 612, 100, 0.6, 'light']];
  S.plane(1330, {
    name: 'moss-mounds', x: -120, y: 330, w: W + 240, h: 420, mat: ROCK_PAPER,
    edge: { width: 1.4, hi: 0.28, lo: 0.26, soft: 0.6 }, shadow: { blur: 12, alpha: 0.55 },
    draw(ctx) {
      const rng = new RNG('s03-moss-mounds');
      for (const [x, y, len, rot, c] of back) quickFern(ctx, { light, rng, x, y, len, rot, curl: 0.3, pinnae: 12, color: fc(MID_FLORA, c) });
      for (const r of [...rocks].sort((a, b) => a.y - b.y)) mossyRock(ctx, r, rng, light);
      for (const [x, y, len, rot, c] of front) quickFern(ctx, { light, rng, x, y, len, rot, curl: 0.35, pinnae: 10, color: fc(MID_FLORA, c) });
    },
  }, { tags: ['undergrowth'] });
}

// --- the floor -------------------------------------------------------------------------

export function addGround(S) {
  const light = S.light;

  // Far undergrowth: a dark band of ferns and bushes at the foot of the far trees.
  S.plane(1750, {
    name: 'undergrowth-far', x: -400, y: 300, w: W + 800, h: 460,
    edge: { width: 1.2, hi: 0.2, lo: 0.2, soft: 0.6 }, shadow: { blur: 12, alpha: 0.45 },
    draw(ctx) {
      const rng = new RNG('s03-ug-far');
      const top = [];
      for (let x = -400; x <= W + 400; x += 24) top.push([x, 560 + 18 * Math.sin(x * 0.009) + rng.range(-6, 6)]);
      piece(ctx, [...top, [W + 400, 760], [-400, 760]], { fill: linear(ctx, 0, 540, 0, 760, ['#18281e', '#101a14']), torn: { amp: 4, freq: 0.05, seed: 3 } });
      for (let i = 0; i < 6; i++) {
        const x = rng.range(-300, W + 300);
        drawShrub(ctx, { palette: FAR_FLORA, light, seed: rng.int(1, 1e6), x, y: rng.range(575, 600), w: rng.range(160, 260), h: rng.range(70, 120), leaf: 16, density: 0.8 });
      }
      for (let i = 0; i < 24; i++) {
        const x = -360 + (i + rng.next()) * ((W + 720) / 24);
        quickFern(ctx, { light, rng, x, y: rng.range(585, 620), len: rng.range(110, 180), rot: rng.range(-0.7, 0.7), curl: 0.3, pinnae: 10, color: fc(FAR_FLORA, rng.pick(['dark', 'teal', 'mid', 'dark'])) });
      }
      for (const [x, y, h] of [[1060, 600, 80], [1170, 596, 70], [1450, 600, 80], [860, 604, 70]]) {
        drawLupine(ctx, { palette: FAR_FLORA, light, seed: rng.int(1, 1e6), x, y, h, w: h * 0.24 });
      }
    },
  }, { tags: ['undergrowth'] });

  // Upper stream: the source run, a little step, and the run down to the first cascade.
  addPool(S, POOLS.source);
  addStep(S, { z: 1680, x: 1311, top: 594, bottom: 608, width: 40, round: 10, bandWidth: 4 });
  addPool(S, POOLS.run);
  addStep(S, { z: 1640, x: 1276, top: 664, bottom: 716, width: [100, 112], round: 30, bandWidth: 8, rings: { z: 1297, x: 1276, y: 726, rx: 70, ry: 12 } });

  // Mossy rocks and a fallen log at mid depth, behind the undergrowth and the fox's rock.
  rockPlane(S, 1420, 'rocks-midfloor', [
    { x: 600, y: 612, w: 190, h: 74, shape: 'round', seed: 61, mossTop: 13, lit: 1, hang: 1.2 },
    { x: 975, y: 668, w: 220, h: 86, shape: 'round', seed: 62, mossTop: 13, lit: 1, hang: 1.3 },
    { x: 1525, y: 688, w: 200, h: 92, shape: 'round', seed: 63, mossTop: 13, lit: 0.9, hang: 1.2 },
    { x: 1745, y: 676, w: 250, h: 104, shape: 'round', seed: 64, mossTop: 14, lit: 0.8 },
    { x: 115, y: 650, w: 230, h: 92, shape: 'round', seed: 65, mossTop: 13, lit: 0.8 },
    { x: 365, y: 628, w: 150, h: 60, shape: 'round', seed: 66, mossTop: 11, lit: 1 },
  ]);
  mossyLog(S, { z: 1440, name: 'log-mid', a: [655, 630], b: [1068, 606], w: 66, seed: 's03-log-mid' });

  // Rocks and ferns around the source and the first ledge.
  rockPlane(S, 1600, 'rocks-far', [
    { x: 1150, y: 716, w: 150, h: 92, shape: 'round', seed: 11, mossTop: 9, lit: 0.6 },
    { x: 1418, y: 712, w: 180, h: 128, shape: 'round', seed: 12, mossTop: 10, lit: 0.8 },
    { x: 1250, y: 606, w: 64, h: 36, shape: 'round', seed: 13, mossTop: 6 },
    { x: 1356, y: 616, w: 54, h: 30, shape: 'round', seed: 14, mossTop: 5 },
  ], (ctx, rng) => {
    for (const [x, y, len, rot, color] of [[1222, 594, 120, -0.5, 'mid'], [1384, 600, 130, 0.5, 'light'], [1440, 640, 150, 0.7, 'mid'], [1120, 650, 130, -0.6, 'teal']]) {
      quickFern(ctx, { light, rng, x, y, len, rot, curl: 0.3, pinnae: 12, color: fc(MID_FLORA, color) });
    }
  });

  // Lit ferns at mid depth either side of the stream and behind the fox (they sway).
  addSwayingFerns(S, {
    z: 1380, name: 'mid-ferns', palette: MID_FLORA, tags: ['undergrowth'],
    ferns: [
      { x: 1010, y: 640, len: 190, rot: 0.42, color: 'light' }, { x: 1090, y: 650, len: 160, rot: -0.25, color: 'mid' },
      { x: 1180, y: 588, len: 150, rot: -0.65, color: 'light' }, { x: 1405, y: 566, len: 180, rot: 0.55, color: 'light' },
      { x: 655, y: 600, len: 190, rot: 0.25, color: 'light' }, { x: 300, y: 615, len: 170, rot: -0.25, color: 'mid' },
      { x: 1660, y: 640, len: 180, rot: 0.3, color: 'light' }, { x: 520, y: 600, len: 150, rot: -0.5, color: 'teal' },
    ],
  });

  // Mid undergrowth: ferns, lupines and white flowers between the trunks, behind the fox.
  S.plane(1350, {
    name: 'undergrowth-mid', x: -400, y: 300, w: W + 800, h: 520,
    edge: { width: 1.3, hi: 0.26, lo: 0.22, soft: 0.6 }, shadow: { blur: 12, alpha: 0.5 },
    draw(ctx) {
      const rng = new RNG('s03-ug-mid');
      // Ferns in clumps either side of the stream, kept clear of the water itself.
      const clumps = [[-200, 640, 3], [120, 620, 4], [360, 600, 4], [760, 620, 3], [960, 640, 4], [1500, 650, 3], [1700, 640, 4], [2000, 650, 3]];
      for (const [cx, cy, n] of clumps) {
        for (let i = 0; i < n; i++) {
          const x = cx + rng.range(-120, 120);
          quickFern(ctx, { light, rng, x, y: cy + rng.range(-10, 20), len: rng.range(130, 230), rot: rng.range(-0.8, 0.8), curl: 0.3, pinnae: 12, color: fc(MID_FLORA, rng.pick(['light', 'mid', 'mid', 'teal', 'dark'])) });
        }
      }
      for (let i = 0; i < 5; i++) drawShrub(ctx, { palette: MID_FLORA, light, seed: rng.int(1, 1e6), x: rng.pick([300, 820, 1000, 1560, 1760]) + rng.range(-60, 60), y: rng.range(640, 670), w: rng.range(140, 220), h: rng.range(70, 110), leaf: 18, density: 0.8 });
      // Lupine spikes (ref x 210, 815, 890, 980, 1340, 1515) and white anemones.
      for (const [x, y, h] of [[255, 520, 110], [945, 520, 90], [1028, 590, 110], [1128, 560, 120], [1545, 630, 110], [1748, 540, 110], [1700, 560, 90]]) {
        drawLupine(ctx, { palette: MID_FLORA, light, seed: rng.int(1, 1e6), x, y, h, w: h * 0.26 });
      }
      for (const [x, y, r] of [[976, 517, 13], [1016, 597, 12], [1080, 551, 11], [1150, 600, 10], [905, 575, 10]]) {
        ctx.strokeStyle = '#3f5a30'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y + r); ctx.quadraticCurveTo(x + 4, y + 40, x + 2, y + 80); ctx.stroke();
        drawDaisy(ctx, { palette: MID_FLORA, light, seed: rng.int(1, 1e6), x, y, r, petals: 5, center: 0.32 });
      }
      for (let i = 0; i < 6; i++) drawTuft(ctx, { palette: MID_FLORA, light, seed: rng.int(1, 1e6), x: rng.range(-300, W + 300), y: rng.range(650, 690), n: 6, len: rng.range(60, 110), tones: ['mid', 'dark', 'light'] });
    },
  }, { tags: ['undergrowth'] });

  // The upper pool under the first cascade, and the second cascade out of it.
  addMossMounds(S);
  addPool(S, POOLS.upper);
  addStep(S, { z: 1290, x: 1104, top: 814, bottom: 882, lip: -16, width: [140, 168], round: 44, bandWidth: 9, speed: 80, accel: 0.35, mist: { strength: 0.14 }, rings: { z: 1096, x: 1110, y: 898, rx: 110, ry: 18 } });

  // Rocks along the middle stream and the mossy rock behind the fox's.
  rockPlane(S, 1250, 'rocks-mid', [
    { x: 1398, y: 905, w: 260, h: 175, shape: 'round', seed: 21, mossTop: 12, lit: 0.8, hang: 1.5 },
    { x: 982, y: 866, w: 118, h: 112, shape: 'round', seed: 22, mossTop: 10, lit: 0.6, hang: 1.6 },
    { x: 1222, y: 870, w: 78, h: 56, shape: 'round', seed: 23, mossTop: 6, lit: 0.6, mossTo: 0.5 },
    { x: 1050, y: 792, w: 120, h: 72, shape: 'round', seed: 26, mossTop: 12, lit: 0.9, mossTo: 0.6, hang: 1.2 },
    { x: 1356, y: 748, w: 78, h: 38, shape: 'round', seed: 24, mossTop: 6 },
  ]);
  // The moss-covered mound left of the fox's boulder, in front of the left redwood's root flare
  // (ref03: a bright cushion of moss).
  rockPlane(S, 1040, 'moss-mound-left', [
    { x: 446, y: 646, w: 280, h: 122, shape: 'flat', tilt: 0.1, sides: 8, rough: 0.2, seed: 25, facets: 12, mossPlate: true, lit: 1.2, hang: 1.4,
      plateMoss: { cushion: 2.4, bandCap: 14, bandLit: 0.85, bands: [[0, 0.55, 26], [0.4, 1, 32], [0.15, 0.4, 64]] } },
  ]);

  // Roots: ferns sway in front of the redwood flares.
  addSwayingFerns(S, {
    z: 1000, name: 'root-ferns', palette: MID_FLORA, tags: ['undergrowth'],
    ferns: [
      { x: 40, y: 580, len: 200, rot: -0.55, color: 'mid' }, { x: 170, y: 590, len: 240, rot: -0.15, color: 'light' },
      { x: 296, y: 575, len: 220, rot: -0.2, color: 'mid' }, { x: 700, y: 545, len: 230, rot: 0.25, color: 'light' },
      { x: 1470, y: 610, len: 210, rot: -0.55, color: 'mid' }, { x: 1600, y: 620, len: 230, rot: 0.2, color: 'light' },
      { x: 1690, y: 615, len: 190, rot: -0.35, color: 'teal' }, { x: 1880, y: 640, len: 220, rot: 0.4, color: 'mid' },
    ],
  });

  // The fox's boulder: a broad flat-topped rock, thick moss over the top and front edge.
  rockPlane(S, 990, 'fox-rock', [
    { x: 690, y: 885, w: 566, h: 242, shape: 'flat', tilt: 0.12, sides: 9, rough: 0.18, seed: 31, facets: 18, mossPlate: true, lit: 1, hang: 2,
      // Shaggy lit moss over the crown and down the front in long clumps (ref03).
      plateMoss: { cushion: 2.4, bandCap: 15, bandLit: 0.85, bands: [[0, 0.5, 30], [0.45, 1, 38], [0.06, 0.3, 92], [0.56, 0.8, 84], [0.26, 0.46, 150], [0.82, 0.98, 132]] } },
  ]);

  // Ferns at the foot of the fox's boulder, swaying in front of its dark face.
  addSwayingFerns(S, {
    z: 930, name: 'rock-ferns', palette: MID_FLORA, tags: ['undergrowth'],
    ferns: [
      { x: 800, y: 1010, len: 290, rot: -0.4, color: 'mid' }, { x: 868, y: 1030, len: 210, rot: -0.12, color: 'light' },
    ],
  });

  // Lower pool: the stream opens out into the wide pool at the bottom of the frame.
  addPool(S, POOLS.lower);

  // Mossy log lying across the right side, bark lit along its top.
  S.plane(820, {
    name: 'log', x: 1420, y: 360, w: 960, h: 520, res: 1.2,
    edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.7 }, shadow: { blur: 16, alpha: 0.6 },
    draw(ctx) {
      const rng = new RNG('s03-log');
      const R = [2280, 470], th = 1.204, len = 700, w = 150;
      ctx.save();
      ctx.translate(R[0], R[1]);
      ctx.rotate(th);
      drawRedwood(ctx, { x: 0, yTop: 0, yBase: len, w, lit: -1, flare: [0.02, 0.02], flareH: 0.02, seed: 's03-log-bark', rim: 0.5, detail: 0.7 });
      ctx.restore();
      const d = [-Math.sin(th), Math.cos(th)], c = [Math.cos(th), Math.sin(th)];
      const edge = [];
      for (let s = len - 20; s >= 0; s -= 9) edge.push([R[0] + d[0] * s - c[0] * w * 0.42, R[1] + d[1] * s - c[1] * w * 0.42]);
      mossDrape(ctx, edge, rng, { cap: 16, hang: 1.1, lit: 1, seed: 77 });
    },
  }, { tags: ['rocks'] });

  // Overscan fill: dark undergrowth in both bottom corners, hidden behind the flower beds at
  // rest, so a wide camera move (pan, zoom-out, pull-back) never shows the sky down there.
  S.plane(900, {
    name: 'corner-fill', x: -760, y: 640, w: W + 1520, h: 900, edge: false, shadow: { blur: 14, alpha: 0.4 },
    draw(ctx) {
      const rng = new RNG('s03-corner');
      for (const [x0, x1, peak] of [[-760, 300, 760], [1600, W + 760, 700]]) {
        const top = [];
        for (let x = x0; x <= x1; x += 30) top.push([x, peak + 80 * Math.abs((x - (x0 + x1) / 2) / (x1 - x0)) + rng.range(-20, 20)]);
        piece(ctx, [...top, [x1, 1540], [x0, 1540]], { fill: linear(ctx, 0, peak, 0, 1300, ['#18301f', '#0c1a12']), torn: { amp: 10, freq: 0.03, seed: rng.int(1, 1e6) } });
        for (let i = 0; i < 9; i++) quickFern(ctx, { light, rng, x: rng.range(x0 + 40, x1 - 40), y: rng.range(peak + 120, 1000), len: rng.range(160, 240), rot: rng.range(-0.7, 0.7), color: fc(MID_FLORA, rng.pick(['dark', 'teal', 'mid'])), pinnae: 11 });
      }
    },
  }, { tags: ['undergrowth'] });

  // Near rocks at the bottom of the pool.
  rockPlane(S, 760, 'rocks-near', [
    { x: 1512, y: 1090, w: 224, h: 186, shape: 'round', seed: 41, mossTop: 12, lit: 0.6, mossFrom: 0.05, mossTo: 0.6 },
  ]);
  rockPlane(S, 700, 'rock-front', [
    { x: 1010, y: 1130, w: 330, h: 165, shape: 'round', seed: 51, mossTop: 8, lit: 0.4, mossFrom: 0.15, mossTo: 0.55, hang: 0.6 },
  ]);
}
