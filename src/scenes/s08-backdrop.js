// The world beyond the arch in s08 (ref08), far to near: the lavender cloud wall behind
// the left trees, a hazy far range, the hero peak under the guiding star (its summit
// gilded by the star), the mid range, the bare front ridges with the waterfalls, puffy
// banks of the cloud sea in every valley, forested ridges, the lake with the star's
// reflection and its islands, and under the arch more cloud and a dark spruce forest.

import { addRange, drawRange, rangeBox } from '../elements/terrain.js';
import { addCloud, CLOUD_PALETTES } from '../elements/clouds.js';
import { MOUNTAIN_PALETTES } from '../elements/terrain-mountains.js';
import { addForestBand, FOLIAGE } from '../elements/trees.js';
import { addLake, addWaterfall, WATER } from '../elements/water.js';
import { addGlow } from '../elements/sky.js';
import { osc } from '../core/ease.js';

const tag = (layers, t) => { for (const L of [layers].flat()) L.tags = [...(L.tags ?? []), t]; return layers; };
const T0 = 4.25;
// The sea palette with deeper lavender shade inside every puff (ref08's rounder banks).
const SEA = { ...CLOUD_PALETTES.sea, tiers: [0.34, 0.46, 0.54, 0.6], spread: 0.5, lit: 0.38 };
// ref08's ranges: deep blue rock with brighter cobalt lit faces and crisp white snow caps.
const DEEP = {
  ...MOUNTAIN_PALETTES.night,
  rock: ['#0e1a48', '#172a6a', '#22398a', '#3149a4', '#4e64bc'],
  snow: ['#6e7cc4', '#a2ace2', '#d4daf6', '#f2f4fc', '#ffffff'],
  haze: '#2a3a7c', shadow: 'rgba(4,8,34,0.6)',
};
// Snow caps only: a white crown and short streaks down the spurs, the rest bare blue rock.
const CAPS = { snow: 0.34, snowLow: 0.2, snowline: 0.5, ridge: 0.28, drips: 1.2 };
// Night rock with whiter, warmer snow for the star-lit hero peak; deeper blue shade facets.
const STARLIT = { ...DEEP, snow: ['#4e5aae', '#7c84d0', '#c6c8f0', '#f0eef8', '#fffaf0'] };
// The same peak bathed in starlight: cream-gold snow and warm, lifted rock.
const GILT = { ...MOUNTAIN_PALETTES.night, rock: ['#3a3a7e', '#5a5298', '#8a76aa', '#bc9eb0', '#e6c6b8'], snow: ['#8478aa', '#c0a2ac', '#eccdae', '#ffe6c2', '#fffaee'] };

export function addBackdrop(S, { star, light, lap = () => {} }) {
  // One puffy flat-based bank of the cloud sea.
  // Three tiers of smallish lobed puffs: billowy crowns instead of a few big domes.
  const bank = (o) => tag(addCloud(S, { palette: SEA, flatBase: true, tiers: 3, light, t0: T0, drift: 3, sway: 2, size: 0.44, minR: 14, maxR: 46, spacing: 1.05, roughness: 0.14, frontHeight: 0.6, ...o }), 'cloudsea');

  // Lavender cloud wall behind the left trees, falling to a low bank behind the fox.
  addCloud(S, {
    name: 'wall', z: 9000, t0: T0, x: 120, y: 10, w: 760, h: 345, tiers: 3, seed: 's08-wall', palette: 'sea',
    profile: [[0, 0.95], [0.15, 1], [0.32, 0.86], [0.48, 0.52], [0.62, 0.36], [0.8, 0.26], [1, 0.18]],
    size: 0.3, minR: 14, light, drift: 2, sway: 3,
  });
  lap('wall');

  // Far range across the whole width: blue, a touch lighter with distance, white caps.
  addRange(S, {
    name: 'range-far', z: 8000, palette: DEEP, haze: 0.2, hazeColor: '#3e52a0', light, ...CAPS, snow: 0.38, jag: 1.6, detail: 0.9, contrast: 1.8,
    peaks: [
      { x: 60, y: 330, left: 300, right: 260, baseY: 500, seed: 2 },
      { x: 420, y: 320, left: 240, right: 240, baseY: 500, seed: 3 },
      { x: 1040, y: 300, left: 230, right: 210, baseY: 500, seed: 7 },
      { x: 1250, y: 330, left: 200, right: 200, baseY: 500, seed: 9 },
      { x: 1850, y: 262, left: 230, right: 320, baseY: 490, seed: 13 },
    ],
  });
  lap('far');

  // The hero peak: the biggest, brightest mountain, alone on the back sheet so its broad
  // snow faces stay clear; the star's light spills down them from the summit.
  const hero = { x: 1517, y: 166, left: 540, right: 540, baseY: 560, profile: 1.05, spurs: 12, crease: 0.9, seed: 11, snow: 0.74, snowLow: 0.38, ridge: 1.1, jag: 2.2, contrast: 2.8 };
  // Lit from the star above the summit, so the left faces catch it as in the reference.
  const common = { palette: STARLIT, light: [-0.5, -0.87], snow: 0.62, ridge: 1, snowline: 1, jag: 1.6, detail: 1, haze: 0.08, hazeColor: '#3c4592', contrast: 1.9 };
  const box = rangeBox([hero], common);
  S.plane(6600, {
    name: 'peak', ...box, mat: 'paper', edge: { width: 1.6, hi: 0.4, lo: 0.25, soft: 0.6 }, shadow: { blur: 14 },
    draw(ctx) {
      drawRange(ctx, { peaks: [hero], ...common });
      // Away from the summit the snow falls into blue shade, so only the crown glows.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const bs = ctx.createRadialGradient(star.x, star.y + 70, 50, star.x, star.y + 160, 430);
      bs.addColorStop(0, 'rgba(30,40,130,0)');
      bs.addColorStop(0.4, 'rgba(30,40,130,0.32)');
      bs.addColorStop(1, 'rgba(20,28,104,0.58)');
      ctx.fillStyle = bs;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      // The spill: the same peak cut from gilt paper, faded out from the summit downward.
      const W = ctx.canvas.width, H = ctx.canvas.height;
      const off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
      const o = off.getContext('2d');
      o.setTransform(ctx.getTransform());
      drawRange(o, { peaks: [hero], ...common, palette: GILT, cast: null, edge: 0 });
      o.globalCompositeOperation = 'destination-in';
      o.translate(star.x - 12, star.y + 64);
      o.scale(1.1, 1.05);
      const m = o.createRadialGradient(0, 0, 10, 0, 0, 210);
      m.addColorStop(0, 'rgba(0,0,0,0.92)');
      m.addColorStop(0.3, 'rgba(0,0,0,0.78)');
      m.addColorStop(0.65, 'rgba(0,0,0,0.4)');
      m.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = m;
      o.fillRect(-1e4, -1e4, 2e4, 2e4);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(off, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const g = ctx.createRadialGradient(star.x - 20, star.y + 80, 10, star.x - 30, star.y + 110, 380);
      g.addColorStop(0, 'rgba(255,214,128,0.42)');
      g.addColorStop(0.3, 'rgba(255,210,140,0.22)');
      g.addColorStop(0.6, 'rgba(255,205,170,0.06)');
      g.addColorStop(1, 'rgba(255,200,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.restore();
    },
  }, { tags: ['peak'] });
  // Shoulders and jagged sub-peaks crowding the hero's flanks: darker night rock with
  // less snow, only their tops near the summit catching the spill.
  const flank = [
    { x: 1262, y: 312, left: 230, right: 160, baseY: 500, seed: 15 },
    { x: 1800, y: 296, left: 180, right: 240, baseY: 500, seed: 17 },
    { x: 1374, y: 282, left: 112, right: 92, baseY: 452, seed: 51, jag: 2 },
    { x: 1690, y: 274, left: 100, right: 120, baseY: 452, seed: 53, jag: 2 },
  ];
  const flankOpts = { palette: DEEP, light: [0.5, -0.87], ...CAPS, snow: 0.42, snowline: 0.6, ridge: 0.36, jag: 1.7, detail: 1, haze: 0.06, hazeColor: '#2c3478', contrast: 1.9 };
  const fbox = rangeBox(flank, flankOpts);
  S.plane(6500, {
    name: 'peak-flanks', ...fbox, mat: 'paper', edge: { width: 1.6, hi: 0.35, lo: 0.25, soft: 0.6 }, shadow: { blur: 14 },
    draw(ctx) {
      drawRange(ctx, { peaks: flank, ...flankOpts });
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const g = ctx.createRadialGradient(star.x, star.y + 150, 10, star.x, star.y + 170, 300);
      g.addColorStop(0, 'rgba(255,222,170,0.34)');
      g.addColorStop(0.5, 'rgba(255,212,170,0.1)');
      g.addColorStop(1, 'rgba(255,200,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fbox.x, fbox.y, fbox.w, fbox.h);
      ctx.restore();
    },
  }, { tags: ['peak'] });
  addGlow(S, {
    z: 6490, order: 2, name: 'peak-light',
    items: (t) => [
      { x: star.x - 20, y: star.y + 160, r: 380, color: '#ffd9a0', alpha: 0.11 + 0.03 * osc(t, 3.8, 0.1) },
      { x: star.x - 10, y: star.y + 96, r: 190, color: '#ffe6b0', alpha: 0.18 + 0.06 * osc(t, 3.8, 0.1) },
      { x: star.x - 4, y: star.y + 62, r: 90, color: '#fff6dc', alpha: 0.3 + 0.06 * osc(t, 3.8, 0.1) },
    ],
  });
  lap('peak');

  // Mid range: deep blue peaks with white caps, darker toward their feet.
  addRange(S, {
    name: 'range-mid', z: 5200, palette: DEEP, light, ...CAPS, snow: 0.3, jag: 1.8, shoulder: 2.2, detail: 0.8, haze: 0.14, hazeColor: '#16205a', contrast: 1.8, foot: 0.7,
    peaks: [
      { x: 560, y: 318, left: 230, right: 200, baseY: 530, seed: 21 },
      { x: 862, y: 352, left: 210, right: 230, baseY: 540, seed: 23 },
      { x: 1268, y: 318, left: 240, right: 210, baseY: 560, seed: 25 },
      { x: 2010, y: 330, left: 200, right: 250, baseY: 560, seed: 29 },
      { x: 1700, y: 352, left: 230, right: 260, baseY: 570, seed: 27 },
    ],
  });
  // Separate puffy banks with gaps between them, where the ridges behind show through.
  const puff = { tiers: 2, size: 0.62, minR: 22, maxR: 56, spacing: 0.95, frontHeight: 0.72, roughness: 0.2 };
  bank({ name: 'bank-fox', z: 4700, x: 520, y: 426, w: 260, h: 84, seed: 's08-b1', ...puff, maxR: 36, profile: [[0, 0], [0.12, 0.6], [0.35, 1], [0.6, 0.75], [0.85, 0.5], [1, 0]] });
  bank({ name: 'bank-fox-r', z: 4700, x: 880, y: 452, w: 200, h: 66, seed: 's08-b1r', ...puff, maxR: 32, profile: [[0, 0], [0.2, 0.75], [0.5, 1], [0.8, 0.6], [1, 0]] });
  lap('mid');

  // Bare navy-teal front ridges; the falls pour from the right one.
  addRange(S, {
    name: 'ridges', z: 4000, palette: 'ridge', light, snow: 0.12, detail: 0.7,
    peaks: [
      { x: 300, y: 440, left: 300, right: 260, baseY: 620, seed: 30 },
      { x: 720, y: 420, left: 300, right: 280, baseY: 620, seed: 31 },
      { x: 1130, y: 412, left: 260, right: 230, baseY: 620, seed: 33 },
      { x: 1980, y: 400, left: 220, right: 300, baseY: 620, seed: 37 },
      { x: 1592, y: 382, left: 180, right: 230, baseY: 620, seed: 35 },
    ],
  });
  addWaterfall(S, { z: 3900, palette: WATER.night, x: 1522, top: 462, bottom: 556, width: [26, 40], speed: 70, foam: { w: 70, h: 18, size: 0.5, count: 8 }, mist: { strength: 0.25 } });
  addWaterfall(S, { z: 3900, palette: WATER.night, x: 1604, top: 396, bottom: 520, width: [14, 22], speed: 70, foam: { w: 40, h: 14, size: 0.4, count: 6 }, mist: false });
  bank({ name: 'bank-right', z: 3700, x: 1650, y: 430, w: 300, h: 100, seed: 's08-b3', ...puff, profile: [[0, 0], [0.12, 0.6], [0.35, 1], [0.6, 0.8], [0.85, 0.65], [1, 0]] });
  bank({ name: 'bank-right-b', z: 3700, x: 1990, y: 404, w: 250, h: 116, seed: 's08-b3b', ...puff, profile: [[0, 0], [0.15, 0.7], [0.4, 1], [0.7, 0.85], [1, 0.8]] });
  bank({ name: 'bank-mid-back', z: 3650, x: 1150, y: 446, w: 170, h: 56, seed: 's08-b9', ...puff, maxR: 30, profile: [[0, 0], [0.25, 0.8], [0.5, 1], [0.8, 0.6], [1, 0]] });
  bank({ name: 'bank-mid', z: 3500, x: 966, y: 470, w: 300, h: 92, seed: 's08-b2', ...puff, profile: [[0, 0], [0.1, 0.55], [0.3, 0.95], [0.5, 0.8], [0.7, 1], [0.9, 0.5], [1, 0]] });
  bank({ name: 'bank-mid-r', z: 3500, x: 1330, y: 500, w: 160, h: 62, seed: 's08-b2r', ...puff, maxR: 30, profile: [[0, 0], [0.2, 0.8], [0.5, 1], [0.8, 0.7], [1, 0]] });
  bank({ name: 'bank-lake', z: 3400, x: 1530, y: 508, w: 240, h: 60, seed: 's08-b4', profile: [[0, 0], [0.15, 0.7], [0.5, 1], [0.85, 0.6], [1, 0]] });
  lap('ridges');

  // Forested ridges on either side of the lake.
  const band = { rows: 3, density: 1.4, colors: [FOLIAGE.forest, FOLIAGE.blue], weights: [3, 1], haze: '#3c5a88', hazeAmt: [0.45, 0.12], midMin: 999, gaps: 0.75, skirt: 40 };
  addForestBand(S, { ...band, z: 3000, name: 'ridge-forest-l', x0: 880, x1: 1500, heights: [24, 58], seed: 41,
    base: [[880, 630], [1000, 612], [1100, 600], [1200, 596], [1300, 600], [1400, 612], [1460, 630], [1500, 660]] });
  addForestBand(S, { ...band, z: 3000, name: 'ridge-forest-r', x0: 1530, x1: 2240, heights: [26, 62], seed: 42,
    base: [[1530, 670], [1580, 640], [1640, 620], [1740, 612], [1820, 616], [2240, 624]] });
  lap('forest-ridges');

  // The lake: it runs from under the arch to the right cliff.
  addLake(S, {
    z: 2600, x0: 780, x1: 1820, top: 594, bottom: 880, palette: WATER.nightLake, seed: 's08-lake',
    shape: [[780, 660], [900, 640], [1050, 622], [1200, 610], [1300, 604], [1420, 600], [1560, 602], [1700, 612], [1820, 626], [1820, 880], [780, 880]],
    shore: { height: 14, ranges: [[1150, 1460], [1560, 1780]] },
    light: { x: star.x - 5, width: 72, widthBottom: 44, top: 606, bottom: 790, count: 40 },
  });
  lap('lake');
  addForestBand(S, {
    z: 2400, name: 'island-big', x0: 1330, x1: 1660, rows: 2, density: 1.5, heights: [22, 56], colors: FOLIAGE.forest,
    haze: '#3c5a88', hazeAmt: [0.3, 0.08], seed: 43, midMin: 999, gaps: 0.65, skirt: 16,
    base: [[1330, 740], [1360, 712], [1440, 702], [1520, 700], [1600, 706], [1640, 720], [1660, 744]],
  });
  addForestBand(S, {
    z: 2400, name: 'island-small', x0: 1180, x1: 1320, rows: 1, density: 1.3, heights: [14, 34], colors: FOLIAGE.forest,
    haze: '#3c5a88', hazeAmt: [0.4, 0.2], seed: 44, midMin: 999, gaps: 0.5, skirt: 8,
    base: [[1180, 668], [1210, 650], [1270, 648], [1310, 660], [1320, 676]],
  });
  lap('islands');

  // Seen through the arch: a cloud bank, dark spruces, then the big near banks.
  bank({ name: 'bank-shore', z: 2450, x: 800, y: 630, w: 470, h: 124, seed: 's08-b8', maxR: 40, profile: [[0, 0.85], [0.15, 1], [0.35, 0.8], [0.55, 0.9], [0.75, 0.6], [0.9, 0.35], [1, 0.1]] });
  bank({ name: 'bank-under', z: 2100, x: 780, y: 684, w: 660, h: 210, size: 0.42, minR: 18, maxR: 52, seed: 's08-b5', profile: [[0, 0.75], [0.15, 0.9], [0.35, 1], [0.55, 0.85], [0.75, 0.95], [1, 0.7]] });
  addForestBand(S, {
    z: 1800, name: 'forest-under', x0: 700, x1: 1720, base: 1000, heights: [160, 300], rows: 2, density: 1.3,
    colors: FOLIAGE.forest, haze: '#3a5a88', hazeAmt: [0.4, 0.06], seed: 45, midMin: 175, skirt: 60, gaps: 0.85,
  });
  lap('forest-under');
  bank({ name: 'bank-near', z: 1350, x: 820, y: 900, w: 720, h: 300, size: 0.46, minR: 22, maxR: 74, seed: 's08-b6', profile: [[0, 0.5], [0.15, 0.85], [0.3, 0.7], [0.5, 1], [0.7, 0.8], [0.85, 0.95], [1, 0.6]] });
  bank({ name: 'bank-near-r', z: 1250, x: 1360, y: 880, w: 360, h: 300, size: 0.46, minR: 22, maxR: 70, seed: 's08-b7', profile: [[0, 0.7], [0.3, 1], [0.6, 0.8], [1, 0.9]] });
  lap('banks-near');
}
