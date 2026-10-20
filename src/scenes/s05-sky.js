// s05 snow peaks: the night sky, its gold stars, the guiding star over the main
// peak and the two cream cloud banks (top left and right).

import { addSky, addStarField, addGuidingStar, addGlow, GUIDE_PRESETS } from '../elements/sky.js';
import { addCloud } from '../elements/clouds.js';

// Guiding star above the main summit (ref05 film px) and its arm length.
export const STAR = { x: 1403, y: 137, size: 70 };

// Gold paper sparkles: centre and horizontal arm, measured from the reference.
const SKY_STARS = [
  { x: 655, y: 30, r: 9 }, { x: 815, y: 40, r: 13 }, { x: 975, y: 42, r: 13 },
  { x: 1160, y: 72, r: 14 }, { x: 1080, y: 135, r: 18 }, { x: 1258, y: 118, r: 10 },
  { x: 1230, y: 213, r: 10 }, { x: 978, y: 275, r: 9 }, { x: 807, y: 259, r: 12 },
  { x: 1568, y: 68, r: 21 }, { x: 1678, y: 32, r: 8 }, { x: 1788, y: 80, r: 12 },
  { x: 1853, y: 32, r: 9 }, { x: 1738, y: 163, r: 18 }, { x: 1638, y: 200, r: 12 },
];

// Tiny round stars, denser around the guiding star as in the reference.
const SKY_DOTS = [
  [1098, 22], [1132, 260], [1188, 178], [1300, 60], [1318, 205], [1352, 250], [1470, 60],
  [1488, 232], [1515, 168], [1540, 120], [1605, 140], [1660, 250], [1700, 105], [1890, 120],
  [1905, 230], [1020, 230], [900, 290], [1268, 30], [1450, 20], [1590, 270], [1330, 110],
  [1820, 260], [1760, 25], [1120, 300], [1060, 80],
];

// Moonlit cumulus, cut as two stacked clouds so it has five overlapping tiers. The
// back one: a cream mass running off the top of the frame, the lit cream billows
// along the crown (the big one in the middle) and a second, lower row of cream
// billows in front of them. The front one: lavender billows hanging under the mass
// on the left and the lavender underside tapering into a thin tail on the right.
// Every tier is one merged sheet; the tiers' scalloped edges and drop shadows give
// the volume. Crowns are [x, y, r] film px; the base line of both is y = 216.
const CLOUD_LEFT = {
  name: 'cloud-left', seed: 's05-cloud-left', z: 7800,
  x: 180, y: -120, w: 1020, h: 336, tiers: 3,
  tierOpts: [
    // Lavender-grey mass running off the top of the frame.
    { crown: [[262, -6, 78], [356, -38, 104], [468, -34, 100], [560, -4, 76], [628, 26, 48]],
      lobes: 4, lumpy: 0.05, tone: 0.3, merge: true, dy: -42 },
    // The big cream billows of the crown, each its own puff.
    { crown: [[578, 102, 52], [662, 70, 70], [764, 58, 78], [858, 94, 58], [930, 128, 44], [986, 156, 32], [1034, 176, 22],
      [1074, 190, 14], [1108, 200, 9]],
      lobes: 5, lumpy: 0.08, tone: 0.0, merge: false, dy: -10, under: false },
    // A lower row of smaller billows, cream above, lavender below.
    { crown: [[590, 158, 36], [664, 150, 44], [744, 154, 46], [824, 166, 40], [892, 178, 32], [952, 189, 26],
      [1006, 198, 19], [1054, 204, 13], [1096, 209, 8]],
      lobes: 4, lumpy: 0.07, tone: 0.2, merge: false, under: false },
  ],
};
const CLOUD_LEFT_UNDER = {
  name: 'cloud-left-under', seed: 's05-cloud-left-under', z: 7790,
  x: 180, y: -120, w: 1020, h: 336, tiers: 2,
  tierOpts: [
    // Lavender billows hanging under the mass on the left.
    { crown: [[262, 54, 54], [340, 80, 62], [424, 106, 58], [500, 132, 46], [560, 154, 30]],
      lobes: 5, lumpy: 0.08, tone: 0.42, merge: false, dy: -39, under: false },
    // The lavender underside tapering into a thin tail on the right.
    { crown: [[560, 186, 26], [600, 182, 30], [646, 182, 32], [694, 186, 32], [742, 190, 31], [790, 193, 30], [838, 196, 28],
      [884, 199, 25], [928, 202, 22], [970, 205, 18], [1008, 207, 15], [1044, 209, 12], [1076, 211, 9], [1106, 212, 7], [1132, 213, 5]],
      lobes: 4, lumpy: 0.05, tone: 0.5, merge: true, under: false },
  ],
};const CLOUD_RIGHT = {
  name: 'cloud-right', seed: 's05-cloud-right', z: 7400,
  x: 1530, y: 60, w: 700, h: 300, tiers: 3,
  tierOpts: [
    { crown: [[1600, 296, 22], [1660, 262, 34], [1724, 232, 42], [1800, 206, 50], [1872, 170, 60], [1950, 150, 70],
      [2034, 160, 70], [2120, 176, 62], [2200, 190, 56]],
    lobes: 5, lumpy: 0.06, tone: 0.02, merge: true },
    { crown: [[1590, 318, 22], [1650, 306, 30], [1716, 294, 36], [1786, 284, 40], [1860, 276, 44], [1940, 272, 48],
      [2020, 274, 48], [2100, 280, 44], [2180, 286, 40]],
    lobes: 4, lumpy: 0.06, tone: 0.2, merge: true },
    { crown: [[1620, 340, 14], [1690, 334, 24], [1770, 338, 20], [1846, 328, 30], [1930, 336, 24], [2010, 326, 32],
      [2096, 334, 24], [2170, 330, 28]],
    lobes: 4, lumpy: 0.06, tone: 0.36, merge: true, under: false },
  ],
};
export function addSkyLayers(S, { rest }) {
  const tagged = (layers, tag) => { for (const L of [layers].flat()) L.tags = [...(L.tags ?? []), tag]; return layers; };

  tagged(addSky(S, {
    seed: 's05',
    // A faint cool bloom of light in the paper around the star.
    glows: [{ x: STAR.x, y: STAR.y + 40, r: 520, color: '#2a4a86', alpha: 0.35 }],
  }), 'sky');

  tagged(addStarField(S, { stars: SKY_STARS, dots: SKY_DOTS, region: [560, 0, 1400, 320], glow: 0.35, tall: 1.18, pinch: 0.62 }), 'celestial');

  // A wide, faint wash of starlight behind the guiding star, breathing with it.
  tagged(addGlow(S, {
    z: 12500, name: 'star-wash',
    items: (t) => [{ x: STAR.x, y: STAR.y, r: 420, color: '#9fb4ff', alpha: 0.1 + 0.03 * Math.sin((t / 3.8 + 0.1) * Math.PI * 2) }],
  }), 'celestial');

  const guide = addGuidingStar(S, {
    ...STAR, ...GUIDE_PRESETS.peak, rays: 0.35, halo: 0.6, sparkles: 0.8, seed: 's05-guide',
    arms: [1, 0.88, 0.97, 0.86],
  });
  tagged(guide.layers, 'celestial');

  const cloud = { palette: 'night', light: [0.35, -0.94], t0: rest, drift: 4, sway: 4, bob: 1.2,
    torn: { amp: 1.1 }, rim: { width: 1 }, accent: 0, bevel: 0.9, creases: 0,
    warm: { x: 740, y: 70, r: 640, color: '#ffd9ae', amt: 0.34 } };
  tagged(addCloud(S, { ...cloud, ...CLOUD_LEFT }), 'clouds');
  tagged(addCloud(S, { ...cloud, ...CLOUD_LEFT_UNDER }), 'clouds');
  tagged(addCloud(S, { ...cloud, ...CLOUD_RIGHT, drift: -3, warm: { x: 1900, y: 150, r: 500, color: '#ffd9ae', amt: 0.3 } }), 'clouds');
  return guide;
}
