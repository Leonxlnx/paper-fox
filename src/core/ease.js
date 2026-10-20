// Motion vocabulary. Every move in the film is built from these few curves so the
// whole piece shares one sense of weight.

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, invLerp(a, b, v));
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * t * (t * (t * 6 - 15) + 10); };
// Interpolate scales/zooms in log space so equal times feel like equal changes.
export const lmix = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));

// Cubic bezier easing (same maths as CSS cubic-bezier).
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    for (let i = 0; i < 20 && Math.abs(sx(t) - x) > 1e-6; i++) {
      if (sx(t) < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const E = {
  linear: (t) => t,
  out: bezier(0.16, 1, 0.3, 1),        // arrivals, reveals
  outSoft: bezier(0.22, 1, 0.36, 1),   // gentle settles
  in: bezier(0.7, 0, 0.84, 0),         // hard snap out
  exit: bezier(0.55, 0.055, 0.675, 0.19),
  inOut: bezier(0.87, 0, 0.13, 1),     // whips
  smooth: bezier(0.65, 0, 0.35, 1),    // drifts, fades
  cam: bezier(0.48, 0.1, 0, 0.9),      // camera: slow start, long settle
  dolly: bezier(0.35, 0, 0.65, 1),     // slow push through a hold
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
};

// Progress of t through [a, b] with an easing curve.
export const prog = (t, a, b, ease = E.smooth) => ease(invLerp(a, b, t));

// Gentle periodic sway in [-1, 1].
export const osc = (t, period, phase = 0) => Math.sin(((t / period) + phase) * Math.PI * 2);
