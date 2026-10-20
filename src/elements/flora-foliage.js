// Paper foliage: leaves, grass blades, ferns, clover, lobed shrub clumps, moss and
// fly-agaric mushrooms. Like the flowers, every function paints in authored
// coordinates and can be used inside any sprite's draw(ctx).

import { RNG } from '../core/rng.js';
import { piece, setShadow, clearShadow } from '../core/piece.js';
import { blob, transform, along, TAU } from '../core/geom.js';
import { mix, shade, rgba, adjust } from '../core/color.js';
import {
  DEFAULT_LIGHT, floraPalette, foldedBlade, foldShade, creaseLine, bevelOf, linearAlong,
  drawStem, curve, shadeOver, bladeOutline, bladeMidline,
} from './flora-kit.js';

const leafShadow = (light, a = 0.42, blur = 4) => ({ color: `rgba(6,14,8,${a})`, blur, x: -light[0] * 1.6, y: 2.4 });

// --- Leaves ------------------------------------------------------------------------------

// Broad lanceolate leaf folded along its midrib, with a lit edge and faint veins.
//   x, y  base    len  length     width  half-width as a fraction of len
//   rot   0 = pointing up, positive turns clockwise     curl  sideways bend of the tip
//   round 0..1 rounded tip    serrate { count, depth } toothed edge    speckle  pale flecks
export function drawLeaf(ctx, o = {}) {
  const { x = 0, y = 0, len = 120, width = 0.2, rot = 0, curl = 0, belly = 0.4, base = 0.12, tip = 0, taper = 1, round = 0, veins = 6, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const r = new RNG(seed);
  const col = adjust(o.color ?? pal.leaf.mid, { l: r.range(-0.03, 0.03) });
  const tipPt = [x + Math.sin(rot) * len, y - Math.cos(rot) * len];
  const serrate = o.serrate ?? null;
  const { path, mid } = foldedBlade(ctx, len, len * width, { base, belly, tip, taper, round, curl, serrate, skew: r.range(-0.08, 0.08), n: serrate ? serrate.count * 7 : 22 },
    { x, y, rot },
    {
      fill: linearAlong(ctx, [x, y], tipPt, [shade(col, -0.32), col, shade(col, 0.06), col]),
      light,
      shadow: leafShadow(light, 0.45, 5),
      dark: o.dark ?? 0.22, lift: o.lift ?? 0.1, crease: 0.4,
      bevel: { width: 1.8, hi: 0.36, lo: 0.24, soft: 0.6 },
    });
  if (veins > 0) leafVeins(ctx, path, mid, len * width, veins, light, r);
  if (o.speckle) speckles(ctx, path, mid, len * width, o.speckle, r);
  return path;
}

// Pale flecks scattered over a leaf, like dew or inclusions in handmade paper.
function speckles(ctx, path, mid, wid, amount, r) {
  ctx.save();
  ctx.clip(path);
  const n = Math.round(amount * mid.length * 4);
  for (let i = 0; i < n; i++) {
    const { p } = along(mid, r.range(0.05, 0.95));
    const x = p[0] + r.range(-1, 1) * wid, y = p[1] + r.range(-1, 1) * wid * 0.6;
    ctx.fillStyle = rgba('#f4f0c8', r.range(0.15, 0.45));
    ctx.beginPath();
    ctx.arc(x, y, r.range(0.6, 1.8), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Faint side veins running from the midrib toward the tip.
function leafVeins(ctx, path, mid, wid, count, light, r) {
  ctx.save();
  ctx.clip(path);
  ctx.lineCap = 'round';
  for (let i = 1; i <= count; i++) {
    const t = 0.12 + 0.75 * (i / (count + 1));
    const { p, ang } = along(mid, t);
    for (const s of [-1, 1]) {
      const a = ang + s * 0.75;
      const l = wid * 1.25 * (1 - t * 0.5) * r.range(0.8, 1.1);
      const e = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];
      ctx.strokeStyle = rgba('#10200c', 0.16);
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
      ctx.strokeStyle = rgba('#fffbe8', 0.1);
      ctx.beginPath(); ctx.moveTo(p[0] + light[0], p[1] + light[1]); ctx.lineTo(e[0] + light[0], e[1] + light[1]); ctx.stroke();
    }
  }
  ctx.restore();
}

// Long strap leaf / grass blade: narrow, tapering, bending over.
export function drawBlade(ctx, o = {}) {
  const { x = 0, y = 0, len = 200, width = 0.06, rot = 0, curl = 0.15, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const r = new RNG(seed);
  const col = adjust(o.color ?? pal.leaf.light, { l: r.range(-0.03, 0.03) });
  const tipPt = [x + Math.sin(rot) * len, y - Math.cos(rot) * len];
  return foldedBlade(ctx, len, len * width, { base: 0.75, belly: 0.3, taper: 0.9, tip: 0, curl, n: 24 },
    { x, y, rot },
    {
      fill: linearAlong(ctx, [x, y], tipPt, [shade(col, -0.35), col, shade(col, 0.08)]),
      light,
      shadow: leafShadow(light, 0.42, 4),
      dark: o.dark ?? 0.24, lift: o.lift ?? 0.12, crease: 0.32,
      bevel: { width: 1.5, hi: 0.32, lo: 0.24, soft: 0.5 },
    }).path;
}

// A cheap folded blade for dense fills: the outline and one shaded half drawn as plain
// polygons (no clipping), with a contact shadow. Base at (x, y), rot 0 = up.
export function quickBlade(ctx, x, y, len, wid, rot, curl, color, light = DEFAULT_LIGHT, { shadow = true, shape = null } = {}) {
  const n = 12;
  const local = bladeOutline(len, wid, shape ?? { base: 0.8, belly: 0.22, taper: 0.9, curl, n });
  const T = { x, y, rot };
  const pts = transform(local, T);
  const tip = pts[n];
  ctx.save();
  if (shadow) setShadow(ctx, { color: 'rgba(4,12,6,0.4)', blur: 2.5, x: -light[0] * 1.2, y: 1.6 });
  ctx.fillStyle = linearAlong(ctx, [x, y], tip, [shade(color, -0.4), color, shade(color, 0.12)]);
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
  clearShadow(ctx);
  // Shade whichever half faces away from the light: left half = left edge + midline.
  const side = [-Math.cos(rot), -Math.sin(rot)];
  const facing = side[0] * light[0] + side[1] * light[1];
  const half = facing < 0 ? pts.slice(0, n + 1) : pts.slice(n + 1);
  const mid = transform(bladeMidline(len, { curl, n }), T);
  const poly = facing < 0 ? [...half, ...mid.reverse()] : [...half, ...mid];
  ctx.fillStyle = rgba('#081408', 0.22);
  ctx.beginPath();
  poly.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Undergrowth: a dense band of grass blades and thin leafy stems that fills the gaps
// between the big pieces of a cluster, as in every reference foreground.
//   x0, x1  extent    y  ground line    h  tallest blade    edge  [[x, y], ...] top profile
//   density blades per 10 px of width   tones  palette leaf names    stems  leafy stem share
export function drawUndergrowth(ctx, o = {}) {
  const { x0 = 0, x1 = 600, y = 1080, h = 260, edge = null, density = 1, tones = ['mid', 'light', 'dark', 'lime'], stems = 0.25, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const r = new RNG(seed);
  const topAt = (x) => {
    if (!edge) return y - h;
    if (x <= edge[0][0]) return edge[0][1];
    for (let i = 1; i < edge.length; i++) {
      if (x <= edge[i][0]) return edge[i - 1][1] + (edge[i][1] - edge[i - 1][1]) * (x - edge[i - 1][0]) / (edge[i][0] - edge[i - 1][0]);
    }
    return edge[edge.length - 1][1];
  };
  const items = [];
  const n = Math.round(((x1 - x0) / 10) * density);
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    const by = y + r.range(0, 70);
    const reach = Math.max(30, by - topAt(x));
    items.push({ x, by, len: reach * Math.pow(r.next(), 0.6) * r.range(0.55, 1), stem: r.chance(stems), tone: r.pick(tones) });
  }
  items.sort((a, b) => b.len - a.len);
  for (const it of items) {
    const col = adjust(pal.leaf[it.tone] ?? it.tone, { l: r.range(-0.06, 0.05), h: r.range(-0.01, 0.01) });
    const rot = r.range(-0.4, 0.4);
    if (!it.stem) {
      quickBlade(ctx, it.x, it.by, it.len, r.range(2.5, 6.5) * (0.6 + it.len / 500), rot, rot * 0.5 + r.range(-0.2, 0.2), col, light);
      continue;
    }
    // A thin stem with a few small paired leaves.
    const top = [it.x + Math.sin(rot) * it.len, it.by - Math.cos(rot) * it.len];
    const pts = curve([it.x, it.by], top, r.range(-0.08, 0.08) * it.len, 10);
    ctx.save();
    setShadow(ctx, { color: 'rgba(4,12,6,0.4)', blur: 2, x: -light[0], y: 1.4 });
    ctx.strokeStyle = shade(pal.stem, -0.1 + r.range(-0.08, 0.08));
    ctx.lineWidth = r.range(1.4, 2.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.restore();
    const pairs = r.int(1, 3);
    for (let k = 0; k < pairs; k++) {
      const { p, ang } = along(pts, 0.35 + 0.55 * (k / Math.max(1, pairs - 1)) + r.range(-0.05, 0.05));
      for (const s of [-1, 1]) {
        if (r.chance(0.25)) continue;
        const ll = r.range(10, 22);
        quickBlade(ctx, p[0], p[1], ll, ll * 0.28, ang + Math.PI / 2 + s * r.range(0.7, 1.1), s * 0.1, shade(pal.leaf.light, r.range(-0.1, 0.05)), light,
          { shape: { base: 0.15, belly: 0.45, n: 12 } });
      }
    }
  }
}

// A tuft of grass blades fanning out from one root, longest at the back.
//   n  blade count    len  longest blade    spread  fan angle (radians)    tones  palette leaf names
export function drawTuft(ctx, o = {}) {
  const { x = 0, y = 0, n = 7, len = 160, spread = 0.9, width = 0.05, lean = 0, tones = ['light', 'mid', 'lime'], seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const r = new RNG(seed);
  const blades = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const rot = lean + (u - 0.5) * spread + r.range(-0.12, 0.12);
    const tone = r.pick(tones);
    blades.push({ rot, len: len * r.range(0.5, 1), curl: rot * 0.6 + r.range(-0.12, 0.12), color: adjust(o.color ?? pal.leaf[tone] ?? tone, { l: r.range(-0.05, 0.05) }) });
  }
  blades.sort((a, b) => b.len - a.len);
  for (const b of blades) drawBlade(ctx, { x: x + r.range(-1, 1) * len * 0.05, y, len: b.len, width: width * r.range(0.8, 1.2), rot: b.rot, curl: b.curl, color: b.color, palette: pal, light, seed: r.int(1, 1e6) });
}

// Thin flowering sprig: a stem with small alternate leaves and an optional bud on top.
//   x, y  base    h  height    lean  top offset as a fraction of h    leaves  leaf count
export function drawSprig(ctx, o = {}) {
  const { x = 0, y = 0, h = 140, lean = 0, bow = 0.04, leaves = 4, leafLen = 30, width = 2.6, bud = true, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const r = new RNG(seed);
  const col = o.color ?? pal.stem;
  const pts = curve([x, y], [x + lean * h, y - h], bow * h * r.sign(), 14);
  let side = r.sign();
  for (let i = 0; i < leaves; i++) {
    const t = 0.2 + 0.7 * (i / Math.max(1, leaves - 1)) + r.range(-0.04, 0.04);
    const { p, ang } = along(pts, t);
    side = -side;
    const len = leafLen * (1 - t * 0.4) * r.range(0.8, 1.15);
    drawLeaf(ctx, { x: p[0], y: p[1], len, width: 0.22, rot: ang + Math.PI / 2 + side * r.range(0.6, 1.0), curl: side * 0.1, veins: 0, color: adjust(o.leafColor ?? pal.leaf.light, { l: r.range(-0.05, 0.05) }), palette: pal, light, seed: r.int(1, 1e6) });
  }
  drawStem(ctx, pts, { width, tipWidth: width * 0.7, color: col, light, seed: r.int(1, 1e6) });
  if (bud) {
    const tip = pts[pts.length - 1];
    const bc = bud === true ? pal.daisy.petal : bud;
    const bp = piece(ctx, blob(tip[0], tip[1] - width * 1.2, width * 1.3, width * 1.8, r, { n: 10, irregular: 0.12 }), {
      fill: linearAlong(ctx, [tip[0], tip[1]], [tip[0], tip[1] - width * 3], [shade(bc, -0.25), bc]),
      smooth: true, shadow: leafShadow(light, 0.4, 2),
    });
    bevelOf(ctx, bp, light, { width: 0.8, hi: 0.3, lo: 0.2, soft: 0.2 });
  }
}

// --- Fern -----------------------------------------------------------------------------------

// Fern frond: a curving rachis lined with serrated pinnae that grow, then shrink to the tip.
//   len  frond length    rot  direction of the frond (0 = up)    curl  how far it arches over
//   pinnae  pairs of pinnae (default: as many as fit side by side)
//   reach   longest pinna as a fraction of len
export function drawFern(ctx, o = {}) {
  const { x = 0, y = 0, len = 220, rot = 0, curl = 0.25, reach = 0.26, angle = 1.0, seed = 1, light = DEFAULT_LIGHT } = o;
  const pinnae = o.pinnae ?? Math.max(8, Math.min(20, Math.round(0.86 / (reach * 0.3))));
  const pal = floraPalette(o.palette);
  const r = new RNG(seed);
  const col = o.color ?? pal.fern.mid;
  // Rachis: a curve bending toward the curl side.
  const rachis = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const a = rot + curl * t * t * 1.6;
    const prev = rachis[i - 1] ?? [x, y];
    const step = len / 30;
    rachis.push(i === 0 ? [x, y] : [prev[0] + Math.sin(a) * step, prev[1] - Math.cos(a) * step]);
  }
  const items = [];
  for (let i = 0; i < pinnae; i++) {
    const t = 0.1 + 0.86 * (i / (pinnae - 1));
    // Widest a third of the way up, tapering to the tip.
    const prof = t < 0.32 ? 0.62 + 0.38 * (t / 0.32) : Math.pow((1 - t) / 0.68, 0.8);
    for (const s of [-1, 1]) {
      const tt = t + (s > 0 ? 0.012 : 0);
      const { p, ang } = along(rachis, tt);
      const plen = len * reach * Math.max(0.12, prof) * r.range(0.88, 1.08);
      // ang points along the rachis toward the tip; pinnae sweep forward from it.
      items.push({ p, rot: ang + Math.PI / 2 + s * (Math.PI / 2 - angle * 0.55) , plen, s, t });
    }
  }
  for (const it of items) {
    const c = adjust(col, { l: r.range(-0.04, 0.04) + it.t * 0.05, h: r.range(-0.01, 0.01) });
    const base = [it.p[0], it.p[1]];
    const tip = [base[0] + Math.sin(it.rot) * it.plen, base[1] - Math.cos(it.rot) * it.plen];
    foldedBlade(ctx, it.plen, it.plen * 0.19, { base: 0.75, belly: 0.25, taper: 0.9, tip: 0.05, curl: it.s * 0.08, serrate: { count: Math.max(3, Math.round(it.plen / 11)), depth: 0.4 }, n: 40 },
      { x: base[0], y: base[1], rot: it.rot },
      {
        fill: linearAlong(ctx, base, tip, [shade(c, -0.2), c, shade(c, 0.1)]),
        light,
        shadow: leafShadow(light, 0.38, 2.5),
        dark: 0.18, lift: 0.1, crease: 0.3,
        bevel: { width: 1, hi: 0.3, lo: 0.22, soft: 0.3 },
      });
  }
  drawStem(ctx, rachis, { width: Math.max(1.6, len * 0.012), tipWidth: 0.8, color: shade(col, -0.12), light, seed: r.int(1, 1e6) });
  return rachis;
}

// --- Clover / wood sorrel --------------------------------------------------------------------

// Classic heart curve, point at the origin, notch at (0, -1) direction, scaled to size r.
function heart(r) {
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const th = (i / 40) * TAU;
    const hx = 16 * Math.sin(th) ** 3;
    const hy = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th);
    // Shift so the point sits at the origin and the lobes point up (-y).
    pts.push([hx * r / 32, -(hy + 17) * r / 30]);
  }
  return pts;
}

// Three heart-shaped leaflets folded along their middles, on a thin stalk.
//   x, y  centre of the leaf    r  leaflet length    squash  foreshortening of the leaf plane
export function drawClover(ctx, o = {}) {
  const { x = 0, y = 0, r = 30, rot = 0, squash = 0.8, leaflets = 3, seed = 1, light = DEFAULT_LIGHT, stalk = null } = o;
  const pal = floraPalette(o.palette);
  const P = pal.clover;
  const rng = new RNG(seed);
  if (stalk) drawStem(ctx, curve(stalk, [x, y], (stalk[0] - x) * 0.15, 10), { width: Math.max(1.6, r * 0.07), color: shade(P.leaf, -0.15), light });
  const order = [];
  for (let i = 0; i < leaflets; i++) {
    const a = rot + (i / leaflets) * TAU + rng.range(-0.12, 0.12) - Math.PI / 2;
    order.push(a);
  }
  // Leaflets pointing up are further away on a tilted leaf: draw them first.
  order.sort((p, q) => Math.sin(p) - Math.sin(q));
  for (const a of order) {
    const col = adjust(o.color ?? P.leaf, { l: rng.range(-0.04, 0.04) + Math.sin(a) * 0.03 });
    const M = (pts) => transform(pts, { rot: a + Math.PI / 2, sx: rng.range(0.94, 1.06) }).map(([px, py]) => [x + px, y + py * squash]);
    const outline = M(heart(r));
    const tip = M([[0, -r]])[0];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.1);
    g.addColorStop(0, shade(col, -0.2));
    g.addColorStop(0.35, mix(col, P.light, 0.35));
    g.addColorStop(0.8, col);
    g.addColorStop(1, shade(col, -0.08));
    const path = piece(ctx, outline, { fill: g, smooth: true, shadow: leafShadow(light, 0.42, 4) });
    // Fold along the leaflet's middle, from the stalk to the notch.
    const mid = [[x, y], tip];
    const nx = -(tip[1] - y), ny = tip[0] - x;
    const nl = Math.hypot(nx, ny) || 1;
    const far = r * 3;
    foldShade(ctx, path, [[x, y], tip, [tip[0] + (nx / nl) * far, tip[1] + (ny / nl) * far], [x + (nx / nl) * far, y + (ny / nl) * far]], [nx / nl, ny / nl], light, { dark: 0.2, lift: 0.08 });
    foldShade(ctx, path, [[x, y], tip, [tip[0] - (nx / nl) * far, tip[1] - (ny / nl) * far], [x - (nx / nl) * far, y - (ny / nl) * far]], [-nx / nl, -ny / nl], light, { dark: 0.2, lift: 0.08 });
    creaseLine(ctx, path, mid, light, 0.35);
    bevelOf(ctx, path, light, { width: 1.5, hi: 0.36, lo: 0.24, soft: 0.5 });
  }
}

// --- Lobed shrub clump (ref02 yellow-green bushes) ----------------------------------------

// A lobed leaf cut from one sheet, like lady's mantle or a small oak leaf: the outline
// radius swells into `lobes` uneven lobes separated by sharp sinuses.
export function drawLobedLeaf(ctx, o = {}) {
  const { x = 0, y = 0, r = 26, rot = 0, lobes = 6, depth = 0.38, stretch = 1.2, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const rng = new RNG(seed);
  const col = adjust(o.color ?? pal.shrub.top, { l: rng.range(-0.04, 0.04) });
  const size = Array.from({ length: lobes }, () => rng.range(0.78, 1.12));
  const local = [];
  const N = lobes * 12;
  // Centred above its base; lobe 0 points down into the stalk and is kept small.
  for (let i = 0; i < N; i++) {
    const th = Math.PI / 2 + (i / N) * TAU;
    const f = (i / N) * lobes;
    const k = Math.floor(f), u = f - k;
    const s = u * u * (3 - 2 * u);
    const lobeSize = size[k % lobes] * (1 - s) + size[(k + 1) % lobes] * s;
    const bump = Math.pow(Math.abs(Math.sin(Math.PI * (f + 0.5))), 0.5);
    const near = Math.min(f, lobes - f);              // distance from the stalk, in lobes
    const stalk = near < 0.5 ? 0.35 + 0.65 * (near / 0.5) : 1;
    const rr = r * (1 - depth + depth * bump) * lobeSize * stalk;
    local.push([Math.cos(th) * rr, Math.sin(th) * rr * stretch - r * stretch * 0.85]);
  }
  const pts = transform(local, { x, y, rot });
  const top = transform([[0, -r * stretch * 1.9]], { x, y, rot })[0];
  const path = piece(ctx, pts, {
    fill: linearAlong(ctx, [x, y], top, [shade(col, -0.3), col, shade(col, 0.1)]),
    smooth: true,
    shadow: leafShadow(light, 0.42, 4),
  });
  // Pressed veins fanning from the base into each lobe.
  for (let i = 0; i < lobes; i++) {
    const a = -Math.PI / 2 + (i - (lobes - 1) / 2) * (Math.PI * 1.2 / lobes);
    const vein = transform([[0, -r * 0.15], [Math.cos(a) * r * 0.8, -r * stretch * 0.92 + Math.sin(a) * r * 0.8 * stretch]], { x, y, rot });
    creaseLine(ctx, path, vein, light, 0.22, 0.9);
  }
  bevelOf(ctx, path, light, { width: 1.4, hi: 0.36, lo: 0.24, soft: 0.5 });
  return path;
}

// A mound of lobed leaves on thin stalks, bright on top, greener and shaded below.
//   x, y  centre of the base    w, h  mound size    leaf  leaf radius
export function drawShrub(ctx, o = {}) {
  const { x = 0, y = 0, w = 200, h = 110, leaf = 22, density = 1, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const P = pal.shrub;
  const rng = new RNG(seed);
  const crown = (u) => Math.pow(Math.max(0, 1 - u * u), 0.6);   // mound height profile, u in -1..1
  // A shaded core so no gaps show between the leaves.
  const core = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 12 - 1;
    core.push([x + u * w * 0.46, y - crown(u) * h * 0.7]);
  }
  piece(ctx, [...core, [x + w * 0.46, y + 6], [x - w * 0.46, y + 6]], {
    fill: linearAlong(ctx, [x, y - h * 0.7], [x, y], [P.low, shade(P.dark, -0.35)]),
    torn: { amp: leaf * 0.25, freq: 0.06, fine: 1, seed: rng.int(1, 1e6) },
    shadow: leafShadow(light, 0.45, 6),
  });
  const n = Math.round(((w * h) / (leaf * leaf * 1.7)) * density);
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const u = rng.range(-1, 1);
    const v = Math.pow(rng.next(), 0.6);
    const lx = x + u * w * 0.5;
    const ly = y - v * crown(u) * h * 0.92 + leaf * 0.5;
    const height = Math.max(0, (y - ly) / h);   // 0 at the base, 1 at the crown
    leaves.push({ lx, ly, height, r: leaf * rng.range(0.8, 1.15) * (0.75 + height * 0.45) });
  }
  // Crown leaves stand on short stalks.
  for (const L of leaves) {
    if (L.height < 0.45 || !rng.chance(0.6)) continue;
    const b = [L.lx + rng.range(-1, 1) * leaf * 0.4, L.ly + leaf * rng.range(1.4, 2.4)];
    drawStem(ctx, curve(b, [L.lx, L.ly], rng.range(-4, 4), 6), { width: Math.max(1.4, leaf * 0.09), tipWidth: 1, color: P.stem, light, shadow: false, seed: rng.int(1, 1e6) });
  }
  // Higher leaves are further back on the mound: draw them first.
  leaves.sort((a, b) => a.ly - b.ly);
  for (const L of leaves) {
    const c = L.height > 0.6 ? mix(P.top, P.mid, rng.next() * 0.45) : L.height > 0.3 ? mix(P.mid, P.low, rng.next()) : mix(P.low, P.dark, rng.next() * 0.7);
    drawLobedLeaf(ctx, { x: L.lx, y: L.ly + L.r * 0.9, r: L.r, rot: ((L.lx - x) / w) * 0.9 + rng.range(-0.4, 0.4), lobes: rng.int(5, 7), color: c, light, seed: rng.int(1, 1e6) });
  }
}

// --- Moss ---------------------------------------------------------------------------------

// A low cushion of moss: a dark mound bristling with tiny lighter leaf scales.
export function drawMoss(ctx, o = {}) {
  const { x = 0, y = 0, w = 120, h = 40, scale = 1, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const P = pal.moss;
  const rng = new RNG(seed);
  const mound = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const hh = Math.sin(u * Math.PI) ** 0.7 * h * rng.range(0.85, 1.1);
    mound.push([x - w / 2 + u * w, y - hh]);
  }
  const path = piece(ctx, [...mound, [x + w / 2, y + 2], [x - w / 2, y + 2]], {
    fill: linearAlong(ctx, [x, y - h], [x, y], [P.mid, P.dark]),
    torn: { amp: 2 * scale, freq: 0.3, fine: 1.2 * scale, seed: rng.int(1, 1e6) },
    shadow: leafShadow(light, 0.4, 4),
  });
  const n = Math.round((w * h) / (14 * scale * scale));
  ctx.save();
  ctx.clip(path);
  for (let i = 0; i < n; i++) {
    const u = rng.next();
    const top = Math.sin(u * Math.PI) ** 0.7 * h;
    const px = x - w / 2 + u * w, py = y - rng.next() * top;
    const lit = 1 - (y - py) / (h + 1);
    const c = mix(P.light, P.dark, Math.min(1, lit * 0.8 + rng.next() * 0.3));
    scale9(ctx, px, py, rng.range(3, 6.5) * scale, rng.range(-0.6, 0.6), c);
  }
  ctx.restore();
  // Fringe of strands poking above the outline.
  for (let i = 0; i < mound.length * 3; i++) {
    const { p, ang } = along(mound, rng.next());
    scale9(ctx, p[0], p[1] + 2, rng.range(4, 8) * scale, ang - Math.PI / 2 + rng.range(-0.5, 0.5) + Math.PI, mix(P.light, P.mid, rng.next() * 0.6));
  }
  bevelOf(ctx, path, light, { width: 1.2, hi: 0.3, lo: 0.2, soft: 0.5 });
}

// One tiny pointed moss leaf (base at x, y).
function scale9(ctx, x, y, len, rot, color) {
  const pts = transform([[0, 0], [-len * 0.22, -len * 0.45], [0, -len], [len * 0.22, -len * 0.45]], { x, y, rot });
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

// --- Fly agaric --------------------------------------------------------------------------

// Red-capped, white-spotted amanita seen from slightly below: a broad flattened cap over a
// visible disc of gills, a cream stem flaring into the gills, and a frilled ring.
//   x, y  where the stem meets the ground    size  cap width    lean  stem tilt (radians)
//   tall  stem height as a fraction of size  spots  spot density (1 = default)
export function drawAmanita(ctx, o = {}) {
  const { x = 0, y = 0, size = 120, lean = 0, tall = 0.6, spots = 1, seed = 1, light = DEFAULT_LIGHT } = o;
  const P = floraPalette(o.palette).amanita;
  const rng = new RNG(seed);
  const T = (pts) => transform(pts, { x, y, rot: lean });
  const at = (px, py) => T([[px, py]])[0];
  const sh = size * tall;            // stem height up to the gills
  const sw = size * 0.12;            // stem half-width below the flare
  const capY = -sh;
  const rx = size / 2, ryU = size * 0.17;

  // Gills: a disc under the cap with lines radiating from where the stem meets it.
  const under = [];
  for (let i = 0; i <= 36; i++) {
    const th = (i / 36) * TAU;
    under.push([Math.cos(th) * rx * 0.96, capY + Math.sin(th) * ryU]);
  }
  const underPath = piece(ctx, T(under), { fill: linearAlong(ctx, at(0, capY - ryU), at(0, capY + ryU), [shade(P.gill, -0.35), shade(P.gill, -0.08), P.gill]) });
  ctx.save();
  ctx.clip(underPath);
  ctx.lineWidth = Math.max(0.7, size * 0.006);
  const hub = at(0, capY - ryU * 0.2);
  for (let i = 0; i < 40; i++) {
    const th = (i / 40) * TAU;
    const b = at(Math.cos(th) * rx, capY + Math.sin(th) * ryU);
    ctx.strokeStyle = rgba('#6a4a2a', Math.sin(th) > 0 ? 0.38 : 0.2);
    ctx.beginPath(); ctx.moveTo(hub[0], hub[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.restore();

  // Stem: bulbous foot, slim shaft, flaring where it meets the gills.
  const stem = T([
    [-sw * 1.45, 0], [-sw * 1.6, -sh * 0.1], [-sw * 1.1, -sh * 0.28], [-sw * 0.95, -sh * 0.6], [-sw * 1.1, -sh * 0.9], [-sw * 1.7, -sh - ryU * 0.1],
    [sw * 1.7, -sh - ryU * 0.1], [sw * 1.1, -sh * 0.9], [sw * 0.95, -sh * 0.6], [sw * 1.1, -sh * 0.28], [sw * 1.6, -sh * 0.1], [sw * 1.45, 0],
  ]);
  const stemPath = piece(ctx, stem, {
    fill: linearAlong(ctx, at(-sw * 1.5, -sh * 0.5), at(sw * 1.5, -sh * 0.5), [P.stemDark, P.stem, shade(P.stem, 0.12), P.stem, mix(P.stem, P.stemDark, 0.5)]),
    smooth: true,
    shadow: leafShadow(light, 0.45, 6),
  });
  // Fibrous grooves running up the stem, darker under the cap.
  ctx.save();
  ctx.clip(stemPath);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.8, size * 0.007);
  for (let i = 0; i < 9; i++) {
    const u = rng.range(-0.9, 0.9);
    const a = at(u * sw * 1.3, -sh * 0.04), m = at(u * sw * 0.95, -sh * 0.55), b = at(u * sw * 1.6, -sh);
    ctx.strokeStyle = rgba(P.stemDark, 0.4);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]); ctx.stroke();
  }
  ctx.restore();
  shadeOver(ctx, ...at(0, capY + ryU * 0.3), sw * 2.4, sh * 0.35, 0.5, '#3a2210');
  bevelOf(ctx, stemPath, light, { width: 1.6, hi: 0.35, lo: 0.25 });

  // Frilled ring hanging a little below the gills.
  const ringY = capY + sh * 0.2;
  const skirt = [[-sw * 1.05, ringY - sh * 0.05]];
  const sk = 10;
  for (let i = 0; i <= sk; i++) {
    const px = -sw * 1.55 + (i / sk) * sw * 3.1;
    skirt.push([px, ringY + sh * 0.14 + (i % 2 ? -sh * 0.05 : sh * 0.015) * rng.range(0.7, 1.2)]);
  }
  skirt.push([sw * 1.05, ringY - sh * 0.05]);
  const skirtPath = piece(ctx, T(skirt), {
    fill: linearAlong(ctx, at(0, ringY - sh * 0.05), at(0, ringY + sh * 0.15), [shade(P.stem, 0.08), P.stem, P.stemDark]),
    shadow: leafShadow(light, 0.45, 4),
  });
  creaseLine(ctx, skirtPath, T([[-sw * 0.6, ringY], [-sw * 0.8, ringY + sh * 0.12]]), light, 0.25);
  creaseLine(ctx, skirtPath, T([[sw * 0.5, ringY], [sw * 0.7, ringY + sh * 0.12]]), light, 0.25);
  bevelOf(ctx, skirtPath, light, { width: 1.2, hi: 0.35, lo: 0.25 });

  // Cap: a broad flattened dome; its lower edge curls into a cream rim over the gills.
  const ch = size * 0.3;
  const cap = [];
  for (let i = 0; i <= 40; i++) {
    const u = -Math.cos((i / 40) * Math.PI);        // denser samples near the rim
    cap.push([u * rx, capY - ch * Math.pow(Math.max(0, 1 - u * u), 0.5)]);
  }
  for (let i = 1; i < 18; i++) {
    const th = (i / 18) * Math.PI;
    cap.push([Math.cos(th) * rx, capY + Math.sin(th) * size * 0.03]);
  }
  const hl = at(rx * 0.25 + light[0] * rx * 0.2, capY - ch * 0.8);
  const g = ctx.createRadialGradient(hl[0], hl[1], 0, hl[0], hl[1], size * 0.75);
  g.addColorStop(0, P.capLight);
  g.addColorStop(0.4, P.cap);
  g.addColorStop(0.85, mix(P.cap, P.capDark, 0.5));
  g.addColorStop(1, P.capDark);
  const capPath = piece(ctx, T(cap), { fill: g, shadow: { color: 'rgba(30,4,4,0.5)', blur: 6, x: -light[0] * 2, y: 3.5 } });
  ctx.save();
  ctx.clip(capPath);
  // Mottling: soft darker patches cut from slightly different red paper.
  for (let i = 0; i < 6; i++) {
    const px = rng.range(-0.8, 0.8) * rx, py = capY - ch * rng.range(0.2, 0.8);
    ctx.fillStyle = rgba(P.capDark, rng.range(0.1, 0.2));
    const m = T(blob(px, py, size * rng.range(0.08, 0.16), size * rng.range(0.04, 0.08), rng, { n: 10, irregular: 0.3 }));
    ctx.beginPath(); m.forEach(([mx, my], k) => (k ? ctx.lineTo(mx, my) : ctx.moveTo(mx, my))); ctx.fill();
  }
  // Cream rim along the lower edge.
  const rim = [];
  for (let i = 0; i <= 24; i++) {
    const th = Math.PI - (i / 24) * Math.PI;
    rim.push([Math.cos(th) * rx * 1.02, capY + Math.sin(th) * size * 0.03 + 1]);
  }
  for (let i = 0; i <= 24; i++) {
    const th = (i / 24) * Math.PI;
    rim.push([Math.cos(th) * rx * 1.02, capY - size * 0.035 + Math.sin(th) * size * 0.018]);
  }
  piece(ctx, T(rim.reverse()), { fill: mix(P.spot, P.gill, 0.5), alpha: 0.95 });
  ctx.restore();
  // Spots: flakes of white paper, foreshortened toward the edges of the dome.
  const n = Math.round((10 + size * 0.1) * spots);
  for (let i = 0; i < n; i++) {
    const u = rng.range(-0.92, 0.92);
    const v = rng.range(0.12, 0.92) * Math.pow(Math.max(0, 1 - u * u), 0.5);
    const px = u * rx, py = capY - ch * v;
    const s = size * rng.range(0.014, 0.034) * (1 - Math.abs(u) * 0.4) * (rng.chance(0.15) ? 1.7 : 1);
    const flake = blob(px, py, s * (1 - Math.abs(u) * 0.45), s * 0.75, rng, { n: 9, irregular: 0.25 });
    const fp = piece(ctx, T(flake), { fill: mix(P.spot, P.gill, rng.next() * 0.4), smooth: true, shadow: { color: 'rgba(60,8,4,0.45)', blur: 2, x: -light[0], y: 1.4 } });
    bevelOf(ctx, fp, light, { width: 0.9, hi: 0.3, lo: 0.28 });
  }
  bevelOf(ctx, capPath, light, { width: 2, hi: 0.32, lo: 0.3 });
}
