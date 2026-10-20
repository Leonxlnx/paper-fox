// s01 meadow: the cut-paper detail that keeps the big green hills from reading as flat
// vector shapes. paintMeadow() paints, clipped to one hill's silhouette: contour bands,
// mottled shade, thousands of tiny grass tufts, dark shrub clumps with lit tops and drifts
// of yellow, white and red wildflowers, all growing larger toward the bottom of the slope.
// addTexturedHills() is addHills with that meadow baked into the same sheet (one sprite per
// plane keeps both bake and render cheap). Also the warm horizon haze that melts the base
// of the big cloud into the glow behind the ranges.

import { RNG, noise } from '../core/rng.js';
import { mix, rgba } from '../core/color.js';
import { hillCrest, hillsBox, drawHills } from '../elements/terrain.js';
import { W } from '../core/stage.js';

const GRASS = ['#4a6626', '#66802e', '#869a34', '#a6ac3a', '#c2bc40', '#d8ca4a', '#ecda62'];
const SHRUB = { dark: '#3f6a2c', mid: '#557f30', lit: '#8fb046', shadow: 'rgba(28,44,14,0.35)' };
const FLOWERS = [
  ['#f2cc3a', '#c9921e', 6], ['#f7de6a', '#d0a43a', 3], ['#f6f1e2', '#bfb39c', 2],
  ['#d9474a', '#8e2a30', 1.2], ['#e27aa0', '#a04468', 0.8], ['#9474c4', '#5a4290', 0.6],
];
// Tiny flower specks sprinkled through the grass (ref01's yellow-green meadow).
const SPECKS = [['#f6d63c', 6], ['#ffe878', 3], ['#fbf4e4', 2], ['#e04a40', 1.2], ['#e88ab0', 0.6]];
// ref01 meadow hill sheet: warm yellow-olive, lit crest, olive-green shade.
export const MEADOW_PAL = {
  crest: '#e0cc58', ramp: ['#c8ba46', '#b2ac40', '#98a03c', '#7e8e3a', '#627838'],
  shade: '#40603a', haze: '#7a86b0', rim: '#f6eeb6',
};
const BAND = 70;   // tufts are batched per colour within horizontal bands of this height

const lerp = (a, b, t) => a + (b - a) * t;

function weighted(rng, list) {
  const tot = list.reduce((s, f) => s + f[2], 0);
  let r = rng.next() * tot;
  for (const f of list) { r -= f[2]; if (r <= 0) return f; }
  return list[0];
}

// Paint the meadow over one hill (addHills hill fields) into ctx.
export function paintMeadow(ctx, hill, {
  density = 1, scale = 1, flowers = 1, shrubs = 1, haze = 0, hazeColor = '#8f94bc',
  sizeTop = 0.6, sizeBottom = 1.15, seed = 'meadow', specks = 0, flowerMix = FLOWERS, mottle = 0.1,
} = {}) {
  const crest = hillCrest({ wobble: 6, ...hill });
  const xs = crest.map((p) => p[0]), ys = crest.map((p) => p[1]);
  // Only the span the camera can ever see (pan and zoom overscan) gets painted.
  const x0 = Math.max(Math.min(...xs), -300), x1 = Math.min(Math.max(...xs), W + 300);
  const yTop = Math.min(...ys);
  const yBot = hill.baseY + (hill.bottom ?? 200);
  const hz = (c) => (haze ? mix(c, hazeColor, haze) : c);
  const crestY = (x) => {
    for (let i = 1; i < crest.length; i++) {
      if (crest[i][0] >= x) {
        const a = crest[i - 1], b = crest[i];
        return lerp(a[1], b[1], (x - a[0]) / Math.max(1e-6, b[0] - a[0]));
      }
    }
    return crest[crest.length - 1][1];
  };
  const span = Math.max(1, hill.baseY - yTop + 140);
  const sizeAt = (y) => scale * lerp(sizeTop, sizeBottom, Math.min(1, Math.max(0, (y - yTop) / span)));
  const rng = new RNG(`meadow-${seed}`);
  const nz = noise(rng.int(1, 1e6));

  const clip = new Path2D();
  [...crest, [x1, yBot], [x0, yBot]].forEach(([x, y], i) => (i ? clip.lineTo(x, y) : clip.moveTo(x, y)));
  clip.closePath();
  ctx.save();
  ctx.clip(clip);

  // Contour bands echo the crest: alternately sunlit and shaded paper strips.
  for (let k = 1; k < 9; k++) {
    const d = k * k * 9 * scale + 10;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 16) {
      const y = crestY(x) + d + nz.n1(x * 0.004 + k * 7) * 14 * scale;
      x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineWidth = (8 + k * 3) * scale;
    ctx.strokeStyle = k % 2 ? rgba(hz('#f3e58a'), 0.13) : rgba(hz('#28441c'), 0.12);
    ctx.stroke();
  }

  // Mottled shade and sun patches (two batched fills).
  const area = (x1 - x0) * (yBot - yTop);
  const dark = new Path2D(), sun = new Path2D();
  for (let i = 0, n = Math.round(area / 26000); i < n; i++) {
    const x = rng.range(x0, x1), y = rng.range(crestY(x), yBot);
    const r = rng.range(30, 90) * sizeAt(y);
    const p = rng.chance(0.55) ? dark : sun;
    p.moveTo(x + r * 1.8, y);
    p.ellipse(x, y, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
  }
  ctx.fillStyle = rgba(hz('#3a5420'), mottle); ctx.fill(dark);
  ctx.fillStyle = rgba(hz('#f0e070'), mottle * 1.2); ctx.fill(sun);

  // Grass tufts: a dark blade behind, two lighter blades fanning out in front. Batched per
  // (band, colour); bands go far to near and colours dark to light within a band.
  const colors = GRASS.map(hz);
  const nBands = Math.ceil((yBot - yTop) / BAND) + 1;
  const paths = Array.from({ length: nBands * colors.length }, () => null);
  const nTufts = Math.round((area / 330) * density);
  for (let i = 0; i < nTufts; i++) {
    const x = rng.range(x0, x1);
    const cy = crestY(x);
    const y = cy + Math.pow(rng.next(), 1.15) * (yBot - cy);
    const s0 = sizeAt(y) * rng.range(7, 15);
    const tone = nz.n2(x * 0.008, y * 0.01);
    const base = 0.5 + tone * 0.7 + rng.range(-0.25, 0.25);
    const lean0 = rng.range(-0.3, 0.3);
    const band = Math.floor((y - yTop) / BAND);
    for (let b = 0; b < 3; b++) {
      const s = s0 * (b === 0 ? 1 : rng.range(0.6, 0.95));
      const w = s * rng.range(0.16, 0.26);
      const lean = (lean0 + (b - 1) * 0.42 + rng.range(-0.12, 0.12)) * s;
      const ci = Math.max(0, Math.min(colors.length - 1, Math.floor((base + (b === 0 ? -0.28 : 0.12 * b)) * colors.length)));
      const bx = x + (b - 1) * w * 0.9;
      const k = band * colors.length + ci;
      const p = paths[k] ?? (paths[k] = new Path2D());
      p.moveTo(bx - w, y);
      p.quadraticCurveTo(bx - w * 0.2 + lean * 0.2, y - s * 0.55, bx + lean, y - s);
      p.quadraticCurveTo(bx + w * 0.5 + lean * 0.2, y - s * 0.45, bx + w, y);
      p.closePath();
    }
  }
  paths.forEach((p, k) => {
    if (!p) return;
    ctx.fillStyle = colors[k % colors.length];
    ctx.fill(p);
  });

  // Dark shrub clumps with sunlit tops.
  const shrubList = [];
  for (let i = 0, n = Math.round((area / 32000) * shrubs); i < n; i++) {
    const x = rng.range(x0, x1), cy = crestY(x);
    shrubList.push([x, cy + rng.range(0.04, 1) * (yBot - cy)]);
  }
  shrubList.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of shrubList) {
    const s = sizeAt(y) * rng.range(10, 20);
    const pts = Array.from({ length: rng.int(4, 7) }, () => [x + rng.range(-1.1, 1.1) * s, y - rng.range(0.1, 0.9) * s, rng.range(0.35, 0.6) * s]);
    ctx.fillStyle = SHRUB.shadow;
    ctx.beginPath();
    ctx.ellipse(x - s * 0.15, y + s * 0.12, s * 1.5, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    const layer = (color, k, ox, oy) => {
      ctx.fillStyle = hz(color);
      ctx.beginPath();
      for (const [px, py, r] of pts) { ctx.moveTo(px + r * ox + r * k, py + r * oy); ctx.arc(px + r * ox, py + r * oy, r * k, 0, Math.PI * 2); }
      ctx.fill();
    };
    layer(SHRUB.dark, 1, 0, 0);
    layer(SHRUB.mid, 0.8, 0.15, -0.15);
    layer(SHRUB.lit, 0.4, 0.35, -0.35);
  }

  // Wildflowers in drifts, batched per colour (shadow dots first, then the heads).
  const heads = new Map();
  for (let c = 0, n = Math.round((area / 6500) * flowers); c < n; c++) {
    const cx = rng.range(x0, x1), ccy = crestY(cx);
    const cy = ccy + Math.pow(rng.next(), 0.9) * (yBot - ccy);
    const f = weighted(rng, flowerMix);
    const k = sizeAt(cy);
    const rad = rng.range(14, 40) * k;
    if (!heads.has(f)) heads.set(f, [new Path2D(), new Path2D()]);
    const [pd, pf] = heads.get(f);
    for (let i = 0, m = rng.int(6, 18); i < m; i++) {
      const a = rng.range(0, Math.PI * 2), d = Math.sqrt(rng.next()) * rad;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.45;
      if (y < crestY(x) + 2) continue;
      const r = k * rng.range(2, 4);
      pd.moveTo(x + r * 1.2, y + r * 0.35); pd.arc(x + r * 0.2, y + r * 0.35, r, 0, Math.PI * 2);
      pf.moveTo(x + r, y); pf.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  for (const [f, [pd]] of heads) { ctx.fillStyle = hz(f[1]); ctx.fill(pd); }
  for (const [f, [, pf]] of heads) { ctx.fillStyle = hz(f[0]); ctx.fill(pf); }

  // Specks: single tiny blossoms scattered evenly, batched per colour.
  if (specks > 0) {
    const dots = new Map();
    for (let i = 0, n = Math.round((area / 900) * specks); i < n; i++) {
      const x = rng.range(x0, x1), cy = crestY(x);
      const y = cy + 3 + Math.pow(rng.next(), 0.9) * (yBot - cy);
      const c = weighted(rng, SPECKS.map(([col, w]) => [col, col, w]))[0];
      const r = sizeAt(y) * rng.range(1.4, 2.8);
      if (!dots.has(c)) dots.set(c, new Path2D());
      const p = dots.get(c);
      p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2);
    }
    for (const [c, p] of dots) { ctx.fillStyle = hz(c); ctx.fill(p); }
  }
  ctx.restore();
}

// addHills with a meadow painted over each hill on the same sheet. `tex` holds the
// paintMeadow options (shared by all hills of the sheet).
export function addTexturedHills(S, { z = 2500, name = 'hills', res = 1, mat = 'paper', layer = {}, shadow = { blur: 14 }, tex = {}, ...opts } = {}) {
  const b = hillsBox(opts.hills ?? [], opts);
  return S.plane(z, {
    name, ...b, res, mat, shadow,
    edge: { width: 1.4, hi: 0.3, lo: 0.2, soft: 0.6 },
    draw: (ctx) => {
      opts.hills.forEach((hill, i) => {
        drawHills(ctx, { light: S.light, ...opts, hills: [hill] });
        paintMeadow(ctx, { ...opts, ...hill }, { seed: `${name}-${i}`, ...tex });
      });
    },
  }, { tags: ['meadow'], ...layer });
}

// Warm haze band in front of the clouds and behind the ranges: hides the clouds' flat
// base in the valleys and adds the glow the reference has along the horizon.
export function addHorizonHaze(S, { z = 8800, x0 = 380, x1 = 1420, y0 = 205, y1 = 330 } = {}) {
  const feather = 240;
  return S.plane(z, {
    name: 'horizon-haze', x: x0 - feather, y: y0, w: x1 - x0 + feather * 2, h: y1 - y0, mat: 'none', edge: false, shadow: false,
    draw(ctx) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, rgba('#d98f9c', 0));
      g.addColorStop(0.35, rgba('#ec9c8c', 0.55));
      g.addColorStop(0.7, rgba('#f5ad7e', 0.9));
      g.addColorStop(1, rgba('#f8b676', 0.95));
      ctx.fillStyle = g;
      ctx.fillRect(x0 - feather, y0, x1 - x0 + feather * 2, y1 - y0);
      ctx.globalCompositeOperation = 'destination-in';
      const h = ctx.createLinearGradient(x0 - feather, 0, x1 + feather, 0);
      const f = feather / (x1 - x0 + feather * 2);
      h.addColorStop(0, 'rgba(0,0,0,0)');
      h.addColorStop(f, 'rgba(0,0,0,1)');
      h.addColorStop(1 - f, 'rgba(0,0,0,1)');
      h.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = h;
      ctx.fillRect(x0 - feather, y0, x1 - x0 + feather * 2, y1 - y0);
      ctx.globalCompositeOperation = 'source-over';
    },
  }, { tags: ['sky'] });
}
