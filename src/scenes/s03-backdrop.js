// Firefly forest (s03): everything behind the big trunks. The navy sky gap where the
// guiding star hangs, misty spruce spires, the tiered dark spruces, the deep forest
// wall and the far forest floor the stream comes down from.

import { W, H } from '../core/stage.js';
import { RNG } from '../core/rng.js';
import { piece, linear, radial } from '../core/piece.js';
import { mix, rgba, vary } from '../core/color.js';
import { addSky } from '../elements/sky.js';
import { FOLIAGE, hazePalette, coniferMid, coniferFar, trunk, BARK } from '../elements/trees.js';
import { drawRedwood } from './s03-redwood.js';

// Night sky of the gap: deep navy at the top, a little bluer toward the treeline.
const SKY_STOPS = [[-240, '#081232'], [0, '#0b1a44'], [180, '#112455'], [380, '#18305f'], [620, '#203c68']];

// Misty far spruces: the pale blue-teal spires seen between the dark ones.
const MIST = '#42627f';
// Dark teal of the near spruce tiers.
const SPRUCE = FOLIAGE.teal;

export function addBackdrop(S, { star }) {
  addSky(S, {
    stops: SKY_STOPS, seed: 's03-sky', relief: 0.8,
    glows: [{ x: star.x, y: star.y, r: 420, color: '#4a5a8a', alpha: 0.35 }],
    flecks: { count: 1500, max: 1.4, alpha: 0.9, cover: 0.55 },
  }).tags.push('sky');

  // Misty spires: two rows of far spruce silhouettes hazed toward the night blue.
  S.plane(5200, {
    name: 'mist-spruces', x: 560, y: -120, w: 1240, h: 760, edge: { width: 1.2, hi: 0.18, lo: 0.1, soft: 0.6 }, shadow: { blur: 16, alpha: 0.35 },
    draw(ctx) {
      const rng = new RNG('s03-mist');
      const back = hazePalette(FOLIAGE.blue, MIST, 0.62);
      const front = hazePalette(FOLIAGE.blue, MIST, 0.4);
      const row = (pal, x0, x1, base, hMin, hMax, n) => {
        for (let i = 0; i < n; i++) {
          const x = lerpN(x0, x1, (i + rng.range(0.2, 0.8)) / n);
          coniferFar(ctx, x, base + rng.range(-20, 20), rng.range(hMin, hMax), { palette: pal, light: [-0.5, -0.86], seed: rng.int(1, 1e6), width: rng.range(0.2, 0.27), tones: [0.3, 0.62] });
        }
      };
      row(back, 640, 1700, 560, 260, 520, 13);
      row(front, 700, 1650, 600, 200, 380, 10);
    },
  });

  // Tiered dark spruces in the gap, hazed into the navy night, leaving open sky round the
  // star (ref x 840-1250).
  const NAVY = hazePalette(SPRUCE, '#0f2238', 0.5);
  S.plane(2800, {
    name: 'gap-spruces', x: 760, y: -280, w: 960, h: 980, edge: { width: 1.3, hi: 0.2, lo: 0.2, soft: 0.6 }, shadow: { blur: 14, alpha: 0.5 },
    draw(ctx) {
      const o = { palette: NAVY, light: [-0.55, -0.83], tones: [0.08, 0.36], width: 0.19, trunkWidth: 0 };
      coniferMid(ctx, 1012, 650, 660, { ...o, seed: 301 });
      coniferMid(ctx, 1138, 640, 470, { ...o, seed: 303, width: 0.17, tones: [0.12, 0.42] });
      coniferMid(ctx, 1408, 650, 640, { ...o, seed: 302 });
      coniferMid(ctx, 1505, 660, 560, { ...o, seed: 304 });
    },
  });
  S.plane(2300, {
    name: 'gap-spruces-near', x: 700, y: -320, w: 980, h: 1060, edge: { width: 1.5, hi: 0.24, lo: 0.22, soft: 0.6 }, shadow: { blur: 14, alpha: 0.55 },
    draw(ctx) {
      const o = { palette: hazePalette(SPRUCE, '#0f2238', 0.35), light: [-0.55, -0.83], tones: [0.06, 0.34], width: 0.18, trunkWidth: 0 };
      coniferMid(ctx, 925, 700, 780, { ...o, seed: 311 });
      coniferMid(ctx, 1470, 700, 720, { ...o, seed: 312 });
    },
  });
  // The deep forest wall on both sides of the gap: far trunks and dark boughs.
  S.plane(3400, {
    name: 'forest-wall', x: -420, y: -300, w: W + 840, h: 1040, edge: false, shadow: false, mat: 'paper',
    draw(ctx) {
      const rng = new RNG('s03-wall');
      const dark = ['#0a161c', '#0c1a20', '#0e1e22', '#0a1418'];
      // Masses of night foliage, leaving the gap open above x 880-1420.
      const mass = (x0, x1, yTop, yBot) => {
        piece(ctx, [[x0, yTop], [x1, yTop], [x1, yBot], [x0, yBot]], { fill: linear(ctx, 0, yTop, 0, yBot, ['#081218', '#0c1a1e', '#10221e']), torn: { amp: 18, freq: 0.01, fine: 3, seed: rng.int(1, 1e6) } });
      };
      mass(-420, 900, -300, 740);
      mass(1400, W + 420, -300, 740);
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? rng.range(-380, 880) : rng.range(1420, W + 380);
        const pal = hazePalette(SPRUCE, '#0c1a24', 0.55);
        coniferMid(ctx, side, rng.range(560, 700), rng.range(300, 620), { palette: pal, light: [0.5, -0.86], seed: rng.int(1, 1e6), width: 0.2, tones: [0.05, 0.3], flecks: false });
      }
      // Far trunks, barely lit.
      for (const [tx, tw] of [[-200, 70], [60, 54], [410, 64], [760, 50], [1500, 46], [1690, 60], [1990, 70], [2240, 60]]) {
        trunk(ctx, tx, -300, 700, tw, { bark: hazePalette(BARK.redwood, '#0d1822', 0.72), light: [tx < 1275 ? 0.6 : -0.6, -0.8], seed: rng.int(1, 1e6), taper: 0.92, flare: 0.25, segments: false });
      }
      void dark;
    },
  });

  // The far forest floor where the stream rises: a dark slope of moss and fern shapes.
  S.plane(2000, {
    name: 'far-floor', x: -400, y: 300, w: W + 800, h: 520, edge: { width: 1.4, hi: 0.2, lo: 0.2, soft: 0.6 }, shadow: { blur: 14, alpha: 0.5 },
    draw(ctx) {
      const rng = new RNG('s03-floor');
      const top = [];
      for (let x = -400; x <= W + 400; x += 20) top.push([x, 470 + 30 * Math.sin(x * 0.006) + rng.range(-8, 8) + (x > 1000 && x < 1500 ? 20 : 0)]);
      piece(ctx, [...top, [W + 400, 820], [-400, 820]], { fill: linear(ctx, 0, 440, 0, 760, ['#1d2c22', '#141e18', '#0c120e']), torn: { amp: 4, freq: 0.05, seed: 7 } });
      // Soft mounds of moss lit faintly by the star.
      for (let i = 0; i < 18; i++) {
        const x = rng.range(-300, W + 300), y = rng.range(470, 560), r = rng.range(50, 140);
        const lit = Math.max(0, 1 - Math.abs(x - 1275) / 700);
        piece(ctx, ellipseTop(x, y, r, r * 0.32), {
          fill: linear(ctx, 0, y - r * 0.32, 0, y + 10, [mix('#26402a', '#5a6e34', lit * 0.6), '#142018']),
          torn: { amp: 3, freq: 0.08, seed: rng.int(1, 1e6) },
          shadow: { color: 'rgba(0,0,0,0.4)', blur: 8, x: 0, y: 4 },
        });
      }
    },
  });
}

const lerpN = (a, b, t) => a + (b - a) * t;

// Upper half of an ellipse closed along its base.
function ellipseTop(cx, cy, rx, ry, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

export { radial, rgba, vary, drawRedwood };
