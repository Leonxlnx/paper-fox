// Dawn sky for s10: blue overhead warming through pale yellow to gold around the rising
// sun, big paper ray wedges fanning out of it, and puffy cream-gold cumulus heaps with a
// lavender bank in shade on the left.

import { addSky, addSun, drawGlow } from '../elements/sky.js';
import { piece, radial, linear } from '../core/piece.js';
import { ellipse } from '../core/geom.js';
import { drawSprites } from '../core/sprite.js';
import { osc } from '../core/ease.js';
import { addCloud, addStreak } from '../elements/clouds.js';
import { SUN, LIGHT } from './s10-layout.js';

// Sampled from the reference down the open sky (film px).
const SKY_STOPS = [
  [-240, '#3f7cc6'], [0, '#4b87ca'], [50, '#6797cc'], [100, '#a8b4b4'], [140, '#e2c88c'],
  [190, '#f4bc66'], [250, '#f6b65a'], [310, '#f8bc5e'], [370, '#fac46a'], [440, '#f8c066'], [1320, '#f0b058'],
];

// Cream-gold dawn cloud paper: lit crowns near white-cream, pale gold body, peach and
// rose in the folds, periwinkle-lavender in deep shade (the bank on the left).
// Every puff is its own cut piece, pillow-lit toward the sun: gold-cream crowns, a
// bright gold edge on the sun side, peach in the folds and soft lavender-grey undersides.
const CLOUD = {
  ramp: ['#fff2c8', '#ffe4a0', '#fcd186', '#f6bc74', '#eaa880', '#d49e9e', '#bc9cbc', '#a298c4', '#8c86b6'],
  tiers: [0.12, 0.07, 0.03, 0.01],
  lit: 0.42, vert: 0.36, spread: 0.2, jitter: 0.03,
  hi: '#ffe7a2', lo: '#54467a', bevel: [0.8, 0.16], shadow: 'rgba(92,72,124,0.3)',
  crease: '#fff8e6', creaseAlpha: 0.2, rim: null, merge: false, facet: ['#c07a3c', '#5c5090'],
  edge: { hi: 0.62, lo: 0.26 },
};

const SUN_AT = [SUN.x, SUN.y];

export function buildSky(S) {
  const sky = addSky(S, {
    palette: 'dawn', stops: SKY_STOPS, seed: 's10-sky',
    glows: [
      { x: SUN.x, y: SUN.y, r: 700, color: '#ffb840', alpha: 0.2 },
      { x: SUN.x, y: SUN.y + 10, r: 280, color: '#fff0b4', alpha: 0.28 },
    ],
  });
  sky.tags = ['sky'];

  const sun = addSun(S, {
    ...SUN, kind: 'sunrise', seed: 's10-sun', light: LIGHT, glow: 1.1, glowColor: '#ffc45a',
    rays: { count: 11, from: Math.PI * 0.94, to: Math.PI * 2.06, width: 0.56, alpha: 0.34, color: '#fff2c4', outer: 1500 },
  });
  for (const L of sun) L.tags = ['celestial', 'sun'];
  sunFace(S);

  // Open blue sky veils the outer ends of the rays, so they fan strongest in the gold.
  S.add({
    name: 'ray-veil', z: 14005, tags: ['sky'],
    render(ctx) {
      ctx.fillStyle = linear(ctx, 0, -240, 0, 230, [[0, 'rgba(70,128,200,0.74)'], [0.5, 'rgba(84,138,204,0.5)'], [1, 'rgba(96,148,206,0)']]);
      ctx.fillRect(-400, -240, 2720, 470);
    },
  });

  buildClouds(S);
}

// A crisp cream-white face over the library disc, and the white-hot light where the sun
// meets the ridge (the reference's brightest spot).
function sunFace(S) {
  const { x, y, r } = SUN;
  const disc = S.sprite({
    name: 'sun-face', x: x - r - 8, y: y - r - 8, w: r * 2 + 16, h: r * 2 + 16, res: 1.5, mat: 'crumpled',
    edge: { width: 1.5, hi: 0.3, lo: 0.1, soft: 0.6 }, shadow: false,
    draw(ctx) {
      piece(ctx, ellipse(x, y, r, r, 120), { fill: radial(ctx, x, y + r * 0.5, 4, r * 1.4, [[0, '#ffffff'], [0.4, '#fffbea'], [0.8, '#fff0c4'], [1, '#fbe0a0']]) });
    },
  });
  S.add({
    name: 'sun-face', z: 13900, tags: ['celestial', 'sun'],
    render(ctx, t) {
      drawSprites(ctx, [{ s: disc }]);
      const b = 1 + 0.04 * osc(t, 5.5, 0.3);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, x, y + 20, 420 * b, '#ffc860', 0.3);
      drawGlow(ctx, x, y + 34, 220 * b, '#fff0c0', 0.5);
      drawGlow(ctx, x, y + 52, 120 * b, '#ffffff', 0.85, { sx: 1.5, sy: 0.8 });
      ctx.globalCompositeOperation = 'source-over';
    },
  });
}

// A cumulus heap from hand-placed crown puffs, one list per tier (back to front). Each
// tier is cut as one soft mass with its biggest crowns cut again on top; the front tier
// has a lumpy underside in shade, so the heap reads as rounded masses stacked in depth
// rather than a cut shelf. Each heap is lit from the sun's side:
// right of the sun it faces left, left of it right.
function heap(S, common, name, z, base, tiers, extra = {}) {
  const all = tiers.flatMap((t) => t.crown);
  const x0 = Math.min(...all.map((c) => c[0] - c[2])), x1 = Math.max(...all.map((c) => c[0] + c[2]));
  const y0 = Math.min(...all.map((c) => c[1] - c[2]));
  const dx = SUN.x - (x0 + x1) / 2, dy = SUN.y - (y0 + base) / 2;
  const d = Math.hypot(dx, dy) || 1;
  const lx = dx / d, ly = Math.min(dy / d, 0) - 0.72;
  const l = Math.hypot(lx, ly);
  const tierOpts = tiers.map((t) => ({ merge: true, ...t }));
  return addCloud(S, {
    ...common, light: [lx / l, ly / l], name, seed: `s10-${name}`, z, x: x0, y: y0, w: x1 - x0, h: base - y0,
    tiers: tiers.length, tierOpts, flatBase: false, baseLift: 0.06, underR: 0.48, ...extra,
  });
}

// Cloud banks traced from the reference (film px): a lavender bank in shade sweeping down
// from the top left, the big cream heap across the top with a tail running right, a lower
// cream heap riding on the lavender, cumulus at the top-right corner and on the right
// edge above the sun, small puffs by the sun.
function buildClouds(S) {
  const t0 = 4.25;   // composed for the rest frame
  const common = {
    palette: CLOUD, t0, edge: { width: 2.6, hi: 0.6, lo: 0.24 }, minR: 6, shadowAlpha: 0.3, shadowDist: 7, shadowBlur: 12,
    // Broad, smooth bodies: few soft lobes and no accent discs cut on top.
    lobes: 4, lumpy: 0.05, creases: 1, accent: 0, warm: { x: SUN.x, y: SUN.y, r: 1000, color: '#f6a842', amt: 0.38 },
  };
  // Straight undersides like the reference's banks. Crowns overlap heavily and each tier
  // starts and ends with a low crown near its base, so the body reads as one broad mass
  // with a scalloped crown rather than a row of separate discs.
  const flat = { flatBase: true };

  // Lavender bank in shade, in two heaps so its underside steps down to the right.
  heap(S, common, 'lav-left', 10100, 236, [
    { tone: 0.84, crown: [[380, 200, 30], [440, 120, 56], [540, 60, 72], [670, 90, 70], [790, 140, 56], [866, 196, 34]] },
    { tone: 0.74, crown: [[420, 220, 22], [490, 186, 46], [610, 166, 60], [740, 180, 54], [840, 206, 34], [890, 224, 16]] },
  ], { drift: 3, ...flat });
  heap(S, common, 'lav-right', 10000, 292, [
    { tone: 0.82, crown: [[770, 262, 30], [830, 190, 56], [950, 178, 62], [1070, 200, 52], [1180, 222, 40], [1280, 244, 26], [1360, 260, 16], [1410, 272, 10]] },
    { tone: 0.7, crown: [[820, 276, 18], [880, 240, 44], [1000, 238, 50], [1120, 252, 38], [1230, 264, 26], [1320, 276, 14]] },
  ], { drift: 3, ...flat });

  // Behind the trees at the far left.
  heap(S, common, 'cream-left', 9700, 126, [
    { tone: 0.16, crown: [[200, 100, 30], [262, 52, 64], [370, 22, 82], [480, 60, 56], [536, 96, 28]] },
    { tone: 0.06, crown: [[250, 112, 22], [320, 96, 46], [430, 98, 44], [500, 112, 20]] },
  ], { drift: 3, ...flat });

  // The big cream heap: big rounded crowns rising off the top edge over one broad body,
  // a thin tail running right beneath it.
  heap(S, common, 'cream-top', 9000, 164, [
    { tone: 0.13, crown: [[540, 132, 30], [600, 70, 66], [700, 20, 94], [830, -4, 112], [960, 10, 100], [1070, 56, 66], [1130, 110, 34]] },
    { tone: 0.03, crown: [[580, 146, 20], [640, 122, 46], [740, 104, 64], [870, 100, 72], [990, 112, 58], [1090, 132, 38], [1160, 146, 22], [1220, 154, 12]] },
  ], { drift: 4, ...flat });
  addStreak(S, { ...common, light: [0.6, -0.8], name: 'streak-top', z: 8950, x: 820, y: 142, w: 450, h: 20, seed: 's10-top-streak', profile: 'lens', lightPos: SUN_AT, merge: true, drift: 4 });

  // The lower cream heap riding on the lavender: one broad body with a tail to the sun.
  heap(S, common, 'cream-mid', 9300, 280, [
    { tone: 0.05, crown: [[884, 262, 20], [930, 226, 44], [1010, 194, 62], [1110, 184, 66], [1210, 204, 52], [1290, 226, 36], [1350, 244, 24], [1400, 258, 14]] },
  ], { drift: 3, ...flat });
  addStreak(S, { ...common, light: [0.6, -0.8], name: 'streak-mid', z: 9250, x: 1010, y: 264, w: 420, h: 18, seed: 's10-mid-streak', profile: 'lens', lightPos: SUN_AT, merge: true, drift: 3 });

  // Top-right corner: big crowns off the top edge with a short tail to the left.
  heap(S, common, 'right-top', 8500, 98, [
    { tone: -0.02, crown: [[1630, 90, 10], [1680, 76, 22], [1750, 54, 38], [1840, 22, 58], [1950, -6, 78], [2050, -14, 82]] },
    { tone: -0.03, crown: [[1720, 92, 14], [1780, 80, 30], [1880, 70, 42], [2000, 62, 52]] },
  ], { drift: 4, lit: 0.26, shadowAlpha: 0.16, ...flat });

  // Right-edge cumulus above the sun: tall lit crowns, lavender in its lower folds.
  heap(S, common, 'right-cu', 8400, 272, [
    { tone: -0.02, crown: [[1740, 250, 22], [1800, 180, 46], [1880, 120, 66], [2000, 96, 84]] },
    { tone: -0.01, crown: [[1730, 262, 14], [1790, 236, 32], [1870, 206, 48], [1980, 188, 60]] },
    { tone: -0.04, crown: [[1720, 266, 10], [1780, 252, 22], [1860, 240, 34], [1960, 232, 46]] },
  ], { drift: 3, lit: 0.26, shadowAlpha: 0.16 });
  // Small puffs low on the left of the sun.
  heap(S, common, 'sun-puffs', 7600, 272, [
    { tone: 0.06, crown: [[1300, 258, 11], [1326, 246, 18], [1356, 238, 22], [1386, 248, 15], [1408, 258, 9]] },
  ], { drift: 4 });

  addStreak(S, { ...common, light: [-0.6, -0.8], name: 'streak-sun', z: 7500, x: 1590, y: 238, w: 150, h: 26, seed: 's10-sun-streak', profile: 'lens', lightPos: SUN_AT, merge: true, drift: 5 });
}
