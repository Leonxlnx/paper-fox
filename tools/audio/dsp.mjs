// Small audio utilities for the soundtrack mixer: a look-ahead peak limiter and a
// 16-bit stereo WAV writer with TPDF dither. Buffers are Float32Array at 48 kHz.

export const SR = 48000;

function prng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Peak limiter with look-ahead and smooth release, in place on a stereo pair.
export function limiter(L, R, { ceiling = 0.89, release = 0.12, lookahead = 0.005 } = {}) {
  const la = Math.round(lookahead * SR);
  const rel = Math.exp(-1 / (release * SR));
  const n = L.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // Sliding minimum of the required gain over the look-ahead window (monotonic deque),
  // so the gain is already down when a peak arrives.
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
    const d = (r() - r()) / 32768;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((L[i] + d) * 32767))), 44 + i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((R[i] + d) * 32767))), 46 + i * 4);
  }
  return data;
}
