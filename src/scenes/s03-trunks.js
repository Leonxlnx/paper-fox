// Firefly forest (s03): the four giant redwoods and the fir sprays hanging from their
// boughs. Each trunk and its foliage is one plane tagged curtainL / curtainR, so the
// next transition can slide them together like theatre curtains.

import { RNG } from '../core/rng.js';
import { canopy, branch } from '../elements/trees.js';
import { drawRedwood, REDWOOD } from './s03-redwood.js';
import { swayAnim } from '../elements/trees.js';

// Fir-spray greens of the ref03 canopy: lit sprays #66864f, mid #527549, shade #153822.
export const CANOPY_GREEN = { deep: '#0b2116', dark: '#1a3826', mid: '#3a5e3e', lit: '#5c8250', hi: '#86a866', fleck: '#d9c27a' };
// The cooler teal-green sprays right of the star.
export const CANOPY_TEAL = { deep: '#05201c', dark: '#10342e', mid: '#22504a', lit: '#3c6e5e', hi: '#5c8e74', fleck: '#d8c27a' };

// Trunks in film px at rest. lit: +1 star on the right, -1 on the left.
export const TRUNKS = [
  {
    name: 'redwood-centre', z: 1220, tag: 'curtainL', x: 562, w: 172, yTop: -340, yBase: 520, lit: 1, flare: [0.25, 0.45], seed: 's03-trunk-c',
    branches: [{ y: 150, side: 1, len: 210, width: 22, ang: -0.42, twigs: 3 }],
    foliage: [
      { x0: 640, x1: 900, y: -90, sag: 40, len: [130, 240], rows: 2, density: 1.0, dir: 1, palette: CANOPY_GREEN, bias: 0.5 },
      { x0: 380, x1: 600, y: -120, sag: 10, len: [110, 190], rows: 2, density: 0.9, dir: -1, palette: CANOPY_GREEN, bias: 0.42 },
    ],
  },
  {
    name: 'redwood-right', z: 1160, tag: 'curtainR', x: 1556, w: 168, yTop: -340, yBase: 560, lit: -1, flare: [0.5, 0.25], seed: 's03-trunk-r',
    foliage: [
      { x0: 1320, x1: 1540, y: -90, sag: 40, len: [140, 250], rows: 2, density: 1.0, dir: -1, palette: CANOPY_TEAL, bias: 0.55 },
    ],
  },
  {
    name: 'redwood-left', z: 1060, tag: 'curtainL', x: 222, w: 246, yTop: -340, yBase: 545, lit: 1, flare: [0.18, 0.7], moss: 0, seed: 's03-trunk-l',
    foliage: [
      { x0: -260, x1: 540, y: -110, sag: 40, len: [150, 240], rows: 2, density: 1.0, dir: 0, palette: CANOPY_GREEN, bias: 0.55 },
    ],
  },
  {
    name: 'redwood-far-right', z: 1010, tag: 'curtainR', x: 1812, w: 182, yTop: -340, yBase: 600, lit: -1, flare: [0.45, 0.3], moss: 0.2, seed: 's03-trunk-fr',
    foliage: [
      { x0: 1560, x1: 2300, y: -100, sag: 50, len: [160, 270], rows: 2, density: 1.0, dir: 0, palette: CANOPY_GREEN, bias: 0.6 },
    ],
  },
];

// Overscan around each trunk sprite: canopy sprays reach ~150 px past their root line.
const PAD = 420;

export function addTrunks(S) {
  return TRUNKS.map((T) => {
    const xs = [T.x - T.w * 1.2, T.x + T.w * 1.2, ...T.foliage.flatMap((f) => [f.x0 - 220, f.x1 + 220])];
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const rng = new RNG(T.seed);
    const light = [T.lit * 0.6, -0.8];
    return S.plane(T.z, {
      name: T.name, x: x0, y: T.yTop - 60, w: x1 - x0, h: T.yBase - T.yTop + 160, res: 1,
      edge: { width: 1.6, hi: 0.3, lo: 0.3, soft: 0.7 }, shadow: { blur: 16, alpha: 0.55 },
      draw(ctx) {
        for (const b of T.branches ?? []) {
          branch(ctx, T.x + b.side * T.w * 0.4, b.y, b.len, b.width, b.ang, { bark: { dark: REDWOOD.dark, mid: REDWOOD.mid, lit: REDWOOD.lit, hi: REDWOOD.hi }, light, seed: rng.int(1, 1e6), twigs: b.twigs });
        }
        drawRedwood(ctx, { detail: 0.85, ...T, seed: rng.int(1, 1e6) });
        for (const f of T.foliage) canopy(ctx, { light, seed: rng.int(1, 1e6), grain: 0.5, ...f });
      },
    }, { tags: [T.tag], anim: swayAnim(T.x, T.yBase, { amp: 0.0012, period: 9, phase: rng.next() }) });
  });
}

export { PAD };
