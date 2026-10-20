// s05 snow peaks: the mountain ranges, from the hazy far peaks to the dark ridges
// above the valley. Every range is one baked plane; first entries draw furthest back.

import { addRange, MOUNTAIN_PALETTES } from '../elements/terrain.js';

// Far peaks catch a rosier light than the blue night palette.
const ROSY = {
  ...MOUNTAIN_PALETTES.night,
  snow: ['#8e8cd0', '#a8a4e0', '#c4bcec', '#ddd6f4', '#f2eefa'],
};

// The great peak: blue-violet rock almost buried under bright snow; the lit faces
// are near white, the shaded ones a pale lavender.
const PEAK = {
  ...MOUNTAIN_PALETTES.night,
  rock: ['#26387e', '#34479a', '#4c5aae', '#6e78c2', '#949edc'],
  snow: ['#928ed2', '#ada6e4', '#d4cef4', '#f0eefb', '#fffdf8'],
  rim: '#ffffff',
};

// The layered blue ridges in front of the peak: deep blue rock, snow on the tips.
const BLUE_RIDGE = {
  ...MOUNTAIN_PALETTES.night,
  rock: ['#16285e', '#20357a', '#2e4392', '#4456a8', '#6272c0'],
  snow: ['#8288c8', '#a09cdc', '#c2bcec', '#e0dcf6', '#f6f2f4'],
  haze: '#4a5aa0',
};

// The ridges straight above the lake: dark blue-violet with lavender lit faces.
const DEEP_RIDGE = {
  ...MOUNTAIN_PALETTES.night,
  rock: ['#0e1c48', '#162862', '#20367a', '#304692', '#465aaa'],
  snow: ['#6a74b6', '#8688c8', '#a4a2da', '#c4c0ea', '#e2def4'],
  haze: '#34447e',
};

// The left flank of the main peak faces away from the star.
const FROM_RIGHT = [0.5, -0.866];
const FROM_LEFT = [-0.5, -0.866];

export function addMountains(S) {
  const tag = (L) => { L.tags = ['mountains']; return L; };

  // Furthest row: lavender peaks under haze, behind the clouds.
  tag(addRange(S, {
    name: 'range-far', z: 9600, palette: ROSY, haze: 0.4, hazeColor: '#a8a8d8', light: FROM_LEFT,
    snow: 0.6, snowline: 1, detail: 0.6, contrast: 0.75,
    peaks: [
      { x: 1700, y: 372, left: 280, right: 260, baseY: 560, seed: 506 },
      { x: 1930, y: 330, left: 240, right: 320, baseY: 560, seed: 507 },
      { x: 440, y: 198, left: 300, right: 330, baseY: 560, profile: 1.2, seed: 501 },
      { x: 860, y: 372, left: 330, right: 300, baseY: 580, profile: 0.9, seed: 502 },
      { x: 1196, y: 300, left: 240, right: 300, baseY: 580, profile: 1.0, seed: 504 },
      { x: 1036, y: 306, left: 260, right: 250, baseY: 580, profile: 1.0, seed: 503 },
      { x: 130, y: 300, left: 320, right: 260, baseY: 560, seed: 505 },
    ],
  }));

  // The main peak under the guiding star: broad, straight-flanked and snow-bound,
  // its lit right face a big white plane.
  tag(addRange(S, {
    name: 'range-peak', z: 6500, palette: PEAK, light: FROM_RIGHT, snow: 0.88, snowLow: 0.74, snowline: 0.95, ridge: 0.9, detail: 1,
    contrast: 1.42, drips: 1.25, foot: 0.6,
    peaks: [{ x: 1400, y: 214, left: 640, right: 780, baseY: 720, profile: 1.0, profileR: 1.12, shoulder: 1.1, jag: 0.8, seed: 511 }],
  }));

  // Layered blue ridges in front of the peak's base, snow on their tips.
  tag(addRange(S, {
    name: 'range-mid', z: 4800, palette: BLUE_RIDGE, light: FROM_RIGHT, snow: 0.1, snowline: 0.3, ridge: 0.25, snowLow: 0.05, contrast: 1.15, detail: 0.9,
    peaks: [
      { x: 1130, y: 432, left: 250, right: 220, baseY: 700, seed: 526 },
      { x: 905, y: 452, left: 260, right: 240, baseY: 700, profile: 1.1, seed: 521 },
      { x: 1837, y: 456, left: 320, right: 330, baseY: 720, profile: 1.1, seed: 524 },
      { x: 1275, y: 454, left: 220, right: 290, baseY: 720, profile: 1.1, seed: 523 },
    ],
  }));

  // A nearer row of deep blue ridges, snow only on their crests, so the valley
  // reads as layer after layer of blue.
  tag(addRange(S, {
    name: 'range-front', z: 4200, palette: { ...BLUE_RIDGE, rock: ['#121f52', '#1a2c6c', '#263c86', '#3a4e9e', '#5466b6'] }, light: FROM_RIGHT,
    snow: 0.07, snowline: 0.25, ridge: 0.2, snowLow: 0.04, contrast: 1.25, detail: 0.9,
    peaks: [
      { x: 1110, y: 498, left: 230, right: 200, baseY: 720, profile: 1.05, seed: 541 },
      { x: 1270, y: 520, left: 180, right: 230, baseY: 730, profile: 1.05, seed: 544 },
      { x: 930, y: 512, left: 220, right: 200, baseY: 720, profile: 1.05, seed: 545 },
      { x: 1560, y: 452, left: 230, right: 270, baseY: 730, profile: 1.05, seed: 546 },
    ],
  }));

  // Bare navy-teal ridges just above the valley.
  tag(addRange(S, {
    name: 'range-ridges', z: 3600, palette: DEEP_RIDGE, light: FROM_RIGHT, snow: 0.06, snowLow: 0.1, snowline: 0.3, ridge: 0.05, drips: 0.5, contrast: 1.2, detail: 0.8,
    peaks: [
      { x: 1720, y: 500, left: 300, right: 400, baseY: 760, profile: 1.05, seed: 531 },
      { x: 1080, y: 528, left: 280, right: 250, baseY: 760, profile: 1.05, seed: 533 },
      { x: 1430, y: 494, left: 320, right: 290, baseY: 780, profile: 1.05, seed: 532 },
    ],
  }));
}
