// Film-level props used by the transitions: the things the cut hides behind.
// Built from the shared element library, baked once (lazily), then moved per frame
// in 1920x1080 film coordinates.

import { W, H } from '../core/stage.js';
import { bakeSprite, drawSprites } from '../core/sprite.js';
import { piece, linear, radial } from '../core/piece.js';
import { TAU } from '../core/geom.js';
import { RNG, noise } from '../core/rng.js';
import { E, clamp, lerp, smoothstep } from '../core/ease.js';
import { rgba, mix } from '../core/color.js';
import { frond, spray, trunk, bigTrunk, tone, FOLIAGE, BARK } from '../elements/trees.js';
import { planCumulus, drawCumulus } from '../elements/clouds.js';
import { drawBoulder } from '../elements/terrain-rocks.js';
import { drawFoamPuff, WATER } from '../elements/water.js';

const LIGHT = [0.5, -0.86];
const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

// --- helpers used by the pop-up transition ------------------------------------------

export function planeBottom(L) {
  let y = -Infinity;
  for (const it of L.sprites) y = Math.max(y, it.s.y + it.s.h);
  return Number.isFinite(y) ? Math.min(y, H + 80) : H + 40;
}

export function depthRank(S, L) {
  const zs = S.layers.filter((l) => !l.tags.includes('sky') && !l.tags.includes('celestial')).map((l) => l.z);
  const lo = Math.log(Math.min(...zs)), hi = Math.log(Math.max(...zs));
  return hi > lo ? clamp((Math.log(L.z) - lo) / (hi - lo)) : 0;
}

// 0 -> 1 with a small paper-hinge overshoot.
export function popSpring(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 1 - Math.exp(-5.2 * x) * Math.cos(x * 8.2);
}

// --- T1: the passing pine ------------------------------------------------------------

function pineSprite() {
  return once('pine', () => bakeSprite({
    x: -460, y: -140, w: 920, h: H + 280, res: 0.7, mat: 'paper', seed: 101, light: LIGHT, shadow: { blur: 36 },
    draw(ctx) {
      const r = new RNG('pine');
      const pal = FOLIAGE.night;
      // Fronds behind the trunk, drooping out to both sides.
      for (let k = 0; k < 9; k++) {
        const y = -60 + k * 150 + r.range(-25, 25);
        for (const side of [-1, 1]) {
          frond(ctx, side * 80, y, r.range(300, 400), r.range(60, 80), {
            ang: r.range(0.3, 0.55), flip: side < 0, color: tone(pal, r.range(0.25, 0.6)), light: LIGHT, seed: r.int(1, 1e9),
          });
        }
      }
      trunk(ctx, 0, -140, H + 140, 270, { bark: BARK.night, light: LIGHT, taper: 0.95, flare: 0, seed: 7 });
      // A few short fronds crossing in front of the trunk.
      for (let k = 0; k < 4; k++) {
        frond(ctx, r.range(-60, 60), 120 + k * 260 + r.range(-30, 30), r.range(220, 300), 60, {
          ang: r.range(0.35, 0.6), flip: r.chance(0.5), color: tone(pal, r.range(0.35, 0.65)), light: LIGHT, seed: r.int(1, 1e9),
        });
      }
    },
  }));
}

export function passingPine(ctx, x, p, { dim = 0.62 } = {}) {
  const s = pineSprite();
  const sway = Math.sin(p * Math.PI) * 0.012;
  // So close to the lens the pine sits mostly in shadow.
  ctx.save();
  ctx.filter = `brightness(${dim}) saturate(0.85)`;
  drawSprites(ctx, [{ s, x, y: 0, ax: 0, ay: 0, rot: sway, sx: 1.2, sy: 1.08 }], { alpha: 0.6, dx: -36, dy: 12 });
  ctx.restore();
}

// --- T2: branches rushing past ------------------------------------------------------

function branchSprite(i) {
  return once(`branch${i}`, () => bakeSprite({
    x: -60, y: -300, w: 1000, h: 640, res: 0.55, mat: 'paper', seed: 200 + i, light: LIGHT, shadow: { blur: 24 },
    draw(ctx) {
      const r = new RNG(`branch${i}`);
      const pal = FOLIAGE.night;
      // A main spray and two side sprays, cut from the same dark fir paper.
      spray(ctx, 0, 0, 900, { ang: -0.05, bend: 0.25, leaf: 170, color: tone(pal, 0.45), light: LIGHT, seed: r.int(1, 1e9) });
      spray(ctx, 260, 10, 520, { ang: 0.55, bend: 0.4, leaf: 110, color: tone(pal, 0.3), light: LIGHT, seed: r.int(1, 1e9) });
      spray(ctx, 420, -10, 460, { ang: -0.6, bend: 0.5, leaf: 100, color: tone(pal, 0.6), light: LIGHT, seed: r.int(1, 1e9) });
    },
  }));
}

export function branchCover(p) {
  return p < 0.5 ? smoothstep(0.34, 0.5, p) : 1 - smoothstep(0.5, 0.64, p);
}

// Branches hang at different offsets around the path the camera flies along.
//   a: direction of the offset from the lens axis, r: offset (px at f = 1), spin: sprite angle,
//   z: relative depth (larger passes later)
const BRANCHES = [
  { a: 3.0, r: 760, spin: 1.4, z: 1.0 }, { a: 0.3, r: 820, spin: -1.6, z: 1.05 }, { a: -1.7, r: 700, spin: 0.2, z: 1.1 },
  { a: 1.9, r: 740, spin: 3.3, z: 1.0 }, { a: -0.5, r: 780, spin: 2.6, z: 1.18 }, { a: 4.0, r: 720, spin: -0.4, z: 1.12 },
  { a: -2.6, r: 800, spin: 1.0, z: 1.24 }, { a: 1.1, r: 690, spin: -2.2, z: 1.3 }, { a: 2.5, r: 860, spin: 0.7, z: 1.36 },
];

export function branches(ctx, p, cover) {
  // Perspective fly-through: each branch sits at a fixed offset from the lens axis and
  // grows and slides outward as the camera passes it, until it leaves the frame.
  const items = [];
  for (let i = BRANCHES.length - 1; i >= 0; i--) {
    const b = BRANCHES[i];
    const f = 0.42 * Math.pow(30, clamp(p / Math.min(b.z, 1.15)));
    const x = W / 2 + Math.cos(b.a) * b.r * f, y = H / 2 + Math.sin(b.a) * b.r * f * 0.7;
    // Far-off branches are lost in the dark until they come close; the last ones
    // brushing past the lens fade as they leave.
    const alpha = smoothstep(0.55, 1.0, f) * (1 - smoothstep(0.82, 1, p));
    items.push({ s: branchSprite(i % 3), x, y, ax: 450, ay: 0, rot: b.spin, sx: f, sy: f * (i % 2 ? -1 : 1), alpha });
  }
  for (const it of items) drawSprites(ctx, [it], { alpha: 0.55, dx: -14 * it.sx, dy: 18 * it.sx });
  if (cover > 0) {
    // The dense needle mass at the heart of the push: a dark bed with sprays radiating
    // from the centre over it, turning slowly so the cut never sits on a still frame.
    ctx.save();
    ctx.globalAlpha = cover;
    ctx.fillStyle = radial(ctx, W / 2, H / 2, 0, W * 0.75, [[0, '#183a26'], [1, '#0c1d14']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const spin = (p - 0.5) * 0.5;
    const wall = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + spin + (i % 2) * 0.13;
      const s = 1.9 + (i % 3) * 0.35;
      wall.push({ s: branchSprite(i % 3), x: W / 2, y: H / 2, ax: 0, ay: 0, rot: a, sx: s, sy: s * (i % 2 ? -1 : 1), alpha: cover });
    }
    drawSprites(ctx, wall, { alpha: 0.5 * cover, dx: -16, dy: 20 });
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.35 * cover;
    ctx.fillStyle = '#20302a';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// --- T3: trunk curtains ---------------------------------------------------------------

function trunkSprite(i, w) {
  return once(`trunk${i}`, () => bakeSprite({
    x: -w, y: -140, w: w * 2, h: H + 280, res: 0.6, mat: 'paper', seed: 300 + i, light: LIGHT, shadow: { blur: 40 },
    draw(ctx) {
      bigTrunk(ctx, 0, -140, H + 140, w, { bark: BARK.redwood, light: LIGHT, flare: 0, seed: 31 + i, rim: '#d88b4a' });
    },
  }));
}

const TRUNKS = [
  { w: 430, x0: -420, x1: 300, i: 0, d: 0.0 }, { w: 330, x0: -700, x1: 620, i: 1, d: 0.06 }, { w: 380, x0: -980, x1: 900, i: 2, d: 0.12 },
  { w: 410, x0: W + 420, x1: W - 300, i: 3, d: 0.03 }, { w: 350, x0: W + 700, x1: W - 640, i: 4, d: 0.09 }, { w: 430, x0: W + 980, x1: 1040, i: 5, d: 0.15 },
];

export function trunkCurtains(ctx, close) {
  const items = TRUNKS.map((t) => {
    const k = clamp((close - t.d * (1 - close)) / (1 - t.d * 0.2));
    return { s: trunkSprite(t.i, t.w), x: lerp(t.x0, t.x1, k), y: 0, ax: 0, ay: 0 };
  });
  // Outer trunks are nearest the lens: draw the inner (meeting) ones first.
  for (const it of items.slice().reverse()) drawSprites(ctx, [it], { alpha: 0.6, dx: -20, dy: 10 });
}

// --- T4: cloud bank -------------------------------------------------------------------

function cloudSprite(i) {
  return once(`cloud${i}`, () => bakeSprite({
    x: -260, y: -360, w: W + 520, h: 1900, res: 0.5, mat: [{ tex: 'crumple', amt: 0.6, scale: 0.4 }, { tex: 'fiber', amt: 0.4 }], seed: 400 + i, light: LIGHT, shadow: { blur: 36 },
    draw(ctx) {
      const pal = i === 1 ? 'night' : 'sea';
      const bodyTop = 0, bodyBot = 1200;
      // Solid body, then cumulus crests on top and (mirrored) underneath.
      ctx.fillStyle = linear(ctx, 0, bodyTop, 0, bodyBot, ['#e9e3f0', '#cfc8e4', '#bab2d8', '#cfc8e4', '#e6e0ee']);
      ctx.fillRect(-260, bodyTop + 120, W + 520, bodyBot - bodyTop - 240);
      // Inner rows of puffs so the body reads as stacked cloud, not a flat sheet.
      for (let row = 0; row < 3; row++) {
        const inner = planCumulus({ x: -260, y: 180 + row * 300, w: W + 520, h: 300, tiers: 2, profile: 'band', seed: `bankI${i}${row}` });
        drawCumulus(ctx, inner, { palette: pal, light: LIGHT });
      }
      const top = planCumulus({ x: -260, y: bodyTop - 300, w: W + 520, h: 460, tiers: 3, profile: 'band', seed: `bankT${i}` });
      drawCumulus(ctx, top, { palette: pal, light: LIGHT });
      ctx.save();
      ctx.translate(0, bodyBot * 2 + 40);
      ctx.scale(1, -1);
      const bot = planCumulus({ x: -260, y: bodyBot - 300, w: W + 520, h: 460, tiers: 3, profile: 'band', seed: `bankB${i}` });
      drawCumulus(ctx, bot, { palette: pal, light: [LIGHT[0], -LIGHT[1]] });
      ctx.restore();
    },
  }));
}

export function cloudBank(ctx, e, p) {
  // Two banks at different depths pass down the frame as the camera rises through them.
  const near = lerp(-1700, H + 420, e);
  const far = lerp(-1600, H + 420, E.smooth(clamp((p - 0.06) / 0.9)));
  drawSprites(ctx, [{ s: cloudSprite(1), x: 0, y: far, ax: 0, ay: 0, sx: 0.92, alpha: 0.9 }], { alpha: 0.3, dx: 0, dy: 24 });
  drawSprites(ctx, [{ s: cloudSprite(2), x: 0, y: near, ax: 0, ay: 0, sx: 1.08 }], { alpha: 0.4, dx: 0, dy: 30 });
}

// --- T5: rock iris ---------------------------------------------------------------------

const IRIS_R = 520;      // radius of the opening in the baked frame
const IRIS_OUT = 1250;   // outer radius of the rock ring

function irisSprite() {
  return once('iris', () => bakeSprite({
    x: -IRIS_OUT, y: -IRIS_OUT, w: IRIS_OUT * 2, h: IRIS_OUT * 2, res: 0.5, mat: 'stone', seed: 501, light: LIGHT, shadow: { blur: 30 },
    draw(ctx) {
      const r = new RNG('iris');
      const nz = noise(77);
      const ring = (rad, rough) => {
        const pts = [];
        for (let i = 0; i < 96; i++) {
          const a = (i / 96) * TAU;
          const k = 1 + rough * nz.fbm(Math.cos(a) * 1.7 + rad * 0.001, Math.sin(a) * 1.7, 3);
          pts.push([Math.cos(a) * rad * k, Math.sin(a) * rad * k * 0.84]);
        }
        return pts;
      };
      // Dark rock mass with a ragged opening.
      const outer = new Path2D();
      outer.rect(-IRIS_OUT, -IRIS_OUT, IRIS_OUT * 2, IRIS_OUT * 2);
      const hole = ring(IRIS_R, 0.16);
      const hp = new Path2D();
      hp.moveTo(hole[0][0], hole[0][1]);
      for (const q of hole) hp.lineTo(q[0], q[1]);
      hp.closePath();
      outer.addPath(hp);
      ctx.fillStyle = radial(ctx, 0, 0, IRIS_R, IRIS_OUT, [[0, '#3a332d'], [0.5, '#221d19'], [1, '#14110e']]);
      ctx.fill(outer, 'evenodd');
      // Boulders crowding the rim of the opening, lit from the opening side.
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * TAU + r.range(-0.05, 0.05);
        const rad = IRIS_R * r.range(1.02, 1.22);
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad * 0.84;
        const size = r.range(130, 230);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2);
        drawBoulder(ctx, { x: 0, y: size * 0.35, w: size * 1.3, h: size * 0.8, shape: r.pick(['round', 'pointy', 'slab']), palette: 'granite', light: [0, -1], seed: 900 + i, moss: i % 5 === 0 ? 0.3 : 0 });
        ctx.restore();
      }
    },
  }));
}

export function rockIris(ctx, cx, cy, r) {
  if (r > 2400) return;
  const s = irisSprite();
  const k = Math.max(0.0005, r / IRIS_R);
  drawSprites(ctx, [{ s, x: cx, y: cy, ax: 0, ay: 0, sx: k, sy: k }], { alpha: 0.7, dx: 0, dy: 0 });
  // Beyond the baked ring everything is rock in shadow.
  const outR = IRIS_OUT * k * 0.97;
  if (outR < Math.hypot(W, H)) {
    ctx.save();
    const path = new Path2D();
    path.rect(-200, -200, W + 400, H + 400);
    path.ellipse(cx, cy, outR, outR, 0, 0, TAU);
    ctx.fillStyle = '#14110e';
    ctx.fill(path, 'evenodd');
    ctx.restore();
  }
}

// --- T6: flare and flash ---------------------------------------------------------------

// A light bloom with a smooth gaussian-like falloff (no visible rim at any size):
// a white-hot core inside a coloured halo, plus a full-frame wash that rises with k.
function bloomLight(ctx, x, y, k, color, washColor) {
  const r = lerp(90, 2400, Math.pow(k, 1.5));
  const stops = [];
  for (let i = 0; i <= 10; i++) {
    const d = i / 10;
    const a = Math.exp(-d * d * 4.5);
    stops.push([d, rgba(mix('#ffffff', color, Math.min(1, d * 2.2)), a)]);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = radial(ctx, x, y, 0, r, stops);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = radial(ctx, x, y, 0, r * 0.25, stops);
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = smoothstep(0.35, 1, k) * 0.9;
  ctx.fillStyle = washColor;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = smoothstep(0.82, 1, k);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function flare(ctx, x, y, k, { warm = 1 } = {}) {
  const col = mix('#cfe4ff', '#ffd98a', warm);
  bloomLight(ctx, x, y, k, col, mix('#eef6ff', '#fff2d6', warm));
}

export function flashFade(ctx, a) {
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = a;
  ctx.fillStyle = '#eef6ff';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// --- T7: the wave ------------------------------------------------------------------------

function waveSprite(i) {
  return once(`wave${i}`, () => bakeSprite({
    x: -200, y: -300, w: W + 400, h: 1900, res: 0.5, mat: 'paper', seed: 600 + i, light: LIGHT, shadow: { blur: 28 },
    draw(ctx) {
      const r = new RNG(`wave${i}`);
      const pal = WATER.night;
      const deep = ['#123452', '#174064', '#1d4c74'][i], mid = ['#2a6690', '#2f72a0', '#3a80ae'][i];
      const crestY = (x) => -70 * Math.sin(x * 0.0038 + i * 1.9) - 34 * Math.sin(x * 0.011 + i * 0.7);
      const crest = [];
      for (let x = -200; x <= W + 200; x += 16) crest.push([x, crestY(x)]);
      piece(ctx, [...crest, [W + 200, 1600], [-200, 1600]], { fill: linear(ctx, 0, -120, 0, 1600, [mid, deep, deep]), torn: { amp: 3, freq: 0.05, seed: i } });
      // Swell: overlapping paper strips following the crest, darker and lighter.
      for (let k = 0; k < 16; k++) {
        const off = 70 + k * 92 + r.range(-12, 12);
        const thick = r.range(10, 22);
        const top = crest.map(([x, y]) => [x, y + off + 14 * Math.sin(x * 0.016 + k * 1.3)]);
        const strip = [...top, ...top.slice().reverse().map(([x, y]) => [x, y + thick])];
        piece(ctx, strip, { fill: rgba(k % 3 === 0 ? '#9fd0ee' : k % 3 === 1 ? '#0b2238' : '#5a9cc8', k % 3 === 1 ? 0.32 : 0.28), torn: { amp: 1.5, freq: 0.08, seed: 40 + k } });
      }
      // Torn white foam riding the crest.
      piece(ctx, [...crest.map(([x, y]) => [x, y - 20]), ...crest.slice().reverse().map(([x, y]) => [x, y + 26])], {
        fill: '#eef4f8', torn: { amp: 9, freq: 0.07, seed: 20 + i }, rim: { color: '#ffffff', width: 2 },
      });
      for (let k = 0; k < 26; k++) {
        const x = -150 + k * 86 + r.range(-20, 20);
        drawFoamPuff(ctx, x, crestY(x) - 4, r.range(26, 48), { palette: pal, seed: 70 + k + i * 40, light: LIGHT, bumps: 5 });
      }
    },
  }));
}

export function wave(ctx, p) {
  // Rise to cover the lens by p = 0.5, then drain downward revealing the next sky first.
  // The wave surges up, the lens is under water only around p = 0.46..0.54, then it
  // drains away.
  for (const i of [0, 1, 2]) {
    const lag = i * 0.04;
    let y;
    if (p < 0.5) y = lerp(H + 160, -260 + i * 70, E.smooth(clamp((p - 0.1 - lag) / (0.38 - lag))));
    else y = lerp(-260 + i * 70, H + 420, E.smooth(clamp((p - 0.53 - (2 - i) * 0.03) / 0.34)));
    drawSprites(ctx, [{ s: waveSprite(i), x: 0, y, ax: 0, ay: 0 }], { alpha: 0.5, dx: 0, dy: -22 });
  }
}

// --- T8: the pop-up page -----------------------------------------------------------------

function pageSprite() {
  return once('page', () => bakeSprite({
    x: -120, y: -40, w: W + 240, h: 820, res: 0.5, mat: 'paper', seed: 701, light: LIGHT, shadow: { blur: 20 },
    draw(ctx) {
      // The ground page the cut-outs fold down onto: dark meadow paper, darker toward
      // the viewer, with a softly torn far edge.
      piece(ctx, [[-120, 0], [W + 120, 0], [W + 120, 780], [-120, 780]], {
        fill: linear(ctx, 0, 0, 0, 780, ['#2f4a3a', '#1f3529', '#14231c']),
        torn: { amp: 4, freq: 0.03, seed: 9 },
      });
      // Faint printed fold lines where the pieces stand.
      const r = new RNG('page');
      for (let i = 0; i < 7; i++) {
        const y = 40 + i * 100 + r.range(-20, 20);
        piece(ctx, [[-120, y], [W + 120, y + r.range(-8, 8)], [W + 120, y + 3], [-120, y + 3]], { fill: 'rgba(0,0,0,0.18)' });
      }
    },
  }));
}

export function popupPage(ctx, horizon, alpha) {
  if (alpha <= 0.002) return;
  drawSprites(ctx, [{ s: pageSprite(), x: 0, y: horizon, ax: 0, ay: 0, alpha }], { alpha: 0.4, dx: 0, dy: -10 });
}

// --- T9: light flood ----------------------------------------------------------------------

export function flood(ctx, x, y, k, color) {
  if (k <= 0.001) return;
  bloomLight(ctx, x, y, k, color, mix(color, '#fffaf0', 0.55));
}
