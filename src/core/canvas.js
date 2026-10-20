// Canvas helpers shared by the build step (baking paper) and the per-frame renderer.

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(canvas) {
  return canvas.getContext('2d');
}

// Fresh canvas + context in one call.
export function surface(w, h) {
  const canvas = makeCanvas(w, h);
  return { canvas, ctx: ctx2d(canvas) };
}

export function clear(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

export function cloneCanvas(src) {
  const { canvas, ctx } = surface(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  return canvas;
}

// Silhouette of a canvas filled with one colour (keeps the alpha).
export function silhouette(src, color = '#fff') {
  const { canvas, ctx } = surface(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

// Gaussian blur through the canvas filter, done at reduced scale for big radii.
// Returns { canvas, scale, pad } where pad is in source pixels.
export function blurred(src, radius, { color = null, scale = null, pad = null } = {}) {
  const s = scale ?? (radius > 24 ? 0.25 : radius > 6 ? 0.5 : 1);
  const p = pad ?? Math.ceil(radius * 2.6 + 2);
  const w = Math.ceil((src.width + p * 2) * s), h = Math.ceil((src.height + p * 2) * s);
  const tmp = surface(w, h);
  const srcSmall = color ? silhouette(src, color) : src;
  tmp.ctx.filter = `blur(${Math.max(0.01, radius * s)}px)`;
  tmp.ctx.drawImage(srcSmall, p * s, p * s, src.width * s, src.height * s);
  tmp.ctx.filter = 'none';
  return { canvas: tmp.canvas, scale: s, pad: p };
}
