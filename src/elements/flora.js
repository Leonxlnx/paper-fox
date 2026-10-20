// Paper flora: flowers and foliage for the foreground clusters that frame most scenes.
//
// Three levels of API:
//   draw*(ctx, opts)          paint one element inside any sprite's draw(ctx)
//   makePlant(S, item)        bake one element into sprites that sway about its stem base
//   addFlowerBed(S, opts)     a whole swaying cluster (preset or generated) on its own plane(s)
//   addMeadow(S, opts)        a cheap static band of small flowers for midground meadows

import { RNG, noise } from '../core/rng.js';
import { smoothstep } from '../core/ease.js';
import { W } from '../core/stage.js';
import { drawSprites } from '../core/sprite.js';
import { piece, linear } from '../core/piece.js';
import { mix, shade } from '../core/color.js';
import { floraPalette, breeze, curve, drawStem, DEFAULT_LIGHT, FLORA_PAPER } from './flora-kit.js';
import { drawEchinaceaPetals, drawConeflowerCone, drawEchinacea, drawDaisy, drawTansy, drawMarigold, drawZinnia, drawAstilbe, drawLupine, drawLarkspur } from './flora-flowers.js';
import { drawLeaf, drawBlade, drawTuft, drawUndergrowth, drawSprig, drawFern, drawClover, drawLobedLeaf, drawShrub, drawMoss, drawAmanita } from './flora-foliage.js';
import { FLOWER_BEDS } from './flora-beds.js';

export { FLORA_PALETTES, FLORA_PAPER, floraPalette, breeze, drawStem } from './flora-kit.js';
export { drawEchinaceaPetals, drawConeflowerCone, drawEchinacea, drawDaisy, drawTansy, drawMarigold, drawZinnia, drawAstilbe, drawLupine, drawLarkspur };
export { drawLeaf, drawBlade, drawTuft, drawUndergrowth, drawSprig, drawFern, drawClover, drawLobedLeaf, drawShrub, drawMoss, drawAmanita };
export { FLOWER_BEDS };

// --- Sprite boxes ---------------------------------------------------------------------------

function boxOf(pts, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
}

// Tip of a blade-like element of length len pointing along rot (0 = up).
const tipOf = (x, y, len, rot) => [x + Math.sin(rot) * len, y - Math.cos(rot) * len];

// Leaf colours may be given as palette names ('light', 'mid', 'dark', 'deep', 'yellow', 'lime').
function leafColor(pal, it, fallback) {
  const c = it.color ?? it.tone ?? fallback;
  return pal.leaf[c] ?? c;
}

// --- Plants -----------------------------------------------------------------------------------
// Each maker bakes the sprites of one element and returns
//   { x, y, sway, parts: [{ s, head, pass }] }
// where (x, y) is the pivot at the stem base, `head` (optional) marks parts that ride on
// the stem tip at that point, and `pass` orders parts within a row (stems, heads, cones).

const STEM_SHADOW = { blur: 5, alpha: 0.5 };
const HEAD_SHADOW = { blur: 8, alpha: 0.55 };
const LEAF_SHADOW = { blur: 7, alpha: 0.5 };

// Every piece already carries its own bevel, so sprites skip the silhouette edge pass
// unless asked for one (it costs three extra canvases per sprite).
function bake(S, ctxOpts, name, box, draw, opts = {}) {
  return S.sprite({ name, ...box, res: ctxOpts.res, mat: opts.mat ?? FLORA_PAPER, edge: opts.edge ?? false, shadow: opts.shadow ?? LEAF_SHADOW, draw });
}

function stemPart(S, o, it, pal, width, color) {
  if (!it.base) return [];
  const pts = curve(it.base, it.head, it.bow ?? (it.head[0] - it.base[0]) * 0.2, 14);
  const leaves = it.leaves ?? [];
  const extra = leaves.map((l) => tipOf(l.x ?? it.base[0], l.y ?? it.base[1], l.len, l.rot ?? 0));
  const s = bake(S, o, 'stem', boxOf([...pts, ...extra], 14 + width), (ctx) => {
    for (const l of leaves) drawLeaf(ctx, { ...l, x: l.x ?? it.base[0], y: l.y ?? it.base[1], color: leafColor(pal, l, 'mid'), palette: pal, light: o.light, seed: (it.seed ?? 1) + 31 });
    drawStem(ctx, pts, { width, tipWidth: width * 0.75, color: color ?? pal.stem, light: o.light, seed: it.seed ?? 1 });
  }, { shadow: STEM_SHADOW });
  return [{ s, pass: 0 }];
}

const MAKERS = {
  echinacea(S, o, it, pal) {
    const size = it.size ?? 110;
    const [hx, hy] = it.head;
    const coneW = it.coneW ?? size * 0.64;
    const opts = { ...it, x: hx, y: hy, size, palette: pal, light: o.light };
    const petals = bake(S, o, 'echinacea', boxOf([[hx - size * 1.2, hy - size * 0.95], [hx + size * 1.2, hy + size * 1.15]], 10), (ctx) => drawEchinaceaPetals(ctx, opts), { shadow: HEAD_SHADOW });
    const cone = bake(S, o, 'cone', boxOf([[hx - coneW * 0.6, hy - coneW * 0.75], [hx + coneW * 0.6, hy + coneW * 0.3]], 10), (ctx) => drawConeflowerCone(ctx, { ...opts, w: coneW, seed: (it.seed ?? 1) + 7 }), { mat: 'felt', shadow: { blur: 6, alpha: 0.5 } });
    return [...stemPart(S, o, it, pal, it.stemWidth ?? size * 0.055), { s: petals, head: true, pass: 1 }, { s: cone, head: true, pass: 2 }];
  },
  daisy(S, o, it, pal) {
    const r = it.r ?? 28;
    const [hx, hy] = it.head;
    const head = bake(S, o, 'daisy', boxOf([[hx - r, hy - r], [hx + r, hy + r]], 12), (ctx) => drawDaisy(ctx, { ...it, x: hx, y: hy, r, palette: pal, light: o.light }), { shadow: HEAD_SHADOW });
    return [...stemPart(S, o, it, pal, it.stemWidth ?? Math.max(2.2, r * 0.12)), { s: head, head: true, pass: 1 }];
  },
  marigold(S, o, it, pal) {
    const r = it.r ?? 40;
    const [hx, hy] = it.head;
    const head = bake(S, o, 'marigold', boxOf([[hx - r, hy - r], [hx + r, hy + r]], 12), (ctx) => drawMarigold(ctx, { ...it, x: hx, y: hy, r, palette: pal, light: o.light }), { shadow: HEAD_SHADOW });
    return [...stemPart(S, o, it, pal, it.stemWidth ?? Math.max(2.6, r * 0.1)), { s: head, head: true, pass: 1 }];
  },
  zinnia(S, o, it, pal) {
    const r = it.r ?? 40;
    const [hx, hy] = it.head;
    const head = bake(S, o, 'zinnia', boxOf([[hx - r, hy - r], [hx + r, hy + r]], 12), (ctx) => drawZinnia(ctx, { ...it, x: hx, y: hy, r, palette: pal, light: o.light }), { shadow: HEAD_SHADOW });
    return [...stemPart(S, o, it, pal, it.stemWidth ?? Math.max(2.6, r * 0.1)), { s: head, head: true, pass: 1 }];
  },
  tansy(S, o, it, pal) {
    const r = it.r ?? 18;
    const [hx, hy] = it.head;
    const head = bake(S, o, 'tansy', boxOf([[hx - r, hy - r], [hx + r, hy + r * 1.3]], 10), (ctx) => drawTansy(ctx, { ...it, x: hx, y: hy, r, palette: pal, light: o.light }), { mat: 'felt', shadow: HEAD_SHADOW });
    return [...stemPart(S, o, it, pal, it.stemWidth ?? Math.max(2.2, r * 0.16)), { s: head, head: true, pass: 1 }];
  },
  astilbe(S, o, it, pal) {
    const { x, y, h = 150, w = 64, lean = 0 } = it;
    const s = bake(S, o, 'astilbe', boxOf([[x, y], [x + lean * h, y - h]], w * 0.75 + 10), (ctx) => drawAstilbe(ctx, { ...it, palette: pal, light: o.light }), { shadow: HEAD_SHADOW });
    return [{ s, pass: 1 }];
  },
  lupine(S, o, it, pal) {
    const { x, y, h = 160, w = 36, lean = 0 } = it;
    const s = bake(S, o, 'lupine', boxOf([[x, y], [x + lean * h, y - h]], w * 0.8 + 10), (ctx) => drawLupine(ctx, { ...it, palette: pal, light: o.light }), { shadow: HEAD_SHADOW });
    return [{ s, pass: 1 }];
  },
  larkspur(S, o, it, pal) {
    const { x, y, h = 200, w = 70, lean = 0 } = it;
    const s = bake(S, o, 'larkspur', boxOf([[x, y], [x + lean * h, y - h]], w * 0.7 + 12), (ctx) => drawLarkspur(ctx, { ...it, palette: pal, light: o.light }), { shadow: HEAD_SHADOW });
    return [{ s, pass: 1 }];
  },
  leaf(S, o, it, pal) {
    const { x, y, len = 120, width = 0.2, rot = 0, curl = 0 } = it;
    const s = bake(S, o, 'leaf', boxOf([[x, y], tipOf(x, y, len, rot)], len * (width + Math.abs(curl)) + 12), (ctx) => drawLeaf(ctx, { ...it, color: leafColor(pal, it, 'mid'), palette: pal, light: o.light }));
    return [{ s, pass: 0 }];
  },
  undergrowth(S, o, it, pal) {
    const { x0 = 0, x1 = 600, y = 1080, h = 260, edge = null } = it;
    const top = edge ? Math.min(...edge.map((p) => p[1])) : y - h;
    const s = bake(S, o, 'undergrowth', boxOf([[x0, top], [x1, y + 70]], 60), (ctx) => drawUndergrowth(ctx, { ...it, palette: pal, light: o.light }), { shadow: { blur: 8, alpha: 0.45 } });
    return [{ s, pass: 0 }];
  },
  tuft(S, o, it, pal) {
    const { x, y, len = 160, spread = 0.9, lean = 0 } = it;
    const reach = len * Math.sin(Math.min(1.5, spread / 2 + Math.abs(lean) + 0.3)) + 20;
    const s = bake(S, o, 'tuft', boxOf([[x - reach, y - len], [x + reach, y]], 16), (ctx) => drawTuft(ctx, { ...it, palette: pal, light: o.light }));
    return [{ s, pass: 0 }];
  },
  sprig(S, o, it, pal) {
    const { x, y, h = 140, lean = 0, leafLen = 30 } = it;
    const s = bake(S, o, 'sprig', boxOf([[x, y], [x + lean * h, y - h]], leafLen + 14), (ctx) => drawSprig(ctx, { ...it, palette: pal, light: o.light }), { shadow: STEM_SHADOW });
    return [{ s, pass: 0 }];
  },
  blade(S, o, it, pal) {
    const { x, y, len = 200, width = 0.06, rot = 0, curl = 0.15 } = it;
    const s = bake(S, o, 'blade', boxOf([[x, y], tipOf(x, y, len, rot)], len * (width + Math.abs(curl)) + 12), (ctx) => drawBlade(ctx, { ...it, color: leafColor(pal, it, 'light'), palette: pal, light: o.light }));
    return [{ s, pass: 0 }];
  },
  fern(S, o, it, pal) {
    const { x, y, len = 220, rot = 0, curl = 0.25, reach = 0.26 } = it;
    const color = it.color ? (pal.fern[it.color] ?? it.color) : pal.fern.mid;
    const s = bake(S, o, 'fern', boxOf([[x, y], tipOf(x, y, len, rot + curl * 0.6)], len * (reach + Math.abs(curl) * 0.4) + 14), (ctx) => drawFern(ctx, { ...it, color, palette: pal, light: o.light }));
    return [{ s, pass: 0 }];
  },
  clover(S, o, it, pal) {
    const { x, y, r = 30 } = it;
    const pts = [[x - r * 1.1, y - r * 1.1], [x + r * 1.1, y + r * 1.1]];
    if (it.stalk) pts.push(it.stalk);
    const s = bake(S, o, 'clover', boxOf(pts, 12), (ctx) => drawClover(ctx, { ...it, palette: pal, light: o.light }));
    return [{ s, pass: 0 }];
  },
  shrub(S, o, it, pal) {
    const { x, y, w = 200, h = 110, leaf = 18 } = it;
    const s = bake(S, o, 'shrub', boxOf([[x - w / 2, y - h], [x + w / 2, y]], leaf * 2.6 + 10), (ctx) => drawShrub(ctx, { ...it, palette: pal, light: o.light }));
    return [{ s, pass: 0 }];
  },
  moss(S, o, it, pal) {
    const { x, y, w = 120, h = 40, scale = 1 } = it;
    const s = bake(S, o, 'moss', boxOf([[x - w / 2, y - h], [x + w / 2, y]], 10 * scale + 8), (ctx) => drawMoss(ctx, { ...it, palette: pal, light: o.light }));
    return [{ s, pass: 0 }];
  },
  amanita(S, o, it, pal) {
    const { x, y, size = 120, tall = 0.6, lean = 0 } = it;
    const top = [x + Math.sin(lean) * size * (tall + 0.4), y - size * (tall + 0.42)];
    const s = bake(S, o, 'amanita', boxOf([[x - size * 0.55, y], [x + size * 0.55, y], [top[0] - size * 0.55, top[1]], [top[0] + size * 0.55, top[1]]], 14), (ctx) => drawAmanita(ctx, { ...it, palette: pal, light: o.light }), { shadow: { blur: 10, alpha: 0.55 } });
    return [{ s, pass: 1 }];
  },
  // A dense mat of dark leaves that fills the gaps behind a cluster (baked at res 1: it
  // is large and sits in shadow).
  backing(S, o, it, pal) {
    const { x0, y0, x1, y1 } = it;
    const s = bake(S, { ...o, res: 1 }, 'backing', boxOf([[x0, y0 - 120], [x1, y1]], 40), (ctx) => drawBacking(ctx, { ...it, palette: pal, light: o.light }), { shadow: { blur: 12, alpha: 0.5 } });
    return [{ s, pass: 0 }];
  },
};

// Sway sensitivity per element type (fraction of the breeze angle).
const SWAY = { echinacea: 1, daisy: 1.1, tansy: 1.15, marigold: 0.9, zinnia: 0.95, astilbe: 0.8, lupine: 0.7, larkspur: 0.8, sprig: 0.9, tuft: 0.55, undergrowth: 0.25, leaf: 0.45, blade: 0.6, fern: 0.55, clover: 0.35, shrub: 0.2, moss: 0, amanita: 0, backing: 0.12 };

// Foliage mass behind a cluster: a shadow sheet under overlapping leaves of mixed shapes,
// darkening toward the ground. Its top follows `edge` (a polyline of [x, y], left to
// right) or, without one, slopes down from the anchored side, so the far side breaks up
// into single leaves instead of ending in a wall.
//   x0, y0, x1, y1  region     anchor  'left' | 'right' | 'none'     edge  [[x, y], ...]
//   tones  { top, bottom } palette leaf names (or colours) for the upper and lower leaves
export function drawBacking(ctx, o = {}) {
  const { x0, y0, x1, y1, anchor = 'left', edge = null, density = 1, seed = 1, light = DEFAULT_LIGHT } = o;
  const pal = floraPalette(o.palette);
  const tone = (k) => pal.leaf[k] ?? k;
  const topTone = tone(o.tones?.top ?? 'dark'), lowTone = shade(tone(o.tones?.bottom ?? 'deep'), -0.35);
  const r = new RNG(seed);
  const nz = noise(seed);
  const tall = y1 - y0;
  // Slope over the part of the region that is on screen.
  const v0 = Math.max(x0, 0), v1 = Math.min(x1, W);
  const far = (x) => {
    const u = Math.max(0, Math.min(1, (x - v0) / (v1 - v0)));
    return anchor === 'left' ? u : anchor === 'right' ? 1 - u : Math.abs(u - 0.5) * 2;
  };
  const wob = (x) => nz.n1(x * 0.012) * 22;
  const top = edge
    ? (x) => {
      if (x <= edge[0][0]) return edge[0][1] + wob(x);
      for (let i = 1; i < edge.length; i++) {
        if (x <= edge[i][0]) {
          const k = smoothstep(edge[i - 1][0], edge[i][0], x);
          return edge[i - 1][1] + (edge[i][1] - edge[i - 1][1]) * k + wob(x);
        }
      }
      return edge[edge.length - 1][1] + wob(x);
    }
    : (x) => y0 + tall * (0.06 + 0.5 * smoothstep(0.3, 1, far(x))) + wob(x);
  // Leaves thin out where the top edge drops close to the bottom of the region.
  const sparse = (x) => (edge ? smoothstep(y1 - tall * 0.45, y1 - tall * 0.15, top(x)) : smoothstep(0.75, 1.05, far(x)));
  const sheet = [];
  for (let i = 0; i <= 48; i++) {
    const x = x0 + (i / 48) * (x1 - x0);
    sheet.push([x, top(x) + 55 + sparse(x) * 200]);
  }
  piece(ctx, [...sheet, [x1, y1 + 80], [x0, y1 + 80]], { fill: linear(ctx, 0, y0, 0, y1, [shade(topTone, -0.25), lowTone]) });
  const n = Math.round((((x1 - x0) * tall) / 2000) * density);
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    if (r.next() < sparse(x)) continue;
    const len = r.range(60, 150);
    const y = r.range(top(x) + len * 0.7, y1 + 60);
    const round = r.chance(0.15);
    leaves.push({ x, y, len, rot: r.range(-0.8, 0.8), width: round ? r.range(0.3, 0.42) : r.range(0.12, 0.22), round: round ? 0.7 : 0, belly: round ? 0.5 : 0.4, k: (y - top(x)) / (y1 - top(x) + 1) });
  }
  leaves.sort((a, b) => a.y - b.y);
  for (const L of leaves) {
    const c = mix(mix(topTone, lowTone, r.next() * 0.4), lowTone, Math.min(1, L.k * 0.9 + r.next() * 0.3));
    drawLeaf(ctx, { ...L, color: c, veins: 0, curl: r.range(-0.15, 0.15), palette: pal, light, seed: r.int(1, 1e6) });
  }
}

// Bake one element. item.type picks the maker; item fields are that draw function's options
// plus, for stemmed flowers, base: [x, y] (stem foot) and head: [x, y] (flower centre).
//   opts: { palette, light, res }
export function makePlant(S, item, opts = {}) {
  const pal = floraPalette(item.palette ?? opts.palette);
  const o = { light: opts.light ?? S.light, res: opts.res ?? 1 };
  const maker = MAKERS[item.type];
  if (!maker) throw new Error(`unknown flora type "${item.type}"`);
  const parts = maker(S, o, item, pal);
  const pivot = item.base ?? (item.x0 !== undefined ? [(item.x0 + item.x1) / 2, item.y1 ?? item.y] : [item.x ?? 0, item.y ?? 0]);
  return { type: item.type, x: pivot[0], y: pivot[1], head: item.head ?? null, sway: item.sway ?? SWAY[item.type] ?? 0.5, phase: item.phase ?? new RNG(`${item.type}:${pivot[0]}:${pivot[1]}`).next(), parts };
}

// Sprite placements of a plant at time t, pushed into per-pass lists.
function placePlant(p, t, wind, passes) {
  const th = p.sway ? breeze(t, p.x, { ...wind, phase: p.phase }) * p.sway : 0;
  let hx = 0, hy = 0, hrot = th;
  if (p.head) {
    const dx = p.head[0] - p.x, dy = p.head[1] - p.y;
    const c = Math.cos(th), s = Math.sin(th);
    hx = p.x + dx * c - dy * s;
    hy = p.y + dx * s + dy * c;
    // Heads nod a little on their own, a beat behind the stem.
    hrot = th * 1.3 + breeze(t - 0.35, p.head[0], { ...wind, amp: (wind.amp ?? 0.035) * 0.45, period: 2.7, phase: p.phase * 1.9 }) * p.sway;
  }
  for (const part of p.parts) {
    const it = part.head
      ? { s: part.s, ax: p.head[0], ay: p.head[1], x: hx, y: hy, rot: hrot }
      : { s: part.s, ax: p.x, ay: p.y, x: p.x, y: p.y, rot: th };
    passes[part.pass].push(it);
  }
}

// --- Beds --------------------------------------------------------------------------------------

// Map a preset item through a placement: mirror about x = W/2, scale about (ox, oy), offset.
function placeItem(it, { mirror = false, scale = 1, dx = 0, dy = 0, ox = 0, oy = 1080 }) {
  const P = ([x, y]) => {
    const mx = mirror ? W - x : x;
    return [ox + (mx - ox) * scale + dx, oy + (y - oy) * scale + dy];
  };
  const out = { ...it };
  for (const k of ['base', 'head', 'stalk']) if (it[k]) out[k] = P(it[k]);
  if (it.x !== undefined) [out.x, out.y] = P([it.x, it.y]);
  if (it.x0 !== undefined) {
    // Regions: backing uses x0, y0, x1, y1; undergrowth uses x0, x1 and a ground line y.
    const a = P([it.x0, it.y0 ?? it.y]), b = P([it.x1, it.y1 ?? it.y]);
    [out.x0, out.x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
    if (it.y0 !== undefined) [out.y0, out.y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    else out.y = a[1];
  }
  if (it.edge) {
    out.edge = it.edge.map(P);
    if (mirror) out.edge.reverse();
  }
  for (const k of ['size', 'r', 'len', 'h', 'w', 'coneW', 'leaf']) if (it[k] !== undefined) out[k] = it[k] * scale;
  if (Array.isArray(it.leaves)) out.leaves = it.leaves.map((l) => placeItem(l, { mirror, scale, dx, dy, ox, oy }));
  if (mirror) {
    for (const k of ['rot', 'lean', 'roll', 'curl', 'bow']) if (it[k] !== undefined) out[k] = -it[k];
    if (it.anchor) out.anchor = { left: 'right', right: 'left' }[it.anchor] ?? it.anchor;
  }
  return out;
}

// A swaying foreground cluster. Either a preset (FLOWER_BEDS key or object with rows) or
// rows of items you provide, or a generated bed (see generateBed).
//   z        plane depth (front row)          depth  z spread between first and last plane
//   planes   number of planes the rows are split over (1 = all on one plane)
//   preset   'night-lake' | 'dusk-bridge' | 'forest-left' | 'forest-right' | 'portal' | 'dawn'
//   rows     [[item, ...], ...] back to front        palette  name or overrides
//   mirror, scale, dx, dy, ox, oy   placement of the preset (scale about (ox, oy))
//   wind     breeze() options: { amp, period, gust, speed }
//   res      bake resolution of the sprites (default 1.25)
// Returns the list of added layers.
export function addFlowerBed(S, opts = {}) {
  const preset = typeof opts.preset === 'string' ? FLOWER_BEDS[opts.preset] : opts.preset;
  const rows = opts.rows ?? preset?.rows ?? generateBed(opts).rows;
  const palette = opts.palette ?? preset?.palette ?? 'night';
  const z = opts.z ?? 480;
  const nPlanes = Math.max(1, Math.min(rows.length, opts.planes ?? 1));
  const depth = opts.depth ?? (nPlanes > 1 ? 120 : 0);
  const wind = { amp: 0.035, ...(preset?.wind || {}), ...(opts.wind || {}) };
  const place = { mirror: opts.mirror, scale: opts.scale, dx: opts.dx, dy: opts.dy, ox: opts.ox, oy: opts.oy };
  const baked = rows.map((row) => row.map((it) => makePlant(S, placeItem(it, place), { palette, light: opts.light, res: opts.res })));
  const layers = [];
  for (let g = 0; g < nPlanes; g++) {
    const from = Math.floor((g * rows.length) / nPlanes), to = Math.floor(((g + 1) * rows.length) / nPlanes);
    const mine = baked.slice(from, to);
    const zg = nPlanes === 1 ? z : z + depth * (1 - g / (nPlanes - 1));
    layers.push(S.add({
      name: `flowerbed-${g}`, z: zg, order: opts.order ?? 0,
      render(ctx, t, env) {
        for (const row of mine) {
          const passes = [[], [], []];
          for (const p of row) placePlant(p, t, wind, passes);
          for (const items of passes) if (items.length) drawSprites(ctx, items, env.shadow);
        }
      },
    }));
  }
  return layers;
}

// --- Generated beds ---------------------------------------------------------------------------

const DEFAULT_MIX = { echinacea: 1.2, daisy: 3, tansy: 1.6, astilbe: 1, lupine: 0, leaf: 3, blade: 3 };

// A reference-like cluster from a region and a mix: back foliage, flowers by height, front leaves.
//   region  [x0, y0, x1, y1] (the cluster fills it, densest toward the bottom corner `anchor`)
//   anchor  'left' | 'right'       density  1 = like ref02        mix  relative counts per type
//   scale   element size multiplier       seed
export function generateBed({ region = [0, 600, 640, 1080], anchor = 'left', density = 1, mix: m = DEFAULT_MIX, scale = 1, seed = 'bed' } = {}) {
  const r = new RNG(seed);
  const [x0, y0, x1, y1] = region;
  const w = x1 - x0, h = y1 - y0;
  // Position biased toward the anchored bottom corner.
  const spot = (minY = 0) => {
    const u = Math.pow(r.next(), 1.3), v = minY + (1 - minY) * Math.pow(r.next(), 0.7);
    return [anchor === 'left' ? x0 + u * w : x1 - u * w, y0 + v * h];
  };
  const count = (k) => Math.round((m[k] ?? 0) * density * (w * h) / 300000 * 1.5);
  const ext = anchor === 'left' ? [x0 - 300, x1 + 40] : [x0 - 40, x1 + 300];
  const back = [{ type: 'backing', x0: ext[0], y0: y0 + h * 0.05, x1: ext[1], y1: y1 + 300, anchor, seed: r.int(1, 1e6) }];
  const leaves = [], flowers = [], front = [];
  for (let i = 0; i < count('leaf'); i++) {
    const [x, y] = spot(0.35);
    leaves.push({ type: 'leaf', x, y: y + 60, len: r.range(90, 170) * scale, width: r.range(0.14, 0.24), rot: r.range(-0.7, 0.7), curl: r.range(-0.12, 0.12), tone: r.pick(['mid', 'dark', 'light', 'lime']), seed: r.int(1, 1e6) });
  }
  for (let i = 0; i < count('blade'); i++) {
    const [x] = spot();
    leaves.push({ type: 'tuft', x, y: y1 + 40, n: r.int(5, 8), len: r.range(150, 260) * scale, spread: r.range(0.7, 1.1), seed: r.int(1, 1e6) });
  }
  const headed = (type, size, minY) => {
    const [x, y] = spot(minY);
    return { type, head: [x, y], base: [x + r.range(-30, 30), y1 + 80], seed: r.int(1, 1e6), ...size };
  };
  for (let i = 0; i < count('astilbe'); i++) {
    const [x] = spot();
    flowers.push({ type: 'astilbe', x, y: y1 + 40, h: r.range(220, 320) * scale, w: r.range(60, 110) * scale, lean: r.range(-0.08, 0.08), plume: r.range(0.4, 0.55), seed: r.int(1, 1e6) });
  }
  for (let i = 0; i < count('lupine'); i++) {
    const [x] = spot();
    flowers.push({ type: 'lupine', x, y: y1 + 40, h: r.range(240, 340) * scale, w: r.range(44, 70) * scale, lean: r.range(-0.08, 0.08), seed: r.int(1, 1e6) });
  }
  for (let i = 0; i < count('daisy'); i++) flowers.push(headed('daisy', { r: r.range(22, 36) * scale, rot: r.range(0, 1) }, 0.1));
  for (let i = 0; i < count('tansy'); i++) flowers.push(headed('tansy', { r: r.range(14, 22) * scale }, 0.2));
  for (let i = 0; i < count('echinacea'); i++) flowers.push(headed('echinacea', { size: r.range(95, 125) * scale, roll: r.range(-0.15, 0.15) }, 0.35));
  for (let i = 0; i < Math.ceil(count('blade') / 2); i++) {
    const [x] = spot();
    front.push({ type: 'blade', x, y: y1 + 60, len: r.range(160, 300) * scale, width: r.range(0.08, 0.12), rot: r.range(-0.45, 0.45), curl: r.range(-0.2, 0.2), tone: r.pick(['light', 'mid', 'light']), seed: r.int(1, 1e6) });
  }
  // Flowers lower on screen are nearer: later rows.
  const topOf = (f) => (f.head ? f.head[1] : f.y - f.h);
  flowers.sort((a, b) => topOf(a) - topOf(b));
  const third = Math.ceil(flowers.length / 3);
  return { rows: [back, leaves, flowers.slice(0, third), flowers.slice(third, third * 2), flowers.slice(third * 2), front] };
}

// --- Meadow band -----------------------------------------------------------------------------

// A static band of small flowers and grass for midground meadows, baked into one plane.
//   x0, x1  extent      y  ground line (bottom of the band)     h  band height
//   density 1 = lush    mix  relative counts { daisy, tansy, astilbe, lupine, grass, echinacea }
//   scale   flower size multiplier (1 suits z ~ 1200)
export function addMeadow(S, opts = {}) {
  const { z = 1300, x0 = -200, x1 = W + 200, y = 900, h = 120, density = 1, scale = 1, seed = 'meadow', res = 1 } = opts;
  const m = { daisy: 3, tansy: 2, astilbe: 1, lupine: 0.6, grass: 8, echinacea: 0.3, ...(opts.mix || {}) };
  const pal = floraPalette(opts.palette);
  const light = opts.light ?? S.light;
  const r = new RNG(seed);
  const items = [];
  const per = ((x1 - x0) / 100) * density;
  const add = (k, fn) => { for (let i = 0; i < Math.round(m[k] * per); i++) items.push(fn()); };
  add('grass', () => ({ k: 'grass', x: r.range(x0, x1), y: y + r.range(-h * 0.2, 6), len: r.range(0.35, 0.8) * h, rot: r.range(-0.5, 0.5) }));
  add('daisy', () => ({ k: 'daisy', x: r.range(x0, x1), y: y - r.range(0.25, 0.85) * h, r: r.range(6, 11) * scale }));
  add('tansy', () => ({ k: 'tansy', x: r.range(x0, x1), y: y - r.range(0.3, 0.8) * h, r: r.range(4, 7) * scale }));
  add('astilbe', () => ({ k: 'astilbe', x: r.range(x0, x1), y, hh: r.range(0.6, 1) * h, w: r.range(16, 26) * scale }));
  add('lupine', () => ({ k: 'lupine', x: r.range(x0, x1), y, hh: r.range(0.6, 1) * h, w: r.range(10, 14) * scale }));
  add('echinacea', () => ({ k: 'echinacea', x: r.range(x0, x1), y: y - r.range(0.4, 0.8) * h, size: r.range(18, 26) * scale }));
  // Taller things first so short flowers overlap their stems.
  items.sort((a, b) => (a.y - (a.hh ?? 0)) - (b.y - (b.hh ?? 0)));
  return S.plane(z, {
    name: 'meadow', x: x0 - 40, y: y - h * 1.3, w: x1 - x0 + 80, h: h * 1.3 + 50, res,
    shadow: { blur: 5, alpha: 0.45 },
    draw(ctx) {
      for (const it of items) {
        const sd = r.int(1, 1e6);
        if (it.k === 'grass') drawBlade(ctx, { x: it.x, y: it.y, len: it.len, width: 0.07, rot: it.rot, curl: it.rot * 0.4, color: mix(pal.leaf.light, pal.leaf.mid, r.next()), palette: pal, light, seed: sd });
        else if (it.k === 'astilbe') drawAstilbe(ctx, { x: it.x, y: it.y, h: it.hh, w: it.w, plume: 0.5, palette: pal, light, seed: sd });
        else if (it.k === 'lupine') drawLupine(ctx, { x: it.x, y: it.y, h: it.hh, w: it.w, palette: pal, light, seed: sd });
        else {
          drawStem(ctx, curve([it.x + r.range(-4, 4), y + 4], [it.x, it.y], r.range(-4, 4), 8), { width: 1.6 * scale, color: pal.stem, light, shadow: false, seed: sd });
          if (it.k === 'daisy') drawDaisy(ctx, { x: it.x, y: it.y, r: it.r, rot: r.next(), palette: pal, light, seed: sd });
          else if (it.k === 'tansy') drawTansy(ctx, { x: it.x, y: it.y, r: it.r, palette: pal, light, seed: sd });
          else drawEchinacea(ctx, { x: it.x, y: it.y, size: it.size, palette: pal, light, seed: sd });
        }
      }
    },
  });
}

export { shade };
