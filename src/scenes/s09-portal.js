// Star portal (s09): the glowing gold ring between the central stones, the radiant
// eight-point star in its centre, the light pouring up from the basin, the small star
// that falls from the sky into the ring, the flare when it lands, and sparkles rising
// from the basin. The ring breathes slowly the whole time.

import { RNG } from '../core/rng.js';
import { piece, bevelBands, radial } from '../core/piece.js';
import { ellipse, TAU } from '../core/geom.js';
import { flecks } from '../core/paper.js';
import { rgba, mix } from '../core/color.js';
import { bezier, clamp, lerp, smoothstep, osc } from '../core/ease.js';
import { compassStar, drawFoldedStar, drawPaperStar, drawGlow, GUIDE_GOLD } from '../elements/sky.js';
import { sliver } from '../elements/terrain-kit.js';

const RING_PAPER = { lit: '#ffe9a4', base: '#eeb94e', shade: '#b97a2a', crack: '#7a4a16' };
const LIGHT = { warm: '#ffb94e', cream: '#ffe9a8', core: '#fffbea', gold: '#ffcc5c' };
// The centre star: pale cream-gold with a white-hot heart (ref09).
const STAR_GOLD = { lit: '#fff8e2', base: '#ffdc88', shade: '#e6a046', glow: '#ffc96e', core: '#fffbec' };

// A ring-shaped path (outer circle, inner circle reversed) for even-odd fills.
function annulus(x, y, ro, ri, n = 160) {
  const p = new Path2D();
  [ellipse(x, y, ro, ro, n), ellipse(x, y, ri, ri, n).reverse()].forEach((pts) => pts.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py))));
  return p;
}

// Brightness of the portal over time: a slow breath, a stronger steady glow after the
// star lands, and the flare itself.
export function portalTimeline({ land = 2.75, settle = 1, before = 0.72 } = {}) {
  const level = (t) => lerp(before, 1, smoothstep(land, land + settle, t));
  const flare = (t) => smoothstep(land - 0.1, land + 0.04, t) * Math.exp(-Math.max(0, t - land - 0.04) / 0.32);
  const breath = (t) => 1 + 0.07 * osc(t, 4.6, 0.15) + 0.025 * osc(t, 1.9, 0.4);
  return { land, level, flare, breath, glow: (t) => level(t) * breath(t) + 1.3 * flare(t) };
}

// Paint the ring disc: dusky blue-violet with the light gathering in the middle, a few
// specks of starlight and the fine crosshair lines of the reference.
function drawDisc(ctx, x, y, r, seed) {
  const rng = new RNG(seed);
  const path = piece(ctx, ellipse(x, y, r, r, 96), {
    fill: radial(ctx, x, y, r * 0.03, r, [[0, '#ffe8b0'], [0.12, '#d6ae78'], [0.3, '#5e5a7c'], [0.55, '#313870'], [1, '#262d62']]),
  });
  ctx.save();
  ctx.clip(path);
  // Gold light filling the opening: rising from the basin below and gathering along
  // the inside of the ring, leaving deep night only in the upper middle.
  const rise = ctx.createLinearGradient(0, y + r, 0, y - r * 0.35);
  rise.addColorStop(0, rgba('#ffc456', 0.8)); rise.addColorStop(0.3, rgba('#f2a848', 0.4)); rise.addColorStop(1, rgba('#f2a848', 0));
  ctx.fillStyle = rise;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = radial(ctx, x, y, r * 0.62, r, [[0, rgba('#ffc860', 0)], [0.7, rgba('#ffc860', 0.12)], [1, rgba('#ffd884', 0.46)]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = radial(ctx, x, y, 0, r * 0.5, [[0, rgba('#fff0c0', 0.32)], [0.5, rgba('#ffd27a', 0.1)], [1, rgba('#ffd27a', 0)]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Fine rays of starlight radiating from the centre to the ring.
  for (let i = 0; i < 112; i++) {
    const a = (i / 112) * TAU + rng.range(-0.015, 0.015);
    const long = i % 7 === 0;
    const len = r * (long ? 1 : rng.range(0.4, 0.97));
    const c = Math.cos(a), s = Math.sin(a);
    const g = ctx.createLinearGradient(x, y, x + c * len, y + s * len);
    g.addColorStop(0, rgba('#fff4cc', long ? 0.36 : 0.12)); g.addColorStop(0.5, rgba('#ffdc90', long ? 0.14 : 0.04)); g.addColorStop(1, rgba('#ffd27a', 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = long ? 1.5 : rng.range(0.5, 1.05);
    ctx.beginPath(); ctx.moveTo(x + c * 4, y + s * 4); ctx.lineTo(x + c * len, y + s * len); ctx.stroke();
  }
  flecks(ctx, x - r, y - r, r * 2, r * 2, 160, rng.int(1, 1e6), { color: '#ffe7b0', max: 1.3, alpha: 0.7 });
  ctx.strokeStyle = rgba('#ffe2a0', 0.32);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.restore();
  return path;
}

// Paint the gold ring: an annulus of cream-gold paper with a cracked seam at the top
// and stepped shoulders where it sinks into the stone frame at the bottom.
function drawRing(ctx, x, y, R, w, light, seed) {
  const rng = new RNG(seed);
  const outer = ellipse(x, y, R, R, 160), inner = ellipse(x, y, R - w, R - w, 160).reverse();
  const ring = new Path2D();
  [outer, inner].forEach((pts) => pts.forEach(([px, py], i) => (i ? ring.lineTo(px, py) : ring.moveTo(px, py))));
  ctx.save();
  ctx.shadowColor = 'rgba(30,14,0,0.55)';
  ctx.shadowBlur = 6 * (ctx.__res || 1);
  ctx.shadowOffsetY = 4 * (ctx.__res || 1);
  ctx.fillStyle = radial(ctx, x, y, R - w, R, [[0, RING_PAPER.lit], [0.5, RING_PAPER.base], [1, RING_PAPER.shade]]);
  ctx.fill(ring, 'evenodd');
  ctx.restore();
  ctx.save();
  ctx.clip(ring, 'evenodd');
  // Segments: the ring is pieced from arcs of slightly different sheets.
  const segs = 11;
  for (let i = 0; i < segs; i++) {
    const a0 = -Math.PI / 2 + (i / segs) * TAU + rng.range(-0.05, 0.05), a1 = a0 + TAU / segs;
    const pts = [];
    for (let k = 0; k <= 10; k++) { const a = lerp(a0, a1, k / 10); pts.push([x + Math.cos(a) * (R + 2), y + Math.sin(a) * (R + 2)]); }
    for (let k = 10; k >= 0; k--) { const a = lerp(a0, a1, k / 10); pts.push([x + Math.cos(a) * (R - w - 2), y + Math.sin(a) * (R - w - 2)]); }
    const lit = 0.5 + 0.5 * Math.cos((a0 + a1) / 2 + Math.PI * 0.75);
    piece(ctx, pts, { fill: rgba(mix(RING_PAPER.shade, RING_PAPER.lit, lit), 0.35), bevel: { light, width: 1, hi: 0.2, lo: 0.25 } });
    // Seam crack between segments.
    const ac = a0;
    piece(ctx, sliver([[x + Math.cos(ac) * (R + 2), y + Math.sin(ac) * (R + 2)], [x + Math.cos(ac + 0.01) * (R - w / 2), y + Math.sin(ac + 0.01) * (R - w / 2)], [x + Math.cos(ac) * (R - w - 2), y + Math.sin(ac) * (R - w - 2)]], 0.9), { fill: rgba(RING_PAPER.crack, 0.7) });
  }
  flecks(ctx, x - R, y - R, R * 2, R * 2, 500, rng.int(1, 1e6), { color: '#fff8e0', max: 1.1, alpha: 0.5 });
  flecks(ctx, x - R, y - R, R * 2, R * 2, 300, rng.int(1, 1e6), { color: '#7a4a1c', max: 1, alpha: 0.35 });
  ctx.restore();
  bevelBands(ctx, ring, { light, width: 1.8, hi: 0.5, lo: 0.35, soft: 0.5 });
  // Inner lip: a thin bright line where the light catches the inner edge, and a
  // fine engraved groove along the middle of the band.
  ctx.save();
  ctx.strokeStyle = rgba(LIGHT.cream, 0.85);
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(x, y, R - w + 1, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(RING_PAPER.crack, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, R - w * 0.42, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba('#fffaf0', 0.5);
  ctx.beginPath(); ctx.arc(x, y, R - w * 0.42 - 1.2, 0, TAU); ctx.stroke();
  ctx.restore();
  // The thin outer hoop, cut separately and floating just outside the band.
  const hoop = annulus(x, y, R + 9, R + 4.5);
  ctx.save();
  ctx.shadowColor = 'rgba(30,14,0,0.5)';
  ctx.shadowBlur = 4 * (ctx.__res || 1);
  ctx.shadowOffsetY = 3 * (ctx.__res || 1);
  ctx.fillStyle = radial(ctx, x, y - R * 0.4, R * 0.2, R * 1.5, [[0, RING_PAPER.lit], [0.6, RING_PAPER.base], [1, RING_PAPER.shade]]);
  ctx.fill(hoop, 'evenodd');
  ctx.restore();
  bevelBands(ctx, hoop, { light, width: 1, hi: 0.5, lo: 0.3, soft: 0.4 });
}

// The light fan rising from the basin: thin rays of dotted light spreading upward
// plus the bright vertical thread that joins the basin to the star.
function drawFan(ctx, x, y, top, seed) {
  const rng = new RNG(seed);
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + rng.range(-0.75, 0.75);
    const len = rng.range(40, 150) * (1 - Math.abs(a + Math.PI / 2) * 0.6);
    const c = Math.cos(a), s = Math.sin(a);
    const g = ctx.createLinearGradient(x, y, x + c * len, y + s * len);
    g.addColorStop(0, rgba(LIGHT.cream, 0.9)); g.addColorStop(1, rgba(LIGHT.gold, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = rng.range(0.8, 2.2);
    ctx.beginPath(); ctx.moveTo(x + c * 6, y + s * 6); ctx.lineTo(x + c * len, y + s * len); ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, y, 0, top);
  g.addColorStop(0, rgba(LIGHT.core, 1)); g.addColorStop(0.6, rgba(LIGHT.cream, 0.7)); g.addColorStop(1, rgba(LIGHT.gold, 0.15));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 2.2, y); ctx.lineTo(x + 2.2, y); ctx.lineTo(x + 0.7, top); ctx.lineTo(x - 0.7, top);
  ctx.closePath(); ctx.fill();
}

// Starburst rays for the flare (and a faint steady version).
function drawBurst(ctx, x, y, R, seed) {
  const rng = new RNG(seed);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU + rng.range(-0.04, 0.04);
    const len = R * (i % 4 === 0 ? 1 : i % 2 === 0 ? 0.65 : rng.range(0.3, 0.5));
    const c = Math.cos(a), s = Math.sin(a);
    const g = ctx.createLinearGradient(x, y, x + c * len, y + s * len);
    g.addColorStop(0, rgba(LIGHT.core, 0.95)); g.addColorStop(0.4, rgba(LIGHT.cream, 0.4)); g.addColorStop(1, rgba(LIGHT.gold, 0));
    ctx.fillStyle = g;
    const wdt = (i % 4 === 0 ? 3.2 : 1.6) * rng.range(0.8, 1.2);
    ctx.beginPath();
    ctx.moveTo(x - s * wdt, y + c * wdt); ctx.lineTo(x + c * len, y + s * len); ctx.lineTo(x + s * wdt, y - c * wdt);
    ctx.closePath(); ctx.fill();
  }
}

// Add the portal. Returns { layers, timeline }.
//   ring      { x, y, R, w }          ring centre, outer radius, band width
//   star      { size }                arm length of the centre star
//   basin     { x, y }                where the light pours out of the basin
//   fall      { from: [x, y], t0, t1 } the small star's descent (lands at t1)
//   z         { ring, glow, basin }    depths
export function addPortal(S, { ring, star, basin, fall, z, seed = 's09-portal' }) {
  const { x, y, R, w } = ring;
  const L = S.light;
  const tl = portalTimeline({ land: fall.t1 });
  const layers = [];
  const tag = (Lyr, ...tags) => { Lyr.tags = ['portal', ...tags]; layers.push(Lyr); return Lyr; };

  // Baked paper: disc, ring and centre star share one plane (disc behind the ring).
  const pad = 16;
  const disc = S.sprite({
    name: 'portal-disc', x: x - R - pad, y: y - R - pad, w: (R + pad) * 2, h: (R + pad) * 2, res: 1.5, mat: 'smooth', edge: false, shadow: false,
    draw(ctx) { drawDisc(ctx, x, y, R - w + 3, seed); },
  });
  const ringS = S.sprite({
    name: 'portal-ring', x: x - R - pad, y: y - R - pad, w: (R + pad) * 2, h: (R + pad) * 2, res: 1.5,
    mat: [{ tex: 'fiber', amt: 0.6 }, { tex: 'crumple', amt: 0.55, scale: 0.4 }], light: L,
    edge: { width: 1.6, hi: 0.35, lo: 0.3, soft: 0.6 }, shadow: { blur: 8 },
    draw(ctx) { drawRing(ctx, x, y, R, w, L, seed); },
  });
  const S8 = star.size;
  const starGeo = compassStar(x, y, S8, { arms: [1, 0.92, 1.06, 0.92], diag: 0.46, inner: 0.3, spread: 0.42 });
  const starS = S.sprite({
    name: 'portal-star', x: x - S8 * 1.2, y: y - S8 * 1.2, w: S8 * 2.4, h: S8 * 2.4, res: 2, mat: 'smooth', light: [0, -1],
    edge: { width: 1, hi: 0.35, lo: 0.25, soft: 0.5 }, shadow: { blur: 4 },
    draw(ctx) { drawFoldedStar(ctx, starGeo, { gold: STAR_GOLD, light: [0.3, -0.95], contrast: 1.2 }); },
  });

  // Disc glow first (additive, behind the paper ring so the ring reads as cut paper).
  tag(S.add({
    name: 'portal-disc', z: z.ring, order: 0, sprites: [{ s: disc }],
  }), 'portalDisc');
  tag(S.add({
    name: 'portal-inner-light', z: z.ring, order: 0.5, blend: 'lighter',
    render(ctx, t) {
      const g = tl.glow(t);
      drawGlow(ctx, x, y, (R - w) * 0.9, LIGHT.warm, 0.16 * g, { falloff: 'soft' });
      drawGlow(ctx, x, y + (R - w) * 0.7, (R - w) * 0.85, LIGHT.gold, 0.22 * g, { falloff: 'soft', sy: 1.1 });
    },
  }));
  tag(S.add({ name: 'portal-ring', z: z.ring, order: 1, sprites: [{ s: ringS }] }), 'portalRing');
  // The ring itself radiates: a bright band of light on the paper and a warm halo
  // spreading out over the stones.
  tag(S.add({
    name: 'portal-ring-glow', z: z.ring, order: 1.5, blend: 'lighter',
    render(ctx, t) {
      const g = tl.glow(t);
      const r0 = R - w - 16, r1 = R + 52;
      const k = (R - w * 0.45 - r0) / (r1 - r0);
      const grad = ctx.createRadialGradient(x, y, r0, x, y, r1);
      grad.addColorStop(0, rgba(LIGHT.gold, 0));
      grad.addColorStop(k * 0.82, rgba(LIGHT.gold, 0));
      grad.addColorStop(k, rgba(LIGHT.gold, 0.1 * g));
      grad.addColorStop(k + (1 - k) * 0.2, rgba(LIGHT.warm, 0.2 * g));
      grad.addColorStop(k + (1 - k) * 0.55, rgba(LIGHT.warm, 0.06 * g));
      grad.addColorStop(1, rgba(LIGHT.warm, 0));
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r1, 0, TAU); ctx.fill();
      ctx.restore();
    },
  }));

  // Light rising from the basin: fan, thread to the star.
  const fanTop = y - S8 * 0.3;
  const fanS = S.sprite({
    name: 'portal-fan', x: basin.x - 170, y: fanTop - 10, w: 340, h: basin.y - fanTop + 20, mat: 'none', edge: false, shadow: false,
    draw(ctx) { drawFan(ctx, basin.x, basin.y, fanTop, `${seed}-fan`); },
  });
  const burstR = 390;
  const burstS = S.sprite({
    name: 'portal-burst', x: x - burstR, y: y - burstR, w: burstR * 2, h: burstR * 2, mat: 'none', edge: false, shadow: false,
    draw(ctx) { drawBurst(ctx, x, y, burstR, `${seed}-burst`); },
  });
  tag(S.add({
    name: 'portal-fan', z: z.ring, order: 2, blend: 'lighter',
    render(ctx, t) {
      const g = tl.glow(t);
      ctx.save();
      ctx.globalAlpha *= clamp(0.55 + 0.45 * g, 0, 1.4);
      ctx.drawImage(fanS.canvas, fanS.x, fanS.y, fanS.w, fanS.h);
      ctx.restore();
    },
  }));

  // The star with its halo, glint and the flare burst.
  tag(S.add({
    name: 'portal-star', z: z.ring, order: 3,
    render(ctx, t, env) {
      const g = tl.glow(t);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, x, y, S8 * 1.2 * (0.9 + 0.1 * g), LIGHT.warm, 0.22 * g, { falloff: 'soft' });
      drawGlow(ctx, x, y, S8 * 1, LIGHT.cream, 0.3 * g, { falloff: 'tight' });
      // Long rays: the four cardinal beams reach the ring, the diagonals half way.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2, card = i % 2 === 0;
        const len = (card ? (i === 4 ? 1.35 : 1.12) * (R - w) : 0.62 * (R - w)) * (0.94 + 0.06 * g);
        const wd = card ? 3.6 : 2;
        const c = Math.cos(a), s = Math.sin(a);
        const rg = ctx.createLinearGradient(x, y, x + c * len, y + s * len);
        rg.addColorStop(0, rgba(LIGHT.core, Math.min(1, 0.9 * g))); rg.addColorStop(0.45, rgba(LIGHT.cream, 0.45 * g)); rg.addColorStop(1, rgba(LIGHT.gold, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(x - s * wd, y + c * wd); ctx.lineTo(x + c * len, y + s * len); ctx.lineTo(x + s * wd, y - c * wd);
        ctx.closePath(); ctx.fill();
      }
      // Burst: a steady starburst of rays, blazing during the flare.
      const f = tl.flare(t);
      const k = 0.1 * tl.level(t) * tl.breath(t) + 1.1 * f;
      if (k > 0.01) {
        const sc = 0.55 + 0.45 * tl.level(t) + 0.5 * f;
        ctx.translate(x, y);
        ctx.rotate(0.04 * t + 0.25 * f);
        ctx.scale(sc, sc);
        ctx.globalAlpha *= Math.min(1, k);
        ctx.drawImage(burstS.canvas, -burstR, -burstR, burstR * 2, burstR * 2);
      }
      ctx.restore();
      const sk = 1 + 0.015 * osc(t, 4.6, 0.15) + 0.12 * tl.flare(t);
      ctx.save();
      ctx.translate(x, y); ctx.scale(sk, sk); ctx.translate(-x, -y);
      ctx.drawImage(starS.shadow.canvas, starS.x - starS.shadow.pad + env.shadow.dx * 0.4, starS.y - starS.shadow.pad + env.shadow.dy * 0.4, starS.w + 2 * starS.shadow.pad, starS.h + 2 * starS.shadow.pad);
      ctx.drawImage(starS.canvas, starS.x, starS.y, starS.w, starS.h);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, x, y, S8 * 0.45, LIGHT.core, 0.3 * g, { falloff: 'tight' });
      ctx.restore();
    },
  }));

  // Light spilling onto the stones and the terrace around the ring (and the flare flash).
  tag(S.add({
    name: 'portal-spill', z: z.glow, order: 0, blend: 'lighter',
    render(ctx, t) {
      const g = tl.glow(t);
      // Keep the steady spill off the disc so the night inside the ring stays deep.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - R * 6, y - R * 6, R * 12, R * 12);
      ctx.arc(x, y, R + 10, 0, TAU);
      ctx.clip('evenodd');
      drawGlow(ctx, x, y + 40, R * 3, LIGHT.warm, 0.08 * g, { falloff: 'wide' });
      drawGlow(ctx, x, y + 20, R * 2.1, LIGHT.warm, 0.09 * g, { falloff: 'soft', sx: 1.15 });
      drawGlow(ctx, x, y, R * 1.45, LIGHT.gold, 0.08 * g, { falloff: 'soft' });
      ctx.restore();
      drawGlow(ctx, x, y, R * 5, LIGHT.cream, 0.45 * tl.flare(t), { falloff: 'soft' });
    },
  }));

  // Basin light: the flare at the lip and sparkles drifting up out of it.
  const rng = new RNG(`${seed}-sparks`);
  const sparks = Array.from({ length: 34 }, () => ({
    x: basin.x + rng.gauss() * 28, rise: rng.range(110, 300), sway: rng.range(4, 14), period: rng.range(1.8, 3.6),
    phase: rng.next(), r: rng.range(1, 2.4), wob: rng.range(0.6, 1.4),
  }));
  tag(S.add({
    name: 'portal-basin-light', z: z.basin, order: 1, blend: 'lighter',
    render(ctx, t) {
      const g = tl.glow(t);
      drawGlow(ctx, basin.x, basin.y + 4, 120, LIGHT.warm, 0.42 * g, { falloff: 'soft', sy: 0.55 });
      drawGlow(ctx, basin.x, basin.y, 44, LIGHT.core, 0.75 * g, { falloff: 'tight', sy: 0.7 });
      for (const p of sparks) {
        const u = ((t / p.period + p.phase) % 1 + 1) % 1;
        const a = Math.sin(Math.PI * u) * (0.6 + 0.4 * osc(t, p.period * 0.37, p.phase)) * clamp(g, 0, 1.3);
        if (a < 0.02) continue;
        const px = p.x + p.sway * Math.sin(TAU * (u * p.wob + p.phase));
        const py = basin.y - 6 - u * p.rise;
        drawGlow(ctx, px, py, p.r * 5, LIGHT.gold, a * 0.7, { falloff: 'tight' });
        drawGlow(ctx, px, py, p.r * 1.6, LIGHT.core, a, { falloff: 'tight' });
      }
    },
  }));

  // The falling star: a small bright paper star with a fading trail of light.
  const fallStar = S.sprite({
    name: 'falling-star', x: -16, y: -16, w: 32, h: 32, res: 3, mat: 'smooth', edge: { width: 0.8, hi: 0.3, lo: 0.2 }, shadow: false,
    draw(ctx) { drawPaperStar(ctx, 0, 0, 9, { gold: { lit: '#fffbe8', base: '#ffe7a6', shade: '#f0b85c' }, tall: 1.25, pinch: 0.55, fold: 0.5 }); },
  });
  const ease = bezier(0.42, 0, 0.58, 1);
  const pathAt = (u) => {
    const e = ease(clamp(u));
    return [lerp(fall.from[0], x, e) + 55 * Math.sin(Math.PI * e), lerp(fall.from[1], y, e)];
  };
  tag(S.add({
    name: 'portal-falling-star', z: z.ring, order: 4,
    render(ctx, t) {
      if (t < fall.t0 - 0.05 || t > fall.t1 + 0.35) return;
      const u = (t - fall.t0) / (fall.t1 - fall.t0);
      const fade = smoothstep(fall.t0 - 0.05, fall.t0 + 0.2, t) * (1 - smoothstep(fall.t1, fall.t1 + 0.3, t));
      if (fade <= 0.01) return;
      const [px, py] = pathAt(u);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Trail: glows along the path just travelled.
      for (let k = 1; k <= 14; k++) {
        const q = pathAt(u - k * 0.022);
        drawGlow(ctx, q[0], q[1], 16 - k * 0.7, LIGHT.cream, fade * 0.5 * (1 - k / 15), { falloff: 'tight' });
      }
      drawGlow(ctx, px, py, 60, LIGHT.warm, fade * 0.55, { falloff: 'soft' });
      drawGlow(ctx, px, py, 18, LIGHT.core, fade, { falloff: 'tight' });
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= fade;
      ctx.translate(px, py);
      ctx.rotate(t * 2.2);
      const s = 1 + 0.15 * osc(t, 0.4);
      ctx.scale(s, s);
      ctx.drawImage(fallStar.canvas, -16, -16, 32, 32);
      ctx.restore();
    },
  }));
  return { layers, timeline: tl };
}
