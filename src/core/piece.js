// Drawing one paper cut-out at a time: fill, torn rim, per-piece bevel, contact shadow.

import { polyPath, smoothPath, tear } from './geom.js';
import { rgba } from './color.js';

const BIG = 1e5;

export function pathOf(pts, { smooth = false, closed = true, tension = 0.5 } = {}) {
  const p = new Path2D();
  if (smooth) smoothPath(p, pts, closed, tension); else polyPath(p, pts, closed);
  return p;
}

// Canvas shadows ignore the transform, so scale them by the bake resolution.
export function setShadow(ctx, { color = 'rgba(0,0,0,0.35)', blur = 6, x = 0, y = 3 } = {}) {
  const k = ctx.__res || 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = x * k;
  ctx.shadowOffsetY = y * k;
}

export function clearShadow(ctx) {
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// Light and dark bands just inside an outline: the lit and unlit cut edges.
export function bevelBands(ctx, path, { light = [0.4, -0.9], width = 1.5, hi = 0.25, lo = 0.2, hiColor = '#fffaf0', loColor = '#000', soft = 0 } = {}) {
  ctx.save();
  ctx.clip(path);
  if (soft) ctx.filter = `blur(${soft * (ctx.__res || 1)}px)`;
  const band = (dx, dy, color, a) => {
    const p = new Path2D();
    p.rect(-BIG, -BIG, BIG * 2, BIG * 2);
    p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy]));
    ctx.fillStyle = rgba(color, a);
    ctx.fill(p, 'evenodd');
  };
  if (hi) band(-light[0] * width, -light[1] * width, hiColor, hi);
  if (lo) band(light[0] * width, light[1] * width, loColor, lo);
  ctx.restore();
}

// Draw one cut-out. Returns its Path2D so callers can clip detail inside it.
//   fill    colour, gradient or pattern
//   torn    tear() options for an irregular hand-torn outline
//   rim     { color, width, torn } exposed white paper core around a torn edge
//   bevel   bevelBands() options
//   shadow  setShadow() options: the piece's contact shadow on what lies beneath
export function piece(ctx, pts, opts = {}) {
  const { fill = '#888', smooth = false, tension = 0.5, torn = null, rim = null, bevel = null, shadow = null, alpha = 1, stroke = null } = opts;
  const shape = torn ? tear(pts, torn) : pts;
  const path = pathOf(shape, { smooth: smooth && !torn, tension });
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (shadow) setShadow(ctx, shadow);
  if (rim) {
    const rimShape = rim.torn ? tear(pts, rim.torn) : shape;
    const rp = pathOf(rimShape, { smooth: smooth && !rim.torn, tension });
    ctx.fillStyle = rim.color ?? '#f6f0e4';
    ctx.strokeStyle = rim.color ?? '#f6f0e4';
    ctx.lineWidth = (rim.width ?? 2) * 2;
    ctx.lineJoin = 'round';
    ctx.fill(rp);
    ctx.stroke(rp);
    clearShadow(ctx);
  }
  ctx.fillStyle = fill;
  ctx.fill(path);
  clearShadow(ctx);
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width ?? 1;
    ctx.stroke(path);
  }
  ctx.restore();
  if (bevel) bevelBands(ctx, path, bevel);
  return path;
}

// Gradient helpers. stops: array of colours (evenly spaced) or [offset, colour] pairs.
function addStops(g, stops) {
  stops.forEach((s, i) => {
    if (Array.isArray(s)) g.addColorStop(s[0], s[1]);
    else g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), s);
  });
  return g;
}

export function linear(ctx, x0, y0, x1, y1, stops) {
  return addStops(ctx.createLinearGradient(x0, y0, x1, y1), stops);
}

export function radial(ctx, x, y, r0, r1, stops) {
  return addStops(ctx.createRadialGradient(x, y, r0, x, y, r1), stops);
}

// Additive light: a soft radial glow.
export function glow(ctx, x, y, r, color, alpha = 1, { mode = 'lighter', core = 0 } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = radial(ctx, x, y, r * core, r, [[0, rgba(color, 1)], [0.25, rgba(color, 0.45)], [0.6, rgba(color, 0.12)], [1, rgba(color, 0)]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
