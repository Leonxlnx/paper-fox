// Flora test sheet. Three segments of 8/3 s, each recreating reference corners at their
// film positions so they can be compared crop for crop:
//   0.00-2.67  ref02 night lake: flower bed bottom-left, yellow-green shrubs and a meadow right
//   2.67-5.33  ref01 dusk bridge: lupine bed bottom-left, a generated bed bottom-right
//   5.33-8.00  ref03 firefly forest: mushroom and fern corners on both sides

import { Scene, W, H } from '../core/stage.js';
import { piece, linear, radial } from '../core/piece.js';
import { ridge, closeDown } from '../core/geom.js';
import { drawSprites } from '../core/sprite.js';
import { addFlowerBed, addMeadow, makePlant } from '../elements/flora.js';

const SEG = 8 / 3;
const inSeg = (k) => (t) => (Math.min(2, Math.floor(t / SEG)) === k ? 1 : 0);

export default function () {
  return new Scene({
    id: 'flora',
    duration: 8,
    background: '#10241c',
    light: [0.55, -0.83],
    post: { bloom: 0.25, threshold: 0.62, vignette: 0, grain: 0.04 },
    build(S) {
      const show = (layers, k) => { for (const L of [].concat(layers)) L.alpha = inSeg(k); };
      const backdrop = (k, stops, glow) => show(S.plane(20000, {
        name: `bg${k}`, x: -300, y: -300, w: W + 600, h: H + 600, mat: 'sky', edge: false, shadow: false,
        draw(ctx) {
          ctx.fillStyle = linear(ctx, 0, 0, 0, H, stops);
          ctx.fillRect(-300, -300, W + 600, H + 600);
          ctx.fillStyle = radial(ctx, glow[0], glow[1], 0, glow[2], [glow[3], 'rgba(0,0,0,0)']);
          ctx.fillRect(-300, -300, W + 600, H + 600);
        },
      }), k);
      const hill = (k, z, y, colors, seed) => show(S.plane(z, {
        name: `hill${k}`, x: -300, y: y - 120, w: W + 600, h: H - y + 420, shadow: { blur: 12 },
        draw(ctx) {
          piece(ctx, closeDown(ridge(-300, W + 300, y, { amp: 40, freq: 0.002, sharp: 0.1, seed, step: 12 }), H + 300), { fill: linear(ctx, 0, y - 60, 0, H, colors), torn: { amp: 1.5, seed } });
        },
      }), k);

      // ref02: dark woodland greens behind the cluster.
      backdrop(0, ['#1b3326', '#14281e', '#0c1c16'], [1300, 500, 900, 'rgba(70,90,60,0.35)']);
      hill(0, 1400, 960, ['#3c5a2c', '#22381c'], 3);
      show(addMeadow(S, { z: 1300, x0: 600, x1: W + 250, y: 1010, h: 110, seed: 'm1' }), 0);
      const shrubs = [
        makePlant(S, { type: 'shrub', x: 1180, y: 960, w: 280, h: 150, leaf: 22, seed: 5 }),
        makePlant(S, { type: 'shrub', x: 1560, y: 930, w: 340, h: 180, leaf: 26, seed: 3 }),
        makePlant(S, { type: 'shrub', x: 1840, y: 920, w: 340, h: 200, leaf: 28, seed: 4 }),
      ];
      show(S.add({ name: 'shrubs', z: 900, render(ctx, t, env) { drawSprites(ctx, shrubs.map((p) => ({ s: p.parts[0].s })), env.shadow); } }), 0);
      show(addFlowerBed(S, { preset: 'night-lake', z: 480 }), 0);

      // ref01: warm meadow light.
      backdrop(1, ['#e9b07a', '#c9b864', '#a0a848'], [300, 300, 900, 'rgba(255,220,150,0.35)']);
      hill(1, 1400, 820, ['#b8bc4c', '#7e9a3a'], 9);
      show(addFlowerBed(S, { preset: 'dusk-bridge', z: 480 }), 1);
      show(addFlowerBed(S, { region: [1300, 660, 1920, 1080], anchor: 'right', palette: 'dusk', seed: 'gallery-dusk', mix: { echinacea: 0.8, daisy: 3, astilbe: 1, lupine: 1, leaf: 2, blade: 4 }, z: 500 }), 1);

      // ref03: dark forest floor.
      backdrop(2, ['#132a2c', '#0f2224', '#0a1818'], [900, 400, 900, 'rgba(60,80,90,0.3)']);
      show(addFlowerBed(S, { preset: 'forest-left', z: 480 }), 2);
      show(addFlowerBed(S, { preset: 'forest-right', z: 480 }), 2);
    },
  });
}
