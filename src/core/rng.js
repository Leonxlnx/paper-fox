// Deterministic randomness. Nothing in the film may call Math.random():
// every frame must be reproducible so the offline render matches the preview.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// String -> 32-bit seed, so callers can write rng('fox-tail') instead of magic numbers.
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed = 1) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this._next = mulberry32(this.seed);
  }
  next() { return this._next(); }
  range(a, b) { return a + (b - a) * this._next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this._next() * arr.length)]; }
  chance(p) { return this._next() < p; }
  sign() { return this._next() < 0.5 ? -1 : 1; }
  // Approximately normal, mean 0, sd 1.
  gauss() {
    let u = 0, v = 0;
    while (u === 0) u = this._next();
    while (v === 0) v = this._next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // Child generator: a stable sub-stream that does not disturb this one.
  fork(label) { return new RNG((this.seed ^ hashString(String(label))) >>> 0); }
}

export const rng = (seed) => new RNG(seed);

// Stateless hash noise in [0,1) for integer lattice points.
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash1(x, seed = 0) { return hash2(x, 0x9e37, seed); }

// --- Gradient (Perlin) noise -------------------------------------------------

const GRAD2 = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  GRAD2.push([Math.cos(a), Math.sin(a)]);
}

function makePerm(seed) {
  const r = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export class Noise {
  constructor(seed = 1) {
    this.perm = makePerm(typeof seed === 'string' ? hashString(seed) : seed);
  }
  // Range roughly [-1, 1].
  n2(x, y) {
    const perm = this.perm;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const g00 = GRAD2[perm[X + perm[Y]] & 15];
    const g10 = GRAD2[perm[X + 1 + perm[Y]] & 15];
    const g01 = GRAD2[perm[X + perm[Y + 1]] & 15];
    const g11 = GRAD2[perm[X + 1 + perm[Y + 1]] & 15];
    const n00 = g00[0] * xf + g00[1] * yf;
    const n10 = g10[0] * (xf - 1) + g10[1] * yf;
    const n01 = g01[0] * xf + g01[1] * (yf - 1);
    const n11 = g11[0] * (xf - 1) + g11[1] * (yf - 1);
    const u = fade(xf), v = fade(yf);
    return 1.414 * ((n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v);
  }
  // 1-D smooth noise, handy for wobble over time.
  n1(x) { return this.n2(x, 7.31); }
  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.n2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
  // Tileable noise over a period (px, py) in noise units.
  tile2(x, y, px, py) {
    const u = x / px, v = y / py;
    const a = this.n2(x, y), b = this.n2(x - px, y);
    const c = this.n2(x, y - py), d = this.n2(x - px, y - py);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
}

const noiseCache = new Map();
export function noise(seed = 1) {
  const key = typeof seed === 'string' ? hashString(seed) : seed;
  let n = noiseCache.get(key);
  if (!n) { n = new Noise(key); noiseCache.set(key, n); }
  return n;
}
