// Shared building blocks for the paper flora: palettes, the breeze, outline profiles
// and the small shading tricks (folded halves, felt bumps, ribbon stems) that every
// flower and leaf uses.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands } from '../core/piece.js';
import { transform, TAU } from '../core/geom.js';
import { shade, rgba, adjust } from '../core/color.js';

export const DEFAULT_LIGHT = [0.55, -0.83];

// Paper recipe for petals and leaves: the house 'paper' with a little more fibre and
// crumple, since flora is seen large in the foreground.
export const FLORA_PAPER = [{ tex: 'fiber', amt: 0.85 }, { tex: 'crumple', amt: 0.55, scale: 0.42 }];

// --- Palettes -------------------------------------------------------------------
// Colours sampled from the references. 'night' (ref02, ref09) is the default;
// the others only override what differs.

const NIGHT = {
  echinacea: {
    // Ordered from the back of the head (purple, in shade) to the front (pink, lit).
    petals: ['#9a3488', '#b8429e', '#d052a4', '#e4669e', '#f07ea2'],
    petalDark: '#7a1458',
    petalLight: '#ffa2c2',
    cone: '#f56a0e', coneLight: '#ff9a30', coneDark: '#b03600',
  },
  daisy: { petal: '#f5e1c8', tip: '#fcf0de', shade: '#c6b0b4', center: '#f6a410', centerDark: '#c06400' },
  tansy: { ball: '#ffae00', light: '#ffd23c', dark: '#c47000' },
  astilbe: { florets: ['#c01a36', '#d02842', '#dc3848', '#e64c50'], light: '#ff8a6c', dark: '#6a081c', stem: '#7e3426' },
  lupine: { florets: ['#3a36b8', '#4840c6', '#5a4ed2'], banner: '#8a78e6', light: '#b8a8f4', dark: '#1e1a66', bud: '#6a4cc0', budTip: '#a88ae0', stem: '#5c7838' },
  larkspur: { petal: '#6a4ac4', light: '#a28ae8', dark: '#2e2070', center: '#e6dcf2' },
  zinnia: { petals: ['#d8304c', '#e4445a', '#ee6070'], dark: '#7e1028', center: '#f0a030' },
  marigold: { petal: '#f8b216', light: '#ffd860', dark: '#c46e04' },
  leaf: { light: '#94a24c', mid: '#668a38', dark: '#1f4c34', deep: '#0b2e27', yellow: '#cca216', lime: '#a8b230' },
  stem: '#86a84a',
  fern: { light: '#a2aa3e', mid: '#7f9636', teal: '#2f7468', dark: '#24503a' },
  clover: { leaf: '#6f9c6c', light: '#93c08a', dark: '#3f6a48' },
  shrub: { top: '#dcbc30', mid: '#c4a628', low: '#8e9a2c', stem: '#7f9a34', dark: '#4d6526' },
  moss: { light: '#c2c24a', mid: '#9aa83a', dark: '#5f7028' },
  amanita: { cap: '#d4352a', capLight: '#ec6a4c', capDark: '#8c1a16', spot: '#f3e9d6', gill: '#ecd9b8', stem: '#efe3c9', stemDark: '#b9a17c' },
};

function deepMerge(base, over) {
  if (!over) return base;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(base[k] || {}, v) : v;
  }
  return out;
}

export const FLORA_PALETTES = {
  night: NIGHT,
  // ref01: warm sunset light, purpler coneflowers, brighter meadow greens.
  dusk: deepMerge(NIGHT, {
    echinacea: { petals: ['#7a34a8', '#8e3cb4', '#a046b8', '#b452bc', '#c260c0'], petalDark: '#521a70', petalLight: '#de96e0', cone: '#f08a1e', coneLight: '#ffb44a', coneDark: '#b04a06' },
    daisy: { petal: '#f6e6d0', tip: '#fdf3e4', shade: '#d0b4b0', center: '#f4a010' },
    astilbe: { florets: ['#d42c4c', '#e2405a', '#ec566a', '#f46c7c'], light: '#ffb0a4', dark: '#80102c' },
    leaf: { light: '#b2c04c', mid: '#88a63c', dark: '#4a7a34', deep: '#2a5a2e', lime: '#c2c836', yellow: '#d4b020' },
    stem: '#8aac44',
  }),
  // ref03: cool moonlit forest floor.
  forest: deepMerge(NIGHT, {
    daisy: { petal: '#ece4d6', tip: '#f6f0e6', shade: '#a9a6b8', center: '#f0a82a' },
    leaf: { light: '#7f9a5a', mid: '#4f7a4c', dark: '#24503e', deep: '#12332c' },
    lupine: { florets: ['#5a44b4', '#6a52c0', '#7a62c8'], banner: '#9a86dc', light: '#bfb0ee', dark: '#2c2270', bud: '#6a52b8', budTip: '#a08ad8' },
  }),
  // ref10: golden dawn, warmer pinks and yellows.
  dawn: deepMerge(NIGHT, {
    echinacea: { petals: ['#a83fae', '#b947ae', '#c652a8', '#d260a8', '#dc6eaa'], petalDark: '#6a1c66', petalLight: '#ec96c6', cone: '#f39226', coneLight: '#ffbe58', coneDark: '#b45208' },
    astilbe: { florets: ['#c42c46', '#d43e52', '#e05260', '#ea6670'], light: '#fa9a90' },
    leaf: { light: '#a2aa58', mid: '#768e40', dark: '#355c38', deep: '#1a3e2c' },
  }),
};

// Resolve a palette name or partial override object against the night palette.
export function floraPalette(p) {
  if (!p) return NIGHT;
  if (typeof p === 'string') return FLORA_PALETTES[p] ?? NIGHT;
  return deepMerge(NIGHT, p);
}

// --- The breeze -------------------------------------------------------------------
// One wind field for every plant: a slow personal sway plus gusts that travel across
// the frame from left to right, so neighbouring stems lean together. Returns radians.

export function breeze(t, x, { amp = 0.035, phase = 0, period = 4.2, gust = 1, seed = 'breeze', speed = 260 } = {}) {
  const nz = noise(seed);
  const own = Math.sin((t / period + phase) * TAU) * 0.55 + Math.sin((t / (period * 0.53) + phase * 1.7) * TAU) * 0.15;
  // Gust envelope: smooth noise sampled along x - speed * t, biased to push one way.
  const g = nz.fbm((x - speed * t) * 0.0022, 0.37, 2);
  return amp * (own + gust * (0.35 + g * 1.1));
}

// --- Outline profiles ----------------------------------------------------------------

// A petal / blade outline: base at the origin, tip at (0, -len).
//   base   width at the base (fraction of max)       belly  where the widest point sits
//   tip    width at the tip (0 = pointed)            taper  >1 holds the width longer
//   curl   bends the tip sideways (fraction of len)  notch  depth of a notched tip
//   skew   makes one side fuller than the other
//   round  0..1 blends the pointed taper toward an elliptical, rounded end
//   serrate { count, depth } scallops along both edges (fern pinnae, toothed leaves)
export function bladeOutline(len, wid, { base = 0.3, belly = 0.5, tip = 0, taper = 1, curl = 0, notch = 0, n = 14, skew = 0, round = 0, serrate = null } = {}) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    // Sample more densely toward the tip so rounded ends stay smooth.
    const t = round > 0 ? 1 - (1 - i / n) ** 1.35 : i / n;
    const u = (t - belly) / (1 - belly);
    let w = t < belly
      ? base + (1 - base) * Math.sin((t / belly) * Math.PI / 2)
      : (1 - round) * (tip + (1 - tip) * Math.pow(Math.cos(u * Math.PI / 2), 1 / taper)) + round * Math.sqrt(Math.max(0, 1 - u * u));
    if (serrate) w *= 1 - serrate.depth * Math.pow(0.5 - 0.5 * Math.cos(TAU * serrate.count * t), 2);
    const bend = curl * t * t * len;
    L.push([-w * wid * (1 + skew) + bend, -t * len]);
    R.push([w * wid * (1 - skew) + bend, -t * len]);
  }
  if (notch > 0) {
    const tipW = Math.max(tip, 0.18) * wid;
    const bend = curl * len;
    L[n] = [bend - tipW, -len];
    R[n] = [bend + tipW, -len];
    return [...L, [bend, -len * (1 - notch)], ...R.reverse()];
  }
  return [...L, ...R.reverse()];
}

// Midline of a bladeOutline (base to tip), for creases and fold shading.
export function bladeMidline(len, { curl = 0, n = 10 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([curl * t * t * len, -t * len]);
  }
  return pts;
}

// Points along a quadratic curve from a to b, bulging sideways by `bow` px.
export function curve(a, b, bow = 0, n = 12) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const c = [mx - (dy / l) * bow, my + (dx / l) * bow];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return pts;
}

// Ribbon polygon around a polyline, width tapering from w0 to w1.
export function ribbon(pts, w0, w1 = w0) {
  const L = [], R = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    L.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
    R.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  return [...L, ...R.reverse()];
}

// --- Shading tricks ------------------------------------------------------------------

// The house edge light for one piece. `b` may be true or bevelBands() overrides.
export function bevelOf(ctx, path, light, b = {}) {
  const o = b === true ? {} : b;
  bevelBands(ctx, path, { light, width: o.width ?? 1.3, hi: o.hi ?? 0.32, lo: o.lo ?? 0.22, soft: 0, hiColor: o.hiColor ?? '#fff6e6' });
}

// One half of a folded piece: lighten it if its outward side faces the light, darken
// it otherwise. `half` is a polygon covering that side of the crease (it may reach
// well past the outline; it is clipped to `path`).
export function foldShade(ctx, path, half, sideNormal, light, { dark = 0.2, lift = 0.1 } = {}) {
  const facing = sideNormal[0] * light[0] + sideNormal[1] * light[1];
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = facing >= 0
    ? rgba('#fff6ec', lift * (0.4 + facing * 0.6))
    : rgba('#1a0614', dark * (0.4 - facing * 0.6));
  ctx.fill(pathOf(half));
  ctx.restore();
}

// A pressed crease: a dark groove with a thin lit lip on the light side.
export function creaseLine(ctx, path, line, light, alpha = 0.35, width = 1.1) {
  ctx.save();
  ctx.clip(path);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const p = pathOf(line, { closed: false, smooth: line.length > 2 });
  ctx.strokeStyle = rgba('#1a0614', alpha * 0.7);
  ctx.lineWidth = width;
  ctx.stroke(p);
  ctx.translate(light[0] * width * 0.8, light[1] * width * 0.8);
  ctx.strokeStyle = rgba('#fffaf0', alpha * 0.5);
  ctx.lineWidth = width * 0.6;
  ctx.stroke(p);
  ctx.restore();
}

// Placement of local outline points in world space: { x, y, rot, sx, sy, squash }
// (rot 0 = tip up; squash flattens vertically after rotating, for tilted flower
// heads), or any function mapping an array of points.
export function placer(at) {
  if (typeof at === 'function') return at;
  const T = { x: 0, y: 0, rot: at.rot ?? 0, sx: at.sx ?? 1, sy: at.sy ?? at.sx ?? 1 };
  const k = at.squash ?? 1;
  return (pts) => transform(pts, T).map(([px, py]) => [at.x + px, at.y + py * k]);
}

// A blade-shaped piece placed in world space and folded along its midline.
//   at   placement, see placer()
//   fill colour or gradient, or (pts) => fill for gradients that need the outline
export function foldedBlade(ctx, len, wid, shapeOpts, at, { fill, light = DEFAULT_LIGHT, bevel = null, shadow = null, dark = 0.2, lift = 0.1, crease = 0.35, rim = null, torn = null } = {}) {
  const M = placer(at);
  const local = bladeOutline(len, wid, shapeOpts);
  const mid = bladeMidline(len, { curl: shapeOpts.curl ?? 0 });
  const pts = M(local);
  const path = piece(ctx, pts, { fill: typeof fill === 'function' ? fill(pts) : fill, shadow, rim, torn, smooth: !torn });
  if (dark || lift) {
    const B = wid * 4;
    const tipX = mid[mid.length - 1][0];
    // Outward direction of the left half, measured through the placement.
    const [p0, p1] = M([[0, -len * 0.5], [-1, -len * 0.5]]);
    const dl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const side = [(p1[0] - p0[0]) / dl, (p1[1] - p0[1]) / dl];
    foldShade(ctx, path, M([...mid, [tipX - B, -len - B], [-B, B * 0.3]]), side, light, { dark, lift });
    foldShade(ctx, path, M([...mid, [tipX + B, -len - B], [B, B * 0.3]]), [-side[0], -side[1]], light, { dark, lift });
  }
  if (crease) creaseLine(ctx, path, M(mid.slice(1, -1)), light, crease);
  if (bevel) bevelOf(ctx, path, light, bevel);
  return { path, pts, mid: M(mid) };
}

// Felt / quilled bumps: many tiny dots clipped to a path, each with a dark crescent
// away from the light under a light cap toward it.
export function feltDots(ctx, path, { cx, cy, rx, ry, n = 120, size = 1.2, light = DEFAULT_LIGHT, hi = '#ffffff', lo = '#000000', alpha = 0.32, seed = 1 }) {
  const r = new RNG(seed);
  ctx.save();
  ctx.clip(path);
  for (let i = 0; i < n; i++) {
    const a = r.next() * TAU, d = Math.sqrt(r.next());
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    const rad = size * (0.55 + r.next() * 0.8);
    ctx.fillStyle = rgba(lo, alpha * (0.6 + r.next() * 0.6));
    ctx.beginPath();
    ctx.arc(x - light[0] * rad * 0.45, y - light[1] * rad * 0.45, rad, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(hi, alpha * (0.5 + r.next() * 0.6));
    ctx.beginPath();
    ctx.arc(x + light[0] * rad * 0.35, y + light[1] * rad * 0.35, rad * 0.72, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Soft darkening painted only over what is already on the canvas (the contact shadow
// under a cone, a leaf base in shade).
export function shadeOver(ctx, x, y, rx, ry, alpha = 0.4, color = '#140a10') {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.55, rgba(color, alpha * 0.6));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

export function linearAlong(ctx, a, b, stops) {
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

// Flat paper stem: a tapered ribbon with a lit edge and a contact shadow.
export function drawStem(ctx, pts, { width = 4, tipWidth = null, color = NIGHT.stem, light = DEFAULT_LIGHT, shadow = true, seed = 1 } = {}) {
  const r = new RNG(seed);
  const col = adjust(color, { l: (r.next() - 0.5) * 0.06 });
  const poly = ribbon(pts, width, tipWidth ?? width * 0.7);
  const path = piece(ctx, poly, {
    fill: linearAlong(ctx, pts[0], pts[pts.length - 1], [shade(col, -0.3), col, shade(col, 0.08)]),
    shadow: shadow ? { color: 'rgba(8,14,6,0.45)', blur: 3, x: -light[0] * 2, y: 2 } : null,
  });
  bevelOf(ctx, path, light, { width: Math.min(1.2, width * 0.3), hi: 0.35, lo: 0.25, soft: 0.2 });
  return path;
}
