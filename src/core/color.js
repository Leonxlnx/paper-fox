// Small colour toolkit. Colours travel as '#rrggbb' strings or [r,g,b] arrays (0-255).

export function hex(c) {
  if (Array.isArray(c)) return c;
  let s = c.replace('#', '');
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

export function toHex(rgb) {
  return '#' + rgb.map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
}

export function rgba(c, a = 1) {
  const [r, g, b] = hex(c);
  return `rgba(${clamp255(r)},${clamp255(g)},${clamp255(b)},${a})`;
}

export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

// t > 0 lightens toward white, t < 0 darkens toward black.
export function shade(c, t) {
  return t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t);
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

// Nudge hue (turns), saturation and lightness (additive, -1..1).
export function adjust(c, { h = 0, s = 0, l = 0 } = {}) {
  const [H, S, L] = rgbToHsl(hex(c));
  return toHex(hslToRgb([(H + h + 1) % 1, Math.max(0, Math.min(1, S + s)), Math.max(0, Math.min(1, L + l))]));
}

// Random variation of a base colour, for paper pieces cut from slightly different sheets.
export function vary(c, rng, amount = 0.04) {
  return adjust(c, {
    h: (rng.next() - 0.5) * amount * 0.25,
    s: (rng.next() - 0.5) * amount,
    l: (rng.next() - 0.5) * amount,
  });
}

// Atmospheric perspective: pull a colour toward the haze colour.
export function haze(c, hazeColor, t) { return mix(c, hazeColor, t); }

export function lum(c) {
  const [r, g, b] = hex(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
