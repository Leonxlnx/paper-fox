// Storm ceiling with a lit opening (ref07) and low mist bands.
//
// The ceiling is a tunnel seen from below. Big deckle-edged paper discs are laid on
// contours around the opening: the innermost contour is lit cream by the light pouring
// through, each contour further out is darker, bigger and nearer the lens. Discs nearer
// the opening go down first, so every free edge you can see faces the light and catches
// a gold (inner) or pale slate (outer) rim. Contours are grouped into ring sprites on
// slightly different planes, which gives the opening real depth when the camera moves.

import { W } from '../core/stage.js';
import { RNG, noise } from '../core/rng.js';
import { pathOf, radial, glow } from '../core/piece.js';
import { TAU } from '../core/geom.js';
import { mix, rgba } from '../core/color.js';
import { osc, clamp, lerp, smoothstep } from '../core/ease.js';
import { resolvePalette, puffShape, paintCloudPiece } from './clouds.js';

// Deckle (pinking-shear) edge: fine teeth on a torn outline.
export const DECKLE = { amp: 1.1, freq: 0.3, fine: 1.3, step: 2.5 };

// Plan the ceiling geometry.
//   x, y, w        region the ceiling covers (top edge y is usually off-frame)
//   bottom, sag    mean height of the hanging lower edge and how much it wanders
//   gap            { x, y, rx, ry } the opening; irregular: how ragged its outline is
//   rings          number of ring sprites (lit inner ring ... dark outer ring)
//   ringStep       ring width in units of the gap radius
//   size, growth   disc radius at the rim and how fast it grows outward
//   inset          how far the first contour of discs reaches into the opening
export function planStorm(o = {}) {
  const {
    x = -260, y = -240, w = W + 520, bottom = 300, sag = 50,
    gap = { x: 1500, y: 145, rx: 150, ry: 110 }, irregular = 0.22,
    rings = 4, ringStep = 0.55, size = 46, growth = 0.35, inset = 0.1, seed = 'storm',
  } = o;
  const rng = new RNG(seed);
  const nz = noise(rng.int(1, 1e9));
  const ragged = (a) => 1 + irregular * nz.fbm(Math.cos(a) * 1.1 + 3, Math.sin(a) * 1.1 + 3, 2);
  // Normalised distance from the opening: 1 on its ragged rim.
  const qOf = (px, py) => {
    const dx = (px - gap.x) / gap.rx, dy = (py - gap.y) / gap.ry;
    return Math.hypot(dx, dy) / ragged(Math.atan2(dy, dx));
  };
  const at = (q, a) => {
    const k = q * ragged(a);
    return [gap.x + Math.cos(a) * gap.rx * k, gap.y + Math.sin(a) * gap.ry * k];
  };
  const contour = (q, n = 120) => Array.from({ length: n }, (_, i) => at(q, (i / n) * TAU));
  const edgeY = (px) => bottom + sag * nz.fbm(px * 0.0032, 7.7, 3);
  const radiusAt = (q) => size * (1 + growth * Math.max(0, q - 1));
  const gr = Math.sqrt(gap.rx * gap.ry);
  const q0 = 1 + inset;
  const ringOf = (q) => clamp(Math.floor((q - q0 + 0.25) / ringStep), 0, rings - 1);
  const inside = (px, py, r) => px > x - r && px < x + w + r && py > y - r && py < edgeY(px) - r * 0.4;

  const puffs = [];
  const qMax = Math.max(qOf(x, y), qOf(x + w, y), qOf(x, bottom + sag), qOf(x + w, bottom + sag)) + 0.5;
  // Contours outward from the rim; the first one leans into the opening.
  for (let q = q0, i = 0; q < qMax; i++) {
    const r = radiusAt(q);
    const perim = TAU * q * Math.sqrt((gap.rx * gap.rx + gap.ry * gap.ry) / 2);
    const n = Math.max(7, Math.round(perim / (r * (i === 0 ? 1.15 : 1.3))));
    const a0 = rng.next() * TAU;
    for (let j = 0; j < n; j++) {
      const a = a0 + ((j + rng.range(-0.3, 0.3)) / n) * TAU;
      const qq = q + rng.range(-0.25, 0.25) * (r / gr) * (i === 0 ? 0.4 : 1);
      const [px, py] = at(qq, a);
      const rad = r * rng.range(0.78, 1.25);
      if (!inside(px, py, rad)) continue;
      puffs.push({ x: px, y: py, r: rad, q: qOf(px, py), a });
    }
    q += (r * 0.95) / gr;
  }
  // Hanging lower edge: a row of big discs scalloping the underside of the ceiling.
  for (let px = x; px < x + w; px += size * 1.6 * rng.range(0.8, 1.2)) {
    const rad = size * rng.range(1.2, 1.7);
    const py = edgeY(px) - rad * 0.6;
    const q = qOf(px, py);
    if (q > 1.5) puffs.push({ x: px, y: py, r: rad, q, a: Math.atan2(py - gap.y, px - gap.x), edge: true });
  }

  const ringList = Array.from({ length: rings }, (_, k) => ({ k, puffs: [] }));
  for (const p of puffs) {
    p.squash = rng.range(0.85, 1);
    p.pts = puffShape(p.x, p.y, p.r, rng, { lobes: rng.int(0, 3), lobeAmp: 0.05, squash: p.squash, rot: p.a });
    ringList[p.edge ? rings - 1 : ringOf(p.q)].puffs.push(p);
  }
  // Inside a ring, discs nearest the opening go down first: farther discs overlap them,
  // so every visible free edge faces the light.
  for (const R of ringList) {
    R.puffs.sort((a, b) => (a.edge - b.edge) || (a.q - b.q));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of R.puffs) {
      x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r);
      y0 = Math.min(y0, p.y - p.r); y1 = Math.max(y1, p.y + p.r);
    }
    const pad = 16;
    R.box = { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + 2 * pad), h: Math.ceil(y1 - y0 + 2 * pad) };
    // Backing paper under the ring: everything beyond a contour just outside its inner
    // edge, so no sky shows between discs.
    const qIn = Math.min(...R.puffs.map((p) => p.q)) + 0.15;
    R.back = contour(Number.isFinite(qIn) ? qIn : q0 + 0.2);
  }
  const region = [[x, y], [x + w, y]];
  for (let px = x + w; px >= x; px -= 16) region.push([px, edgeY(px) - size * 0.5]);
  return { x, y, w, bottom, gap, rings: ringList, region, qOf, contour, edgeY };
}

// Paint ring k of a storm plan.
//   palette    'storm' (cream near the light, navy slate outward) or any palette
//   litAngle   direction (radians, from the gap centre) of the brightest side of the rim
//   litBias    how much brighter that side is
//   reach      how many gap radii the light reaches before discs are fully dark
//   near, far  tone of the discs at the rim and beyond the light's reach
//   mottle     tone scatter of the dark discs (some catch more light than others)
export function paintStormRing(ctx, plan, k, o = {}) {
  const P = resolvePalette(o.palette ?? 'storm');
  const R = plan.rings[k];
  const { gap } = plan;
  const rng = new RNG(`${o.seed ?? 'storm'}:ring:${k}`);
  const reach = o.reach ?? 1.2;
  const litAngle = o.litAngle ?? Math.PI * 0.55;
  const litBias = o.litBias ?? 0.55;
  const near = o.near ?? 0.02, far = o.far ?? 0.98, mottle = o.mottle ?? 0.22;

  ctx.save();
  ctx.clip(pathOf(plan.region));
  const back = new Path2D();
  back.rect(plan.x - 50, plan.y - 50, plan.w + 100, plan.bottom + 400 - plan.y);
  back.addPath(pathOf(R.back));
  ctx.fillStyle = P.ramp[P.ramp.length - 1];
  ctx.fill(back, 'evenodd');
  ctx.restore();

  for (const p of R.puffs) {
    const dx = gap.x - p.x, dy = gap.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    const lit = [dx / l, dy / l];
    const f = smoothstep(1.1, 1 + reach, p.q);
    // Discs on the far side of the opening show their unlit undersides.
    const side = Math.cos(Math.atan2(-dy, -dx) - litAngle);
    const u = lerp(near, far, Math.pow(f, 0.7)) + litBias * (1 - side) * 0.5 * (1 - f) - mottle * f * rng.next() + rng.range(-1, 1) * P.jitter;
    const dark = smoothstep(0.5, 0.95, u);
    const rimMix = smoothstep(1.1, 1.6, p.q);
    const rimC = rgba(mix(P.rimLit ?? P.rim, P.rim, rimMix), lerp(1, 0.55, rimMix));
    paintCloudPiece(ctx, p.pts, {
      palette: { ...P, spread: P.spread * lerp(1, 0.35, dark) }, u, lit, cx: p.x, cy: p.y, r: p.r, squash: p.squash, rng,
      texture: { light: lerp(1, 0.35, dark) },
      creases: Math.round(clamp(p.r / 16, 1, 6)), bevel: lerp(1, 0.7, f),
      torn: { ...DECKLE, seed: rng.int(1, 1e6) },
      rim: { color: rimC, width: lerp(1.6, 1, rimMix) },
      shadow: { blur: 12, dist: 5 },
    });
  }
}

// The storm ceiling as ring planes plus the light in the opening.
//   z            depth of the innermost ring; outer rings step toward the lens by dz
//   gapSky       colour of the sky seen through the opening (false: leave it to the sky layer)
//   gapZ         depth of that patch of sky (behind the stars band by default)
//   glow         { color, alpha, r } light pouring through the opening
//   breathe      ring swell about the opening (fraction); drift: px/s; t0: rest time
// plus any planStorm / paintStormRing option. Returns the layers (layers.plan: geometry).
export function addStormCeiling(S, opts = {}) {
  const o = {
    name: 'storm', z: 9000, dz: 0.05, seed: 'storm', palette: 'storm',
    gapSky: '#3a4f68', gapZ: 17000, glow: { color: '#ffd89a', alpha: 0.6, r: 1.7 },
    breathe: 0.006, period: 9, drift: 2, shadowAlpha: 0.6, shadowBlur: 16,
    mat: [{ tex: 'fiber', amt: 0.5 }, { tex: 'crumple', amt: 0.3, scale: 0.6 }],
    ...opts,
  };
  const plan = o.plan ?? planStorm(o);
  const { gap } = plan;
  const gr = Math.max(gap.rx, gap.ry);
  const layers = [];
  const t0 = o.t0 ?? 0;
  const anim = (phase) => (t) => ({ x: o.drift * (t - t0), y: 0, ox: gap.x, oy: gap.y, sx: 1 + o.breathe * osc(t, o.period, phase) });

  if (o.gapSky) {
    const sky = S.sprite({
      name: `${o.name}-gapsky`, x: gap.x - gr * 3, y: gap.y - gr * 3, w: gr * 6, h: gr * 6,
      mat: 'sky', edge: false, shadow: false,
      draw(ctx) {
        ctx.fillStyle = radial(ctx, gap.x, gap.y, 0, gr * 3, [[0, mix(o.gapSky, '#ffffff', 0.06)], [0.5, o.gapSky], [1, rgba(o.gapSky, 0)]]);
        ctx.fillRect(gap.x - gr * 3, gap.y - gr * 3, gr * 6, gr * 6);
      },
    });
    layers.push(S.add({ name: `${o.name}-gapsky`, z: o.gapZ, sprites: [{ s: sky }], anim: anim(0) }));
  }
  if (o.glow) {
    const g = o.glow;
    layers.push(S.add({
      name: `${o.name}-glow`, z: o.z * 1.2, blend: 'lighter',
      alpha: (t) => g.alpha * (0.9 + 0.1 * osc(t, 6.5)),
      anim: anim(0),
      render(ctx) { glow(ctx, gap.x, gap.y, gr * g.r, g.color, 1); },
    }));
  }
  plan.rings.forEach((R, k) => {
    const s = S.sprite({
      name: `${o.name}-ring${k}`, ...R.box, mat: o.mat, light: S.light,
      edge: { width: 2, hi: 0, lo: 0.3, soft: 0.8 },
      shadow: { blur: o.shadowBlur, alpha: o.shadowAlpha },
      draw: (ctx) => paintStormRing(ctx, plan, k, o),
    });
    const z = o.z * (1 - o.dz * k);
    layers.push(S.add({ name: `${o.name}-ring${k}`, z, sprites: [{ s }], anim: anim(k * 0.21) }));
  });
  // Light spilling over the inner rim of the cloud.
  if (o.glow) {
    const g = o.glow;
    layers.push(S.add({
      name: `${o.name}-spill`, z: o.z * (1 - o.dz * plan.rings.length) - 1, blend: 'screen',
      alpha: (t) => g.alpha * 0.35 * (0.9 + 0.1 * osc(t, 6.5)),
      anim: anim(0),
      render(ctx) { glow(ctx, gap.x, gap.y, gr * g.r * 1.1, g.color, 0.6); },
    }));
  }
  layers.plan = plan;
  return layers;
}

// --- mist --------------------------------------------------------------------

// Low mist: many translucent tissue strands with feathered edges, uneven along the band
// (thick drifts, thin veils, gaps), some curling up at one end, the densest with a
// crisper pale core.
//   x, y, w, h   band box (strands stay inside it, feathering included)
//   color        tissue colour; alpha: overall opacity
//   strands      number of strands; soft: feather radius (px); gaps: 0..1 how patchy
export function drawMist(ctx, { x = 0, y = 0, w = 1200, h = 160, seed = 'mist', color = '#c4cadf', alpha = 0.55, strands = 26, soft = 10, gaps = 0.35 } = {}) {
  const rng = new RNG(seed);
  const nz = noise(rng.int(1, 1e9));
  const k = ctx.__res || 1;
  const pad = soft * 2.6;
  // One strand: a long lens along a gently waving centre line; curl lifts one end.
  const strand = (cx, cy, len, th, curl, i) => {
    const top = [], bot = [];
    const N = 56;
    for (let j = 0; j <= N; j++) {
      const t = j / N;
      const px = cx - len / 2 + t * len;
      const mid = cy + th * 0.6 * nz.n2(t * 2.2 + i * 3.1, 4.7) - curl * th * 2.2 * Math.pow(Math.max(0, (t - 0.72) / 0.28), 2);
      const env = Math.pow(Math.sin(Math.PI * t), 0.65) * (0.7 + 0.5 * nz.n2(t * 4.3 + i, 1.9));
      top.push([px, mid - th * env]);
      bot.push([px, mid + th * env * 0.45]);
    }
    return pathOf([...top, ...bot.reverse()], { smooth: true });
  };
  ctx.save();
  for (let i = 0; i < strands; i++) {
    const len = w * rng.range(0.07, 0.26);
    const cx = x + pad + len / 2 + rng.next() * Math.max(1, w - len - pad * 2);
    // Patchy density: fewer strands where the band noise is low.
    const dens = 0.5 + 0.5 * nz.n1(cx * 0.0016 + 11);
    if (rng.next() < gaps * (1 - dens) * 2) continue;
    const th = (h - pad * 2) * rng.range(0.05, 0.16) * (0.6 + dens);
    const cy = y + pad + th * 2.4 + rng.next() * Math.max(1, h - pad * 2 - th * 3.4);
    const curl = rng.chance(0.3) ? rng.range(0.4, 1) * rng.sign() : 0;
    const p = strand(cx, cy, len, th, curl, i);
    ctx.filter = `blur(${soft * rng.range(0.45, 1.2) * k}px)`;
    ctx.globalAlpha = alpha * rng.range(0.28, 0.7) * (0.6 + 0.6 * dens);
    ctx.fillStyle = mix(color, '#ffffff', rng.range(-0.06, 0.12));
    ctx.fill(p);
    if (dens > 0.55 && rng.chance(0.5)) {
      // Crisper pale core in the upper half of dense strands.
      ctx.filter = `blur(${soft * 0.25 * k}px)`;
      ctx.globalAlpha = alpha * rng.range(0.15, 0.35);
      ctx.fillStyle = mix(color, '#ffffff', 0.35);
      ctx.fill(strand(cx + len * 0.05, cy - th * 0.35, len * 0.6, th * 0.35, curl, i + 99));
    }
  }
  ctx.restore();
}
// A drifting band of mist on its own plane. Options as drawMist plus
//   z, drift (px/s), breathe (opacity swing 0..1), period (s)
export function addMist(S, opts = {}) {
  const o = { name: 'mist', z: 1600, x: -300, y: 500, w: 2520, h: 180, drift: 12, breathe: 0.18, period: 8, seed: 'mist', alpha: 0.55, ...opts };
  const s = S.sprite({
    name: o.name, x: o.x, y: o.y, w: o.w, h: o.h,
    mat: [{ tex: 'fiber', amt: 0.35 }], edge: false, shadow: false,
    draw: (ctx) => drawMist(ctx, o),
  });
  const nz = noise(`${o.seed}:mist`);
  return S.add({
    name: o.name, z: o.z, sprites: [{ s }],
    alpha: (t) => 1 - o.breathe * (0.5 + 0.5 * osc(t, o.period, nz.n1(1.3))),
    anim: (t) => ({ x: o.drift * (t - (o.t0 ?? 0)) + 10 * nz.n1(t * 0.08), y: 3 * osc(t, o.period * 1.3) }),
  });
}
