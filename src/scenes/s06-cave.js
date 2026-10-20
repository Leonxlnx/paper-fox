// Crystal cave (s06) environment: the deep tunnel under the guiding star, the faceted
// blue back wall, the brown and blue side walls, rows of icy stalactites and every
// rock ledge, stepping stone and foreground slab. Crystals, water and the fox live in
// the scene file. Everything is authored in film px at camera rest.

import { RNG, noise } from '../core/rng.js';
import { pathOf, setShadow, clearShadow, bevelBands } from '../core/piece.js';
import { mix, rgba, vary } from '../core/color.js';
import { clamp, lerp } from '../core/ease.js';
import { boxOf } from '../elements/terrain-kit.js';
import { ROCK, CAVE_STONE, facets, jag, chaikin, paintLedge, paintPlate, paintStalactite } from './s06-rock.js';

export const LIGHT = [0.45, -0.893];
export const STAR = { x: 1369, y: 268, size: 50 };
// Tunnel axis: far rings sit round the star, nearer rings open up and slide right.
// Eight rings narrowing into the distance; their thick side and their brightest arc turn
// a little from ring to ring so the bore reads as a spiral lit gold from deep inside.
const RINGS = Array.from({ length: 8 }, (_, i) => {
  const k = i / 7;
  return {
    z: Math.round(4300 - 1850 * Math.pow(k, 0.8)), cx: 1372 + 96 * Math.pow(k, 1.3), cy: 268 + 5 * Math.sin(i * 0.9) + 4 * k,
    rx: 64 + 192 * k, ry: 58 + 148 * k, thick: 44 + 106 * k, boost: 0.3 - 0.24 * k, spin: i * 0.75, phi: -0.35 + 0.55 * Math.sin(i * 0.8),
  };
});
const MOUTH = { cx: 1470, cy: 270, rx: 336, ry: 232 };

// Tunnel stone: navy in the shade, blue-grey, then amber, gold and cream where the light lies.
const TUNNEL = ['#121830', '#26304e', '#46485c', '#76583e', '#b07434', '#de9c44', '#f4c262', '#ffe4a0'];

const tagged = (tags) => ({ tags });

// Wobbly closed ellipse.
export function jellipse(cx, cy, rx, ry, { n = 40, amp = 0.08, seed = 1 } = {}) {
  const nz = noise(`je:${seed}`);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + nz.n1(i * 0.7) * amp + (i % 2 ? amp * 0.35 : -amp * 0.2);
    out.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return out;
}

// A wall of overlapping slanted rock slabs, painted top to bottom so lower slabs lie
// over the ones above, each with a contact shadow, faceted face and lit band.
export function plateWall(ctx, { x0, y0, x1, y1, cell = 170, pal = ROCK.blue, seed = 'wall', light = LIGHT, band = 10, lit = 0.55, skip = null, shade = null, slant = -0.45, contact = 'rgba(2,4,12,0.62)', rot = 0, rotJit = 0.2, y1Max = Infinity }) {
  const rng = new RNG(`pw:${seed}`);
  ctx.fillStyle = pal.face[0];
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const items = [];
  for (let y = y0 - cell * 0.2; y < y1 + cell * 0.3; y += cell * 0.58) {
    for (let x = x0 - cell * 0.4 + rng.range(0, cell * 0.5); x < x1 + cell * 0.4; x += cell * rng.range(0.55, 0.85)) {
      items.push([x + rng.range(-0.15, 0.15) * cell, y + rng.range(-0.2, 0.2) * cell]);
    }
  }
  for (const [cx, cy] of items) {
    if (skip && skip(cx, cy)) continue;
    const w = cell * rng.range(0.65, 1.05), h = cell * rng.range(0.45, 0.8);
    const sk = slant * w * rng.range(0.3, 0.8);
    const ang = rot + rng.range(-rotJit, rotJit), ca = Math.cos(ang), sa = Math.sin(ang);
    const pts = chaikin([
      [cx - w / 2, cy - h / 2 + sk * 0.5], [cx + rng.range(-0.15, 0.2) * w, cy - h / 2 - rng.range(0, 0.22) * h],
      [cx + w / 2, cy - h / 2 - sk * 0.5], [cx + w / 2 + rng.range(-0.1, 0.1) * w, cy + h / 2 - sk * 0.5],
      [cx + rng.range(-0.2, 0.15) * w, cy + h / 2 + rng.range(0, 0.15) * h], [cx - w / 2 - rng.range(0, 0.1) * w, cy + h / 2 + sk * 0.5],
    ].map(([px, py]) => [cx + (px - cx) * ca - (py - cy) * sa, cy + (px - cx) * sa + (py - cy) * ca]), 0.22);
    const s = shade ? shade(cx, cy) : 0;
    setShadow(ctx, { color: contact, blur: cell * 0.07, x: -light[0] * 4, y: 5 });
    ctx.fillStyle = pal.face[1];
    ctx.fill(pathOf(pts));
    clearShadow(ctx);
    paintPlate(ctx, pts, {
      pal, light, seed: `${seed}${Math.round(cx)}_${Math.round(cy)}`, band: band * rng.range(0.6, 1.3), lit: clamp(lit + s * 0.6),
      n: Math.max(5, Math.round((w * h) / 3000)), shade: () => clamp(0.4 + s + rng.range(-0.15, 0.15)), torn: 2,
    });
  }
}

// Soft light pooled on what is already painted (inside the current clip).
function pool(ctx, x, y, r, color, amount, mode = 'soft-light', sy = 1) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.translate(x, y);
  ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(color, amount));
  g.addColorStop(0.55, rgba(color, amount * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Deep backdrop and tunnel

export function addBackdrop(S) {
  S.plane(6000, {
    name: 'cave-void', x: 960, y: -60, w: 860, h: 660, mat: 'sky', edge: false, shadow: false,
    draw(ctx) {
      ctx.fillStyle = '#05070e';
      ctx.fillRect(960, -60, 860, 660);
      const g = ctx.createRadialGradient(STAR.x, STAR.y, 0, STAR.x, STAR.y, 520);
      g.addColorStop(0, '#3a2c2c'); g.addColorStop(0.12, '#221c2c'); g.addColorStop(0.25, '#10162c'); g.addColorStop(0.6, '#0a0f22'); g.addColorStop(1, '#05070e');
      ctx.fillStyle = g;
      ctx.fillRect(STAR.x - 520, STAR.y - 520, 1040, 1040);
      // faint far facets so the void is still paper
      const rng = new RNG('void');
      for (let i = 0; i < 70; i++) {
        const x = STAR.x + rng.range(-260, 260), y = STAR.y + rng.range(-220, 220);
        const r = rng.range(14, 40);
        ctx.fillStyle = rgba(rng.chance(0.5) ? '#3a3c5c' : '#5a4a48', rng.range(0.08, 0.2));
        ctx.beginPath();
        ctx.moveTo(x - r, y); ctx.lineTo(x + rng.range(-r, r) * 0.4, y - r * rng.range(0.5, 1)); ctx.lineTo(x + r, y + rng.range(-0.4, 0.4) * r); ctx.lineTo(x, y + r * 0.7);
        ctx.fill();
      }
    },
  }, tagged(['sky']));
}

const rampAt = (r, k) => {
  const x = clamp(k) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(x));
  return mix(r[i], r[i + 1], x - i);
};

// One tunnel ring: concentric strata of small rock pieces, each lit on the edge that
// faces the star, ochre and cream on the right, blue-grey on the left, dark below.
function paintRing(ctx, R, i) {
  const { cx, cy, rx, ry, thick, boost, spin, phi } = R;
  const rng = new RNG(`ring${i}`);
  const hole = jellipse(cx, cy, rx, ry, { amp: 0.1, n: 44, seed: `ring${i}h` });
  const outer = jellipse(cx + Math.cos(spin) * thick * 0.22, cy + Math.sin(spin) * thick * 0.16, rx + thick, ry + thick * 0.85, { amp: 0.06, n: 36, seed: `ring${i}o` });
  const ring = new Path2D();
  ring.addPath(pathOf(outer));
  ring.addPath(pathOf(hole));
  setShadow(ctx, { color: 'rgba(10,6,4,0.75)', blur: 12, x: -2, y: 6 });
  ctx.fillStyle = TUNNEL[0];
  ctx.fill(ring, 'evenodd');
  clearShadow(ctx);
  ctx.save();
  ctx.clip(ring, 'evenodd');
  const span = (thick / rx) * 1.25;
  const bands = 3 + Math.round(i * 0.8);
  for (let j = 0; j < bands; j++) {
    const d0 = 1 - j / bands, d1 = 1 - (j + 1) / bands;
    const r0 = 1 + span * d0 + 0.03, r1 = 1 + span * d1 - 0.02;
    const inner = 1 - (d0 + d1) / 2;
    let a = rng.range(0, 0.4);
    while (a < Math.PI * 2 + 0.4) {
      const da = rng.range(0.16, 0.4) * (1.15 - 0.45 * inner);
      const a0 = a, a1 = a + da, am = a + da / 2;
      const pts = [];
      for (let s = 0; s <= 3; s++) {
        const aa = lerp(a0, a1, s / 3), rr = r0 + rng.range(-0.025, 0.02);
        pts.push([cx + Math.cos(aa) * rx * rr, cy + Math.sin(aa) * ry * rr]);
      }
      for (let s = 3; s >= 0; s--) {
        const aa = lerp(a0, a1, s / 3), rr = r1 + rng.range(-0.03, 0.03);
        pts.push([cx + Math.cos(aa) * rx * rr, cy + Math.sin(aa) * ry * rr]);
      }
      const side = Math.pow(0.5 + 0.5 * Math.cos(am - phi), 1.7);
      const below = Math.sin(am) > 0.6 ? 0.1 : 0;
      const k = clamp(0.06 + boost + side * 0.62 * (0.35 + 0.65 * inner) + inner * 0.14 - below + rng.range(-0.07, 0.07));
      const p = pathOf(pts);
      ctx.save();
      ctx.translate(Math.cos(am) * 2.5, Math.sin(am) * 2.5 + 1.5);
      ctx.fillStyle = 'rgba(14,6,2,0.55)';
      ctx.fill(p);
      ctx.restore();
      ctx.fillStyle = vary(rampAt(TUNNEL, k), rng, 0.035);
      ctx.fill(p);
      bevelBands(ctx, p, { light: [-Math.cos(am), -Math.sin(am)], width: 1.8, hi: 0.2 + 0.4 * side, lo: 0.3, hiColor: '#fff2cc', soft: 0 });
      a = a1 - rng.range(0, 0.02);
    }
  }
  ctx.restore();
  // torn cream lip round the hole where the light grazes it
  ctx.save();
  ctx.clip(ring, 'evenodd');
  ctx.lineJoin = 'round';
  hole.forEach(([x, y], k) => {
    const n = hole[(k + 1) % hole.length];
    const a = Math.atan2(y - cy, x - cx);
    const lit = clamp(Math.cos(a - phi));
    if (lit <= 0.05) return;
    ctx.strokeStyle = rgba('#ffe2a0', 0.55 * lit);
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(n[0], n[1]); ctx.stroke();
  });
  ctx.restore();
}

export function addTunnel(S) {
  RINGS.forEach((R, i) => {
    const pad = R.thick + 60;
    S.plane(R.z, {
      name: `tunnel-ring${i}`, x: R.cx - R.rx - pad, y: R.cy - R.ry - pad, w: (R.rx + pad) * 2 + 40, h: (R.ry + pad) * 2,
      res: 0.75, mat: CAVE_STONE, edge: { width: 1.6, hi: 0.4, lo: 0.3, soft: 0.6, hiColor: '#fff1cc' }, shadow: { blur: 14 },
      draw: (ctx) => paintRing(ctx, R, i),
    }, tagged(['tunnel', 'rock']));
  });
}

// ---------------------------------------------------------------------------
// Back wall with the tunnel mouth cut out

export function addBackWall(S) {
  const mouth = jellipse(MOUTH.cx, MOUTH.cy, MOUTH.rx, MOUTH.ry, { amp: 0.09, n: 48, seed: 'mouth' });
  S.plane(2150, {
    name: 'back-wall', x: -260, y: -170, w: 2440, h: 960, res: 0.7, mat: CAVE_STONE,
    edge: { width: 2, hi: 0.45, lo: 0.3, soft: 0.6, hiColor: '#ffe9bc' }, shadow: { blur: 16 },
    draw(ctx) {
      plateWall(ctx, {
        x0: -260, y0: -170, x1: 2180, y1: 790, cell: 230, pal: ROCK.blue, seed: 'back', band: 5, lit: 0.12, rot: -0.25, rotJit: 0.35,
        skip: (x, y) => Math.hypot((x - MOUTH.cx) / (MOUTH.rx - 60), (y - MOUTH.cy) / (MOUTH.ry - 50)) < 1,
        shade: (x, y) => {
          const dm = Math.hypot((x - MOUTH.cx) / MOUTH.rx, (y - MOUTH.cy) / MOUTH.ry);
          return -0.24 + 0.2 * clamp(1 - Math.abs(y - 400) / 380) + 0.14 * clamp(1.6 - dm) - (y < 80 ? 0.12 : 0);
        },
      });
      // crystal light on the lower wall, warm spill round the mouth
      pool(ctx, 1080, 450, 560, '#3a7cff', 0.45, 'soft-light', 0.55);
      pool(ctx, 560, 330, 420, '#4f90ff', 0.28, 'soft-light', 0.7);
      pool(ctx, MOUTH.cx + 120, MOUTH.cy - 20, 420, '#ffb85a', 0.85, 'soft-light', 0.9);
      pool(ctx, MOUTH.cx + 180, MOUTH.cy + 40, 260, '#ffcf80', 0.35, 'screen', 1);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(pathOf(mouth));
      ctx.restore();
    },
  }, tagged(['rock', 'wall']));
}

// ---------------------------------------------------------------------------
// Stalactites

const ICE = {
  pale: ['#34609e', '#86b0e0', '#d8eaff'],
  blue: ['#122a62', '#2f5ea8', '#86b0e4'],
  navy: ['#0a1430', '#172a56', '#3e5c94'],
  dusk: ['#0d1124', '#1b2340', '#3c4a70'],
};

function paintCeilingRow(ctx, { x0, x1, base, amp, len, w, step, mixw, seed, bandPal, bandRight = null, split = 9999, light = LIGHT, top = -280, dense = null }) {
  const rng = new RNG(`ceil:${seed}`);
  const nz = noise(`ceilnz:${seed}`);
  const yAt = (x) => base + nz.n1(x * 0.004) * amp + nz.n1(x * 0.02 + 3) * amp * 0.3;
  const list = [];
  for (let x = x0; x < x1; x += step * rng.range(0.55, 1.25)) {
    const d = dense ? dense(x) : 1;
    if (!rng.chance(clamp(d))) continue;
    const long = rng.chance(0.22);
    const L = (long ? lerp(len[1] * 0.7, len[1], rng.next()) : lerp(len[0], len[1] * 0.6, Math.pow(rng.next(), 1.4))) * (0.7 + 0.3 * d);
    const ww = lerp(w[0], w[1], rng.next()) * (0.45 + 0.55 * L / len[1]);
    let r = rng.next(), kind = 'navy', acc = 0;
    for (const [k, p] of mixw) { acc += p; if (r <= acc) { kind = k; break; } }
    list.push({ x, L, ww, kind });
  }
  list.sort((a, b) => b.L - a.L);
  for (const s of list) {
    paintStalactite(ctx, {
      x: s.x, y: yAt(s.x) - 8, len: s.L, w: s.ww, lean: rng.range(-0.14, 0.14) * s.L, colors: ICE[s.kind],
      seed: `${seed}${Math.round(s.x)}`, light, ridge: rng.range(0.35, 0.7),
    });
  }
  // rock band the stalactites hang from
  const edge = [];
  for (let x = x0 - 40; x <= x1 + 40; x += 22) edge.push([x, yAt(x) + rng.range(-5, 9)]);
  const band = [[x0 - 40, top], ...edge, [x1 + 40, top]];
  const clipL = [[x0 - 60, top - 10], [split, top - 10], [split - 120, base + amp * 2 + 40], [x0 - 60, base + amp * 2 + 40]];
  setShadow(ctx, { color: 'rgba(2,4,12,0.7)', blur: 12, x: -3, y: 7 });
  ctx.fillStyle = bandPal.face[1];
  ctx.fill(pathOf(band));
  clearShadow(ctx);
  ctx.save();
  if (bandRight) {
    ctx.save();
    ctx.clip(pathOf(clipL));
    paintPlate(ctx, band, { pal: bandPal, light, seed: `${seed}band`, band: 12, lit: 0.45, torn: 0, shade: () => 0.35 });
    ctx.restore();
    const right = new Path2D();
    right.rect(x0 - 100, top - 100, x1 - x0 + 300, base + amp * 3 + 200 - top);
    right.addPath(pathOf(clipL));
    ctx.clip(right, 'evenodd');
    paintPlate(ctx, band, { pal: bandRight, light, seed: `${seed}bandR`, band: 10, lit: 0.4, torn: 0, shade: () => 0.32 });
  } else {
    paintPlate(ctx, band, { pal: bandPal, light, seed: `${seed}band`, band: 12, lit: 0.42, torn: 0, shade: () => 0.35 });
  }
  ctx.restore();
}

export function addCeiling(S) {
  const rows = [
    { z: 2100, x0: -260, x1: 2200, base: 80, amp: 34, len: [40, 190], w: [10, 24], step: 26, mixw: [['dusk', 0.5], ['navy', 0.35], ['blue', 0.12], ['pale', 0.03]], bandPal: ROCK.blue },
    { z: 1500, x0: -300, x1: 2240, base: 40, amp: 30, len: [60, 270], w: [12, 32], step: 40, mixw: [['navy', 0.5], ['blue', 0.38], ['pale', 0.12]], bandPal: ROCK.blue,
      dense: (x) => (x < 420 ? 0.35 : 1) },
    { z: 1050, x0: -340, x1: 2280, base: 6, amp: 24, len: [80, 300], w: [16, 44], step: 56, mixw: [['blue', 0.42], ['pale', 0.24], ['navy', 0.34]], bandPal: ROCK.wall, bandRight: ROCK.blue, split: 700,
      dense: (x) => (x < 480 ? 0.15 : x > 1180 && x < 1420 ? 0.5 : 1) },
    { z: 800, x0: -380, x1: 2320, base: -16, amp: 18, len: [110, 290], w: [24, 50], step: 62, mixw: [['pale', 0.42], ['blue', 0.36], ['navy', 0.22]], bandPal: ROCK.wall, bandRight: ROCK.blue, split: 640,
      dense: (x) => (x > 930 && x < 1180 ? 1 : x > 1500 && x < 1700 ? 0.9 : x > 640 && x < 1900 ? 0.35 : 0) },
  ];
  rows.forEach((r, i) => {
    const top = -220;
    S.plane(r.z, {
      name: `ceiling${i}`, x: r.x0 - 70, y: top - 10, w: r.x1 - r.x0 + 140, h: r.base + r.amp * 1.4 + r.len[1] + 40 - top,
      res: r.z >= 1500 ? 0.8 : 1, mat: CAVE_STONE, edge: { width: 1.5, hi: 0.4, lo: 0.3, soft: 0.6, hiColor: '#e8f4ff' }, shadow: { blur: 12 },
      draw: (ctx) => paintCeilingRow(ctx, { ...r, seed: `row${i}`, top }),
    }, tagged(['rock', 'ceiling']));
  });
}

// ---------------------------------------------------------------------------
// Side walls

export function addSideWalls(S) {
  const left = [[-420, -300], [700, -300], [610, -170], [470, 10], [340, 150], [262, 330], [214, 520], [170, 700], [-420, 760]];
  S.plane(1250, {
    name: 'left-wall', x: -430, y: -310, w: 1150, h: 1080, mat: CAVE_STONE, edge: { width: 2, hi: 0.45, lo: 0.3, soft: 0.6, hiColor: '#ffe6c0' }, shadow: { blur: 16 },
    draw(ctx) {
      ctx.save();
      ctx.clip(pathOf(left));
      plateWall(ctx, {
        x0: -420, y0: -300, x1: 720, y1: 770, cell: 250, pal: ROCK.wall, seed: 'leftwall', band: 12, lit: 0.36, slant: -0.3, rot: -0.85, rotJit: 0.3,
        shade: (x, y) => -0.05 + 0.15 * clamp(1 - Math.abs(y - 250) / 400) - (x < 0 ? 0.08 : 0),
      });
      pool(ctx, 260, 420, 360, '#5aa0ff', 0.6, 'soft-light', 1);
      ctx.restore();
    },
  }, tagged(['rock', 'wall']));

  const right = [[1800, -300], [2420, -300], [2420, 720], [1905, 720], [1876, 540], [1846, 330], [1826, 150], [1790, 0]];
  S.plane(1000, {
    name: 'right-wall', x: 1770, y: -310, w: 660, h: 1040, mat: CAVE_STONE, edge: { width: 2, hi: 0.45, lo: 0.3, soft: 0.6, hiColor: '#d8ecff' }, shadow: { blur: 16 },
    draw(ctx) {
      ctx.save();
      ctx.clip(pathOf(right));
      plateWall(ctx, {
        x0: 1770, y0: -300, x1: 2420, y1: 730, cell: 190, pal: ROCK.blue, seed: 'rightwall', band: 10, lit: 0.42, slant: 0.3, rot: 0.9, rotJit: 0.3,
        shade: (x, y) => -0.05 + 0.12 * clamp(1 - Math.abs(y - 300) / 400),
      });
      pool(ctx, 1860, 520, 320, '#6ab0ff', 0.7, 'soft-light', 1);
      ctx.restore();
    },
  }, tagged(['rock', 'wall']));
}

// ---------------------------------------------------------------------------
// Ledges

// One ledge on its own plane; the sprite box is computed from the outline.
export function ledgePlane(S, name, z, o, { res = 1, tags = ['rock'] } = {}) {
  const [hl, hr] = Array.isArray(o.h) ? o.h : [o.h, o.h];
  const b = boxOf(o.front);
  const fl = o.flare ?? [10, 10];
  const box = { x: Math.floor(b.x - fl[0] - 30), y: Math.floor(b.y - (o.depth ?? 30) * 1.3 - 24), w: 0, h: 0 };
  box.w = Math.ceil(b.w + fl[0] + fl[1] + 60);
  box.h = Math.ceil(b.h + (o.depth ?? 30) * 1.3 + Math.max(hl, hr) + 60);
  return S.plane(z, {
    name, ...box, res, mat: CAVE_STONE, edge: { width: 1.8, hi: 0.42, lo: 0.32, soft: 0.6, hiColor: o.hiColor ?? '#f4e6cc' }, shadow: { blur: 13 },
    draw: (ctx) => paintLedge(ctx, { light: LIGHT, ...o }),
  }, { tags });
}

const BLUE_GLOW = '#58a6ff';
const GOLD_GLOW = '#ffc060';

// Every ledge, back to front. Returns nothing; crystals and water are placed to fit.
export function addLedges(S) {
  // tunnel floor and the steps the stream comes down
  ledgePlane(S, 'ledge-tunnel', 2320, { front: [[1380, 452], [1500, 448], [1620, 458]], depth: 16, h: 46, pal: ROCK.warm, seed: 'lt',
    glow: [{ x: 1500, y: 440, r: 200, amount: 0.5, color: GOLD_GLOW }], hiColor: '#ffe8b8' });
  ledgePlane(S, 'ledge-right-back', 2020, { front: [[1630, 428], [1760, 420], [1930, 426]], depth: 22, h: 90, pal: ROCK.ledge, seed: 'lrb',
    glow: [{ x: 1730, y: 420, r: 160, amount: 0.5, color: BLUE_GLOW }] });
  ledgePlane(S, 'ledge-step', 1920, { front: [[1420, 510], [1545, 504], [1680, 512]], depth: 20, h: 58, pal: ROCK.warm, seed: 'lst',
    glow: [{ x: 1545, y: 505, r: 170, amount: 0.45, color: GOLD_GLOW }] });
  ledgePlane(S, 'ledge-back-left', 1820, { front: [[860, 484], [990, 476], [1120, 490]], depth: 22, h: 70, pal: ROCK.ledge, seed: 'lbl',
    glow: [{ x: 990, y: 470, r: 180, amount: 0.6, color: BLUE_GLOW }] });
  ledgePlane(S, 'ledge-back-centre', 1720, { front: [[1110, 548], [1240, 540], [1380, 552]], depth: 24, h: 70, pal: ROCK.ledge, seed: 'lbc',
    glow: [{ x: 1230, y: 540, r: 200, amount: 0.6, color: BLUE_GLOW }] });
  ledgePlane(S, 'ledge-fall', 1660, { front: [[1150, 600], [1290, 604], [1460, 606], [1530, 630]], depth: 8, h: 110, flare: [10, 20], pal: ROCK.ledge, seed: 'lf',
    glow: [{ x: 1370, y: 640, r: 200, amount: 0.5, color: BLUE_GLOW }] });
  ledgePlane(S, 'ledge-river-right', 1500, { front: [[1450, 652], [1580, 642], [1710, 654]], depth: 26, h: 76, pal: ROCK.ledge, seed: 'lrr',
    glow: [{ x: 1580, y: 650, r: 170, amount: 0.4, color: BLUE_GLOW }] });
  ledgePlane(S, 'ledge-mid', 1410, { front: [[860, 620], [1030, 610], [1200, 628]], depth: 32, h: 100, pal: ROCK.ledge, seed: 'lm',
    glow: [{ x: 1010, y: 612, r: 200, amount: 0.7, color: BLUE_GLOW }] });
  // the boulder behind the fox and the rock under the big left cluster
  ledgePlane(S, 'boulder', 1360, { front: [[392, 456], [520, 440], [650, 432], [800, 446], [930, 480]], depth: 48, h: [250, 200], flare: [20, 10], pal: ROCK.ledge, seed: 'bo',
    glow: [{ x: 650, y: 440, r: 280, amount: 0.7, color: BLUE_GLOW }, { x: 880, y: 520, r: 200, amount: 0.3, color: BLUE_GLOW }] });
  ledgePlane(S, 'rock-left', 1180, { front: [[20, 604], [180, 590], [330, 596], [480, 618]], depth: 46, h: 230, flare: [10, 20], pal: ROCK.ledge, seed: 'rl',
    glow: [{ x: 290, y: 600, r: 260, amount: 0.8, color: BLUE_GLOW }] });
  // stepping stones in the pool
  ledgePlane(S, 'stone-flat', 1200, { front: [[1410, 846], [1560, 840], [1734, 850]], depth: 34, h: 28, pal: ROCK.ledge, seed: 'sf',
    glow: [{ x: 1500, y: 830, r: 220, amount: 0.4, color: GOLD_GLOW }] });
  ledgePlane(S, 'stone-crystal', 1100, { front: [[846, 912], [1080, 902], [1324, 920]], depth: 40, h: 36, pal: ROCK.ledge, seed: 'sc',
    glow: [{ x: 1040, y: 900, r: 240, amount: 0.8, color: BLUE_GLOW }] });
  ledgePlane(S, 'rock-fox-right', 1050, { front: [[690, 744], [820, 736], [960, 756]], depth: 30, h: 112, pal: ROCK.ledge, seed: 'rfr',
    glow: [{ x: 820, y: 736, r: 200, amount: 0.8, color: BLUE_GLOW }] });
  // the fox's ledge
  ledgePlane(S, 'hero-ledge', 990, {
    front: [[-430, 836], [-120, 816], [150, 804], [430, 810], [700, 820], [940, 840]], depth: 62, h: [290, 270], flare: [20, 40], pal: ROCK.ledge, seed: 'hero',
    glow: [{ x: 300, y: 800, r: 320, amount: 0.6, color: BLUE_GLOW }, { x: 860, y: 820, r: 220, amount: 0.5, color: BLUE_GLOW }], detail: 1.2,
  }, { res: 1.1, tags: ['rock', 'ledge'] });
  ledgePlane(S, 'right-ledge', 900, { front: [[1545, 714], [1700, 704], [1880, 700], [2360, 694]], depth: 40, h: 160, flare: [16, 10], pal: ROCK.ledge, seed: 'rr',
    glow: [{ x: 1830, y: 700, r: 300, amount: 0.8, color: BLUE_GLOW }] }, { res: 1.1 });
  // the lip the pool spills over on its way down toward the lens
  ledgePlane(S, 'pool-lip', 860, { front: [[1150, 962], [1372, 952], [1640, 966]], depth: 18, h: 46, flare: [14, 14], pal: ROCK.ledge, seed: 'plip',
    glow: [{ x: 1372, y: 950, r: 240, amount: 0.55, color: GOLD_GLOW }, { x: 1180, y: 960, r: 160, amount: 0.5, color: BLUE_GLOW }] });
}

export function addForegroundRocks(S) {
  S.plane(755, {
    name: 'fg-rocks-cr', x: 640, y: 900, w: 1260, h: 340, mat: CAVE_STONE, edge: { width: 1.8, hi: 0.42, lo: 0.32, soft: 0.6, hiColor: '#f4e6cc' }, shadow: { blur: 13 },
    draw(ctx) {
      paintLedge(ctx, { light: LIGHT, front: [[700, 990], [950, 976], [1196, 1002]], depth: 34, h: 220, flare: [10, 26], pal: ROCK.ledge, seed: 'fgc', glow: [{ x: 1040, y: 960, r: 260, amount: 0.5, color: BLUE_GLOW }] });
      paintLedge(ctx, { light: LIGHT, front: [[1572, 996], [1700, 980], [1840, 990]], depth: 34, h: 220, flare: [26, 10], pal: ROCK.ledge, seed: 'fgr', glow: [{ x: 1560, y: 990, r: 240, amount: 0.45, color: GOLD_GLOW }] });
    },
  }, { tags: ['rock'] });
  ledgePlane(S, 'fg-rock-br', 660, { front: [[1580, 1036], [1900, 1016], [2420, 1024]], depth: 30, h: 220, pal: ROCK.ledge, seed: 'fgbr',
    glow: [{ x: 1820, y: 1030, r: 300, amount: 0.8, color: BLUE_GLOW }] }, { res: 1 });
  ledgePlane(S, 'fg-rock-bc', 620, { front: [[360, 1064], [560, 1050], [800, 1070]], depth: 26, h: 200, pal: ROCK.ledge, seed: 'fgbc',
    glow: [{ x: 600, y: 1060, r: 240, amount: 0.8, color: BLUE_GLOW }] }, { res: 1 });
  ledgePlane(S, 'fg-rock-l', 540, { front: [[-500, 1046], [150, 1034], [460, 1068]], depth: 30, h: 220, pal: ROCK.ledge, seed: 'fgl',
    glow: [{ x: 120, y: 1040, r: 320, amount: 0.8, color: BLUE_GLOW }] }, { res: 1 });
}

export { jag, mix };
