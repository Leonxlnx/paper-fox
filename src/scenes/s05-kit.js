// s05 snow peaks: scene-local paper pieces built on the shared element kits. Faceted
// granite faces with arbitrary outlines, big torn snow drapes, the dark spruce
// palette of the reference and yellow-olive alpine grass.

import { RNG } from '../core/rng.js';
import { piece, pathOf, bevelBands, linear } from '../core/piece.js';
import { flecks } from '../core/paper.js';
import { vary, rgba, mix, shade } from '../core/color.js';
import { clamp } from '../core/ease.js';
import { hull, voronoi, scatterIn, boxOf, centroid, brush, sliver } from '../elements/terrain-kit.js';
import { STONE_PALETTES } from '../elements/terrain.js';
import { drawTuft } from '../elements/flora.js';

// Granite of ref05: charcoal faces, warm grey lit planes.
export const GRANITE = {
  ...STONE_PALETTES.granite,
  ramp: ['#141317', '#26252b', '#38363b', '#4f4b4e', '#6b6564', '#8a827c'],
};

// Snow of ref05: warm white tops, blue shade on the slopes away from the star.
export const SNOW05 = { top: '#f4f1f0', mid: '#e3e2e8', shade: '#9fb4d6', deep: '#7b9dc8', rim: '#ffffff' };

// Spruces of ref05: near-black shade side, deep green lit tiers.
export const SPRUCE = { deep: '#021612', dark: '#0a2a20', mid: '#164030', lit: '#2a5a3a', hi: '#4a7a4a', fleck: '#d6c27a' };

// Valley spruces: blue-black under the haze.
export const SPRUCE_FAR = { deep: '#03141c', dark: '#0a2430', mid: '#123440', lit: '#1e4a50', hi: '#2e5e5e', fleck: '#c8b47a' };

// Alpine grass in the rocks: yellow-olive with darker olive stems.
export const GRASS = ['#b8a83a', '#9c9a30', '#c8b848', '#7f8a2a'];

// Facet brightness for a normal [nx, up] under a light vector (screen space).
const lightOf = (n, light) => n[0] * light[0] + n[1] * -light[1];

// A granite face with any outline: a dark base cut into facets that stretch along
// `grain` (vertical columns by default), each lit by a random normal biased so that
// the side toward the light is brighter. Brushed grain, cracks and specks on top.
//   outline   polygon; facets: cell count; tilt: how strongly facets face up (0..1)
export function rockFace(ctx, outline, { palette = GRANITE, light = [0.45, -0.89], seed = 1, facets = null, sy = 0.45, lit = 0.5, tilt = 0.25, contrast = 1, specks = 1, shadow = null, bevel = true } = {}) {
  const rng = new RNG(`rock05:${seed}`);
  const P = palette;
  const b = boxOf(outline);
  const sil = piece(ctx, outline, { fill: P.ramp[1], shadow });
  const n = facets ?? clamp(Math.round((b.w * b.h) / 2600), 4, 40);
  const cells = voronoi(hull(outline), scatterIn(hull(outline), n, rng, { gap: Math.sqrt((b.w * b.h) / n) * 0.5 }), { sy });
  ctx.save();
  ctx.clip(sil);
  const [cx] = centroid(outline);
  const shaded = cells.map((c) => {
    const [px, py] = centroid(c.pts);
    const side = clamp((px - cx) / (b.w * 0.5), -1, 1);
    const up = clamp((b.y + b.h - py) / b.h, 0, 1) * tilt + rng.range(-0.3, 0.45);
    const nx = side * 0.5 + rng.range(-0.6, 0.6);
    return { c, I: lightOf([nx, up], light) };
  }).sort((p, q) => p.I - q.I);
  for (const { c, I } of shaded) {
    const k = clamp(lit + I * 0.55 * contrast + rng.range(-0.08, 0.08), 0, 1);
    const tone = P.ramp[Math.round(1 + k * (P.ramp.length - 2))];
    const path = piece(ctx, c.pts, {
      fill: vary(tone, rng, 0.05),
      shadow: I > 0 ? { color: 'rgba(0,0,0,0.35)', blur: 3, x: -light[0] * 1.5, y: 1.6 } : null,
      bevel: I > 0.15 ? { light, width: 1.2, hi: 0.16, lo: 0.05 } : null,
    });
    brush(ctx, path, { angle: Math.PI / 2 + rng.range(-0.25, 0.25), amt: 0.24, scale: 0.65, seed: rng.int(1, 1e9) });
  }
  // Dark crevices between some columns.
  for (const c of cells) {
    if (!rng.chance(0.3)) continue;
    const k = rng.int(0, c.pts.length - 1);
    const p0 = c.pts[k], p1 = c.pts[(k + 1) % c.pts.length];
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 18) continue;
    piece(ctx, sliver([p0, [(p0[0] + p1[0]) / 2 + rng.range(-3, 3), (p0[1] + p1[1]) / 2], p1], rng.range(1, 2.6)), { fill: rgba(P.ramp[0], 0.85) });
  }
  if (specks > 0) {
    const a = b.w * b.h;
    flecks(ctx, b.x, b.y, b.w, b.h, Math.round((a / 260) * specks), rng.int(1, 1e6), { color: P.fleck, max: 1.2, alpha: 0.7 });
    flecks(ctx, b.x, b.y, b.w, b.h, Math.round((a / 160) * specks), rng.int(1, 1e6), { color: '#000000', max: 1.3, alpha: 0.45 });
    flecks(ctx, b.x, b.y, b.w, b.h, Math.round((a / 220) * specks), rng.int(1, 1e6), { color: '#ece4dc', max: 1, alpha: 0.4 });
  }
  ctx.restore();
  if (bevel) bevelBands(ctx, sil, { light, width: 1.6, hi: 0.3, lo: 0.35 });
  return sil;
}

// A big torn sheet of snow lying over rock: a blue underside showing below the
// torn front edge, a white top shading to blue on the side away from the light
// (along `shadeDir`), a paper core along the tear and faint creases.
//   pts       outline; thick: px of underside showing; shadeDir: [dx, dy] unit vector
//   shadeAmt  0..1 how blue the shaded side gets
export function snowDrape(ctx, pts, { light = [0.45, -0.89], seed = 1, thick = 6, shadeDir = [-0.5, 0.85], shadeAmt = 0.6, colors = SNOW05, tear = 2.2, creases = 1, castShadow = true } = {}) {
  const rng = new RNG(`snow05:${seed}`);
  const b = boxOf(pts);
  const torn = { amp: tear, freq: 0.07, fine: 0.9, seed: rng.int(1, 1e6), step: 3 };
  piece(ctx, pts.map(([x, y]) => [x, y + thick]), {
    fill: colors.deep, torn: { ...torn, seed: torn.seed + 7 },
    shadow: castShadow ? { color: 'rgba(8,16,44,0.5)', blur: 6, x: -light[0] * 2, y: 4 } : null,
  });
  const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
  const R = Math.hypot(b.w, b.h) / 2;
  const fill = linear(ctx, cx - shadeDir[0] * R, cy - shadeDir[1] * R, cx + shadeDir[0] * R, cy + shadeDir[1] * R,
    [[0, colors.top], [0.45, colors.mid], [1, mix(colors.mid, colors.shade, shadeAmt)]]);
  const path = piece(ctx, pts, { fill, torn, rim: { color: colors.rim, width: 1.3 }, bevel: { light, width: 1.8, hi: 0.55, lo: 0.2, soft: 0.6 } });
  ctx.save();
  ctx.clip(path);
  // Soft shading pools and drifted ridges pressed into the sheet.
  for (let i = 0; i < Math.round((b.w * b.h) / 9000) * creases; i++) {
    const x = b.x + rng.next() * b.w, y = b.y + rng.next() * b.h;
    const L = rng.range(20, 70), a = rng.range(-0.5, 0.5) + Math.atan2(shadeDir[1], shadeDir[0]) + Math.PI / 2;
    const seg = [[x, y], [x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 + rng.range(-3, 3)], [x + Math.cos(a) * L, y + Math.sin(a) * L]];
    piece(ctx, sliver(seg, rng.range(1.2, 3)), { fill: rgba(colors.shade, rng.range(0.25, 0.5)) });
    piece(ctx, sliver(seg.map(([px, py]) => [px - 1.5, py - 2]), rng.range(0.6, 1.4)), { fill: rgba('#ffffff', 0.5) });
  }
  brush(ctx, path, { angle: Math.atan2(shadeDir[1], shadeDir[0]) + Math.PI / 2, amt: 0.08, scale: 0.8, seed: rng.int(1, 1e9) });
  ctx.restore();
  return path;
}

// A clump of yellow-olive alpine grass rooted at (x, y).
export function grassClump(ctx, x, y, { len = 40, n = 9, spread = 1.3, lean = 0, light, seed = 1 } = {}) {
  drawTuft(ctx, { x, y, n, len, spread, width: 0.07, lean, tones: GRASS, light, seed });
}

// Spruce palette pulled toward a haze colour.
export function hazed(pal, color, t) {
  if (!t) return pal;
  const out = {};
  for (const k of Object.keys(pal)) out[k] = mix(pal[k], color, t);
  return out;
}

export { shade };
