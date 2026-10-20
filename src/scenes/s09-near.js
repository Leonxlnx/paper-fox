// Star portal (s09): the stone circle and everything in front of it. Standing stones
// (painted by s09-stones.js), the basin and the terrace with its steps, the flower
// clusters at the feet of the stones, the fox's rock, and the foreground rocks,
// stepping stones and flower beds that frame the bottom of the shot.

import { RNG } from '../core/rng.js';
import { lerp, osc, smoothstep } from '../core/ease.js';
import { drawGlow } from '../elements/sky.js';
import { piece, linear } from '../core/piece.js';
import { flecks } from '../core/paper.js';
import { TAU, transform } from '../core/geom.js';
import { vary } from '../core/color.js';
import { drawStandingStone, drawBasin, drawTerrace, drawMossPatch, drawBlossomCluster } from './s09-stones.js';
import { addBoulders } from '../elements/terrain.js';
import { addFlowerBed, FLOWER_BEDS } from '../elements/flora.js';
import { drawAstilbe, drawDaisy, drawTansy } from '../elements/flora-flowers.js';
import { drawShrub } from '../elements/flora-foliage.js';
import { drawStem, FLORA_PAPER } from '../elements/flora-kit.js';

const tagAll = (layers, ...tags) => {
  for (const L of [].concat(layers)) if (L) L.tags = [...(L.tags || []), ...tags];
  return layers;
};

// Pink coneflowers of ref09 (magenta petals, orange cones).
const PINK = {
  echinacea: { petals: ['#b8286e', '#c8327c', '#d4408a', '#de5296', '#e866a4'], petalDark: '#701040', petalLight: '#f6a0c8', cone: '#f08a1e', coneLight: '#ffb44a', coneDark: '#b04a06' },
};

// A standing stone outline: a jagged top from (x0, yL) to (x1, yR), sides flaring a
// little toward the foot at yB. Clockwise from the top left.
function stoneOutline(x0, x1, yL, yR, yB, seed, { notch = 0.5, flare = 5, jag = 1 } = {}) {
  const rng = new RNG(`s09-outline:${seed}`);
  const pts = [];
  const n = Math.max(3, Math.round((x1 - x0) / 22));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    let y = lerp(yL, yR, u) + rng.range(-2.5, 2.5);
    if (i > 0 && i < n && rng.chance(notch)) y += rng.range(3, 11) * jag;
    pts.push([lerp(x0 + 2, x1 - 2, u), y]);
  }
  const m = Math.max(4, Math.round((yB - yR) / 55));
  for (let i = 1; i <= m; i++) { const u = i / m; pts.push([x1 + rng.range(-2.5, 2.5) + flare * u, lerp(yR + 7, yB, u)]); }
  for (let i = m; i >= 1; i--) { const u = i / m; pts.push([x0 + rng.range(-2.5, 2.5) - flare * u, lerp(yL + 7, yB, u)]); }
  return pts;
}

// A vine wandering down a stone face.
function vinePath(x0, y0, x1, y1, seed, amp = 6) {
  const rng = new RNG(`s09-vine:${seed}`);
  const n = Math.max(5, Math.round(Math.abs(y1 - y0) / 18));
  const ph = rng.range(0, TAU);
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return [lerp(x0, x1, u) + Math.sin(ph + u * 7.5) * amp + rng.range(-1.5, 1.5), lerp(y0, y1, u)];
  });
}

// Stones traced from ref09 (film px). The inner pair frame the ring.
const STONES = [
  { id: 's1', z: 1262, x0: 690, x1: 768, yL: 386, yR: 378, yB: 612, tone: 0.5, moss: 1.2, glow: 0.3, glowR: 520, rimGlow: 0.35,
    vines: [[742, 384, 752, 520, 6], [700, 392, 696, 470, 16]], blooms: [[744, 396], [700, 404]] },
  { id: 's6', z: 1262, x0: 1430, x1: 1500, yL: 328, yR: 322, yB: 604, tone: 0.5, moss: 1.2, glow: 0.3, glowR: 520, rimGlow: 0.35,
    carvings: [{ kind: 'star', x: 1466, y: 420, r: 12 }],
    vines: [[1440, 330, 1436, 470, 7], [1492, 330, 1496, 420, 17]], blooms: [[1442, 342], [1492, 344]] },
  { id: 'a', z: 1232, x0: 812, x1: 920, yL: 230, yR: 210, yB: 620, tone: 0.48, moss: 1.1, glow: 0.5, glowR: 380, rimGlow: 0.6,
    carvings: [{ kind: 'moon', x: 880, y: 384, r: 35, rot: 0, cut: 0.44 }, { kind: 'star', x: 874, y: 470, r: 21 }, { kind: 'star', x: 866, y: 292, r: 10 }],
    vines: [[905, 222, 912, 430, 8], [822, 232, 818, 360, 9]], blooms: [[906, 232], [912, 300], [824, 240], [818, 330], [910, 410]] },
  { id: 'b', z: 1236, x0: 920, x1: 1016, yL: 150, yR: 130, yB: 616, tone: 0.52, moss: 1.1, glow: 0.75, glowR: 330, rimGlow: 1,
    vines: [[1000, 150, 990, 470, 10], [935, 152, 944, 300, 11]], blooms: [[996, 168], [1003, 206], [944, 162], [990, 262], [998, 330], [940, 230], [992, 420]] },
  { id: 'c', z: 1236, x0: 1218, x1: 1280, yL: 262, yR: 256, yB: 616, tone: 0.52, moss: 1.1, glow: 0.75, glowR: 330, rimGlow: 1,
    vines: [[1224, 268, 1232, 500, 12], [1272, 266, 1268, 360, 18]], blooms: [[1226, 280], [1230, 360], [1270, 276], [1232, 450]] },
  { id: 'd', z: 1232, x0: 1278, x1: 1382, yL: 194, yR: 198, yB: 620, tone: 0.48, moss: 1.1, glow: 0.5, glowR: 380, rimGlow: 0.6,
    carvings: [{ kind: 'moon', x: 1328, y: 400, r: 33, rot: Math.PI, cut: 0.44 }, { kind: 'star', x: 1336, y: 478, r: 19 }, { kind: 'star', x: 1338, y: 328, r: 11 }],
    vines: [[1290, 200, 1286, 380, 13], [1372, 204, 1378, 330, 14]], blooms: [[1290, 212], [1374, 220], [1288, 300], [1376, 290]] },
  // Short broken stones flanking the basin.
  { id: 'b1', z: 1206, x0: 884, x1: 952, yL: 530, yR: 522, yB: 622, tone: 0.66, moss: 0.9, notch: 0.7, glow: 1, glowR: 300, rimGlow: 0.8 },
  { id: 'b2', z: 1206, x0: 1254, x1: 1312, yL: 550, yR: 546, yB: 622, tone: 0.66, moss: 0.9, notch: 0.7, glow: 1, glowR: 300, rimGlow: 0.8 },
];

// The stone circle, the basin and the terrace.
export function addStones(S, { portal }) {
  const L = S.light;
  const out = [];
  const byZ = new Map();
  for (const st of STONES) {
    const outline = stoneOutline(st.x0, st.x1, st.yL, st.yR, st.yB, st.id, { notch: st.notch ?? 0.6, jag: st.yB - Math.min(st.yL, st.yR) > 300 ? 1.9 : 1.2 });
    st.outline = outline;
    const top = Math.min(st.yL, st.yR);
    const s = S.sprite({
      name: `s09-stone-${st.id}`, x: st.x0 - 30, y: top - 30, w: st.x1 - st.x0 + 60, h: st.yB - top + 50,
      mat: [{ tex: 'stone', amt: 0.9 }, { tex: 'crumple', amt: 0.45, scale: 0.4 }], light: L,
      edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.6 }, shadow: { blur: 12 },
      draw(ctx) {
        drawStandingStone(ctx, {
          outline, portal: [portal.x, portal.y], light: L, seed: st.id, tone: st.tone, moss: st.moss,
          carvings: st.carvings || [], blocks: 40, cracks: 2.1,
          glow: st.glow || 0, glowR: st.glowR, rimGlow: st.rimGlow || 0, vine: { leaf: 9.5, blooms: 0.32, width: 2.2 },
          vines: (st.vines || []).map(([x0, y0, x1, y1, sd]) => vinePath(x0, y0, x1, y1, sd)),
        });
        const br = new RNG(`s09-bloom:${st.id}`);
        for (const [bx, by] of st.blooms || []) drawBlossomCluster(ctx, bx, by, br, L, 4.2, 5);
      },
    });
    if (!byZ.has(st.z)) byZ.set(st.z, []);
    byZ.get(st.z).push({ s });
  }
  for (const [z, sprites] of byZ) out.push(S.add({ name: `s09-stones-${z}`, z, sprites }));
  // Portal light washing the inner faces of the stones (breathing with the ring).
  const lit = STONES.filter((st) => (st.rimGlow || 0) >= 0.5);
  for (const z of [...new Set(lit.map((st) => st.z))]) {
    const list = lit.filter((st) => st.z === z).map((st) => {
      const path = new Path2D();
      st.outline.forEach(([px, py], i) => (i ? path.lineTo(px, py) : path.moveTo(px, py)));
      path.closePath();
      const side = Math.sign(portal.x - (st.x0 + st.x1) / 2) || 1;
      return { st, path, edge: side > 0 ? st.x1 : st.x0, far: side > 0 ? st.x0 : st.x1 };
    });
    out.push(S.add({
      name: `s09-stone-wash-${z}`, z, order: 1, blend: 'color-dodge',
      render(ctx, t) {
        const b = 1 + 0.1 * osc(t, 4.6, 0.15) + 0.25 * smoothstep(2.75, 3.75, t);
        for (const { st, path, edge, far } of list) {
          ctx.save();
          ctx.clip(path);
          const k = st.rimGlow * b;
          const g = ctx.createLinearGradient(edge, 0, lerp(edge, far, 0.75), 0);
          g.addColorStop(0, `rgba(124,84,32,${Math.min(1, 0.55 * k)})`); g.addColorStop(0.3, `rgba(110,72,26,${0.4 * k})`); g.addColorStop(1, 'rgba(110,72,26,0)');
          ctx.fillStyle = g;
          ctx.fillRect(Math.min(edge, far) - 4, portal.y - portal.R * 2.2, Math.abs(far - edge) + 8, portal.R * 4.4);
          ctx.restore();
        }
      },
    }));
  }
  // The inlaid gold carvings glow softly, breathing with the portal.
  const carvings = STONES.flatMap((st) => (st.carvings || []).map((c) => ({ ...c, z: st.z })));
  for (const z of [...new Set(carvings.map((c) => c.z))]) {
    const list = carvings.filter((c) => c.z === z);
    out.push(S.add({
      name: `s09-carve-glow-${z}`, z: z - 0.5, blend: 'lighter',
      render(ctx, t) {
        const b = 1 + 0.12 * osc(t, 4.6, 0.15) + 0.2 * smoothstep(2.75, 3.75, t);
        for (const c of list) {
          drawGlow(ctx, c.x, c.y, c.r * 2.8, '#ffb84a', 0.32 * b, { falloff: 'soft' });
          drawGlow(ctx, c.x, c.y, c.r * 1.2, '#ffe39a', 0.28 * b, { falloff: 'tight' });
        }
      },
    }));
  }

  // Terrace and steps down to the pool (behind the stones so they stand on it).
  out.push(S.plane(1246, {
    name: 's09-terrace', x: 830, y: 570, w: 560, h: 200, mat: 'stone', light: L, shadow: { blur: 10 },
    draw(ctx) {
      drawTerrace(ctx, {
        terrace: { x0: 850, x1: 1370, y: 600, depth: 24, front: 14 },
        steps: [
          { x0: 995, x1: 1225, y: 640, tread: 13, rise: 12 },
          { x0: 985, x1: 1235, y: 665, tread: 13, rise: 12 },
          { x0: 975, x1: 1245, y: 690, tread: 13, rise: 12 },
          { x0: 965, x1: 1255, y: 715, tread: 13, rise: 12 },
        ],
        light: L, glowX: portal.x - 30,
      });
    },
  }));
  // Basin under the ring.
  out.push(S.plane(1195, {
    name: 's09-basin', x: portal.x - 124, y: 520, w: 248, h: 110, mat: 'stone', light: L, shadow: { blur: 10 },
    draw(ctx) { drawBasin(ctx, { x: portal.x, y: 556, rx: 100, ry: 14, h: 56, light: L }); },
  }));
  // Rubble blocks at the sides of the steps.
  out.push(addBoulders(S, { name: 's09-rubble', z: 1200, palette: 'arch', light: L, moss: 0.5, rocks: [
    { x: 940, y: 742, w: 96, h: 66, shape: 'block', seed: 21 },
    { x: 1290, y: 748, w: 110, h: 72, shape: 'block', seed: 22 },
    { x: 1360, y: 640, w: 64, h: 50, shape: 'block', seed: 23 },
    { x: 846, y: 648, w: 70, h: 46, shape: 'block', seed: 24 },
  ] }));
  return tagAll(out, 'stones');
}

// Item helpers for flower clusters.
const daisy = (x, y, h, r, lean = 0, seed = 1) => ({ type: 'daisy', base: [x, y], head: [x + lean, y - h], r, seed });
const tansy = (x, y, h, r, lean = 0, seed = 1) => ({ type: 'tansy', base: [x, y], head: [x + lean, y - h], r, seed });
const astilbe = (x, y, h, w, lean = 0, seed = 1) => ({ type: 'astilbe', x, y, h, w, lean, seed });
const shrub = (x, y, w, h, leaf, seed = 1) => ({ type: 'shrub', x, y, w, h, leaf, seed });

const clump = (x, y, w, h, plumes, whites, seed) => ({ type: 'clump', x, y, w, h, plumes, whites, seed });
const CLUMP = {
  reds: [['#b8242c', '#c8302a', '#d8442c'], ['#d8442c', '#e65e2e', '#f07c34'], ['#c42a3a', '#d63c46', '#e45a50']],
  greens: ['#2f4a1e', '#3f5e26', '#56782e', '#76963a'],
};

// A lush flower clump of ref09: a fan of pointed leaves, red-orange astilbe plumes,
// white blossoms and a few yellow buttons.
function drawClump(ctx, { x, y, w, h, plumes = 3, whites = 2, seed = 1 }, light) {
  const rng = new RNG(`s09-clump:${seed}`);
  const res = ctx.__res || 1;
  const nLeaf = Math.round(w / 4.5);
  for (let i = 0; i < nLeaf; i++) {
    const lx = x + rng.range(-0.5, 0.5) * w;
    const a = -Math.PI / 2 + ((lx - x) / w) * 1.7 + rng.range(-0.3, 0.3);
    const L = rng.range(0.3, 0.6) * h, W = L * rng.range(0.16, 0.26);
    piece(ctx, transform([[0, 0], [W, -L * 0.42], [0, -L], [-W, -L * 0.42]], { x: lx, y: y + rng.range(-3, 3), rot: a + Math.PI / 2 }), {
      fill: vary(rng.pick(CLUMP.greens), rng, 0.06),
      shadow: { color: 'rgba(8,12,2,0.5)', blur: 2.5, x: 0, y: 1.5 },
      bevel: { light, width: 1, hi: 0.3, lo: 0.15 },
    });
  }
  for (let p = 0; p < plumes; p++) {
    const px = x + rng.range(-0.38, 0.38) * w, ph = h * rng.range(0.6, 1), pw = Math.min(w * 0.32, ph * 0.4);
    const by = y - h * 0.18, ty = by - ph * 0.8, lean = rng.range(-0.14, 0.14) * ph;
    drawStem(ctx, [[px, y], [px + lean * 0.5, by], [px + lean, ty]], { width: 1.4 });
    const col = rng.pick(CLUMP.reds);
    ctx.save();
    ctx.shadowColor = 'rgba(30,6,0,0.5)'; ctx.shadowBlur = 1.5 * res; ctx.shadowOffsetY = 1 * res;
    const n = Math.round(ph * 1.3);
    for (let k = 0; k < n; k++) {
      const u = Math.pow(rng.next(), 0.75);
      const yy = lerp(ty, by, u), half = pw * 0.5 * (0.18 + 0.82 * u);
      const xx = px + lean * (1 - u) + rng.range(-half, half);
      ctx.fillStyle = vary(rng.pick(col), rng, 0.06);
      ctx.beginPath(); ctx.arc(xx, yy, rng.range(1.5, 2.7), 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,190,120,0.75)';
    for (let k = 0; k < n * 0.3; k++) {
      const u = rng.next(), yy = lerp(ty, by, u), half = pw * 0.4 * (0.18 + 0.82 * u);
      ctx.beginPath(); ctx.arc(px + lean * (1 - u) + rng.range(-half, half), yy, rng.range(0.7, 1.2), 0, TAU); ctx.fill();
    }
  }
  for (let k = 0; k < whites; k++) drawBlossomCluster(ctx, x + rng.range(-0.4, 0.4) * w, y - rng.range(0.25, 0.65) * h, rng, light, rng.range(4, 5.4), rng.int(3, 5));
  ctx.fillStyle = '#e8b830';
  for (let k = 0; k < 5; k++) {
    const bx = x + rng.range(-0.45, 0.45) * w, by = y - rng.range(0.2, 0.55) * h;
    ctx.beginPath(); ctx.arc(bx, by, rng.range(2.2, 3.4), 0, TAU); ctx.fill();
  }
}

// Paint one cluster item (static midground flowers).
function drawItem(ctx, it, light) {
  const o = { light, seed: it.seed };
  if (it.type === 'clump') drawClump(ctx, it, light);
  else if (it.type === 'shrub') {
    // Yellow-green moss mats with a few leafy sprigs (cheap stand-in for a shrub).
    const rng = new RNG(`s09-mat:${it.seed}`);
    const n = Math.max(3, Math.round(it.w / 16));
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      drawMossPatch(ctx, it.x + (u - 0.5) * it.w + rng.range(-6, 6), it.y - rng.range(0, it.h * 0.55) * Math.sin(Math.PI * u), rng.range(10, 19), rng.range(5, 10), rng, light);
    }
  }
  else if (it.type === 'astilbe') drawAstilbe(ctx, { ...o, x: it.x, y: it.y, h: it.h, w: it.w, lean: it.lean });
  else {
    const [bx, by] = it.base, [hx, hy] = it.head;
    drawStem(ctx, [[bx, by], [(bx + hx) / 2 + (hx - bx) * 0.2, (by + hy) / 2], [hx, hy]], { width: 2 });
    if (it.type === 'daisy') drawDaisy(ctx, { ...o, x: hx, y: hy, r: it.r });
    else drawTansy(ctx, { ...o, x: hx, y: hy, r: it.r });
  }
}

// Flower clusters around the stones, by the steps and on the ledges.
export function addMidFlowers(S) {
  const out = [];
  // Midground clusters are static: each group is baked into one sprite.
  const bed = (z, rows, seed) => {
    const items = rows.flat();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const it of items) {
      const [bx, by] = it.base || [it.x, it.y];
      const hw = (it.w || it.r * 2) / 2 + 30;
      const hh = it.h || by - it.head[1] + it.r;
      x0 = Math.min(x0, bx - hw); x1 = Math.max(x1, bx + hw);
      y0 = Math.min(y0, by - hh - 30); y1 = Math.max(y1, by + 24);
    }
    out.push(S.plane(z, {
      name: `s09-mid-${seed}`, x: x0, y: y0, w: x1 - x0, h: y1 - y0, mat: FLORA_PAPER, light: S.light, edge: false, shadow: { blur: 7, alpha: 0.5 },
      draw(ctx) { for (const it of items) drawItem(ctx, it, S.light); },
    }));
  };
  // At the feet of the stones (in front of the stones, behind the basin).
  bed(1198, [
    [shrub(735, 622, 150, 44, 8, 1), shrub(850, 630, 110, 36, 7, 2), shrub(1388, 630, 130, 40, 8, 3), shrub(1478, 616, 150, 44, 8, 4)],
    [astilbe(760, 626, 78, 30, 0.05, 11), astilbe(836, 634, 62, 24, 0.12, 12), astilbe(1396, 632, 84, 30, -0.04, 13), astilbe(1446, 622, 64, 26, -0.1, 14),
      astilbe(708, 620, 60, 24, -0.08, 15), astilbe(1512, 616, 70, 28, 0.06, 16)],
    [astilbe(782, 630, 70, 26, -0.06, 17), astilbe(872, 636, 56, 22, 0.08, 18), astilbe(1424, 634, 74, 28, 0.05, 19), astilbe(1360, 638, 54, 22, -0.1, 20),
      astilbe(966, 640, 44, 18, -0.05, 120), astilbe(1262, 642, 46, 18, 0.06, 121)],
    [daisy(786, 640, 26, 7, 2, 21), daisy(806, 636, 34, 8, -3, 22), daisy(722, 630, 22, 6, 1, 23), daisy(1418, 640, 30, 8, 3, 24),
      daisy(1370, 638, 24, 7, -2, 25), daisy(1470, 630, 28, 7, 2, 26), tansy(868, 640, 30, 6, 2, 27), tansy(1360, 640, 28, 6, -2, 28),
      daisy(744, 634, 30, 7, -2, 122), daisy(828, 644, 24, 7, 2, 123), daisy(902, 646, 20, 6, -1, 124), daisy(1336, 646, 22, 6, 2, 125),
      daisy(1444, 638, 22, 6, -2, 126), daisy(1496, 626, 26, 7, 2, 127), daisy(980, 648, 18, 6, 1, 128), daisy(1246, 648, 18, 6, -1, 129),
      tansy(760, 636, 34, 6, -2, 130), tansy(1400, 640, 30, 6, 2, 131), tansy(1486, 630, 26, 6, -1, 132)],
    [clump(742, 630, 92, 84, 3, 2, 201), clump(822, 638, 104, 92, 4, 1, 202), clump(902, 642, 72, 62, 2, 2, 203), clump(868, 606, 70, 60, 2, 1, 204),
      clump(1328, 642, 84, 78, 3, 1, 205), clump(1410, 634, 104, 94, 4, 2, 206), clump(1490, 624, 92, 82, 2, 3, 207), clump(1352, 604, 70, 64, 2, 1, 208)],
  ], 's09-mid-stones');
  // Beside the steps (in front of the rubble).
  bed(1186, [
    [shrub(905, 752, 120, 40, 8, 31), shrub(1318, 756, 130, 42, 8, 32)],
    [astilbe(918, 756, 70, 28, 0.06, 33), astilbe(960, 760, 54, 22, 0.12, 34), astilbe(1290, 760, 74, 28, -0.06, 35), astilbe(1340, 762, 58, 24, -0.12, 36)],
    [daisy(888, 764, 26, 8, -2, 37), daisy(940, 766, 22, 7, 2, 38), daisy(1268, 768, 26, 8, 2, 39), daisy(1318, 770, 30, 8, -2, 40), daisy(1362, 768, 22, 7, 1, 41)],
    [clump(902, 752, 104, 92, 3, 3, 211), clump(968, 760, 60, 56, 1, 2, 212), clump(1262, 762, 72, 62, 2, 2, 213), clump(1334, 760, 112, 98, 4, 2, 214)],
  ], 's09-mid-steps');
  // The right bank by the lower ledge, and the top of the left ledge rock.
  bed(1240, [
    [shrub(1500, 690, 150, 46, 8, 51)],
    [astilbe(1488, 694, 96, 34, 0.04, 52), astilbe(1532, 690, 76, 28, -0.08, 53), astilbe(1456, 692, 64, 24, 0.1, 54)],
    [daisy(1510, 700, 30, 8, 2, 55), daisy(1470, 704, 22, 7, -2, 56)],
  ], 's09-mid-bank');
  bed(1380, [
    [shrub(520, 462, 130, 40, 8, 61), shrub(230, 352, 120, 34, 7, 62), shrub(150, 344, 110, 30, 7, 68), shrub(468, 392, 150, 34, 8, 69)],
    [astilbe(500, 466, 70, 26, 0.06, 63), astilbe(548, 464, 54, 22, -0.08, 64), astilbe(212, 356, 52, 22, 0.05, 65),
      astilbe(150, 342, 64, 26, -0.06, 140), astilbe(262, 344, 50, 20, 0.08, 141), astilbe(118, 348, 46, 20, 0.04, 142), astilbe(524, 390, 48, 20, -0.06, 143)],
    [daisy(528, 470, 22, 7, 2, 66), daisy(470, 468, 20, 6, -2, 67),
      tansy(182, 350, 34, 7, 2, 144), tansy(232, 348, 28, 6, -2, 145), tansy(130, 352, 26, 6, 1, 146), daisy(250, 356, 22, 6, 2, 147),
      daisy(286, 350, 18, 6, -1, 148), daisy(170, 356, 20, 6, -2, 149), daisy(440, 394, 20, 6, 2, 150), tansy(490, 396, 24, 6, -2, 151)],
  ], 's09-mid-ledges');
  return tagAll(out, 'flowers');
}

// The grassy bank in front of the pool, under the stepping stones.
function drawBank(ctx, light) {
  const rng = new RNG('s09-bank');
  const edge = [[540, 948], [800, 962], [1000, 986], [1150, 992], [1300, 978], [1500, 962], [1700, 944], [1980, 934]];
  const at = (x) => {
    for (let i = 1; i < edge.length; i++) if (x <= edge[i][0]) return lerp(edge[i - 1][1], edge[i][1], (x - edge[i - 1][0]) / (edge[i][0] - edge[i - 1][0]));
    return edge[edge.length - 1][1];
  };
  const rows = [[0, '#56602c', '#2c3418'], [18, '#6e7a30', '#323c1a'], [44, '#434e24', '#1e2612']];
  for (const [dy, c0, c1] of rows) {
    const pts = [];
    for (let x = 540; x <= 1980; x += 10) pts.push([x, at(x) + dy + rng.range(-3, 3)]);
    pts.push([1980, 1330], [540, 1330]);
    piece(ctx, pts, {
      fill: linear(ctx, 0, 940 + dy, 0, 1120, [c0, c1]),
      torn: { amp: 2.4, freq: 0.2, fine: 0.9, seed: rng.int(1, 1e6), step: 3 },
      rim: { color: '#b8bc58', width: 1.2 },
      shadow: { color: 'rgba(6,10,2,0.5)', blur: 7, x: 0, y: 4 },
      bevel: { light, width: 1.3, hi: 0.3, lo: 0.15 },
    });
  }
  for (let i = 0; i < 26; i++) {
    const x = rng.range(560, 1960);
    drawMossPatch(ctx, x, at(x) + rng.range(10, 140), rng.range(12, 30), rng.range(5, 10), rng, light);
  }
  flecks(ctx, 540, 930, 1440, 400, 1200, rng.int(1, 1e6), { color: '#c8c45a', max: 1.3, alpha: 0.55 });
}

// The fox's rock, the foreground rocks and stepping stones, and the framing flowers.
export function addForeground(S) {
  const L = S.light;
  const near = [];
  const fg = [];
  near.push(addBoulders(S, { name: 's09-fox-rock', z: 990, palette: 'perch', light: L, moss: 0.3, res: 1.25, rocks: [
    { x: 566, y: 858, w: 470, h: 112, shape: 'slab', tilt: 0.18, seed: 71 },
    { x: 404, y: 836, w: 300, h: 96, shape: 'slab', tilt: 0.2, seed: 72 },
  ] }));
  near.push(S.plane(880, {
    name: 's09-bank', x: 530, y: 900, w: 1460, h: 440, mat: 'paper', light: L, shadow: { blur: 12 },
    draw(ctx) { drawBank(ctx, L); },
  }));
  near.push(addBoulders(S, { name: 's09-pool-edge', z: 920, palette: 'perch', light: L, moss: 0.4, res: 1.25, rocks: [
    { x: 1860, y: 836, w: 240, h: 110, shape: 'block', seed: 73 },
    { x: 1718, y: 900, w: 90, h: 50, shape: 'round', seed: 74 },
  ] }));
  near.push(addBoulders(S, { name: 's09-stepping', z: 860, palette: 'arch', light: L, moss: 0.25, res: 1.25, rocks: [
    { x: 1268, y: 900, w: 200, h: 26, shape: 'slab', tilt: 0.22, seed: 75 },
    { x: 1270, y: 978, w: 260, h: 30, shape: 'slab', tilt: 0.22, seed: 76 },
    { x: 1380, y: 1050, w: 250, h: 32, shape: 'slab', tilt: 0.22, seed: 77 },
    { x: 1430, y: 1124, w: 280, h: 34, shape: 'slab', tilt: 0.22, seed: 78 },
  ] }));
  near.push(addBoulders(S, { name: 's09-fg-rocks', z: 760, palette: 'perch', light: L, moss: 0.3, res: 1.3, rocks: [
    { x: 810, y: 1010, w: 250, h: 150, shape: 'block', seed: 81 },
    { x: 690, y: 1120, w: 200, h: 120, shape: 'round', seed: 82 },
    { x: 1690, y: 1046, w: 230, h: 130, shape: 'block', seed: 83 },
    { x: 1080, y: 1150, w: 180, h: 80, shape: 'flat', seed: 84 },
  ] }));
  // Flowers between the foreground rocks.
  fg.push(...addFlowerBed(S, { z: 700, seed: 's09-fg-mid', palette: 'night', res: 1, rows: [
    [shrub(980, 1080, 200, 70, 12, 91), { type: 'tuft', x: 600, y: 990, len: 70, n: 7, seed: 92 }, { type: 'tuft', x: 1230, y: 1060, len: 80, n: 7, seed: 93 }],
    [astilbe(972, 1060, 150, 50, 0.04, 94), astilbe(1020, 1070, 120, 42, -0.08, 95), astilbe(930, 1076, 110, 40, 0.1, 96)],
    [daisy(560, 960, 50, 15, -4, 97), daisy(598, 975, 40, 13, 3, 98), daisy(632, 990, 56, 15, 5, 99), daisy(1180, 1030, 46, 14, -3, 100),
      daisy(1222, 1050, 60, 16, 4, 101), daisy(1262, 1046, 40, 12, 2, 102), tansy(660, 1000, 70, 12, 4, 103), tansy(1150, 1050, 54, 11, -3, 104)],
  ] }));
  // Bottom-left bed (pink coneflowers, daisies, billy buttons, astilbe).
  const lake = FLOWER_BEDS['night-lake'];
  const bedL = { ...lake, rows: lake.rows.map((row) => row.map((it) => (it.type === 'shrub' && it.seed === 49 ? { ...it, x: 236, y: 812, w: 200, h: 130 } : it))) };
  fg.push(...addFlowerBed(S, { preset: bedL, z: 480, palette: PINK, res: 1.1 }));
  // Bottom-right bed: astilbe, daisies, leaves.
  fg.push(...addFlowerBed(S, {
    z: 520, region: [1480, 800, 1960, 1080], anchor: 'right', seed: 's09-right', palette: 'night', res: 1, density: 0.8,
    mix: { daisy: 3, astilbe: 2.4, leaf: 2, blade: 3, tansy: 0.6, echinacea: 0, lupine: 0 },
  }));
  tagAll(near, 'near');
  tagAll(fg, 'fg');
  return [...near, ...fg];
}
