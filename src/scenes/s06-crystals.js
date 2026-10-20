// Crystal clusters for the crystal cave (s06): chunky hexagonal prisms with pyramid
// tips, cut from icy blue paper. Every prism shows three faces in clearly different
// values (a saturated shaded face, a sky-blue face toward us and a pale ice face toward
// the light), a bright edge where the lit faces meet, white glints and a ghost of the
// back ridge seen through the ice. Each cluster is baked twice, dark (asleep) and
// glowing (awake), so it can ignite by crossfading the glowing sheet over the dark one,
// with an additive halo that then breathes slowly.

import { RNG } from '../core/rng.js';
import { piece, pathOf, linear, setShadow, clearShadow } from '../core/piece.js';
import { transform } from '../core/geom.js';
import { mix, rgba } from '../core/color.js';
import { osc, smoothstep, lerp } from '../core/ease.js';
import { drawGlow } from '../elements/sky.js';

// Face colours, darkest to lightest, plus the glow at the roots and the cut-edge light.
export const CRYSTAL_LIT = {
  navy: '#0838a6', deep: '#0c68e8', mid: '#1fa0ff', light: '#6ad0ff', pale: '#baf2ff', ice: '#e6fcff', white: '#f8ffff',
  root: '#c8f7ff', edge: '#ffffff', shadow: 'rgba(4,16,56,0.6)', halo: '#2f8cff', core: '#a4eaff', glint: 1,
};
// The same paper before the light comes on: cold slate lit only by the star.
export const CRYSTAL_DIM = {
  navy: '#0c1222', deep: '#121a2c', mid: '#18243a', light: '#20304a', pale: '#2a3c58', ice: '#31445f', white: '#36496a',
  root: '#1c2c48', edge: '#4a5c7c', shadow: 'rgba(0,0,0,0.5)', halo: '#000000', core: '#000000', glint: 0.25,
};
// Barely crumpled: the ice must stay clear and saturated.
export const CRYSTAL_MAT = [{ tex: 'crumple', amt: 0.14, scale: 0.3 }];

// Geometry of one crystal in scene coordinates.
//   x, y   centre of the base (where it leaves the rock)
//   len    base to tip; w: half width; lean: tilt in radians (+ = tip to the right)
//   tip    share of len taken by the pyramid tip
//   turn   0..1 how the prism is turned: moves the two ridges across the body
export function crystalGeometry({ x, y, len, w, lean = 0, tip = 0.22, turn = null, sink = 0.35, seed = 1 }) {
  const r = new RNG(`crystal:${seed}`);
  // Unless given, the prism turns with its lean (and a little at random) so neighbours
  // never show the same face split: a cluster reads as separate prisms, not stacked sheets.
  if (turn == null) turn = Math.min(0.95, Math.max(0.05, 0.5 - lean * 0.7 + r.range(-0.3, 0.3)));
  const a = 0.1 + turn * 0.42 + r.range(-0.04, 0.04);
  const b = a + 0.26 + r.range(0, 0.16);
  const sL = -w + 2 * w * a, sR = -w + 2 * w * Math.min(0.92, b);
  const T = len * tip;
  const yC1 = -len + T, yC2 = -len + T * r.range(0.85, 1.1);
  const yL = -len + T * r.range(0.55, 0.85), yR = -len + T * r.range(0.5, 0.8);
  const tx = sL + (sR - sL) * r.range(0.3, 0.7);
  const base = w * sink;
  const P = (pts) => transform(pts, { x, y, rot: lean });
  return {
    x, y, len, w, lean,
    local: { sL, sR, yC1, yC2, yL, yR, tx, base },
    faces: {
      left: P([[-w, base], [-w, yL], [sL, yC1], [sL, base]]),
      centre: P([[sL, base], [sL, yC1], [sR, yC2], [sR, base]]),
      right: P([[sR, base], [sR, yC2], [w, yR], [w, base]]),
      tipL: P([[-w, yL], [tx, -len], [sL, yC1]]),
      tipC: P([[sL, yC1], [tx, -len], [sR, yC2]]),
      tipR: P([[sR, yC2], [tx, -len], [w, yR]]),
    },
    outline: P([[-w, base], [-w, yL], [tx, -len], [w, yR], [w, base]]),
    tip: P([[tx, -len]])[0],
    ridges: [P([[sL, base], [sL, yC1], [tx, -len]]), P([[sR, base], [sR, yC2], [tx, -len]])],
  };
}

// Ice inside one face (local coordinates, clipped to it): a couple of slanted fracture
// planes, each a shade off its neighbour with a faint hairline, and a crackle of small
// lighter and darker chips like frozen water.
function iceFacets(ctx, pts, x0, x1, yTop, yBot, rng, { n = 2, glint = 1, dark, edge }) {
  ctx.save();
  ctx.clip(pathOf(pts));
  const ys = Array.from({ length: n }, () => yTop + (yBot - yTop) * rng.range(0.12, 0.88)).sort((p, q) => p - q);
  const cuts = ys.map((yy) => { const tilt = (x1 - x0) * rng.range(-1.1, 1.1); return [[x0 - 4, yy - tilt / 2], [x1 + 4, yy + tilt / 2]]; });
  cuts.forEach(([l0, l1], i) => {
    const nx = cuts[i + 1] ?? [[x0 - 4, yBot + 60], [x1 + 4, yBot + 60]];
    ctx.fillStyle = i % 2 === 0 ? rgba(dark, rng.range(0.1, 0.2)) : rgba('#ffffff', rng.range(0.1, 0.2) * glint);
    ctx.fill(pathOf([l0, l1, nx[1], nx[0]]));
    ctx.strokeStyle = rgba(edge, rng.range(0.35, 0.6) * glint);
    ctx.lineWidth = rng.range(0.6, 1.1);
    ctx.beginPath(); ctx.moveTo(l0[0], l0[1]); ctx.lineTo(l1[0], l1[1]); ctx.stroke();
  });
  const m = 4 + Math.round(((yBot - yTop) / 36) * rng.range(0.7, 1.2));
  for (let i = 0; i < m; i++) {
    const px = x0 + (x1 - x0) * rng.next(), py = yTop + (yBot - yTop) * rng.next(), s = (x1 - x0) * rng.range(0.14, 0.42);
    ctx.fillStyle = rng.chance(0.55) ? rgba('#ffffff', rng.range(0.07, 0.18) * glint) : rgba(dark, rng.range(0.08, 0.18));
    ctx.fill(pathOf([[px - s, py], [px + s * rng.range(-0.3, 0.5), py - s * rng.range(0.8, 2)], [px + s, py + s * rng.range(-0.2, 0.5)], [px + s * rng.range(-0.4, 0.3), py + s * rng.range(0.6, 1.6)]]));
  }
  ctx.restore();
}

const stroke = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };

// A four-point sparkle.
function glintStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.22, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.22, y); ctx.closePath();
  ctx.moveTo(x - r * 0.7, y); ctx.lineTo(x, y + r * 0.16); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y - r * 0.16); ctx.closePath();
  ctx.fill();
}

// Paint one crystal. pal: CRYSTAL_LIT or CRYSTAL_DIM.
export function paintCrystal(ctx, g, pal, { light = [0.35, -0.94], seed = 1, shadow = true, detail = 1 } = {}) {
  const rng = new RNG(`paint:${seed}`);
  const { len, w } = g;
  const { sL, sR, yC1, yC2, yL, yR, tx, base } = g.local;
  const litRight = light[0] >= 0;
  const tone = rng.range(-0.14, 0.14);
  const shadeC = mix(pal.navy, pal.deep, 0.55 + tone);
  const frontC = mix(pal.mid, pal.light, 0.4 + tone);
  const litC = mix(pal.light, pal.pale, 0.72 + tone);
  const leftC = litRight ? shadeC : litC, rightC = litRight ? litC : shadeC;
  if (shadow) setShadow(ctx, { color: pal.shadow, blur: Math.max(3, w * 0.25), x: -light[0] * 3, y: 4 });
  piece(ctx, g.outline, { fill: pal.navy });
  clearShadow(ctx);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.lean);
  const up = (stops) => linear(ctx, 0, base, 0, -len, stops);
  // Every face glows near the root, holds its colour through the body and pales at the top.
  const body = (c, k = 1) => up([[0, mix(c, pal.root, 0.62 * k)], [0.07, mix(c, pal.root, 0.22 * k)], [0.22, c], [0.72, mix(c, pal.deep, 0.08)], [1, mix(c, pal.white, 0.3)]]);
  const L = [[-w, base], [-w, yL], [sL, yC1], [sL, base]];
  const C = [[sL, base], [sL, yC1], [sR, yC2], [sR, base]];
  const R = [[sR, base], [sR, yC2], [w, yR], [w, base]];
  const outline = [[-w, base], [-w, yL], [tx, -len], [w, yR], [w, base]];
  piece(ctx, L, { fill: body(leftC, litRight ? 0.75 : 1) });
  piece(ctx, C, { fill: body(frontC) });
  piece(ctx, R, { fill: body(rightC, litRight ? 1 : 0.75) });
  // The front face rounds from the shaded ridge to the lit one.
  ctx.save();
  ctx.clip(pathOf(C));
  const across = ctx.createLinearGradient(sL, 0, sR, 0);
  const dk = rgba(pal.navy, 0.2), lt = rgba('#ffffff', 0.12 * pal.glint);
  across.addColorStop(0, litRight ? dk : lt); across.addColorStop(0.5, 'rgba(0,0,0,0)'); across.addColorStop(1, litRight ? lt : dk);
  ctx.fillStyle = across;
  ctx.fillRect(sL, -len, sR - sL, len + base + 2);
  ctx.restore();
  const n = Math.min(4, 1 + Math.round((len / 140) * detail));
  const fo = { glint: pal.glint, dark: pal.navy, edge: pal.edge };
  iceFacets(ctx, L, -w, sL, yL, base, rng, { ...fo, n: Math.max(1, n - 1) });
  iceFacets(ctx, C, sL, sR, yC1, base, rng, { ...fo, n });
  iceFacets(ctx, R, sR, w, yR, base, rng, { ...fo, n: Math.max(1, n - 1) });
  // Tip facets: shaded, front and lit, each lighter than the face below it.
  const tipShade = mix(shadeC, pal.light, 0.4), tipLit = mix(pal.pale, pal.white, 0.55);
  piece(ctx, [[-w, yL], [tx, -len], [sL, yC1]], { fill: litRight ? tipShade : tipLit });
  piece(ctx, [[sL, yC1], [tx, -len], [sR, yC2]], { fill: mix(frontC, pal.pale, 0.45) });
  piece(ctx, [[sR, yC2], [tx, -len], [w, yR]], { fill: litRight ? tipLit : tipShade });

  // Light inside the ice.
  ctx.save();
  ctx.clip(pathOf(outline));
  ctx.globalCompositeOperation = 'screen';
  ctx.save();
  ctx.translate((sL + sR) / 2, -len * 0.2);
  ctx.scale(1, (len * 0.5) / (w * 1.1));
  const gi = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.1);
  gi.addColorStop(0, rgba(pal.core, 0.45 * pal.glint)); gi.addColorStop(0.6, rgba(pal.core, 0.14 * pal.glint)); gi.addColorStop(1, rgba(pal.core, 0));
  ctx.fillStyle = gi;
  ctx.fillRect(-w * 1.2, -w * 1.2, w * 2.4, w * 2.4);
  ctx.restore();
  // A white vein just inside the lit ridge, brightest low down.
  const rx = litRight ? sR : sL, dir = litRight ? -1 : 1;
  const vein = linear(ctx, 0, base, 0, -len * 0.8, [[0, rgba('#ffffff', 0.6 * pal.glint)], [0.5, rgba('#ffffff', 0.26 * pal.glint)], [1, rgba('#ffffff', 0)]]);
  ctx.fillStyle = vein;
  ctx.fill(pathOf([[rx + dir * w * 0.05, base], [rx + dir * w * 0.04, (litRight ? yC2 : yC1) + len * 0.04], [rx + dir * w * 0.17, (litRight ? yC2 : yC1) + len * 0.1], [rx + dir * w * 0.24, base]]));
  // The back ridge seen through the ice, faint, in the shaded face.
  const bx = litRight ? (-w + sL) / 2 : (w + sR) / 2;
  ctx.strokeStyle = rgba(pal.pale, 0.28 * pal.glint);
  ctx.lineWidth = Math.max(0.8, w * 0.035);
  stroke(ctx, [[bx + rng.range(-0.1, 0.1) * w, base], [bx * 0.7 + tx * 0.3, -len + len * 0.3], [tx, -len]]);
  ctx.restore();

  // Cut edges: the bright ridge between the front and lit faces (with a soft bloom),
  // a quieter ridge on the shaded side, the lit outer edge and the tip shoulders.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const litRidge = litRight ? [[sR, base * 0.3], [sR, yC2], [tx, -len]] : [[sL, base * 0.3], [sL, yC1], [tx, -len]];
  const shadeRidge = litRight ? [[sL, base * 0.3], [sL, yC1], [tx, -len]] : [[sR, base * 0.3], [sR, yC2], [tx, -len]];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = rgba(pal.white, 0.3 * pal.glint);
  ctx.lineWidth = Math.max(3, w * 0.16);
  stroke(ctx, litRidge);
  ctx.restore();
  ctx.strokeStyle = rgba(pal.edge, 0.95);
  ctx.lineWidth = Math.max(1.1, w * 0.05);
  stroke(ctx, litRidge);
  ctx.strokeStyle = rgba(pal.pale, 0.28);
  ctx.lineWidth = Math.max(0.8, w * 0.025);
  stroke(ctx, shadeRidge);
  ctx.strokeStyle = rgba(pal.edge, 0.32);
  ctx.lineWidth = Math.max(0.8, w * 0.03);
  stroke(ctx, [[-w, yL], [sL, yC1], [sR, yC2], [w, yR]]);
  ctx.strokeStyle = rgba(pal.edge, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.035);
  stroke(ctx, litRight ? [[w, base * 0.3], [w, yR], [tx, -len]] : [[-w, base * 0.3], [-w, yL], [tx, -len]]);
  ctx.strokeStyle = rgba(pal.navy, 0.65);
  ctx.lineWidth = Math.max(1, w * 0.05);
  stroke(ctx, litRight ? [[-w, base], [-w, yL]] : [[w, base], [w, yR]]);
  // Inner glints: short streaks along the grain and a few sparkles.
  ctx.clip(pathOf(outline));
  const k = Math.round((len / 48) * detail);
  for (let i = 0; i < k; i++) {
    const px = rng.range(-0.75, 0.75) * w, py = -len * rng.range(0.1, 0.75), l = len * rng.range(0.04, 0.12);
    ctx.strokeStyle = rgba(pal.white, rng.range(0.25, 0.55) * pal.glint);
    ctx.lineWidth = rng.range(0.6, 1.3);
    stroke(ctx, [[px, py], [px + l * 0.15, py - l]]);
  }
  const sp = Math.max(1, Math.round((len / 110) * detail));
  for (let i = 0; i < sp; i++) {
    const px = rng.range(-0.6, 0.7) * w, py = -len * rng.range(0.15, 0.8);
    glintStar(ctx, px, py, Math.max(2.5, w * rng.range(0.05, 0.11)), rgba(pal.white, rng.range(0.55, 0.9) * pal.glint));
  }
  ctx.restore();
}

// Expand a cluster spec into crystal geometry. spec.crystals: [{ dx, dy, len, w, lean, turn, tip }]
// back to front, relative to the cluster base (x, y); spec.scale multiplies sizes.
// Bigger clusters also grow a few small, steeply tilted crystals at their foot so the
// group never reads as a neat fan.
export function clusterGeometry(spec) {
  const { x, y, scale = 1, crystals, seed = 'cluster' } = spec;
  const r = new RNG(`cg:${seed}`);
  const list = crystals.slice();
  if (crystals.length >= 4) {
    const xs = crystals.map((c) => c.dx ?? 0);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const Lm = Math.max(...crystals.map((c) => c.len));
    const Wm = crystals.reduce((s, c) => s + c.w, 0) / crystals.length;
    const n = crystals.length >= 6 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const side = r.chance(0.5) ? -1 : 1;
      list.push({ dx: lerp(x0, x1, r.range(0.05, 0.95)), dy: r.range(6, 16), len: Lm * r.range(0.17, 0.32), w: Wm * r.range(0.6, 0.85), lean: side * r.range(0.35, 0.7), tip: 0.3 });
    }
  }
  return list.map((c, i) => {
    const big = c.len * scale > 200;
    return crystalGeometry({
      x: x + (c.dx ?? 0) * scale + r.range(-6, 6) * scale, y: y + (c.dy ?? 0) * scale + r.range(-6, 10) * scale,
      len: c.len * scale * r.range(0.64, 1.2), w: c.w * scale * r.range(0.98, 1.24) * (big ? 1.1 : 1),
      lean: (c.lean ?? 0) + r.range(-0.16, 0.16), tip: (c.tip ?? 0.22) * r.range(0.85, 1.25), turn: c.turn ?? null, sink: c.sink ?? 0.35, seed: `${seed}:${i}`,
    });
  });
}

// Bounding box of a cluster's crystals, padded.
export function clusterBox(geoms, pad = 16) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of geoms) for (const [px, py] of g.outline) {
    x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
  }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
}

// Bake a cluster (dark and glowing sheets) and add its planes.
//   spec     { x, y, scale, crystals, seed } (see clusterGeometry)
//   z        plane depth; ignite: local time the glow starts; rise: seconds to full glow
//   halo     radius of the halo (px at rest) and its strength; blur: soften near-lens clusters
// Returns { layers, ignite(t) -> 0..1, light(t) -> current brightness, centre }.
export function addCrystalCluster(S, spec, { z, ignite = 1, rise = 0.4, halo = 1, haloR = null, breathe = 0.12, period = 5.5, phase = 0, res = 1, blur = 0, tags = [] }) {
  const geoms = clusterGeometry(spec);
  const box = clusterBox(geoms, 18 + blur * 3);
  const paint = (pal) => (ctx) => {
    if (blur) ctx.filter = `blur(${blur * res}px)`;
    geoms.forEach((g, i) => paintCrystal(ctx, g, pal, { light: S.light, seed: `${spec.seed}:${i}` }));
  };
  const opts = { x: box.x, y: box.y, w: box.w, h: box.h, res, mat: blur ? 'smooth' : CRYSTAL_MAT, shadow: { blur: 12 } };
  const dark = S.sprite({ ...opts, res: res * 0.5, name: `${spec.seed}-dark`, edge: { width: 1.2, hi: 0.18, lo: 0.3, soft: 0.6 }, draw: paint(CRYSTAL_DIM) });
  const lit = S.sprite({ ...opts, name: `${spec.seed}-lit`, edge: { width: 1.3, hi: 0.3, lo: 0.18, soft: 0.6, hiColor: '#f2fbff' }, shadow: false, draw: paint(CRYSTAL_LIT) });
  const tallest = geoms.reduce((m, g) => Math.max(m, g.len), 0);
  const cx = geoms.reduce((s, g) => s + g.x, 0) / geoms.length;
  const cy = geoms.reduce((s, g) => s + g.y, 0) / geoms.length;
  const R = haloR ?? Math.min(tallest * 0.95, 140 + tallest * 0.3);
  const on = (t) => smoothstep(ignite, ignite + rise, t);
  const light = (t) => on(t) * (1 - breathe + breathe * (0.5 + 0.5 * osc(t, period, phase)));
  const ctag = ['crystals', ...tags];

  const layers = [
    // Halo behind the crystals: blue light on the rock and air around them.
    S.add({
      name: `${spec.seed}-halo`, z, order: -1, blend: 'lighter', tags: ctag,
      render(ctx, t) {
        const k = light(t);
        if (k <= 0.002) return;
        drawGlow(ctx, cx, cy - tallest * 0.4, R, CRYSTAL_LIT.halo, 0.3 * halo * k, { falloff: 'tight' });
        drawGlow(ctx, cx, cy + 4, R * 0.9, CRYSTAL_LIT.halo, 0.48 * halo * k, { falloff: 'tight', sy: 0.3 });
      },
    }),
    S.add({
      name: `${spec.seed}`, z, tags: ctag,
      render(ctx, t, env) {
        const k = on(t);
        const items = [{ s: dark, alpha: 1 }];
        if (k > 0.002) items.push({ s: lit, alpha: k, shadow: false });
        drawSpritesSimple(ctx, items, env.shadow);
      },
    }),
    // Inner light: the glow welling up from the roots and through the bodies.
    S.add({
      name: `${spec.seed}-core`, z, order: 1, blend: 'lighter', tags: ctag,
      render(ctx, t) {
        const k = light(t);
        if (k <= 0.002) return;
        for (const g of geoms) {
          const mx = (g.x + g.tip[0]) / 2, my = (g.y + g.tip[1]) / 2;
          drawGlow(ctx, mx, my, g.len * 0.5, CRYSTAL_LIT.core, 0.035 * k, { falloff: 'tight', sx: 0.6 });
          drawGlow(ctx, g.x, g.y - g.w * 0.3, g.w * 2.1, CRYSTAL_LIT.root, 0.2 * k, { falloff: 'tight', sy: 0.55 });
        }
      },
    }),
  ];
  return { layers, ignite: on, light, centre: { x: cx, y: cy - tallest * 0.4 }, radius: R, geoms };
}

// Dark sheet with its drop shadow, the glowing sheet over it without one.
function drawSpritesSimple(ctx, items, sh) {
  const base = ctx.globalAlpha;
  const d = items[0].s;
  if (d.shadow) {
    const p = d.shadow.pad;
    ctx.globalAlpha = base * (sh.alpha ?? 0.5);
    ctx.drawImage(d.shadow.canvas, d.x - p + (sh.dx ?? 0), d.y - p + (sh.dy ?? 0), d.w + 2 * p, d.h + 2 * p);
  }
  for (const it of items) {
    ctx.globalAlpha = base * it.alpha;
    ctx.drawImage(it.s.canvas, it.s.x, it.s.y, it.s.w, it.s.h);
  }
  ctx.globalAlpha = base;
}
