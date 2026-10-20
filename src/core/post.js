// Film finish applied to the composed frame: bloom from bright paper and lights,
// colour grade, vignette and a fine animated grain (which also keeps dark skies from
// banding after encoding).

import { surface } from './canvas.js';
import { mulberry32 } from './rng.js';
import { rgba } from './color.js';

const BW = 480, BH = 270;
let small, small2, small3;
let grainTiles = null;

function ensure() {
  if (small) return;
  small = surface(BW, BH);
  small2 = surface(BW, BH);
  small3 = surface(BW, BH);
}

function makeGrain() {
  grainTiles = [];
  for (let k = 0; k < 6; k++) {
    const r = mulberry32(900 + k);
    const { canvas, ctx } = surface(256, 256);
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      // Sum of uniforms -> roughly gaussian grain.
      const g = 128 + ((r() + r() + r() - 1.5) / 1.5) * 110;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grainTiles.push(canvas);
  }
}

// opts: { bloom, threshold, bloomRadius, grade: {color, amount, mode}, vignette, grain, frame }
export function finish(ctx, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const { bloom = 0.35, threshold = 0.62, bloomRadius = 1, vignette = 0.28, grain = 0.05, frame = 0, grade = null, lift = null } = opts;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (bloom > 0) {
    ensure();
    small.ctx.globalCompositeOperation = 'copy';
    small.ctx.drawImage(ctx.canvas, 0, 0, BW, BH);
    const img = small.ctx.getImageData(0, 0, BW, BH);
    const d = img.data;
    const t0 = threshold, t1 = Math.min(1, threshold + 0.3);
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      let k = (l - t0) / (t1 - t0);
      k = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
      d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
    small.ctx.putImageData(img, 0, 0);
    small2.ctx.globalCompositeOperation = 'copy';
    small2.ctx.filter = `blur(${4 * bloomRadius}px)`;
    small2.ctx.drawImage(small.canvas, 0, 0);
    small2.ctx.filter = 'none';
    small3.ctx.globalCompositeOperation = 'copy';
    small3.ctx.filter = `blur(${14 * bloomRadius}px)`;
    small3.ctx.drawImage(small.canvas, 0, 0);
    small3.ctx.filter = 'none';
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, bloom * 0.8);
    ctx.drawImage(small2.canvas, 0, 0, W, H);
    ctx.globalAlpha = Math.min(1, bloom);
    ctx.drawImage(small3.canvas, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (grade && grade.amount > 0) {
    ctx.globalCompositeOperation = grade.mode ?? 'soft-light';
    ctx.globalAlpha = grade.amount;
    ctx.fillStyle = grade.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (lift && lift.amount > 0) {
    // Lifted blacks: a faint screen of a dark tone, like ink on paper rather than void.
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = lift.amount;
    ctx.fillStyle = lift.color ?? '#1a1f3a';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (vignette > 0) {
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, rgba('#3a3040', 1 - vignette));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (grain > 0) {
    if (!grainTiles) makeGrain();
    const r = mulberry32(frame * 7919 + 13);
    const tile = grainTiles[frame % grainTiles.length];
    const pat = ctx.createPattern(tile, 'repeat');
    pat.setTransform(new DOMMatrix().translate(Math.floor(r() * 256), Math.floor(r() * 256)));
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = grain;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
