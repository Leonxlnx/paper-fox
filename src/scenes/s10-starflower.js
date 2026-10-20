// The landed guiding star (s10). A small gold paper star falls out of the dawn sky in a
// soft arc, lands on a closed bud beside the fox, and the bud unfolds into a six-petal
// star flower that ignites and then glows with a slow pulse.

import { RNG } from '../core/rng.js';
import { piece, linear, radial, bevelBands } from '../core/piece.js';
import { leaf, transform, TAU } from '../core/geom.js';
import { drawSprites } from '../core/sprite.js';
import { mix } from '../core/color.js';
import { E, bezier, clamp, lerp, osc, smoothstep } from '../core/ease.js';
import { compassStar, drawFoldedStar, drawGlow, GUIDE_GOLD } from '../elements/sky.js';
import { drawStem, drawLeaf } from '../elements/flora.js';

// Petal paper: cream at the heart, butter yellow, gold at the tips.
const PETAL = { heart: '#fffbe6', body: '#fbe68a', tip: '#f2c64e', fold: '#c99a2e', edge: '#fff6cf' };
const GLOW = { halo: '#ffd46e', core: '#fffbe8', flash: '#fff1c0' };

const PETALS = 6;
const SQUASH = 0.86;          // the open flower is seen a little from below
const FALL_EASE = bezier(0.32, 0, 0.25, 1);

// Bake one petal pointing up from its base at (0, 0).
function petalSprite(S, i, len, light) {
  const w = len * 0.42;
  return S.sprite({
    name: `starflower-petal${i}`, x: -w - 4, y: -len - 4, w: w * 2 + 8, h: len + 10, res: 2, mat: 'smooth',
    edge: { width: 0.8, hi: 0.35, lo: 0.15, soft: 0.4 }, shadow: { blur: 3, alpha: 0.35 },
    draw(ctx) {
      const pts = leaf(len, w, { belly: 0.42, n: 12, tipRound: 0.04 });
      const path = piece(ctx, pts, {
        fill: linear(ctx, 0, 0, 0, -len, [[0, PETAL.heart], [0.35, PETAL.body], [1, PETAL.tip]]),
      });
      // Centre fold: one half sits in the light, the other a little in shade.
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = 'rgba(201,154,46,0.22)';
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -len);
      ctx.lineTo(w * 1.2, -len * 0.5);
      ctx.lineTo(w * 1.2, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,225,0.8)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-0.6, -len * 0.08);
      ctx.lineTo(-0.6, -len * 0.92);
      ctx.stroke();
      ctx.restore();
      bevelBands(ctx, path, { light, width: 1, hi: 0.45, lo: 0.2, soft: 0.3 });
    },
  });
}

// Petal i: open angle (screen radians, 0 = right), closed angle in the bud, and length.
function petalPlan(rng) {
  return Array.from({ length: PETALS }, (_, i) => {
    const open = -Math.PI / 2 + (i / PETALS) * TAU + rng.range(-0.06, 0.06);
    const side = Math.cos(open);
    // In the bud every petal points up, fanned a little to its own side.
    const closed = -Math.PI / 2 + Math.sign(side || 1) * Math.min(0.22, Math.abs(side) * 0.3);
    // Petals on the lower half travel round through their own side when they close.
    let o = open;
    if (side >= 0 && o > Math.PI / 2 - 0.01) o -= TAU;
    const lenK = i === 0 ? 1 : Math.sin(open) > 0.3 ? 0.88 : 1.04;
    return { open: o, closed, lenK, back: Math.sin(open) < -0.2 };
  });
}

// opts: { x, y, stem: [x, y], z, tLand, tFall, open, light, size }
export function addStarflower(S, { x, y, stem, z, tFall, tLand, open = 0.6, light = S.light, size = 44 }) {
  const rng = new RNG('s10-starflower');
  const plan = petalPlan(rng);
  const petals = plan.map((p, i) => petalSprite(S, i, size * p.lenK, light));

  // Stem with two leaves at its foot, and a little tuft of blades.
  const stemSprite = S.sprite({
    name: 'starflower-stem', x: x - 70, y: y - 10, w: 150, h: stem[1] - y + 30, res: 1.5, mat: 'paper', shadow: { blur: 5 },
    draw(ctx) {
      drawStem(ctx, [[stem[0], stem[1]], [stem[0] - 2, lerp(stem[1], y, 0.5)], [x, y + 6]], { width: 5, tipWidth: 3.4, color: '#8c9a3a' });
      drawLeaf(ctx, { x: stem[0], y: stem[1] - 6, len: 52, width: 0.24, rot: -0.85, curl: -0.15, color: '#6f8a34', light, seed: 3 });
      drawLeaf(ctx, { x: stem[0] + 2, y: stem[1] - 4, len: 60, width: 0.22, rot: 0.75, curl: 0.2, color: '#8ea23e', light, seed: 4 });
      drawLeaf(ctx, { x: stem[0] - 1, y: stem[1] - 2, len: 40, width: 0.2, rot: -0.2, curl: 0.1, color: '#a8b44a', light, seed: 5 });
    },
  });

  // The falling star.
  const starR = 15;
  const fallStar = S.sprite({
    name: 'starflower-star', x: x - starR * 1.4, y: y - starR * 1.4, w: starR * 2.8, h: starR * 2.8, res: 2, mat: 'smooth',
    edge: { width: 0.8, hi: 0.4, lo: 0.2, soft: 0.3 }, shadow: { blur: 4, alpha: 0.4 },
    draw(ctx) { drawFoldedStar(ctx, compassStar(x, y, starR, { arms: [1.15, 0.85, 1.15, 0.85], inner: 0.3 }), { gold: GUIDE_GOLD, light }); },
  });

  // The heart of the open flower: a tiny cream star over a pale disc.
  const heart = S.sprite({
    name: 'starflower-heart', x: x - 14, y: y - 14, w: 28, h: 28, res: 2, mat: 'smooth', edge: false, shadow: { blur: 3, alpha: 0.3 },
    draw(ctx) {
      piece(ctx, compassStar(x, y, 10, { arms: [1, 1, 1, 1], inner: 0.45, rot: 0.4 }).pts, { fill: radial(ctx, x, y, 0, 10, [GLOW.core, '#fff1b8']) });
    },
  });

  // Fall path: in from above the frame on the right, curling down onto the bud.
  const P0 = [x + 300, -80], P1 = [x + 70, y - 330], P2 = [x, y - 4];
  const fallAt = (u) => {
    const k = FALL_EASE(u), a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
    return [a * P0[0] + b * P1[0] + c * P2[0], a * P0[1] + b * P1[1] + c * P2[1]];
  };
  const motes = Array.from({ length: 9 }, () => ({ a: rng.range(0, TAU), r: rng.range(16, 46), speed: rng.range(0.25, 0.45), phase: rng.next(), size: rng.range(1, 2.2) }));

  const layer = S.add({
    name: 'starflower', z, tags: ['starflower'],
    render(ctx, t) {
      const bloom = E.outSoft(clamp((t - tLand) / open));
      const lit = smoothstep(tLand - 0.05, tLand + 0.35, t);
      const pulse = 1 + 0.07 * osc(t, 2.8, 0.1) + 0.03 * osc(t, 1.3, 0.4);
      const sway = 0.035 * osc(t, 4.6, 0.2) + 0.015 * osc(t, 2.1, 0.7);

      // Halo behind the flower.
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, x, y, 150 * pulse, GLOW.halo, 0.42 * lit);
      ctx.globalCompositeOperation = 'source-over';

      drawSprites(ctx, [{ s: stemSprite, ax: stem[0], ay: stem[1], x: stem[0], y: stem[1], rot: sway * 0.3 }]);

      // Petals: back ones first, opening from the bud about the flower head.
      const head = [x + sway * (stem[1] - y) * 0.3, y];
      const items = plan.map((p, i) => {
        const ang = lerp(p.closed, p.open, bloom) + sway;
        const k = lerp(0.52, 1, bloom);
        return { s: petals[i], back: p.back, x: head[0], y: head[1], rot: ang + Math.PI / 2, sx: lerp(0.62, 1, bloom), sy: k * lerp(1, SQUASH + (1 - SQUASH) * Math.abs(Math.cos(p.open)), bloom) };
      });
      drawSprites(ctx, items.filter((it) => it.back));
      drawSprites(ctx, items.filter((it) => !it.back));
      if (bloom > 0) drawSprites(ctx, [{ s: heart, ax: x, ay: y, x: head[0], y: head[1], sx: bloom, sy: bloom, alpha: bloom }]);

      // Glow on top: the heart burns white, the petals catch it.
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, head[0], head[1], 70 * pulse, GLOW.halo, 0.5 * lit);
      drawGlow(ctx, head[0], head[1], 26 * pulse, GLOW.core, 0.85 * lit, { falloff: 'tight' });
      // Ignition flash as the star touches down.
      const f = clamp((t - tLand) / 0.9);
      if (f > 0 && f < 1) drawGlow(ctx, head[0], head[1], lerp(60, 260, E.out(f)), GLOW.flash, 0.9 * (1 - f) * (1 - f));
      // Motes drifting up out of the open flower.
      for (const m of motes) {
        const q = (t * m.speed + m.phase) % 1;
        const mx = head[0] + Math.cos(m.a) * m.r * (0.6 + q * 0.6), my = head[1] - 10 - q * 70 + Math.sin(m.a) * m.r * 0.4;
        drawGlow(ctx, mx, my, m.size * 6, GLOW.core, lit * Math.sin(Math.PI * q) * 0.8, { falloff: 'tight' });
      }
      ctx.globalCompositeOperation = 'source-over';

      // The falling star and its trail of sparks.
      if (t > tFall && t < tLand + 0.2) {
        const u = clamp((t - tFall) / (tLand - tFall));
        const land = clamp((t - tLand) / 0.2);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 1; k <= 12; k++) {
          const uu = u - k * 0.035;
          if (uu <= 0) break;
          const [px, py] = fallAt(uu);
          drawGlow(ctx, px, py, 14 - k * 0.8, GLOW.flash, (1 - k / 13) * 0.6 * (1 - land), { falloff: 'tight' });
        }
        const [sx, sy] = fallAt(u);
        drawGlow(ctx, sx, sy, 70, GLOW.halo, 0.6 * (1 - land));
        ctx.globalCompositeOperation = 'source-over';
        const s = (1 - land) * lerp(1, 0.75, u);
        drawSprites(ctx, [{ s: fallStar, ax: x, ay: y, x: sx, y: sy, rot: (1 - u) * 2.2, sx: s, sy: s, alpha: 1 - land }]);
      }
    },
  });
  return { layer, glowColor: mix(GLOW.halo, GLOW.core, 0.3) };
}
