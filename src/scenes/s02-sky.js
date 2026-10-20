// s02 night lake: the sky. Crumpled navy paper with gold glitter, the paper star
// field, the full moon behind its cloud bank and the long cloud drifting at the left.

import { addSky, addStarField, addMoon, REF02_STARS, REF02_DOTS } from '../elements/sky.js';
import { addCloud } from '../elements/clouds.js';

// Moon centre and radius in film px (ref02 x 1.1483).
export const MOON = { x: 1562, y: 162, r: 118 };

// The clouds are composed for the shot at rest; drift is zeroed there.
const T_REST = 4.25;

export function buildSky(S, tag) {
  tag(['sky'], () => {
    addSky(S, {
      palette: 'night', seed: 's02-sky',
      glows: [
        { x: MOON.x, y: MOON.y, r: 520, color: '#2a3f78', alpha: 0.45 },
        { x: 700, y: 120, r: 600, color: '#1a2a5a', alpha: 0.3 },
      ],
    });
  });

  tag(['celestial'], () => {
    addStarField(S, { stars: REF02_STARS, dots: REF02_DOTS, seed: 's02-stars' });
    addMoon(S, { x: MOON.x, y: MOON.y, r: MOON.r, seed: 's02-moon' });
    // Warm breathing glow laid over the moon and the sky around it.
    const R = 420;
    const glow = S.sprite({
      name: 'moon-glow', x: MOON.x - R, y: MOON.y - R, w: 2 * R, h: 2 * R, mat: 'none', edge: false, shadow: false,
      draw(ctx) {
        const g = ctx.createRadialGradient(MOON.x, MOON.y, 0, MOON.x, MOON.y, R);
        g.addColorStop(0, 'rgba(255,236,190,0.34)');
        g.addColorStop(0.27, 'rgba(255,226,170,0.2)');
        g.addColorStop(0.32, 'rgba(255,214,150,0.11)');
        g.addColorStop(0.6, 'rgba(230,190,140,0.04)');
        g.addColorStop(1, 'rgba(230,190,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(MOON.x - R, MOON.y - R, 2 * R, 2 * R);
      },
    });
    S.add({ name: 'moon-glow', z: 11900, blend: 'lighter', sprites: [{ s: glow }], alpha: (t) => 0.82 + 0.18 * Math.sin((t / 8.5) * Math.PI * 4 + Math.PI / 2) });
  });

  tag(['clouds'], () => {
    // The moon bank: cream crowns warmed by the moon over lavender undersides.
    addCloud(S, {
      name: 'moonbank', z: 9000, t0: T_REST, x: 1382, y: 122, w: 700, h: 185, tiers: 3, seed: 's02-moonbank',
      palette: 'night', light: [-0.45, -0.89], lit: 0.5, drift: -3, warm: { x: MOON.x, y: MOON.y, r: 380, color: '#ffd7a8', amt: 0.34 },
      tierOpts: [
        {
          crown: [[1405, 288, 24, 0.55], [1452, 285, 26, 0.55], [1500, 278, 28, 0.6], [1542, 258, 32, 0.95], [1598, 248, 36],
            [1666, 236, 58], [1772, 200, 70], [1880, 186, 76], [1985, 206, 74], [2070, 222, 70]],
          lobes: 0, tone: 0.08, merge: true,
        },
        { profile: [[0.12, 0], [0.16, 0.2], [0.27, 0.34], [0.38, 0.46], [0.48, 0.58], [0.58, 0.7], [0.68, 0.82], [0.8, 0.86], [0.9, 0.8], [1, 0.8]], size: 0.36, minR: 15, lobes: 6, lumpy: 0.15, tone: 0.2 },
        { profile: [[0, 0.04], [0.1, 0.08], [0.26, 0.14], [0.38, 0.22], [0.5, 0.3], [0.6, 0.36], [0.8, 0.34], [1, 0.36]], size: 0.6, minR: 12, lobes: 6, lumpy: 0.15, tone: 0.28, under: true, underR: 0.6 },
      ],
    });
    // The long cloud over the left trees, its tail thinning toward the peaks.
    addCloud(S, {
      name: 'leftcloud', z: 9500, t0: T_REST, x: 290, y: 0, w: 710, h: 195, tiers: 3, seed: 's02-left',
      palette: 'night', light: [0.8, -0.6], lit: 0.55, drift: 4,
      tierOpts: [
        {
          crown: [[310, 100, 45], [360, 62, 60], [450, 40, 80], [540, 30, 75], [620, 92, 30], [717, 114, 72], [815, 143, 38],
            [870, 168, 22, 0.8], [905, 171, 20, 0.7], [940, 174, 18, 0.62], [975, 178, 15, 0.55]],
          lobes: 0, tone: 0.2, merge: true,
        },
        { profile: [[0, 0.62], [0.06, 0.66], [0.13, 0.58], [0.225, 0.55], [0.366, 0.5], [0.507, 0.36], [0.6, 0.22], [0.66, 0]], size: 0.4, minR: 14, lobes: 6, lumpy: 0.15, tone: 0.5, dy: 40, under: true },
        { profile: [[0.42, 0], [0.47, 0.16], [0.6, 0.22], [0.75, 0.2], [0.9, 0.13], [1, 0.05]], size: 0.75, minR: 12, lobes: 5, lumpy: 0.12, tone: 0.2, under: true, underR: 0.6 },
      ],
    });
  });
}
