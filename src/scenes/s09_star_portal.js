// s09 Star portal (ref09), the climax: a circle of tall cracked standing stones under a
// navy sky with a full crumpled moon, a glowing gold ring between the central stones
// with a radiant star in it, light pouring from a stone basin, steps down to a
// reflecting pool, waterfalls left and right, and the fox on a rock at the left
// looking up at the portal.
//
// Events: the portal breathes the whole time; a small bright star falls from the sky
// into the ring between t = 1.6 and 2.75; at 2.75 the ring flares and settles over about
// a second to a stronger glow (portalTimeline in s09-portal.js); sparkles rise from the
// basin, the falls flow, the reflection shimmers, flowers and trees sway.
// Camera: a slow eased push-in toward the portal (dolly -60 -> 0 at t = 4.25 -> +60).

import { Scene } from '../core/stage.js';
import { smoothstep } from '../core/ease.js';
import { addSky, addStarField, addMoon, drawGlow, MOON_PAPER } from '../elements/sky.js';
import { createFox } from '../elements/fox.js';
import { addPortal } from './s09-portal.js';
import { addSkyClouds, addFarLand, addFramingTrees, addCliffsAndFalls, addPool } from './s09-land.js';
import { addStones, addMidFlowers, addForeground } from './s09-near.js';

const DURATION = 8.5;
const REST_T = 4.25;

// Anchors at camera rest (film px, from ref09 x 1.1483).
const PORTAL = { x: 1114, y: 400, R: 118, w: 24 };
const MOON = { x: 1521, y: 130, r: 115 };
const FOX = { x: 585, y: 752, scale: 0.95 };
const HORIZON = 445;

const SKY_STARS = [
  { x: 719, y: 52, r: 15 }, { x: 821, y: 106, r: 16 }, { x: 1037, y: 73, r: 10 }, { x: 1202, y: 60, r: 18 },
  { x: 1323, y: 130, r: 8 }, { x: 1116, y: 218, r: 13 }, { x: 1214, y: 195, r: 8 }, { x: 1740, y: 42, r: 11 },
  { x: 792, y: 195, r: 6 }, { x: 1089, y: 118, r: 5 }, { x: 960, y: 28, r: 5 }, { x: 1388, y: 38, r: 6 },
  { x: 646, y: 128, r: 5 }, { x: 1302, y: 262, r: 5 }, { x: 905, y: 160, r: 4 },
];

function camera(t) {
  const u = Math.max(-1, Math.min(1, (t - REST_T) / REST_T));
  const k = Math.sin((Math.PI / 2) * u);
  return { x: 14 * k, y: -9 * k, z: 60 * k, zoom: 1, roll: 0 };
}

export default function () {
  return new Scene({
    id: 's09',
    duration: DURATION,
    background: '#141a40',
    light: [0.55, -0.83],
    shadow: { alpha: 0.5, dist: 9, blur: 10 },
    post: { bloom: 0.42, threshold: 0.68, vignette: 0.24, grain: 0.05 },
    meta: { fox: { x: FOX.x, y: FOX.y }, light: { x: PORTAL.x, y: PORTAL.y }, horizon: HORIZON },
    camera,
    build(S) {
      addSky(S, {
        palette: 'night', seed: 's09-sky',
        stops: [[-240, '#121840'], [0, '#151b45'], [220, '#19204d'], [420, '#1e2756'], [700, '#232c5c'], [1320, '#262f60']],
        glows: [{ x: MOON.x, y: MOON.y, r: 420, color: '#4c4a78', alpha: 0.45 }, { x: PORTAL.x, y: PORTAL.y, r: 360, color: '#3c3a6a', alpha: 0.4 }],
      }).tags = ['sky'];
      for (const L of addStarField(S, { stars: SKY_STARS, dots: 170, region: [-100, -60, 2020, 420], seed: 's09-stars', glow: 0.35 })) L.tags = ['celestial'];
      for (const L of addMoon(S, { x: MOON.x, y: MOON.y, r: MOON.r, seed: 's09-moon', paper: { ...MOON_PAPER, base: '#f0d48c', lit: '#fbe8b4', deep: '#c49a4c' } })) L.tags = ['celestial'];
      addSkyClouds(S, { moon: MOON });
      addFarLand(S);
      addCliffsAndFalls(S);
      addFramingTrees(S);
      addPool(S, { portal: PORTAL });
      addStones(S, { portal: PORTAL });
      addPortal(S, {
        ring: PORTAL, star: { size: 76 }, basin: { x: PORTAL.x, y: 552 },
        fall: { from: [1236, 24], t0: 1.6, t1: 2.75 },
        z: { ring: 1215, glow: 1204, basin: 1192 },
      });
      // Warm portal light grading the stones, terrace and steps: a colour-dodge gain, so
      // the lit faces turn gold while cracks and shadows keep their depth.
      const warm = S.add({
        name: 's09-warm', z: 1203, blend: 'color-dodge',
        render(ctx) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(PORTAL.x - 700, 150, 1400, 820);
          ctx.arc(PORTAL.x, PORTAL.y, PORTAL.R + 12, 0, Math.PI * 2);
          ctx.clip('evenodd');
          ctx.translate(PORTAL.x, 520);
          ctx.scale(1, 0.62);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 640);
          g.addColorStop(0, 'rgba(104,70,28,0.62)'); g.addColorStop(0.35, 'rgba(96,62,22,0.46)'); g.addColorStop(0.7, 'rgba(84,54,20,0.22)'); g.addColorStop(1, 'rgba(84,54,20,0)');
          ctx.fillStyle = g;
          ctx.fillRect(-640, -640, 1280, 1280);
          ctx.restore();
        },
      });
      const stepsGlow = S.add({
        name: 's09-steps-glow', z: 1203, order: 1, blend: 'lighter',
        render(ctx) {
          drawGlow(ctx, PORTAL.x - 20, 680, 250, '#ffb24c', 0.14, { falloff: 'soft', sy: 0.42 });
          drawGlow(ctx, PORTAL.x, 612, 300, '#ffbc58', 0.08, { falloff: 'soft', sy: 0.2 });
        },
      });
      warm.tags = ['portal']; stepsGlow.tags = ['portal'];
      addMidFlowers(S);
      addForeground(S);
      createFox(S, {
        pose: 'stand', z: 950, x: FOX.x, y: FOX.y, scale: FOX.scale, look: 0.22, seed: 'fox-s09',
        rim: { amount: 0.55, color: '#ffd68a', width: 3, glow: 0.4, dir: [1, -0.35] },
        motion: (t) => ({ look: 0.18 + 0.1 * smoothstep(2.6, 3.6, t) }),
      });
    },
  });
}
