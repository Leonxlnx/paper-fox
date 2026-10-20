// s07 storm coast: the stormy sea.
//
// The sea is a stack of wave rows from the horizon to the rocks, each on its own plane.
// A row is a dark band with a choppy top, covered by overlapping hump pieces (one per
// crest), each hump layered with arched strips that run from a pale, backlit crest down
// to navy, and the tallest crests carry a torn white foam cap with clawed fingers. The
// guiding star's reflection is laid into the strips under it, so it breaks up across
// the waves like the reference. Rows ride a slow swell that travels toward the shore.

import { RNG, noise } from '../core/rng.js';
import { pathOf, linear, piece } from '../core/piece.js';
import { tear, leaf, transform, TAU } from '../core/geom.js';
import { mix, rgba } from '../core/color.js';
import { lerp, clamp, smoothstep } from '../core/ease.js';
import { sheet } from '../elements/water.js';

// Sampled from ref07: navy troughs, steel-blue and teal faces, jade backlit crests,
// white foam with cool blue-grey shade, pale gold reflection.
export const SEA = {
  deep: '#132640', navy: '#1b3352', blue: '#284a74', steel: '#356285', slate: '#2c5472',
  teal: '#2a707a', jade: '#3a9086', mint: '#5fae9c', pale: '#9ccfc0',
  foam: '#f3f5f3', foamMid: '#dde6ea', foamShade: '#9fb3c6', shadow: '#050b16',
  gold: ['#6f6a5a', '#b8a378', '#e8cf98', '#fff0cc'],
};

// Strip tones down a wave face: 0 = crest, 1 = trough. Each strip also leans toward
// either the green or the blue family, so a face reads as many cut slivers of paper.
const FACE = [SEA.mint, SEA.jade, SEA.teal, mix(SEA.teal, SEA.slate, 0.4), SEA.steel, mix(SEA.blue, SEA.navy, 0.3), SEA.navy];
const faceTone = (u, rng) => {
  const x = clamp(u + rng.range(-0.2, 0.2)) * (FACE.length - 1);
  const i = Math.min(FACE.length - 2, Math.floor(x));
  const base = mix(FACE[i], FACE[i + 1], x - i);
  const k = rng.next();
  return k < 0.4 ? mix(base, u < 0.5 ? SEA.jade : SEA.teal, rng.range(0.15, 0.45))
    : k < 0.65 ? mix(base, u < 0.5 ? SEA.steel : SEA.deep, rng.range(0.1, 0.35)) : base;
};

// Ragged-edge noise for the foam.
const FNZ = noise('s07-foam');
const oval = (cx, cy, rx, ry, n = 12, rot = 0) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * TAU;
  const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
  return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
});

// Wave hump: peaked crest, long flanks. u is the distance from the crest in half-widths.
const bump = (u) => Math.exp(-Math.pow(Math.abs(u), 1.9) * 2.4);
// Half-width at which the hump has fallen to level b (0..1).
const reach = (b) => Math.pow(-Math.log(Math.max(1e-4, b)) / 2.4, 1 / 1.9);

// Height of crest c above its base at x.
function humpAt(c, x) {
  const u = (x - c.x) / (x < c.x ? c.w * c.lean : c.w / c.lean);
  return c.h * bump(u);
}

// Crests of one row: featured crests first, then random ones filling the gaps.
// Big waves come in sets: a slow noise along the row scales the heights.
function planCrests(row, rng, nz) {
  const list = (row.feature ?? []).map((c) => ({ lean: 1, foam: 1, ...c }));
  // Irregular spacing, heights and widths: sets of big swells between flat stretches,
  // so no two rows repeat the same rhythm of crests.
  for (let x = row.x0; x < row.x1; x += row.lambda * rng.range(0.3, 1.05)) {
    const cx = x + rng.range(-0.25, 0.25) * row.lambda;
    if (list.some((c) => Math.abs(c.x - cx) < (c.w ?? row.lambda) * 0.8)) continue;
    const set = 0.2 + 0.8 * (0.5 + 0.5 * nz.n1(cx * 0.0045 + row.v * 7 + row.i * 1.7));
    const h = row.amp * rng.range(0.22, 1.15) * set;
    const big = h > row.amp * 0.5;
    list.push({
      x: cx, h, w: row.lambda * rng.range(0.32, 0.82) * (0.75 + 0.45 * set), lean: rng.range(0.7, 1.5),
      foam: big && rng.chance(0.22 + 0.45 * row.v) ? rng.range(0.5, 1.05) : rng.chance(0.06 + 0.12 * row.v) ? rng.range(0.22, 0.4) : 0,
      curl: big && row.v > 0.4 && h > row.amp * 0.7 && rng.chance(0.4) ? 1 : 0,
    });
  }
  // Small crests first, so the big ones overlap them.
  return list.sort((a, b) => a.h - b.h);
}

// A breaking crest (dir +1: curling to the right, like the reference): a hook of torn
// white foam thrown over from the peak, a dark hollow under it, claws of foam dripping
// from its tip and a few flecks of spray blown off the top.
// A curling hook of torn foam: the lip leaves (x, y), arcs over and forward (dir +1:
// to the right) and curls back under itself. Optional dark hollow inside the curl, a
// scalloped outer edge, spray claws blown back off the lip and flecks. Returns the spine.
//   R      size of the curl; th: lip thickness at its root; sweep: angle swept (rad)
export function foamHook(ctx, { x, y, R, dir = 1, th, sweep = 3.9, hollow = null, rng, light, scale = 1, claws = 3, flecks = 12, tint = null }) {
  const C = [x + dir * R * 0.8, y + R * 0.95];
  const a0 = Math.atan2(y - C[1], x - C[0]);
  const N = 30, ph = rng.range(0, 100);
  const sp = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + dir * sweep * t;
    sp.push({ t, a, r: R * (1 - 0.55 * t) });
  }
  const thick = (t) => th * (1 - 0.72 * t) + 1.2 * scale;
  const at = (p, k) => [C[0] + Math.cos(p.a) * (p.r + k) * 1.15, C[1] + Math.sin(p.a) * (p.r + k)];
  const shade = { color: rgba(SEA.foamShade, 0.85), blur: 3 * scale + 2, x: -light[0] * 2, y: 2.5 * scale };
  if (hollow) {
    piece(ctx, sp.filter((p) => p.t > 0.06).map((p) => at(p, -thick(p.t) * 0.3)), {
      fill: hollow, torn: { amp: 0.8 * scale + 0.3, freq: 0.14, fine: 0.4, seed: rng.int(1, 1e6), step: 3 },
    });
  }
  const outer = sp.map((p) => at(p, thick(p.t) * (0.5 + 0.35 * Math.pow(Math.abs(Math.sin(p.t * 17 + ph)), 0.6))));
  const inner = sp.map((p) => at(p, -thick(p.t) * (0.4 + 0.15 * FNZ.n1(p.t * 9 + ph)))).reverse();
  piece(ctx, [...outer, ...inner], {
    fill: linear(ctx, 0, C[1] - R * 1.1, 0, C[1] + R * 0.6, tint ?? ['#ffffff', SEA.foam, SEA.foamMid, SEA.foamShade]),
    torn: { amp: 1.4 * scale + 0.6, freq: 0.22, fine: 1, seed: rng.int(1, 1e6), step: 2.5 },
    shadow: shade,
  });
  // Spray claws torn off the back of the lip, blown back and up.
  for (let i = 0; i < claws; i++) {
    const p = sp[rng.int(1, Math.round(N * 0.5))];
    const [px, py] = at(p, thick(p.t) * 0.3);
    const len = R * rng.range(0.3, 0.75);
    const pts = transform(leaf(len, len * rng.range(0.16, 0.26), { belly: 0.35, curl: -dir * rng.range(0.2, 0.6), tipRound: 0.35, n: 9 }), {
      x: px, y: py, rot: -dir * rng.range(0.2, 1.2),
    });
    piece(ctx, pts, { fill: rng.chance(0.65) ? SEA.foam : SEA.foamMid, torn: { amp: 0.6 * scale + 0.3, freq: 0.3, fine: 0.5, seed: rng.int(1, 1e6), step: 2.5 }, shadow: shade });
  }
  ctx.fillStyle = SEA.foam;
  for (let i = 0; i < flecks; i++) {
    const p = sp[rng.int(0, Math.round(N * 0.7))];
    const [px, py] = at(p, thick(p.t) + rng.range(2, 16) * scale);
    ctx.beginPath();
    ctx.arc(px + rng.range(-6, 6) * scale, py, rng.range(0.6, 1.8) * Math.sqrt(scale), 0, TAU);
    ctx.fill();
  }
  return { sp, at, C };
}

// A breaking crest: a big foam hook thrown forward off the peak with a dark hollow inside
// it, and foam tumbling from its tip down the face.
function paintCurl(ctx, c, base, scale, rng, light) {
  const d = c.curl > 0 ? 1 : -1;
  const R = c.h * 0.36 * rng.range(0.92, 1.08);
  const { sp, at } = foamHook(ctx, {
    x: c.x - d * c.h * 0.04, y: base - c.h * 1.02, R, dir: d, th: c.h * 0.17, rng, light, scale,
    hollow: linear(ctx, 0, base - c.h, 0, base - c.h + R * 1.8, [mix(SEA.jade, SEA.teal, 0.5), SEA.teal, mix(SEA.teal, SEA.navy, 0.6)]),
    claws: Math.round(rng.range(4, 7)), flecks: Math.round(26 * scale),
  });
  // Foam tumbling off the tip down the face: torn patches getting smaller as they fall.
  const tip = at(sp[sp.length - 1], 0);
  const n = Math.round(rng.range(6, 11));
  for (let i = 0; i < n; i++) {
    const k = rng.next();
    const x = tip[0] + d * rng.range(-0.4, 1.1) * R * (0.4 + k);
    const y = Math.max(tip[1], base - humpAt(c, x)) + k * c.h * 0.45;
    const r = (1 - 0.6 * k) * rng.range(2, 6) * scale;
    piece(ctx, oval(x, y, r * rng.range(1.2, 2.4), r, 9, rng.range(-0.4, 0.4)), {
      fill: rgba(rng.chance(0.6) ? SEA.foam : SEA.foamMid, rng.range(0.75, 1)),
      torn: { amp: r * 0.35, freq: 0.4, fine: 0.5, seed: rng.int(1, 1e6), step: 2 },
    });
  }
}

// A small whitecap: a thin torn white edge along the peak, thickening down the front.
function paintCrestLine(ctx, c, base, scale, rng) {
  const a = c.x - reach(0.8) * c.w * c.lean * rng.range(0.15, 0.7);
  const b = c.x + reach(0.4) * c.w / c.lean * rng.range(0.5, 1.2);
  const th = (c.h * 0.1 + 1.1 * scale) * rng.range(0.7, 1.3);
  const m = Math.max(6, Math.ceil((b - a) / 4));
  const ph = rng.range(0, 100);
  const up = [], dn = [];
  for (let j = 0; j <= m; j++) {
    const u = j / m, x = lerp(a, b, u), y = base - humpAt(c, x);
    const k = Math.pow(Math.sin(Math.PI * u), 0.5) * (0.35 + 0.65 * u);
    up.push([x, y - 0.6 * scale * k]);
    dn.push([x, y + th * k * (0.55 + 0.6 * Math.abs(FNZ.n1(x * 0.07 / scale + ph)))]);
  }
  piece(ctx, [...up, ...dn.reverse()], {
    fill: rng.chance(0.7) ? SEA.foam : SEA.foamMid,
    torn: { amp: 0.5 * scale + 0.3, freq: 0.25, fine: 0.5, seed: rng.int(1, 1e6), step: 3 },
    shadow: { color: rgba(SEA.foamShade, 0.6), blur: 1.5 * scale + 1, x: 0, y: 1.5 * scale },
  });
}
// Long torn foam streaks lying on the water between the crests (wind-driven lace).
function paintStreaks(ctx, row, rng, scale) {
  const { base, gap, x0, x1, v } = row;
  if (v < 0.2) return;
  const n = Math.round((x1 - x0) / 260 * (0.6 + v));
  for (let i = 0; i < n; i++) {
    const cx = lerp(x0, x1, rng.next());
    const cy = base + gap * rng.range(-0.1, 0.55);
    const len = rng.range(40, 170) * scale;
    const th = rng.range(1, 2.6) * scale;
    const bend = rng.range(-0.5, 0.5) * th * 3;
    const line = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      line.push([cx - len / 2 + len * t, cy + bend * Math.sin(Math.PI * t) + th * 0.8 * Math.sin(t * 7 + i)]);
    }
    const taper = (k) => Math.pow(Math.sin(Math.PI * (k / 10)), 0.6);
    const strip = [...line.map(([x, y], k) => [x, y - th * taper(k) / 2]), ...line.map(([x, y], k) => [x, y + th * taper(k) / 2]).reverse()];
    piece(ctx, strip, { fill: rgba('#e4ecf0', rng.range(0.45, 0.85)), torn: { amp: th * 0.45, freq: 0.22, fine: 0.4, seed: rng.int(1, 1e6), step: 4 } });
  }
}

// Gold weight of the star's reflection at (x, y) in a row of depth v.
function goldAt(o, v, x, nz) {
  const R = o.reflection;
  if (!R) return 0;
  const fade = 1 - smoothstep(R.v0, R.v1, v);
  if (fade <= 0) return 0;
  const half = lerp(R.top, R.bottom, smoothstep(0, R.v1, v)) / 2;
  const wob = nz.n2(v * 9, 3.3) * half * 0.35;
  const across = 1 - smoothstep(0.35, 1, Math.abs(x - R.x - wob) / half);
  const broken = smoothstep(-0.25, 0.35, nz.n2(x * 0.03, v * 40));
  return fade * across * broken;
}

const goldTone = (g, rng) => {
  const G = SEA.gold;
  const x = clamp(g * rng.range(0.8, 1.15)) * (G.length - 1);
  const i = Math.min(G.length - 2, Math.floor(x));
  return mix(G[i], G[i + 1], x - i);
};

// Torn white foam cap on crest c, with clawed fingers spilling down the face and a few
// blown flecks above it.
function paintFoam(ctx, c, base, scale, rng, light) {
  const f = c.foam;
  // The cap is thin over the back of the wave and thickest where it tumbles down the
  // front (right) flank; its underside is a run of ragged lobes, never an even band.
  const back = reach(0.6) * (0.45 + 0.4 * f) * rng.range(0.75, 1.2);
  const front = reach(0.2) * (0.5 + 0.45 * f) * rng.range(0.8, 1.25);
  const x0 = c.x - back * c.w * c.lean, x1 = c.x + front * c.w / c.lean;
  const thick = (c.h * 0.22 + 3 * scale) * f;
  const ph = rng.range(0, 100);
  const top = [], bot = [], under = [];
  const n = Math.max(12, Math.ceil((x1 - x0) / 4));
  const peakU = (c.x - x0) / (x1 - x0);
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = lerp(x0, x1, u);
    const y = base - humpAt(c, x);
    const env = Math.pow(Math.sin(Math.PI * u), 0.55) * (0.3 + 0.7 * smoothstep(0, peakU + 0.15, u));
    const lob = 0.5 + 0.32 * FNZ.n1(x * 0.04 / scale + ph) + 0.35 * Math.pow(Math.abs(Math.sin(x * 0.1 / scale + ph)), 0.7);
    top.push([x, y - (0.8 + 1.4 * f) * scale * env * (0.7 + 0.6 * Math.abs(FNZ.n1(x * 0.15 / scale + ph)))]);
    bot.push([x, y + thick * env * lob]);
    under.push([x, y + thick * env * (lob + 0.35)]);
  }
  const shade = { color: rgba(SEA.foamShade, 0.85), blur: 3 * scale + 2, x: -light[0] * 2, y: 2.5 * scale };
  // Shaded underlayer, then the white cap over it.
  piece(ctx, [...top, ...under.slice().reverse()], {
    fill: mix(SEA.foamShade, SEA.teal, 0.25),
    torn: { amp: 1.2 * scale + 0.5, freq: 0.2, fine: 0.8, seed: rng.int(1, 1e6), step: 3 },
  });
  piece(ctx, [...top, ...bot.slice().reverse()], {
    fill: linear(ctx, 0, base - c.h, 0, base - c.h + thick * 1.5, ['#ffffff', SEA.foam, SEA.foamMid]),
    torn: { amp: 1.5 * scale + 0.6, freq: 0.18, fine: 1, seed: rng.int(1, 1e6), step: 3 },
    shadow: shade,
  });
  // Lace holes: the face showing through pockets in the thick part of the cap.
  const holes = Math.round(f * (x1 - x0) / (24 * scale));
  for (let i = 0; i < holes; i++) {
    const j = rng.int(Math.round(n * 0.3), Math.round(n * 0.85));
    const yt = top[j][1], yb = bot[j][1];
    if (yb - yt < 6 * scale) continue;
    const r = (yb - yt) * rng.range(0.1, 0.2);
    piece(ctx, oval(top[j][0], lerp(yt, yb, rng.range(0.5, 0.75)), r * rng.range(1.2, 2.2), r, 9, rng.range(-0.3, 0.3)), {
      fill: mix(SEA.teal, SEA.foamShade, rng.range(0.2, 0.55)),
      torn: { amp: r * 0.3, freq: 0.4, fine: 0.4, seed: rng.int(1, 1e6), step: 2 },
    });
  }
  // Tongues spilling down the front flank, all different lengths.
  const tongues = Math.round(rng.range(1, 3.5) * f * clamp((x1 - x0) / (80 * scale), 0.5, 2));
  for (let i = 0; i < tongues; i++) {
    const j = rng.int(Math.round(lerp(peakU, 1, 0.1) * n), n - 2);
    const len = (c.h * rng.range(0.06, 0.28) + 3 * scale) * f;
    const pts2 = transform(leaf(len, len * rng.range(0.22, 0.36), { belly: 0.35, curl: rng.range(0.1, 0.5), tipRound: 0.4, n: 9 }), {
      x: bot[j][0], y: bot[j][1] - len * 0.2, rot: rng.range(1.9, 2.8),
    });
    piece(ctx, pts2, { fill: rng.chance(0.7) ? SEA.foam : SEA.foamMid, torn: { amp: 0.6 * scale + 0.3, freq: 0.3, fine: 0.4, seed: rng.int(1, 1e6), step: 2.5 }, shadow: shade });
  }
  // Torn patches of foam left on the face below the front of the cap.
  const patches = Math.round(f * rng.range(3, 8) * clamp((x1 - c.x) / (60 * scale), 0.5, 2.2));
  for (let i = 0; i < patches; i++) {
    const k = rng.next();
    const x = lerp(c.x, x1 + (x1 - c.x) * 0.25, Math.pow(rng.next(), 0.7));
    const y = base - humpAt(c, x) + thick * (1 + k * 2.5);
    const r = (1 - 0.5 * k) * rng.range(1.2, 4.5) * scale;
    piece(ctx, oval(x, y, r * rng.range(1.3, 2.6), r, 8, rng.range(-0.5, 0.2)), {
      fill: rgba(rng.chance(0.6) ? SEA.foam : SEA.foamMid, rng.range(0.6, 0.95)),
      torn: { amp: r * 0.35, freq: 0.4, fine: 0.5, seed: rng.int(1, 1e6), step: 2 },
    });
  }
  // Lace: thin broken foam lines trailing down the face.
  const lace = Math.round(rng.range(0.5, 2.5) * f);
  for (let i = 0; i < lace; i++) {
    const d = c.h * rng.range(0.35, 0.75);
    const span = reach(clamp(d / c.h + 0.12, 0.05, 0.95)) * rng.range(0.4, 0.8);
    const a = c.x - span * c.w * c.lean * rng.range(0.1, 0.5), b = c.x + span * c.w / c.lean * rng.range(0.4, 1.1);
    const line = [];
    for (let k = 0; k <= 12; k++) {
      const x = lerp(a, b, k / 12);
      line.push([x, base - humpAt(c, x) + d]);
    }
    const th = rng.range(1, 2.4) * scale;
    const strip = [...line.map(([x, y]) => [x, y - th / 2]), ...line.reverse().map(([x, y]) => [x, y + th / 2])];
    piece(ctx, strip, { fill: rgba('#e6eef0', rng.range(0.55, 0.85)), torn: { amp: th * 0.5, freq: 0.2, fine: 0.4, seed: rng.int(1, 1e6), step: 4 } });
  }
  // Flecks of spray torn off the crest, thrown up and forward.
  ctx.fillStyle = SEA.foam;
  const flecks = Math.round(c.foam * (x1 - x0) / (7 * scale));
  for (let i = 0; i < flecks; i++) {
    const x = lerp(x0, x1 + (x1 - x0) * 0.2, rng.next());
    const y = base - humpAt(c, Math.min(x, x1)) - rng.range(1, 18) * scale * rng.next();
    ctx.beginPath();
    ctx.arc(x, y, rng.range(0.5, 1.6) * Math.sqrt(scale), 0, TAU);
    ctx.fill();
  }
}

// Paint one wave row into a sprite.
function paintRow(ctx, row, o) {
  const rng = new RNG(`${o.seed}:row:${row.i}`);
  const nz = noise(`${o.seed}:nz`);
  const { base, bottom, x0, x1, v, scale } = row;
  const L = o.light;
  const shadowOf = (alpha, blur, d) => ({ color: SEA.shadow, alpha, blur, dx: -L[0] * d, dy: -L[1] * d * 0.6 });

  // The band: navy water with a low chop along its top.
  const top = [];
  for (let x = x0; x <= x1; x += 6) top.push([x, base - row.amp * 0.12 * (0.5 + 0.5 * nz.n2(x * 0.02, v * 30))]);
  piece(ctx, [...top, [x1, bottom], [x0, bottom]], {
    fill: linear(ctx, 0, base - row.amp * 0.2, 0, bottom, [mix(SEA.blue, SEA.navy, 0.35), SEA.navy, SEA.deep]),
    torn: { amp: 1.2 * scale, freq: 0.1, fine: 0.5, seed: rng.int(1, 1e6), step: 6 },
  });
  // Chop: short flat strips across the band.
  sheet(ctx, (add) => {
    const n = Math.round((x1 - x0) / (14 + 26 * scale) * o.density);
    for (let i = 0; i < n; i++) {
      const cx = lerp(x0, x1, rng.next()), cy = lerp(base - row.amp * 0.1, bottom - 4, Math.pow(rng.next(), 1.6));
      const len = rng.range(18, 60) * scale, th = rng.range(1.5, 4.5) * scale;
      const g = goldAt(o, v, cx, nz);
      const fill = g > 0.15 ? goldTone(g, rng) : rng.pick([SEA.blue, SEA.slate, SEA.navy, SEA.navy, SEA.deep, mix(SEA.teal, SEA.navy, 0.3), mix(SEA.jade, SEA.navy, 0.45), mix(SEA.steel, SEA.pale, 0.3)]);
      add([[cx - len / 2, cy], [cx - len * 0.2, cy - th * 0.6], [cx + len / 2, cy - th * 0.2], [cx + len * 0.15, cy + th * 0.45]], {
        fill, torn: { amp: 0.6 * scale, freq: 0.2, fine: 0.3, seed: rng.int(1, 1e6), step: 6 },
      });
    }
  }, { light: L, shadow: shadowOf(0.4, 2 * scale + 1, 1.5 * scale), edge: { width: 1, hi: 0.25, lo: 0.2 } });

  // Humps, smallest first.
  for (const c of row.crests) {
    const xa = c.x - 2.1 * c.w * c.lean, xb = c.x + 2.1 * c.w / c.lean;
    if (xb < x0 - 20 || xa > x1 + 20) continue;
    const prof = [];
    for (let x = xa; x <= xb; x += Math.max(3, c.w / 24)) prof.push([x, base - humpAt(c, x)]);
    prof.push([xb, base - humpAt(c, xb)]);
    const foot = base + Math.min(row.gap * 0.9, c.h * 0.45 + 6 * scale);
    const g0 = goldAt(o, v, c.x, nz);
    const crestTone = mix(c.curl ? SEA.mint : c.foam ? SEA.jade : rng.pick([SEA.teal, SEA.jade, SEA.steel]), SEA.gold[1], g0 * 0.6);
    piece(ctx, [...prof, [xb, foot], [xa, foot]], {
      fill: linear(ctx, 0, base - c.h, 0, foot, [crestTone, mix(SEA.teal, SEA.navy, 0.4), SEA.deep]),
      torn: { amp: 0.9 * scale + 0.4, freq: 0.12, fine: 0.5, seed: rng.int(1, 1e6), step: 4 },
      shadow: { color: rgba(SEA.shadow, 0.5), blur: 4 * scale + 2, x: -L[0] * 2 * scale, y: 1.5 * scale },
    });
    // Arched strips down the face, light at the crest, navy toward the trough: many thin
    // slivers in mixed teal, jade and steel.
    const K = clamp(Math.round(c.h / (3.2 + 1.3 * scale)), 2, 16);
    sheet(ctx, (add) => {
      for (let k = 0; k < K; k++) {
        const f = (k + rng.range(0.1, 0.6)) / K;
        const d = c.h * Math.pow(f, 1.2) * 0.94;
        const th = (c.h * 0.075 + 1.2 * scale) * rng.range(0.55, 1.35);
        const lvl = clamp(1 - (d + th) / c.h + 0.03, 0.04, 0.96);
        const span = reach(lvl) * rng.range(0.55, 1);
        const shift = rng.range(-0.15, 0.15) * c.w;
        const a = c.x + shift - span * c.w * c.lean, b = c.x + shift + span * c.w / c.lean;
        const up = [], dn = [];
        const m = Math.max(6, Math.ceil((b - a) / 7));
        for (let j = 0; j <= m; j++) {
          const x = lerp(a, b, j / m);
          const y = base - humpAt(c, x - shift) + d;
          const taper = Math.pow(Math.sin(Math.PI * (j / m)), 0.5);
          up.push([x, y]);
          dn.push([x, y + th * taper]);
        }
        const g = goldAt(o, v, (a + b) / 2, nz);
        const fill = g > 0.2 ? goldTone(g * (1 - f * 0.5), rng) : faceTone(f, rng);
        add([...up, ...dn.reverse()], { fill, torn: { amp: 0.7 * scale + 0.3, freq: 0.15, fine: 0.4, seed: rng.int(1, 1e6), step: 5 } });
      }
    }, { light: L, shadow: shadowOf(0.45, 2.5 * scale + 1, 1.8 * scale), edge: { width: 1.1, hi: 0.3, lo: 0.22 } });
    if (c.foam > 0) paintFoam(ctx, c, base, scale, rng, L);
    else if (c.h > 1.5 && rng.chance(0.3 + 0.25 * (1 - v) + 0.45 * clamp(c.h / row.amp))) paintCrestLine(ctx, c, base, scale, rng);
    if (c.curl) paintCurl(ctx, c, base, scale, rng, L);
  }
  paintStreaks(ctx, row, rng, scale);

  // The star's reflection: bright dashes lying on the water inside the column.
  const R = o.reflection;
  if (R && v < R.v1) {
    sheet(ctx, (add) => {
      const half = lerp(R.top, R.bottom, smoothstep(0, R.v1, v)) / 2;
      const n = Math.round(half / (6 + 10 * scale) * 6);
      for (let i = 0; i < n; i++) {
        const cx = R.x + rng.range(-1, 1) * half * 0.95;
        const g = goldAt(o, v, cx, nz);
        if (g < 0.12) continue;
        const cy = lerp(base - row.amp * 0.3, base + row.gap * 0.6, rng.next());
        const len = rng.range(10, 46) * scale * (0.6 + g), th = rng.range(1.5, 4) * scale;
        add([[cx - len / 2, cy], [cx, cy - th / 2], [cx + len / 2, cy], [cx, cy + th / 2]], {
          fill: goldTone(clamp(g * 1.1 + 0.15), rng), torn: { amp: 0.5 * scale, freq: 0.25, fine: 0.3, seed: rng.int(1, 1e6), step: 4 },
        });
      }
    }, { light: L, shadow: shadowOf(0.3, 2, 1), edge: { width: 0.9, hi: 0.4, lo: 0.12 } });
  }
}

// The sea: rows from the horizon down to y1.
//   horizon, y1        crest line of the farthest and nearest rows
//   rows               number of rows; z0, z1: depth of the farthest / nearest row
//   x0, x1             horizontal extent (overscan included)
//   amp, lambda        [far, near] crest height and wavelength
//   feature            { [rowIndex]: [{ x, h, w, lean, foam }] } hand-placed crests
//   reflection         { x, top, bottom, v0, v1 } column of the star's light (widths in px)
//   swell              { period, amp: [far, near], travel } the travelling swell
//   tags               layer tags
export function addSea(S, opts) {
  const o = {
    seed: 'sea', horizon: 566, y1: 1090, rows: 16, z0: 2300, z1: 900, x0: 560, x1: 2420,
    amp: [3, 74], lambda: [46, 470], density: 1, feature: {}, reflection: null, light: S.light,
    swell: { period: 5.6, amp: [0.6, 7], travel: 1.25 }, tags: ['sea'], ...opts,
  };
  const rng = new RNG(o.seed);
  const nz = noise(`${o.seed}:plan`);
  const vOf = (i) => i / (o.rows - 1);
  const yOf = (i) => lerp(o.horizon, o.y1, Math.pow(vOf(i), 1.5));
  const layers = [];
  for (let i = 0; i < o.rows; i++) {
    const v = vOf(i);
    const base = yOf(i);
    const gap = i < o.rows - 1 ? yOf(i + 1) - base : 120;
    const amp = lerp(o.amp[0], o.amp[1], Math.pow(v, 1.4));
    const row = {
      i, v, base, gap, amp, x0: o.x0, x1: o.x1,
      lambda: lerp(o.lambda[0], o.lambda[1], Math.pow(v, 1.2)),
      scale: lerp(0.35, 2.2, Math.pow(v, 1.3)),
      bottom: i < o.rows - 1 ? yOf(i + 1) + gap * 0.5 + amp * 0.3 + 10 : base + 520,
      feature: o.feature[i],
    };
    row.crests = planCrests(row, rng.fork(`crests${i}`), nz);
    const peak = Math.max(...row.crests.map((c) => c.h));
    const box = { x: o.x0 - 40, y: Math.floor(base - peak * 1.5 - 26), w: o.x1 - o.x0 + 80, h: 0 };
    box.h = Math.ceil(row.bottom - box.y + 10);
    const s = S.sprite({
      name: `sea-row${i}`, ...box, res: v > 0.7 ? 1.1 : 1,
      mat: [{ tex: 'fiber', amt: 0.6 }, { tex: 'crumple', amt: 0.35, scale: 0.35 + 0.3 * v }],
      edge: { width: 1.2, hi: 0.3, lo: 0.15, soft: 0.5 }, shadow: { blur: 4 + 8 * v },
      draw: (ctx) => paintRow(ctx, row, o),
    });
    const z = 1 / lerp(1 / o.z0, 1 / o.z1, v);
    const sw = o.swell;
    const bob = lerp(sw.amp[0], sw.amp[1], v);
    const phase = v * sw.travel;
    const drift = -lerp(2, 9, v);
    layers.push(S.add({
      name: `sea-row${i}`, z, tags: o.tags, sprites: [{ s }],
      // Row shadows fall up onto the row behind: the dark trough behind every crest.
      shadow: { alpha: 0.42, dx: -o.light[0] * 3, dy: -(2 + 5 * v) },
      anim: (t) => {
        const a = TAU * (t / sw.period - phase);
        return {
          x: drift * t + bob * 0.8 * Math.cos(a * 0.5 + i),
          y: bob * Math.sin(a), sy: 1 + 0.035 * v * Math.sin(a + 0.6), oy: base,
        };
      },
    }));
  }
  layers.rowY = yOf;
  return layers;
}
