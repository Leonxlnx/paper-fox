// Star portal (s09): the circle of standing stones, the stone basin under the ring and
// the paved terrace with its steps down to the pool. Painters only: the scene bakes
// them into sprites. Everything is cut from weathered warm-grey stone paper, split
// into stacked blocks with cracks, chips, moss and climbing vines, and warmed on the
// side that faces the portal.

import { RNG } from '../core/rng.js';
import { piece, pathOf, bevelBands, linear, radial } from '../core/piece.js';
import { blob, ellipse, transform, TAU } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { mix, vary, rgba } from '../core/color.js';
import { clamp, lerp } from '../core/ease.js';
import { sliver, brush, boxOf } from '../elements/terrain-kit.js';
import { sparklePts } from '../elements/sky.js';

// Weathered warm sandstone-grey, crack to lit top (ref09).
export const STONE = {
  ramp: ['#2c2722', '#48413a', '#62594e', '#7c7262', '#968a76', '#b0a28a', '#c9b99a'],
  crack: '#1c1612',
  lip: '#d4c2a6',
  warm: '#ffc36e',
  cool: '#1c1830',
  moss: ['#4f5320', '#6e7228', '#8e9032', '#b0ad42'],
  vine: '#3d4a1c',
  leaf: ['#5d6e22', '#7d8c2c', '#a3a83a', '#c2bd4e'],
  bloom: ['#f4efe2', '#fbf6ea', '#efe6d2'],
  carve: { lit: '#fff3c4', base: '#f4cb70', shade: '#c48a3a' },
};

const pick = (ramp, t) => ramp[clamp(Math.round(t * (ramp.length - 1)), 0, ramp.length - 1)];

// A seam across a stone: a gently tilted, slightly jagged line from x0 to x1.
function seam(x0, x1, y, rng, { tilt = 0.06, jag = 3 } = {}) {
  const pts = [];
  const n = Math.max(3, Math.round((x1 - x0) / 14));
  const k = rng.range(-tilt, tilt);
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    pts.push([x, y + (x - x0) * k + rng.range(-jag, jag)]);
  }
  return pts;
}

// A meandering crack running mostly downward from (x, y) for len px.
function crackLine(x, y, len, rng, { wander = 0.5 } = {}) {
  const pts = [[x, y]];
  let a = Math.PI / 2 + rng.range(-0.4, 0.4);
  for (let d = 0; d < len; d += rng.range(6, 14)) {
    a += rng.range(-wander, wander);
    a = clamp(a, Math.PI / 2 - 1, Math.PI / 2 + 1);
    x += Math.cos(a) * 10; y += Math.sin(a) * 10;
    pts.push([x, y]);
  }
  return pts;
}

// Crescent outline: the outer disc minus a disc shifted along `rot` by `cut` radii.
// Both circles are sampled starting from the cut direction, so the kept part of each
// is one contiguous run: the outer arc from horn to horn, then the hole arc back.
//   rot   direction the crescent opens toward; cut: hole offset in radii
export function crescentPts(cx, cy, r, { rot = 0, cut = 0.45, inner = 0.92, n = 96 } = {}) {
  const ox = cx + Math.cos(rot) * r * cut, oy = cy + Math.sin(rot) * r * cut, ir = r * inner;
  const outer = [], hole = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    if (Math.hypot(p[0] - ox, p[1] - oy) > ir) outer.push(p);
    const q = [ox + Math.cos(a) * ir, oy + Math.sin(a) * ir];
    if (Math.hypot(q[0] - cx, q[1] - cy) < r) hole.push(q);
  }
  return [...outer, ...hole.reverse()];
}

// A carving inlaid in the stone: a raised gold paper crescent or four-point star.
function drawCarving(ctx, c, light) {
  const G = STONE.carve;
  const pts = c.kind === 'moon'
    ? crescentPts(c.x, c.y, c.r, { rot: c.rot ?? 0, cut: c.cut ?? 0.42 })
    : sparklePts(c.x, c.y, c.r, { tall: c.tall ?? 1.45, pinch: 0.62 });
  // A dark recess first, then the raised gold piece.
  piece(ctx, pts.map(([x, y]) => [x + 1.2, y + 1.8]), { fill: rgba('#1d1410', 0.55) });
  const path = piece(ctx, pts, {
    fill: radial(ctx, c.x - c.r * 0.3, c.y - c.r * 0.4, c.r * 0.1, c.r * 1.3, [[0, G.lit], [0.55, G.base], [1, G.shade]]),
    shadow: { color: 'rgba(20,12,6,0.6)', blur: 3, x: -light[0] * 2, y: 2.5 },
  });
  ctx.save();
  ctx.clip(path);
  flecks(ctx, c.x - c.r * 1.5, c.y - c.r * 1.5, c.r * 3, c.r * 3, Math.round(c.r * 5), `carve-${c.x}-${c.y}`, { color: '#fff6dc', max: 1, alpha: 0.5 });
  flecks(ctx, c.x - c.r * 1.5, c.y - c.r * 1.5, c.r * 3, c.r * 3, Math.round(c.r * 3), `carve-d-${c.x}-${c.y}`, { color: '#8a5a24', max: 0.9, alpha: 0.35 });
  ctx.restore();
  bevelBands(ctx, path, { light, width: 1.6, hi: 0.55, lo: 0.35, soft: 0.4 });
}

// Moss: torn olive patches with crumbs (on ledges and stone tops).
export function drawMossPatch(ctx, x, y, rx, ry, rng, light) {
  piece(ctx, blob(x, y, rx, ry, rng, { n: 16, irregular: 0.45 }), {
    fill: vary(rng.pick(STONE.moss), rng, 0.06),
    torn: { amp: 1.8, freq: 0.3, fine: 0.9, seed: rng.int(1, 1e6), step: 2 },
    shadow: { color: 'rgba(10,8,0,0.45)', blur: 2.5, x: 0, y: 1.8 },
    bevel: { light, width: 1, hi: 0.35, lo: 0.12 },
  });
  flecks(ctx, x - rx * 1.4, y - ry * 1.6, rx * 2.8, ry * 3.2, Math.round(rx * 1.2), rng.int(1, 1e6), { color: STONE.moss[3], max: 1.5, alpha: 0.85 });
}

// A climbing vine: a thin wandering stem with small leaves, now and then a white
// flower cluster. path: polyline the vine follows.
export function drawVine(ctx, path, rng, light, { leaf = 5, blooms = 0.12, width = 1.4 } = {}) {
  ctx.save();
  ctx.strokeStyle = STONE.vine;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(10,8,0,0.5)';
  ctx.shadowBlur = 2 * (ctx.__res || 1);
  ctx.shadowOffsetY = 1.2 * (ctx.__res || 1);
  ctx.beginPath();
  path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const segs = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 7));
    for (let s = 0; s < segs; s++) {
      const k = (s + rng.next()) / segs;
      const x = lerp(ax, bx, k), y = lerp(ay, by, k);
      const side = rng.sign();
      const a = Math.atan2(by - ay, bx - ax) + side * rng.range(0.7, 1.5);
      const L = leaf * rng.range(0.7, 1.3);
      const pts = ellipse(0, -L * 0.5, L * 0.32, L * 0.55, 8);
      piece(ctx, transform(pts, { x, y, rot: a + Math.PI / 2 }), {
        fill: vary(rng.pick(STONE.leaf), rng, 0.08),
        shadow: { color: 'rgba(10,8,0,0.45)', blur: 1.5, x: 0, y: 1 },
      });
      if (rng.chance(blooms)) drawBlossomCluster(ctx, x + side * 3, y, rng, light, rng.range(2.4, 3.6), rng.int(2, 4));
    }
  }
}

// A few small five-petal white blossoms (the flowers climbing the stones).
export function drawBlossomCluster(ctx, x, y, rng, light, r = 3, n = 3) {
  for (let k = 0; k < n; k++) {
    const fx = x + rng.range(-r * 2, r * 2), fy = y + rng.range(-r * 2, r * 2);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + rng.range(-0.1, 0.1);
      const rr = i % 2 === 0 ? r : r * 0.55;
      pts.push([fx + Math.cos(a) * rr, fy + Math.sin(a) * rr]);
    }
    piece(ctx, pts, { fill: rng.pick(STONE.bloom), smooth: true, shadow: { color: 'rgba(20,16,0,0.5)', blur: 1.5, x: 0, y: 1 } });
    ctx.fillStyle = '#e2b640';
    ctx.beginPath(); ctx.arc(fx, fy, r * 0.32, 0, TAU); ctx.fill();
  }
}

// One standing stone.
//   outline   clockwise polygon (film px)
//   portal    [x, y] of the portal light: that side is warmed, the far side cooled
//   carvings  [{ kind: 'moon' | 'star', x, y, r, rot }]
//   vines     [[x, y], ...] polylines; moss: 0..1; blocks: mean block height
//   glow      0..1 warm portal light baked onto the stone (radial, from the portal)
//   rimGlow   0..1 gold light catching the edge that faces the portal
export function drawStandingStone(ctx, { outline, portal, light, seed = 1, carvings = [], vines = [], moss = 0.6, blocks = 70, cracks = 1, tone = 0.5, glow = 0, glowR = 330, rimGlow = 0, vine = {} }) {
  const rng = new RNG(`stone:${seed}`);
  const b = boxOf(outline);
  const sil = piece(ctx, outline, { fill: pick(STONE.ramp, tone * 0.6) });
  const side = Math.sign(portal[0] - (b.x + b.w / 2)) || 1;   // +1: the portal is to the right
  ctx.save();
  ctx.clip(sil);

  // Stacked blocks: seams down the stone, some blocks split again vertically.
  const seams = [seam(b.x - 6, b.x + b.w + 6, b.y - 30, rng, { tilt: 0, jag: 0 })];
  const joints = [];
  for (let y = b.y + rng.range(0.4, 0.9) * blocks; y < b.y + b.h - 12; y += blocks * rng.range(0.55, 1.35)) {
    seams.push(seam(b.x - 6, b.x + b.w + 6, y, rng));
  }
  seams.push(seam(b.x - 6, b.x + b.w + 6, b.y + b.h + 30, rng, { tilt: 0, jag: 0 }));
  for (let i = 0; i < seams.length - 1; i++) {
    const top = seams[i], bot = seams[i + 1];
    const cells = [];
    if (rng.chance(0.55) && b.w > 50) {
      // Vertical split: two blocks side by side with a slanted joint.
      const sx = b.x + b.w * rng.range(0.3, 0.7), lean = rng.range(-8, 8);
      const split = (pts, left) => pts.filter(([x]) => (left ? x <= sx : x >= sx));
      const yT = top.reduce((m, p) => Math.abs(p[0] - sx) < Math.abs(m[0] - sx) ? p : m)[1];
      const yB = bot.reduce((m, p) => Math.abs(p[0] - sx) < Math.abs(m[0] - sx) ? p : m)[1];
      cells.push([...split(top, true), [sx + lean, yT], [sx - lean, yB], ...split(bot, true).reverse()]);
      cells.push([[sx + lean, yT], ...split(top, false), ...split(bot, false).reverse(), [sx - lean, yB]]);
      joints.push([[sx + lean, yT], [sx + rng.range(-2, 2), (yT + yB) / 2], [sx - lean, yB]]);
    } else cells.push([...top, ...bot.slice().reverse()]);
    for (const cell of cells) {
      const cb = boxOf(cell);
      const cx = cb.x + cb.w / 2;
      // Faces toward the portal are a touch paler; random sheets of slightly other paper.
      const toward = clamp(0.5 + ((cx - (b.x + b.w / 2)) / b.w) * side * 0.6, 0, 1);
      const t = clamp(tone + rng.range(-0.2, 0.22) + (toward - 0.5) * 0.25, 0.15, 0.95);
      const path = piece(ctx, cell, {
        fill: vary(pick(STONE.ramp, t), rng, 0.05),
        shadow: { color: 'rgba(18,10,8,0.55)', blur: 3, x: -light[0] * 1.5, y: 2.5 },
        bevel: { light, width: 1.3, hi: 0.22, lo: 0.18 },
      });
      brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.25, 0.25), amt: 0.22, scale: 0.7, seed: rng.int(1, 1e9) });
      // Relief: each block catches light on its top and falls into shade at its foot.
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = linear(ctx, 0, cb.y, 0, cb.y + cb.h, [[0, rgba('#f4e2bc', 0.16)], [0.25, rgba('#f4e2bc', 0)], [0.7, rgba('#140e0a', 0.06)], [1, rgba('#140e0a', 0.34)]]);
      ctx.fillRect(cb.x - 2, cb.y - 2, cb.w + 4, cb.h + 4);
      ctx.restore();
      // Dark joint under the block above, with a pale chipped lip along its top edge.
      const topEdge = cell.filter(([, py]) => py <= cb.y + 8);
      if (topEdge.length > 1 && cb.y > b.y + 4) {
        topEdge.sort((p, q) => p[0] - q[0]);
        piece(ctx, sliver(topEdge.map(([px, py]) => [px, py + 2]), 1.4), { fill: rgba(STONE.lip, 0.4) });
        piece(ctx, sliver(topEdge, 2.6), { fill: rgba(STONE.crack, 0.9) });
      }
    }
  }

  for (const j of joints) {
    piece(ctx, sliver(j.map(([px, py]) => [px + 1.6, py]), 1.2), { fill: rgba(STONE.lip, 0.35) });
    piece(ctx, sliver(j, 2.4), { fill: rgba(STONE.crack, 0.9) });
  }
  // Cracks: dark slivers with a pale lip, mostly vertical, a few branching.
  const nCracks = Math.round((b.h / 55) * cracks * (b.w / 80 + 0.5));
  for (let i = 0; i < nCracks; i++) {
    const x = b.x + rng.range(0.1, 0.9) * b.w, y = b.y + rng.range(0, 0.85) * b.h;
    const line = crackLine(x, y, rng.range(30, 130), rng);
    const w = rng.range(1.2, 2.8);
    const lines = [[line, w]];
    // Some cracks fork once part-way down.
    if (line.length > 4 && rng.chance(0.5)) {
      const [fx, fy] = line[rng.int(1, line.length - 3)];
      lines.push([crackLine(fx, fy, rng.range(18, 50), rng, { wander: 0.8 }), w * 0.7]);
    }
    for (const [ln, lw] of lines) {
      piece(ctx, sliver(ln, lw).map(([px, py]) => [px + 1.3, py + 1.2]), { fill: rgba(STONE.lip, 0.55) });
      piece(ctx, sliver(ln, lw), { fill: rgba(STONE.crack, 0.92) });
    }
  }

  // Chips knocked off the edges: small paler facets with a lit edge.
  for (let i = 0; i < Math.round(b.h / 40); i++) {
    const k = rng.int(0, outline.length - 1);
    const [px, py] = outline[k];
    const r = rng.range(5, 13);
    const pts = blob(px + rng.range(-4, 4), py + rng.range(-4, 4), r, r * rng.range(0.5, 1), rng, { n: 5, irregular: 0.4 });
    piece(ctx, pts, { fill: vary(pick(STONE.ramp, rng.range(0.6, 0.95)), rng, 0.05), bevel: { light, width: 1, hi: 0.3, lo: 0.2 } });
  }

  // Grit and gold specks.
  flecks(ctx, b.x, b.y, b.w, b.h, Math.round((b.w * b.h) / 140), rng.int(1, 1e6), { color: '#120c0a', max: 1.2, alpha: 0.45 });
  flecks(ctx, b.x, b.y, b.w, b.h, Math.round((b.w * b.h) / 190), rng.int(1, 1e6), { color: '#e8dccb', max: 1, alpha: 0.35 });
  flecks(ctx, b.x, b.y, b.w, b.h, Math.round((b.w * b.h) / 900), rng.int(1, 1e6), { color: '#e9c46a', max: 1.2, alpha: 0.7 });

  // Light: the side facing the portal glows warm, the far side falls into cool shade.
  const x0 = side > 0 ? b.x : b.x + b.w, x1 = side > 0 ? b.x + b.w : b.x;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = linear(ctx, x0, 0, x1, 0, [[0, rgba(STONE.cool, 0.42)], [0.45, rgba(STONE.cool, 0.08)], [0.75, rgba(STONE.warm, 0.05)], [1, rgba(STONE.warm, 0.32)]]);
  ctx.fillRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
  const dy = portal[1] - (b.y + b.h / 2);
  ctx.fillStyle = linear(ctx, 0, b.y, 0, b.y + b.h, [[0, rgba(STONE.warm, dy < 0 ? 0.18 : 0)], [0.5, rgba(STONE.warm, 0.06)], [1, rgba('#1a1210', 0.4)]]);
  ctx.fillRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
  if (glow > 0) {
    // The portal's own light: strongest on the faces right beside the ring, a warm
    // gold rather than a pale wash so the stone keeps its cracks and shadows.
    const g = ctx.createRadialGradient(portal[0], portal[1], 0, portal[0], portal[1], glowR);
    g.addColorStop(0, rgba('#ffd27a', Math.min(0.5, 0.34 * glow)));
    g.addColorStop(0.32, rgba('#ffbf5c', 0.18 * glow));
    g.addColorStop(0.65, rgba('#f0a044', 0.07 * glow));
    g.addColorStop(1, rgba('#f0a044', 0));
    ctx.fillStyle = g;
    ctx.fillRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
    // The inner face: a band of gold light on the side that looks into the ring.
    ctx.fillStyle = linear(ctx, x1, 0, x0, 0, [[0, rgba('#ffcf6a', 0.38 * glow)], [0.3, rgba('#ffbe58', 0.14 * glow)], [0.6, rgba('#ffbe58', 0)]]);
    ctx.fillRect(b.x - 5, Math.max(b.y - 5, portal[1] - glowR * 0.9), b.w + 10, Math.min(b.h + 10, glowR * 1.8));
  }
  ctx.globalCompositeOperation = 'source-over';
  // Gold light catching the edge that faces the portal.
  if (rimGlow > 0) {
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = linear(ctx, x0, 0, x1, 0, [[0, rgba('#ffe7a8', 0)], [0.55, rgba('#ffe7a8', 0)], [0.85, rgba('#ffd27a', 0.25 * rimGlow)], [1, rgba('#ffe7a8', 0.6 * rimGlow)]]);
    ctx.stroke(sil);
  }
  // Soft gold halo in the stone around each inlaid carving.
  for (const c of carvings) {
    const hr = c.r * 2.1;
    ctx.fillStyle = radial(ctx, c.x, c.y, c.r * 0.4, hr, [[0, rgba('#ffcc6e', 0.62)], [0.5, rgba('#f2ac4c', 0.24)], [1, rgba('#f2ac4c', 0)]]);
    ctx.fillRect(c.x - hr, c.y - hr, hr * 2, hr * 2);
  }

  // Moss on the top and on block ledges.
  const nMoss = Math.round(moss * (3 + b.h / 60));
  for (let i = 0; i < nMoss; i++) {
    const s = seams[rng.int(0, seams.length - 2)];
    const [mx, my] = rng.chance(0.4) ? [b.x + rng.next() * b.w, b.y + rng.range(0, 14)] : s[rng.int(0, s.length - 1)];
    drawMossPatch(ctx, mx, my + 2, rng.range(6, 16), rng.range(3, 6), rng, light);
  }
  ctx.restore();

  for (const c of carvings) drawCarving(ctx, c, light);
  for (const v of vines) drawVine(ctx, v, rng, light, vine);
  bevelBands(ctx, sil, { light: [side * 0.8, -0.6], width: 1.8, hi: 0.32, lo: 0.3, soft: 0.5 });
  return sil;
}

// The stone basin under the ring: a faceted bowl full of light.
//   x, y   centre of the rim; rx, ry: rim radii; h: bowl height to the foot
export function drawBasin(ctx, { x, y, rx = 100, ry = 14, h = 58, light, seed = 'basin' }) {
  const rng = new RNG(seed);
  // Foot and plinth.
  piece(ctx, [[x - rx * 0.62, y + h - 14], [x + rx * 0.62, y + h - 14], [x + rx * 0.7, y + h + 2], [x - rx * 0.7, y + h + 2]], {
    fill: STONE.ramp[2], torn: { amp: 1, freq: 0.2, seed: 3 }, shadow: { color: 'rgba(10,6,4,0.5)', blur: 4, x: 0, y: 3 },
  });
  // Bowl body: a cup tapering to the foot, cut into vertical blocks.
  const body = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (i / 24);
    body.push([x - Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  body.push([x + rx * 0.72, y + h - 12], [x - rx * 0.72, y + h - 12]);
  const bp = piece(ctx, body, { fill: STONE.ramp[3], shadow: { color: 'rgba(10,6,4,0.55)', blur: 5, x: -light[0] * 2, y: 3 } });
  ctx.save();
  ctx.clip(bp);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const xa = x - rx + u0 * rx * 2, xb = x - rx + u1 * rx * 2;
    const xa2 = x - rx * 0.72 + u0 * rx * 1.44, xb2 = x - rx * 0.72 + u1 * rx * 1.44;
    const mid = (u0 + u1) / 2;
    // Facets turn away from us toward the sides; the light comes from the bowl above.
    const t = clamp(0.62 - Math.abs(mid - 0.5) * 0.7 + rng.range(-0.12, 0.12), 0.2, 0.9);
    const yTop = y + rng.range(10, 18);
    const cell = [[xa, yTop - 20], [xb, yTop - 20], [xb2 + rng.range(-3, 3), y + h], [xa2 + rng.range(-3, 3), y + h]];
    const path = piece(ctx, cell, { fill: vary(pick(STONE.ramp, t), rng, 0.05), shadow: { color: 'rgba(0,0,0,0.4)', blur: 2.5, x: 1.5, y: 0 }, bevel: { light: [0, -1], width: 1.2, hi: 0.2, lo: 0.15 } });
    brush(ctx, path, { angle: Math.PI / 2, amt: 0.2, scale: 0.6, seed: rng.int(1, 1e9) });
    // A horizontal joint across the bowl.
    piece(ctx, [[xa, y + h * 0.55 + rng.range(-3, 3)], [xb, y + h * 0.55 + rng.range(-3, 3)], [xb, y + h * 0.55 + 2], [xa, y + h * 0.55 + 2]], { fill: rgba(STONE.crack, 0.55) });
  }
  // Light pouring over the lip from the bowl.
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [[0, rgba('#ffd98a', 0.55)], [0.35, rgba('#ffc26a', 0.12)], [1, rgba('#1a1010', 0.35)]]);
  ctx.fillRect(x - rx - 4, y - 4, rx * 2 + 8, h + 8);
  flecks(ctx, x - rx, y, rx * 2, h, 260, rng.int(1, 1e6), { color: '#140c0a', max: 1.1, alpha: 0.4 });
  ctx.restore();
  bevelBands(ctx, bp, { light: [0, -1], width: 1.6, hi: 0.35, lo: 0.3 });
  // The rim: a thick lit ring of stone around a pool of light.
  const rim = piece(ctx, ellipse(x, y, rx, ry + 2, 64), {
    fill: linear(ctx, 0, y - ry, 0, y + ry, ['#e8c890', '#c7a274', '#8a6a4c']),
    shadow: { color: 'rgba(10,6,4,0.4)', blur: 3, x: 0, y: 2 },
  });
  bevelBands(ctx, rim, { light: [0, -1], width: 1.4, hi: 0.5, lo: 0.25 });
  piece(ctx, ellipse(x, y - 1, rx * 0.86, ry * 0.62, 48), { fill: radial(ctx, x, y - 1, 2, rx * 0.86, [[0, '#fffbe6'], [0.4, '#ffe9a8'], [1, '#f2b85a']]) });
}

// The paved terrace in front of the stones and the steps down to the pool.
//   terrace   { x0, x1, y, depth, front }  top surface from y to y + depth, front face below
//   steps     [{ x0, x1, y, tread, rise }] from the top step down
export function drawTerrace(ctx, { terrace, steps, light, glowX, seed = 'terrace' }) {
  const rng = new RNG(seed);
  const slabRow = (x0, x1, yTop, depth, rise, warmth) => {
    // Front face: a row of dark cut blocks.
    let x = x0;
    while (x < x1 - 4) {
      const w = Math.min(x1 - x, rng.range(55, 120));
      const t = clamp(0.22 + rng.range(-0.1, 0.12) + warmth * 0.2, 0.1, 0.9);
      const p = piece(ctx, [[x + 1, yTop + depth - 1], [x + w - 1, yTop + depth - 1 + rng.range(-1, 1)], [x + w - 1 + rng.range(-1, 1), yTop + depth + rise], [x + 1, yTop + depth + rise]], {
        fill: vary(pick(STONE.ramp, t), rng, 0.05),
        shadow: { color: 'rgba(10,6,4,0.55)', blur: 3, x: 0, y: 2.5 },
        bevel: { light, width: 1.2, hi: 0.18, lo: 0.2 },
      });
      brush(ctx, p, { angle: 0.05, amt: 0.25, scale: 0.6, seed: rng.int(1, 1e9) });
      x += w;
    }
    // Tread: pale slabs lit by the portal, cracked into pieces.
    x = x0 - 2;
    while (x < x1) {
      const w = Math.min(x1 + 2 - x, rng.range(60, 150));
      const glow = clamp(1 - Math.abs(x + w / 2 - glowX) / 470, 0, 1);
      const base = mix(pick(STONE.ramp, clamp(0.58 + rng.range(-0.1, 0.1), 0, 1)), '#eeb458', glow * 0.56);
      const p = piece(ctx, [[x + 1, yTop + rng.range(-1, 1)], [x + w - 1, yTop + rng.range(-1, 1)], [x + w + 1, yTop + depth], [x - 1, yTop + depth]], {
        fill: linear(ctx, 0, yTop, 0, yTop + depth, [mix(base, '#fff0c8', 0.3 * glow + 0.05), base, mix(base, '#6a4a30', 0.25)]),
        shadow: { color: 'rgba(10,6,4,0.45)', blur: 2.5, x: 0, y: 2 },
        bevel: { light: [0, -1], width: 1.4, hi: 0.4, lo: 0.2 },
      });
      brush(ctx, p, { angle: 0, amt: 0.22, scale: 0.6, seed: rng.int(1, 1e9) });
      if (rng.chance(0.5)) {
        const cx = x + w * rng.range(0.25, 0.75);
        piece(ctx, sliver([[cx, yTop + 1], [cx + rng.range(-6, 6), yTop + depth * 0.5], [cx + rng.range(-8, 8), yTop + depth - 1]], 0.8), { fill: rgba(STONE.crack, 0.6) });
      }
      x += w;
    }
  };
  const T = terrace;
  slabRow(T.x0, T.x1, T.y, T.depth, T.front, 0.4);
  // Paving joints on the terrace top, receding toward the stones.
  steps.forEach((s, i) => slabRow(s.x0, s.x1, s.y, s.tread, s.rise, 0.2 - i * 0.1));
  flecks(ctx, T.x0, T.y, T.x1 - T.x0, steps[steps.length - 1].y + 40 - T.y, 900, rng.int(1, 1e6), { color: '#1a100c', max: 1.1, alpha: 0.35 });
}
