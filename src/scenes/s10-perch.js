// The fox's perch in s10: a rounded granite boulder, warm grey-brown, its top facets lit
// by the low sun on the right, darker crushed faces down its sides, moss and a gold-green
// grass fringe along its top edge. Its plane sits behind the fox, so the tail drapes over
// its left shoulder.

import { RNG } from '../core/rng.js';
import { piece, pathOf, bevelBands, linear, setShadow } from '../core/piece.js';
import { flecks } from '../core/paper.js';
import { blob } from '../core/geom.js';
import { vary, rgba } from '../core/color.js';
import { voronoi, scatterIn, centroid, clamp01, sliver, brush } from '../elements/terrain-kit.js';
import { drawTuft } from '../elements/flora.js';

// Warm grey-brown granite: crack, deep side, side, mid, top, lit top, sun-gold top.
const GRANITE = ['#120d0a', '#211913', '#31261e', '#45372c', '#5c4a3c', '#7a6452', '#a08668'];
const MOSS = ['#4f5e22', '#728628', '#9ea436', '#c4bc4a'];
const GRASS = ['#b8ac38', '#8e9a34', '#d8c24c', '#6e7e2e', '#e6cc58'];

// Silhouette, clockwise from the left shoulder (film px). The top runs 641-660 under the fox
// (ground point 618, 650; star flower stem at 707, 648).
const TOP = [[262, 772], [270, 730], [292, 698], [326, 674], [372, 661], [432, 652], [500, 646], [570, 642],
  [640, 641], [706, 645], [762, 654], [808, 668], [846, 690], [874, 722], [892, 762]];
const BELOW = [[902, 812], [904, 862], [896, 914], [878, 966], [820, 1006], [700, 1026], [560, 1026], [420, 1006],
  [322, 968], [278, 908], [262, 842]];
const OUTLINE = [...TOP, ...BELOW];
// Front brow of the top surface: the facets above it face the sky.
const BROW = [[268, 760], [300, 722], [370, 702], [470, 692], [580, 689], [680, 693], [760, 705], [820, 724], [864, 752], [896, 796]];

// Toward the sun (right, up) and toward the viewer.
const SUN_DIR = [0.8, 0.6, 0.3];
const lightOf = (n) => n[0] * SUN_DIR[0] + n[1] * SUN_DIR[1] + n[2] * SUN_DIR[2];

// y of a polyline (sorted by x) at x.
function yOn(line, x) {
  if (x <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1], [x1, y1] = line[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / ((x1 - x0) || 1);
  }
  return line[line.length - 1][1];
}

export function drawPerch(ctx, light) {
  const rng = new RNG('s10-perch');
  const sil = pathOf(OUTLINE);
  const topPoly = [...TOP.slice(1), ...BROW.slice().reverse()];

  // Cast shadow on what lies behind, then the dark body.
  piece(ctx, OUTLINE, { fill: GRANITE[1], torn: { amp: 1.4, freq: 0.12, seed: 7 }, shadow: { color: 'rgba(8,5,4,0.55)', blur: 10, x: -5, y: 6 } });

  // Facet cells: small ones across the top surface, larger ones down the faces.
  const seeds = [...scatterIn(topPoly, 16, rng, { gap: 30 }), ...scatterIn(OUTLINE, 24, rng, { gap: 52 })
    .filter(([x, y]) => y > yOn(BROW, x) + 10)];
  const cells = voronoi(OUTLINE, seeds, { sy: 1.3 });
  for (const c of cells) {
    const [px, py] = centroid(c.pts);
    const brow = yOn(BROW, px);
    const u = Math.max(-1, Math.min(1, (px - 590) / 320));
    let n;
    if (py < brow) {
      n = [u * 0.4 + rng.range(-0.25, 0.25), 0.82 + rng.range(-0.12, 0.12), 0.4];
      c.top = true;
    } else {
      const v = clamp01((py - brow) / (1010 - brow));
      const nx = u * 0.95 + rng.range(-0.45, 0.45), up = 0.3 - v * 0.6 + rng.range(-0.25, 0.25);
      n = [nx, up, Math.sqrt(Math.max(0.05, 1 - Math.min(0.95, nx * nx + up * up)))];
    }
    c.I = lightOf(n);
    c.t = clamp01(0.2 + c.I * 0.72 + (c.top ? 0.14 : 0) + rng.range(-0.08, 0.08));
  }
  ctx.save();
  ctx.clip(sil);
  for (const c of cells.slice().sort((a, b) => a.t - b.t)) {
    const col = GRANITE[Math.max(1, Math.min(6, Math.round(1 + c.t * 5)))];
    const path = piece(ctx, c.pts, {
      fill: vary(col, rng, 0.035),
      shadow: c.t > 0.45 ? { color: 'rgba(0,0,0,0.3)', blur: 2.5, x: -1.2, y: 1.6 } : null,
      bevel: c.t > 0.55 ? { light, width: 1.2, hi: 0.18, lo: 0 } : null,
    });
    brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.5, 0.5), amt: 0.22, scale: 0.6, seed: rng.int(1, 1e9) });
  }
  // The faces curve away: shade down the left flank and toward the ground, warm sun on the right.
  ctx.fillStyle = linear(ctx, 262, 0, 470, 0, [rgba(GRANITE[0], 0.42), rgba(GRANITE[0], 0)]);
  ctx.fillRect(250, 640, 240, 400);
  ctx.fillStyle = linear(ctx, 0, 800, 0, 1026, [rgba(GRANITE[0], 0), rgba(GRANITE[0], 0.6)]);
  ctx.fillRect(250, 800, 670, 240);
  ctx.fillStyle = linear(ctx, 700, 0, 904, 0, ['rgba(255,196,120,0)', 'rgba(255,196,120,0.14)']);
  ctx.fillRect(700, 640, 210, 400);
  // The lip of the top surface throws a soft shadow onto the face below it.
  const lip = [];
  for (let x = 270; x <= 896; x += 14) lip.push([x, yOn(BROW, x) + 3]);
  ctx.save();
  setShadow(ctx, { color: 'rgba(10,6,4,0.6)', blur: 8, x: 0, y: 5 });
  ctx.strokeStyle = rgba(GRANITE[0], 0.35);
  ctx.lineWidth = 3;
  ctx.stroke(pathOf(lip, { closed: false }));
  ctx.restore();
  // Cracks along some facet seams.
  for (const c of cells) {
    if (!rng.chance(0.4)) continue;
    const k = rng.int(0, c.pts.length - 1);
    const a = c.pts[k], b = c.pts[(k + 1) % c.pts.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 14) continue;
    piece(ctx, sliver([a, [(a[0] + b[0]) / 2 + rng.range(-2, 2), (a[1] + b[1]) / 2 + rng.range(-2, 2)], b], rng.range(0.8, 1.8)), { fill: rgba(GRANITE[0], 0.85) });
  }
  // Granite speckle: gold, dark and pale grains.
  flecks(ctx, 262, 640, 642, 390, 1300, rng.int(1, 1e6), { color: '#f0c870', max: 1.3, alpha: 0.75 });
  flecks(ctx, 262, 640, 642, 390, 1500, rng.int(1, 1e6), { color: '#000000', max: 1.2, alpha: 0.4 });
  flecks(ctx, 262, 640, 642, 390, 1100, rng.int(1, 1e6), { color: '#ece4d8', max: 0.9, alpha: 0.25 });
  // Moss on the top and along the front brow.
  const mossAt = [[296, -2], [322, -18], [350, -30], [764, -38], [800, -30], [834, -20], [862, -8], [420, -34], [884, 10]];
  for (const [mx, dy] of mossAt) {
    const my = yOn(BROW, mx) - 6 + dy;
    const rx = rng.range(16, 30), ry = rx * rng.range(0.32, 0.5);
    piece(ctx, blob(mx, my, rx, ry, rng, { n: 14, irregular: 0.45 }), {
      fill: vary(MOSS[rng.int(0, MOSS.length - 1)], rng, 0.06),
      torn: { amp: 1.6, freq: 0.3, fine: 0.8, seed: rng.int(1, 1e6), step: 2 },
      shadow: { color: 'rgba(0,0,0,0.35)', blur: 2, x: 0, y: 1.5 },
      bevel: { light, width: 1, hi: 0.3, lo: 0.1 },
    });
    flecks(ctx, mx - rx * 1.5, my - ry * 1.5, rx * 3, ry * 3, 12, rng.int(1, 1e6), { color: MOSS[3], max: 1.6, alpha: 0.85 });
  }
  ctx.restore();
  bevelBands(ctx, sil, { light, width: 1.6, hi: 0.34, lo: 0.3 });

  // Low sun catching the rounded top on the right.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,220,150,0.55)';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  TOP.filter(([x]) => x >= 560).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1.5) : ctx.moveTo(x, y + 1.5)));
  ctx.stroke();
  ctx.restore();

  // Gold-green grass fringe standing along the top edge (clear of the fox's paws).
  for (const [x0, x1, step] of [[284, 470, 18], [720, 886, 14]]) {
    for (let x = x0; x <= x1; x += step * rng.range(0.8, 1.2)) {
      const y = yOn(TOP.slice(1), x) + 5;
      drawTuft(ctx, { x, y, n: rng.int(4, 7), len: rng.range(28, 62), spread: 1.1, width: 0.07, lean: (x - 600) / 900 + rng.range(-0.2, 0.2), tones: GRASS, light, seed: rng.int(1, 1e6) });
    }
  }
  // A few short blades hanging over the front brow.
  for (const x of [318, 420, 760, 846]) {
    drawTuft(ctx, { x, y: yOn(BROW, x) + 4, n: 5, len: rng.range(18, 30), spread: 1.2, width: 0.08, lean: rng.range(-0.3, 0.3), tones: GRASS, light, seed: rng.int(1, 1e6) });
  }
}
