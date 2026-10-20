// Fox test sheet. Each four-second window stages one pose where its reference fox
// stands, at the same size, so renders can be compared crop for crop:
//   [0, 4)   stand  - ref02 (on the flat grey rock, conifers behind)
//   [4, 8)   walk   - ref01 (crossing the bridge; at t = 6 it passes the ref01 position)
//   [8, 12)  sit    - ref10 (on the rock, dawn light)

import { Scene, W, H } from '../core/stage.js';
import { RNG } from '../core/rng.js';
import { piece, linear } from '../core/piece.js';
import { ridge, closeDown } from '../core/geom.js';
import { createFox } from '../elements/fox.js';

const OVER = 240;
const show = (a, b) => (t) => (t >= a && t < b ? 1 : 0);

// A loose row of dark paper conifers as a backdrop.
function conifers(ctx, rng, y0, y1, colors, count) {
  for (let i = 0; i < count; i++) {
    const x = rng.range(-OVER, W + OVER), h = rng.range(260, 520), w = h * rng.range(0.32, 0.42);
    const base = rng.range(y0, y1);
    const tiers = 6;
    for (let k = 0; k < tiers; k++) {
      const top = base - h + (k / tiers) * h * 0.85, bot = top + h * 0.3;
      const hw = (w / 2) * ((k + 1.5) / tiers);
      piece(ctx, [[x, top], [x + hw, bot], [x + hw * 0.4, bot - 8], [x, bot + 4], [x - hw * 0.4, bot - 8], [x - hw, bot]], {
        fill: rng.pick(colors), torn: { amp: 2, freq: 0.12, seed: rng.int(1, 50) },
        shadow: { color: 'rgba(0,10,5,0.4)', blur: 6, x: -2, y: 4 },
      });
    }
  }
}

export default function () {
  return new Scene({
    id: 'fox',
    duration: 12,
    background: '#14271f',
    light: [0.55, -0.83],
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.25, threshold: 0.7, vignette: 0.2, grain: 0.04 },
    build(S) {
      // --- stand: ref02 ----------------------------------------------------------
      S.plane(3000, {
        name: 'forest', x: -OVER, y: -OVER, w: W + 2 * OVER, h: H + 2 * OVER, mat: 'paper', edge: false, shadow: false,
        draw(ctx) {
          ctx.fillStyle = linear(ctx, 0, 0, 0, H, ['#16302a', '#1b3a30', '#24442f']);
          ctx.fillRect(-OVER, -OVER, W + 2 * OVER, H + 2 * OVER);
          conifers(ctx, new RNG('fox-forest'), 700, 900, ['#183a30', '#1d4335', '#14322a', '#21493a'], 26);
        },
      }, { alpha: show(0, 4) });
      S.plane(990, {
        name: 'rock', x: 120, y: 640, w: 1100, h: 560, mat: 'stone', res: 1, shadow: { blur: 14 },
        draw(ctx) {
          piece(ctx, [[180, 760], [300, 702], [520, 690], [760, 694], [930, 716], [1020, 780], [1060, 1180], [150, 1180]], { fill: '#4b4746', torn: { amp: 3, seed: 3 } });
          piece(ctx, [[260, 712], [420, 694], [640, 690], [840, 700], [940, 726], [700, 744], [420, 742]], { fill: '#6e6964', torn: { amp: 2, seed: 4 } });
        },
      }, { alpha: show(0, 4) });
      createFox(S, { z: 950, x: 620, y: 706, scale: 1, pose: 'stand', seed: 'fox-stand' }).layer.alpha = show(0, 4);
      createFox(S, { z: 950, x: 1250, y: 706, scale: 0.6, pose: 'stand', seed: 'fox-test', look: 1 }).layer.alpha = show(0, 4);
      createFox(S, { z: 950, x: 1650, y: 706, scale: 0.6, pose: 'stand', seed: 'fox-test2', look: -1 }).layer.alpha = show(0, 4);

      // --- walk: ref01 -----------------------------------------------------------
      S.plane(3000, {
        name: 'meadow', x: -OVER, y: -OVER, w: W + 2 * OVER, h: H + 2 * OVER, mat: 'paper', edge: false, shadow: false,
        draw(ctx) {
          ctx.fillStyle = linear(ctx, 0, 0, 0, H, ['#5a6fb0', '#8f86b8', '#e8a98f']);
          ctx.fillRect(-OVER, -OVER, W + 2 * OVER, H + 2 * OVER);
          const hill = ridge(-OVER, W + OVER, 470, { amp: 60, freq: 0.002, sharp: 0.1, seed: 4, step: 12 });
          piece(ctx, closeDown(hill, H + OVER), { fill: linear(ctx, 0, 380, 0, H, ['#8fa83c', '#5f7f2c']), torn: { amp: 2, seed: 5 } });
          conifers(ctx, new RNG('fox-meadow'), 420, 520, ['#2c5a3a', '#3a6a3f', '#244c33'], 14);
        },
      }, { alpha: show(4, 8) });
      S.plane(990, {
        name: 'bridge', x: -OVER, y: 560, w: W + 2 * OVER, h: 300, mat: 'paper', shadow: { blur: 12 },
        draw(ctx) {
          const r = new RNG('planks');
          for (let x = -OVER; x < W + OVER; x += 26) {
            piece(ctx, [[x, 598], [x + 25, 596], [x + 26, 640], [x + 1, 642]], { fill: r.pick(['#6b4a35', '#5c3f2d', '#7a5640']), torn: { amp: 1.2, seed: r.int(1, 30) } });
          }
          piece(ctx, [[-OVER, 636], [W + OVER, 636], [W + OVER, 690], [-OVER, 690]], { fill: '#3e2a1f', torn: { amp: 2, seed: 9 } });
        },
      }, { alpha: show(4, 8) });
      const walkSpeed = 125 * 0.74;
      createFox(S, {
        z: 950, x: 652, y: 605, scale: 0.74, pose: 'walk', seed: 'fox-walk',
        motion: (t) => ({ x: 652 + (t - 6) * walkSpeed }),
      }).layer.alpha = show(4, 8);

      // --- sit: ref10 ------------------------------------------------------------
      S.plane(3000, {
        name: 'dawn', x: -OVER, y: -OVER, w: W + 2 * OVER, h: H + 2 * OVER, mat: 'paper', edge: false, shadow: false,
        draw(ctx) {
          ctx.fillStyle = linear(ctx, 0, 0, 0, H, ['#7fa6cc', '#f2c27a', '#e7b65a']);
          ctx.fillRect(-OVER, -OVER, W + 2 * OVER, H + 2 * OVER);
          conifers(ctx, new RNG('fox-dawn'), 650, 800, ['#1e3d2c', '#2a4d33', '#173326'], 18);
        },
      }, { alpha: show(8, 12) });
      S.plane(990, {
        name: 'ledge', x: 120, y: 560, w: 1000, h: 640, mat: 'stone', shadow: { blur: 14 },
        draw(ctx) {
          piece(ctx, [[260, 700], [340, 650], [560, 636], [760, 648], [840, 720], [880, 1180], [200, 1180]], { fill: '#5d5148', torn: { amp: 3, seed: 6 } });
          piece(ctx, [[320, 664], [520, 640], [740, 650], [800, 690], [560, 690]], { fill: '#857565', torn: { amp: 2, seed: 7 } });
        },
      }, { alpha: show(8, 12) });
      createFox(S, { z: 950, x: 612, y: 650, scale: 0.95, pose: 'sit', seed: 'fox-sit' }).layer.alpha = show(8, 12);
    },
  });
}
