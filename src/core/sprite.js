// Sprites: painted once at build time, baked into paper, then only moved per frame.

import { surface } from './canvas.js';
import { bake, shadowOf } from './paper.js';

// Paint with draw(ctx) in authored coordinates inside the box (x, y, w, h), bake the
// paper look in, and keep a blurred silhouette for the drop shadow.
//   res     bake resolution (canvas px per authored px); raise it for layers the camera pushes into
//   mat     paper material (see MATERIALS in paper.js) or a custom recipe
//   edge    edgeLight() options, or false
//   shadow  { blur, alpha, dx, dy } or false
export function bakeSprite({ x, y, w, h, res = 1, draw, mat = 'paper', seed = 1, light = [0.4, -0.9], edge = {}, shadow = { blur: 10 } }) {
  const cw = Math.ceil(w * res), ch = Math.ceil(h * res);
  const { canvas, ctx } = surface(cw, ch);
  ctx.__res = res;
  ctx.scale(res, res);
  ctx.translate(-x, -y);
  draw(ctx);
  ctx.__res = undefined;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bake(canvas, { res, mat, seed, light, edge });
  let sh = null;
  if (shadow) {
    const b = shadowOf(canvas, (shadow.blur ?? 10) * res);
    sh = { canvas: b.canvas, pad: b.pad / res };
  }
  return { canvas, x, y, w: cw / res, h: ch / res, res, shadow: sh, shadowOpts: shadow || null };
}

// Wrap an existing canvas (already baked) as a sprite.
export function spriteFromCanvas(canvas, { x = 0, y = 0, res = 1, shadowBlur = 0, shadow = null } = {}) {
  let sh = null;
  if (shadowBlur) {
    const b = shadowOf(canvas, shadowBlur * res);
    sh = { canvas: b.canvas, pad: b.pad / res };
  }
  return { canvas, x, y, w: canvas.width / res, h: canvas.height / res, res, shadow: sh, shadowOpts: shadow || (shadowBlur ? { blur: shadowBlur } : null) };
}

function placed(ctx, it) {
  // it: { x, y } = where the anchor lands; ax, ay = anchor in the sprite's authored coords.
  const ax = it.ax ?? 0, ay = it.ay ?? 0;
  ctx.translate((it.x ?? ax) , (it.y ?? ay));
  if (it.rot) ctx.rotate(it.rot);
  if (it.sx !== undefined || it.sy !== undefined) ctx.scale(it.sx ?? 1, it.sy ?? it.sx ?? 1);
  ctx.translate(-ax, -ay);
}

// Draw a list of sprite placements: all drop shadows first (pieces on one plane never
// shadow each other), then the paper itself.
// defaults: { alpha, dx, dy } fallback shadow strength/offset from the layer or scene.
export function drawSprites(ctx, items, defaults = {}) {
  const base = ctx.globalAlpha;
  for (const it of items) {
    const s = it.s;
    if (!s.shadow || it.shadow === false) continue;
    const so = s.shadowOpts || {};
    const a = (it.shadowAlpha ?? so.alpha ?? defaults.alpha ?? 0.45) * (it.alpha ?? 1);
    if (a <= 0) continue;
    const dx = it.shadowDx ?? so.dx ?? defaults.dx ?? 0;
    const dy = it.shadowDy ?? so.dy ?? defaults.dy ?? 8;
    const p = s.shadow.pad;
    ctx.save();
    ctx.translate(dx, dy);
    placed(ctx, it);
    ctx.globalAlpha = base * a;
    ctx.drawImage(s.shadow.canvas, s.x - p, s.y - p, s.w + 2 * p, s.h + 2 * p);
    ctx.restore();
  }
  for (const it of items) {
    const s = it.s;
    const a = it.alpha ?? 1;
    if (a <= 0) continue;
    ctx.save();
    placed(ctx, it);
    ctx.globalAlpha = base * a;
    ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h);
    ctx.restore();
  }
  ctx.globalAlpha = base;
}

export function drawSprite(ctx, s, it = {}, defaults = {}) {
  drawSprites(ctx, [{ s, ...it }], defaults);
}
