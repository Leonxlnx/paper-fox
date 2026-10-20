// Boulders, stepping stones and the snowy rocky trail. A boulder's outline comes
// from a stack of irregular rings seen from slightly above; its body is then cut into
// Voronoi facets, each lit by the normal of a dome at that spot plus a random tilt,
// like a lump of paper crushed into planes. Flat rocks get a separate, lighter top
// plate. Moss, gold flecks, cracks and snow are laid over it as extra pieces.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands, linear } from '../core/piece.js';
import { flecks } from '../core/paper.js';
import { blob, TAU } from '../core/geom.js';
import { vary, rgba } from '../core/color.js';
import { DEFAULT_LIGHT, clamp01, boxOf, areaOf, centroid, hull, voronoi, scatterIn, sliver, brush } from './terrain-kit.js';

// ramp: crack, deep side, side, mid, top, lit top.
export const STONE_PALETTES = {
  // ref02: the fox's perch, warm grey-brown with gold specks.
  perch: { ramp: ['#1a1311', '#33292a', '#463a36', '#584a44', '#6b5b53', '#7f6e64'], fleck: '#d8b45c', moss: ['#4e5e24', '#7a8a30', '#a8b040'] },
  // ref02 / ref04: river rocks, dark plum-grey.
  river: { ramp: ['#120e12', '#231c22', '#30282f', '#3e343c', '#51454c', '#65585e'], fleck: '#c8a458', moss: ['#4a5a26', '#6e7e2e', '#98a03a'] },
  // ref04: canyon walls and ledges, charcoal with warm grey lit planes.
  canyon: { ramp: ['#0e0c0d', '#1f1b1b', '#2f2927', '#433a35', '#5e5046', '#86725f'], fleck: '#cfae62', moss: ['#4f4a1c', '#6e6a20', '#9a9030'] },
  // ref08: arch and cliffs, neutral grey with a warm cast.
  arch: { ramp: ['#161312', '#2e2927', '#423a38', '#574b4a', '#6d615e', '#8a7f78'], fleck: '#d4b462', moss: ['#5a6420', '#8a9426', '#b8b432'] },
  // ref01: dusk river rocks, dark mauve-grey.
  dusk: { ramp: ['#181215', '#282024', '#362c31', '#463a40', '#5e5055', '#746264'], fleck: '#d6a860', moss: ['#4a5a28', '#728232', '#a0aa40'] },
  // ref10: sunlit sandstone browns.
  dawn: { ramp: ['#211817', '#3a2923', '#553c31', '#705244', '#98725c', '#b69078'], fleck: '#f0c870', moss: ['#5e6a28', '#8e9a34', '#c0b848'] },
  // ref05: cold granite under snow.
  granite: { ramp: ['#161515', '#252322', '#363331', '#4a4643', '#625c56', '#7e766e'], fleck: '#c8b070', moss: ['#5a6a2a', '#8a9a30', '#b8b040'] },
};

// Snow on rocks and trails: lit top, shaded underside, white paper core.
export const SNOW = { top: '#f2f4fb', mid: '#dfe6f4', shade: '#a9bcd8', deep: '#8299bc', rim: '#ffffff' };

// Strong granite speckle over crushed facets: the material for rock planes.
export const ROCK_MAT = [{ tex: 'stone', amt: 1 }, { tex: 'crumple', amt: 0.7, scale: 0.32 }];

// Ring stacks (top to bottom) that set a boulder's outline: r = relative radius,
// h = relative height. `plate` marks shapes with a flat top plate.
export const BOULDER_SHAPES = {
  round: { rings: [{ r: 0.5, h: 1 }, { r: 0.88, h: 0.75 }, { r: 1, h: 0.35 }, { r: 0.96, h: 0 }] },
  pointy: { rings: [{ r: 0.18, h: 1 }, { r: 0.7, h: 0.66 }, { r: 1, h: 0.25 }, { r: 0.94, h: 0 }] },
  flat: { rings: [{ r: 0.86, h: 1 }, { r: 1, h: 0.7 }, { r: 0.97, h: 0 }], plate: true },
  slab: { rings: [{ r: 0.93, h: 1 }, { r: 1, h: 0.55 }, { r: 0.98, h: 0 }], plate: true },
  block: { rings: [{ r: 0.78, h: 1 }, { r: 0.96, h: 0.82 }, { r: 1, h: 0 }], plate: true },
};

// --- boulders -------------------------------------------------------------------

// Geometry of one boulder: outline, optional top plate and Voronoi facets with normals.
//   x, y      centre of the base on the ground; w, h: width and height in px
//   shape     BOULDER_SHAPES name or { rings, plate }; tilt: how much of the top we see
//   sides     outline vertices per ring; rough: radius noise; lean: shifts the top (px)
//   facets    number of facet cells (default from size)
export function boulderGeometry({ x, y, w = 120, h = 80, shape = 'round', tilt = 0.32, sides = 6, rough = 0.24, lean = 0, facets = 0, seed = 1 } = {}) {
  const rng = new RNG(`boulder:${seed}`);
  const S = typeof shape === 'string' ? BOULDER_SHAPES[shape] : shape;
  const R = w / 2;
  const a0 = rng.range(0, TAU);
  const angles = [];
  for (let j = 0; j < sides; j++) angles.push(a0 + ((j + rng.range(-0.35, 0.35)) / sides) * TAU);
  const radial = angles.map(() => 1 + rng.range(-rough, rough));
  const ringPts = S.rings.map((ring) => angles.map((a, j) => {
    const r = R * ring.r * (radial[j] + rng.range(-rough, rough) * 0.6);
    return [x + lean * ring.h + Math.cos(a) * r, y - ring.h * h + Math.sin(a) * r * tilt + rng.range(-0.04, 0.04) * h];
  }));
  const outline = hull(ringPts.flat());
  const plate = S.plate ? hull(ringPts[0]) : null;
  const n = facets || Math.max(5, Math.min(18, Math.round((w * h) / 1300)));
  const cells = voronoi(outline, scatterIn(outline, n, rng, { gap: Math.sqrt((w * h) / n) * 0.55 }), { sy: 1.25 });
  // Dome normal at each cell: sides face outward, the upper part faces the sky.
  const cx = x + lean * 0.5;
  for (const c of cells) {
    const [px, py] = centroid(c.pts);
    const u = Math.max(-1, Math.min(1, (px - cx) / R));
    const s = clamp01((y - py) / h);
    const up = Math.pow(s, S.plate ? 3 : 1.6) * 0.9 + rng.range(-0.25, 0.25);
    const nx = u * 0.85 + rng.range(-0.35, 0.35);
    c.n = [nx, up, Math.sqrt(Math.max(0.05, 1 - Math.min(0.95, nx * nx + up * up)))];
    c.c = [px, py];
  }
  return { outline, plate, cells, x, y, w, h, top: y - h };
}

// Light on a facet normal [nx (right), up, nz (toward viewer)].
const lightOf = (n, light) => n[0] * light[0] + n[1] * -light[1] + n[2] * 0.25;

const pickRamp = (ramp, t) => ramp[Math.max(1, Math.min(ramp.length - 1, Math.round(1 + t * (ramp.length - 2))))];

// Draw one boulder (inside a sprite's draw). Returns its geometry.
//   palette   STONE_PALETTES name or object
//   moss      0..1 moss on the upper facets; snow: 0..1 snow cap
//   specks    fleck density (gold, dark and pale); cracks: dark slivers along facet seams
//   contrast  strength of the facet lighting
//   cast      drop shadow onto what was drawn earlier in the same sprite
export function drawBoulder(ctx, opts = {}) {
  const {
    palette = 'perch', light = DEFAULT_LIGHT, moss = 0, snow = 0, specks = 1, cracks = 1, detail = 1,
    cast = { blur: 8, x: 0, y: 5 }, seed = 1, contrast = 1,
  } = opts;
  const P = typeof palette === 'string' ? STONE_PALETTES[palette] : palette;
  const G = boulderGeometry({ ...opts, seed });
  const rng = new RNG(`boulder-draw:${seed}`);
  const sil = pathOf(G.outline);
  piece(ctx, G.outline, { fill: P.ramp[0], shadow: cast ? { color: 'rgba(6,4,8,0.6)', blur: cast.blur, x: cast.x ?? 0, y: cast.y ?? 5 } : null });
  ctx.save();
  ctx.clip(sil);
  // Facets meet edge to edge and read as planes by tone; lit planes get a faint
  // contact shadow where they overlap darker ones.
  const order = G.cells.slice().sort((p, q) => lightOf(p.n, light) - lightOf(q.n, light));
  for (const c of order) {
    const I = lightOf(c.n, light);
    c.t = clamp01(0.25 + I * 0.85 * contrast + rng.range(-0.06, 0.06));
    const path = piece(ctx, c.pts, {
      fill: vary(pickRamp(P.ramp, c.t), rng, 0.04),
      shadow: I > 0.2 ? { color: 'rgba(0,0,0,0.28)', blur: 2.5, x: -light[0] * 1.2, y: 1.4 } : null,
      bevel: I > 0.3 ? { light, width: 1.1, hi: 0.12, lo: 0 } : null,
    });
    if (detail > 0) brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.5, 0.5), amt: 0.2 * detail, scale: 0.6, seed: rng.int(1, 1e9) });
  }
  // Ambient occlusion toward the ground line.
  ctx.fillStyle = linear(ctx, 0, G.y - G.h * 0.45, 0, G.y + 4, [rgba(P.ramp[0], 0), rgba(P.ramp[0], 0.55)]);
  ctx.fillRect(G.x - G.w, G.y - G.h, G.w * 2, G.h * 1.6);
  if (G.plate) drawPlate(ctx, G, P, rng, light, detail);
  if (cracks > 0) drawCracks(ctx, G, P, rng, cracks);
  if (specks > 0) {
    const b = boxOf(G.outline);
    const a = b.w * b.h;
    flecks(ctx, b.x, b.y, b.w, b.h, Math.round((a / 220) * specks), rng.int(1, 1e6), { color: P.fleck, max: 1.3, alpha: 0.8 });
    flecks(ctx, b.x, b.y, b.w, b.h, Math.round((a / 180) * specks), rng.int(1, 1e6), { color: '#000000', max: 1.2, alpha: 0.4 });
    flecks(ctx, b.x, b.y, b.w, b.h, Math.round((a / 200) * specks), rng.int(1, 1e6), { color: '#e8e0d8', max: 0.9, alpha: 0.35 });
  }
  if (moss > 0) drawMoss(ctx, G, P, rng, moss, light);
  ctx.restore();
  if (snow > 0) drawSnowCap(ctx, G, rng, snow, light);
  bevelBands(ctx, sil, { light, width: 1.5, hi: 0.32, lo: 0.3 });
  return G;
}

// The flat top of a perch or slab: a lighter plate cut into a few pieces.
function drawPlate(ctx, G, P, rng, light, detail) {
  const plate = G.plate;
  const n = Math.max(2, Math.min(5, Math.round(areaOf(plate) / 14000)));
  const cells = voronoi(plate, scatterIn(plate, n, rng), { sy: 2.5 });
  const pp = pathOf(plate);
  piece(ctx, plate, { fill: P.ramp[4], shadow: { color: 'rgba(0,0,0,0.45)', blur: 3, x: -light[0] * 1.5, y: 2.5 } });
  ctx.save();
  ctx.clip(pp);
  for (const c of cells) {
    const path = piece(ctx, c.pts, { fill: vary(P.ramp[rng.chance(0.55) ? 4 : 5], rng, 0.035), shadow: { color: 'rgba(0,0,0,0.22)', blur: 2, x: 0, y: 1 } });
    if (detail > 0) brush(ctx, path, { angle: rng.range(-0.15, 0.15), amt: 0.22 * detail, scale: 0.7, seed: rng.int(1, 1e9) });
  }
  ctx.restore();
  bevelBands(ctx, pp, { light, width: 1.6, hi: 0.45, lo: 0.25 });
}

// Dark slivers along some facet seams: the cracks between cut stone planes.
function drawCracks(ctx, G, P, rng, amount) {
  for (const c of G.cells) {
    if (!rng.chance(0.14 * amount)) continue;
    const k = rng.int(0, c.pts.length - 1);
    const a = c.pts[k], b = c.pts[(k + 1) % c.pts.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 10) continue;
    const seg = [a, [(a[0] + b[0]) / 2 + rng.range(-2, 2), (a[1] + b[1]) / 2 + rng.range(-2, 2)], b];
    piece(ctx, sliver(seg, rng.range(0.8, 2)), { fill: rgba(P.ramp[0], 0.9) });
  }
}

// Moss: torn patches on the upper facets, with crumbs around them.
function drawMoss(ctx, G, P, rng, amount, light) {
  const tops = G.cells.filter((c) => c.n[1] > 0.35);
  const n = Math.round((1 + amount * 5) * Math.max(0.6, G.w / 160));
  for (let i = 0; i < n && tops.length; i++) {
    const [cx, cy] = rng.pick(tops).c;
    const rx = rng.range(5, 14) * (0.6 + amount * 0.6) * Math.max(0.7, G.w / 200), ry = rx * rng.range(0.35, 0.6);
    piece(ctx, blob(cx + rng.range(-8, 8), cy + rng.range(-4, 4), rx, ry, rng, { n: 14, irregular: 0.4 }), {
      fill: vary(P.moss[rng.int(0, P.moss.length - 1)], rng, 0.06),
      torn: { amp: 1.6, freq: 0.3, fine: 0.8, seed: rng.int(1, 1e6), step: 2 },
      shadow: { color: 'rgba(0,0,0,0.35)', blur: 2, x: 0, y: 1.5 },
      bevel: { light, width: 1, hi: 0.3, lo: 0.1 },
    });
    flecks(ctx, cx - rx * 1.6, cy - ry * 1.6, rx * 3.2, ry * 3.2, 12, rng.int(1, 1e6), { color: P.moss[2], max: 1.6, alpha: 0.85 });
  }
}

// A thick snow slab: a blue shaded underside showing below a white top with a paper core.
export function snowSlab(ctx, pts, rng, { light = DEFAULT_LIGHT, thick = 5, colors = SNOW } = {}) {
  piece(ctx, pts.map(([x, y]) => [x, y + thick]), {
    fill: colors.shade,
    torn: { amp: 1.5, freq: 0.12, fine: 0.6, seed: rng.int(1, 1e6), step: 3 },
    shadow: { color: 'rgba(10,20,50,0.45)', blur: 4, x: -light[0] * 1.5, y: 3 },
  });
  return piece(ctx, pts, {
    fill: linear(ctx, 0, boxOf(pts).y, 0, boxOf(pts).y + boxOf(pts).h, [colors.top, colors.mid]),
    torn: { amp: 1.4, freq: 0.12, fine: 0.6, seed: rng.int(1, 1e6), step: 3 },
    rim: { color: colors.rim, width: 1 },
    bevel: { light, width: 1.6, hi: 0.5, lo: 0.18 },
  });
}

// Snow cap over a boulder top, drooping over the front edge.
function drawSnowCap(ctx, G, rng, amount, light) {
  const capY = G.top + G.h * 0.35 * amount;
  const top = G.outline.filter(([, py]) => py < capY + 2);
  if (top.length < 2) return;
  const sorted = top.slice().sort((p, q) => p[0] - q[0]);
  const upper = sorted.map(([px, py]) => [px, py - 3]);
  const lower = sorted.slice().reverse().map(([px]) => [px, capY + rng.range(-0.3, 0.5) * G.h * 0.2 * amount]);
  snowSlab(ctx, [...upper, ...lower], rng, { light, thick: 3 + amount * 4 });
}

// Several boulders on one sheet, back to front (sorted by base y).
export function drawBoulders(ctx, { rocks = [], ...common } = {}) {
  return rocks
    .map((r, i) => ({ seed: (common.seed ?? 1) * 53 + i * 11, ...common, ...r }))
    .sort((p, q) => p.y - q.y)
    .map((r) => drawBoulder(ctx, r));
}

export function bouldersBox(rocks, common = {}, pad = 30) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const r of rocks) {
    const o = { ...common, ...r };
    const w = o.w ?? 120, h = o.h ?? 80;
    x0 = Math.min(x0, o.x - w * 0.7 + Math.min(0, o.lean ?? 0)); x1 = Math.max(x1, o.x + w * 0.7 + Math.max(0, o.lean ?? 0));
    y0 = Math.min(y0, o.y - h - w * 0.3); y1 = Math.max(y1, o.y + w * 0.3);
  }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
}

// Add boulders as one baked plane.
export function addBoulders(S, { z = 900, name = 'rocks', box = null, res = 1.25, mat = ROCK_MAT, layer = {}, shadow = { blur: 12 }, ...opts } = {}) {
  const b = box ?? bouldersBox(opts.rocks ?? [], opts);
  return S.plane(z, {
    name, ...b, res, mat, shadow,
    edge: { width: 1.5, hi: 0.3, lo: 0.3, soft: 0.6 },
    draw: (ctx) => drawBoulders(ctx, { light: S.light, ...opts }),
  }, layer);
}

// A row of low flat stones across water or a path.
//   stones  [[x, y, w, h?], ...]; h defaults to w * 0.28
export function drawSteppingStones(ctx, { stones = [], palette = 'river', ...common } = {}) {
  return drawBoulders(ctx, {
    palette, ...common,
    rocks: stones.map(([x, y, w, h]) => ({ x, y, w, h: h ?? w * 0.28, shape: 'slab', tilt: 0.38, sides: 7 })),
  });
}

// The snowy rocky trail of ref05: a band of red-brown earth along a path, pebbles,
// snow slabs drifted along its edges and granite blocks half buried at its sides.
//   path    centreline points, near end first; width: px at the near end
//   taper   width factor at the far end; earth: [dark, mid, light] soil colours
//   snow, rocks   0..1 amounts
export function drawTrail(ctx, {
  path, width = 90, taper = 0.55, palette = 'granite', earth = ['#4a2e22', '#7a4e38', '#a06e4e'],
  light = DEFAULT_LIGHT, snow = 1, rocks = 1, seed = 1,
} = {}) {
  const rng = new RNG(`trail:${seed}`);
  const nz = noise(`trail:${seed}`);
  const n = path.length;
  const widthAt = (i) => width * (1 - (1 - taper) * (i / (n - 1)));
  const left = [], right = [];
  path.forEach((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const w = widthAt(i) * 0.5;
    const wl = w * (1 + nz.n1(i * 0.7) * 0.25), wr = w * (1 + nz.n1(i * 0.7 + 40) * 0.25);
    left.push([p[0] - (dy / l) * wl, p[1] + (dx / l) * wl]);
    right.push([p[0] + (dy / l) * wr, p[1] - (dx / l) * wr]);
  });
  const band = [...left, ...right.slice().reverse()];
  const bb = boxOf(band);
  const bandPath = piece(ctx, band, {
    fill: linear(ctx, 0, bb.y, 0, bb.y + bb.h, [earth[1], earth[0]]),
    torn: { amp: 2.5, freq: 0.06, fine: 0.8, seed: rng.int(1, 1e6) },
    shadow: { color: 'rgba(20,10,5,0.45)', blur: 6, x: 0, y: 3 },
  });
  brush(ctx, bandPath, { angle: 0.3, amt: 0.25, scale: 0.6, seed: rng.int(1, 1e9) });
  ctx.save();
  ctx.clip(bandPath);
  // Grit: dark crumbs and light pebbles.
  flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round((bb.w * bb.h) / 120), rng.int(1, 1e6), { color: '#1e120c', max: 2.4, alpha: 0.7 });
  flecks(ctx, bb.x, bb.y, bb.w, bb.h, Math.round((bb.w * bb.h) / 260), rng.int(1, 1e6), { color: earth[2], max: 2.2, alpha: 0.85 });
  for (let i = 0; i < Math.round((bb.w * bb.h) / 3000); i++) {
    const px = bb.x + rng.next() * bb.w, py = bb.y + rng.next() * bb.h;
    const r = rng.range(2, 5);
    piece(ctx, blob(px, py, r * 1.4, r, rng, { n: 7, irregular: 0.3 }), {
      fill: vary(STONE_PALETTES[palette].ramp[rng.int(2, 4)], rng, 0.05),
      shadow: { color: 'rgba(0,0,0,0.5)', blur: 1.5, x: 0, y: 1.2 },
    });
  }
  ctx.restore();

  // Snow slabs drifted along both edges and in patches across the earth.
  const edges = [left, right];
  const slabs = [];
  if (snow > 0) {
    for (let i = 1; i < n - 1; i++) {
      const w = widthAt(i);
      for (const side of [0, 1]) {
        if (!rng.chance(0.4 * snow)) continue;
        const p = edges[side][i];
        const rx = w * rng.range(0.18, 0.4), ry = rx * rng.range(0.2, 0.32);
        slabs.push({ cx: p[0] + rng.range(-0.15, 0.15) * w, cy: p[1] + rng.range(-0.1, 0.12) * w, rx, ry });
      }
      if (rng.chance(0.2 * snow)) {
        const p = path[i];
        slabs.push({ cx: p[0] + rng.range(-0.3, 0.3) * w, cy: p[1], rx: w * rng.range(0.12, 0.28), ry: w * rng.range(0.04, 0.08) });
      }
    }
  }
  // Granite blocks half buried at the sides.
  const blocks = [];
  if (rocks > 0) {
    for (let i = 1; i < n; i++) {
      for (const side of [0, 1]) {
        const p = edges[side][i];
        // More and bigger blocks on the side away from the light.
        const out = Math.sign(p[0] - path[i][0]) || 1;
        if (!rng.chance((out * light[0] < 0 ? 0.7 : 0.35) * rocks)) continue;
        const w = widthAt(i);
        blocks.push({
          x: p[0] + out * w * rng.range(0.05, 0.35), y: p[1] + w * 0.1, w: w * rng.range(0.55, 1.15), h: w * rng.range(0.4, 0.85),
          shape: rng.pick(['block', 'round', 'pointy', 'block']), palette, seed: rng.int(1, 1e6),
          snow: rng.chance(0.45 * snow) ? rng.range(0.4, 1) : 0, moss: rng.chance(0.25) ? 0.3 : 0,
        });
      }
    }
  }
  const items = [...slabs.map((s) => ({ y: s.cy, s })), ...blocks.map((b) => ({ y: b.y, b }))].sort((p, q) => p.y - q.y);
  for (const it of items) {
    if (it.s) {
      const s = it.s;
      snowSlab(ctx, blob(s.cx, s.cy, s.rx, s.ry, rng, { n: 24, irregular: 0.45 }), rng, { light, thick: 3 + s.ry * 0.3 });
    } else drawBoulder(ctx, { light, cast: { blur: 6, y: 4 }, ...it.b });
  }
}
