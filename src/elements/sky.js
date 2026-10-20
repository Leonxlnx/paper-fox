// Sky family: paper backdrops, the star field, the guiding star, moon, sun and glows.
//
// Every element comes in two flavours:
//   drawX(ctx, ...)   paints flat shapes inside a sprite's draw(ctx) (static art)
//   addX(S, opts)     bakes sprites and adds animated planes to a Scene
// Positions are film pixels with the camera at rest; z follows the depth bands in
// docs/AUTHORING.md (backdrop 20000, stars / moon / sun 12000-16000).

import { W, H } from '../core/stage.js';
import { RNG, noise } from '../core/rng.js';
import { piece, bevelBands, radial } from '../core/piece.js';
import { ellipse, transform, tear, TAU } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { surface, blurred } from '../core/canvas.js';
import { drawSprites } from '../core/sprite.js';
import { mix, rgba } from '../core/color.js';
import { osc, clamp, lerp, smoothstep } from '../core/ease.js';

const OVER = 240; // backdrop overscan on every side

// ---------------------------------------------------------------------------
// Palettes. Gradient stops are [y, colour] in film px (camera at rest), sampled
// from the references so each palette lines up with its horizon. `relief` is the
// strength of the crumpled flake texture, `mottle` soft blotches of other tones.

export const SKY_PALETTES = {
  // ref02 / ref05: deep saturated navy, a touch brighter toward the horizon.
  night: {
    stops: [[-OVER, '#03122e'], [0, '#041636'], [150, '#061f47'], [330, '#09264f'], [600, '#0d2c58'], [H + OVER, '#10305e']],
    mottle: ['#16245c', '#020a1e', '#0a2a5c'], relief: 1,
    flecks: { count: 1100, color: '#f2c98a', max: 2.1, alpha: 0.95 },
    dust: { count: 1400, color: '#8fa6e6', max: 0.7, alpha: 0.2 },
  },
  // ref01: periwinkle top, violet, pink, peach, orange at the horizon.
  dusk: {
    stops: [[-OVER, '#3460b4'], [0, '#3c66b8'], [40, '#6669bd'], [95, '#8875bb'], [160, '#a87bb6'], [210, '#dc8794'], [250, '#f19a80'], [295, '#f8ae6c'], [380, '#fbbd6c'], [H + OVER, '#fcc97c']],
    mottle: ['#8a7ec8', '#f2b0a0', '#6c70bc'], mottleAlpha: [0.04, 0.1], relief: 0.35,
    flecks: { count: 160, color: '#f8cf92', max: 1.2, alpha: 0.55 },
    dust: { count: 700, color: '#fff2e0', max: 0.7, alpha: 0.2 },
  },
  // ref10: clear blue top, pale peach band, gold around the rising sun.
  dawn: {
    stops: [[-OVER, '#4a8bcc'], [0, '#4f8fce'], [60, '#779cca'], [120, '#bea6ac'], [170, '#dcaa80'], [230, '#f9b058'], [290, '#f8c162'], [360, '#f9c35e'], [H + OVER, '#facb6a']],
    mottle: ['#a9c2dc', '#f8d9a6', '#e9b98a'], mottleAlpha: [0.04, 0.1], relief: 0.3,
    flecks: { count: 110, color: '#fff0c8', max: 1.1, alpha: 0.45 },
    dust: { count: 700, color: '#fffaf0', max: 0.7, alpha: 0.2 },
  },
  // ref07: slate navy storm sky (seen through gaps in the storm clouds).
  storm: {
    stops: [[-OVER, '#22344e'], [0, '#273a56'], [150, '#344a66'], [300, '#425872'], [500, '#4c6178'], [H + OVER, '#55697e']],
    mottle: ['#3a4c66', '#141c2e', '#56687e'], mottleAlpha: [0.1, 0.25], relief: 0.9,
    flecks: { count: 140, color: '#e9d7a8', max: 1.1, alpha: 0.45 },
    dust: { count: 900, color: '#b6c2d8', max: 0.7, alpha: 0.2 },
  },
  // ref08: aurora night, navy with a teal lift low in the sky.
  aurora: {
    stops: [[-OVER, '#06142f'], [0, '#071838'], [180, '#0b2550'], [360, '#103462'], [600, '#163f68'], [H + OVER, '#1a4870']],
    mottle: ['#162a62', '#030c22', '#0f3a5c'], relief: 1.4,
    flecks: { count: 480, color: '#f0c886', max: 1.5, alpha: 0.85 },
    dust: { count: 1300, color: '#a8e0d0', max: 0.7, alpha: 0.2 },
  },
  // ref04: night fading to periwinkle and a peach glow at the horizon.
  twilight: {
    stops: [[-OVER, '#081f50'], [0, '#0b2558'], [45, '#102a5b'], [80, '#14316a'], [115, '#13346e'], [150, '#19407e'], [185, '#255399'], [218, '#3866af'], [240, '#4775bd'], [262, '#5f86cb'], [285, '#7b91cf'], [308, '#a69fcb'], [332, '#d4b0b8'], [355, '#ecbca8'], [H + OVER, '#f4c4a4']],
    mottle: ['#16306e', '#031033', '#3a56a8'], mottleAlpha: [0.08, 0.2], relief: 1,
    flecks: { count: 420, color: '#f0c886', max: 1.4, alpha: 0.8 },
    dust: { count: 1200, color: '#b9c8f4', max: 0.7, alpha: 0.2 },
  },
};

// Gold paper used for sky stars (ref02, sampled lit / mid / shaded).
export const STAR_GOLD = { lit: '#ffdb98', base: '#f7c274', shade: '#cf8f45' };
// The guiding star: brighter, warmer, glowing (ref01, ref03, ref05, ref07).
export const GUIDE_GOLD = { lit: '#ffe08c', base: '#fcc25c', shade: '#e88f22', glow: '#ffbd55', core: '#fff8e2' };
// Paler cream-gold for the cold night scenes (ref05, ref08, ref09).
export const GUIDE_GOLD_PALE = { lit: '#fff6d8', base: '#f9dc98', shade: '#e0ac5c', glow: '#ffc96e', core: '#fffbec' };

const pal = (p) => (typeof p === 'string' ? SKY_PALETTES[p] : p);

// ---------------------------------------------------------------------------
// Flake texture: the small-grained crumple of the reference skies and moons.

const flakeCache = new Map();

// Overlapping paper flakes as a soft-light relief map (mid grey = no change). Every
// flake is a small irregular polygon with a lit lip on its upper left and a shadowed
// lip on its lower right, so the sheet reads as finely crushed, embossed paper.
//   tone   spread of the flake faces (light and dark dabs)
//   hi/lo  opacity of the lit and shadowed lips
//   blur   softens everything (px); the tile still wraps seamlessly
export function flakeTexture({ size = 1024, density = 2.4, rMin = 4, rMax = 12, lip = 1.3, tone = 14, hi = 0.5, lo = 0.55, blur = 0, seed = 'flakes' } = {}) {
  const key = [size, density, rMin, rMax, lip, tone, hi, lo, blur, seed].join('|');
  let tex = flakeCache.get(key);
  if (tex) return tex;
  const { canvas, ctx } = surface(size, size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  paintFlakes(ctx, { size, density, rMin, rMax, lip, tone, hi, lo, seed });
  tex = blur > 0 ? blurTile(canvas, blur) : canvas;
  flakeCache.set(key, tex);
  return tex;
}

// Blur a tile without seams: blur a 3x3 repeat and keep the centre.
function blurTile(tile, px) {
  const N = tile.width, pad = Math.ceil(px * 3);
  const big = surface(N + pad * 2, N + pad * 2);
  for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) big.ctx.drawImage(tile, pad + ox, pad + oy);
  const out = surface(N, N);
  out.ctx.filter = `blur(${px}px)`;
  out.ctx.drawImage(big.canvas, -pad, -pad);
  return out.canvas;
}

function paintFlakes(ctx, { size, density, rMin, rMax, lip, tone, hi, lo, seed }) {
  const rng = new RNG(seed);
  const meanR = (rMin + rMax) / 2;
  const count = Math.round((size * size * density) / (Math.PI * meanR * meanR));
  const grey = (v) => { const g = Math.round(clamp(v, 0, 255)); return `rgb(${g},${g},${g})`; };
  for (let i = 0; i < count; i++) {
    const x = rng.next() * size, y = rng.next() * size;
    const rad = lerp(rMin, rMax, Math.pow(rng.next(), 1.6));
    const k = rng.int(5, 8), squash = rng.range(0.5, 1), rot = rng.next() * TAU;
    const pts = [];
    for (let j = 0; j < k; j++) {
      const a = (j / k) * TAU + rng.range(-0.35, 0.35);
      const rr = rad * rng.range(0.7, 1.15);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * squash]);
    }
    const path = new Path2D();
    transform(pts, { rot }).forEach(([px, py], j) => (j ? path.lineTo(px, py) : path.moveTo(px, py)));
    path.closePath();
    const face = grey(128 + rng.gauss() * tone);
    const h = hi * rng.range(0.6, 1.2), l = lo * rng.range(0.6, 1.2);
    // Draw at the wrapped positions too so the tile has no seams.
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const X = x + ox, Y = y + oy;
      if (X < -rad * 2 || Y < -rad * 2 || X > size + rad * 2 || Y > size + rad * 2) continue;
      ctx.setTransform(1, 0, 0, 1, X - lip * 0.7, Y - lip * 0.9);
      ctx.globalAlpha = h; ctx.fillStyle = '#e8e8e8'; ctx.fill(path);
      ctx.setTransform(1, 0, 0, 1, X + lip * 0.8, Y + lip * 1.1);
      ctx.globalAlpha = l; ctx.fillStyle = '#202020'; ctx.fill(path);
      ctx.setTransform(1, 0, 0, 1, X, Y);
      ctx.globalAlpha = 1; ctx.fillStyle = face; ctx.fill(path);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

// Blend a texture tile over the area painted so far (inside a sprite's draw).
//   amt    strength (above 1 applies a second pass), scale: tile size multiplier
//   mode   'soft-light' (default) or 'hard-light', which still bites on pale paper
export function overlayTexture(ctx, tex, { x, y, w, h, amt = 1, scale = 1, rot = 0, ox = 0, oy = 0, clip = null, mode = 'soft-light' }) {
  const pat = ctx.createPattern(tex, 'repeat');
  pat.setTransform(new DOMMatrix().translateSelf(ox, oy).rotateSelf(rot).scaleSelf(scale));
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.globalCompositeOperation = mode;
  ctx.fillStyle = pat;
  for (let a = amt; a > 0.001; a -= 1) {
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Glow: soft round lights baked once per colour, then only scaled per frame.

const FALLOFF = {
  soft: [[0, 1], [0.08, 0.78], [0.2, 0.45], [0.38, 0.2], [0.6, 0.07], [0.8, 0.02], [1, 0]],
  tight: [[0, 1], [0.06, 0.85], [0.15, 0.4], [0.3, 0.12], [0.55, 0.03], [1, 0]],
  wide: [[0, 0.55], [0.25, 0.4], [0.5, 0.18], [0.75, 0.05], [1, 0]],
};
const glowCache = new Map();

// Canvas holding a radial light of the given colour (alpha falloff only).
export function glowSprite(color, falloff = 'soft') {
  const key = `${color}|${falloff}`;
  let c = glowCache.get(key);
  if (!c) {
    const N = 256;
    const { canvas, ctx } = surface(N, N);
    ctx.fillStyle = radial(ctx, N / 2, N / 2, 0, N / 2, FALLOFF[falloff].map(([o, a]) => [o, rgba(color, a)]));
    ctx.fillRect(0, 0, N, N);
    c = canvas;
    glowCache.set(key, c);
  }
  return c;
}

// Draw a baked glow of radius r. Use inside an additive ('lighter') plane or set
// ctx.globalCompositeOperation yourself. sx / sy stretch it (e.g. a tall bloom).
export function drawGlow(ctx, x, y, r, color, alpha = 1, { falloff = 'soft', sx = 1, sy = 1 } = {}) {
  if (alpha <= 0.002 || r <= 0) return;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * Math.min(1, alpha);
  ctx.drawImage(glowSprite(color, falloff), x - r * sx, y - r * sy, r * 2 * sx, r * 2 * sy);
  ctx.globalAlpha = a;
}

// Additive plane of glows: items(t) returns [{ x, y, r, color, alpha, falloff, sx, sy }].
// order < 0 puts it behind the other planes at the same depth.
export function addGlow(S, { z = 14000, items, order = -1, alpha = 1, name = 'glow' }) {
  return S.add({
    name, z, order, blend: 'lighter', alpha,
    render(ctx, t) {
      for (const g of items(t)) drawGlow(ctx, g.x, g.y, g.r, g.color, g.alpha ?? 1, g);
    },
  });
}

// ---------------------------------------------------------------------------
// Backdrops

// Vertical gradient from [y, colour] stops (film px) over the box y0..y1.
function stopGradient(ctx, stops, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [y, c] of stops) g.addColorStop(clamp((y - y0) / (y1 - y0)), c);
  return g;
}

// Bake recipe for backdrops: the flake relief is painted in drawSky, the bake only
// adds broad crumple (scaled with the relief, since pale skies show its creases as
// cracks) and fibre. Fibre is used enlarged: at 1:1 the engine's small pattern
// rotation resamples its pixel grain into a faint lattice.
export function skyMat(relief = 1) {
  return [{ tex: 'crumple', amt: 0.32 * Math.min(1, relief), scale: 0.6 }, { tex: 'fiber', amt: 0.45, scale: 1.6 }];
}

// Flake recipes for backdrops: fine soft dabs plus a broader, softer layer.
export const SKY_FLAKES = {
  fine: { size: 768, density: 2, tone: 18, hi: 0.32, lo: 0.45, blur: 0.7, seed: 'sky-flakes' },
  broad: { rMin: 10, rMax: 28, lip: 2, density: 1.5, tone: 18, hi: 0.25, lo: 0.3, blur: 1.5, seed: 'sky-flakes-broad' },
};

// Paint a sky backdrop (gradient, mottling, light pools, flake relief, glitter).
//   palette  key of SKY_PALETTES or a palette object; stops overrides its gradient
//   glows    [{ x, y, r, color, alpha }] warm pools of light painted into the paper
//   relief   strength of the crumpled flakes (defaults to the palette's)
//   flecks / dust   false, or overrides for the gold glitter and the faint paper specks
export function drawSky(ctx, { x = -OVER, y = -OVER, w = W + OVER * 2, h = H + OVER * 2, palette = 'night', stops = null, glows = [], relief = null, flecks: fl = {}, dust = {}, seed = 'sky' } = {}) {
  const P = pal(palette);
  const rng = new RNG(`${seed}-mottle`);
  ctx.fillStyle = stopGradient(ctx, stops ?? P.stops, y, y + h);
  ctx.fillRect(x, y, w, h);
  // Mottling: big soft blotches, like a sheet dyed unevenly.
  for (let i = 0; i < 26 && P.mottle; i++) {
    const mx = x + rng.next() * w, my = y + rng.next() * h * 0.8, mr = rng.range(120, 380);
    const c = rng.pick(P.mottle);
    const [a0, a1] = P.mottleAlpha ?? [0.15, 0.35];
    ctx.fillStyle = radial(ctx, mx, my, 0, mr, [[0, rgba(c, rng.range(a0, a1))], [1, rgba(c, 0)]]);
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  }
  for (const g of glows) {
    const a = g.alpha ?? 0.6;
    ctx.fillStyle = radial(ctx, g.x, g.y, 0, g.r, [[0, rgba(g.color, a)], [0.35, rgba(g.color, a * 0.45)], [0.7, rgba(g.color, a * 0.12)], [1, rgba(g.color, 0)]]);
    ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
  }
  const rel = relief ?? P.relief ?? 1;
  if (rel > 0) {
    overlayTexture(ctx, flakeTexture(SKY_FLAKES.fine), { x, y, w, h, amt: rel * 1.2, ox: rng.range(0, 1024), oy: rng.range(0, 1024), rot: 7 });
    overlayTexture(ctx, flakeTexture(SKY_FLAKES.broad), { x, y, w, h, amt: rel * 0.45, rot: -11 });
  }
  if (P.dust && dust !== false) {
    const d = { ...P.dust, ...dust };
    flecks(ctx, x, y, w, h * 0.75, d.count, `${seed}-dust`, d);
  }
  if (P.flecks && fl !== false) {
    const f = { ...P.flecks, ...fl };
    flecks(ctx, x, y, w, h * (f.cover ?? 0.6), f.count, `${seed}-flecks`, f);
  }
}

// Add a baked sky backdrop plane. Returns the layer.
export function addSky(S, { z = 20000, palette = 'night', stops, glows, relief, flecks: fl, dust, seed = 'sky', mat = null, alpha = 1, x = -OVER, y = -OVER, w = W + OVER * 2, h = H + OVER * 2 } = {}) {
  mat ??= skyMat(relief ?? pal(palette).relief);
  return S.plane(z, {
    name: `sky-${typeof palette === 'string' ? palette : 'custom'}`, x, y, w, h, mat, edge: false, shadow: false,
    draw(ctx) { drawSky(ctx, { x, y, w, h, palette, stops, glows, relief, flecks: fl, dust, seed }); },
  }, { alpha });
}

// ---------------------------------------------------------------------------
// Star shapes

// Four-point sparkle with concave sides (the sky stars of ref02): a superellipse
// |x/rx|^p + |y/ry|^p = 1 with p < 1.
//   r      horizontal arm length; tall: vertical / horizontal arm ratio
//   pinch  the exponent p: 0.5 gives slim arms, 0.8 puffy ones (ref01 trail)
export function sparklePts(cx, cy, r, { tall = 1.1, pinch = 0.6, rot = 0, n = 72 } = {}) {
  const e = 2 / pinch;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([Math.sign(c) * Math.pow(Math.abs(c), e) * r, Math.sign(s) * Math.pow(Math.abs(s), e) * r * tall]);
  }
  return transform(pts, { x: cx, y: cy, rot });
}

// Straight-edged compass star (the guiding star). Main arms point up, right, down,
// left with lengths R * arms[i]; diag > 0 adds four shorter diagonal arms.
//   inner     radius of the notches between arms (fraction of R)
//   spread    for eight points: angle of the notches from the main axes (radians)
// Returns { pts, tips, notches, cx, cy } so callers can fold the arms into facets.
export function compassStar(cx, cy, R, { arms = [1, 0.9, 1.1, 0.9], diag = 0, inner = 0.3, spread = 0.46, rot = 0 } = {}) {
  const tips = [], notches = [];
  const eight = diag > 0;
  const n = eight ? 8 : 4;
  for (let i = 0; i < n; i++) {
    const a = rot - Math.PI / 2 + (i / n) * TAU;
    const main = !eight || i % 2 === 0;
    const len = R * (main ? arms[eight ? i / 2 : i] : diag);
    tips.push([cx + Math.cos(a) * len, cy + Math.sin(a) * len]);
    // Notch after this arm: with diagonals it hugs the diagonal so main arms stay broad.
    const an = eight ? a + (main ? spread : TAU / 8 - spread) : a + TAU / 8;
    const rn = R * inner * (eight ? 0.85 : 1);
    notches.push([cx + Math.cos(an) * rn, cy + Math.sin(an) * rn]);
  }
  const pts = [];
  for (let i = 0; i < n; i++) { pts.push(tips[i]); pts.push(notches[i]); }
  return { pts, tips, notches, cx, cy };
}

// Brightness (0..1) of a folded half-arm. The facet slopes down from the arm's
// ridge toward its side and from the raised centre toward the tip.
function facetLight(along, side, light) {
  const nx = side[0] * 0.8 + along[0] * 0.4, ny = side[1] * 0.8 + along[1] * 0.4;
  return clamp((nx * light[0] + ny * light[1]) * 0.5 + 0.5);
}

const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

function facetFill(gold, k, contrast) {
  const kk = clamp(0.5 + (k - 0.5) * contrast);
  return kk > 0.5 ? mix(gold.base, gold.lit, (kk - 0.5) * 2) : mix(gold.shade, gold.base, kk * 2);
}

// Paint a folded compass star: every arm is two facets, one lit and one shaded.
export function drawFoldedStar(ctx, star, { gold = GUIDE_GOLD, light = [0.55, -0.83], contrast = 1, bevel = true } = {}) {
  const { pts, tips, notches, cx, cy } = star;
  const n = tips.length;
  const outline = piece(ctx, pts, { fill: gold.base });
  for (let i = 0; i < n; i++) {
    const T = tips[i];
    const along = unit(T[0] - cx, T[1] - cy);
    for (const N of [notches[(i - 1 + n) % n], notches[i]]) {
      // Side direction: from the arm's ridge line toward this notch.
      const d = (N[0] - cx) * along[0] + (N[1] - cy) * along[1];
      const side = unit(N[0] - cx - along[0] * d, N[1] - cy - along[1] * d);
      piece(ctx, [[cx, cy], T, N], { fill: facetFill(gold, facetLight(along, side, light), contrast) });
    }
  }
  if (bevel) bevelBands(ctx, outline, { light, width: 1.2, hi: 0.4, lo: 0.3, soft: 0.4 });
  return outline;
}

// Paint one gold paper sky star (sparkle). fold: strength of the lit / shaded
// halves on each arm (0 = flat).
export function drawPaperStar(ctx, x, y, r, { gold = STAR_GOLD, light = [0.55, -0.83], fold = 0.5, tall = 1.1, pinch = 0.6, rot = 0, bevel = true } = {}) {
  const path = piece(ctx, sparklePts(x, y, r, { tall, pinch, rot }), { fill: gold.base });
  if (fold > 0) {
    ctx.save();
    ctx.clip(path);
    const R = r * tall * 1.3;
    for (let k = 0; k < 4; k++) {
      const tip = rot - Math.PI / 2 + k * (TAU / 4);
      const along = [Math.cos(tip), Math.sin(tip)];
      for (const sgn of [-1, 1]) {
        const side = [Math.cos(tip + sgn * Math.PI / 2), Math.sin(tip + sgn * Math.PI / 2)];
        const f = facetLight(along, side, light);
        const b = tip + sgn * (TAU / 8);
        ctx.fillStyle = f > 0.5 ? rgba(gold.lit, (f - 0.5) * 2 * fold) : rgba(gold.shade, (0.5 - f) * 2 * fold);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + along[0] * R, y + along[1] * R);
        ctx.lineTo(x + Math.cos(b) * R, y + Math.sin(b) * R);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }
  if (bevel) bevelBands(ctx, path, { light, width: Math.max(0.7, r * 0.05), hi: 0.45, lo: 0.3, soft: 0.5 });
  return path;
}

// ---------------------------------------------------------------------------
// Star field

// ref02 sky stars in film px (centre, horizontal arm). Used as the night default.
export const REF02_STARS = [
  { x: 1055, y: 108, r: 32 }, { x: 1294, y: 224, r: 23 }, { x: 908, y: 78, r: 23 },
  { x: 1761, y: 55, r: 21.5 }, { x: 1216, y: 62, r: 21 }, { x: 1366, y: 70, r: 18.5 },
  { x: 1141, y: 145, r: 12.5 }, { x: 1846, y: 101, r: 7 }, { x: 852, y: 234, r: 5.6 },
  { x: 841, y: 38, r: 5.6 }, { x: 1794, y: 346, r: 5.2 }, { x: 268, y: 42, r: 7 },
];
export const REF02_DOTS = [
  [796, 235], [1309, 77], [981, 31], [1039, 196], [1356, 251], [1121, 34], [976, 239],
  [1283, 122], [983, 133], [1214, 200], [1671, 30], [1166, 248], [1306, 32], [1360, 157],
  [640, 29], [1844, 155], [1873, 172], [1619, 336], [1508, 120], [1722, 210],
];

// Random star list over a region: many small stars, a few big ones, kept apart.
//   avoid  [[x, y, radius], ...] discs to keep clear (moon, sun, guiding star)
export function scatterStars({ region = [0, 0, W, 520], count = 18, rMin = 4, rMax = 26, seed = 'stars', avoid = [] } = {}) {
  const rng = new RNG(seed);
  const [x0, y0, w, h] = region;
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const r = rMin + (rMax - rMin) * Math.pow(rng.next(), 2.4);
    const x = x0 + rng.next() * w, y = y0 + rng.next() * h;
    const clash = out.some((s) => Math.hypot(s.x - x, s.y - y) < (s.r + r) * 2.6 + 30)
      || avoid.some(([ax, ay, ar]) => Math.hypot(ax - x, ay - y) < ar + r * 2);
    if (!clash) out.push({ x, y, r });
  }
  return out;
}

// Add a twinkling field of gold paper stars plus tiny dot stars.
//   stars    [{ x, y, r, tall?, rot? }] explicit stars, or scatterStars options via `scatter`
//   dots     [[x, y, r?], ...] or a count of random dot stars inside `region`
//   twinkle  0..1 strength of the scale + glow pulse (each star has its own rhythm)
//   glow     0..1 strength of the warm light around each star
//   alpha    number or t => number fades the whole field. Returns the layers.
export function addStarField(S, {
  z = 15000, stars = null, scatter = {}, dots = 40, region = [0, 0, W, 520], seed = 'stars',
  gold = STAR_GOLD, light = S.light, twinkle = 1, glow = 0.3, glowColor = '#ffcf80',
  shadow = { alpha: 0.65 }, tall = 1.1, pinch = 0.7, alpha = 1,
} = {}) {
  const rng = new RNG(`${seed}-field`);
  const list = stars ?? scatterStars({ region, seed, ...scatter });
  const items = list.map((st, i) => {
    const pad = st.r * (st.tall ?? tall) * 1.2 + 6;
    const s = S.sprite({
      name: `star-${i}`, x: st.x - pad, y: st.y - pad, w: pad * 2, h: pad * 2, res: st.r < 10 ? 2 : 1.5,
      mat: 'smooth', light, edge: { width: 1, hi: 0.3, lo: 0.35, soft: 0.5 }, shadow: { blur: clamp(st.r * 0.16, 1.5, 4) },
      draw(ctx) { drawPaperStar(ctx, st.x, st.y, st.r, { gold, light, tall: st.tall ?? tall, pinch: st.pinch ?? pinch, rot: st.rot ?? 0, fold: st.r > 9 ? 0.4 : 0.2 }); },
    });
    return { s, st, period: rng.range(2.6, 5.5), phase: rng.next(), amp: rng.range(0.6, 1) };
  });
  const dotList = Array.isArray(dots) ? dots.map(([x, y, r]) => ({ x, y, r: r ?? rng.range(1.7, 2.8) }))
    : Array.from({ length: dots }, () => ({ x: region[0] + rng.next() * region[2], y: region[1] + rng.next() * region[3], r: rng.range(1.3, 2.8) }));
  const dotSprite = dotList.length ? S.sprite({
    name: 'dot-stars', x: region[0] - 40, y: region[1] - 40, w: region[2] + 80, h: region[3] + 80,
    mat: 'none', edge: false, shadow: { blur: 1.5 },
    draw(ctx) {
      for (const d of dotList) {
        ctx.fillStyle = radial(ctx, d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.r, [[0, '#fff1c8'], [0.55, gold.base], [1, gold.shade]]);
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      }
    },
  }) : null;
  const dotRhythm = dotList.map(() => [rng.range(1.8, 4.5), rng.next()]);

  // Glows behind the paper (additive), then the stars with their drop shadows.
  const glows = addGlow(S, {
    z, alpha, name: 'star-glow', items: (t) => {
      const out = [];
      for (const it of items) {
        const p = 0.5 + 0.5 * osc(t, it.period, it.phase);
        out.push({ x: it.st.x, y: it.st.y, r: it.st.r * 3, color: glowColor, alpha: glow * lerp(0.6, 0.25 + 0.75 * p * it.amp, twinkle) });
      }
      dotList.forEach((d, i) => {
        const p = 0.5 + 0.5 * osc(t, dotRhythm[i][0], dotRhythm[i][1]);
        out.push({ x: d.x, y: d.y, r: d.r * 5, color: glowColor, alpha: glow * lerp(0.5, 0.2 + 0.8 * p * p, twinkle) });
      });
      return out;
    },
  });
  const field = S.add({
    name: 'stars', z, shadow, alpha,
    render(ctx, t, env) {
      const sh = { ...env.shadow, ...shadow };
      const placed = dotSprite ? [{ s: dotSprite, shadowAlpha: 0.5 }] : [];
      for (const it of items) {
        const k = 1 + 0.05 * twinkle * it.amp * osc(t, it.period, it.phase);
        const rot = 0.03 * twinkle * osc(t, it.period * 1.7, it.phase + 0.3);
        placed.push({ s: it.s, x: it.st.x, y: it.st.y, ax: it.st.x, ay: it.st.y, sx: k, sy: k, rot });
      }
      drawSprites(ctx, placed, sh);
    },
  });
  return [glows, field];
}

// ---------------------------------------------------------------------------
// The guiding star

// Sparkle trail behind the guiding star (ref01), relative to the star in units of
// its arm length R: [dx, dy, size].
export const REF01_TRAIL = [
  [-0.81, 0.53, 0.07], [-1.22, 0.67, 0.19], [-2.06, 1.03, 0.25], [-3.06, 1.42, 0.27],
  [-3.69, 1.64, 0.27], [-4.5, 2.03, 0.2], [-5.14, 2.08, 0.09],
];

// Presets matching the references (pass as ...GUIDE_PRESETS.x).
export const GUIDE_PRESETS = {
  dusk: { points: 4, trail: true, rays: 0.25, halo: 0.6 },            // ref01
  forest: { points: 4, rays: 0.6, halo: 1.3, sparkles: 1.5 },         // ref03
  canyon: { points: 8, beam: true, rays: 0.8, halo: 1, gold: GUIDE_GOLD_PALE },  // ref04
  peak: { points: 8, rays: 0, halo: 0.45, sparkles: 0.5, gold: GUIDE_GOLD_PALE }, // ref05
  storm: { points: 4, rays: 0.5, halo: 1.5, core: 1.6, gold: GUIDE_GOLD_PALE }, // ref07
  aurora: { points: 8, rays: 0.3, halo: 1.1, core: 1.4, gold: GUIDE_GOLD_PALE }, // ref08
  portal: { points: 8, rays: 0.6, halo: 1.3, sparkles: 1.5, gold: GUIDE_GOLD_PALE }, // ref09
};

// Add the guiding star: folded gold paper, warm halo, thin light rays, a slow pulse,
// a glint that sweeps across the paper, and optionally a vertical beam (ref04) and
// a trail of small stars (ref01).
//   x, y       position (film px at rest); motion(t) => { x, y, s } moves it instead
//   size       arm length R in px (upper arm)
//   points     4 (ref01, ref03, ref07) or 8 with short diagonals (ref04, ref05, ref08, ref09)
//   intensity  overall light (0..1.5); halo, rays, core and sparkles scale its parts
//   beam       false | true | { length, width, alpha, up } light falling straight down
//   trail      false | true | { pts: [[dx, dy, size], ...], alpha }; it follows motion
//   alpha      number or t => number, fades every plane of the star (entrances, cuts)
// Returns { star, at(t), layers } where at(t) gives the star's current { x, y, s }.
export function addGuidingStar(S, {
  x = W / 2, y = 200, z = 12000, size = 42, points = 4, intensity = 1, motion = null,
  halo = 1, rays = 0.5, core = 1, sparkles = 1, glint = true, beam = false, trail = false,
  gold = GUIDE_GOLD, light = S.light, shadow = { alpha: 0.55 }, seed = 'guide', arms = null, pulse = 1, alpha = 1,
} = {}) {
  const R = size;
  const eight = points === 8;
  const star = compassStar(x, y, R, {
    arms: arms ?? (eight ? [1, 0.9, 1.05, 0.9] : [1, 0.95, 1.03, 0.95]),
    diag: eight ? 0.6 : 0, inner: eight ? 0.32 : 0.33,
  });
  const pad = R * 1.35;
  const sprite = S.sprite({
    name: 'guiding-star', x: x - pad, y: y - pad, w: pad * 2, h: pad * 2, res: 2, mat: 'smooth', light,
    edge: { width: 1, hi: 0.35, lo: 0.3, soft: 0.5 }, shadow: { blur: Math.max(3, R * 0.1) },
    draw(ctx) { drawFoldedStar(ctx, star, { gold, light, contrast: 1.2 }); },
  });
  const outline = new Path2D();
  star.pts.forEach(([px, py], i) => (i ? outline.lineTo(px - x, py - y) : outline.moveTo(px - x, py - y)));
  outline.closePath();

  // Rays: hairlines in the arm directions dotted with specks of light, baked once.
  const rayLen = R * 2.8;
  const raySprite = rays > 0 ? S.sprite({
    name: 'guide-rays', x: x - rayLen, y: y - rayLen, w: rayLen * 2, h: rayLen * 2, mat: 'none', edge: false, shadow: false,
    draw(ctx) {
      const rng = new RNG(`${seed}-rays`);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * TAU;
        const len = rayLen * (i % 2 === 0 ? 1 : 0.7);
        const c = Math.cos(a), s = Math.sin(a);
        const g = ctx.createLinearGradient(x + c * R * 0.6, y + s * R * 0.6, x + c * len, y + s * len);
        g.addColorStop(0, rgba(gold.lit, 0.7)); g.addColorStop(1, rgba(gold.glow, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + c * R * 0.6, y + s * R * 0.6); ctx.lineTo(x + c * len, y + s * len); ctx.stroke();
        for (let d = R * 1.15; d < len; d += rng.range(R * 0.16, R * 0.32)) {
          const f = 1 - d / len;
          ctx.fillStyle = rgba(gold.lit, f);
          ctx.beginPath(); ctx.arc(x + c * d, y + s * d, rng.range(0.7, 1.5) * (0.6 + f * 0.6), 0, TAU); ctx.fill();
        }
      }
    },
  }) : null;

  const rng = new RNG(`${seed}-motes`);
  const motes = Array.from({ length: Math.round(14 * sparkles) }, () => ({
    a: rng.next() * TAU, d: rng.range(1.1, 3), r: rng.range(0.8, 1.8), period: rng.range(1.8, 4.2), phase: rng.next(),
  }));
  const trailPts = trail ? (trail.pts ?? REF01_TRAIL) : [];
  const trailItems = trailPts.map(([dx, dy, s], i) => {
    const tx = x + dx * R, ty = y + dy * R, r = Math.max(2.5, s * R * 1.1);
    const p = r * 1.4 + 4;
    return {
      s: S.sprite({
        name: `trail-${i}`, x: tx - p, y: ty - p, w: p * 2, h: p * 2, res: 2.5, mat: 'smooth', light,
        edge: { width: 0.8, hi: 0.3, lo: 0.3, soft: 0.4 }, shadow: { blur: 1.8 },
        draw(ctx) { drawPaperStar(ctx, tx, ty, r, { gold: { lit: '#ffe08a', base: '#f8c45a', shade: '#d38e30' }, light, tall: 1.08, pinch: 0.72, fold: 0.6 }); },
      }),
      x: tx, y: ty, r, period: 2.4 + (i % 3) * 0.6, phase: i * 0.11,
    };
  });

  const at = (t) => {
    const m = motion ? motion(t) : null;
    return { x: m?.x ?? x, y: (m?.y ?? y) + 2 * osc(t, 7.3, 0.2), s: m?.s ?? 1 };
  };
  const breath = (t) => 1 + 0.07 * pulse * osc(t, 3.8, 0.1) + 0.025 * pulse * osc(t, 1.6, 0.6);
  const layers = [];

  // Beam: a soft column of light falling from the star plus a fine dotted core line.
  if (beam) {
    const B = { length: 420, width: R * 0.7, alpha: 0.6, up: R * 1.6, ...(beam === true ? {} : beam) };
    layers.push(S.add({
      name: 'guide-beam', z, order: -2, blend: 'lighter', alpha,
      render(ctx, t) {
        const p = at(t);
        const k = intensity * B.alpha * (0.85 + 0.15 * osc(t, 3.8, 0.1));
        const g = ctx.createLinearGradient(0, p.y, 0, p.y + B.length);
        g.addColorStop(0, rgba(gold.glow, 0.35 * k)); g.addColorStop(0.6, rgba(gold.glow, 0.12 * k)); g.addColorStop(1, rgba(gold.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(p.x - B.width * 0.12, p.y); ctx.lineTo(p.x + B.width * 0.12, p.y);
        ctx.lineTo(p.x + B.width * 0.5, p.y + B.length); ctx.lineTo(p.x - B.width * 0.5, p.y + B.length);
        ctx.closePath(); ctx.fill();
        // Dotted hairline, its dots drifting slowly downward.
        const step = 6, drift = (t * 9) % step;
        for (let d = -B.up + drift; d < B.length; d += step) {
          if (Math.abs(d) < R * 1.1) continue;
          const f = d > 0 ? 1 - d / B.length : 1 + d / B.up;
          ctx.fillStyle = rgba(gold.lit, 0.9 * k * f);
          ctx.fillRect(p.x - 0.7, p.y + d, 1.4, step * 0.5);
        }
      },
    }));
  }

  // Halo behind the paper.
  layers.push(S.add({
    name: 'guide-halo', z, order: -1, blend: 'lighter', alpha,
    render(ctx, t) {
      const p = at(t), b = breath(t) * p.s;
      const ox = p.x - x, oy = p.y - y;
      drawGlow(ctx, p.x, p.y, R * 3.6 * b, gold.glow, 0.32 * halo * intensity, { falloff: 'soft' });
      drawGlow(ctx, p.x, p.y, R * 1.6 * b, gold.glow, 0.4 * halo * intensity, { falloff: 'tight' });
      for (const ts of trailItems) {
        const q = 0.5 + 0.5 * osc(t, ts.period, ts.phase);
        drawGlow(ctx, ts.x + ox, ts.y + oy, ts.r * 3.5, gold.glow, (trail.alpha ?? 1) * 0.3 * intensity * (0.4 + 0.6 * q));
      }
    },
  }));

  // Trail stars, the star itself (with shadow), then glint, rays, core and motes.
  layers.push(S.add({
    name: 'guiding-star', z, shadow, alpha,
    render(ctx, t, env) {
      const p = at(t);
      const ox = p.x - x, oy = p.y - y;
      const sh = { ...env.shadow, ...shadow };
      if (trailItems.length) {
        drawSprites(ctx, trailItems.map((ts) => {
          const k = 1 + 0.08 * osc(t, ts.period, ts.phase);
          return { s: ts.s, ax: ts.x, ay: ts.y, x: ts.x + ox, y: ts.y + oy, sx: k, sy: k, alpha: trail.alpha ?? 1 };
        }), sh);
      }
      const k = p.s * (1 + 0.015 * pulse * osc(t, 3.8, 0.1));
      drawSprites(ctx, [{ s: sprite, ax: x, ay: y, x: p.x, y: p.y, sx: k, sy: k }], sh);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (glint) {
        // A band of light sweeps diagonally across the paper every few seconds.
        const cyc = ((t / 4.6) % 1 + 1) % 1, u = smoothstep(0.08, 0.36, cyc);
        const a = Math.sin(Math.PI * u) * 0.32 * intensity;
        if (a > 0.01) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(k, k);
          ctx.clip(outline);
          const off = lerp(-1.6, 1.6, u) * R;
          const g = ctx.createLinearGradient(off - R * 0.5, off - R * 0.5, off + R * 0.5, off + R * 0.5);
          g.addColorStop(0, rgba(gold.core, 0)); g.addColorStop(0.5, rgba(gold.core, a)); g.addColorStop(1, rgba(gold.core, 0));
          ctx.fillStyle = g;
          ctx.fillRect(-R * 1.3, -R * 1.3, R * 2.6, R * 2.6);
          ctx.restore();
        }
      }
      const b = breath(t) * p.s;
      if (raySprite) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(0.025 * osc(t, 9, 0.3));
        ctx.scale(b, b);
        ctx.globalAlpha *= rays * intensity * (0.7 + 0.3 * osc(t, 2.3, 0.4));
        ctx.drawImage(raySprite.canvas, -rayLen, -rayLen, rayLen * 2, rayLen * 2);
        ctx.restore();
      }
      drawGlow(ctx, p.x, p.y, R * 0.55 * b, gold.core, 0.5 * core * intensity, { falloff: 'tight' });
      for (const m of motes) {
        const q = 0.5 + 0.5 * osc(t, m.period, m.phase);
        const d = R * m.d * (1 + 0.05 * osc(t, m.period * 2.3, m.phase));
        drawGlow(ctx, p.x + Math.cos(m.a) * d, p.y + Math.sin(m.a) * d, m.r * 3, gold.lit, intensity * q * q * 0.9, { falloff: 'tight' });
      }
      ctx.restore();
    },
  }));
  return { star, at, layers };
}

// ---------------------------------------------------------------------------
// Moon

// Moon paper (ref02): cream flakes over a deeper yellow, warm crevices between them.
export const MOON_PAPER = { base: '#fbdfa8', lit: '#fff2d4', deep: '#f0bb68', crease: '#c07d2c' };

// Paint a crumpled paper full moon: a deeper yellow disc covered in hundreds of
// overlapping cream flakes. Each flake drops a warm contact shadow, so the gaps read
// as yellow-orange crevices; flakes facing the light are paler.
//   relief   0..1.5 strength of the crevices
export function drawMoon(ctx, cx, cy, r, { seed = 'moon', paper = MOON_PAPER, light = [0.55, -0.83], relief = 1 } = {}) {
  const rng = new RNG(seed);
  const nz = noise(`${seed}-tone`);
  const lx = cx + light[0] * r * 0.3, ly = cy + light[1] * r * 0.3;
  const path = piece(ctx, ellipse(cx, cy, r, r, 160), { fill: radial(ctx, lx, ly, r * 0.1, r * 1.2, [[0, paper.base], [1, mix(paper.base, paper.deep, 0.6)]]) });
  ctx.save();
  ctx.clip(path);
  const count = Math.round(700 * (r / 118) ** 2);
  const sh = { color: rgba(paper.crease, 0.6 * relief), blur: 2.2, x: -light[0] * 1.6, y: -light[1] * 1.6 };
  for (let i = 0; i < count; i++) {
    const a = rng.next() * TAU, d = Math.sqrt(rng.next()) * r * 1.04;
    const fx = cx + Math.cos(a) * d, fy = cy + Math.sin(a) * d;
    const fr = r * (0.045 + 0.11 * Math.pow(rng.next(), 1.8));
    const k = rng.int(5, 7), rot = rng.next() * TAU, squash = rng.range(0.45, 1);
    const pts = [];
    for (let j = 0; j < k; j++) {
      const aa = (j / k) * TAU + rng.range(-0.35, 0.35), rr = fr * rng.range(0.65, 1.15);
      pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr * squash]);
    }
    // Paler toward the light, warmer in drifting patches (the mottling).
    const side = ((fx - cx) * light[0] + (fy - cy) * light[1]) / r;
    const warm = clamp(nz.fbm(fx * 0.02, fy * 0.02, 3) * 1.6 + 0.2);
    const tone = mix(mix(paper.base, paper.lit, clamp(0.4 + side * 0.45 + rng.range(-0.25, 0.25))), paper.deep, warm * 0.7);
    piece(ctx, transform(pts, { x: fx, y: fy, rot }), { fill: tone, shadow: sh });
  }
  ctx.restore();
  overlayTexture(ctx, flakeTexture(SKY_FLAKES.fine), { x: cx - r, y: cy - r, w: r * 2, h: r * 2, clip: path, scale: 0.7, rot: rng.range(0, 90), amt: 0.6 * relief });
  bevelBands(ctx, path, { light, width: 2.5, hi: 0.45, lo: 0.2, soft: 1.2 });
  return path;
}

// Add the moon: soft glow on the sky, a strong dark drop-shadow halo, the crumpled
// paper disc and a faint inner light that makes it read as luminous.
// alpha (number or t => number) fades all its planes. Returns the layers.
export function addMoon(S, { x = 1562, y = 166, r = 118, z = 14000, glow = 1, glowColor = '#ffe1a0', seed = 'moon', light = S.light, shadow = { alpha: 0.9, dx: -9, dy: 10 }, paper = MOON_PAPER, relief = 1, alpha = 1 } = {}) {
  const halo = addGlow(S, {
    z, alpha, name: 'moon-glow', items: (t) => {
      const b = 1 + 0.04 * osc(t, 6.5, 0.2);
      return [
        { x, y, r: r * 3.8 * b, color: glowColor, alpha: 0.12 * glow, falloff: 'wide' },
        { x, y, r: r * 1.6, color: glowColor, alpha: 0.12 * glow },
      ];
    },
  });
  const pad = r * 0.3;
  const layer = S.plane(z, {
    name: 'moon', x: x - r - pad, y: y - r - pad, w: (r + pad) * 2, h: (r + pad) * 2, res: 1.25,
    mat: [{ tex: 'fiber', amt: 0.4, scale: 1.4 }], light,
    edge: { width: 2.5, hi: 0.4, lo: 0.3, soft: 1 }, shadow: { blur: r * 0.17 },
    draw(ctx) { drawMoon(ctx, x, y, r, { seed, light, paper, relief }); },
  }, { shadow, alpha });
  const inner = addGlow(S, {
    z, alpha, order: 1, name: 'moon-light', items: (t) => [{ x: x + light[0] * r * 0.25, y: y + light[1] * r * 0.25, r: r * 1.05, color: '#fff0c8', alpha: glow * (0.1 + 0.03 * osc(t, 6.5, 0.2)) }],
  });
  return [halo, layer, inner];
}

// ---------------------------------------------------------------------------
// Sun

// Paint the sun disc: pale cream paper with crumple creases and a hot white core.
//   coreAt   core position relative to the centre, in radii
export function drawSunDisc(ctx, cx, cy, r, { seed = 'sun', edge = '#f9cc70', base = '#fde4aa', core = '#fff8e8', coreAt = [0, 0], light = [0.55, -0.83] } = {}) {
  const rng = new RNG(seed);
  const qx = cx + coreAt[0] * r, qy = cy + coreAt[1] * r;
  const path = piece(ctx, ellipse(cx, cy, r, r, 140), { fill: radial(ctx, qx, qy, r * 0.05, r * 1.15, [[0, core], [0.25, mix(core, base, 0.6)], [0.7, base], [1, edge]]) });
  ctx.save();
  ctx.clip(path);
  // Creases: short jagged lines, a dark fold with a light lip beside it.
  for (let i = 0; i < 60; i++) {
    let px = cx + rng.range(-r, r), py = cy + rng.range(-r, r);
    let a = rng.next() * TAU;
    const seg = [[px, py]];
    for (let j = rng.int(3, 7); j > 0; j--) {
      a += rng.range(-0.9, 0.9);
      px += Math.cos(a) * rng.range(4, 12); py += Math.sin(a) * rng.range(4, 12);
      seg.push([px, py]);
    }
    for (const [o, col, al] of [[0.9, '#fffaf0', 0.6], [0, '#d49a48', 0.32]]) {
      ctx.strokeStyle = rgba(col, al);
      ctx.lineWidth = rng.range(0.6, 1.2);
      ctx.beginPath();
      seg.forEach(([sx, sy], k) => (k ? ctx.lineTo(sx + o, sy + o) : ctx.moveTo(sx + o, sy + o)));
      ctx.stroke();
    }
  }
  ctx.restore();
  overlayTexture(ctx, flakeTexture(SKY_FLAKES.broad), { x: cx - r, y: cy - r, w: r * 2, h: r * 2, amt: 0.8, scale: 0.7, clip: path, rot: rng.range(0, 90) });
  bevelBands(ctx, path, { light, width: 2, hi: 0.35, lo: 0.25, soft: 1 });
  return path;
}

// Wedge-shaped paper rays fanning out of the sun (ref10), or faint radial creases
// pressed into the sky around a setting sun (ref01, style 'creases').
//   from, to   angle range in radians (screen space, 0 = right, -PI/2 = up)
//   count      number of wedges; width: wedge width as a fraction of the pitch
export function drawSunRays(ctx, cx, cy, { from = Math.PI, to = Math.PI * 2, count = 9, width = 0.55, inner = 90, outer = 1700, color = '#fff3cc', alpha = 0.2, style = 'wedges', seed = 'rays' } = {}) {
  const rng = new RNG(seed);
  const pitch = (to - from) / count;
  for (let i = 0; i < count; i++) {
    const mid = from + pitch * (i + 0.5) + rng.range(-0.15, 0.15) * pitch;
    if (style === 'creases') {
      // A slightly wandering fold: dark crease with a pale lip beside it.
      const r0 = inner * rng.range(1, 1.4), len = rng.range(0.35, 1) * outer;
      const pts = [];
      for (let d = r0; d < len; d += 10) {
        const a = mid + rng.range(-0.012, 0.012);
        pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
      }
      const k = rng.range(0.5, 1);
      for (const [o, col, al] of [[1, '#fff6dc', alpha * 0.7], [0, color, alpha]]) {
        ctx.strokeStyle = rgba(col, al * k);
        ctx.lineWidth = rng.range(0.6, 1.1);
        ctx.beginPath();
        pts.forEach(([px, py], j) => (j ? ctx.lineTo(px + o, py + o) : ctx.moveTo(px + o, py + o)));
        ctx.stroke();
      }
      continue;
    }
    const half = (pitch * width * rng.range(0.8, 1.2)) / 2;
    const a = alpha * rng.range(0.75, 1.15);
    const g = radial(ctx, cx, cy, inner, outer, [[0, rgba(color, a * 1.6)], [0.25, rgba(color, a)], [0.6, rgba(color, a * 0.75)], [1, rgba(color, a * 0.35)]]);
    piece(ctx, [
      [cx + Math.cos(mid - half * 0.2) * inner, cy + Math.sin(mid - half * 0.2) * inner],
      [cx + Math.cos(mid - half) * outer, cy + Math.sin(mid - half) * outer],
      [cx + Math.cos(mid + half) * outer, cy + Math.sin(mid + half) * outer],
      [cx + Math.cos(mid + half * 0.2) * inner, cy + Math.sin(mid + half * 0.2) * inner],
    ], { fill: g });
  }
}

// Add the sun with its glow, and optionally rays that slowly breathe and sway.
//   kind   'sunset' (ref01: low disc, warm halo, pressed creases) or 'sunrise' (ref10: wedge rays)
//   rays   false | true | drawSunRays options
//   anim   t => { x, y } moves the whole sun with its glow and rays (a sunrise lift)
//   alpha  number or t => number fades all its planes. Returns the layers.
export function addSun(S, { x = 1626, y = 363, r = 84, z = 14000, kind = 'sunset', rays = true, glow = 1, seed = 'sun', light = S.light, glowColor = '#ffcf72', anim = null, alpha = 1 } = {}) {
  const rise = kind === 'sunrise';
  const layers = [];
  if (rays) {
    const R = { inner: r * 1.08, ...(rise ? {} : { style: 'creases', count: 40, color: '#d98848', alpha: 0.28, outer: r * 4, from: Math.PI * 0.95, to: Math.PI * 2.05 }), ...(rays === true ? {} : rays) };
    const outer = R.outer ?? 1700;
    const raySprite = S.sprite({
      name: 'sun-rays', x: x - outer, y: y - outer, w: outer * 2, h: outer + r * 1.2, res: rise ? 0.5 : 1, mat: 'paper', light,
      edge: false, shadow: false,
      draw(ctx) { drawSunRays(ctx, x, y, { seed: `${seed}-rays`, ...R }); },
    });
    layers.push(S.add({
      name: 'sun-rays', z: z + 10, anim, alpha,
      render(ctx, t) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.01 * osc(t, 12, 0.15));
        ctx.translate(-x, -y);
        ctx.globalAlpha *= 0.85 + 0.15 * osc(t, 5.5, 0.3);
        drawSprites(ctx, [{ s: raySprite }]);
        ctx.restore();
      },
    }));
  }
  layers.push(addGlow(S, {
    z, alpha, name: 'sun-glow', items: (t) => {
      const b = 1 + 0.05 * osc(t, 5.5, 0.3);
      return [
        { x, y, r: r * 5.5 * b, color: glowColor, alpha: 0.16 * glow, falloff: 'wide' },
        { x, y, r: r * 2, color: '#fff0c4', alpha: 0.12 * glow },
      ];
    },
  }));
  layers.push(S.plane(z, {
    name: 'sun', x: x - r * 1.25, y: y - r * 1.25, w: r * 2.5, h: r * 2.5, res: 1.25, mat: [{ tex: 'crumple', amt: 0.5, scale: 0.3 }, { tex: 'fiber', amt: 0.4, scale: 1.4 }], light,
    edge: { width: 2, hi: 0.3, lo: 0.25, soft: 1 }, shadow: { blur: r * 0.1 },
    draw(ctx) { drawSunDisc(ctx, x, y, r, { seed, light, coreAt: rise ? [0.05, 0.55] : [0.06, 0] }); },
  }, { shadow: { alpha: 0.35 }, anim, alpha }));
  layers.push(addGlow(S, {
    z, alpha, order: 1, name: 'sun-core', items: (t) => [{ x: x + r * 0.05, y: y + (rise ? r * 0.55 : 0), r: r * (rise ? 0.45 : 0.55), color: '#fffbe8', alpha: glow * (rise ? 0.42 : 0.22) * (1 + 0.15 * osc(t, 5.5, 0.3)), falloff: 'tight' }],
  }));
  for (const L of layers) L.anim = anim;
  return layers;
}

// ---------------------------------------------------------------------------
// Aurora (ref08)

// Curtain colours from the bright lower edge up into the night (sampled in ref08).
export const AURORA_COLORS = {
  green: ['#c0f0a0', '#86d888', '#5cbc7a', '#2a9a74', '#0e7470', '#07546c'],
  teal: ['#7fd8b0', '#30a08c', '#0d7a7a', '#075a72', '#054466', '#03305a'],
  blue: ['#5fb4d8', '#2a7fba', '#0f5a94', '#073f78', '#042e62', '#03224e'],
};

// Curtains traced from ref08 (film px), back to front: the lower edge of each
// ribbon, how far its streaks rise, and its colours.
export const REF08_CURTAINS = [
  { colors: 'blue', height: 210, dim: 0.15, edge: [[180, -90], [260, 10], [380, 50], [520, 80], [600, 140], [680, 200], [800, 245], [920, 270], [1040, 300], [1120, 318], [1200, 300], [1262, 240], [1292, 150], [1292, 40], [1282, -90]] },
  { colors: 'green', height: 300, edge: [[690, -90], [730, 40], [790, 140], [870, 205], [970, 245], [1070, 238], [1150, 175], [1195, 95], [1205, -90]] },
  { colors: 'blue', height: 170, edge: [[960, -90], [995, 30], [1055, 105], [1135, 148], [1215, 130], [1258, 60], [1270, -90]] },
  { colors: 'green', height: 220, edge: [[1222, -90], [1268, 60], [1328, 150], [1388, 212], [1440, 248], [1474, 215], [1462, 110], [1444, -90]] },
  { colors: 'teal', height: 200, dim: 0.15, edge: [[1700, -90], [1745, 30], [1830, 100], [1950, 125], [2170, 115]] },
  { colors: 'green', height: 230, edge: [[1575, -90], [1605, 60], [1648, 160], [1716, 228], [1816, 255], [1960, 240], [2170, 200]] },
];

// Paint one aurora curtain: a ribbon hanging above a torn, wavy lower edge, filled
// with vertical streaks that are brightest along the edge and fade upward.
//   edge    polyline of the lower edge [[x, y], ...]
//   height  how far the streaks rise above the edge
//   colors  key of AURORA_COLORS or six colours, edge first
//   dim     0..1 pulls the colours toward the night (curtains further back)
//   folds   strength of the drapery folds along the edge (0 = a plain torn edge)
export function drawAuroraCurtain(ctx, edge, { height = 220, colors = 'green', dim = 0, folds = 1, seed = 'aurora' } = {}) {
  const C = (typeof colors === 'string' ? AURORA_COLORS[colors] : colors).map((c) => mix(c, '#0a1838', dim));
  const rng = new RNG(seed);
  // Drapery: the edge rises and falls in folds, each lit on one side.
  const wave = rng.range(70, 110), ph = rng.next() * TAU;
  const fold = (s) => Math.sin((s / wave) * TAU + ph);
  const torn = tear(edge, { amp: 3, freq: 0.05, fine: 1, seed: rng.int(1, 9999), closed: false, step: 5 });
  let s = 0;
  const low = torn.map(([x, y], i) => {
    if (i) s += Math.hypot(x - torn[i - 1][0], y - torn[i - 1][1]);
    return [x, y + 9 * folds * fold(s), s];
  });
  const path = piece(ctx, [...low.map(([x, y]) => [x, y]), ...low.map(([x, y]) => [x, y - height]).reverse()], { fill: rgba(C[5], 0) });
  ctx.save();
  ctx.clip(path);
  // One vertical gradient per streak, rooted where the streak meets the edge:
  // pale green at the edge, then green, teal and blue, fading out at the top.
  const streak = (x0, w, yb, len, shift, alpha) => {
    const g = ctx.createLinearGradient(0, yb, 0, yb - len);
    const tint = (c) => (shift > 0 ? mix(c, '#ffffff', shift) : mix(c, '#04102a', -shift));
    [[0, 0, 1], [0.04, 1, 1], [0.16, 2, 1], [0.36, 3, 1], [0.6, 4, 0.95], [0.85, 5, 0.7], [1, 5, 0]]
      .forEach(([o, k, a]) => g.addColorStop(o, rgba(tint(C[k]), alpha * a)));
    ctx.fillStyle = g;
    ctx.fillRect(x0, yb - len, w, len + 12);
  };
  const along = (fn, stepFn) => {
    for (let i = 0; i < low.length - 1; i += stepFn()) fn(low[i], low[i + 1]);
  };
  // A continuous base, broad dark drapery folds, then fine light and dark streaks.
  along(([x0, y0, s0], [x1, y1]) => streak(Math.min(x0, x1), Math.abs(x1 - x0) + 1.5, Math.max(y0, y1) + 6, height, 0.22 * folds * fold(s0 + wave / 4), 1), () => 1);
  along(([x0, y0]) => streak(x0 + rng.range(-6, 6), rng.range(14, 40), y0 + 6, height * rng.range(0.7, 1.05), rng.range(-0.5, -0.2), rng.range(0.15, 0.35)), () => rng.int(6, 14));
  along(([x0, y0]) => streak(x0 + rng.range(-4, 4), rng.range(2, 12), y0 + 6, height * rng.range(0.35, 1), rng.range(-0.35, 0.3), rng.range(0.2, 0.5)), () => rng.int(1, 3));
  ctx.restore();
  return path;
}

// Draw a sprite in vertical slices, each nudged up or down by offset(x): a cheap
// ripple for curtains. Draws the drop shadow slices first when sh is given.
function drawRippled(ctx, s, offset, { slice = 40, sh = null, glow = null, glowAlpha = 0 } = {}) {
  // Slices abut exactly: overlapping them would double the alpha of soft areas.
  const pass = (img, bx, by, bw, bh, dx, dy) => {
    const k = img.width / bw;
    for (let x = bx; x < bx + bw; x += slice) {
      const w = Math.min(slice, bx + bw - x);
      ctx.drawImage(img, (x - bx) * k, 0, w * k, img.height, x + dx, by + dy + offset(x + w / 2), w, bh);
    }
  };
  const base = ctx.globalAlpha;
  if (sh && s.shadow) {
    const p = s.shadow.pad;
    ctx.globalAlpha = base * sh.alpha;
    pass(s.shadow.canvas, s.x - p, s.y - p, s.w + 2 * p, s.h + 2 * p, sh.dx ?? 0, sh.dy ?? 6);
  }
  ctx.globalAlpha = base;
  pass(s.canvas, s.x, s.y, s.w, s.h, 0, 0);
  if (glow && glowAlpha > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = base * glowAlpha;
    // The halo is soft enough to skip slicing: one image, shifted by the mean ripple.
    ctx.drawImage(glow.canvas, s.x - glow.pad, s.y - glow.pad + offset(s.x + s.w / 2), s.w + 2 * glow.pad, s.h + 2 * glow.pad);
    ctx.restore();
  }
}

// Add aurora curtains: torn paper ribbons with streaks, each casting a shadow on
// what lies behind, rippling slowly and breathing light along their edges.
//   curtains  [{ edge, height, colors }] back to front (default: REF08_CURTAINS)
//   ripple    px of vertical undulation; speed: how fast the ripples travel
//   glow      additive light along the curtains (0..1)
//   alpha     number or t => number fades every curtain. Returns the layers.
export function addAurora(S, { curtains = REF08_CURTAINS, z = 17000, ripple = 6, speed = 1, glow = 0.18, light = S.light, shadow = { alpha: 0.55 }, seed = 'aurora', alpha = 1 } = {}) {
  return curtains.map((cu, i) => {
    const xs = cu.edge.map((p) => p[0]), ys = cu.edge.map((p) => p[1]);
    const x0 = Math.min(...xs) - 20, x1 = Math.max(...xs) + 20;
    const y0 = Math.min(...ys) - cu.height - 10, y1 = Math.max(...ys) + 24;
    const s = S.sprite({
      name: `aurora-${i}`, x: x0, y: y0, w: x1 - x0, h: y1 - y0, res: 0.75, mat: 'paper', light,
      edge: { width: 2, hi: 0.35, lo: 0.25, soft: 1 }, shadow: { blur: 9 },
      draw(ctx) { drawAuroraCurtain(ctx, cu.edge, { height: cu.height, colors: cu.colors, dim: cu.dim, seed: `${seed}-${i}` }); },
    });
    const g = blurred(s.canvas, 14 * s.res);
    const halo = { canvas: g.canvas, pad: g.pad / s.res };
    const ph = i * 1.7;
    const offset = (t) => (x) => ripple * (Math.sin(x * 0.0055 - t * 0.8 * speed + ph) * 0.7 + Math.sin(x * 0.0021 + t * 0.33 * speed + ph * 0.5) * 0.3);
    return S.add({
      name: `aurora-${i}`, z, order: i, alpha,
      render(ctx, t, env) {
        const sh = { ...env.shadow, ...shadow };
        const breathe = 0.75 + 0.25 * osc(t, 5.3 + i * 0.7, ph * 0.1);
        drawRippled(ctx, s, offset(t), { sh, glow: halo, glowAlpha: glow * breathe });
      },
    });
  });
}