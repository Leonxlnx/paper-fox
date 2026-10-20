// Minimal DSP toolkit for the synthesized soundtrack. Mono Float32 buffers at SR.

export const SR = 48000;

export function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * SR));
}

// Deterministic noise.
export function prng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db) => Math.pow(10, db / 20);

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'F#5' -> midi number
export function note(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const hz = (name) => midiToHz(note(name));

// Add src into dst at a sample offset with gain.
export function mixInto(dst, src, at = 0, gain = 1) {
  const o = Math.round(at * SR);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * gain;
}

// RBJ biquad, processed in place. type: lowpass|highpass|bandpass|peak|lowshelf|highshelf
export function biquad(type, f, q = 0.707, gainDb = 0) {
  const w = 2 * Math.PI * Math.min(f, SR * 0.49) / SR;
  const cos = Math.cos(w), sin = Math.sin(w), alpha = sin / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lowpass': b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case 'highpass': b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case 'peak': b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; break;
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cos + s); b1 = 2 * A * ((A - 1) - (A + 1) * cos); b2 = A * ((A + 1) - (A - 1) * cos - s);
      a0 = (A + 1) + (A - 1) * cos + s; a1 = -2 * ((A - 1) + (A + 1) * cos); a2 = (A + 1) + (A - 1) * cos - s; break;
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cos + s); b1 = -2 * A * ((A - 1) + (A + 1) * cos); b2 = A * ((A + 1) + (A - 1) * cos - s);
      a0 = (A + 1) - (A - 1) * cos + s; a1 = 2 * ((A - 1) - (A + 1) * cos); a2 = (A + 1) - (A - 1) * cos - s; break;
    }
    default: throw new Error(type);
  }
  const k = { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return {
    step(x) {
      const y = k.b0 * x + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    },
    run(buf) { for (let i = 0; i < buf.length; i++) buf[i] = this.step(buf[i]); return buf; },
  };
}

export function filter(buf, type, f, q, gainDb) { return biquad(type, f, q, gainDb).run(buf); }

// State-variable filter with per-sample cutoff (for sweeps). fc(i) -> Hz
export function svf(buf, fc, { q = 0.7, mode = 'lp' } = {}) {
  let low = 0, band = 0;
  const damp = 1 / q;
  for (let i = 0; i < buf.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(fc(i), SR * 0.2) / SR);
    const high = buf[i] - low - damp * band;
    band += f * high;
    low += f * band;
    buf[i] = mode === 'lp' ? low : mode === 'bp' ? band : high;
  }
  return buf;
}

// Exponential-ish ADSR value at time t (seconds) for a note of length dur.
export function adsr(t, dur, a = 0.01, d = 0.2, s = 0.7, r = 0.5) {
  if (t < 0) return 0;
  let v;
  if (t < a) v = t / a;
  else if (t < a + d) v = 1 - (1 - s) * (1 - Math.exp(-5 * (t - a) / d)) / (1 - Math.exp(-5));
  else v = s;
  if (t > dur) v *= Math.exp(-(t - dur) / (r / 4.6));
  return v;
}

// PolyBLEP sawtooth sample for phase in [0,1) and increment dt.
export function blepSaw(phase, dt) {
  let v = 2 * phase - 1;
  if (phase < dt) { const x = phase / dt; v -= x + x - x * x - 1; }
  else if (phase > 1 - dt) { const x = (phase - 1) / dt; v -= x * x + x + x + 1; }
  return v;
}

// Freeverb-style stereo reverb. Returns [L, R] wet signals for a mono send.
export function reverb(send, { room = 0.86, damp = 0.35, width = 1, seconds = 0 } = {}) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apT = [556, 441, 341, 225];
  const scale = SR / 44100;
  const n = send.length + Math.ceil(seconds * SR);
  const make = (spread) => {
    const out = new Float32Array(n);
    const combs = combT.map((c) => ({ buf: new Float32Array(Math.round((c + spread) * scale)), i: 0, store: 0 }));
    const aps = apT.map((c) => ({ buf: new Float32Array(Math.round((c + spread) * scale)), i: 0 }));
    for (let s = 0; s < n; s++) {
      const x = (s < send.length ? send[s] : 0) * 0.015;
      let y = 0;
      for (const c of combs) {
        const o = c.buf[c.i];
        c.store = o * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        a.buf[a.i] = y + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = b - y;
      }
      out[s] = y;
    }
    return out;
  };
  const L = make(0), R = make(23);
  if (width < 1) {
    for (let i = 0; i < n; i++) { const m = (L[i] + R[i]) / 2; L[i] = m + (L[i] - m) * width; R[i] = m + (R[i] - m) * width; }
  }
  return [L, R];
}

// Stereo delay (ping-pong) for sparkle and plucks.
export function pingPong(mono, { time = 0.375, feedback = 0.35, mix = 0.3, tone = 4000 } = {}) {
  const d = Math.round(time * SR);
  const L = new Float32Array(mono.length), R = new Float32Array(mono.length);
  const lpL = biquad('lowpass', tone), lpR = biquad('lowpass', tone);
  for (let i = 0; i < mono.length; i++) {
    const back = i >= d;
    const input = back ? mono[i - d] : 0;
    L[i] = lpL.step(input + (back ? R[i - d] : 0) * feedback);
    R[i] = lpR.step((back ? L[i - d] : 0) * feedback);
  }
  for (let i = 0; i < mono.length; i++) { L[i] *= mix; R[i] *= mix; }
  return [L, R];
}

// Soft clip.
export const softClip = (x) => Math.tanh(x);

// Peak-ish limiter with lookahead and smooth release, in place on a stereo pair.
export function limiter(L, R, { ceiling = 0.89, release = 0.12, lookahead = 0.005 } = {}) {
  const la = Math.round(lookahead * SR);
  const rel = Math.exp(-1 / (release * SR));
  const n = L.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // Sliding minimum of the required gain over the lookahead window (monotonic deque),
  // so gain is already down when a peak arrives; then a smooth release.
  const g = new Float32Array(n);
  const dq = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = 0; i < n + la; i++) {
    if (i < n) {
      while (tail > head && need[dq[tail - 1]] >= need[i]) tail--;
      dq[tail++] = i;
    }
    const out = i - la;
    if (out >= 0) {
      while (dq[head] < out) head++;
      g[out] = need[dq[head]];
    }
  }
  let env = 1;
  for (let i = 0; i < n; i++) {
    const target = g[i];
    env = target < env ? target : target + (env - target) * rel;
    L[i] *= env; R[i] *= env;
  }
}

// 16-bit PCM stereo WAV.
export function wav(L, R) {
  const n = L.length;
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  const r = prng(77);
  for (let i = 0; i < n; i++) {
    // TPDF dither.
    const d = (r() - r()) / 32768;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((L[i] + d) * 32767))), 44 + i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((R[i] + d) * 32767))), 46 + i * 4);
  }
  return data;
}
