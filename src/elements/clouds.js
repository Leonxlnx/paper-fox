// Scalloped paper clouds in many moods.
//
// A cumulus is a stack of cut-paper tiers, back to front. Each tier is a row of big
// overlapping puffs with gently lobed (cauliflower) edges over a backing body. Every
// puff is painted as its own piece: a tone picked from the palette by where it sits
// relative to the light, a volume gradient, its own crumple and hairline creases, a
// soft bevel and a contact shadow on the puffs already beneath it. A tier is baked into
// one sprite; tiers are drawn back to front so each casts a drop shadow on what lies
// behind. Per frame clouds only drift and breathe (a slow, out-of-phase tier swell).
//
// The same machinery makes streaks (a tapered body with low scallops), cloud seas
// (rows of banks receding into haze) and, in clouds-storm.js, the storm ceiling with a
// lit opening and low mist bands.

import { RNG, noise } from '../core/rng.js';
import { pathOf, linear } from '../core/piece.js';
import { tear, TAU } from '../core/geom.js';
import { texture } from '../core/paper.js';
import { surface } from '../core/canvas.js';
import { mix, rgba, vary } from '../core/color.js';
import { drawSprites } from '../core/sprite.js';
import { osc, clamp, lerp } from '../core/ease.js';

// --- palettes ----------------------------------------------------------------
//
// ramp     tones from fully lit (0) to deepest shade (1)
// tiers    base tone of the back ... front tier (interpolated for other tier counts)
// lit      how much the side of the cloud facing the light brightens a puff
// vert     extra darkening toward the base (gravity shading)
// spread   tone range across one puff, lit side to far side
// hi, lo   bevel colours; bevel: [hi, lo] strengths; shadow: contact shadow colour
// crease   crease highlight colour and creaseAlpha its strength
// rim      white paper core around torn edges (storm palettes)
// edge     sprite silhouette edge light strengths

export const CLOUD_PALETTES = {
  // ref02: ivory crowns warmed by the moon, lavender then periwinkle undersides.
  night: {
    ramp: ['#f6e0c4', '#eacaa9', '#dcb99f', '#cbaea9', '#b7a7ba', '#a39cbb', '#8d8ab1', '#74749f', '#5a5e8a'],
    tiers: [0.18, 0.4, 0.55, 0.64],
    lit: 0.36, vert: 0.12, spread: 0.24, jitter: 0.035,
    hi: '#fff7ea', lo: '#181945', bevel: [0.5, 0.05], shadow: 'rgba(16,16,52,0.3)',
    crease: '#fff3e2', creaseAlpha: 0.3, rim: null, merge: [true, false, false, false], facet: ['#a8683f', '#34357a'],
    edge: { hi: 0.4, lo: 0.32 },
  },
  // ref01: peach where the low sun strikes, pink-lavender in the cloud's own shade.
  sunset: {
    ramp: ['#ffc990', '#fcb384', '#f9a183', '#ef9490', '#df8ea3', '#cd89b1', '#b788b8', '#9e82b6', '#8277ad'],
    tiers: [0.42, 0.36, 0.32, 0.28],
    lit: 0.46, vert: 0.06, spread: 0.3, jitter: 0.04,
    hi: '#fff1dc', lo: '#3c1f52', bevel: [0.4, 0.05], shadow: 'rgba(72,34,90,0.22)',
    crease: '#ffead6', creaseAlpha: 0.26, rim: null, facet: ['#c0684c', '#8a5c94'],
    merge: true, texture: { facets: 1 },
    edge: { hi: 0.36, lo: 0.26 },
  },
  // ref10: cream-gold crowns, mauve-lavender shade under and behind.
  dawn: {
    ramp: ['#ffeab6', '#fedc9d', '#f8ca8b', '#efb987', '#dca794', '#c4989b', '#ae8b9e', '#987f9e', '#80739a'],
    tiers: [0.3, 0.24, 0.2, 0.18],
    lit: 0.34, vert: 0.08, spread: 0.26, jitter: 0.035,
    hi: '#fff6e2', lo: '#4a2c4a', bevel: [0.45, 0.05], shadow: 'rgba(90,50,80,0.26)',
    crease: '#fff3dc', creaseAlpha: 0.26, rim: null, merge: true, facet: ['#b0662c', '#573c60'],
    edge: { hi: 0.36, lo: 0.24 },
  },
  // ref08: snowy white crowns with lavender and periwinkle valleys.
  sea: {
    ramp: ['#f7eee8', '#ece1e0', '#dbd1db', '#c6c0d9', '#afaed3', '#999ac9', '#8587bd', '#7277ae', '#5f679c'],
    tiers: [0.2, 0.32, 0.4, 0.46],
    lit: 0.3, vert: 0.3, spread: 0.28, jitter: 0.035,
    hi: '#ffffff', lo: '#1d2050', bevel: [0.5, 0.05], shadow: 'rgba(24,28,70,0.3)',
    crease: '#ffffff', creaseAlpha: 0.26, rim: null, merge: [true, false], facet: ['#6e68a0', '#30346e'],
    edge: { hi: 0.4, lo: 0.3 },
  },
  // ref07 left: blue-grey storm banks catching light from the opening.
  stormBank: {
    ramp: ['#a4a9c8', '#8a90b4', '#737a9f', '#60678b', '#4f587b', '#3f4a69', '#303b57', '#232d45', '#182134'],
    tiers: [0.3, 0.42, 0.5, 0.56],
    lit: 0.36, vert: 0.24, spread: 0.22, jitter: 0.04,
    hi: '#dfe2f0', lo: '#05070f', bevel: [0.3, 0.14], shadow: 'rgba(4,6,16,0.55)',
    crease: '#c9cde0', creaseAlpha: 0.16, rim: '#8d93b0', facet: ['#4a5074', '#141828'],
    edge: { hi: 0.34, lo: 0.4 },
  },
  // ref07 ceiling: cream where the opening lights it, charcoal slate everywhere else.
  storm: {
    ramp: ['#f8e8c8', '#e8cfa8', '#cbb59b', '#a59d94', '#7f8293', '#5d6688', '#465276', '#323d5c', '#222c44', '#151d30'],
    tiers: [0.1, 0.4, 0.6, 0.75],
    lit: 0.12, vert: 0.08, spread: 0.34, jitter: 0.04,
    hi: '#fff2d8', lo: '#05070f', bevel: [0.36, 0.16], shadow: 'rgba(4,6,14,0.6)',
    crease: '#e8e2d6', creaseAlpha: 0.16, rim: '#7d84a0', rimLit: '#ffd98c', facet: ['#b98d62', '#121726'],
    edge: { hi: 0.3, lo: 0.4 },
  },
};

export function resolvePalette(p) {
  if (!p) return CLOUD_PALETTES.night;
  if (typeof p === 'string') {
    const P = CLOUD_PALETTES[p];
    if (!P) throw new Error(`unknown cloud palette "${p}"`);
    return P;
  }
  return p;
}

// Tone u (0 lit .. 1 deep shade) -> colour on the palette ramp.
export function cloudTone(palette, u) {
  const ramp = resolvePalette(palette).ramp;
  const v = clamp(u) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(v));
  return mix(ramp[i], ramp[i + 1], v - i);
}

// Atmospheric version of a palette: every ramp tone pulled toward the haze colour.
export function hazePalette(palette, color, amt) {
  const P = resolvePalette(palette);
  if (!amt) return P;
  return { ...P, ramp: P.ramp.map((c) => mix(c, color, amt)), crease: mix(P.crease, color, amt * 0.5), hi: mix(P.hi, color, amt * 0.5) };
}

function tierTone(P, k, n) {
  const T = P.tiers;
  if (n <= 1) return T[0];
  const f = (k / (n - 1)) * (T.length - 1);
  const i = Math.min(T.length - 2, Math.floor(f));
  return lerp(T[i], T[i + 1], f - i);
}

// --- shapes ------------------------------------------------------------------

// One cut puff: a circle whose rim swells into rounded lobes with narrow valleys
// between them (cauliflower edge). Lobe widths and depths vary so no edge looks stamped.
//   lobes    number of lobes around the rim (0: a clean circle)
//   lobeAmp  depth of the valleys as a fraction of r
//   squash   vertical scale (flat tail puffs); rot: rotation of the whole shape
export function puffShape(cx, cy, r, rng, { lobes = 0, lobeAmp = 0.1, wobble = 0.012, squash = 1, rot = 0 } = {}) {
  const n = Math.max(40, Math.round(r * 1.2), lobes * 10);
  const nz = noise(rng.int(1, 1e9));
  const widths = [], amps = [];
  let sum = 0;
  for (let i = 0; i < lobes; i++) {
    const w = rng.range(0.55, 1.45);
    widths.push(w);
    amps.push(lobeAmp * rng.range(0.45, 1.35));
    sum += w;
  }
  const a0 = rng.next() * TAU;
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = [];
  let li = 0, start = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    let k = 1;
    if (lobes) {
      while (li < lobes - 1 && t * sum > start + widths[li]) { start += widths[li]; li++; }
      const f = clamp((t * sum - start) / widths[li]);
      k = 1 - amps[li] * (1 - Math.pow(Math.sin(Math.PI * f), 0.5));
    }
    const a = a0 + t * TAU;
    k *= 1 + wobble * nz.n2(Math.cos(a) * 1.6, Math.sin(a) * 1.6);
    const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k * squash;
    pts.push([cx + px * c - py * s, cy + px * s + py * c]);
  }
  return pts;
}

// Height profiles of a bank across its width: [u, height] control points (0..1).
export const PROFILES = {
  mound: [[0, 0.12], [0.18, 0.5], [0.42, 1], [0.66, 0.82], [0.86, 0.4], [1, 0.1]],
  rise: [[0, 0.08], [0.25, 0.22], [0.45, 0.5], [0.7, 1], [0.88, 0.92], [1, 0.8]],
  fall: [[0, 0.8], [0.15, 1], [0.4, 0.85], [0.6, 0.45], [0.8, 0.2], [1, 0.06]],
  tower: [[0, 0.25], [0.12, 0.62], [0.28, 1], [0.42, 0.72], [0.56, 0.88], [0.76, 0.5], [1, 0.2]],
  band: [[0, 0.15], [0.06, 0.6], [0.5, 0.75], [0.94, 0.6], [1, 0.15]],
  // Streaks: a thick head on one side and a long tapering tail.
  streakR: [[0, 0], [0.15, 0.16], [0.45, 0.38], [0.75, 0.75], [0.9, 1], [1, 0.45]],
  streakL: [[0, 0.45], [0.1, 1], [0.25, 0.75], [0.55, 0.38], [0.85, 0.16], [1, 0]],
  lens: [[0, 0], [0.18, 0.5], [0.5, 1], [0.82, 0.5], [1, 0]],
};

// Smooth function u -> height through profile control points, plus optional fbm roughness.
export function profileFn(points, seed = 1, rough = 0) {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const nz = noise(seed);
  return (u) => {
    let v;
    if (u <= pts[0][0]) v = pts[0][1];
    else if (u >= pts[pts.length - 1][0]) v = pts[pts.length - 1][1];
    else {
      let i = 0;
      while (u > pts[i + 1][0]) i++;
      const [u0, v0] = pts[i], [u1, v1] = pts[i + 1];
      v = lerp(v0, v1, 0.5 - 0.5 * Math.cos(Math.PI * (u - u0) / (u1 - u0)));
    }
    return v + (rough ? rough * nz.fbm(u * 5, 0.5, 3) : 0);
  };
}

const pickTier = (v, k) => (Array.isArray(v) ? v[Math.min(k, v.length - 1)] : v);

// Plan a cumulus bank: puff geometry for every tier, no colour yet.
//   x, y, w, h    box; the base (flat or lumpy underside) is at y + h
//   tiers         number of stacked tiers (2-4), back tier is the tallest
//   profile       PROFILES key or [u, height] control points (u across w, height x h)
//   heights       height of each tier relative to h (default: 1 down to frontHeight)
//   size          crown puff radius as a fraction of the local tier height
//   minR, maxR    puff radius limits (px)
//   spacing       crown puff step, in radii
//   lobes, lumpy  lobe count and valley depth per tier (number or array back->front)
//   flatBase      cut the underside straight (dawn/sunset banks) instead of lumpy
//   body          smooth tapered body under the puffs, as a fraction of the profile
//                 height (streaks: their tails stay sliver points where no puffs fit)
//   fillers       inner puffs below the crown (towering cumulus)
//   squash        vertical scale of every puff
//   tierShift     random horizontal offset of the tiers, as a fraction of w
//   baseLift      back tiers end this fraction of h above the front tier's base
//   underR        size of the lumpy underside puffs relative to the tier height
//   tierOpts      per-tier overrides, back->front: { profile, height, dy (base offset,
//                 px), size, spacing, lobes, lumpy, squash, minR, under, fillers, tone,
//                 merge }. tone and merge are read when painting.
export function planCumulus(o = {}) {
  const {
    x = 0, y = 0, w = 600, h = 200, tiers = 3, profile = 'mound', seed = 'cloud',
    frontHeight = 0.45, heights = null, size = 0.42, minR = 8, maxR = 1e4, spacing = 1.15,
    lobes = [0, 6, 6, 7], lumpy = [0.02, 0.12, 0.13, 0.14],
    flatBase = false, body = false, fillers = false, squash = 1, roughness = 0.05,
    tierShift = 0.03, baseLift = 0.05, underR = 0.36, tierOpts = [],
  } = o;
  const rng = new RNG(seed);
  const shapeOf = (p) => PROFILES[p] ?? p;
  const mainProf = profileFn(shapeOf(profile), rng.int(1, 1e9), roughness);
  const plan = { x, y, w, h, base: y + h, flatBase, tiers: [] };
  for (let k = 0; k < tiers; k++) {
    const r = rng.fork(`tier${k}`);
    const T = tierOpts[k] || {};
    const f = tiers > 1 ? k / (tiers - 1) : 0;
    // Tier profiles given explicitly are already relative to h.
    const hk = T.height ?? (T.profile || T.crown ? 1 : heights ? pickTier(heights, k) : lerp(1, frontHeight, f));
    const front = k === tiers - 1;
    const lift = T.dy !== undefined ? -T.dy : flatBase || front ? 0 : (tiers - 1 - k) * baseLift * h;
    const base = y + h - lift;
    const tSize = T.size ?? size, tSpacing = T.spacing ?? spacing, tSquash = T.squash ?? squash, tMinR = T.minR ?? minR, tUnderR = T.underR ?? underR;
    const prof = T.profile ? profileFn(shapeOf(T.profile), r.int(1, 1e9), roughness) : mainProf;
    const shift = T.profile ? 0 : (r.next() - 0.5) * 2 * tierShift * w;
    const wig = profileFn([[0, 0], [1, 0]], r.int(1, 1e9), roughness * 1.4);
    // Height of the tier's crown above the shared base line, and above its own base.
    const fullAt = (px) => h * hk * Math.max(0, prof((px - x - shift) / w) + (k && !T.profile ? wig((px - x) / w) : 0));
    const profileHeight = (px) => (fullAt(px) < tMinR * 0.9 ? 0 : fullAt(px) - lift);
    // With explicit crown puffs and no profile, heights come from the puffs' tops.
    const crownHeight = (px) => {
      let best = 0;
      for (const [cx, cy, cr, sq = 1] of T.crown) {
        const dx = px - cx;
        if (Math.abs(dx) < cr) best = Math.max(best, base - (cy - Math.sqrt(cr * cr - dx * dx) * sq));
      }
      return best;
    };
    const heightAt = T.crown && !T.profile ? crownHeight : profileHeight;
    const lob = { lobes: T.lobes ?? pickTier(lobes, k), lobeAmp: T.lumpy ?? pickTier(lumpy, k) };
    const puffs = [];
    const add = (px, py, rad, sq, role) => {
      const nl = lob.lobes ? Math.max(3, Math.round(lob.lobes * clamp(rad / 50, 0.6, 1.5))) : 0;
      puffs.push({ x: px, y: py, r: rad, squash: sq, role, pts: puffShape(px, py, rad, r, { lobes: nl, lobeAmp: lob.lobeAmp, squash: sq }) });
    };

    // Crown: puffs whose tops trace the tier's silhouette (or given as [x, y, r, squash]).
    const crown = (T.crown || []).map(([cx, cy, cr, sq = 1]) => ({ x: cx, y: cy, r: cr, sq }));
    let px = T.crown ? Infinity : x + r.range(0, 6);
    while (px < x + w) {
      const lh = heightAt(px);
      if (lh < tMinR * 0.9) { px += tMinR * 0.5; continue; }
      const rad = clamp(fullAt(px) * tSize * r.range(0.72, 1.22), tMinR, maxR);
      const sq = clamp((lh * 0.6) / rad, 0.42, 1) * tSquash;
      const cy = base - lh + rad * sq * r.range(0.88, 1.12);
      crown.push({ x: px, y: cy, r: rad, sq });
      px += rad * tSpacing * r.range(0.62, 1.22) * (sq < 0.8 ? 1.2 : 1);
    }
    crown.sort((a, b) => a.x - b.x);
    // Big puffs go down first so smaller ones overlap them, as in a cut-paper bank.
    for (const c of [...crown].sort((a, b) => b.r - a.r)) add(c.x, c.y, c.r, c.sq, 'crown');

    // Inner puffs on tall tiers: the many internal edges of towering clouds.
    if (T.fillers ?? fillers) {
      const inner = [];
      for (let i = 0; i < crown.length; i++) {
        const c = crown[i];
        let fy = c.y + c.r * c.sq * r.range(0.8, 1.1);
        let fr = c.r * r.range(0.75, 0.95);
        while (fy < base - fr * (flatBase ? 0.1 : 0.8)) {
          inner.push({ x: c.x + r.range(0.1, 0.6) * c.r * (i % 2 ? 1 : -1), y: fy, r: fr });
          fy += fr * r.range(0.9, 1.25);
          fr *= r.range(0.85, 1.05);
        }
      }
      inner.sort((a, b) => a.y - b.y);
      for (const p of inner) add(p.x, p.y, p.r, tSquash, 'inner');
    }

    // Lumpy underside: a row of puffs along the base (the front tier by default).
    const under = [];
    if ((T.under ?? (front && !flatBase)) && crown.length) {
      const x0 = crown[0].x, x1 = crown[crown.length - 1].x;
      let bx = x0 + r.range(-4, 4);
      while (bx <= x1) {
        const lh = heightAt(bx);
        const rad = clamp(Math.min(lh, h * hk) * tUnderR * r.range(0.85, 1.2), tMinR, maxR);
        const sq = clamp((lh * 0.55) / rad, 0.45, 0.85) * tSquash;
        if (lh > tMinR) under.push({ x: bx, y: base - rad * sq * 0.92, r: rad, sq });
        bx += rad * r.range(1.25, 1.65);
      }
      for (const u of under) add(u.x, u.y, u.r, u.sq, 'under');
    }

    // Backing body through the puff centres so no sky shows between puffs.
    let fill = null;
    if (crown.length > 1) {
      const top = crown.map((c) => [c.x, c.y]);
      const bottom = under.length
        ? [...under].reverse().map((u) => [u.x, u.y])
        : [[crown[crown.length - 1].x, base + 2], [crown[0].x, base + 2]];
      fill = [...top, ...bottom];
    }

    // Smooth tapered body (streaks): its tails stay sliver points where no puffs fit.
    let bodyPts = null;
    if (body) {
      const topEdge = [], bot = [];
      for (let bx = x; bx <= x + w + 0.1; bx += 5) {
        const lh = Math.max(0, heightAt(bx)) * (typeof body === 'number' ? body : 0.62);
        if (lh < 1.5) continue;
        topEdge.push([bx, base - lh]);
        bot.push([bx, base + Math.min(lh * 0.1, 2.5)]);
      }
      if (topEdge.length > 2) bodyPts = [...topEdge, ...bot.reverse()];
    }

    // Box with room for bevels and contact shadows.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of puffs) {
      x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r);
      y0 = Math.min(y0, p.y - p.r * p.squash); y1 = Math.max(y1, p.y + p.r * p.squash);
    }
    if (bodyPts) for (const [bx, by] of bodyPts) { x0 = Math.min(x0, bx); x1 = Math.max(x1, bx); y0 = Math.min(y0, by); y1 = Math.max(y1, by); }
    if (flatBase) y1 = Math.min(y1, base + 4);
    if (!Number.isFinite(x0)) continue;
    const pad = 18;
    plan.tiers.push({
      k, base, puffs, fill, body: bodyPts, tone: T.tone, merge: T.merge,
      box: { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) },
    });
  }
  return plan;
}

// A long thin streak: a tapered body with low scallops along its crown and a flat cut
// underside. Same plan format as planCumulus.
export function planStreak(o = {}) {
  return planCumulus({
    profile: 'streakR', tiers: 2, frontHeight: 0.6, size: 0.55, minR: 6, spacing: 1.3,
    lobes: 0, lumpy: 0, flatBase: true, body: 0.78, fillers: false, squash: 0.72,
    roughness: 0.03, tierShift: 0.04, ...o,
  });
}

// --- paper texture -----------------------------------------------------------

// Faceted paper relief. The reference clouds look like paper crushed into small flat
// facets and pressed out again: every facet is a tilted plane (lighter toward one
// corner), its edge facing the light catches a thin highlight and the opposite edge
// sinks into a dark crease. Two Voronoi scales: small facets on gentle larger undulation.
// A tileable grey height-shading (mean 128), computed once.
const FACET_N = 384;
let facetCanvas = null;

function voronoiField(N, cells, rng, fn) {
  const cs = N / cells;
  const sx = new Float32Array(cells * cells), sy = new Float32Array(cells * cells);
  const tx = new Float32Array(cells * cells), ty = new Float32Array(cells * cells), tb = new Float32Array(cells * cells);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const k = j * cells + i;
    sx[k] = (i + 0.1 + 0.8 * rng.next()) * cs;
    sy[k] = (j + 0.1 + 0.8 * rng.next()) * cs;
    const a = rng.next() * TAU, m = rng.range(0.3, 1);
    tx[k] = Math.cos(a) * m; ty[k] = Math.sin(a) * m; tb[k] = rng.range(-1, 1);
  }
  for (let y = 0; y < N; y++) {
    const cj = Math.floor(y / cs);
    for (let x = 0; x < N; x++) {
      const ci = Math.floor(x / cs);
      let d1 = 1e9, d2 = 1e9, k1 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const uj = cj + dj, jj = ((uj % cells) + cells) % cells, oy = (uj - jj) * cs;
        for (let di = -1; di <= 1; di++) {
          const ui = ci + di, ii = ((ui % cells) + cells) % cells, ox = (ui - ii) * cs;
          const k = jj * cells + ii;
          const qx = sx[k] + ox, qy = sy[k] + oy;
          const d = (qx - x) * (qx - x) + (qy - y) * (qy - y);
          if (d < d1) { d2 = d1; x2 = x1; y2 = y1; d1 = d; k1 = k; x1 = qx; y1 = qy; }
          else if (d < d2) { d2 = d; x2 = qx; y2 = qy; }
        }
      }
      // Distance to the border with the second-nearest site, and that border's normal.
      const nx = x2 - x1, ny = y2 - y1, nl = Math.hypot(nx, ny) || 1;
      const edge = ((x - (x1 + x2) / 2) * nx + (y - (y1 + y2) / 2) * ny) / -nl;
      fn(y * N + x, (tx[k1] * (x - x1) + ty[k1] * (y - y1)) / cs, tb[k1], edge, nx / nl, ny / nl);
    }
  }
}

export function facetTexture() {
  if (facetCanvas) return facetCanvas;
  const N = FACET_N;
  const field = new Float32Array(N * N);
  const rng = new RNG('cloud-facets');
  const L = [-0.6, -0.8];
  // Small facets: tilted planes, lit ridge on the edge facing the light, crease opposite.
  voronoiField(N, 20, rng, (i, tilt, base, edge, nx, ny) => {
    let v = tilt * 36 + base * 6;
    const lit = nx * L[0] + ny * L[1] > 0;
    const w = lit ? 1.6 : 2.6;
    if (edge < w) {
      const k = 1 - edge / w;
      v += (lit ? 16 : -22) * k * k;
    }
    field[i] = v;
  });
  // A second, coarser breakup underneath.
  voronoiField(N, 11, rng, (i, tilt) => { field[i] += tilt * 12; });
  let mean = 0;
  for (let i = 0; i < field.length; i++) mean += field[i];
  mean /= field.length;
  const { canvas, ctx } = surface(N, N);
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < field.length; i++) {
    const g = Math.max(0, Math.min(255, 128 + field[i] - mean));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Soften by a fraction of a pixel, across the tile seams too.
  const out = surface(N, N);
  out.ctx.filter = 'blur(0.7px)';
  for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) out.ctx.drawImage(canvas, ox, oy);
  facetCanvas = out.canvas;
  return facetCanvas;
}
// A grey relief s split into a darkening map min(1, 2s) for multiply and a lightening map
// max(0, 2s - 1) for screen, all with canvas compositing. Soft-light barely marks pale
// paper; multiply shades cream as clearly as lavender, the way the reference facets do.
// The darkening map is screened with a tint, so the deepest facets take that colour
// instead of grey (warm peach shadows on cream, deep periwinkle on lavender).
const mapCache = new WeakMap();
function reliefMaps(src, tint) {
  let byTint = mapCache.get(src);
  if (!byTint) { byTint = new Map(); mapCache.set(src, byTint); }
  let m = byTint.get(tint);
  if (m) return m;
  const w = src.width, h = src.height;
  const dark = surface(w, h);
  dark.ctx.drawImage(src, 0, 0);
  dark.ctx.globalCompositeOperation = 'lighter';
  dark.ctx.drawImage(src, 0, 0);
  dark.ctx.globalCompositeOperation = 'screen';
  dark.ctx.fillStyle = tint;
  dark.ctx.fillRect(0, 0, w, h);
  let light = byTint.get('light');
  if (!light) {
    const inv = surface(w, h);
    inv.ctx.drawImage(src, 0, 0);
    inv.ctx.globalCompositeOperation = 'difference';
    inv.ctx.fillStyle = '#fff';
    inv.ctx.fillRect(0, 0, w, h);
    const l = surface(w, h);
    l.ctx.drawImage(inv.canvas, 0, 0);
    l.ctx.globalCompositeOperation = 'lighter';
    l.ctx.drawImage(inv.canvas, 0, 0);
    l.ctx.globalCompositeOperation = 'difference';
    l.ctx.fillStyle = '#fff';
    l.ctx.fillRect(0, 0, w, h);
    light = l.canvas;
    byTint.set('light', light);
  }
  m = { dark: dark.canvas, light };
  byTint.set(tint, m);
  return m;
}

// Default surface of cloud paper: the facet relief, a little of the engine's crumple for
// longer creases, and how strongly the lit side of the relief shows (light). Amounts
// above 1 stack extra passes.
export const CLOUD_TEXTURE = { facets: 1.3, facetScale: 1, crumple: 0.15, crumpleScale: 0.32, light: 1 };

// Facet shadow tint for a piece of tone u: the palette's pale or shade tint.
function facetTint(P, u) {
  const [pale, deep] = P.facet ?? ['#c8a088', '#5e6098'];
  return u < 0.4 ? pale : deep;
}

function relief(ctx, path, box, maps, rng, amt, scale, light) {
  if (!amt) return;
  // Offsets and scale vary per piece; rotation stays small so the relief's light stays
  // consistent from piece to piece.
  const m = new DOMMatrix()
    .translateSelf(rng.range(0, 1024), rng.range(0, 1024))
    .rotateSelf(rng.range(-12, 12))
    .scaleSelf(scale * rng.range(0.85, 1.15));
  ctx.save();
  ctx.clip(path);
  for (const [img, mode, amount] of [[maps.dark, 'multiply', amt], [maps.light, 'screen', amt * light]]) {
    const pat = ctx.createPattern(img, 'repeat');
    pat.setTransform(m);
    ctx.globalCompositeOperation = mode;
    ctx.fillStyle = pat;
    for (let a = amount; a > 0.001; a -= 1) {
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }
  }
  ctx.restore();
}

// Texture one piece of cloud paper (see CLOUD_TEXTURE for the options); tint colours
// the facet shadows.
export function cloudPaperIn(ctx, path, box, rng, tex = CLOUD_TEXTURE, tint = '#a08870') {
  if (!tex) return;
  const t = { ...CLOUD_TEXTURE, ...tex };
  relief(ctx, path, box, reliefMaps(facetTexture(), tint), rng, t.facets, t.facetScale, t.light);
  relief(ctx, path, box, reliefMaps(texture('crumple'), tint), rng, t.crumple, t.crumpleScale, t.light);
}
// Hairline creases: the pale paper core showing along folds, each with a faint dark
// side, like crumpled coloured paper flattened out again.
export function creasesIn(ctx, path, cx, cy, r, rng, { count = 3, color = '#ffffff', alpha = 0.25, squash = 1 } = {}) {
  if (!count || !alpha) return;
  ctx.save();
  ctx.clip(path);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    let a = rng.range(0, TAU);
    let px = cx + rng.range(-0.8, 0.8) * r, py = cy + rng.range(-0.8, 0.8) * r * squash;
    const p = new Path2D();
    p.moveTo(px, py);
    const segs = rng.int(2, 4);
    for (let s = 0; s < segs; s++) {
      const len = r * rng.range(0.08, 0.22);
      a += rng.range(-1.1, 1.1);
      px += Math.cos(a) * len;
      py += Math.sin(a) * len;
      p.lineTo(px, py);
    }
    ctx.save();
    ctx.translate(0.6, 0.8);
    ctx.strokeStyle = rgba('#000000', alpha * 0.22);
    ctx.lineWidth = 1;
    ctx.stroke(p);
    ctx.restore();
    ctx.strokeStyle = rgba(color, alpha * rng.range(0.6, 1.15));
    ctx.lineWidth = rng.range(0.5, 0.9);
    ctx.stroke(p);
  }
  ctx.restore();
}

// --- painting ----------------------------------------------------------------

// Contact shadow of a shape on the paper already painted beneath it. It never lands on
// empty canvas, so tier silhouettes stay clean and the sprite's own drop shadow does the
// rest. Offsets and blur are in authored px; works under any transform.
export function contactShadow(ctx, path, { color = 'rgba(0,0,0,0.4)', blur = 6, x = 0, y = 3 } = {}) {
  const m = ctx.getTransform();
  const off = 1e4;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * Math.hypot(m.a, m.b);
  ctx.shadowOffsetX = off * m.a + x * m.a + y * m.c;
  ctx.shadowOffsetY = off * m.b + x * m.b + y * m.d;
  ctx.translate(-off, 0);
  ctx.fillStyle = '#000';
  ctx.fill(path);
  ctx.restore();
}

// Lit and unlit cut-edge bands just inside a piece, like core bevelBands but cheap
// enough for hundreds of pieces: the band shape is limited to the piece's box and the
// soft falloff is two stacked crisp bands instead of a blur filter.
export function pieceBevel(ctx, path, box, { light = [0.4, -0.9], width = 2, hi = 0.3, lo = 0.1, hiColor = '#fffaf0', loColor = '#000' } = {}) {
  const pad = width * 4;
  ctx.save();
  ctx.clip(path);
  for (const [s, color, a] of [[-1, hiColor, hi], [1, loColor, lo]]) {
    if (!a) continue;
    for (const [wk, ak] of [[1, 0.45], [0.5, 0.55]]) {
      const band = new Path2D();
      band.rect(box.x - pad, box.y - pad, box.w + 2 * pad, box.h + 2 * pad);
      band.addPath(path, new DOMMatrix([1, 0, 0, 1, s * light[0] * width * wk, s * light[1] * width * wk]));
      ctx.fillStyle = rgba(color, a * ak);
      ctx.fill(band, 'evenodd');
    }
  }
  ctx.restore();
}
// Paint one cut piece of cloud paper: graded fill, optional torn edge with a white core,
// contact shadow, paper texture, creases and bevel. Returns its Path2D.
//   lit       unit vector toward the light for this piece
//   u         tone on the palette ramp; the fill grades from u - spread on the lit side
//             to u + spread on the far side
export function paintCloudPiece(ctx, pts, {
  palette, u = 0.3, lit = [0.4, -0.9], cx, cy, r, squash = 1, rng, smooth = true,
  torn = null, rim = null, texture: tex = CLOUD_TEXTURE, creases = 3, bevel = 1, shadow = { blur: 8, dist: 3 }, vary: va = 0.025,
} = {}) {
  const P = resolvePalette(palette);
  const sp = P.spread;
  const shape = torn ? tear(pts, torn) : pts;
  const path = pathOf(shape, { smooth: smooth && !torn });
  if (shadow) {
    contactShadow(ctx, path, { color: P.shadow, blur: shadow.blur, x: -lit[0] * shadow.dist, y: -lit[1] * shadow.dist });
  }
  if (rim) {
    ctx.save();
    ctx.strokeStyle = rim.color;
    ctx.lineWidth = rim.width * 2;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.restore();
  }
  const ry = r * squash;
  const tone = (du) => vary(cloudTone(P, u + du), rng, va);
  // Pillow shading: brightest just inside the lit edge, falling off across the puff.
  const hx = cx + lit[0] * r * 0.55, hy = cy + lit[1] * ry * 0.55;
  const grad = ctx.createRadialGradient(hx, hy, r * 0.05, hx, hy, r * 1.6);
  [[0, tone(-sp)], [0.45, tone(0)], [1, tone(sp * 1.2)]].forEach(([s, col]) => grad.addColorStop(s, col));
  ctx.fillStyle = grad;
  ctx.fill(path);
  const box = { x: cx - r * 1.25, y: cy - ry * 1.25, w: r * 2.5, h: ry * 2.5 };
  cloudPaperIn(ctx, path, box, rng, tex, facetTint(P, u));
  if (creases) creasesIn(ctx, path, cx, cy, r, rng, { count: creases, color: P.crease, alpha: P.creaseAlpha, squash });
  if (bevel) {
    const [hi, lo] = P.bevel;
    pieceBevel(ctx, path, box, { light: lit, width: 2, hi: hi * bevel, lo: lo * bevel, hiColor: P.hi, loColor: P.lo });
  }
  return path;
}

// Direction from a puff toward the light: a fixed vector, or toward a point light.
function lightFor(p, light, lightPos) {
  if (!lightPos) return light;
  const dx = lightPos[0] - p.x, dy = lightPos[1] - p.y;
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// Paint tier k of a cumulus plan into ctx (authored coordinates).
//   palette, light   CLOUD_PALETTES key/object and unit vector toward the light
//   lightPos         optional point light [x, y] (moon, sun): puffs face it individually
//   tone             shift of every tone (positive: deeper in shade)
//   warm             { x, y, r, color, amt } tint puffs near a light source (moonlit cream)
//   merge            paint the tier as one cut piece (bool or per-tier array; default
//                    from the palette): its bumps only show along the silhouette
//   texture          CLOUD_TEXTURE overrides, or false; creases: crease count per puff
//   torn, rim        torn edges ({ amp, freq, fine }) with a white core ({ width, color })
//   bevel            per-puff bevel strength multiplier
export function paintTier(ctx, plan, k, o = {}) {
  const P = resolvePalette(o.palette);
  const L = o.light ?? [0.4, -0.9];
  const tier = plan.tiers[k];
  const n = plan.tiers.length;
  const rng = new RNG(`${o.seed ?? 'cloud'}:paint:${k}`);
  const cxm = plan.x + plan.w / 2, cym = plan.y + plan.h / 2;
  const base = (tier.tone ?? (o.tones ? pickTier(o.tones, k) : tierTone(P, k, n))) + (o.tone ?? 0);
  const tex = o.texture === undefined ? { ...CLOUD_TEXTURE, ...(P.texture || {}) } : o.texture && { ...CLOUD_TEXTURE, ...(P.texture || {}), ...o.texture };
  const creases = o.creases ?? 3;
  const warm = o.warm ?? null;
  const Lc = lightFor({ x: cxm, y: cym }, L, o.lightPos);
  const merged = tier.merge ?? pickTier(o.merge ?? P.merge ?? false, k);

  // Tone of a point: lit side of the cloud brighter, base darker.
  const litK = o.lit ?? P.lit;
  const gx = -litK * Lc[0] / (plan.w / 2);
  const gy = -litK * Lc[1] / (plan.h / 2) + P.vert / plan.h;
  const toneAt = (px, py) => base + gx * (px - cxm) + gy * (py - (plan.base - plan.h / 2));
  const toneOf = (px, py, role) => toneAt(px, py) + (role === 'inner' ? 0.03 : role === 'under' ? 0.06 : 0) + rng.range(-1, 1) * P.jitter;
  const warmPal = (px, py) => {
    if (!warm) return P;
    const a = warm.amt * Math.pow(clamp(1 - Math.hypot(px - warm.x, py - warm.y) / warm.r), 1.5);
    return a > 0.01 ? { ...P, ramp: P.ramp.map((c) => mix(c, warm.color, a)) } : P;
  };
  const torn = (amp) => (o.torn ? { amp, freq: 0.14, fine: 0.7, seed: rng.int(1, 1e6), ...o.torn } : null);
  const rim = (width) => (o.rim ? { color: o.rim.color ?? P.rim ?? '#f6f0e4', width: o.rim.width ?? width } : null);

  ctx.save();
  if (plan.flatBase) {
    const clip = new Path2D();
    clip.rect(tier.box.x - 10, tier.box.y - 10, tier.box.w + 20, tier.base - tier.box.y + 10);
    ctx.clip(clip);
  }
  if (merged) paintMerged(ctx, plan, tier, { P, Lc, L, o, rng, tex, creases, toneAt, warmPal, torn, rim, gx, gy });
  else {
    if (tier.body) {
      const mx = cxm, my = tier.base - plan.h * 0.25;
      paintCloudPiece(ctx, tier.body, {
        palette: P, u: toneOf(mx, my, 'crown') + 0.04, lit: Lc, cx: mx, cy: my, r: plan.h * 0.6,
        rng, smooth: false, texture: tex, creases: Math.round(plan.w / 60), shadow: null, torn: torn(1.1), rim: rim(1.1),
      });
    }
    if (tier.fill) {
      const fp = pathOf(tier.fill);
      ctx.fillStyle = cloudTone(P, base + 0.1);
      ctx.fill(fp);
      cloudPaperIn(ctx, fp, tier.box, rng, tex, facetTint(P, base + 0.1));
    }
    for (const p of tier.puffs) {
      paintCloudPiece(ctx, p.pts, {
        palette: warmPal(p.x, p.y), u: toneOf(p.x, p.y, p.role), lit: lightFor(p, L, o.lightPos),
        cx: p.x, cy: p.y, r: p.r, squash: p.squash, rng, texture: tex,
        creases: Math.round(creases * clamp(p.r / 40, 0.5, 2.5)), bevel: o.bevel ?? 1,
        torn: torn(1.3), rim: rim(1),
        shadow: o.shadow === false ? null : { blur: 9, dist: 3, ...(o.shadow || {}) },
      });
    }
  }
  ctx.restore();
}

// A tier as one cut piece: the union of its puffs, body and backing graded across the
// whole tier, each bump given a soft dome of light so the mass still reads as rounded.
function paintMerged(ctx, plan, tier, { P, Lc, o, rng, tex, creases, toneAt, warmPal, torn, rim, gx, gy }) {
  const union = new Path2D();
  const t = torn(1.3);
  for (const p of tier.puffs) union.addPath(pathOf(t ? tear(p.pts, { ...t, seed: rng.int(1, 1e6) }) : p.pts, { smooth: !t }));
  if (tier.fill) union.addPath(pathOf(tier.fill));
  if (tier.body) union.addPath(pathOf(t ? tear(tier.body, t) : tier.body));
  const rm = rim(1.1);
  if (rm) {
    ctx.save();
    ctx.strokeStyle = rm.color;
    ctx.lineWidth = rm.width * 2;
    ctx.lineJoin = 'round';
    ctx.stroke(union);
    ctx.restore();
  }
  // Linear grade along the tone gradient, spanning +-0.5 tone around the tier centre.
  const b = tier.box;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const g2 = gx * gx + gy * gy || 1e-9;
  const k = 0.5 / g2;
  const uc = toneAt(cx, cy);
  const pal = warmPal(cx, cy);
  const stops = [0, 0.25, 0.5, 0.75, 1].map((s) => [s, vary(cloudTone(pal, uc - 0.5 + s), rng, 0.015)]);
  ctx.fillStyle = linear(ctx, cx - gx * k, cy - gy * k, cx + gx * k, cy + gy * k, stops);
  ctx.fill(union);
  // Domes: a soft light on the lit side of every bump, a soft shade under it.
  ctx.save();
  ctx.clip(union);
  for (const p of tier.puffs) {
    const lit = lightFor(p, Lc, o.lightPos);
    const ry = p.r * p.squash;
    const hx = p.x + lit[0] * p.r * 0.35, hy = p.y + lit[1] * ry * 0.35;
    const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, p.r * 0.95);
    gl.addColorStop(0, rgba(P.hi, 0.16));
    gl.addColorStop(1, rgba(P.hi, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(p.x - p.r * 1.3, p.y - ry * 1.3, p.r * 2.6, ry * 2.6);
    const sx = p.x - lit[0] * p.r * 0.75, sy = p.y - lit[1] * ry * 0.75;
    const gs = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * 0.7);
    gs.addColorStop(0, rgba(P.lo, 0.07));
    gs.addColorStop(1, rgba(P.lo, 0));
    ctx.fillStyle = gs;
    ctx.fillRect(p.x - p.r * 1.5, p.y - ry * 1.5, p.r * 3, ry * 3);
  }
  ctx.restore();
  cloudPaperIn(ctx, union, b, rng, tex, facetTint(P, uc));
  for (const p of tier.puffs) {
    creasesIn(ctx, union, p.x, p.y, p.r, rng, { count: Math.round(creases * clamp(p.r / 40, 0.5, 2.5)), color: P.crease, alpha: P.creaseAlpha, squash: p.squash });
  }
  // No path bevel on the union: bevelBands' even-odd band would mark every internal
  // overlap. The tier's silhouette edge light comes from the sprite bake.
  // Accent discs: the biggest bumps are cut again as their own pieces on top, so the
  // mass shows a few clear overlapping discs, as in the references.
  const accent = o.accent ?? 0.2;
  const crowns = tier.puffs.filter((p) => p.role === 'crown').sort((a, b) => a.r - b.r);
  const rMax = crowns.length ? crowns[crowns.length - 1].r : 0;
  const accents = crowns.slice(Math.floor(crowns.length * (1 - accent))).filter((p) => p.r > Math.max(24, rMax * 0.6));
  for (const p of accents) {
    paintCloudPiece(ctx, p.pts, {
      palette: warmPal(p.x, p.y), u: toneAt(p.x, p.y) + rng.range(-1, 1) * P.jitter, lit: lightFor(p, Lc, o.lightPos),
      cx: p.x, cy: p.y, r: p.r, squash: p.squash, rng, texture: tex, bevel: o.bevel ?? 1,
      creases: Math.round(creases * clamp(p.r / 40, 0.5, 2.5)), torn: torn(1.3), rim: rim(1),
      shadow: { blur: 12, dist: 2 },
    });
  }
}

// Paint a whole cumulus (all tiers, back to front) into ctx, each tier casting a soft
// shadow on the tiers behind it. For static clouds inside a larger sprite.
export function drawCumulus(ctx, plan, o = {}) {
  const P = resolvePalette(o.palette);
  const L = o.light ?? [0.4, -0.9];
  plan.tiers.forEach((tier, k) => {
    if (k > 0) {
      const union = new Path2D();
      for (const p of tier.puffs) union.addPath(pathOf(p.pts, { smooth: true }));
      if (tier.fill) union.addPath(pathOf(tier.fill));
      contactShadow(ctx, union, { color: P.shadow, blur: 12, x: -L[0] * 6, y: Math.max(2, -L[1] * 6) });
    }
    paintTier(ctx, plan, k, o);
  });
}

// --- layers ------------------------------------------------------------------

const CLOUD_DEFAULTS = {
  name: 'cloud', z: 9000, palette: 'night', seed: 'cloud', res: 1,
  mat: [{ tex: 'fiber', amt: 0.55 }, { tex: 'crumple', amt: 0.35, scale: 0.7 }],
  drift: 5,            // px/s sideways
  sway: 6,             // px of slow noise wander on top of the drift
  bob: 1.5,            // px of slow vertical bob
  breathe: 0.01,       // tier swell (fraction of size)
  period: 7.5,         // breathing period (s)
  t0: 0,               // time at which the cloud sits exactly where it was authored
  shadowAlpha: 0.55, shadowBlur: 16, shadowDist: 11,
  alpha: 1,
};

// Bake each tier of a plan into a sprite. Returns [{ s, ax, ay, phase }].
export function bakeCloudTiers(S, plan, o) {
  const P = resolvePalette(o.palette);
  const L = o.light ?? S.light;
  const rng = new RNG(`${o.seed}:phase`);
  return plan.tiers.map((tier, k) => {
    const b = tier.box;
    const s = S.sprite({
      name: `${o.name}-tier${k}`, x: b.x, y: b.y, w: b.w, h: b.h, res: o.res,
      mat: o.mat, light: L,
      edge: { width: 2, soft: 0.8, hiColor: P.hi, ...P.edge, ...(o.edge || {}) },
      shadow: o.shadowAlpha ? { blur: o.shadowBlur, alpha: o.shadowAlpha } : false,
      draw: (ctx) => paintTier(ctx, plan, k, { ...o, palette: P, light: L }),
    });
    return { s, ax: b.x + b.w / 2, ay: tier.base, phase: k * 0.27 + rng.next() * 0.2 };
  });
}

// Per-frame drawing of baked tiers: back to front, each with its own drop shadow, each
// breathing about the middle of its base.
export function drawCloudTiers(ctx, tiers, t, o, env) {
  const L = o.light ?? env.scene.light;
  const dx = -L[0] * o.shadowDist * 0.8, dy = Math.max(2, -L[1] * o.shadowDist);
  for (const it of tiers) {
    const b = o.breathe * osc(t, o.period, it.phase);
    drawSprites(ctx, [{ s: it.s, ax: it.ax, ay: it.ay, sx: 1 + b * 0.6, sy: 1 + b, shadowDx: dx, shadowDy: dy }], env.shadow);
  }
}

// Slow sideways drift with a little wander and bob, zero at t0.
export function driftAnim(o) {
  const nz = noise(`${o.seed}:drift`);
  const t0 = o.t0 ?? 0;
  const wander = (t) => (o.sway ?? 0) * nz.n1(t * 0.06);
  const bob = (t) => (o.bob ?? 0) * osc(t, (o.period ?? 7.5) * 1.7, 0.3);
  return (t) => ({ x: (o.drift ?? 0) * (t - t0) + wander(t) - wander(t0), y: bob(t) - bob(t0) });
}

// A drifting cumulus bank on its own plane.
//   z, x, y, w, h, tiers, profile, ...   any planCumulus option
//   palette, light, lightPos, tone, warm, merge, texture, creases, torn, rim, bevel   see paintTier
//   drift, sway, bob, breathe, period, t0                                    motion
//   plan                                                                     reuse a precomputed plan
// Returns the layer (layer.plan holds the geometry).
export function addCloud(S, opts = {}) {
  const o = { ...CLOUD_DEFAULTS, ...opts };
  const plan = o.plan ?? planCumulus(o);
  const tiers = bakeCloudTiers(S, plan, o);
  const layer = S.add({
    name: o.name, z: o.z, alpha: o.alpha, anim: driftAnim(o),
    render: (ctx, t, env) => drawCloudTiers(ctx, tiers, t, o, env),
  });
  layer.plan = plan;
  return layer;
}

// A long streak cloud (ref01, ref10). Options as addCloud plus planStreak options;
// profile 'streakR' puts the head on the right, 'streakL' on the left, 'lens' centres it.
export function addStreak(S, opts = {}) {
  const o = { ...CLOUD_DEFAULTS, name: 'streak', drift: 7, breathe: 0.006, merge: true, accent: 0, ...opts };
  return addCloud(S, { ...o, plan: o.plan ?? planStreak(o) });
}

// A sea of cloud filling a valley (ref08): rows of banks from far (small, hazy, high)
// to near (big, white, low), each on its own plane for parallax.
//   x, w           horizontal extent of every row
//   y0, y1         base line of the farthest and nearest row
//   h0, h1         row heights far / near
//   rows           number of rows
//   z0, z1         depth of the farthest and nearest row
//   haze, hazeAmt  atmospheric colour and how much the farthest row takes of it
// plus any addCloud option for every row. Returns the array of layers.
export function addCloudSea(S, opts = {}) {
  const {
    x = -300, w = 2520, y0 = 520, y1 = 760, h0 = 60, h1 = 150, rows = 4, z0 = 2600, z1 = 1300,
    haze = '#7d86b8', hazeAmt = 0.4, palette = 'sea', seed = 'sea', name = 'sea', ...rest
  } = opts;
  const layers = [];
  for (let i = 0; i < rows; i++) {
    const f = rows > 1 ? i / (rows - 1) : 1;
    const h = lerp(h0, h1, f);
    const base = lerp(y0, y1, f);
    layers.push(addCloud(S, {
      tiers: 2, profile: 'band', heights: [1, 0.55], flatBase: true, fillers: true, roughness: 0.3,
      size: 0.45, minR: lerp(10, 18, f), spacing: 1.05, lobes: [4, 6], lumpy: [0.05, 0.1],
      drift: lerp(2, 5, f), breathe: 0.006, shadowAlpha: lerp(0.3, 0.5, f),
      ...rest,
      name: `${name}-row${i}`, x, w, y: base - h, h, z: lerp(z0, z1, f), seed: `${seed}:${i}`,
      palette: hazePalette(palette, haze, hazeAmt * (1 - f)),
    }));
  }
  return layers;
}
