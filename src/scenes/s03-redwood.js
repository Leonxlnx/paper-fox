// Firefly forest (s03): the giant redwood trunks. The shared trunk painter cuts bark
// into long smooth plates; the reference bark is shaggier, so this scene-local variant
// builds each trunk from three passes of torn paper: long fibrous strips, hundreds of
// small shingle flakes over them, and dark slits, all shaded round the cylinder and
// lit hard on the flank that faces the guiding star.

import { RNG, noise } from '../core/rng.js';
import { piece, linear } from '../core/piece.js';
import { mix, rgba, vary } from '../core/color.js';
import { clamp, lerp, smoothstep } from '../core/ease.js';

// Sampled from the ref03 trunks: crevices #2a0f01, shade flank #4e220e, mid #6b3822,
// lit ridges #906546, star-lit edge #cb7d3d.
export const REDWOOD = {
  crevice: '#1e0b04',
  dark: '#3f1c0e',
  mid: '#6a3620',
  lit: '#93583a',
  hi: '#c07a4a',
  rim: '#e8a25c',
  pale: '#d9b08a',
};

// Bark colour for a luminance 0 (crevice) .. 1 (rim-lit ridge).
function barkTone(P, v) {
  const ramp = [P.crevice, P.dark, P.mid, P.lit, P.hi, P.rim];
  const s = clamp(v) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(s));
  return mix(ramp[i], ramp[i + 1], s - i);
}

// A jagged, pointed flake: top tip, ragged flanks, bottom tip, centred on (cx, cy).
function flake(cx, cy, w, h, rng, skew = 0) {
  const pts = [];
  const n = 5;
  const prof = (t) => Math.pow(Math.sin(Math.PI * t), 0.7);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([cx + (w / 2) * prof(t) + skew * w * t + rng.range(-0.18, 0.18) * w, cy - h / 2 + h * t + rng.range(-0.05, 0.05) * h]);
  }
  for (let i = n - 1; i > 0; i--) {
    const t = i / n;
    pts.push([cx - (w / 2) * prof(t) + skew * w * t + rng.range(-0.18, 0.18) * w, cy - h / 2 + h * t + rng.range(-0.05, 0.05) * h]);
  }
  return pts;
}

// Cheap layered cut: a dark contact shadow, a lit sliver on the light side, the paper.
function cut(ctx, pts, fill, lightDir, { lift = 1.2, drop = 1.6, shadowA = 0.55, edge = 0.5, edgeColor = '#ffd9a8' } = {}) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  ctx.save();
  ctx.translate(-lightDir[0] * drop * 0.8, drop);
  ctx.fillStyle = `rgba(12,3,0,${shadowA})`;
  ctx.fill(p);
  ctx.restore();
  if (edge > 0) {
    ctx.save();
    ctx.translate(lightDir[0] * lift, lightDir[1] * lift * 0.6);
    ctx.fillStyle = rgba(edgeColor, edge);
    ctx.fill(p);
    ctx.restore();
  }
  ctx.fillStyle = fill;
  ctx.fill(p);
  return p;
}

// Paint one redwood centred on x from yTop down to yBase.
//   w        trunk width above the flare
//   lit      +1 when the light comes from the right (trunk left of the star), -1 from the left
//   flare    [left, right] extra root width (fraction of w) at the base
//   flareH   fraction of the height the flare rises
//   lean     sideways offset of the top (px)
//   moss     0..1 moss creeping up from the roots
//   haze     [colour, amount] to push a far trunk back into the night
export function drawRedwood(ctx, o) {
  const {
    x, yTop, yBase, w, lit = 1, flare = [0.35, 0.35], flareH = 0.22, lean = 0, seed = 1,
    palette = REDWOOD, moss = 0, haze = null, rim = 1, detail = 1,
  } = o;
  const P = haze ? Object.fromEntries(Object.entries(palette).map(([k, c]) => [k, mix(c, haze[0], haze[1])])) : palette;
  const rng = new RNG(seed);
  const nz = noise(rng.int(1, 1e9));
  const H = yBase - yTop;
  const lightDir = [lit * 0.8, -0.6];
  const cxAt = (y) => x + lean * Math.pow(1 - clamp((y - yTop) / H), 1.4);
  // Half widths to the left and right of the centre line, with an asymmetric root flare.
  const half = (y, side) => {
    const v = clamp((y - yTop) / H);
    const f = smoothstep(1 - flareH, 1, v);
    const fl = side < 0 ? flare[0] : flare[1];
    return (w / 2) * (lerp(0.86, 1, v) + fl * f * f * 2) + w * 0.012 * nz.n2(v * 9, side * 3);
  };
  const edgeAt = (y, u) => {            // u = -1 left edge .. 1 right edge
    const c = cxAt(y);
    return u < 0 ? c + u * half(y, -1) : c + u * half(y, 1);
  };
  const step = 10;
  const ys = [];
  for (let y = yTop; y < yBase; y += step) ys.push(y);
  ys.push(yBase);
  const outline = [...ys.map((y) => [edgeAt(y, -1), y]), ...ys.slice().reverse().map((y) => [edgeAt(y, 1), y])];
  const body = piece(ctx, outline, { fill: P.crevice, torn: { amp: 2, freq: 0.06, fine: 0.8, seed: rng.int(1, 1e6) } });

  // Cylinder shading: u across the trunk, brightest on the lit flank with a hot rim.
  const lum = (u) => {
    const c = u * lit;
    return 0.22 + 0.34 * smoothstep(-0.9, 0.95, c) + 0.3 * rim * smoothstep(0.62, 0.96, c) - 0.1 * smoothstep(0.85, 1, -c);
  };

  ctx.save();
  ctx.clip(body);
  // Base wash so gaps between strips read as deep crevices that still turn with the trunk.
  ctx.fillStyle = linear(ctx, cxAt(yBase) - w, 0, cxAt(yBase) + w, 0, lit > 0
    ? [[0, P.crevice], [0.6, mix(P.crevice, P.dark, 0.6)], [1, P.dark]]
    : [[0, P.dark], [0.4, mix(P.crevice, P.dark, 0.6)], [1, P.crevice]]);
  ctx.fillRect(cxAt(yBase) - w * 2, yTop - 20, w * 4, H + 40);

  // Pass 1: long fibrous strips with ragged sides, broken into overlapping lengths.
  const strips = Math.round((w / 15) * detail);
  for (let k = 0; k < strips; k++) {
    const u0 = -1 + (2 * k) / strips, u1 = -1 + (2 * (k + 1)) / strips;
    let ya = yTop - 30;
    while (ya < yBase) {
      const len = rng.range(0.12, 0.35) * H + 40;
      const yb = Math.min(yBase + 10, ya + len);
      const um = (u0 + u1) / 2 + rng.range(-0.3, 0.3) / strips;
      const hu = (u1 - u0) * rng.range(0.42, 0.62);
      const left = [], right = [];
      const tip = Math.min(60, (yb - ya) * 0.3);
      for (let y = ya; y <= yb; y += 9) {
        const k0 = Math.sqrt(clamp(Math.min(y - ya, yb - y) / tip));
        const wob = nz.n2(k * 2.3, y * 0.012) * 0.25 / strips;
        left.push([edgeAt(y, um - hu * k0 + wob) + rng.range(-1.6, 1.6), y]);
        right.push([edgeAt(y, um + hu * k0 + wob) + rng.range(-1.6, 1.6), y]);
      }
      const v = lum(um) + rng.range(-0.08, 0.06) - 0.06;
      cut(ctx, [...left, ...right.reverse()], vary(barkTone(P, v), rng, 0.06), lightDir, { edge: 0.25 + 0.4 * smoothstep(0.4, 1, um * lit), edgeColor: P.pale, drop: 2.2, shadowA: 0.6 });
      if (yb >= yBase) break;           // reached the roots (the overlap below would loop forever)
      ya = yb - rng.range(10, 30);
    }
  }

  // Pass 2: shingle flakes, dense on the ridges, lighter and warmer on the lit flank.
  const flakes = Math.round(((w * H) / 260) * detail);
  for (let i = 0; i < flakes; i++) {
    const y = yTop - 10 + rng.next() * (H + 10);
    const u = rng.range(-0.98, 0.98);
    const fx = edgeAt(y, u);
    const scale = clamp(w / 220, 0.55, 1.2);
    const fw = rng.range(7, 18) * scale * (1 - 0.4 * Math.abs(u) ** 3);
    const fh = rng.range(22, 70) * scale;
    const v = lum(u) + rng.range(-0.05, 0.12);
    const pts = flake(fx, y, fw, fh, rng, u * 0.15);
    cut(ctx, pts, vary(barkTone(P, v), rng, 0.07), lightDir, {
      edge: 0.2 + 0.55 * smoothstep(0.3, 1, u * lit), edgeColor: P.pale, drop: 1.6, shadowA: 0.5,
    });
  }

  // Pass 3: dark slits between fibres and a few pale torn scraps.
  const slits = Math.round((w * H) / 900);
  for (let i = 0; i < slits; i++) {
    const y = yTop + rng.next() * H, u = rng.range(-0.95, 0.95);
    const sx = edgeAt(y, u), len = rng.range(12, 46), wd = rng.range(1, 2.6);
    ctx.fillStyle = rgba(P.crevice, rng.range(0.6, 0.95));
    ctx.beginPath();
    ctx.moveTo(sx, y); ctx.lineTo(sx + wd, y + len * 0.5); ctx.lineTo(sx, y + len); ctx.lineTo(sx - wd * 0.7, y + len * 0.5);
    ctx.fill();
  }

  // Warm light wrapping round the lit flank.
  if (rim > 0) {
    for (const y of ys) {
      const xa = edgeAt(y, lit), xb = edgeAt(y, lit * 0.55);
      ctx.fillStyle = linear(ctx, xa, 0, xb, 0, [[0, rgba(P.rim, 0.45 * rim)], [0.35, rgba(P.rim, 0.18 * rim)], [1, rgba(P.rim, 0)]]);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillRect(Math.min(xa, xb) - 2, y - 1, Math.abs(xb - xa) + 4, step + 2);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // Ambient occlusion down at the roots, where ferns crowd the trunk.
  ctx.fillStyle = linear(ctx, 0, yBase - H * 0.25, 0, yBase, [[0, 'rgba(8,4,2,0)'], [1, 'rgba(8,4,2,0.55)']]);
  ctx.fillRect(cxAt(yBase) - w * 2, yBase - H * 0.25, w * 4, H * 0.25 + 4);
  ctx.restore();

  // Moss creeping up from the roots.
  if (moss > 0) {
    const n = Math.round(w * moss * 1.6);
    for (let i = 0; i < n; i++) {
      const v = Math.pow(rng.next(), 2.2) * 0.22 * moss;
      const y = yBase - v * H - 6;
      const u = rng.range(-1, 1) * 0.95;
      const mx = edgeAt(y, u);
      const r = rng.range(3, 8);
      const c = mix('#4f6a22', '#b8b848', rng.next() * (0.4 + 0.6 * smoothstep(-0.5, 1, u * lit)));
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(mx, y - r * 1.6);
      ctx.lineTo(mx + r * 0.7, y);
      ctx.lineTo(mx, y + r * 0.6);
      ctx.lineTo(mx - r * 0.7, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  return { outline, body, edgeAt };
}
