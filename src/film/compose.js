// Low-level compositing used by transitions: draw the planes of one or more scenes
// interleaved by depth, each with its own camera, clip and opacity, and render
// whole scenes into offscreen buffers for masked wipes.

import { W, H, REST, layerMatrix } from '../core/stage.js';
import { surface } from '../core/canvas.js';

// entries: [{ scene, t, cam, filter(L), clip(L, env) -> Path2D|null (screen px at 1920x1080),
//             alpha(L) -> 0..1, plane(L) -> { dx, dy, sx, sy, ox, oy } extra motion in authored
//             coords (scale about the hinge ox, oy), env: {} }]
// Planes from all entries are merged and drawn far to near.
// inserts: [{ z, draw(ctx) }] extra planes drawn in film coordinates (1920x1080) at
// their place in the depth order.
export function composePlanes(ctx, entries, { background = null, inserts = [] } = {}) {
  const q = ctx.canvas.width / W;
  if (background) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  const items = [];
  for (const e of entries) {
    e.scene.build();
    const cam = e.cam ? { ...REST, ...e.cam } : e.scene.camera(e.t);
    const env = { t: e.t, scene: e.scene, cam, q, alpha: 1, ...e.env };
    env.shadow = { alpha: e.scene.shadow.alpha, ...e.scene.shadowOffset };
    for (const L of e.scene.layers) {
      if (e.filter && !e.filter(L)) continue;
      items.push({ e, L, cam, env });
    }
  }
  for (const ins of inserts) items.push({ ins, L: { z: ins.z, order: ins.order ?? 0 } });
  items.sort((a, b) => (b.L.z - a.L.z) || (a.L.order - b.L.order));
  for (const { e, L, cam, env, ins } of items) {
    if (ins) {
      ctx.save();
      ctx.setTransform(q, 0, 0, q, 0, 0);
      ins.draw(ctx);
      ctx.restore();
      continue;
    }
    const a = e.alpha ? e.alpha(L) : 1;
    if (a <= 0.001) continue;
    const m = layerMatrix(cam, L.z, q);
    if (!m) continue;
    ctx.save();
    const clip = e.clip ? e.clip(L, env) : null;
    if (clip) {
      ctx.setTransform(q, 0, 0, q, 0, 0);
      ctx.clip(clip);
    }
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const off = e.plane ? e.plane(L) : null;
    if (off) {
      const ox = off.ox ?? 0, oy = off.oy ?? 0;
      ctx.translate((off.dx ?? 0) + ox, (off.dy ?? 0) + oy);
      if (off.sx !== undefined || off.sy !== undefined) ctx.scale(off.sx ?? 1, off.sy ?? 1);
      ctx.translate(-ox, -oy);
    }
    env.layerScale = m.s;
    env.alpha = a;
    L.draw(ctx, e.t, env);
    ctx.restore();
  }
}

// Offscreen buffers sized like the output canvas, reused between frames.
const pool = new Map();
export function buffer(key, ref) {
  let b = pool.get(key);
  if (!b || b.canvas.width !== ref.width || b.canvas.height !== ref.height) {
    b = surface(ref.width, ref.height);
    pool.set(key, b);
  }
  b.ctx.setTransform(1, 0, 0, 1, 0, 0);
  b.ctx.globalAlpha = 1;
  b.ctx.globalCompositeOperation = 'source-over';
  b.ctx.filter = 'none';
  return b;
}

// Render a scene into a pooled buffer and return it.
export function renderToBuffer(key, ref, scene, t, opts = {}) {
  const b = buffer(key, ref);
  b.ctx.clearRect(0, 0, b.canvas.width, b.canvas.height);
  scene.render(b.ctx, t, opts);
  return b;
}

export { W, H };
