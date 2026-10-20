// Faceted paper mountains. A mountain is a jagged skyline with fall lines running down
// from it: spurs start on the skyline's shoulders, gullies in its notches. The strips
// between neighbouring fall lines are cut as separate facets that face alternately
// toward and away from the light, so every ridge gets a lit side and a shadow side.
// Snow is laid on top as torn pieces with a white core: a cap dripping down from the
// skyline, bands hugging the spurs, and rock ribs breaking through it.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands, linear } from '../core/piece.js';
import { mix, vary, rgba } from '../core/color.js';
import {
  DEFAULT_LIGHT, clamp01, lengths, pointAt, segment, dirAt, sliver, boxOf, insidePath, brush,
} from './terrain-kit.js';

// Colour ramps run dark -> lit. haze is the colour distance pulls everything toward.
export const MOUNTAIN_PALETTES = {
  // ref05: saturated blue-violet rock, lavender shade snow, warm white sunlit snow.
  night: {
    rock: ['#183a78', '#2a4c98', '#4458ae', '#6670bc', '#8a9cd8'],
    snow: ['#8f95d6', '#b1a5e8', '#d2c8f2', '#ece6f4', '#faf3ea'],
    rim: '#ffffff',
    haze: '#7c86c8',
    shadow: 'rgba(12,16,52,0.55)',
  },
  // ref02: the same night, greyer and cooler (slate rock, lilac-grey snow).
  lake: {
    rock: ['#26406c', '#334f7c', '#405b8a', '#5a6c9e', '#8189c0'],
    snow: ['#8e8cb8', '#a49fc6', '#c2b8d8', '#ddd6ea', '#efeaf4'],
    rim: '#ffffff',
    haze: '#6e7aa8',
    shadow: 'rgba(10,16,40,0.55)',
  },
  // ref05 front ridges: bare navy-teal slopes below the snowline.
  ridge: {
    rock: ['#09223f', '#0d3866', '#174a7a', '#2a5c88', '#3e6e8c'],
    snow: ['#6f86b8', '#8a9cc8', '#a8b4d8', '#c8cee6', '#e4e6f2'],
    rim: '#f4f6ff',
    haze: '#3c5c88',
    shadow: 'rgba(4,12,30,0.55)',
  },
  // ref01: violet-blue rock, pink and peach snow lit by the setting sun.
  dusk: {
    rock: ['#30378a', '#3e4598', '#4a60ac', '#6a6cbc', '#8a7cc4'],
    snow: ['#9688c8', '#ae9ac8', '#d6a2bc', '#eeb2a8', '#f8c4a2'],
    rim: '#fff4ec',
    haze: '#b49ccc',
    shadow: 'rgba(30,20,70,0.5)',
  },
  // ref10: blue rock turning mauve, rose and cream snow in the sunrise.
  dawn: {
    rock: ['#2f4c84', '#3b5d92', '#56669e', '#776fa6', '#a081a2'],
    snow: ['#987ea6', '#b48aa4', '#d4a2aa', '#ecc4b6', '#f8e0c8'],
    rim: '#fff8ee',
    haze: '#d8b4b4',
    shadow: 'rgba(40,24,60,0.45)',
  },
};

// Resolve a palette name or object and pull it toward its haze colour
// (or hazeColor, e.g. a warmer tint for distant peaks catching the last light).
export function mountainPalette(p = 'night', haze = 0, hazeColor = null) {
  const P = typeof p === 'string' ? MOUNTAIN_PALETTES[p] : p;
  if (!haze) return P;
  const h = hazeColor ?? P.haze;
  return { ...P, rock: P.rock.map((c) => mix(c, h, haze)), snow: P.snow.map((c) => mix(c, h, haze * 0.6)) };
}

// --- geometry -------------------------------------------------------------------

// Skyline + fall lines + facets of one mountain. Pure geometry, no drawing.
//   x, y        summit
//   baseY       where the flanks meet the ground; left/right: half widths at baseY
//   bottom      how far below baseY the body continues (hidden by nearer layers)
//   spursL/R    ridges per flank (default from width); jag: skyline roughness
//   profile     flank curvature (>1 = steep near the summit); shoulder: sub-peak bumps
//   crease      chance of an extra crease splitting a facet
export function mountainGeometry({
  x, y, baseY, left = 400, right = left, bottom = 160, spurs = null,
  spursL = spurs ?? Math.max(2, Math.round(left / 60)), spursR = spurs ?? Math.max(2, Math.round(right / 60)),
  jag = 1, profile = 1.25, profileL = profile, profileR = profile, shoulder = 1.5, fan = 1,
  summitLines = 1, crease = 0.6, seed = 1,
} = {}) {
  const rng = new RNG(`mtn:${seed}`);
  const nz = noise(`mtn:${seed}`);
  const h = baseY - y;
  const flank = (s, w, n, p) => {
    // Key points from the summit outward: alternating gully notches and spur shoulders
    // on a concave flank, with slow noise for shoulders and sub-peaks.
    const keys = [];
    const m = 2 * n;
    const off = rng.range(0, 50);
    for (let k = 1; k <= m; k++) {
      // Spacing widens toward the summit so its two faces are the broadest.
      const u = Math.min(0.96, Math.pow((k + rng.range(-0.35, 0.35)) / (m + 0.7), 0.8));
      const spur = k % 2 === 0;
      const prof = 1 - Math.pow(1 - u, p);
      const sh = nz.n1(off + u * 2.6) * 0.11 * shoulder * Math.sin(Math.PI * u);
      const bump = (spur ? -1 : 1) * jag * rng.range(0.01, 0.035) * (1 - u * 0.5);
      keys.push({ p: [x + s * w * u, y + h * (prof + sh + bump)], kind: spur ? 'spur' : 'gully', u, s });
    }
    keys.push({ p: [x + s * w, baseY], kind: 'base', u: 1, s });
    return keys;
  };
  const L = flank(-1, left, spursL, profileL), R = flank(1, right, spursR, profileR);
  const keys = [...L.reverse(), { p: [x, y], kind: 'summit', u: 0, s: 0 }, ...R];

  // Fine jag between key points: crisp little steps like a cut paper edge.
  const sky = [];
  const keyIdx = [];
  for (let i = 0; i < keys.length; i++) {
    keyIdx.push(sky.length);
    sky.push(keys[i].p.slice());
    if (i === keys.length - 1) break;
    const a = keys[i].p, b = keys[i + 1].p;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(d / 9);
    const nx = (b[1] - a[1]) / (d || 1), ny = -(b[0] - a[0]) / (d || 1);
    for (let j = 1; j < n; j++) {
      const t = j / n;
      const xx = a[0] + (b[0] - a[0]) * t;
      // Sharp crags (folded noise) over a slow undulation, plus single-step chips.
      const crag = (1 - Math.abs(nz.n2(xx * 0.03, 3.3))) * 2 - 1;
      const roll = nz.n1(xx * 0.011 + 5);
      const off = (crag * 6 + roll * 7 + rng.range(-1.5, 1.5)) * jag * Math.min(1, Math.sin(t * Math.PI) * 3);
      sky.push([xx + nx * off, a[1] + (b[1] - a[1]) * t + ny * off]);
    }
  }

  // Fall lines from every spur and gully key. They leave the skyline diagonally and
  // bend toward vertical as they descend; lines further from the summit lean more,
  // so neighbours diverge instead of crossing.
  const yb = baseY + bottom;
  const lines = [];
  const fall = (top, st, kind, skyIdx, s, u) => {
    const len = yb - top[1];
    const sb = st * 0.4;
    const n = Math.max(2, Math.round(len / 50));
    const pts = [top.slice()];
    const wob = rng.range(4, 10);
    for (let j = 1; j <= n; j++) {
      const yy = (j / n) * len;
      const xx = top[0] + st * yy + ((sb - st) * yy * yy) / (2 * len) + (j < n ? rng.range(-wob, wob) : 0);
      pts.push([xx, top[1] + yy]);
    }
    lines.push({ pts, kind, sky: skyIdx, s, u });
  };
  // Local skyline steepness (dx per dy) of a flank at u, so lines stay inside it.
  const skySlope = (s, u) => {
    const w = s < 0 ? left : right, p = s < 0 ? profileL : profileR;
    return w / (h * p * Math.pow(Math.max(0.05, 1 - u), p - 1));
  };
  for (let i = 0; i < keys.length; i++) {
    const K = keys[i];
    if (K.kind === 'base') continue;
    if (K.kind === 'summit') {
      const n = Math.max(1, summitLines);
      for (let j = 0; j < n; j++) {
        const k = n === 1 ? rng.range(-0.4, 0.4) : (j / (n - 1)) * 2 - 1;
        fall(K.p, k * 0.45 * skySlope(k, 0) * fan, 'spur', keyIdx[i], k * 0.3, 0);
      }
      continue;
    }
    fall(K.p, K.s * skySlope(K.s, K.u) * (0.55 + 0.3 * K.u) * fan * rng.range(0.85, 1.1), K.kind, keyIdx[i], K.s, K.u);
  }
  // Keep the fan ordered so neighbouring lines never cross at the bottom.
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1].pts, b = lines[i].pts;
    const lo = a[a.length - 1][0] + 8;
    if (b[b.length - 1][0] < lo) b[b.length - 1][0] = lo;
  }
  for (const ln of lines) ln.L = lengths(ln.pts);

  // Boundary lines at the two base corners, then the facets between neighbours.
  const corner = (k) => {
    const p = sky[k];
    const pts = [p.slice(), [p[0], yb]];
    return { pts, L: lengths(pts), kind: 'base', sky: k, s: 0, u: 1 };
  };
  const bounds = [corner(0), ...lines, corner(sky.length - 1)];
  const faces = [];
  const face = (A, B, facing) => faces.push({ A, B, top: sky.slice(A.sky, B.sky + 1), facing, side: (A.s + B.s) / 2, u: (A.u + B.u) / 2 });
  for (let i = 0; i < bounds.length - 1; i++) {
    const A = bounds[i], B = bounds[i + 1];
    // A spur on the left and a gully on the right: the surface falls away to the right.
    let facing;
    if (A.kind === 'spur' && B.kind !== 'spur') facing = 1;
    else if (B.kind === 'spur' && A.kind !== 'spur') facing = -1;
    else facing = Math.sign(A.s + B.s) * 0.5;
    // Minor crease: a line between the two, splitting the facet into two strips
    // that face the same way but are cut from slightly different sheets.
    if (A.kind !== 'base' && B.kind !== 'base' && rng.chance(crease)) {
      const k = rng.range(0.35, 0.65);
      const m = Math.round(A.sky + (B.sky - A.sky) * k);
      const aLen = A.L[A.L.length - 1], bLen = B.L[B.L.length - 1];
      const n = Math.max(A.pts.length, B.pts.length);
      const pts = [sky[m].slice()];
      for (let j = 1; j <= n; j++) {
        const t = j / n;
        const pa = pointAt(A.pts, A.L, t * aLen), pb = pointAt(B.pts, B.L, t * bLen);
        const jit = j < n ? rng.range(-5, 5) : 0;
        pts.push([pa[0] + (pb[0] - pa[0]) * k + jit, pa[1] + (pb[1] - pa[1]) * k]);
      }
      const M = { pts, L: lengths(pts), kind: 'crease', sky: m, s: (A.s + B.s) / 2, u: (A.u + B.u) / 2 };
      lines.push(M);
      face(A, M, facing);
      face(M, B, facing);
    } else face(A, B, facing);
  }
  const silhouette = [...sky, [sky[sky.length - 1][0], yb], [sky[0][0], yb]];
  return { x, y, baseY, bottom: yb, h, sky, lines, faces, silhouette, left, right };
}

// Polygon of a facet strip between its two boundary lines, from arc lengths
// (a0 on A, b0 on B) down to (a1, b1). With a0 = b0 = 0 the top follows the skyline,
// lifted a few px so the clip to the silhouette leaves no seam. upper/lower replace
// the straight top/bottom edges with polylines running from A to B.
function strip(f, a0, b0, a1, b1, { upper = null, lower = null } = {}) {
  const { A, B } = f;
  let top;
  if (upper) top = upper;
  else if (a0 <= 0 && b0 <= 0) top = f.top.map(([px, py]) => [px, py - 6]);
  else top = [pointAt(A.pts, A.L, a0), pointAt(B.pts, B.L, b0)];
  const right = segment(B.pts, B.L, b0, b1);
  const bot = lower ? lower.slice().reverse() : [pointAt(B.pts, B.L, b1), pointAt(A.pts, A.L, a1)];
  const leftSide = segment(A.pts, A.L, a0, a1).reverse();
  return [...top, ...right.slice(1), ...bot.slice(1), ...leftSide.slice(1, -1)];
}

// A jagged cut from point P (left) to Q (right): teeth hang down along the fall
// direction like snow melting out of gullies.
function dripEdge(P, Q, fall, rng, { teeth = 4, depth = 26 } = {}) {
  const pts = [P];
  const n = teeth * 2;
  for (let k = 1; k < n; k++) {
    const t = (k + rng.range(-0.3, 0.3)) / n;
    const bx = P[0] + (Q[0] - P[0]) * t, by = P[1] + (Q[1] - P[1]) * t;
    const d = k % 2 === 1 ? depth * rng.range(0.3, 1.1) * (rng.chance(0.2) ? 2 : 1) : -depth * rng.range(0.05, 0.3);
    const lean = rng.range(-0.25, 0.25);
    pts.push([bx + (fall[0] + lean) * d, by + fall[1] * d]);
  }
  pts.push(Q);
  return pts;
}

// --- drawing -------------------------------------------------------------------

// How much a facet faces the light, 0..1: alternating facing plus the flank it sits on.
function facetTone(f, light, rng, contrast) {
  const lx = Math.max(-1, Math.min(1, light[0] * 2));
  return clamp01(0.42 + (0.3 * f.facing + 0.3 * f.side) * lx * contrast + rng.range(-0.08, 0.08));
}

// Ramp colour for a tone 0..1 using stops lo..hi of the ramp.
function pick(ramp, t, lo = 0, hi = ramp.length - 1) {
  return ramp[Math.round(lo + clamp01(t) * (hi - lo))];
}

const angleOf = (v) => Math.atan2(v[1], v[0]);

// Rock facets: each strip between fall lines, cut across once or twice into pieces
// that step in tone. Lit pieces stand slightly proud with a contact shadow.
function drawFacets(ctx, G, P, light, rng, { detail, contrast }) {
  for (const f of G.faces) {
    const t = facetTone(f, light, rng, contrast);
    f.t = t;
    const A = f.A, B = f.B;
    const aLen = A.L[A.L.length - 1], bLen = B.L[B.L.length - 1];
    const nCuts = detail > 0 ? rng.int(1, 1 + Math.round(detail * 2)) : 0;
    const ks = [];
    for (let c = 0; c < nCuts; c++) ks.push(rng.range(0.15, 0.85));
    ks.sort((p, q) => p - q);
    let prevB = 0;
    const cuts = ks.map((k) => {
      const kb = Math.max(prevB + 0.06, Math.min(0.95, k + rng.range(-0.12, 0.12)));
      prevB = kb;
      const PA = pointAt(A.pts, A.L, k * aLen), PB = pointAt(B.pts, B.L, kb * bLen);
      const mid = [(PA[0] + PB[0]) / 2 + rng.range(-4, 4), (PA[1] + PB[1]) / 2 + rng.range(-12, 12)];
      return { a: k * aLen, b: kb * bLen, pts: [PA, mid, PB] };
    });
    const bands = [{ a: 0, b: 0, pts: null }, ...cuts, { a: aLen, b: bLen, pts: null }];
    // Grain: the two boundary lines averaged, turned away from the summit so streaks
    // on a flank run diagonally down and out.
    const da = dirAt(A.pts, A.L, aLen * 0.3), db = dirAt(B.pts, B.L, bLen * 0.3);
    const pa = pointAt(A.pts, A.L, aLen * 0.25), pb = pointAt(B.pts, B.L, bLen * 0.25);
    const rx = (pa[0] + pb[0]) / 2 - G.x, ry = Math.max(1, (pa[1] + pb[1]) / 2 - G.y);
    const rl = Math.hypot(rx, ry);
    const fx = da[0] + db[0] + (rx / rl) * 1.2, fy = da[1] + db[1] + (ry / rl) * 1.2;
    const fall = [fx / Math.hypot(fx, fy), fy / Math.hypot(fx, fy)];
    f.fall = fall;
    for (let c = 0; c < bands.length - 1; c++) {
      const U = bands[c], D = bands[c + 1];
      const pts = strip(f, U.a, U.b, D.a, D.b, { upper: U.pts, lower: D.pts });
      const tone = clamp01(t + (c === 0 ? 0 : rng.range(-0.22, 0.16)));
      // Most rock sits in the darker stops; only facets turned full to the light reach the top.
      const col = vary(pick(P.rock, tone * 0.82, 1), rng, 0.05);
      const lit = tone > 0.62;
      const path = piece(ctx, pts, {
        fill: col,
        shadow: lit ? { color: 'rgba(8,10,40,0.4)', blur: 3, x: -light[0] * 2, y: 1.5 } : null,
        bevel: lit ? { light, width: 1.3, hi: 0.25, lo: 0 } : null,
      });
      if (detail > 0) {
        brush(ctx, path, { angle: angleOf(fall), amt: 0.2 * detail, seed: rng.int(1, 1e9) });
        chips(ctx, path, boxOf(pts), fall, rng, { count: (boxOf(pts).w * boxOf(pts).h) / 1400 * detail, color: (k) => vary(pick(P.rock, tone * 0.82 + k * 0.3, 1), rng, 0.04), light });
      }
    }
  }
}

// Small facets scattered over a piece: slim triangles pointing down the fall line,
// a step lighter or darker than the piece. They break big faces into the many
// little crushed planes of the reference paper.
function chips(ctx, path, box, fall, rng, { count, color, light, len = [10, 38], width = [4, 12] }) {
  ctx.save();
  ctx.clip(path);
  const n = Math.round(count);
  for (let i = 0; i < n; i++) {
    const px = box.x + rng.next() * box.w, py = box.y + rng.next() * box.h;
    if (!insidePath(path, px, py)) continue;
    const l = rng.range(len[0], len[1]), w = rng.range(width[0], width[1]);
    const a = Math.atan2(fall[1], fall[0]) + rng.range(-0.3, 0.3);
    const ux = Math.cos(a), uy = Math.sin(a);
    const side = rng.sign();
    const tri = [[px, py], [px + ux * l + side * -uy * w * 0.3, py + uy * l + side * ux * w * 0.3], [px + ux * l * 0.45 + side * -uy * w, py + uy * l * 0.45 + side * ux * w]];
    const k = rng.chance(0.5) ? 1 : -1;
    piece(ctx, tri, { fill: color(k), bevel: k > 0 ? { light, width: 1, hi: 0.15, lo: 0 } : null });
  }
  ctx.restore();
}

// Snow: a cap per facet from the skyline down to a dripping cut, and long bands of
// snow hugging the spurs below it, so the slopes read as streaks of snow and rock.
function drawSnow(ctx, G, P, light, rng, { snow, snowLow, snowline, ridge, detail, drips }) {
  for (const ln of G.lines) {
    const len = ln.L[ln.L.length - 1];
    const k = ln.kind === 'spur' ? 1 : ln.kind === 'crease' ? (1 + snowLow) / 2 : snowLow;
    // Snow thins along the ridge and stops at the snowline.
    const below = (ln.pts[0][1] - G.y) / (G.h * snowline);
    const want = G.h * snow * k * rng.range(0.7, 1.25) * Math.max(0, 1 - below * below);
    ln.snow = Math.max(0, Math.min(len * 0.95, want));
  }
  G.faces[0].A.snow = 0;
  G.faces[G.faces.length - 1].B.snow = 0;
  const shade = 'rgba(10,12,50,0.45)';
  const scale = Math.max(0.6, Math.min(1.6, G.h / 380));
  for (const f of G.faces) {
    const lit = f.t > 0.55;
    const col = vary(pick(P.snow, f.t, 1), rng, 0.03);
    const fall = f.fall;
    const snowPiece = (pts, extra = {}) => piece(ctx, pts, {
      fill: col,
      torn: { amp: 1.2, freq: 0.12, fine: 0.6, seed: rng.int(1, 1e6), step: 3 },
      rim: { color: P.rim, width: 0.6 },
      shadow: { color: shade, blur: 4, x: -light[0] * 2, y: 2.5 },
      bevel: lit ? { light, width: 1.4, hi: 0.4, lo: 0.06 } : { light, width: 1.2, hi: 0.15, lo: 0.1 },
      ...extra,
    });

    // Cap.
    const dA = f.A.snow, dB = f.B.snow;
    if (dA >= 4 || dB >= 4) {
      const PA = pointAt(f.A.pts, f.A.L, dA), PB = pointAt(f.B.pts, f.B.L, dB);
      const span = Math.hypot(PB[0] - PA[0], PB[1] - PA[1]);
      const teeth = Math.max(1, Math.round((span / 26) * drips));
      const lower = dripEdge(PA, PB, fall, rng, { teeth, depth: Math.min(40, 8 + span * 0.18) * scale });
      const pts = strip(f, 0, 0, dA, dB, { lower });
      const path = snowPiece(pts);
      if (detail > 0) {
        const b = boxOf(pts);
        brush(ctx, path, { angle: angleOf(fall), amt: 0.12 * detail, seed: rng.int(1, 1e9) });
        chips(ctx, path, b, fall, rng, { count: (b.w * b.h) / 1800 * detail, color: (k) => vary(pick(P.snow, f.t + k * 0.25, 1), rng, 0.03), light });
      }
      rockInSnow(ctx, f, path, boxOf(pts), P, rng, { lit, detail, fall, scale });
    }

    // Ridge bands: snow lying along a spur on this facet's side of it.
    if (ridge <= 0) continue;
    ctx.save();
    ctx.clip(pathOf(strip(f, 0, 0, f.A.L[f.A.L.length - 1], f.B.L[f.B.L.length - 1])));
    for (const ln of [f.A, f.B]) {
      if (ln.kind !== 'spur' && !(ln.kind === 'crease' && rng.chance(0.4))) continue;
      const len = ln.L[ln.L.length - 1];
      const d0 = ln.snow * 0.5;
      const D = Math.min(len * 0.9, ln.snow + G.h * ridge * rng.range(0.35, 1.1) * (1 - ln.u * 0.5));
      if (D - d0 < 20) continue;
      const sgn = ln === f.A ? 1 : -1;
      const w0 = rng.range(10, 28) * scale * (lit ? 1.15 : 0.85);
      const edge = [], inner = [];
      const n = Math.max(4, Math.ceil((D - d0) / 6));
      const wn = noise(`band:${rng.int(1, 1e6)}`);
      let nextDrip = rng.range(18, 50);
      for (let i = 0; i <= n; i++) {
        const d = d0 + ((D - d0) * i) / n;
        const p = pointAt(ln.pts, ln.L, d), t = dirAt(ln.pts, ln.L, d);
        // Slowly varying width, with a sharp drip jutting out every so often.
        let tooth = 0.55 + 0.7 * Math.abs(wn.n1(d * 0.035)) + rng.range(-0.08, 0.08);
        if (d >= nextDrip && i < n) { tooth *= rng.range(1.7, 2.6); nextDrip = d + rng.range(18, 55); }
        const w = w0 * Math.pow(1 - i / n, 0.6) * tooth;
        inner.push([p[0] - sgn * t[1] * 3, p[1] + sgn * t[0] * 3]);
        edge.push([p[0] + sgn * t[1] * w + fall[0] * w * 0.3, p[1] - sgn * t[0] * w + fall[1] * w * 0.3]);
      }
      snowPiece([...inner, ...edge.reverse()], { torn: { amp: 0.9, freq: 0.18, fine: 0.5, seed: rng.int(1, 1e6), step: 3 } });
    }
    ctx.restore();
  }
}

// Rock breaking through a snow piece: slivers along gullies and scattered ribs down
// the fall line (rock on shaded snow, blue shadow streaks on lit snow).
function rockInSnow(ctx, f, path, box, P, rng, { lit, detail, fall, scale }) {
  const rocks = [];
  for (const ln of [f.A, f.B]) {
    if (ln.kind === 'gully' && ln.snow > 26 && !ln.rocked) {
      ln.rocked = true;
      rocks.push(segment(ln.pts, ln.L, ln.snow * rng.range(0.1, 0.4), ln.snow * rng.range(0.75, 1.05)));
    }
  }
  const ribs = [];
  const scatter = (n, out, len) => {
    for (let i = 0; i < n; i++) {
      const px = box.x + rng.next() * box.w, py = box.y + rng.next() * box.h;
      if (!insidePath(path, px, py)) continue;
      const l = rng.range(len[0], len[1]) * scale;
      const lean = rng.range(-0.15, 0.15);
      out.push([[px, py], [px + (fall[0] + lean) * l * 0.5 + rng.range(-2, 2), py + fall[1] * l * 0.5], [px + (fall[0] + lean) * l, py + fall[1] * l]]);
    }
  };
  if (detail > 0) {
    const area = box.w * box.h * detail;
    scatter(Math.round(area / (lit ? 4500 : 1500)), rocks, [30, 100]);
    if (lit) scatter(Math.round(area / 2600), ribs, [30, 110]);
  }
  for (const seg of rocks) {
    piece(ctx, sliver(seg, rng.range(1.8, 4) * scale * (0.6 + detail * 0.4), { bias: rng.range(-0.6, 0.6) }), {
      fill: vary(pick(P.rock, rng.range(0.1, 0.55), 1), rng, 0.04),
      torn: { amp: 0.7, freq: 0.2, fine: 0.4, seed: rng.int(1, 1e6), step: 3 },
    });
  }
  for (const seg of ribs) {
    piece(ctx, sliver(seg, rng.range(1.6, 3.6) * scale, { bias: rng.range(-0.6, 0.6) }), {
      fill: vary(pick(P.snow, rng.range(0, 0.4), 1), rng, 0.03),
      torn: { amp: 0.6, freq: 0.2, fine: 0.3, seed: rng.int(1, 1e6), step: 3 },
    });
  }
}

// Draw one mountain into ctx (inside a sprite's draw). Returns its geometry.
//   palette    name or object (MOUNTAIN_PALETTES); haze 0..1 pulls it toward distance
//   hazeColor  colour to haze toward instead of the palette's own
//   light      unit vector toward the light: decides which facets are lit
//   snow       0..1 fraction of the height covered by snow along spurs (0 = bare)
//   snowLow    snow depth in gullies relative to spurs
//   snowline   0..1 fraction of the height (from the summit) below which ridges hold no snow
//   ridge      how far (fraction of height) snow bands run down the spurs below the cap
//   detail     0..1 facet splits, rock slivers and brush grain
//   drips      density of the teeth along snow edges
//   contrast   strength of the lit/shadow facet difference
//   foot       0..1 darkening of the rock toward the base (valley shade)
//   cast       drop shadow on whatever was drawn earlier in the same sprite
//   edge       strength of the lit/unlit cut edge around the silhouette
// plus the mountainGeometry() options (x, y, baseY, left, right, spurs, jag ...).
export function drawMountain(ctx, opts = {}) {
  const {
    palette = 'night', haze = 0, hazeColor = null, light = DEFAULT_LIGHT, snow = 0.45, snowLow = 0.35, snowline = 0.8, ridge = 0.8,
    detail = 1, cast = { blur: 10, x: 0, y: 6 }, seed = 1, drips = 1, contrast = 1, edge = 0.35, foot = 0.55,
  } = opts;
  const P = mountainPalette(palette, haze, hazeColor);
  const G = mountainGeometry({ ...opts, seed });
  const rng = new RNG(`mtn-draw:${seed}`);
  const sil = pathOf(G.silhouette);

  // Body: the darkest sheet, casting a shadow on the mountains behind.
  piece(ctx, G.silhouette, {
    fill: P.rock[0],
    shadow: cast ? { color: P.shadow, blur: cast.blur, x: cast.x ?? 0, y: cast.y ?? 6 } : null,
  });
  ctx.save();
  ctx.clip(sil);
  drawFacets(ctx, G, P, light, rng, { detail, contrast });
  // Valley shade: the rock deepens toward the foot of the mountain.
  if (foot > 0) {
    ctx.fillStyle = linear(ctx, 0, G.y + G.h * 0.4, 0, G.baseY + 40, [rgba(P.rock[0], 0), rgba(P.rock[0], foot)]);
    ctx.fillRect(G.x - G.left - 20, G.y + G.h * 0.4, G.left + G.right + 40, G.bottom - G.y);
  }
  if (snow > 0) drawSnow(ctx, G, P, light, rng, { snow, snowLow, snowline, ridge, detail, drips });
  ctx.restore();
  // Crisp cut edge on the whole silhouette.
  if (edge) bevelBands(ctx, sil, { light, width: 1.6, hi: edge, lo: edge * 0.5 });
  return G;
}

// A row of mountains on one sheet, drawn back to front in the given order.
//   peaks   [{ x, y, left, right, baseY, snow, seed, ... }] per-peak overrides
//   common  options shared by every peak (palette, haze, light, snow, detail ...)
//   fade    { color, from, to, alpha } gradient wash over the lower part (valley haze)
export function drawRange(ctx, { peaks = [], fade = null, ...common } = {}) {
  const out = peaks.map((pk, i) => drawMountain(ctx, { seed: (common.seed ?? 1) * 97 + i * 13, ...common, ...pk }));
  if (fade) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = linear(ctx, 0, fade.from, 0, fade.to, [[0, rgba(fade.color, 0)], [1, rgba(fade.color, fade.alpha ?? 0.6)]]);
    ctx.fillRect(-1e4, Math.min(fade.from, fade.to), 2e4, Math.abs(fade.to - fade.from) + 2000);
    ctx.restore();
  }
  return out;
}

// Bounding box (authored px) that holds a set of peaks with room for shadows.
export function rangeBox(peaks, common = {}, pad = 40) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const pk of peaks) {
    const o = { ...common, ...pk };
    const l = o.left ?? 400, r = o.right ?? l;
    x0 = Math.min(x0, o.x - l); x1 = Math.max(x1, o.x + r);
    y0 = Math.min(y0, o.y); y1 = Math.max(y1, o.baseY + (o.bottom ?? 160));
  }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
}

// Add a mountain row as one baked plane. Returns the layer.
//   z, box (defaults to rangeBox), res, mat, plus everything drawRange takes.
//   layer: extra S.add options (anim, alpha, shadow ...)
export function addRange(S, { z = 5000, name = 'range', box = null, res = 1, mat = 'paper', layer = {}, shadow = { blur: 14 }, ...opts } = {}) {
  const b = box ?? rangeBox(opts.peaks ?? [], opts);
  return S.plane(z, {
    name, ...b, res, mat, shadow,
    edge: { width: 1.4, hi: 0.3, lo: 0.2, soft: 0.6 },
    draw: (ctx) => drawRange(ctx, { light: S.light, ...opts }),
  }, layer);
}
