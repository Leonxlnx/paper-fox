// Water cut from paper: calm lakes of horizontal strips, rivers whose strips flow
// downstream, waterfalls, churning foam, rapids around rocks, ripple rings and the
// glittering reflection of a light on the surface.
//
// Static art is drawn by the draw* functions (usable inside any sprite's draw(ctx));
// the add* factories bake it and add animated planes to a Scene.

import { RNG } from '../core/rng.js';
import { piece, pathOf, bevelBands, linear, radial } from '../core/piece.js';
import { ellipse, tear, TAU } from '../core/geom.js';
import { surface } from '../core/canvas.js';
import { drawSprites } from '../core/sprite.js';
import { mix, shade, vary, rgba } from '../core/color.js';
import { clamp, lerp, smoothstep } from '../core/ease.js';
import { ribbon, outline, project, atU, angDiff, warp, uAtSig, flowTexture, drawSlices, riders, drawShadowOnly, toTexFrame, sheet, bakeAtlas, drawAtlas } from './water-flow.js';

export { ribbon, outline, project, atU, sheet } from './water-flow.js';

// --- Palettes ----------------------------------------------------------------------
// deep: river bed and gaps between strips; base / mid / light / pale: the strip tiers
// from dark to light; foam: white water and rims; foamShade: creases of foam puffs;
// shadow: contact shadows between strips; shore: reflections of a dark far shore;
// glint: sparkles; glow: reflection of the light source [edge, body, core];
// lake: the wash under a calm lake [far, near]; fall: band order across a waterfall.

export const WATER = {
  // ref02: moonlit river and rapids.
  night: {
    deep: '#0e3a72', base: '#1f5c99', mid: '#3a7fbe', light: '#6aa6d6', pale: '#a9d0ec',
    foam: '#e9f4fb', foamShade: '#a2b6d2', shadow: '#040f26', shore: '#0c2f3c',
    glint: '#fff0c4', glow: ['#e8cf98', '#f8e8c2', '#fff8e6'],
    lake: ['#4a86ba', '#2a6aa0'],
    fall: ['mid', 'light', 'foam', 'pale', 'light', 'foam', 'mid', 'light'],
  },
  // ref02: the calm lake under the moon, a deeper teal-blue than the river.
  nightLake: {
    deep: '#07416e', base: '#185f8e', mid: '#2f74a8', light: '#5591c4', pale: '#80aed4',
    foam: '#e2eef6', foamShade: '#a2b6d2', shadow: '#03101e', shore: '#05242a',
    glint: '#fff0c4', glow: ['#e8cf98', '#f8e8c2', '#fff8e6'],
    lake: ['#3f7eb2', '#215f92'],
    fall: ['mid', 'light', 'foam', 'pale', 'light', 'mid'],
  },
  // ref04: saturated canyon blues under the moon.
  canyon: {
    deep: '#0c58a8', base: '#1f72be', mid: '#4392d1', light: '#72b1e0', pale: '#b4d4ee',
    foam: '#f0f6fb', foamShade: '#a9bed8', shadow: '#05112a', shore: '#0b2a40',
    glint: '#fff1c8', glow: ['#e2c88e', '#f5e3b6', '#fff6dc'],
    lake: ['#6f9fd2', '#2f72bc'],
    fall: ['base', 'mid', 'foam', 'pale', 'light', 'mid', 'pale', 'base'],
  },
  // ref10: sunrise; pale water, creamy foam, gold reflections.
  dawn: {
    deep: '#33709e', base: '#5592bd', mid: '#76aecb', light: '#a3cddc', pale: '#d4e7e6',
    foam: '#f7f2e8', foamShade: '#c4c8c4', shadow: '#1a2a3a', shore: '#2c4a3a',
    glint: '#fff3c2', glow: ['#e8b864', '#f6d98f', '#fff1c4'],
    lake: ['#b8c6c4', '#6f9fc0'],
    fall: ['light', 'foam', 'pale', 'foam', 'light', 'pale', 'foam'],
  },
  // ref01: dusk river under the bridge.
  dusk: {
    deep: '#173f86', base: '#2c62b0', mid: '#4b86cc', light: '#86b3e2', pale: '#c3daf0',
    foam: '#f4f6fa', foamShade: '#b0b8d4', shadow: '#0b1236', shore: '#2a2e52',
    glint: '#ffe6c0', glow: ['#f0b47a', '#f9d6a4', '#fff0d6'],
    lake: ['#c7a9b8', '#6d86c0'],
    fall: ['mid', 'foam', 'light', 'pale', 'foam', 'mid', 'light'],
  },
  // ref06: crystal cave pool; deep blue with gold light.
  cave: {
    deep: '#0a2a66', base: '#14449a', mid: '#2766b8', light: '#5596dc', pale: '#9cc8f0',
    foam: '#e6f2fc', foamShade: '#8fb0d8', shadow: '#030a20', shore: '#08183a',
    glint: '#ffe6a8', glow: ['#d9a84e', '#f2cf7c', '#fff0be'],
    lake: ['#2d62b0', '#163f8c'],
    fall: ['mid', 'pale', 'foam', 'light', 'pale', 'mid'],
  },
};

const col = (pal, key) => pal[key] ?? key;

// Offset of a shadow cast away from the light by d px.
const away = (light, d) => ({ dx: -light[0] * d, dy: -light[1] * d });

// --- Strip geometry ----------------------------------------------------------------

// The basic cut of all water: a tapered sliver lying along +x from x0 to x1, centred
// on y and th thick.
//   amp, wave, phase  lateral meander (px, wavelength, radians)
//   bow               sag of the middle (px, positive = toward +y)
//   taper             end shape: 1 pointed, 0.3 blunt and rounded
//   lean              share of the thickness above the centre line (0.5 symmetric)
export function sliver(x0, x1, y, th, { amp = 0, wave = 240, phase = 0, bow = 0, taper = 0.6, lean = 0.5 } = {}) {
  const L = x1 - x0;
  const m = Math.max(8, Math.ceil(L / 8));
  const top = [], bot = [];
  for (let i = 0; i <= m; i++) {
    const k = i / m, x = x0 + L * k;
    const p = Math.pow(Math.sin(Math.PI * k), taper);
    const c = y + amp * Math.sin(((x - x0) / wave) * TAU + phase) + bow * (1 - (2 * k - 1) ** 2);
    top.push([x, c - th * lean * p]);
    bot.push([x, c + th * (1 - lean) * p]);
  }
  return [...top, ...bot.reverse()];
}

// One paper strip with its own contact shadow, lit edge and optional white rim.
// For a few pieces; large batches go on a sheet() instead.
function strip(ctx, pts, { fill, light, shadowColor, drop = 2, blur = 2.5, rim = 0, rimColor = '#fff', hi = 0.28, lo = 0.16, torn = 0.5, seed = 1 }) {
  const off = away(light, drop);
  return piece(ctx, pts, {
    fill,
    torn: torn ? { amp: torn, freq: 0.12, fine: torn * 0.5, seed } : null,
    rim: rim ? { color: rimColor, width: rim } : null,
    shadow: shadowColor ? { color: shadowColor, blur, x: off.dx, y: off.dy } : null,
    bevel: hi || lo ? { light, width: 1.1, hi, lo, hiColor: '#ffffff' } : null,
  });
}

// Sheet options for a tier of strips lying flat on water.
const tierLook = (pal, light, { drop = 2, blur = 2.5, alpha = 0.5, hi = 0.35, lo = 0.22, width = 1.2 } = {}) => ({
  light,
  shadow: { color: pal.shadow, blur, alpha, ...away(light, drop) },
  edge: { width, hi, lo },
});

// Torn edge for a batch strip: coarse steps keep vertex counts (and raster time) low.
const stripTear = (amp, seed) => ({ amp, freq: 0.14, fine: amp * 0.5, seed, step: 7 });

// Even-odd point in polygon test.
function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// --- Lake ----------------------------------------------------------------------------

// Calm water: a wash covered in tiers of horizontal paper strips that grow toward the
// viewer, dark reflections under the far shore and a glare under the light (ref02, ref10).
//   x0, x1, top, bottom   extent (top = far shore line)
//   shape                 optional polygon to clip to (default: the rectangle)
//   light                 { x, width } where the light's reflection falls (null: none)
//   shore                 { height, ranges: [[x0, x1], ...], color, alpha } tree reflections
//   density, scale        strip count and size multipliers
//   sceneLight            light direction for edges and shadows
export function drawLake(ctx, o) {
  const { x0, x1, top, bottom, seed = 'lake', density = 1, scale = 1, sceneLight = [0.4, -0.9] } = o;
  const pal = o.palette ?? WATER.nightLake;
  const rng = new RNG(seed);
  const H = bottom - top;
  const shape = o.shape ?? [[x0, top], [x1, top], [x1, bottom], [x0, bottom]];
  const lightX = o.light?.x ?? null, lightW = o.light?.width ?? 120;
  ctx.save();
  ctx.clip(pathOf(shape));

  // Wash: lighter toward the horizon, brighter around the glare.
  const [far, near] = pal.lake;
  ctx.fillStyle = linear(ctx, 0, top, 0, bottom, [far, mix(far, near, 0.6), near]);
  ctx.fillRect(x0 - 10, top - 10, x1 - x0 + 20, H + 20);
  if (lightX !== null) {
    ctx.fillStyle = radial(ctx, lightX, top + H * 0.25, 0, lightW * 3, [[0, rgba(pal.pale, 0.5)], [1, rgba(pal.pale, 0)]]);
    ctx.fillRect(x0 - 10, top - 10, x1 - x0 + 20, H + 20);
  }

  // Reflections of the far shore's forest: a dark band whose lower edge dips into the
  // inverted tips of the tallest trees. The strips laid on top break it up.
  if (o.shore) {
    const sh = o.shore.height ?? 20;
    const ranges = o.shore.ranges ?? [[x0, x1]];
    sheet(ctx, (add) => {
      for (const [a, b] of ranges) {
        const pts = [[a, top - 3]];
        for (let x = a; x < b;) {
          const tw = rng.range(12, 30);
          const tip = rng.chance(0.45) ? rng.range(1.3, 2.1) : rng.range(0.7, 1.1);
          pts.push([x + tw * 0.15, top + sh * rng.range(0.55, 0.8)]);
          pts.push([x + tw * rng.range(0.4, 0.6), top + sh * tip]);
          pts.push([x + tw * 0.85, top + sh * rng.range(0.55, 0.8)]);
          x += tw;
        }
        pts.push([b, top + sh * 0.4], [b, top - 3]);
        add(pts, { fill: rgba(o.shore.color ?? pal.shore, o.shore.alpha ?? 0.9), torn: { amp: 1.2, freq: 0.2, seed: 3, step: 5 } });
      }
    });
  }

  // Strip tiers, back to front. Rows step down from the horizon; depth d grows the
  // rows, the strips and their shadows.
  const tiers = [
    { cols: ['base', 'mid', 'mid'], cover: 0.7, len: [40, 160], th: [3, 9], look: { alpha: 0.55, hi: 0.15 } },
    { cols: ['deep'], cover: 0.16, len: [16, 70], th: [1.6, 4.5], look: { alpha: 0.4, hi: 0.1 } },
    { cols: ['light', 'light', 'mid'], cover: 0.42, len: [26, 140], th: [2.4, 7], look: { alpha: 0.5, hi: 0.2 } },
    { cols: ['pale', 'light'], cover: 0.14, len: [14, 80], th: [1.5, 4.2], look: { alpha: 0.4, hi: 0.3 } },
  ];
  for (const T of tiers) {
    sheet(ctx, (add) => {
      let y = top + rng.range(0, 2);
      while (y < bottom + 6) {
        const d = clamp((y - top) / H);
        const sz = lerp(0.32, 1, Math.pow(d, 0.9)) * scale;
        const step = (lerp(3.2, 11, Math.pow(d, 1.1)) * scale) / Math.sqrt(density);
        let x = x0 - rng.range(0, 120) * sz;
        while (x < x1 + 20) {
          const L = rng.range(...T.len) * sz * (rng.chance(0.12) ? 1.8 : 1);
          const th = rng.range(...T.th) * sz;
          const glare = lightX === null ? 0 : smoothstep(lightW * 2.4, lightW * 0.3, Math.abs(x + L / 2 - lightX));
          let c = col(pal, rng.pick(T.cols));
          if (glare > 0.2 && T.cols[0] !== 'deep') c = mix(c, pal.pale, glare * 0.35);
          add(sliver(x, x + L, y + rng.range(-0.4, 0.4) * step, th, {
            taper: rng.range(0.35, 0.85), lean: rng.range(0.38, 0.62), amp: th * rng.range(0, 0.35), wave: L * rng.range(0.7, 1.5), phase: rng.range(0, TAU),
          }), { fill: vary(c, rng, 0.05), torn: th > 2.5 ? stripTear(lerp(0.3, 0.7, d), rng.int(1, 1e6)) : null });
          x += L * (1 + (1 / T.cover - 1) * rng.range(0.3, 1.7));
        }
        y += step * rng.range(0.7, 1.3);
      }
    }, tierLook(pal, sceneLight, { drop: 1.6, blur: 2, ...T.look }));
  }
  ctx.restore();
}

// Lake plane plus shimmer: a static base sprite, highlight strips that sway slowly side
// to side, and (with light) a glittering reflection column.
//   z, x0, x1, top, bottom, shape, palette, seed, density, scale, shore   as drawLake
//   light       { x, width, ... } also addReflection options for the column
//   shimmer     number of moving highlight strips (default scales with area)
//   alpha, order  layer options
export function addLake(S, opts) {
  const o = { z: 1500, seed: 'lake', palette: WATER.nightLake, density: 1, scale: 1, order: 0, ...opts };
  const { x0, x1, top, bottom, z } = o;
  const pal = o.palette;
  const L = S.light;
  const layers = [];
  const base = S.sprite({
    name: 'lake', x: x0 - 4, y: top - 4, w: x1 - x0 + 8, h: bottom - top + 8, mat: 'smooth', edge: false, shadow: false,
    draw: (ctx) => drawLake(ctx, { ...o, sceneLight: L }),
  });
  layers.push(S.add({ name: 'lake', z, order: o.order, alpha: o.alpha, sprites: [{ s: base }] }));

  // Highlight strips: one atlas, each strip swaying on its own slow cycle.
  const rng = new RNG(`${o.seed}:shimmer`);
  const H = bottom - top;
  const count = o.shimmer ?? Math.round((((x1 - x0) * H) / 2200) * o.density);
  const lightX = o.light?.x ?? null, lightW = o.light?.width ?? 120;
  const cells = [], items = [];
  for (let i = 0; i < count; i++) {
    const d = Math.pow(rng.next(), 0.8);
    const y = top + 3 + d * (H - 6);
    let x = rng.range(x0, x1);
    if (lightX !== null && rng.chance(0.3)) x = lightX + rng.gauss() * lightW * 1.2;
    const len = lerp(12, 66, d) * o.scale * rng.range(0.6, 1.8);
    const th = lerp(0.9, 3.2, d) * o.scale * rng.range(0.7, 1.3);
    if (o.shape && !(inside(o.shape, x - len / 2, y) && inside(o.shape, x + len / 2, y))) continue;
    const glare = lightX === null ? 0 : smoothstep(lightW * 2, lightW * 0.3, Math.abs(x - lightX));
    const fill = glare > 0.3 && rng.chance(glare) ? mix(pal.glow[1], pal.pale, 0.35) : rng.pick([pal.pale, pal.light, mix(pal.pale, '#ffffff', 0.35)]);
    const pts = sliver(-len / 2, len / 2, 0, th, { taper: 0.55 });
    cells.push({ hx: len / 2 + 1, hy: th + 1, draw: (c) => piece(c, pts, { fill, torn: { amp: 0.35, freq: 0.15, seed: i + 1 } }) });
    items.push({ cell: cells.length - 1, x, y, amp: lerp(2, 8, d) * o.scale, period: rng.range(3.2, 6.5), phase: rng.next(), pulse: rng.range(0.15, 0.45) });
  }
  const atlas = bakeAtlas(S, cells, { name: 'lake-shimmer', mat: 'smooth', res: 1.5, edge: { width: 0.9, hi: 0.4, lo: 0.2, soft: 0 }, shadow: { blur: 1.6 } });
  const sh = { ...away(L, 1.4), alpha: 0.4 };
  layers.push(S.add({
    name: 'lake-shimmer', z, order: o.order + 0.01, alpha: o.alpha,
    render(ctx, t) {
      drawAtlas(ctx, atlas, items.map((it) => {
        const a = TAU * (t / it.period + it.phase);
        return { cell: it.cell, x: it.x + Math.sin(a) * it.amp, y: it.y, alpha: 1 - it.pulse * (0.5 + 0.5 * Math.sin(a * 1.43 + it.phase * 9)) };
      }), sh);
    },
  }));
  if (o.light) layers.push(...addReflection(S, { z, order: o.order + 0.02, palette: pal, seed: `${o.seed}:refl`, top: top + 2, bottom, alpha: o.alpha, ...o.light }));
  return layers;
}

// --- Reflection of a light ------------------------------------------------------------

// Dash layout of a reflection column.
function reflectionDashes(o, rng) {
  const { x, top, bottom, width = 90, widthBottom = width * 0.75, count = 34 } = o;
  const out = [];
  const H = bottom - top;
  for (let i = 0; i < count; i++) {
    const k = (i + rng.range(0.15, 0.85)) / count;
    const d = Math.pow(k, 1.2);
    const env = lerp(width, widthBottom, d);
    out.push({
      x: x + rng.gauss() * env * 0.14, y: top + d * H,
      w: env * rng.range(0.5, 1.1) * (rng.chance(0.15) ? 1.3 : 1),
      th: lerp(4, 13, d) * rng.range(0.75, 1.25) * (o.thick ?? clamp(Math.sqrt(width / 120), 0.45, 1.4)),
      taper: rng.range(0.12, 0.32), phase: rng.range(0, TAU), d,
    });
  }
  return out;
}

const dashShape = (d) => sliver(d.x - d.w / 2, d.x + d.w / 2, d.y, d.th, { taper: d.taper, amp: d.th * 0.15, wave: d.w * 1.2, phase: d.phase, lean: 0.45 });

// The column of light on water under the moon or sun: stacked horizontal dashes of
// cream and gold, wider and thicker toward the viewer (ref02, ref10).
//   x, top, bottom        column centre line and extent
//   width, widthBottom    column width at the top and the bottom
//   count, thick          number of dashes, thickness multiplier
//   colors                [edge, body, core] (default palette.glow)
export function drawReflection(ctx, o) {
  const { seed = 'refl', light = [0.4, -0.9] } = o;
  const [edge, body, core] = o.colors ?? (o.palette ?? WATER.night).glow;
  const rng = new RNG(seed);
  sheet(ctx, (add) => {
    for (const d of reflectionDashes(o, rng)) {
      add(dashShape(d), { fill: linear(ctx, 0, d.y - d.th * 0.5, 0, d.y + d.th * 0.6, [core, body, edge]), torn: { amp: 0.6, freq: 0.12, fine: 0.3, seed: rng.int(1, 1e6) } });
    }
  }, { light, shadow: { color: '#0a1430', blur: 2, alpha: 0.4, ...away(light, 1.6) }, edge: { width: 1, hi: 0.45, lo: 0.15 } });
}

// Animated reflection: dashes baked into a few interleaved groups that drift and
// breathe out of step, glints that twinkle and a soft glow that pulses over the column.
//   z, x, top, bottom, width, widthBottom, count, thick, palette/colors, seed  as drawReflection
//   glints      number of twinkling sparkles (default count * 1.2)
//   glow        strength of the additive glow (0 to disable)
//   speed       shimmer speed multiplier
export function addReflection(S, opts) {
  const o = { z: 1500, seed: 'refl', palette: WATER.night, glow: 0.4, speed: 1, order: 0, ...opts };
  const [edge, body, core] = o.colors ?? o.palette.glow;
  const rng = new RNG(o.seed);
  const L = S.light;
  const width = o.width ?? 90;
  const H = o.bottom - o.top;
  const all = reflectionDashes(o, rng);
  const atlas = bakeAtlas(S, all.map((d, i) => ({
    hx: d.w / 2 + 2, hy: d.th + 2,
    draw: (ctx) => piece(ctx, dashShape({ ...d, x: 0, y: 0 }), {
      fill: linear(ctx, 0, -d.th * 0.5, 0, d.th * 0.6, [core, body, edge]),
      torn: { amp: 0.6, freq: 0.12, fine: 0.3, seed: i + 11 },
    }),
  })), { name: 'refl-dashes', mat: 'smooth', res: 1.25, edge: { width: 1, hi: 0.45, lo: 0.15, soft: 0 }, shadow: { blur: 2 } });
  const items = all.map((d, i) => ({ cell: i, x: d.x, y: d.y, period: rng.range(1.6, 3.4), phase: rng.next(), drift: lerp(1.5, 6, d.d), breathe: rng.range(0.06, 0.16) }));
  const sh = { ...away(L, 1.6), alpha: 0.4 };
  const glints = [];
  const dot = S.sprite({
    name: 'glint', x: -4, y: -4, w: 8, h: 8, mat: 'none', edge: false, shadow: false,
    draw: (ctx) => { ctx.fillStyle = radial(ctx, 0, 0, 0, 4, [[0, '#ffffff'], [0.45, rgba(o.palette.glint, 0.95)], [1, rgba(o.palette.glint, 0)]]); ctx.fillRect(-4, -4, 8, 8); },
  });
  const gCount = o.glints ?? Math.round(all.length * 1.2);
  for (let i = 0; i < gCount; i++) {
    const d = Math.pow(rng.next(), 1.1);
    glints.push({ x: o.x + rng.gauss() * width * 0.9, y: o.top + d * H, r: lerp(0.6, 1.4, d) * rng.range(0.6, 1.3), period: rng.range(0.9, 2.4), phase: rng.next() });
  }
  const halo = S.sprite({
    name: 'refl-glow', x: -50, y: -50, w: 100, h: 100, mat: 'none', edge: false, shadow: false,
    draw: (ctx) => { ctx.fillStyle = radial(ctx, 0, 0, 0, 50, [[0, rgba(core, 0.9)], [0.4, rgba(body, 0.35)], [1, rgba(body, 0)]]); ctx.fillRect(-50, -50, 100, 100); },
  });
  const layers = [];
  layers.push(S.add({
    name: 'reflection', z: o.z, order: o.order, alpha: o.alpha,
    render(ctx, t) {
      const tt = t * o.speed;
      drawAtlas(ctx, atlas, items.map((it) => {
        const a = TAU * (tt / it.period + it.phase);
        return { cell: it.cell, x: it.x + Math.sin(a) * it.drift, y: it.y, sx: 1 + Math.sin(a * 1.3 + 1) * it.breathe, alpha: 0.88 + 0.12 * Math.sin(a * 2.1) };
      }), sh);
    },
  }));
  layers.push(S.add({
    name: 'reflection-light', z: o.z, order: o.order + 0.005, alpha: o.alpha, blend: 'lighter',
    render(ctx, t) {
      const tt = t * o.speed;
      if (o.glow > 0) {
        ctx.save();
        ctx.globalAlpha *= o.glow * (0.85 + 0.15 * Math.sin((TAU * tt) / 3.7));
        ctx.drawImage(halo.canvas, o.x - width * 1.1, o.top - H * 0.1, width * 2.2, H * 1.15);
        ctx.restore();
      }
      const base = ctx.globalAlpha;
      for (const g of glints) {
        const tw = Math.max(0, Math.sin(TAU * (tt / g.period + g.phase)));
        if (tw < 0.05) continue;
        ctx.globalAlpha = base * tw * tw;
        const r = g.r * (3 + tw * 2);
        ctx.drawImage(dot.canvas, g.x - r, g.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = base;
    },
  }));
  return layers;
}

// --- River -------------------------------------------------------------------------------

// The angle a river strip lies at, given the flow direction `ang`. Paper rivers in the
// references keep their strips near horizontal: along the flow where the river crosses
// the frame, across it (as arcs) where the river comes toward the viewer.
//   align  'auto' (blend by direction), 'along', 'across', or a 0..1 weight of 'along'
export function stripAngle(ang, align = 'auto') {
  const tx = Math.cos(ang), ty = Math.sin(ang);
  const [ax, ay] = tx < 0 ? [-tx, -ty] : [tx, ty];
  const [bx, by] = -ty < 0 ? [ty, -tx] : [-ty, tx];
  let w = align === 'along' ? 1 : align === 'across' ? 0 : typeof align === 'number' ? align : null;
  if (w === null) {
    const a = tx * tx, b = ty * ty;
    w = a / (a + b);
  }
  return Math.atan2(ay * w + by * (1 - w), ax * w + bx * (1 - w));
}

// Give every ribbon sample its strip angle .sa, averaged over `span` px of river so
// the strips turn gradually through bends.
function fieldAngles(rb, align, span = 120) {
  const raw = rb.pts.map((p) => stripAngle(p.ang, align));
  const P = rb.pts;
  let j0 = 0, j1 = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) {
    while (j1 < P.length && P[j1].s <= P[i].s + span / 2) { cx += Math.cos(raw[j1] * 2); cy += Math.sin(raw[j1] * 2); j1++; }
    while (P[j0].s < P[i].s - span / 2) { cx -= Math.cos(raw[j0] * 2); cy -= Math.sin(raw[j0] * 2); j0++; }
    // Angles are averaged doubled: strips have no head or tail.
    let a = Math.atan2(cy, cx) / 2;
    if (Math.cos(a) < 0) a += Math.PI;
    if (a > Math.PI / 2) a -= Math.PI;
    P[i].sa = a;
  }
}

// A strip that bends with the direction field: its centre line is traced through the
// river from texture point (u, v), hl screen px each way, then given a tapered width.
function fieldStrip(rb, u, v, hl, th, { taper = 0.6, lean = 0.5, bow = 0, amp = 0, wave = 200, phase = 0 } = {}) {
  const step = 7;
  const line = [];
  for (const dir of [-1, 1]) {
    let uu = u, vv = v, gone = 0;
    const side = [];
    while (gone < hl) {
      const q = atU(rb, uu);
      const d = angDiff(q.sa, q.ang);
      const ds = Math.min(step, hl - gone);
      uu += (dir * Math.cos(d) * ds) / q.us;
      vv += (dir * Math.sin(d) * ds * rb.texH) / q.w;
      gone += ds;
      side.push([uu, vv]);
    }
    if (dir < 0) line.push(...side.reverse(), [u, v]);
    else line.push(...side);
  }
  const C = line.map(([a, b]) => project(rb, a, b));
  const top = [], bot = [];
  const n = C.length - 1;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n, i + 1)];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const p = Math.pow(Math.sin(Math.PI * k), taper);
    const c = bow * (1 - (2 * k - 1) ** 2) + amp * Math.sin(k * hl * 2 / wave * TAU + phase);
    top.push([C[i].x + nx * (c - th * lean * p), C[i].y + ny * (c - th * lean * p)]);
    bot.push([C[i].x + nx * (c + th * (1 - lean) * p), C[i].y + ny * (c + th * (1 - lean) * p)]);
  }
  return [...top, ...bot.reverse()];
}

// Random strip of a tier, in its own frame (centred, lying along +x).
function tierStrip(rng, T) {
  const L = rng.range(...T.len), th = rng.range(...T.th);
  return sliver(-L / 2, L / 2, 0, th, {
    amp: rng.range(0, th * 0.5), wave: L * rng.range(0.6, 1.4), phase: rng.range(0, TAU),
    bow: rng.range(...(T.bow ?? [0, 0])) * th, taper: rng.range(0.4, 0.9), lean: rng.range(0.38, 0.62),
  });
}

// An atlas of loose strips cut from `kinds` ({ cols, len, th, bow, rim }), plus each
// cell's half length. light: bake light (default the scene's).
function stripAtlas(S, rng, pal, { name, count, kinds, res = 1, shadow = 2.4, hi = 0.4, light = null }) {
  const cells = [], half = [];
  for (let i = 0; i < count; i++) {
    const k = kinds[i % kinds.length];
    const pts = tierStrip(rng, k);
    const fill = vary(col(pal, rng.pick(k.cols)), rng, 0.04);
    const hx = Math.max(...pts.map((p) => Math.abs(p[0]))) + 2;
    const hy = Math.max(...pts.map((p) => Math.abs(p[1]))) + 2;
    cells.push({ hx, hy, draw: (c) => piece(c, pts, { fill, torn: { amp: 0.5, freq: 0.14, fine: 0.3, seed: i + 3 }, rim: k.rim ? { color: pal.foam, width: k.rim } : null }) });
    half.push(hx);
  }
  const opts = { name, res, mat: 'smooth', edge: { width: 1, hi, lo: 0.2, soft: 0 }, shadow: { blur: shadow } };
  if (light) opts.light = light;
  return { ...bakeAtlas(S, cells, opts), half };
}

// Chance that a strip at lateral position k (0..1 across) catches the light's sheen.
//   sheen  { v, width, amount }: centre and width across the river (0..1), peak chance
function sheenAt(sheen, k) {
  if (!sheen) return 0;
  const { v = 0.5, width = 0.35, amount = 0.7 } = sheen;
  return amount * smoothstep(width / 2, 0, Math.abs(k - v));
}

// The light's colours in place of the strip tiers, for strips that catch a sheen.
const sheenPalette = (pal) => ({ ...pal, base: mix(pal.light, pal.glow[1], 0.45), mid: mix(pal.light, pal.glow[1], 0.7), light: pal.glow[1], pale: pal.glow[2], foam: pal.glow[2] });

// Static bed of a river: deep water under tiers of strips laid by the direction field,
// darker along the banks, optional swirls around rocks.
function drawRiverBed(ctx, rb, clip, o) {
  const pal = o.palette;
  const rng = new RNG(`${o.seed}:bed`);
  const light = o.light;
  ctx.save();
  ctx.clip(clip);
  ctx.fillStyle = pal.deep;
  ctx.fill(clip);
  const P = rb.pts, g0 = P[0].g, g1 = P[P.length - 1].g;
  const tiers = o.tiers ?? [
    { cols: ['base', 'base', 'mid'], cover: 1.1, len: [220, 600], th: [10, 22], bow: [0, 0.3], hi: 0.1 },
    { cols: ['mid', 'mid', 'light'], cover: 0.7, len: [160, 460], th: [7, 15], bow: [0, 0.4], hi: 0.2 },
    { cols: ['light', 'light', 'pale'], cover: 0.4, len: [110, 340], th: [5, 10], bow: [0, 0.5], hi: 0.35 },
    { cols: ['pale', 'foam'], cover: 0.12, len: [60, 220], th: [3.5, 7], bow: [0, 0.6], rim: true, hi: 0.4 },
  ];
  const gold = sheenPalette(pal);
  tiers.forEach((T, ti) => {
    const mLen = (T.len[0] + T.len[1]) / 2, mTh = (T.th[0] + T.th[1]) / 2;
    const n = Math.round((T.cover * o.density * rb.area) / (mLen * mTh * 0.7 * rb.meanSc2));
    sheet(ctx, (add) => {
      for (let i = 0; i < n; i++) {
        const u = uAtSig(rb, rng.range(-30 * g0, rb.sigLength + 30 * g1)), v = rng.range(-8, rb.texH + 8);
        const q = atU(rb, u);
        const sc = q.sc;
        const L = rng.range(...T.len) * sc, th = rng.range(...T.th) * sc;
        const pts = fieldStrip(rb, u, v, L / 2, th, {
          taper: rng.range(0.4, 0.9), lean: rng.range(0.38, 0.62), bow: rng.range(...T.bow) * th,
          amp: rng.range(0, th * 0.2), wave: L * rng.range(0.6, 1.4), phase: rng.range(0, TAU),
        });
        const lit = ti > 0 && rng.chance(sheenAt(o.sheen, v / rb.texH));
        add(pts, {
          fill: vary(col(lit ? gold : pal, rng.pick(T.cols)), rng, 0.05),
          torn: th > 7 ? stripTear(0.8, rng.int(1, 1e6)) : null,
          rim: T.rim ? { color: pal.foam, width: 0.55 } : null,
        });
      }
    }, tierLook(pal, light, { drop: 2.4, blur: 2.4, alpha: 0.6, hi: T.hi ?? 0.3 }));
  });
  for (const sw of o.swirls ?? []) drawEddy(ctx, sw.x, sw.y, sw.r, { palette: pal, seed: rng.int(1, 1e6), light, ...sw });
  // Banks: the water darkens where it slides under them (three stepped strokes).
  const bank = o.bank ?? 14;
  ctx.lineJoin = 'round';
  for (const k of [1, 0.6, 0.3]) {
    ctx.strokeStyle = rgba(pal.deep, 0.3);
    ctx.lineWidth = bank * k;
    ctx.stroke(clip);
  }
  // Ends that melt into a lake or pool instead of stopping on a hard edge.
  [0, 1].forEach((end) => {
    const px = o.blend?.[end];
    if (!px) return;
    const p = end ? P[P.length - 1] : P[0];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang + (end ? Math.PI : 0));
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = linear(ctx, 0, 0, px, 0, ['rgba(0,0,0,1)', 'rgba(0,0,0,0)']);
    ctx.fillRect(-p.w, -p.w, px + p.w, p.w * 2);
    ctx.restore();
  });
  ctx.restore();
}

// A flowing river along `path`: a static bed of layered strips with loose strips
// riding the current on top, all lying near horizontal (see stripAngle).
//   z            plane depth
//   path         centre line, control points [[x, y], ...] in the flow direction
//   width        px: number, one per control point, or (k) => px
//   palette      WATER.* (default night)
//   speed        flow speed in texture px per second (screen speed grows with width)
//   texH         texture px across the river: smaller = bigger strips (default 240)
//   align        strip orientation, see stripAngle (default 'auto')
//   density      bed strip density multiplier
//   smooth       px of river over which the strip direction is averaged (default 220)
//   current      coverage of the moving strips (default 0.3)
//   sheen        { v, width, amount } band across the river (0..1) whose strips take the
//                light's colours, like the sun's path on ref10's river
//   swirls       [{ x, y, r, flat, rings, spin }] painted into the bed
//   tiers        override the bed's strip tiers [{ cols, cover, len, th, bow, rim, hi }]
//   blend        [start, end] px over which the river melts away at its ends (into a lake)
//   fade         [in, out] texture px over which moving strips fade at the ends (default
//                from blend, else 80)
//   torn         bank raggedness in px (default 3); bank: dark bank band width
//   res          bake resolution of the bed
//   alpha, order layer options
// Returns { layers, ribbon, clip } so callers can place rapids along the same ribbon.
export function addRiver(S, opts) {
  const o = { z: 1300, palette: WATER.night, speed: 34, texH: 240, align: 'auto', smooth: 220, persp: 0.5, density: 1, current: 0.2, torn: 3, seed: 'river', order: 0, ...opts };
  const pal = o.palette;
  const L = S.light;
  const rb = ribbon(o.path, { width: o.width ?? 160, texH: o.texH });
  fieldAngles(rb, o.align, o.smooth);
  warp(rb, o.persp);
  const shape = o.torn ? tear(outline(rb), { amp: o.torn, freq: 0.05, fine: 0.8, seed: 5 }) : outline(rb);
  const clip = pathOf(shape);
  const xs = shape.map((p) => p[0]), ys = shape.map((p) => p[1]);
  const bx = Math.min(...xs) - 4, by = Math.min(...ys) - 4;
  const bed = S.sprite({
    name: 'river-bed', x: bx, y: by, w: Math.max(...xs) - bx + 4, h: Math.max(...ys) - by + 4, res: o.res ?? 1, mat: 'smooth', edge: false, shadow: false,
    draw: (ctx) => drawRiverBed(ctx, rb, clip, { ...o, light: L }),
  });

  // Moving strips: atlases of variants (plain, and gilded for the sheen), each placed
  // many times.
  const rng = new RNG(o.seed);
  const maxScale = Math.max(...rb.pts.map((p) => p.sc));
  const kinds = [
    { cols: ['light', 'pale'], len: [70, 200], th: [4, 9], bow: [0, 0.4] },
    { cols: ['pale', 'foam'], len: [50, 140], th: [3, 6], bow: [0, 0.5], rim: 0.55 },
    { cols: ['mid', 'light'], len: [90, 240], th: [6, 12], bow: [0, 0.4] },
  ];
  const atlasOpts = { count: 30, res: clamp(maxScale * 1.1, 1, 2.4), shadow: 2.4, kinds };
  const pools = [stripAtlas(S, rng, pal, { name: 'river-strip', ...atlasOpts })];
  if (o.sheen) pools.push(stripAtlas(S, rng, sheenPalette(pal), { name: 'river-sheen', ...atlasOpts, count: 18 }));
  const lists = pools.map(() => []);
  const n = Math.round((o.current * rb.area) / (140 * 7 * 0.7 * rb.meanSc2));
  for (let i = 0; i < n; i++) {
    const v = rng.range(0, o.texH);
    const which = rng.chance(sheenAt(o.sheen, v / o.texH)) ? 1 : 0;
    const cell = rng.int(0, pools[which].cells.length - 1);
    lists[which].push({ cell, hl: pools[which].half[cell], p: rng.next(), v, speed: rng.range(0.85, 1.25), flip: rng.chance(0.5) });
  }
  const P = rb.pts, ends = [P[0], P[P.length - 1]];
  const fade = o.fade ?? ends.map((p, i) => Math.max(80, (o.blend?.[i] ?? 0) / p.us));
  const sh = { ...away(L, 2.4), alpha: 0.5 };
  const layer = S.add({
    name: 'river', z: o.z, order: o.order, alpha: o.alpha,
    render(ctx, t) {
      ctx.drawImage(bed.canvas, bed.x, bed.y, bed.w, bed.h);
      pools.forEach((pool, i) => drawAtlas(ctx, pool, riders(rb, lists[i], t * o.speed, { orient: 'field', fade }), sh));
    },
  });
  return { layers: [layer], ribbon: rb, clip };
}

// --- Waterfall -----------------------------------------------------------------------------

// Seamless texture for falling water: lengthwise bands whose edges wobble, streaks
// inside them, a few strips ending in torn points, and spray dots.
function paintFallTexture(ctx, wrap, { period, h, pal, rng, light, streaks, order }) {
  const W = period + 200;
  const n = order.length;
  const weights = order.map(() => rng.range(0.7, 1.4));
  const sum = weights.reduce((a, b) => a + b, 0);
  // Band boundaries, each wobbling with an exactly periodic curve.
  const bounds = [];
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const edgeBand = i === 0 || i === n;
    bounds.push({ v: (acc / sum) * h, harm: [1, 2, 3, 5].map((j) => ({ j, a: edgeBand ? 0 : rng.range(0.4, 1.8) * (h / 110), p: rng.range(0, TAU) })) });
    if (i < n) acc += weights[i];
  }
  const vAt = (b, u) => b.v + b.harm.reduce((s, q) => s + q.a * Math.sin((TAU * q.j * u) / period + q.p), 0);
  const sOff = away(light, 1.8);
  // Paint in the order that lets each band's shadow fall on bands already down.
  const asc = sOff.dy <= 0;
  const idx = [...Array(n).keys()];
  if (!asc) idx.reverse();
  ctx.fillStyle = pal.deep;
  ctx.fillRect(-20, -20, W + 40, h + 40);
  for (const i of idx) {
    const top = [], bot = [];
    for (let u = -20; u <= W + 20; u += 6) {
      top.push([u, vAt(bounds[i], u) - (asc ? 0 : 1.2)]);
      bot.push([u, vAt(bounds[i + 1], u) + (asc ? 1.2 : 0)]);
    }
    piece(ctx, [...top, ...bot.reverse()], {
      fill: vary(col(pal, order[i]), rng, 0.04),
      shadow: { color: rgba(pal.shadow, 0.4), blur: 2.5, x: sOff.dx, y: sOff.dy },
      bevel: { light, width: 1.2, hi: 0.35, lo: 0.16, hiColor: '#ffffff' },
    });
  }
  // Streaks and pointed strips within the bands, then spray dots, on two sheets.
  const count = Math.round(((period * h) / 4000) * streaks);
  sheet(ctx, (add) => {
    for (let i = 0; i < count; i++) {
      const u0 = rng.range(0, period), Ls = rng.range(period * 0.15, period * 0.7);
      const v = rng.range(3, h - 3), th = rng.range(1.2, 4) * (h / 110);
      const base = rng.pick(order);
      const fill = rng.chance(0.6) ? mix(col(pal, base), pal.foam, rng.range(0.35, 0.85)) : shade(col(pal, base), -rng.range(0.08, 0.2));
      const pts = sliver(u0, u0 + Ls, v, th, { amp: rng.range(0, 1.5), wave: rng.range(80, 240), phase: rng.range(0, TAU), taper: rng.range(0.6, 1) });
      wrap(u0 - 8, u0 + Ls + 8, (o) => add(pts.map(([pu, pv]) => [pu + o, pv]), { fill, torn: { amp: 0.4, freq: 0.15, seed: i + 1, step: 7 } }));
    }
  }, tierLook(pal, light, { drop: 1.2, blur: 1.8, alpha: 0.45, hi: 0.4 }));
  const dots = Math.round((period * h) / 2400);
  for (let i = 0; i < dots; i++) {
    const u = rng.range(0, period), v = rng.range(4, h - 4), r = rng.range(0.6, 1.6);
    const a = rng.range(0.6, 0.95);
    wrap(u - 3, u + 3, (o) => { ctx.fillStyle = rgba(pal.foam, a); ctx.beginPath(); ctx.arc(u + o, v, r, 0, TAU); ctx.fill(); });
  }
}

// A waterfall: a falling sheet of banded strips, white streaks racing down it, a
// rounded lip, a drop shadow on the cliff behind, and (by default) churning foam and
// mist at the base.
//   z              plane depth
//   path           centre line from the lip to the base; or give x, top, bottom (+ lip)
//   x, top, bottom straight fall
//   lip            px the sheet travels sideways over the edge before it drops (sign = direction)
//   width          px: number, [top, bottom], one per control point, or (k) => px
//   palette        WATER.* (default canyon)
//   speed          fall speed in texture px per second
//   texH           texture px across the sheet (default = widest width, i.e. 1:1)
//   accel          how much streaks stretch and speed up toward the base (default 0.6)
//   round          px over which the lip is rounded (default 30% of the top width)
//   streaks        streak density multiplier
//   shadow         { alpha, dist } drop shadow on what is behind (false: none)
//   foam           addFoam options for the base (false: none); mist: addMist options (false: none)
//   alpha, order   layer options
export function addWaterfall(S, opts) {
  const o = { z: 1200, palette: WATER.canyon, speed: 120, accel: 0.6, streaks: 1, seed: 'fall', order: 0, shadow: {}, ...opts };
  const pal = o.palette;
  let path = o.path;
  if (!path) {
    const lip = o.lip ?? 0;
    const H = o.bottom - o.top;
    path = lip
      ? [[o.x - lip, o.top], [o.x - lip * 0.25, o.top + H * 0.08], [o.x, o.top + H * 0.3], [o.x, o.bottom]]
      : [[o.x, o.top], [o.x, o.top + H * 0.5], [o.x, o.bottom]];
  }
  let width = o.width ?? 110;
  if (Array.isArray(width) && width.length === 2 && path.length !== 2) {
    const [w0, w1] = width;
    width = (k) => lerp(w0, w1, k);
  }
  const wMax = typeof width === 'number' ? width : Array.isArray(width) ? Math.max(...width) : Math.max(width(0), width(1));
  const texH = o.texH ?? Math.max(40, Math.round(wMax));
  const rb = ribbon(path, { width, texH, uScale: (k) => 1 + o.accel * k, step: 5 });
  const period = o.period ?? 520;
  const rng = new RNG(o.seed);
  const light = toTexFrame(rb, S.light);
  const res = clamp((wMax / texH) * 1.2, 1, 2.2);
  // Narrow falls get fewer bands, picked evenly so both edges keep their colours.
  const all = o.bands ?? pal.fall;
  const nb = clamp(Math.round(wMax / (o.bandWidth ?? 16)), 3, 14);
  const order = Array.from({ length: nb }, (_, i) => (nb <= all.length ? all[Math.round((i * (all.length - 1)) / (nb - 1))] : all[i % all.length]));
  const tex = flowTexture({
    period, h: texH, res, seed: o.seed,
    paint: (ctx, wrap) => paintFallTexture(ctx, wrap, { period, h: texH, pal, rng: rng.fork('tex'), light, streaks: o.streaks, order }),
  });
  const shape = tear(outline(rb, { round: o.round ?? rb.pts[0].w * 0.3 }), { amp: 1.2, freq: 0.08, fine: 0.5, seed: 9 });
  const clip = pathOf(shape);
  const layers = [];

  // Silhouette for the drop shadow and the mask, and the lit cut edge around the sheet.
  const xs = shape.map((p) => p[0]), ys = shape.map((p) => p[1]);
  const bx = Math.floor(Math.min(...xs) - 4), by = Math.floor(Math.min(...ys) - 4);
  const bw = Math.ceil(Math.max(...xs) - bx + 4), bh = Math.ceil(Math.max(...ys) - by + 4);
  const sil = o.shadow ? S.sprite({
    name: 'fall-shadow', x: bx, y: by, w: bw, h: bh, mat: 'none', edge: false, shadow: { blur: 9 },
    draw: (ctx) => { ctx.fillStyle = '#000'; ctx.fill(clip); },
  }) : null;
  const rim = S.sprite({
    name: 'fall-rim', x: bx, y: by, w: bw, h: bh, mat: 'none', edge: false, shadow: false, res: 1.5,
    draw: (ctx) => bevelBands(ctx, clip, { light: S.light, width: 2, hi: 0.5, lo: 0.3, hiColor: '#ffffff', soft: 0.6 }),
  });
  // The sheet is composed off screen each frame and masked by its silhouette, which is
  // much cheaper than clipping every slice to the torn outline.
  const fres = o.res ?? 1.25;
  const off = surface(bw * fres, bh * fres);
  const mask = surface(bw * fres, bh * fres);
  mask.ctx.setTransform(fres, 0, 0, fres, -bx * fres, -by * fres);
  mask.ctx.fill(clip);

  // Streaks and droplets racing down the sheet.
  const pool = stripAtlas(S, rng, pal, {
    name: 'fall-streak', count: 18, res, shadow: 1.8, hi: 0.3, light,
    kinds: [
      { cols: ['foam', 'pale'], len: [24, 90], th: [1.2, 2.6] },
      { cols: ['foam'], len: [12, 36], th: [1.4, 3] },
      { cols: ['pale', 'light'], len: [40, 120], th: [2, 4] },
    ],
  });
  const n = Math.round(((rb.uLength * texH) / 3200) * o.streaks);
  const items = [];
  for (let i = 0; i < n; i++) items.push({ cell: rng.int(0, pool.cells.length - 1), p: rng.next(), v: rng.range(texH * 0.04, texH * 0.96), speed: rng.range(1.15, 1.7), flip: rng.chance(0.5) });

  const sh = S.shadowOffset;
  const streakShadow = { ...away(S.light, 1.2), alpha: 0.35 };
  layers.push(S.add({
    name: 'waterfall', z: o.z, order: o.order, alpha: o.alpha,
    render(ctx, t) {
      if (sil) drawShadowOnly(ctx, sil, { dx: sh.dx * (o.shadow.dist ?? 1), dy: sh.dy * (o.shadow.dist ?? 1), alpha: o.shadow.alpha ?? 0.5 });
      const g = off.ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, off.canvas.width, off.canvas.height);
      g.setTransform(fres, 0, 0, fres, -bx * fres, -by * fres);
      drawSlices(g, rb, tex, t * o.speed);
      drawAtlas(g, pool, riders(rb, items, t * o.speed), streakShadow);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask.canvas, 0, 0);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(off.canvas, bx, by, bw, bh);
      ctx.drawImage(rim.canvas, rim.x, rim.y, rim.w, rim.h);
    },
  }));

  const end = rb.pts[rb.pts.length - 1];
  if (o.mist !== false) {
    layers.push(...addMist(S, { z: o.z, order: o.order + 0.005, x: end.x, y: end.y - end.w * 0.1, w: end.w * 1.7, h: end.w * 0.9, seed: `${o.seed}:mist`, alpha: o.alpha, ...(o.mist || {}) }));
  }
  if (o.foam !== false) {
    layers.push(...addFoam(S, { z: o.z, order: o.order + 0.01, x: end.x, y: end.y, w: end.w * 1.6, h: end.w * 0.45, palette: pal, seed: `${o.seed}:foam`, alpha: o.alpha, ...(o.foam || {}) }));
  }
  return { layers, ribbon: rb, clip };
}

// --- Foam -----------------------------------------------------------------------------------

// One foam puff: a cluster of round paper bumps, flat white with cool creases where
// they overlap (waterfall bases in ref04 / ref10).
//   bumps   number of bumps; flat: height / width of the cluster
export function drawFoamPuff(ctx, x, y, r, { palette = WATER.canyon, seed = 1, light = [0.4, -0.9], bumps = 6, flat = 0.6 } = {}) {
  const rng = new RNG(seed);
  const pal = palette;
  const crease = { color: rgba(pal.foamShade, 0.75), blur: Math.max(1.5, r * 0.06), x: -light[0] * r * 0.03, y: r * 0.05 };
  const torn = (k) => ({ amp: Math.max(0.5, r * 0.025), freq: 0.22, fine: 0.4, seed: seed * 7 + k });
  const bevel = { light, width: Math.max(1, r * 0.04), hi: 0.55, lo: 0.1, hiColor: '#ffffff', soft: 0.4 };
  const list = [];
  for (let i = 0; i < bumps; i++) {
    const a = Math.PI * (1.02 + (i / Math.max(1, bumps - 1)) * 0.96) + rng.range(-0.15, 0.15);
    const rr = r * rng.range(0.26, 0.52);
    list.push({ x: x + Math.cos(a) * r * rng.range(0.45, 0.75), y: y + Math.sin(a) * r * flat * rng.range(0.35, 0.8), r: rr });
  }
  for (let i = 0; i < 3; i++) list.push({ x: x + rng.range(-0.6, 0.6) * r, y: y + r * rng.range(0.05, 0.22), r: r * rng.range(0.28, 0.46) });
  list.sort((a, b) => a.y - b.y);
  list.forEach((b, i) => {
    const fill = linear(ctx, b.x - b.r * 0.5, b.y - b.r, b.x + b.r * 0.3, b.y + b.r, ['#ffffff', pal.foam, mix(pal.foam, pal.foamShade, 0.7)]);
    piece(ctx, ellipse(b.x, b.y, b.r, b.r * rng.range(0.82, 0.95), 28), { fill, torn: torn(i), shadow: crease, bevel });
  });
}

// The flat white water a foam bank sits in: a torn white lens streaked with pale blue.
//   (x, y) centre, w / h extent
export function drawFoamBed(ctx, x, y, w, h, { palette = WATER.canyon, seed = 1, light = [0.4, -0.9] } = {}) {
  const pal = palette;
  const rng = new RNG(seed);
  piece(ctx, sliver(x - w / 2, x + w / 2, y, h, { taper: 0.3, lean: 0.55, amp: h * 0.08, wave: w * 0.6 }), {
    fill: linear(ctx, 0, y - h * 0.55, 0, y + h * 0.45, ['#ffffff', pal.foam, mix(pal.foam, pal.foamShade, 0.6)]),
    torn: { amp: h * 0.1, freq: 0.09, fine: 0.8, seed },
    shadow: { color: rgba(pal.shadow, 0.3), blur: 3, x: -light[0] * 2, y: 2 },
  });
  const n = Math.max(3, Math.round(w / 40));
  for (let i = 0; i < n; i++) {
    const L = w * rng.range(0.15, 0.4), cx = x + rng.range(-0.4, 0.4) * w, cy = y + rng.range(-0.1, 0.35) * h;
    strip(ctx, sliver(cx - L / 2, cx + L / 2, cy, h * rng.range(0.06, 0.14), { taper: 0.8, amp: h * 0.04, wave: L }), {
      fill: rng.pick([pal.pale, pal.light, mix(pal.pale, pal.foam, 0.5)]), light, shadowColor: rgba(pal.shadow, 0.25), drop: 1, blur: 1.5, hi: 0.3, lo: 0.1, torn: 0.4, seed: rng.int(1, 1e6),
    });
  }
}

// Churning foam: rows of puffs that breathe, bob, rise and sink on their own cycles,
// plus spray droplets thrown up and falling back.
//   z, x, y      centre of the foam bank;  w, h  its extent
//   count        number of puffs (default from w);  size  puff radius multiplier
//   flat         puff height / width (default 0.6; lower for a splash of torn white)
//   bed          false: no flat white water under the puffs
//   palette, seed, churn (motion amount, default 1), spray (droplet count)
//   alpha, order layer options
export function addFoam(S, opts) {
  const o = { z: 1200, palette: WATER.canyon, seed: 'foam', churn: 1, size: 1, flat: 0.6, order: 0, ...opts };
  const { x, y, w, h } = o;
  const rng = new RNG(o.seed);
  const L = S.light;
  const count = o.count ?? Math.max(4, Math.round(w / 24));
  const rows = [[], [], []];
  const cells = [];
  const rBase = Math.max(8, Math.min(w / 5, h * 0.9)) * o.size;
  for (let i = 0; i < count; i++) {
    const row = i % 3;
    const k = (i + rng.range(-0.4, 0.4)) / Math.max(1, count - 1);
    const px = x - w / 2 + w * clamp(k, 0.03, 0.97);
    const py = y + (row - 1) * h * 0.3 + rng.range(-h * 0.08, h * 0.08);
    // Big puffs in the middle where the water lands, smaller ones toward the sides.
    const edge = 1 - Math.pow(Math.abs(px - x) / (w / 2), 1.6) * 0.6;
    const r = rBase * (0.65 + row * 0.18) * edge * rng.range(0.75, 1.25);
    const sd = rng.int(1, 1e6), bumps = rng.int(5, 7);
    cells.push({ hx: r * 1.3, hy: r * 1.1, draw: (ctx) => drawFoamPuff(ctx, 0, 0, r, { palette: o.palette, seed: sd, light: L, bumps, flat: o.flat }) });
    rows[row].push({ cell: i, ax: px, ay: py + r * 0.5, r, p1: rng.range(1.5, 2.7), p2: rng.range(2.6, 4.2), ph: rng.next(), rise: rng.chance(0.4) ? rng.range(0.6, 1) : 0 });
  }
  const atlas = bakeAtlas(S, cells, {
    name: 'foam', mat: [{ tex: 'crumple', amt: 0.6, scale: 0.3 }, { tex: 'fiber', amt: 0.5 }],
    res: o.res ?? 1.25, edge: { width: 1.3, hi: 0.35, lo: 0.15 }, shadow: { blur: Math.max(3, rBase * 0.16) },
  });
  const drops = [];
  const spray = o.spray ?? Math.round(w / 6);
  for (let i = 0; i < spray; i++) {
    drops.push({ x: x + rng.range(-w * 0.45, w * 0.45), vx: rng.range(-1, 1) * w * 0.25, up: rng.range(0.4, 1.1) * h * 1.6, r: rng.range(0.8, 2.2), period: rng.range(0.9, 1.8), ph: rng.next() });
  }
  const dot = S.sprite({
    name: 'spray', x: -3, y: -3, w: 6, h: 6, mat: 'none', edge: false, shadow: false,
    draw: (ctx) => { ctx.fillStyle = o.palette.foam; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill(); },
  });
  const bed = o.bed === false ? null : S.sprite({
    name: 'foam-bed', x: x - w * 0.6, y: y - h * 0.5, w: w * 1.2, h: h * 1.4,
    mat: [{ tex: 'crumple', amt: 0.6, scale: 0.3 }, { tex: 'fiber', amt: 0.5 }], edge: { width: 1.2, hi: 0.35, lo: 0.15 }, shadow: { blur: 4, alpha: 0.4 },
    draw: (ctx) => drawFoamBed(ctx, x, y + h * 0.18, w * 1.05, h * 0.5, { palette: o.palette, seed: rng.int(1, 1e6), light: L }),
  });
  const sh = { ...away(L, 3), alpha: 0.42 };
  const churn = o.churn;
  return [S.add({
    name: 'foam', z: o.z, order: o.order, alpha: o.alpha,
    render(ctx, t) {
      if (bed) drawSprites(ctx, [{ s: bed, ax: x, ay: y + h * 0.4, sx: 1 + 0.015 * Math.sin(TAU * t / 2.3) * churn, sy: 1 + 0.04 * Math.sin(TAU * t / 1.7) * churn }], sh);
      const base = ctx.globalAlpha;
      for (const d of drops) {
        const f = (((t / d.period + d.ph) % 1) + 1) % 1;
        ctx.globalAlpha = base * Math.sin(Math.PI * f) * 0.9;
        ctx.drawImage(dot.canvas, d.x + d.vx * f - d.r, y - d.up * 4 * f * (1 - f) - d.r, d.r * 2, d.r * 2);
      }
      ctx.globalAlpha = base;
      // Each row is its own pass so nearer puffs shadow the ones behind.
      for (const row of rows) {
        drawAtlas(ctx, atlas, row.map((p) => {
          const a = TAU * (t / p.p1 + p.ph), b = TAU * (t / p.p2 + p.ph * 1.7);
          const lift = p.rise * Math.max(0, Math.sin(b)) * churn;
          const k = 1 + (0.07 * Math.sin(a) + 0.12 * lift) * churn;
          const ky = k * (1 + 0.04 * Math.sin(a + 2) * churn);
          return {
            cell: p.cell, sx: k, sy: ky,
            x: p.ax + Math.sin(a * 0.7 + 1) * p.r * 0.06 * churn,
            y: p.ay - p.r * 0.5 * ky - (Math.sin(a + 0.8) * p.r * 0.05 + lift * p.r * 0.35) * churn,
          };
        }), sh);
      }
    },
  })];
}

// Soft mist over a fall's base: blurred white clouds that swell, drift up and fade.
//   z, x, y, w, h, count, strength (default 0.32), color, seed
export function addMist(S, opts) {
  const o = { z: 1200, seed: 'mist', strength: 0.32, color: '#eef4fa', order: 0, ...opts };
  const rng = new RNG(o.seed);
  const blob = S.sprite({
    name: 'mist', x: -64, y: -64, w: 128, h: 128, mat: 'none', edge: false, shadow: false,
    draw: (ctx) => { ctx.fillStyle = radial(ctx, 0, 0, 0, 64, [[0, rgba(o.color, 1)], [0.5, rgba(o.color, 0.45)], [1, rgba(o.color, 0)]]); ctx.fillRect(-64, -64, 128, 128); },
  });
  const count = o.count ?? Math.max(4, Math.round(o.w / 30));
  const puffs = [];
  for (let i = 0; i < count; i++) {
    puffs.push({ x: o.x + rng.range(-0.45, 0.45) * o.w, y: o.y + rng.range(-0.2, 0.3) * o.h, r: rng.range(0.35, 0.7) * o.h, drift: rng.range(-0.15, 0.15) * o.w, rise: rng.range(0.5, 1.1) * o.h, period: rng.range(3, 5.5), ph: rng.next() });
  }
  return [S.add({
    name: 'mist', z: o.z, order: o.order, alpha: o.alpha, blend: 'screen',
    render(ctx, t) {
      const base = ctx.globalAlpha;
      for (const p of puffs) {
        const f = (((t / p.period + p.ph) % 1) + 1) % 1;
        ctx.globalAlpha = base * o.strength * Math.sin(Math.PI * f);
        const r = p.r * (0.7 + 0.7 * f);
        ctx.drawImage(blob.canvas, p.x + p.drift * f - r, p.y - p.rise * f - r * 0.7, r * 2, r * 1.4);
      }
      ctx.globalAlpha = base;
    },
  })];
}

// --- Rapids ------------------------------------------------------------------------------------

// White water hugging a rock at the waterline: a torn foam collar (thicker on the
// upstream side) and bow-wave arcs curving around it. Drawn behind the rock.
//   (x, y) rock centre at the waterline, rx / ry its radii; angle: flow direction
export function drawRapid(ctx, x, y, rx, ry, { angle = Math.PI / 2, thick = 9, rings = 2, palette = WATER.canyon, seed = 1, light = [0.4, -0.9] } = {}) {
  const pal = palette;
  const rng = new RNG(seed);
  const up = angle + Math.PI;
  const ring = (k, t0, t1, fill, rim, span = Math.PI * 0.95) => {
    const outer = [], inner = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const f = i / n, a = up - span + 2 * span * f;
      const taper = Math.pow(Math.sin(Math.PI * f), 0.7);
      // Thickest facing upstream, thinning around the sides.
      const face = 0.55 + 0.45 * Math.cos(a - up);
      const c = Math.cos(a), s = Math.sin(a);
      const ro = k + t1 * thick * taper * face, ri = k + t0 * thick * taper * face;
      outer.push([x + c * (rx + ro), y + s * (ry + ro * 0.55)]);
      inner.push([x + c * (rx + ri), y + s * (ry + ri * 0.55)]);
    }
    strip(ctx, [...outer, ...inner.reverse()], { fill, light, shadowColor: rgba(pal.shadow, 0.45), drop: 1.8, blur: 2.4, hi: 0.45, lo: 0.15, rim: rim ? 0.6 : 0, rimColor: '#ffffff', torn: thick * 0.12, seed: rng.int(1, 1e6) });
  };
  for (let i = rings; i >= 1; i--) ring(thick * (0.8 + i * 1.2), 0, 0.45, i % 2 ? pal.light : pal.pale, false, Math.PI * (0.55 - i * 0.05));
  ring(-thick * 0.6, 0, 1.1, pal.foam, true, Math.PI * 0.98);
}

// Foam churned up at a rock's downstream foot: a short torn white lip along the
// waterline and a few small puffs.
export function drawWake(ctx, x, y, rx, ry, { angle = Math.PI / 2, thick = 4, puffs = 2, palette = WATER.canyon, seed = 1, light = [0.4, -0.9] } = {}) {
  const pal = palette;
  const rng = new RNG(seed);
  const c = Math.cos(angle), s = Math.sin(angle);
  const lip = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = angle - 1.2 + (2.4 * i) / n;
    lip.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  for (let i = n; i >= 0; i--) {
    const a = angle - 1.2 + (2.4 * i) / n;
    const t = Math.sin((Math.PI * i) / n) * thick;
    lip.push([x + Math.cos(a) * (rx + t), y + Math.sin(a) * (ry + t * 0.8)]);
  }
  strip(ctx, lip, { fill: pal.foam, light, shadowColor: rgba(pal.shadow, 0.4), drop: 1.5, blur: 2, hi: 0.4, lo: 0.1, rim: 0.4, rimColor: '#ffffff', torn: thick * 0.25, seed: rng.int(1, 1e6) });
  for (let i = 0; i < puffs; i++) {
    const k = (i + 0.5) / puffs - 0.5;
    const r = Math.max(5, ry * rng.range(0.4, 0.55));
    // Spread along the waterline around the downstream point of the rock.
    const a = angle + k * 1.6;
    drawFoamPuff(ctx, x + Math.cos(a) * rx * 0.95, y + Math.sin(a) * ry * 0.95 + r * 0.2, r, { palette: pal, seed: rng.int(1, 1e6), light, bumps: 4, flat: 0.5 });
  }
}

// White water around rocks in a current: collars and bow waves behind each rock, torn
// foam trailing in front of it, all breathing with the flow.
//   z         plane of the collars (just behind the rocks)
//   zFront    plane of the trailing foam (just in front of the rocks; default z - 40)
//   rocks     [{ x, y, rx, ry, thick, rings, puffs }] rock centres and radii at the waterline
//   angle     flow direction (radians, default PI/2 = toward the viewer)
//   palette, seed, thick (foam px), rings (bow waves), wake (false: no trailing foam)
export function addRapids(S, opts) {
  const o = { z: 1150, palette: WATER.canyon, angle: Math.PI / 2, thick: 9, rings: 0, seed: 'rapids', order: 0, wake: true, ...opts };
  const zFront = o.zFront ?? o.z - 40;
  const rng = new RNG(o.seed);
  const L = S.light;
  const back = [], front = [];
  for (const r of o.rocks) {
    const rx = r.rx ?? r.r, ry = r.ry ?? rx * 0.5;
    const thick = r.thick ?? o.thick, rings = r.rings ?? o.rings;
    const pad = thick * (3 + rings * 1.6) + 12;
    const sd = rng.int(1, 1e6);
    const s = S.sprite({
      name: 'rapid', x: r.x - rx - pad, y: r.y - ry - pad, w: (rx + pad) * 2, h: (ry + pad) * 2,
      mat: 'smooth', res: 1.25, edge: { width: 1, hi: 0.3, lo: 0.2 }, shadow: { blur: 3, alpha: 0.4 },
      draw: (ctx) => drawRapid(ctx, r.x, r.y, rx, ry, { angle: o.angle, thick, rings, palette: o.palette, seed: sd, light: L }),
    });
    back.push({ s, ax: r.x, ay: r.y, period: rng.range(1.4, 2.4), ph: rng.next() });
    if (o.wake) {
      const sw = rng.int(1, 1e6);
      const wpad = Math.max(rx, ry) * 2.2 + 20;
      const ws = S.sprite({
        name: 'rapid-wake', x: r.x - wpad, y: r.y - wpad, w: wpad * 2, h: wpad * 2, mat: 'smooth', res: 1.25,
        edge: { width: 0.8, hi: 0.3, lo: 0.15 }, shadow: { blur: 2, alpha: 0.4 },
        draw: (ctx) => drawWake(ctx, r.x, r.y, rx, ry, { angle: o.angle, puffs: r.puffs ?? 2, thick: thick * 0.6, palette: o.palette, seed: sw, light: L }),
      });
      front.push({ s: ws, ax: r.x, ay: r.y, period: rng.range(1.1, 2), ph: rng.next() });
    }
  }
  const sh = away(L, 2.4);
  const breathe = (list, ka, kb) => (t) => list.map((b) => {
    const a = TAU * (t / b.period + b.ph);
    return { s: b.s, ax: b.ax, ay: b.ay, x: b.ax, y: b.ay, sx: 1 + ka * Math.sin(a), sy: 1 + kb * Math.sin(a + 0.9) };
  });
  const backAt = breathe(back, 0.04, 0.07), frontAt = breathe(front, 0.05, 0.1);
  return [
    S.add({ name: 'rapids', z: o.z, order: o.order, alpha: o.alpha, render: (ctx, t) => drawSprites(ctx, backAt(t), sh) }),
    S.add({ name: 'rapids-wake', z: zFront, order: o.order, alpha: o.alpha, render: (ctx, t) => drawSprites(ctx, frontAt(t), sh) }),
  ];
}

// --- Eddies ----------------------------------------------------------------------------------

// A swirl of nested arc strips, each ring turned a little further (ref04 river).
//   (x, y) centre, r outer radius, flat: ry / rx, rings, spin: radians the spiral turns
export function drawEddy(ctx, x, y, r, { flat = 0.36, rings = 6, spin = 1.4, palette = WATER.canyon, seed = 1, light = [0.4, -0.9] } = {}) {
  const pal = palette;
  const rng = new RNG(seed);
  const cols = ['base', 'mid', 'light', 'mid', 'pale', 'light', 'mid'];
  for (let i = rings - 1; i >= 0; i--) {
    const k = (i + 1) / rings;
    const rr = r * (0.2 + 0.8 * k);
    const a0 = spin * (1 - k) + rng.range(-0.15, 0.15) + Math.PI * 0.6;
    const span = Math.PI * lerp(1, 1.45, k) * rng.range(0.9, 1.1);
    const th = r * lerp(0.1, 0.16, k);
    const outer = [], inner = [];
    const n = 40;
    for (let j = 0; j <= n; j++) {
      const f = j / n, a = a0 + span * f;
      const taper = Math.pow(Math.sin(Math.PI * f), 0.55);
      outer.push([x + Math.cos(a) * (rr + th * 0.5 * taper), y + Math.sin(a) * (rr + th * 0.5 * taper) * flat]);
      inner.push([x + Math.cos(a) * (rr - th * 0.5 * taper), y + Math.sin(a) * (rr - th * 0.5 * taper) * flat]);
    }
    strip(ctx, [...outer, ...inner.reverse()], {
      fill: vary(col(pal, cols[i % cols.length]), rng, 0.04), light, shadowColor: rgba(pal.shadow, 0.45), drop: 1.8, blur: 2.2,
      hi: 0.4, lo: 0.14, rim: i === rings - 2 ? 0.5 : 0, rimColor: pal.foam, seed: rng.int(1, 1e6),
    });
  }
}

// Eddies that turn and breathe slowly on the spot.
//   z, eddies: [{ x, y, r, flat, rings, spin }], palette, seed
export function addEddies(S, opts) {
  const o = { z: 1290, palette: WATER.canyon, seed: 'eddy', order: 0, ...opts };
  const rng = new RNG(o.seed);
  const L = S.light;
  const items = o.eddies.map((e) => {
    const flat = e.flat ?? 0.4, sd = rng.int(1, 1e6);
    const s = S.sprite({
      name: 'eddy', x: e.x - e.r * 1.3, y: e.y - e.r * flat * 1.3 - 6, w: e.r * 2.6, h: e.r * flat * 2.6 + 12, mat: 'smooth', res: 1.25,
      edge: { width: 1, hi: 0.3, lo: 0.15 }, shadow: { blur: 2.5, alpha: 0.4 },
      draw: (ctx) => drawEddy(ctx, e.x, e.y, e.r, { flat, rings: e.rings ?? 6, spin: e.spin ?? 1.4, palette: o.palette, seed: sd, light: L }),
    });
    return { s, x: e.x, y: e.y, period: rng.range(3, 5), ph: rng.next() };
  });
  const sh = away(L, 2);
  return [S.add({
    name: 'eddies', z: o.z, order: o.order, alpha: o.alpha,
    render(ctx, t) {
      drawSprites(ctx, items.map((e) => {
        const a = TAU * (t / e.period + e.ph);
        const k = 1 + 0.05 * Math.sin(a + 1);
        return { s: e.s, ax: e.x, ay: e.y, x: e.x + Math.sin(a) * 2, y: e.y, sx: k, sy: k };
      }), sh);
    },
  })];
}

// --- Ripples ---------------------------------------------------------------------------------

// A ripple ring: an ellipse of paper strip broken into arcs, thicker on the near side
// (ref06 cave pool).
//   width    strip thickness; arcs: number of pieces; gap: share of each arc left open
export function drawRipple(ctx, x, y, rx, ry, { width = 4, color = '#7fb3e8', rim = '#ffffff', arcs = 3, gap = 0.3, seed = 1, light = [0.4, -0.9], shadow = 'rgba(4,12,40,0.45)' } = {}) {
  const rng = new RNG(seed);
  const a0 = rng.range(0, TAU);
  for (let i = 0; i < arcs; i++) {
    const start = a0 + (i / arcs) * TAU + rng.range(0, gap * 0.3);
    const span = (TAU / arcs) * (1 - gap * rng.range(0.6, 1.3));
    const outer = [], inner = [];
    const n = 36;
    for (let j = 0; j <= n; j++) {
      const f = j / n, a = start + span * f;
      const t = Math.pow(Math.sin(Math.PI * f), 0.5) * width * 0.5 * (1 + 0.4 * Math.sin(a));
      outer.push([x + Math.cos(a) * (rx + t), y + Math.sin(a) * (ry + t * 0.7)]);
      inner.push([x + Math.cos(a) * (rx - t), y + Math.sin(a) * (ry - t * 0.7)]);
    }
    strip(ctx, [...outer, ...inner.reverse()], { fill: color, light, shadowColor: shadow, drop: 1.4, blur: 2, hi: 0.4, lo: 0.12, rim: rim ? 0.5 : 0, rimColor: rim || '#fff', torn: 0.4, seed: rng.int(1, 1e6) });
  }
}

// Ripple rings spreading from a point and fading, staggered so the motion never resets.
//   z, x, y      centre
//   rx, ry       final ring radii; r0: starting radius as a share of rx (default 0.15)
//   count        rings alive at once; period: seconds for a ring to grow out
//   width, color, rim, arcs   as drawRipple (color default palette.light)
//   expand       false: rings stay put and only breathe (rings around a stone)
export function addRipples(S, opts) {
  const o = { z: 1300, palette: WATER.cave, count: 4, period: 4.5, r0: 0.15, width: 9, arcs: 3, expand: true, seed: 'ripple', order: 0, ...opts };
  const rng = new RNG(o.seed);
  const L = S.light;
  const R = 100, Ry = (100 * o.ry) / o.rx;
  const rings = [];
  for (let i = 0; i < o.count; i++) {
    const sd = rng.int(1, 1e6);
    const pad = o.width * 3 + 10;
    const s = S.sprite({
      name: 'ripple', x: -R - pad, y: -Ry - pad, w: (R + pad) * 2, h: (Ry + pad) * 2, mat: 'smooth', res: Math.max(1, o.rx / 100) * 1.2,
      edge: { width: 0.8, hi: 0.3, lo: 0.12 }, shadow: { blur: 2, alpha: 0.45 },
      draw: (ctx) => drawRipple(ctx, 0, 0, R, Ry, { width: (o.width * 100) / o.rx, color: o.color ?? o.palette.light, rim: o.rim ?? '#ffffff', arcs: o.arcs, seed: sd, light: L }),
    });
    rings.push({ s, k: i / o.count, rest: lerp(o.r0 + 0.2, 1, (i + 1) / o.count) });
  }
  const sh = away(L, 1.8);
  return [S.add({
    name: 'ripples', z: o.z, order: o.order, alpha: o.alpha,
    render(ctx, t) {
      drawSprites(ctx, rings.map((r) => {
        let k, alpha = 1;
        if (o.expand) {
          const f = (((t / o.period + r.k) % 1) + 1) % 1;
          k = lerp(o.r0, 1, 1 - Math.pow(1 - f, 1.6));
          alpha = smoothstep(0, 0.12, f) * (1 - smoothstep(0.55, 1, f));
        } else {
          k = r.rest * (1 + 0.03 * Math.sin(TAU * (t / o.period + r.k)));
        }
        const sc = (k * o.rx) / R;
        return { s: r.s, x: o.x, y: o.y, sx: sc, sy: sc, alpha };
      }), sh);
    },
  })];
}
