// Synthesized instruments and ambiences. Each function returns a mono Float32Array
// that the score mixes in at a time offset.

import { SR, buffer, prng, biquad, svf, adsr, blepSaw, filter } from './dsp.mjs';

const TAU = Math.PI * 2;

// Music box / celesta: FM tine with a quick metallic attack and long ring.
export function musicBox(f, { vel = 0.8, ring = null } = {}) {
  const decay = ring ?? Math.max(0.7, Math.min(2.6, 2.2 - Math.log2(f / 523) * 0.6));
  const len = decay * 5;
  const out = buffer(len);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / decay);
    const idx = 1.6 * Math.exp(-t / 0.09) + 0.25;
    let v = Math.sin(TAU * f * t + idx * Math.sin(TAU * f * 3.5 * t));
    v += 0.22 * Math.sin(TAU * f * 2 * t) * Math.exp(-t / (decay * 0.45));
    v += 0.06 * Math.sin(TAU * f * 5.43 * t) * Math.exp(-t / 0.08);
    out[i] = v * env * vel;
  }
  return filter(out, 'lowpass', 7500, 0.6);
}

// Soft felt piano: stretched harmonics, each decaying faster than the last.
export function feltPiano(f, { vel = 0.7, dur = 2.5, seed = 1 } = {}) {
  const len = dur + 2.5;
  const out = buffer(len);
  const base = 4.2 * Math.pow(220 / f, 0.35);
  const B = 0.00035;
  const parts = [];
  for (let k = 1; k <= 10; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    if (fk > 9000) break;
    parts.push({ w: TAU * fk, a: Math.pow(k, -1.35) * (k === 1 ? 1 : 0.6 + vel * 0.5), d: base / (1 + 0.55 * (k - 1)) });
  }
  const r = prng(seed);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const p of parts) v += p.a * Math.sin(p.w * t) * Math.exp(-t / p.d);
    const att = 1 - Math.exp(-t / 0.004);
    const rel = t > dur ? Math.exp(-(t - dur) / 0.35) : 1;
    // Felt hammer: a tiny noise thump at the onset.
    const ham = t < 0.03 ? (r() * 2 - 1) * (1 - t / 0.03) * 0.08 : 0;
    out[i] = (v * att * rel + ham) * vel * 0.5;
  }
  return filter(out, 'lowpass', 2600 + vel * 1500, 0.5);
}

// Warm pad: detuned PolyBLEP saws through a slowly breathing low-pass.
export function pad(freqs, { dur = 6, attack = 1.6, release = 2.5, cutoff = 1300, voices = 3, detune = 9, vel = 0.5, seed = 3, breath = 0.25 } = {}) {
  const len = dur + release + 0.2;
  const out = buffer(len);
  const r = prng(seed);
  const osc = [];
  for (const f of freqs) for (let v = 0; v < voices; v++) {
    const cents = (v - (voices - 1) / 2) * detune + (r() - 0.5) * 3;
    osc.push({ dt: f * Math.pow(2, cents / 1200) / SR, ph: r() });
  }
  for (let i = 0; i < out.length; i++) {
    let v = 0;
    for (const o of osc) {
      v += blepSaw(o.ph, o.dt);
      o.ph += o.dt; if (o.ph >= 1) o.ph -= 1;
    }
    out[i] = v / Math.sqrt(osc.length);
  }
  const lfoRate = 0.11 + r() * 0.05;
  svf(out, (i) => cutoff * (1 + breath * Math.sin(TAU * lfoRate * i / SR + seed)), { q: 0.8 });
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const a = t < attack ? 0.5 - 0.5 * Math.cos(Math.PI * t / attack) : 1;
    const rr = t > dur ? Math.max(0, Math.cos(Math.min(1, (t - dur) / release) * Math.PI / 2)) : 1;
    out[i] *= a * rr * vel * 0.35;
  }
  return out;
}

// Choir "ah": vibrato saws through vowel formants.
export function choir(freqs, { dur = 6, attack = 1.4, release = 2.5, vel = 0.5, seed = 5 } = {}) {
  const len = dur + release + 0.2;
  const src = buffer(len);
  const r = prng(seed);
  const osc = [];
  for (const f of freqs) for (let v = 0; v < 4; v++) osc.push({ f: f * Math.pow(2, ((v - 1.5) * 7 + (r() - 0.5) * 4) / 1200), ph: r(), vr: 4.6 + r() * 0.8, vp: r() * TAU });
  for (let i = 0; i < src.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const o of osc) {
      const vib = 1 + 0.0045 * Math.sin(TAU * o.vr * t + o.vp) * Math.min(1, t / 1.2);
      const dt = (o.f * vib) / SR;
      v += blepSaw(o.ph, dt);
      o.ph += dt; if (o.ph >= 1) o.ph -= 1;
    }
    src[i] = v / Math.sqrt(osc.length);
  }
  const out = buffer(len);
  for (const [fc, q, g] of [[720, 9, 1], [1150, 10, 0.5], [2700, 12, 0.22]]) {
    const b = Float32Array.from(src);
    filter(b, 'bandpass', fc, q);
    for (let i = 0; i < out.length; i++) out[i] += b[i] * g;
  }
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const a = t < attack ? 0.5 - 0.5 * Math.cos(Math.PI * t / attack) : 1;
    const rr = t > dur ? Math.max(0, Math.cos(Math.min(1, (t - dur) / release) * Math.PI / 2)) : 1;
    out[i] *= a * rr * vel * 1.6;
  }
  return out;
}

// Harp-like pluck (Karplus-Strong).
export function harp(f, { vel = 0.6, decay = 0.996, seed = 9, len = 3.5 } = {}) {
  const out = buffer(len);
  const N = Math.max(2, Math.round(SR / f));
  const line = new Float32Array(N);
  const r = prng(seed);
  for (let i = 0; i < N; i++) line[i] = r() * 2 - 1;
  // Pre-soften the excitation for a gentle finger pluck.
  for (let k = 0; k < 3; k++) for (let i = 1; i < N; i++) line[i] = 0.5 * (line[i] + line[i - 1]);
  let idx = 0, prev = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx];
    const nxt = 0.5 * (cur + prev) * decay;
    prev = cur;
    line[idx] = nxt;
    idx = (idx + 1) % N;
    out[i] = cur * vel;
  }
  return filter(out, 'lowpass', 5000, 0.6);
}

// Crystal / glass bell with inharmonic partials and slow beating.
export function bell(f, { vel = 0.5, ring = 4 } = {}) {
  const ratios = [[1, 1, 1], [2.32, 0.5, 0.7], [4.25, 0.25, 0.45], [6.63, 0.12, 0.3], [1.003, 0.6, 1]];
  const out = buffer(ring * 4);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [k, a, d] of ratios) v += a * Math.sin(TAU * f * k * t) * Math.exp(-t / (ring * d));
    out[i] = v * (1 - Math.exp(-t / 0.002)) * vel * 0.4;
  }
  return out;
}

// Soft sine sub with gentle saturation.
export function sub(f, { dur = 3, vel = 0.6, attack = 0.08, release = 0.8 } = {}) {
  const out = buffer(dur + release);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const e = adsr(t, dur, attack, 0.4, 0.8, release);
    out[i] = Math.tanh(1.4 * Math.sin(TAU * f * t)) * e * vel * 0.6;
  }
  return out;
}

// Low drum / timpani hit.
export function drum(f = 70, { vel = 0.8, seed = 4, decay = 1.1 } = {}) {
  const out = buffer(decay * 4);
  const r = prng(seed);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const ff = f * (1 + 0.6 * Math.exp(-t / 0.05));
    const body = Math.sin(TAU * ff * t) * Math.exp(-t / decay);
    const thump = (r() * 2 - 1) * Math.exp(-t / 0.025) * 0.35;
    out[i] = (body + thump) * vel;
  }
  return filter(out, 'lowpass', 900, 0.7);
}

// --- ambiences and effects --------------------------------------------------------

function noise(len, seed) {
  const out = buffer(len);
  const r = prng(seed);
  for (let i = 0; i < out.length; i++) out[i] = r() * 2 - 1;
  return out;
}

function pink(len, seed) {
  const out = noise(len, seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = out[i];
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

function fadeEnds(buf, fin, fout) {
  const a = Math.round(fin * SR), b = Math.round(fout * SR);
  for (let i = 0; i < a && i < buf.length; i++) buf[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / a);
  for (let i = 0; i < b && i < buf.length; i++) buf[buf.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / b);
  return buf;
}

// Flowing river: band-limited pink noise with slow surges and bubbling resonances.
export function river(len, { seed = 11, level = 0.5, bright = 1 } = {}) {
  const out = pink(len, seed);
  filter(out, 'highpass', 180, 0.7);
  filter(out, 'lowpass', 2400 * bright, 0.5);
  const r = prng(seed + 1);
  const ph = [r() * TAU, r() * TAU];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] *= level * (0.75 + 0.15 * Math.sin(TAU * 0.13 * t + ph[0]) + 0.1 * Math.sin(TAU * 0.37 * t + ph[1]));
  }
  // Bubbles: short resonant blips.
  const bub = buffer(len);
  for (let k = 0; k < len * 9; k++) {
    const at = Math.floor(r() * bub.length);
    const f = 350 + r() * 700, d = 0.012 + r() * 0.02, a = 0.03 + r() * 0.05;
    for (let i = 0; i < d * 5 * SR && at + i < bub.length; i++) {
      const t = i / SR;
      bub[at + i] += Math.sin(TAU * f * (1 + t * 8) * t) * Math.exp(-t / d) * a;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] += bub[i] * level;
  return fadeEnds(out, 1, 1);
}

export function waterfall(len, { seed = 13, level = 0.5 } = {}) {
  const out = pink(len, seed);
  const w = noise(len, seed + 3);
  for (let i = 0; i < out.length; i++) out[i] = out[i] * 0.8 + w[i] * 0.08;
  filter(out, 'highpass', 120, 0.7);
  filter(out, 'lowpass', 3800, 0.5);
  for (let i = 0; i < out.length; i++) out[i] *= level;
  return fadeEnds(out, 1.2, 1.2);
}

export function wind(len, { seed = 17, level = 0.4, center = 500 } = {}) {
  const out = pink(len, seed);
  const r = prng(seed);
  const p1 = r() * TAU, p2 = r() * TAU;
  svf(out, (i) => center * (1 + 0.5 * Math.sin(TAU * 0.07 * i / SR + p1) + 0.25 * Math.sin(TAU * 0.19 * i / SR + p2)), { q: 1.6, mode: 'bp' });
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] *= level * 2.2 * (0.6 + 0.4 * Math.sin(TAU * 0.09 * t + p2));
  }
  return fadeEnds(out, 1.5, 1.5);
}

export function rain(len, { seed = 19, level = 0.4 } = {}) {
  const out = noise(len, seed);
  filter(out, 'highpass', 1200, 0.6);
  filter(out, 'lowpass', 9000, 0.5);
  for (let i = 0; i < out.length; i++) out[i] *= level * 0.35;
  const r = prng(seed + 7);
  for (let k = 0; k < len * 160; k++) {
    const at = Math.floor(r() * out.length);
    const f = 1800 + r() * 5000, a = 0.02 + r() * 0.06;
    for (let i = 0; i < 400 && at + i < out.length; i++) out[at + i] += Math.sin(TAU * f * i / SR) * Math.exp(-i / 60) * a * level;
  }
  return fadeEnds(out, 1, 1);
}

export function thunder(len = 5, { seed = 23, level = 0.8, crack = 0.6 } = {}) {
  const out = pink(len, seed);
  const r = prng(seed);
  // Rumble: a few overlapping swells.
  const env = new Float32Array(out.length);
  for (let k = 0; k < 6; k++) {
    const at = (k === 0 ? 0 : r() * 1.6) * SR, d = (0.6 + r() * 1.4) * SR, a = k === 0 ? 1 : 0.4 + r() * 0.5;
    for (let i = 0; i < out.length; i++) {
      const x = (i - at) / d;
      if (x > 0) env[i] += a * x * Math.exp(1 - x * 2.2);
    }
  }
  for (let i = 0; i < out.length; i++) out[i] *= env[i];
  filter(out, 'lowpass', 420, 0.6);
  filter(out, 'lowshelf', 90, 0.7, 6);
  // Crack: a bright burst at the start.
  const c = noise(0.4, seed + 9);
  filter(c, 'bandpass', 1800, 0.8);
  for (let i = 0; i < c.length; i++) out[i] += c[i] * Math.exp(-i / (SR * 0.06)) * crack;
  for (let i = 0; i < out.length; i++) out[i] *= level * 1.4;
  return out;
}

export function waveCrash(len = 3.5, { seed = 29, level = 0.6 } = {}) {
  const out = pink(len, seed);
  svf(out, (i) => { const t = i / SR; return 500 + 2600 * Math.exp(-Math.pow((t - 0.7) / 0.6, 2)); }, { q: 0.6 });
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const e = t < 0.6 ? Math.pow(t / 0.6, 2) : Math.exp(-(t - 0.6) / 1.1);
    out[i] *= e * level * 2;
  }
  return out;
}

export function crickets(len, { seed = 31, level = 0.15 } = {}) {
  const out = buffer(len);
  const r = prng(seed);
  for (let c = 0; c < 3; c++) {
    const f = 4100 + r() * 900, period = 0.55 + r() * 0.35;
    for (let at = r() * period; at < len - 0.3; at += period * (0.85 + r() * 0.3)) {
      const pulses = 3 + Math.floor(r() * 2);
      for (let p = 0; p < pulses; p++) {
        const s0 = Math.floor((at + p * 0.034) * SR);
        for (let i = 0; i < 0.022 * SR && s0 + i < out.length; i++) {
          const t = i / SR;
          out[s0 + i] += Math.sin(TAU * f * t) * Math.sin(Math.PI * t / 0.022) * level * (0.5 + c * 0.25);
        }
      }
    }
  }
  return fadeEnds(out, 1, 1);
}

export function birds(len, { seed = 37, level = 0.12, density = 1 } = {}) {
  const out = buffer(len);
  const r = prng(seed);
  let at = 0.4;
  while (at < len - 0.5) {
    const notes = 2 + Math.floor(r() * 4);
    const f0 = 2600 + r() * 2200;
    for (let n = 0; n < notes; n++) {
      const d = 0.05 + r() * 0.09, sweep = (r() - 0.3) * 1600;
      const s0 = Math.floor((at + n * (d + 0.04)) * SR);
      let ph = 0;
      for (let i = 0; i < d * SR && s0 + i < out.length; i++) {
        const t = i / SR;
        const f = f0 + sweep * (t / d) + 300 * Math.sin(TAU * 28 * t);
        ph += TAU * f / SR;
        out[s0 + i] += Math.sin(ph) * Math.sin(Math.PI * t / d) * level;
      }
    }
    at += (0.6 + r() * 1.6) / density;
  }
  return fadeEnds(out, 1, 1);
}

export function drip(f = 1100, { vel = 0.4 } = {}) {
  const out = buffer(0.5);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const ff = f * (1 - 0.45 * Math.min(1, t / 0.05));
    ph += TAU * ff / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.045) * vel;
  }
  return out;
}

// Paper whoosh for transitions: a swept band of noise with a papery crinkle.
export function paperWhoosh(len = 1.2, { seed = 41, level = 0.4, up = true, crinkle = 0.5 } = {}) {
  const out = pink(len, seed);
  svf(out, (i) => { const x = i / out.length; const k = up ? x : 1 - x; return 350 * Math.pow(9, k); }, { q: 1.1, mode: 'bp' });
  const r = prng(seed + 2);
  for (let i = 0; i < out.length; i++) {
    const x = i / out.length;
    const e = Math.pow(Math.sin(Math.PI * x), 1.6);
    out[i] *= e * level * 2.2;
  }
  // Crinkle: sparse bright clicks, denser in the middle.
  const c = buffer(len);
  for (let k = 0; k < len * 220 * crinkle; k++) {
    const x = Math.pow(r(), 0.9);
    const at = Math.floor((0.15 + 0.7 * x) * c.length);
    const a = (r() * 2 - 1) * 0.25 * Math.sin(Math.PI * x);
    for (let i = 0; i < 40 && at + i < c.length; i++) c[at + i] += a * Math.exp(-i / 6);
  }
  filter(c, 'highpass', 2500, 0.7);
  for (let i = 0; i < out.length; i++) out[i] += c[i] * level;
  return out;
}

// Leafy rustle: bursts of crinkly high noise, like flying through branches.
export function rustle(len = 1.4, { seed = 47, level = 0.4 } = {}) {
  const out = buffer(len);
  const r = prng(seed);
  for (let k = 0; k < len * 140; k++) {
    const x = r();
    const at = Math.floor(x * out.length);
    const env = Math.pow(Math.sin(Math.PI * x), 1.2);
    const a = (r() * 2 - 1) * env * 0.5;
    const d = 30 + r() * 140;
    for (let i = 0; i < d * 4 && at + i < out.length; i++) out[at + i] += a * (r() * 2 - 1) * Math.exp(-i / d);
  }
  filter(out, 'highpass', 1400, 0.7);
  filter(out, 'peak', 4200, 0.8, 4);
  const body = pink(len, seed + 1);
  svf(body, (i) => 600 + 1800 * Math.sin(Math.PI * i / body.length), { q: 0.9, mode: 'bp' });
  for (let i = 0; i < out.length; i++) out[i] = (out[i] + body[i] * Math.sin(Math.PI * i / out.length) * 0.8) * level;
  return out;
}

// Deep woody swish: something big and heavy passing close to the lens.
export function heavySwish(len = 0.9, { seed = 53, level = 0.5, up = true } = {}) {
  const out = pink(len, seed);
  svf(out, (i) => { const x = i / out.length; return 160 * Math.pow(5, up ? x : 1 - x); }, { q: 1.4, mode: 'bp' });
  for (let i = 0; i < out.length; i++) {
    const x = i / out.length;
    out[i] *= Math.pow(Math.sin(Math.PI * x), 2) * level * 3;
  }
  return out;
}

// Grinding stone rumble that swells as the rock closes.
export function rumble(len = 1.2, { seed = 59, level = 0.5, swell = 'in' } = {}) {
  const out = pink(len, seed);
  filter(out, 'lowpass', 260, 0.7);
  const grit = noise(len, seed + 3);
  filter(grit, 'bandpass', 900, 1.2);
  for (let i = 0; i < out.length; i++) {
    const x = i / out.length;
    const e = swell === 'in' ? Math.pow(x, 1.5) : Math.pow(1 - x, 1.5);
    out[i] = (out[i] * 4 + grit[i] * 0.15) * e * level;
  }
  return out;
}

// One paper flap: a quick papery slap with a crinkle tail.
export function paperFlap({ seed = 61, level = 0.4, pitch = 1 } = {}) {
  const out = noise(0.22, seed);
  filter(out, 'bandpass', 1300 * pitch, 0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] *= (t < 0.008 ? t / 0.008 : Math.exp(-(t - 0.008) / 0.035)) * level * 2.5;
  }
  const thud = buffer(0.15);
  for (let i = 0; i < thud.length; i++) {
    const t = i / SR;
    thud[i] = Math.sin(TAU * 110 * pitch * t) * Math.exp(-t / 0.03) * level * 0.6;
  }
  for (let i = 0; i < thud.length; i++) out[i] += thud[i];
  return out;
}

// Shimmering swell toward a moment of light (reverse-cymbal feel, made of bells and air).
export function shimmerSwell(len = 1.6, { seed = 67, level = 0.4, freqs = [1175, 1480, 1760, 2349] } = {}) {
  const out = noise(len, seed);
  filter(out, 'highpass', 3000, 0.7);
  for (let i = 0; i < out.length; i++) {
    const x = i / out.length;
    out[i] *= Math.pow(x, 2.5) * level * 0.5;
  }
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, x = i / out.length;
    let v = 0;
    for (const f of freqs) v += Math.sin(TAU * f * t * (1 + 0.002 * Math.sin(TAU * 6 * t)));
    out[i] += v * Math.pow(x, 2) * level * 0.08;
  }
  return out;
}

// Low shimmering drone (portal hum).
export function hum(len, { f = 73.4, level = 0.3, seed = 43 } = {}) {
  const out = buffer(len);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 1.5 * t + 0.3 * Math.sin(TAU * 0.2 * t)) + 0.3 * Math.sin(TAU * (f * 2 + 0.7) * t);
    out[i] = v * level * 0.4;
  }
  return fadeEnds(out, 2, 2);
}
