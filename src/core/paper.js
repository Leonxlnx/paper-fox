// The paper look: procedural textures (crumpled facets, fibres, stone specks),
// silhouette bevels and drop-shadow sprites. Everything here is generated in code.

import { mulberry32, hash2, hashString } from './rng.js';
import { surface, silhouette, blurred } from './canvas.js';
import { rgba } from './color.js';

const TEX_SIZE = 1024;
const textures = new Map();

const smooth01 = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Gray float field -> canvas, normalised to mean 128 and the given spread.
function fieldToCanvas(field, N, spread) {
  let mean = 0;
  for (let i = 0; i < field.length; i++) mean += field[i];
  mean /= field.length;
  let v = 0;
  for (let i = 0; i < field.length; i++) v += (field[i] - mean) ** 2;
  const sd = Math.sqrt(v / field.length) || 1;
  const { canvas, ctx } = surface(N, N);
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < field.length; i++) {
    const g = Math.max(0, Math.min(255, 128 + ((field[i] - mean) / sd) * spread));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Crumpled paper as a lit height field. Each scale adds Voronoi relief: F1 distance
// raises ridges along cell borders, F2-F1 sinks creases into them; every cell also
// gets a random tilt. Shading the normals with a raking light gives angular facets
// with a light and a dark side, like paper crushed in the hand and flattened again.
function makeCrumple(N, seed) {
  const r = mulberry32(seed);
  const h = new Float32Array(N * N);
  const scales = [
    { cells: 11, w: 1.0, mode: 'ridge', tilt: 0.55 },
    { cells: 23, w: 0.6, mode: 'crease', tilt: 0.45 },
    { cells: 47, w: 0.35, mode: 'ridge', tilt: 0.35 },
    { cells: 96, w: 0.16, mode: 'crease', tilt: 0.2 },
  ];
  for (const S of scales) {
    const C = S.cells, cs = N / C;
    const px = new Float32Array(C * C), py = new Float32Array(C * C);
    const tx = new Float32Array(C * C), ty = new Float32Array(C * C);
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
      const k = j * C + i;
      // Stretch cells a little along a random axis so facets are not round.
      px[k] = (i + 0.05 + 0.9 * r()) * cs;
      py[k] = (j + 0.05 + 0.9 * r()) * cs;
      const a = r() * Math.PI * 2;
      tx[k] = Math.cos(a) * S.tilt; ty[k] = Math.sin(a) * S.tilt;
    }
    for (let y = 0; y < N; y++) {
      const cj = Math.floor(y / cs);
      for (let x = 0; x < N; x++) {
        const ci = Math.floor(x / cs);
        let d1 = 1e9, d2 = 1e9, best = 0, bx = 0, by = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const uj = cj + dj, jj = ((uj % C) + C) % C, oy = (uj - jj) * cs;
          for (let di = -1; di <= 1; di++) {
            const ui = ci + di, ii = ((ui % C) + C) % C, ox = (ui - ii) * cs;
            const k = jj * C + ii;
            const qx = px[k] + ox, qy = py[k] + oy;
            const dx = qx - x, dy = qy - y;
            const d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; best = k; bx = qx; by = qy; }
            else if (d < d2) d2 = d;
          }
        }
        const f1 = Math.sqrt(d1) / cs, f2 = Math.sqrt(d2) / cs;
        const relief = S.mode === 'ridge' ? f1 : -(Math.min(f2 - f1, 0.35));
        const tilt = (tx[best] * (x - bx) + ty[best] * (y - by)) / cs;
        h[y * N + x] += S.w * cs * (relief + tilt) * 0.5;
      }
    }
  }
  // Shade: normal from wrapped finite differences, raking light from upper left.
  const L = [-0.55, -0.6, 0.58];
  const ll = Math.hypot(...L);
  const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
  const field = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const ym = ((y - 1 + N) % N) * N, yp = ((y + 1) % N) * N, yy = y * N;
    for (let x = 0; x < N; x++) {
      const xm = (x - 1 + N) % N, xp = (x + 1) % N;
      const dx = (h[yy + xp] - h[yy + xm]) * 0.5;
      const dy = (h[yp + x] - h[ym + x]) * 0.5;
      const nl = Math.hypot(dx, dy, 1);
      field[yy + x] = (-dx * lx - dy * ly + lz) / nl;
    }
  }
  return fieldToCanvas(field, N, 30);
}

// Tileable value noise used for mottling.
function tileNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const w = (a) => ((a % period) + period) % period;
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// Paper fibre: fine grain, cloudy mottling, short fibres and specks.
function makeFiber(N, seed, { mottle = 16, grain = 9, fibers = 2600, specks = 1800, speckDark = 0.5, fiberAlpha = 0.16, speckAlpha = 0.25, speckSize = 1.1, blotches = 0 } = {}) {
  const r = mulberry32(seed);
  const field = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let m = 0, amp = 1, norm = 0;
    for (let o = 0; o < 4; o++) {
      const period = 4 << o;
      m += amp * tileNoise((x / N) * period, (y / N) * period, period, seed + o * 31);
      norm += amp; amp *= 0.55;
    }
    field[y * N + x] = (m / norm - 0.5) * 2 * mottle + (r() - 0.5) * 2 * grain;
  }
  const canvas = fieldToCanvas(field, N, Math.hypot(mottle, grain) * 0.55);
  const ctx = canvas.getContext('2d');
  const wrapDraw = (x, y, pad, fn) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const X = x + ox, Y = y + oy;
      if (X < -pad || Y < -pad || X > N + pad || Y > N + pad) continue;
      fn(X, Y);
    }
  };
  ctx.lineCap = 'round';
  for (let i = 0; i < blotches; i++) {
    const x = r() * N, y = r() * N, rad = 3 + r() * 10;
    const light = r() < 0.5;
    ctx.fillStyle = light ? `rgba(255,255,255,${0.05 + r() * 0.08})` : `rgba(0,0,0,${0.05 + r() * 0.08})`;
    wrapDraw(x, y, rad, (X, Y) => { ctx.beginPath(); ctx.arc(X, Y, rad, 0, Math.PI * 2); ctx.fill(); });
  }
  for (let i = 0; i < fibers; i++) {
    const x = r() * N, y = r() * N;
    const len = 4 + r() * r() * 30, a = r() * Math.PI * 2, bend = (r() - 0.5) * 0.9;
    const light = r() < 0.62;
    ctx.strokeStyle = light ? `rgba(255,255,255,${fiberAlpha * (0.5 + r())})` : `rgba(0,0,0,${fiberAlpha * 0.8 * (0.5 + r())})`;
    ctx.lineWidth = 0.35 + r() * 0.8;
    wrapDraw(x, y, len, (X, Y) => {
      ctx.beginPath();
      ctx.moveTo(X, Y);
      const mx = X + Math.cos(a + bend) * len * 0.5, my = Y + Math.sin(a + bend) * len * 0.5;
      ctx.quadraticCurveTo(mx, my, X + Math.cos(a) * len, Y + Math.sin(a) * len);
      ctx.stroke();
    });
  }
  for (let i = 0; i < specks; i++) {
    const x = r() * N, y = r() * N, rad = 0.3 + r() * r() * speckSize * 2;
    const dark = r() < speckDark;
    ctx.fillStyle = dark ? `rgba(0,0,0,${speckAlpha * (0.4 + r())})` : `rgba(255,255,255,${speckAlpha * (0.4 + r())})`;
    wrapDraw(x, y, rad, (X, Y) => { ctx.beginPath(); ctx.arc(X, Y, rad, 0, Math.PI * 2); ctx.fill(); });
  }
  return canvas;
}

const TEX_BUILDERS = {
  crumple: () => makeCrumple(TEX_SIZE, 7),
  fiber: () => makeFiber(TEX_SIZE, 11),
  // Granite-like speckle for rocks and stone.
  stone: () => makeFiber(TEX_SIZE, 23, { mottle: 22, grain: 14, fibers: 900, specks: 16000, speckDark: 0.55, speckAlpha: 0.42, speckSize: 1.3, blotches: 500 }),
  // Soft felt / fur fibre: many long light fibres.
  felt: () => makeFiber(TEX_SIZE, 37, { mottle: 12, grain: 7, fibers: 9000, specks: 800, fiberAlpha: 0.2 }),
};

export function texture(name) {
  let t = textures.get(name);
  if (!t) {
    const build = TEX_BUILDERS[name];
    if (!build) throw new Error(`unknown paper texture "${name}"`);
    t = build();
    textures.set(name, t);
  }
  return t;
}

// Texture recipes per material. amt is the soft-light strength (0..1),
// scale multiplies the texture's size in authored pixels.
export const MATERIALS = {
  paper: [{ tex: 'fiber', amt: 0.7 }, { tex: 'crumple', amt: 0.4, scale: 0.45 }],
  smooth: [{ tex: 'fiber', amt: 0.5 }],
  crumpled: [{ tex: 'crumple', amt: 1.15, scale: 0.32 }, { tex: 'fiber', amt: 0.5 }],
  sky: [{ tex: 'crumple', amt: 0.8, scale: 0.34 }, { tex: 'fiber', amt: 0.6 }],
  stone: [{ tex: 'stone', amt: 0.95 }, { tex: 'crumple', amt: 0.45, scale: 0.4 }],
  felt: [{ tex: 'felt', amt: 0.85, scale: 0.7 }, { tex: 'crumple', amt: 0.25, scale: 0.4 }],
  none: [],
};

// Overlay texture recipes onto a painted canvas, only where it is opaque.
export function applyTexture(canvas, { res = 1, mat = 'paper', seed = 1 } = {}) {
  const recipe = Array.isArray(mat) ? mat : MATERIALS[mat];
  if (!recipe || !recipe.length) return canvas;
  const ctx = canvas.getContext('2d');
  const tmp = surface(canvas.width, canvas.height);
  const r = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
  for (const layer of recipe) {
    const t = tmp.ctx;
    t.globalCompositeOperation = 'copy';
    const pat = t.createPattern(texture(layer.tex), 'repeat');
    const m = new DOMMatrix();
    m.translateSelf(r() * TEX_SIZE, r() * TEX_SIZE);
    // Quarter turns only: arbitrary angles resample the pixel grain into a faint lattice.
    m.rotateSelf(Math.floor(r() * 4) * 90);
    m.scaleSelf(res * (layer.scale ?? 1));
    pat.setTransform(m);
    t.fillStyle = pat;
    t.fillRect(0, 0, canvas.width, canvas.height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = layer.mode ?? 'soft-light';
    ctx.globalAlpha = Math.min(1, layer.amt);
    ctx.drawImage(tmp.canvas, 0, 0);
    // amt > 1 means "apply again" for very strong textures.
    if (layer.amt > 1) { ctx.globalAlpha = layer.amt - 1; ctx.drawImage(tmp.canvas, 0, 0); }
    ctx.restore();
  }
  return canvas;
}

// Edge light on a whole silhouette: a bright band on edges facing the light and a
// dark band on the far side, like the cut edge of thick paper catching light.
// light: unit vector pointing from the surface toward the light (screen space).
export function edgeLight(canvas, { res = 1, light = [0.4, -0.9], width = 1.6, hi = 0.3, lo = 0.28, soft = 0.7, hiColor = '#fff8ea', loColor = '#000' } = {}) {
  if (!hi && !lo) return canvas;
  const ctx = canvas.getContext('2d');
  const S = silhouette(canvas, '#fff');
  const band = (dir, color, alpha) => {
    if (!alpha) return;
    const b = surface(canvas.width, canvas.height);
    b.ctx.drawImage(S, 0, 0);
    b.ctx.globalCompositeOperation = 'destination-out';
    b.ctx.drawImage(S, -dir[0] * width * res, -dir[1] * width * res);
    b.ctx.globalCompositeOperation = 'source-in';
    b.ctx.fillStyle = color;
    b.ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = alpha;
    if (soft > 0) ctx.filter = `blur(${soft * res}px)`;
    ctx.drawImage(b.canvas, 0, 0);
    ctx.restore();
  };
  band(light, hiColor, hi);
  band([-light[0], -light[1]], loColor, lo);
  return canvas;
}

// Full bake of a painted layer: texture, then edge light.
export function bake(canvas, { res = 1, mat = 'paper', seed = 1, light = [0.4, -0.9], edge = {} } = {}) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  applyTexture(canvas, { res, mat, seed });
  if (edge !== false) edgeLight(canvas, { res, light, ...edge });
  ctx.restore();
  return canvas;
}

// Soft drop shadow sprite from a canvas silhouette.
export function shadowOf(canvas, blurPx) {
  return blurred(canvas, blurPx, { color: '#000' });
}

// Gold-leaf / glitter flecks scattered over an area (used on night skies).
export function flecks(ctx, x, y, w, h, count, seed, { color = '#f3d38a', max = 1.6, alpha = 0.85 } = {}) {
  const r = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
  for (let i = 0; i < count; i++) {
    const rad = 0.35 + r() * r() * max;
    ctx.fillStyle = rgba(color, alpha * (0.35 + r() * 0.65));
    ctx.beginPath();
    ctx.arc(x + r() * w, y + r() * h, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}
