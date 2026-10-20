// s01 sky: the dusk backdrop, the setting sun, the sunset clouds and the guiding star,
// which blinks into being partway through the shot and lays its trail of small stars
// one by one.

import { RNG } from '../core/rng.js';
import { E, clamp, smoothstep, osc, invLerp } from '../core/ease.js';
import { drawSprites } from '../core/sprite.js';
import { piece } from '../core/piece.js';
import { rgba } from '../core/color.js';
import { addSky, addSun, addGuidingStar, drawPaperStar, drawGlow, GUIDE_PRESETS, GUIDE_GOLD } from '../elements/sky.js';
import { addCloud, CLOUD_PALETTES } from '../elements/clouds.js';

export const SUN = { x: 1626, y: 363, r: 84 };
export const STAR = { x: 1250, y: 85, size: 44 };

// Star event timing (scene-local seconds).
export const STAR_ON = 2.75;
const POP = 0.45;                 // scale-up with overshoot
const BLOOM = 1.4;                // glow flare decay
const TRAIL_FROM = 2.9, TRAIL_TO = 3.6;

// Trail of small paper stars descending to the left, nearest first (film px, radius).
const TRAIL = [[1218, 105, 3.2], [1200, 112, 5.5], [1165, 127, 8.5], [1125, 143, 8.5], [1098, 152, 8], [1065, 168, 6.5]];
const LONE_STAR = [1000, 68, 7.5];
const TRAIL_GOLD = { lit: '#ffe08a', base: '#f8c45a', shade: '#d38e30' };

// Sky gradient sampled down the clear column at x 1250, warmed toward the sun by a glow.
const SKY_STOPS = [
  [-240, '#4864b4'], [0, '#4d68b6'], [60, '#5d6db8'], [120, '#8475b6'], [175, '#ad84b4'],
  [225, '#d68e9f'], [270, '#ef9f8a'], [320, '#f8b676'], [380, '#fbc474'], [1320, '#fcc97c'],
];

// Quick scale-up with a little overshoot that settles by u = 1.
const pop = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : E.out(u) * (1 + 0.5 * Math.sin(Math.PI * u) * (1 - u)));

const tagAll = (layers, ...tags) => {
  for (const L of [layers].flat()) L.tags.push(...tags);
  return layers;
};

export function buildSky(S, { sinkRate = 0.9, restT = 4.25 } = {}) {
  tagAll(addSky(S, {
    palette: 'dusk', seed: 's01-sky', stops: SKY_STOPS,
    glows: [
      { x: SUN.x, y: SUN.y, r: 860, color: '#ffbc70', alpha: 0.5 },
      { x: SUN.x - 180, y: 170, r: 560, color: '#f8a890', alpha: 0.36 },
    ],
  }), 'sky');
  tagAll(addSunWash(S), 'sky');

  // The sun sinks a few px over the shot; it sits on its reference spot at rest.
  tagAll(addSun(S, {
    ...SUN, kind: 'sunset', seed: 's01-sun', glow: 1.1,
    anim: (t) => ({ y: (t - restT) * sinkRate }),
  }), 'celestial', 'sun');

  buildStar(S);
  buildClouds(S, restT);
}

// ref01's right sky: a broad peach-gold glow around the low sun, rosy peach higher up
// between the wisps, only turning lavender near the top edge. A soft wash just in front
// of the backdrop, behind the sun and clouds.
function addSunWash(S) {
  const B = { x: 760, y: -200, w: 1500, h: 1000 };
  return S.plane(16000, {
    name: 'sun-wash', ...B, mat: 'none', edge: false, shadow: false,
    draw(ctx) {
      const wash = (cx, cy, rx, ry, stops) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        for (const [o, c, a] of stops) g.addColorStop(o, rgba(c, a));
        ctx.fillStyle = g;
        ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
        ctx.restore();
      };
      // Rosy peach band over the upper right, under the wisps.
      wash(1640, 170, 620, 230, [[0, '#f9ae8e', 0.62], [0.5, '#f6a491', 0.42], [1, '#f09c9c', 0]]);
      // The sun's glow: pale gold at the core warming to peach.
      wash(SUN.x, SUN.y - 30, 720, 380, [[0, '#ffe2a2', 0.95], [0.22, '#ffd58e', 0.85], [0.48, '#fdc07c', 0.6], [0.75, '#f8ab84', 0.26], [1, '#f4a08c', 0]]);
    },
  });
}

function buildStar(S) {
  const born = (t) => t >= STAR_ON;
  const u = (t) => (t - STAR_ON) / POP;
  const guide = addGuidingStar(S, {
    ...STAR, ...GUIDE_PRESETS.dusk, trail: false, seed: 's01-guide',
    alpha: (t) => (born(t) ? 1 : 0),
    motion: (t) => ({ s: born(t) ? Math.max(0.02, pop(u(t))) : 0.02 }),
  });
  tagAll(guide.layers, 'celestial');

  // Trail and lone star: own sprites so each can arrive on its own beat.
  const light = S.light;
  const mk = ([x, y, r], i) => {
    const p = r * 1.5 + 5;
    return {
      s: S.sprite({
        name: `trail-${i}`, x: x - p, y: y - p, w: p * 2, h: p * 2, res: 2.5, mat: 'smooth', light,
        edge: { width: 0.8, hi: 0.3, lo: 0.3, soft: 0.4 }, shadow: { blur: 1.8 },
        draw(ctx) { drawPaperStar(ctx, x, y, r, { gold: TRAIL_GOLD, light, tall: 1.12, pinch: 0.7, fold: 0.6 }); },
      }),
      x, y, r, period: 2.2 + (i % 3) * 0.7, phase: i * 0.17,
    };
  };
  const trail = TRAIL.map(mk);
  const lone = mk(LONE_STAR, 9);
  const arrive = (i) => TRAIL_FROM + (i / (TRAIL.length - 1)) * (TRAIL_TO - TRAIL_FROM);
  const trailScale = (t, i) => pop((t - arrive(i)) / 0.3);

  tagAll(S.add({
    name: 'star-trail', z: 12000, shadow: { alpha: 0.5 },
    render(ctx, t, env) {
      const items = [];
      const tw = (s, k) => 1 + 0.08 * osc(t, s.period, s.phase) * k;
      items.push({ s: lone.s, ax: lone.x, ay: lone.y, x: lone.x, y: lone.y, sx: tw(lone, 1), sy: tw(lone, 1) });
      trail.forEach((s, i) => {
        const k = trailScale(t, i);
        if (k <= 0.01) return;
        // The trail rides the star's slow bob so the comet reads as one object.
        const p = guide.at(t);
        const dy = p.y - STAR.y;
        items.push({ s: s.s, ax: s.x, ay: s.y, x: s.x, y: s.y + dy, sx: k * tw(s, 1), sy: k * tw(s, 1) });
      });
      drawSprites(ctx, items, { ...env.shadow, alpha: 0.5 });
    },
  }), 'celestial');

  // Light: a bloom when the star is born, a spark burst, and soft glows on the trail.
  const rng = new RNG('s01-burst');
  const sparks = Array.from({ length: 16 }, (_, i) => ({
    a: (i / 16) * Math.PI * 2 + rng.range(-0.2, 0.2), d: rng.range(70, 150), r: rng.range(1.5, 3.2), life: rng.range(0.6, 1.1),
  }));
  tagAll(S.add({
    name: 'star-burst', z: 12000, order: 2, blend: 'lighter',
    render(ctx, t) {
      const dt = t - STAR_ON;
      const p = guide.at(t);
      if (dt >= 0 && dt < BLOOM) {
        const f = Math.exp(-dt * 3.2) * smoothstep(0, 0.06, dt);
        drawGlow(ctx, p.x, p.y, 300 * (0.6 + 0.4 * f), GUIDE_GOLD.glow, 0.55 * f, { falloff: 'soft' });
        drawGlow(ctx, p.x, p.y, 90, GUIDE_GOLD.core, 0.9 * f, { falloff: 'tight' });
        // Thin cross flare along the arms.
        drawGlow(ctx, p.x, p.y, 220, GUIDE_GOLD.core, 0.5 * f, { falloff: 'tight', sx: 1, sy: 0.04 });
        drawGlow(ctx, p.x, p.y, 160, GUIDE_GOLD.core, 0.4 * f, { falloff: 'tight', sx: 0.04, sy: 1 });
        for (const s of sparks) {
          const k = clamp(dt / s.life);
          if (k >= 1) continue;
          const d = s.d * E.out(k);
          drawGlow(ctx, p.x + Math.cos(s.a) * d, p.y + Math.sin(s.a) * d, s.r * 4, GUIDE_GOLD.lit, (1 - k) ** 1.5, { falloff: 'tight' });
        }
      }
      trail.forEach((s, i) => {
        const k = clamp(trailScale(t, i));
        if (k <= 0) return;
        const flash = Math.exp(-Math.max(0, t - arrive(i)) * 4);
        const q = 0.55 + 0.45 * osc(t, s.period, s.phase);
        drawGlow(ctx, s.x, s.y + (p.y - STAR.y), s.r * (3.5 + 3 * flash), GUIDE_GOLD.glow, k * (0.22 * q + 0.6 * flash), { falloff: 'soft' });
      });
      drawGlow(ctx, lone.x, lone.y, lone.r * 3.5, GUIDE_GOLD.glow, 0.18 + 0.06 * osc(t, 2.9, 0.3), { falloff: 'soft' });
    },
  }), 'celestial');
}

// ref01's cumulus: one big cauliflower mass rising from behind the left conifers.
// Peach crowns where the low sun strikes, rose lower down, lavender in its shade.
const SUNSET_LIT = {
  ...CLOUD_PALETTES.sunset,
  ramp: ['#ffe2b2', '#ffcd96', '#fcb886', '#f6a383', '#ea928e', '#d68aa4', '#bc88b6', '#a084b8', '#867ab2'],
  lit: 0.3, spread: 0.26, vert: 0.12,
};
// The small puffy cloud on the right edge: peach-gold, a shade rosier underneath.
const WISP = {
  ...CLOUD_PALETTES.sunset,
  ramp: ['#ffe2a8', '#ffd090', '#fdbb80', '#f9a77a', '#f2957c', '#e4878a', '#cc82a0', '#ae80aa', '#9079aa'],
  lit: 0, spread: 0.14, vert: 0.05, texture: { facets: 0.6 },
};

// Right-side wisps (film px): long thin torn strips of peach-gold paper, rising toward
// the frame edge, each a rosier under strip with a paler gold strip laid along its top.
//   x, y: left tip; len; rise: how much the right end climbs; th: thickness at the head;
//   head: where along the strip it is thickest (0..1); bumps: scallops along the top.
const WISPS = [
  { x: 1612, y: 98, len: 420, rise: 66, th: 38, head: 0.72, bumps: 7, seed: 1 },
  { x: 1432, y: 134, len: 310, rise: 26, th: 34, head: 0.55, bumps: 5, seed: 2 },
  { x: 1286, y: 214, len: 250, rise: 6, th: 34, head: 0.45, bumps: 4, seed: 3 },
  { x: 1204, y: 268, len: 340, rise: 4, th: 11, head: 0.5, bumps: 0, seed: 4, tone: 0.5 },
  { x: 1566, y: 242, len: 300, rise: 10, th: 10, head: 0.35, bumps: 0, seed: 5, tone: 0.7 },
];
const WISP_BOX = { x: 1170, y: 0, w: 880, h: 300 };

function wispEdges(o, rng) {
  const n = 48, top = [], bot = [];
  const ph = rng.range(0, 6.28), ph2 = rng.range(0, 6.28);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = o.x + o.len * u;
    const y = o.y - o.rise * (0.5 - 0.5 * Math.cos(Math.PI * u)) + 3 * Math.sin(u * 7 + ph);
    // Thickness: a soft head, long tapering tails to sharp tips at both ends.
    const d = u < o.head ? u / o.head : (1 - u) / (1 - o.head);
    const T = o.th * Math.pow(Math.max(0, d), 0.8) * (0.85 + 0.15 * Math.sin(u * 11 + ph2));
    const sc = o.bumps ? 0.75 + 0.45 * Math.abs(Math.sin(u * o.bumps * Math.PI + ph)) : 1;
    top.push([x, y - T * 0.62 * sc]);
    bot.push([x + 4 * u, y + T * 0.38]);
  }
  return { top, bot };
}

function addWisps(S, t0) {
  const B = WISP_BOX;
  const sprite = S.sprite({
    name: 'wisps', x: B.x, y: B.y, w: B.w, h: B.h, res: 1, light: S.light,
    mat: [{ tex: 'fiber', amt: 0.55 }, { tex: 'crumple', amt: 0.35, scale: 0.7 }],
    edge: { width: 1, hi: 0.3, lo: 0.15, soft: 0.5 }, shadow: { blur: 3 },
    draw(ctx) {
      for (const o of WISPS) {
        const rng = new RNG(`s01-wisp:${o.seed}`);
        const { top, bot } = wispEdges(o, rng);
        const k = o.tone ?? 0;
        const y0 = o.y - o.rise - o.th, y1 = o.y + o.th * 0.5;
        // Under strip: rose along the bottom, warming to peach.
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, k > 0.6 ? '#f8a090' : '#ffb488');
        g.addColorStop(1, k > 0.4 ? '#ec8a96' : '#f88e80');
        piece(ctx, [...top, ...bot.reverse()], {
          fill: g, torn: { amp: 1.3, freq: 0.16, fine: 0.5, seed: rng.int(1, 1e6) }, rim: { color: '#ffe6c2', width: 0.9 },
          shadow: { color: 'rgba(120,56,96,0.22)', blur: 3, x: 0, y: 2 },
        });
        if (o.th < 16) continue;
        // Gold top strip over the upper half, catching the low sun.
        const mid = top.map((p, i) => [p[0] + 2, p[1] * 0.45 + bot[bot.length - 1 - i][1] * 0.55]);
        const lift = top.map(([x, y]) => [x + 2, y + 1.5]);
        const g2 = ctx.createLinearGradient(0, y0, 0, y1);
        g2.addColorStop(0, '#ffe2a4');
        g2.addColorStop(1, '#ffc48e');
        piece(ctx, [...lift.slice(4, -4), ...mid.slice(4, -4).reverse()], {
          fill: g2, torn: { amp: 1.1, freq: 0.18, fine: 0.5, seed: rng.int(1, 1e6) },
          shadow: { color: 'rgba(150,70,80,0.2)', blur: 2, x: 0, y: 1.5 },
        });
      }
    },
  });
  return S.add({
    name: 'wisps', z: 8000,
    render(ctx, t, env) {
      const dx = (t - t0) * 6;
      drawSprites(ctx, [{ s: sprite, ax: B.x, ay: B.y, x: B.x + dx, y: B.y, sx: 1, sy: 1, shadowDx: 0, shadowDy: 3 }], { ...env.shadow, alpha: 0.25 });
    },
  });
}

function buildClouds(S, t0) {
  // The big cumulus: broad lit crowns out of the frame top-left stepping down to the
  // right, then rose and lavender lobes piled in front of its lower half.
  tagAll(addCloud(S, {
    name: 'tower', z: 9000, t0, x: 270, y: 0, w: 900, h: 270, tiers: 3, seed: 's01-tower', drift: 3,
    palette: SUNSET_LIT, light: [0.62, -0.78], flatBase: true, merge: true,
    torn: { amp: 1.2, freq: 0.1 }, rim: { width: 1.1, color: '#fff0d8' },
    tierOpts: [
      {
        // Left mass out of the frame top, a dip, the main crown topping out near y 20,
        // then lobes stepping down to the right.
        crown: [[330, 20, 110], [445, 42, 80], [532, 128, 58], [640, 110, 70], [722, 100, 80], [810, 104, 70], [872, 160, 46], [928, 194, 42], [992, 206, 40], [1052, 226, 34], [1106, 242, 27], [1150, 254, 17]],
        lobes: 10, lumpy: 0.1, tone: 0.22,
      },
      {
        crown: [[356, 150, 72], [468, 176, 60], [596, 182, 58], [700, 192, 54], [800, 202, 46]],
        lobes: 9, lumpy: 0.11, tone: 0.56,
      },
      {
        crown: [[318, 232, 62], [428, 242, 52], [538, 252, 42], [646, 260, 32]],
        lobes: 8, lumpy: 0.12, tone: 0.74,
      },
    ],
  }), 'clouds');

  // Right side: long thin peach-gold wisps, and a small puffy cloud on the frame edge.
  tagAll(addWisps(S, t0), 'clouds');
  tagAll(addCloud(S, {
    name: 'puffsC', z: 8500, t0, x: 1660, y: 128, w: 340, h: 118, tiers: 2, seed: 's01-puffs', palette: WISP, shadowDist: 3,
    light: [0.2, -0.98], flatBase: true, merge: true, torn: { amp: 1.4, freq: 0.14 }, rim: { width: 1, color: '#ffe8c4' },
    tierOpts: [
      { crown: [[1850, 196, 34], [1902, 168, 44], [1966, 156, 50]], lobes: 6, lumpy: 0.08, tone: 0.08 },
      { profile: [[0, 0], [0.08, 0.06], [0.3, 0.12], [0.55, 0.16], [0.8, 0.2], [1, 0.22]], body: 1, tone: 0.34 },
    ],
  }), 'clouds');
}