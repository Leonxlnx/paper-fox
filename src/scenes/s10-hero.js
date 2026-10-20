// The hero corner of s10: the big spruce at the left edge and the spruces stepping down
// behind the fox, the granite boulder it sits on, the fox itself and the landed star flower.

import { RNG } from '../core/rng.js';
import { coniferMid, forestBand, addTree, addHeroConifer, addForestBand, FOLIAGE, BARK } from '../elements/trees.js';
import { drawShrub, drawSprig } from '../elements/flora.js';
import { createFox } from '../elements/fox.js';
import { addStarflower } from './s10-starflower.js';
import { drawPerch } from './s10-perch.js';
import { GOLD_SHRUB } from './s10-water.js';
import { LIGHT, FOX, BLOOM, T_FALL, T_LAND, T_OPEN } from './s10-layout.js';

export function buildHero(S) {
  // The slope of spruces right of the fox, running down to the left bank.
  addForestBand(S, {
    z: 1500, name: 'slope-forest', x0: 690, x1: 1050, light: LIGHT,
    base: [[690, 640], [800, 660], [920, 700], [1080, 760]],
    heights: [170, 330], rows: 3, density: 1.35, colors: [FOLIAGE.dawn, FOLIAGE.dusk], weights: [3, 1],
    haze: '#8496ae', hazeAmt: [0.15, 0], seed: 66, skirt: false, width: 0.3, tones: [0.1, 0.64], midMin: 60,
    box: { x: 560, y: 260, w: 640, h: 560 },
  });

  // Three spruces stepping down behind the fox's rock.
  S.plane(1250, {
    name: 'spruces', x: -320, y: 0, w: 1200, h: 780, shadow: { blur: 12 },
    draw(ctx) {
      const o = { palette: FOLIAGE.dawn, bark: BARK.dusk, light: LIGHT, tones: [0.06, 0.58] };
      // A dark wall of far spruces so no sky shows between the tiers.
      forestBand(ctx, {
        x0: -320, x1: 590, base: [[-320, 700], [590, 700]], heights: [380, 600], rows: 2, rowLift: 40, density: 1.6,
        colors: [FOLIAGE.forest], haze: '#56708a', hazeAmt: [0.18, 0.05], seed: 61, midMin: 999, skirt: false, width: 0.24,
        light: LIGHT, tones: [0.02, 0.36], gaps: 1,
      });
      coniferMid(ctx, 300, 700, 640, { ...o, seed: 64, width: 0.24, tones: [0.03, 0.42] });
      coniferMid(ctx, 520, 720, 600, { ...o, seed: 67, width: 0.25 });
      coniferMid(ctx, 600, 712, 520, { ...o, seed: 68, width: 0.24, tones: [0.08, 0.62] });
      coniferMid(ctx, 668, 700, 420, { ...o, seed: 65, width: 0.26, tones: [0.1, 0.66] });
    },
  });
  addTree(S, {
    z: 1150, name: 'spruce-tall', detail: 'near', x: 405, y: 740, h: 800, width: 0.27, tiers: 13,
    palette: FOLIAGE.dawn, bark: BARK.dusk, seed: 69, tones: [0.04, 0.52], light: LIGHT, sway: { phase: 0.3 },
  });

  // Gold undergrowth behind the rock, left of the fox.
  S.plane(1050, {
    name: 'gold-brush', x: 60, y: 380, w: 560, h: 340, shadow: { blur: 10 },
    draw(ctx) {
      const rng = new RNG('s10-gold-brush');
      for (const [x, y, w, h] of [[200, 640, 260, 190], [330, 660, 240, 150], [120, 650, 200, 160], [440, 670, 200, 110]]) {
        drawShrub(ctx, { x, y, w, h, leaf: 18, palette: GOLD_SHRUB, light: LIGHT, seed: rng.int(1, 1e6) });
      }
      for (let i = 0; i < 10; i++) {
        drawSprig(ctx, { x: rng.range(140, 520), y: rng.range(640, 690), h: rng.range(80, 160), lean: rng.range(-0.25, 0.25), leaves: 5, leafLen: 22, color: '#8a8a2a', leafColor: '#e8b830', bud: '#f6d24a', light: LIGHT, seed: rng.int(1, 1e6) });
      }
    },
  });

  addHeroConifer(S, {
    z: 1000, name: 'giant', x: 112, y: 760, h: 1560, width: 0.24, tiers: 13, trunkFrac: 0.34, trunkWidth: 0.085,
    palette: FOLIAGE.dawn, bark: BARK.dusk, seed: 70, bias: 0.5, contrast: 1.5, front: 0.3, interior: false, fronds: 2, light: LIGHT,
  });

  // The granite boulder the fox sits on, on a plane behind the fox (z 990 > fox 950) so
  // the tail and its white tip drape over the rock's left shoulder.
  S.plane(990, {
    name: 'perch', x: 220, y: 560, w: 760, h: 520, res: 1.25, mat: [{ tex: 'stone', amt: 0.8 }, { tex: 'crumple', amt: 0.6, scale: 0.32 }],
    shadow: { blur: 14 },
    draw(ctx) { drawPerch(ctx, LIGHT); },
  });

  const fox = createFox(S, { pose: 'sit', x: FOX.x, y: FOX.y, scale: FOX.scale, z: FOX.z, look: 0.85,
    rim: { amount: 0.8, color: '#ffe2a0', width: 3, glow: 0.35, dir: LIGHT } });
  fox.layer.tags = ['fox'];

  addStarflower(S, { x: BLOOM.x, y: BLOOM.y, stem: BLOOM.stem, z: BLOOM.z, tFall: T_FALL, tLand: T_LAND, open: T_OPEN, light: LIGHT });
}
