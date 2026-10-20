// Sky family test sheet. Six segments of 1.33 s, each recreating one reference sky at
// its original positions and scale (references are 1672x941, film px = ref px * 1.1483):
//   0.00-1.33  ref02 night: moon, gold paper stars, dot stars
//   1.33-2.67  ref01 dusk: low sun, guiding star with its trail
//   2.67-4.00  ref10 dawn: rising sun with ray wedges
//   4.00-5.33  ref04 twilight: eight-point guiding star with its beam, moon, stars
//   5.33-6.67  ref08 aurora: curtains, stars, the guiding star above the peak
//   6.67-8.00  ref07 storm: slate sky and the storm-lit guiding star
// A plain paper silhouette traced from each reference stands in for the mountains,
// so low suns are cut where they are cut in the references.

import { Scene, W, H } from '../core/stage.js';
import { piece, linear } from '../core/piece.js';
import { smoothstep } from '../core/ease.js';
import {
  addSky, addStarField, addMoon, addSun, addGuidingStar, addAurora, REF02_STARS, REF02_DOTS, GUIDE_PRESETS,
} from '../elements/sky.js';

const SEGMENTS = 6;
const SEG = 8 / SEGMENTS;
const FADE = 0.1;
const REF = 1920 / 1672;

// Visibility of segment i: fully on inside its window, short crossfades at the cuts.
function segAlpha(i) {
  const a = i * SEG, b = a + SEG;
  return (t) => (i === 0 ? 1 : smoothstep(a - FADE, a + FADE, t)) * (i === SEGMENTS - 1 ? 1 : 1 - smoothstep(b - FADE, b + FADE, t));
}

// Run fn() and gate every plane it adds by the segment's visibility.
function segment(S, i, fn) {
  const first = S.layers.length;
  fn();
  const vis = segAlpha(i);
  for (const L of S.layers.slice(first)) {
    const base = L.alpha;
    L.alpha = typeof base === 'function' ? (t, env) => base(t, env) * vis(t) : (t) => base * vis(t);
  }
}

// Stand-in horizon: a flat paper silhouette through points traced in reference px.
function horizon(S, line, colors) {
  const top = line.map(([x, y]) => [x * REF, y * REF]);
  const pts = [[-240, top[0][1]], ...top, [W + 240, top[top.length - 1][1]], [W + 240, H + 240], [-240, H + 240]];
  const y0 = Math.min(...top.map((p) => p[1]));
  S.plane(5000, {
    name: 'horizon', x: -240, y: y0 - 20, w: W + 480, h: H + 260 - y0, mat: 'paper', shadow: { blur: 12 },
    draw(ctx) { piece(ctx, pts, { fill: linear(ctx, 0, y0, 0, H, colors) }); },
  });
}

export default function () {
  return new Scene({
    id: 'sky',
    duration: 8,
    background: '#0a1c40',
    light: [0.55, -0.83],
    shadow: { alpha: 0.55, dist: 7, blur: 6 },
    // No vignette: the sheet is compared colour for colour with the references.
    post: { bloom: 0.35, threshold: 0.62, vignette: 0, grain: 0.04 },
    build(S) {
      segment(S, 0, () => {
        addSky(S, { palette: 'night', seed: 'night', glows: [{ x: 1562, y: 166, r: 420, color: '#2c4a82', alpha: 0.3 }] });
        addStarField(S, { stars: REF02_STARS, dots: REF02_DOTS, seed: 'ref02' });
        addMoon(S, { x: 1562, y: 166, r: 118 });
      });
      segment(S, 1, () => {
        addSky(S, { palette: 'dusk', seed: 'dusk', glows: [{ x: 1626, y: 380, r: 650, color: '#ffc46e', alpha: 0.35 }] });
        addStarField(S, { stars: [{ x: 999, y: 68, r: 7.5, tall: 1.05 }], dots: [], seed: 'ref01', glow: 0.3 });
        addSun(S, { x: 1626, y: 363, r: 84, kind: 'sunset' });
        addGuidingStar(S, { x: 1250, y: 85, size: 45, ...GUIDE_PRESETS.dusk });
        horizon(S, [[0, 260], [300, 215], [545, 160], [650, 230], [740, 210], [860, 260], [1017, 215], [1160, 285], [1280, 305], [1380, 340], [1462, 302], [1500, 313], [1580, 262], [1672, 300]], ['#c6a6d6', '#7d74b8']);
      });
      segment(S, 2, () => {
        addSky(S, { palette: 'dawn', seed: 'dawn', glows: [{ x: 1507, y: 356, r: 750, color: '#ffd27a', alpha: 0.35 }] });
        addSun(S, { x: 1507, y: 356, r: 80, kind: 'sunrise' });
        horizon(S, [[0, 300], [560, 255], [700, 280], [830, 265], [985, 240], [1100, 290], [1192, 285], [1250, 318], [1330, 330], [1400, 300], [1452, 282], [1530, 272], [1600, 300], [1672, 290]], ['#d8b0c8', '#9a8cc0']);
      });
      segment(S, 3, () => {
        addSky(S, { palette: 'twilight', seed: 'twilight' });
        addStarField(S, {
          seed: 'ref04', dots: 30, region: [600, 0, 1300, 330],
          stars: [
            { x: 1079, y: 146, r: 23 }, { x: 1231, y: 172, r: 14 }, { x: 1188, y: 86, r: 14 }, { x: 767, y: 46, r: 13 },
            { x: 889, y: 103, r: 10 }, { x: 970, y: 69, r: 9.5 }, { x: 843, y: 193, r: 8.5 }, { x: 1291, y: 224, r: 7 },
          ],
        });
        addMoon(S, { x: 621, y: 94, r: 88, seed: 'moon04' });
        addGuidingStar(S, { x: 1486, y: 276, size: 39, ...GUIDE_PRESETS.canyon, beam: { length: 150 } });
        horizon(S, [[560, 290], [900, 250], [1000, 262], [1110, 250], [1180, 272], [1300, 335], [1420, 295], [1480, 322], [1672, 330]], ['#9c86d0', '#4d4c92']);
      });
      segment(S, 4, () => {
        addSky(S, { palette: 'aurora', seed: 'aurora' });
        addStarField(S, {
          seed: 'ref08', dots: 36, region: [250, 0, 1670, 330],
          stars: [
            { x: 500, y: 135, r: 22 }, { x: 1827, y: 28, r: 17 }, { x: 372, y: 40, r: 15 }, { x: 1150, y: 225, r: 15 },
            { x: 812, y: 32, r: 13 }, { x: 632, y: 215, r: 8 }, { x: 716, y: 272, r: 6 }, { x: 975, y: 60, r: 5 },
          ],
        });
        addAurora(S);
        addGuidingStar(S, { x: 1517, y: 116, size: 60, arms: [1.12, 1, 0.98, 1], ...GUIDE_PRESETS.aurora });
        horizon(S, [[0, 261], [523, 279], [958, 287], [1089, 261], [1202, 218], [1280, 170], [1321, 152], [1367, 174], [1437, 226], [1533, 261], [1672, 270]], ['#d6d0f0', '#6a68b0']);
      });
      segment(S, 5, () => {
        addSky(S, { palette: 'storm', seed: 'storm' });
        addGuidingStar(S, { x: 1500, y: 144, size: 55, ...GUIDE_PRESETS.storm });
        horizon(S, [[0, 300], [900, 300], [1000, 330], [1080, 290], [1230, 340], [1340, 320], [1460, 335], [1672, 330]], ['#5a5f8c', '#2e3352']);
      });
    },
  });
}
