// Aurora ribbons for s08 (ref08). Each ribbon is a torn paper band laid between two
// hand-traced edges: the glowing edge (where the curtain is brightest) and the back
// edge (deep teal or blue, usually tucked behind the next ribbon or above the frame).
// The light is painted as blurred strokes along the glowing edge, vertical streaks run
// through the band like curtain rays, and a dotted pale rim marks the torn edge.
// Per frame the baked ribbons ripple (travelling waves through vertical slices), sway
// a little, and a blurred copy shimmers additively along them.

import { RNG } from '../core/rng.js';
import { piece, pathOf, bevelBands } from '../core/piece.js';
import { tear, bounds } from '../core/geom.js';
import { surface, blurred } from '../core/canvas.js';
import { mix, rgba } from '../core/color.js';
import { osc } from '../core/ease.js';
import { flakeTexture, overlayTexture, SKY_FLAKES } from '../elements/sky.js';

// Colour sets sampled from ref08: deep back of the band -> body -> glow -> hot core.
export const AURORA_INKS = {
  green: { deep: '#0a4a5e', body: '#20b07c', glow: '#84ec8c', core: '#dafbb2' },
  lime: { deep: '#0c5260', body: '#44bc72', glow: '#b0ec6c', core: '#f0fbb8' },
  teal: { deep: '#073f5c', body: '#16928a', glow: '#40cc92', core: '#98f0bc' },
  cyan: { deep: '#0b3f78', body: '#1f6fae', glow: '#4ea6dc', core: '#a6dcf2' },
  blue: { deep: '#0c2a64', body: '#1b4c8e', glow: '#4a7fbe', core: '#8fb8e0' },
  navy: { deep: '#0a1f52', body: '#142f6c', glow: '#22468a', core: '#3c64a6' },
};

// The ref08 sky, traced in film px, back to front. The star sits in a dark funnel
// between two green walls; blue and green bands sweep down from the upper left.
export const REF08_RIBBONS = [
  // Deep blue band across the top left.
  { inks: ['navy', 'blue'], reach: 60, dim: 0.1,
    glow: [[180, -20], [300, 8], [420, 34], [520, 56], [590, 76], [630, 104], [648, 150]],
    back: [[180, -160], [400, -160], [660, -160]] },
  // Blue curtain sweeping down to the right under the big green one.
  { inks: ['blue', 'cyan', 'teal'], reach: 75,
    glow: [[548, 60], [600, 88], [632, 128], [650, 170], [668, 200], [700, 217], [760, 234], [840, 250], [920, 262], [990, 276], [1060, 296], [1120, 318], [1175, 340]],
    back: [[540, -120], [700, -60], [900, 40], [1060, 120], [1180, 200]] },
  // Big green curtain, teal on the left, bright green where it hangs lowest.
  { inks: ['teal', 'green', 'green', 'lime'], reach: 95,
    glow: [[560, -10], [610, 38], [680, 86], [760, 124], [815, 165], [880, 205], [960, 228], [1040, 255], [1100, 280], [1150, 300]],
    back: [[560, -160], [900, -160], [1140, -120], [1170, 120], [1160, 300]] },
  // Low green glow behind the peak's left shoulder.
  { inks: ['teal', 'green', 'lime'], reach: 70,
    glow: [[1110, 345], [1190, 322], [1260, 306], [1330, 300], [1400, 298], [1450, 280], [1470, 250]],
    back: [[1100, 200], [1250, 150], [1400, 150], [1480, 150]] },
  // Cyan fold dropping from the top, then running right above the gap.
  { inks: ['cyan', 'cyan', 'blue'], reach: 55,
    glow: [[1010, -60], [1014, 40], [1024, 98], [1046, 132], [1090, 154], [1150, 168], [1210, 192], [1270, 214], [1330, 242], [1372, 280]],
    back: [[1140, -60], [1136, 50], [1156, 104], [1220, 124], [1300, 140], [1380, 165], [1430, 210]] },
  // Bright green top curtain, its lower edge dotted, falling into the left wall of the funnel.
  { inks: ['green', 'green', 'lime'], reach: 90,
    glow: [[1104, 108], [1150, 138], [1210, 150], [1270, 164], [1330, 178], [1372, 198], [1398, 228], [1412, 262], [1408, 296]],
    back: [[1100, -160], [1300, -160], [1440, -160], [1440, 120], [1460, 250], [1440, 300]] },
  // Right wall of the funnel: green curtain falling then swinging out to the right.
  { inks: ['lime', 'green', 'teal'], reach: 85,
    glow: [[1560, -60], [1572, 40], [1584, 110], [1596, 180], [1622, 236], [1666, 268], [1730, 284], [1820, 290], [1960, 286]],
    back: [[1700, -60], [1692, 60], [1690, 130], [1720, 180], [1800, 205], [1960, 205]] },
  // Blue band and green curtain in the upper right.
  { inks: ['blue', 'cyan'], reach: 50, dim: 0.05,
    glow: [[1700, 130], [1760, 190], [1840, 214], [1960, 222]],
    back: [[1690, 60], [1780, 110], [1880, 120], [1960, 120]] },
  { inks: ['green', 'lime'], reach: 60,
    glow: [[1600, -60], [1630, 40], [1680, 96], [1740, 120], [1800, 108], [1850, 80], [1900, 40], [1940, -60]],
    back: [[1600, -100], [1940, -100]] },
];

// Catmull-Rom resampling of an open polyline every ~step px.
function spline(pts, step = 6) {
  const out = [];
  const n = pts.length;
  const get = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const seg = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1].slice());
  return out;
}

// Colour of the glow at fraction u along the glowing edge: inks may change along it.
function inkAt(rb, u) {
  const list = rb.inks.map((k) => (typeof k === 'string' ? AURORA_INKS[k] : k));
  if (list.length === 1) return list[0];
  const f = u * (list.length - 1), i = Math.min(list.length - 2, Math.floor(f)), k = f - i;
  const A = list[i], B = list[i + 1];
  return { deep: mix(A.deep, B.deep, k), body: mix(A.body, B.body, k), glow: mix(A.glow, B.glow, k), core: mix(A.core, B.core, k) };
}

// Paint one ribbon in authored coordinates. Returns its outline path.
//   rb  { glow: [[x, y]...], back: [[x, y]...], inks: [key | ink, ...] along the glow edge,
//         reach: px the light spreads in from the glowing edge, dim: 0..1 toward the night }
export function paintRibbon(ctx, rb, { seed = 'ribbon', light = [0.5, -0.86] } = {}) {
  const rng = new RNG(seed);
  const reach = rb.reach ?? 70;
  const dim = rb.dim ?? 0;
  const night = '#06183e';
  const glowEdge = tear(spline(rb.glow, 5), { amp: 2.2, freq: 0.06, fine: 0.9, seed: rng.int(1, 1e6), closed: false, step: 3 });
  const backEdge = tear(spline(rb.back, 8), { amp: 3, freq: 0.04, fine: 0.9, seed: rng.int(1, 1e6), closed: false, step: 4 });
  const outline = [...glowEdge, ...backEdge.slice().reverse()];
  const box = bounds(outline);
  const path = pathOf(outline);
  const dimmed = (c) => mix(c, night, dim);

  // Base: the deep colour of the band, blended along the glow edge's ink changes.
  const first = inkAt(rb, 0), last = inkAt(rb, 1);
  const a = glowEdge[0], b = glowEdge[glowEdge.length - 1];
  const base = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  base.addColorStop(0, dimmed(first.deep));
  base.addColorStop(1, dimmed(last.deep));
  piece(ctx, outline, { fill: base });

  ctx.save();
  ctx.clip(path);
  // Light: strokes along the glowing edge on a scratch canvas, blurred in one pass.
  const pad = reach * 2;
  const L = surface(box.w + pad * 2, box.h + pad * 2);
  const lc = L.ctx;
  lc.translate(pad - box.x, pad - box.y);
  lc.lineCap = 'round';
  lc.lineJoin = 'round';
  const bands = [
    { w: reach * 2.4, key: 'body', a: 0.85 },
    { w: reach * 1.2, key: 'glow', a: 0.8 },
    { w: reach * 0.45, key: 'core', a: 0.55 },
  ];
  for (const band of bands) {
    lc.lineWidth = band.w;
    for (let i = 0; i < glowEdge.length - 1; i += 2) {
      const ink = inkAt(rb, i / (glowEdge.length - 1));
      const j = Math.min(glowEdge.length - 1, i + 3);
      lc.strokeStyle = rgba(dimmed(ink[band.key]), band.a);
      lc.beginPath();
      lc.moveTo(glowEdge[i][0], glowEdge[i][1]);
      lc.lineTo(glowEdge[j][0], glowEdge[j][1]);
      lc.stroke();
    }
  }
  ctx.filter = `blur(${reach * 0.42 * (ctx.__res || 1)}px)`;
  ctx.drawImage(L.canvas, box.x - pad, box.y - pad);
  ctx.filter = 'none';
  // The back of the band melts into the night: stacked dark strokes along the back edge.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [wk, a] of [[2.6, 0.16], [1.8, 0.16], [1.1, 0.18], [0.55, 0.2]]) {
    ctx.lineWidth = reach * wk;
    ctx.strokeStyle = rgba(night, a);
    ctx.beginPath();
    backEdge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }

  // Curtain rays: broad soft streaks hanging from the glowing edge and dark drips
  // falling from the back of the band, painted on a scratch canvas and softened.
  const R = surface(box.w + 40, box.h + 40);
  const rc = R.ctx;
  rc.translate(20 - box.x, 20 - box.y);
  const up = rb.raysDown ? 1 : -1;
  const streak = (x, y0, len, w, color, al) => {
    const g = rc.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.12, rgba(color, al));
    g.addColorStop(0.7, rgba(color, al * 0.6));
    g.addColorStop(1, rgba(color, 0));
    rc.fillStyle = g;
    rc.fillRect(x - w / 2, Math.min(y0, y0 + len), w, Math.abs(len));
  };
  const rays = Math.round(box.w / 5);
  for (let i = 0; i < rays; i++) {
    const p = glowEdge[rng.int(0, glowEdge.length - 1)];
    const len = up * rng.range(0.4, 1.4) * reach * 2.4;
    const lightRay = rng.chance(0.6);
    streak(p[0] + rng.range(-6, 6), p[1] + rng.range(0, 14) * -up, len, rng.range(4, 26), lightRay ? '#e4ffe8' : '#03204a', lightRay ? rng.range(0.05, 0.15) : rng.range(0.1, 0.3));
  }
  const drips = Math.round(box.w / 9);
  for (let i = 0; i < drips; i++) {
    const p = backEdge[rng.int(0, backEdge.length - 1)];
    streak(p[0] + rng.range(-8, 8), p[1] - 10 * up, -up * rng.range(0.3, 1) * reach * 2.2, rng.range(6, 34), '#021a40', rng.range(0.08, 0.24));
  }
  ctx.filter = `blur(${2.2 * (ctx.__res || 1)}px)`;
  ctx.drawImage(R.canvas, box.x - 20, box.y - 20);
  ctx.filter = 'none';
  // Fine fibres through the whole band.
  for (let x = box.x; x < box.x + box.w; x += rng.range(3, 12)) {
    const lightFibre = rng.chance(0.5);
    ctx.fillStyle = rgba(lightFibre ? '#d8fff0' : '#021530', rng.range(0.02, 0.07));
    ctx.fillRect(x, box.y, rng.range(1, 3), box.h);
  }
  overlayTexture(ctx, flakeTexture(SKY_FLAKES.fine), { x: box.x, y: box.y, w: box.w, h: box.h, amt: 0.9, rot: rng.range(0, 90), ox: rng.range(0, 700) });
  ctx.restore();

  // Torn glowing edge: a dotted pale rim of paper fibre, then the cut bevel.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([3, 5]);
  ctx.lineDashOffset = rng.range(0, 8);
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = rgba(mix(inkAt(rb, 0.5).core, '#ffffff', 0.4), 0.55 * (1 - dim));
  ctx.beginPath();
  glowEdge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  bevelBands(ctx, path, { light, width: 1.6, hi: 0.25, lo: 0.3, soft: 0.6 });
  return { path, box };
}

// Draw a sprite in abutting vertical slices, each shifted by dy(x) (a travelling
// ripple). alphaAt(x), when given, scales each slice (the shimmer of the glow copy).
function drawSliced(ctx, img, bx, by, bw, bh, dx, dy, slice, alphaAt = null) {
  const k = img.width / bw;
  const base = ctx.globalAlpha;
  for (let x = bx; x < bx + bw; x += slice) {
    const w = Math.min(slice, bx + bw - x);
    const cx = x + w / 2;
    if (alphaAt) {
      const a = alphaAt(cx);
      if (a <= 0.003) continue;
      ctx.globalAlpha = base * a;
    }
    ctx.drawImage(img, (x - bx) * k, 0, w * k, img.height, x + dx, by + dy(cx), w, bh);
  }
  ctx.globalAlpha = base;
}

// Bake the ribbons and add one plane per ribbon, back to front.
//   ribbons  [{ glow, back, inks, reach, dim, ripple, phase }]
//   ripple   px of travelling-wave undulation; sway: px of slow sideways drift
//   shimmer  strength of the additive light travelling along each ribbon
// Returns the layers (tagged 'aurora').
export function addAuroraRibbons(S, { ribbons, z = 17000, ripple = 7, sway = 5, shimmer = 0.32, seed = 's08-aurora', tags = ['aurora'], res = 0.8 } = {}) {
  return ribbons.map((rb, i) => {
    let box = null;
    const all = [...rb.glow, ...rb.back];
    const bb = bounds(all);
    const reach = rb.reach ?? 70;
    const m = 30;
    const s = S.sprite({
      name: `aurora-${i}`, x: bb.x - m, y: bb.y - m, w: bb.w + m * 2, h: bb.h + m * 2, res, mat: 'paper',
      edge: false, shadow: { blur: 10 },
      draw(ctx) { box = paintRibbon(ctx, rb, { seed: `${seed}-${i}`, light: S.light }).box; },
    });
    const g = blurred(s.canvas, reach * 0.35 * res);
    const halo = { canvas: g.canvas, pad: g.pad / res };
    const ph = rb.phase ?? i * 1.37;
    const amp = rb.ripple ?? ripple;
    // Two waves travelling in opposite directions at incommensurate speeds never loop.
    const dy = (t) => (x) => amp * (0.7 * Math.sin(x * 0.0062 - t * 0.55 + ph) + 0.3 * Math.sin(x * 0.0023 + t * 0.21 + ph * 0.6));
    const shine = (t) => (x) => shimmer * (0.35 + 0.65 * Math.max(0, Math.sin(x * 0.0045 - t * 0.7 + ph * 1.3)) ** 2) * (0.8 + 0.2 * osc(t, 4.7 + i * 0.4, ph * 0.1));
    return S.add({
      name: `aurora-${i}`, z, order: i, tags,
      anim: (t) => ({ x: sway * (0.6 * osc(t, 11 + i * 1.3, ph * 0.07) + 0.4 * osc(t, 6.1, ph * 0.13)) }),
      render(ctx, t, env) {
        const off = dy(t);
        const sh = env.shadow;
        const p = s.shadow.pad;
        ctx.save();
        ctx.globalAlpha *= sh.alpha ?? 0.5;
        drawSliced(ctx, s.shadow.canvas, s.x - p, s.y - p, s.w + 2 * p, s.h + 2 * p, sh.dx ?? 0, (x) => (sh.dy ?? 6) + off(x), 48);
        ctx.restore();
        drawSliced(ctx, s.canvas, s.x, s.y, s.w, s.h, 0, off, 24);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawSliced(ctx, halo.canvas, s.x - halo.pad, s.y - halo.pad, s.w + 2 * halo.pad, s.h + 2 * halo.pad, 0, off, 48, shine(t));
        ctx.restore();
      },
    });
  });
}
