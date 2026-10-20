// The multiplane stage: paper layers at different depths, filmed by a perspective camera.
//
// Layers are authored in screen pixels as they appear with the camera at rest
// (1920x1080). Depth z says how far the plane is from the lens: z = F moves 1:1 with a
// camera pan, nearer planes move faster, far planes barely move, and a dolly (cam.z)
// pushes near planes past the lens much faster than distant ones.

import { bakeSprite, drawSprites } from './sprite.js';
import { hashString } from './rng.js';

export const W = 1920;
export const H = 1080;
export const F = 1000;

export const REST = Object.freeze({ x: 0, y: 0, z: 0, zoom: 1, roll: 0 });

// Matrix taking authored coords on a plane at depth z to screen coords.
export function layerMatrix(cam, z, q = 1) {
  const d = z - cam.z;
  if (d <= 20) return null;
  const s = z / d;
  const k = F / d;
  const zoom = cam.zoom ?? 1;
  const r = cam.roll ?? 0;
  const cos = Math.cos(r), sin = Math.sin(r);
  const cx = W / 2 + (cam.ox ?? 0), cy = H / 2 + (cam.oy ?? 0);
  const vx = -s * cx - cam.x * k, vy = -s * cy - cam.y * k;
  const zs = zoom * s;
  return {
    a: cos * zs * q, b: sin * zs * q, c: -sin * zs * q, d: cos * zs * q,
    e: (cx + zoom * (cos * vx - sin * vy)) * q,
    f: (cy + zoom * (sin * vx + cos * vy)) * q,
    s: zs,
  };
}

export class Layer {
  constructor(opts) {
    this.name = opts.name ?? 'layer';
    this.z = opts.z ?? F;
    this.sprites = opts.sprites ?? [];
    this.renderFn = opts.render ?? null;   // (ctx, t, env) per-frame drawing in authored coords
    this.anim = opts.anim ?? null;         // t -> { x, y, rot, sx, sy, ox, oy } whole-layer motion
    this.blend = opts.blend ?? 'source-over';
    this.alpha = opts.alpha ?? 1;          // number or t -> number
    this.shadow = opts.shadow ?? null;     // { alpha, dx, dy } defaults for this layer's sprites
    this.order = opts.order ?? 0;          // tie-break for equal z (higher draws later)
    this.tags = opts.tags ?? [];
  }

  draw(ctx, t, env) {
    const a = typeof this.alpha === 'function' ? this.alpha(t, env) : this.alpha;
    if (a <= 0.001) return;
    ctx.globalAlpha = a * (env.alpha ?? 1);
    ctx.globalCompositeOperation = this.blend;
    if (this.anim) {
      const m = this.anim(t, env);
      if (m) {
        const ox = m.ox ?? 0, oy = m.oy ?? 0;
        ctx.translate((m.x ?? 0) + ox, (m.y ?? 0) + oy);
        if (m.rot) ctx.rotate(m.rot);
        if (m.sx !== undefined || m.sy !== undefined) ctx.scale(m.sx ?? 1, m.sy ?? m.sx ?? 1);
        ctx.translate(-ox, -oy);
      }
    }
    if (this.sprites.length) drawSprites(ctx, this.sprites, { ...env.shadow, ...this.shadow });
    if (this.renderFn) this.renderFn(ctx, t, env);
  }
}

export class Scene {
  // opts: { id, duration, background, light, shadow, camera(t), post, build(scene) }
  constructor(opts) {
    this.id = opts.id;
    this.duration = opts.duration ?? 6;
    this.background = opts.background ?? '#000';
    this.light = opts.light ?? [0.4, -0.9];            // unit vector toward the key light
    this.shadow = { alpha: 0.5, dist: 9, blur: 10, ...(opts.shadow || {}) };
    this.cameraFn = opts.camera ?? null;
    this.post = opts.post ?? {};
    this.buildFn = opts.build;
    this.meta = opts.meta ?? {};
    this.layers = null;
    this.built = false;
    this._seq = 0;
  }

  // Default shadow offset: cast away from the light.
  get shadowOffset() {
    const d = this.shadow.dist;
    return { dx: -this.light[0] * d * 0.6, dy: Math.abs(this.light[1]) * d };
  }

  build() {
    if (this.built) return this;
    this.layers = [];
    this._seq = 0;
    this.buildFn(this);
    this.layers.sort((A, B) => (B.z - A.z) || (A.order - B.order));
    this.built = true;
    return this;
  }

  dispose() {
    this.layers = null;
    this.built = false;
  }

  // Add a layer. Returns it.
  add(opts) {
    const L = opts instanceof Layer ? opts : new Layer(opts);
    this.layers.push(L);
    return L;
  }

  // Bake a sprite using this scene's light and a stable per-sprite seed.
  sprite(opts) {
    const seed = opts.seed ?? hashString(`${this.id}:${opts.name ?? ''}:${this._seq++}`);
    return bakeSprite({ light: this.light, shadow: { blur: this.shadow.blur }, ...opts, seed });
  }

  // Shorthand: one baked sprite on its own plane.
  plane(z, spriteOpts, layerOpts = {}) {
    const s = this.sprite(spriteOpts);
    return this.add({ name: spriteOpts.name, z, sprites: [{ s }], ...layerOpts });
  }

  camera(t) {
    return { ...REST, ...(this.cameraFn ? this.cameraFn(t, this) : {}) };
  }

  // Draw the scene at local time t into ctx (any size; scaled from 1920x1080).
  //   cam     camera override (transitions drive the camera themselves)
  //   filter  layer => boolean, to draw a subset of planes
  //   alpha   global multiplier
  //   background  false to skip the backdrop fill
  render(ctx, t, opts = {}) {
    this.build();
    const q = ctx.canvas.width / W;
    const cam = opts.cam ? { ...REST, ...opts.cam } : this.camera(t);
    const env = { t, scene: this, cam, shadow: this.shadowOffset, alpha: opts.alpha ?? 1, q, ...opts.env };
    env.shadow = { alpha: this.shadow.alpha, ...env.shadow };
    if (opts.background !== false) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = opts.alpha ?? 1;
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    for (const L of this.layers) {
      if (opts.filter && !opts.filter(L)) continue;
      const m = layerMatrix(cam, L.z, q);
      if (!m) continue;
      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      env.layerScale = m.s;
      L.draw(ctx, t, env);
      ctx.restore();
    }
  }
}
