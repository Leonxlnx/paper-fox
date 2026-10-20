// The hero: an orange paper fox, silhouette first, then rows of torn fur tufts.
//
//   createFox(S, opts)   bakes every animated part as its own sprite and adds one plane
//                        that poses and draws the fox each frame.
//
// Construction. The body (neck, back, rump, haunch, belly, chest) is one smooth cut-out
// per pose with soft light and shade, covered by shingled rows of jagged fur strips
// (fox-paint.js paintBody); the haunch is part of that silhouette. Only what animates is
// separate: tail segments, leg bones, paws, mane, ruff, head, ears and loose tufts. Each
// is painted once into a sprite at build time. Per frame the
// parts are only transformed through a small bone hierarchy (body -> neck -> head ->
// ears, body -> tail chain, two-bone IK legs) and stacked back to front, each casting
// a soft contact shadow on the paper already below it. The stack is composed in an
// offscreen buffer so the fox throws one clean drop shadow on the scene behind it.
//
// Motion is a pure function of t: breathing, weight shifts, a tail that sways with
// follow-through along its length, occasional ear flicks, a head that looks up or
// around, a diagonal-pair walk cycle whose planted paws never skate, and wind that
// lifts the tail and flutters the loose fur.

import { RNG, noise, hash1 } from '../core/rng.js';
import { surface, silhouette } from '../core/canvas.js';
import { shadowOf } from '../core/paper.js';
import { clamp, lerp, smoothstep } from '../core/ease.js';
import { TAU } from '../core/geom.js';
import { rigFor, ik2, bendOf } from './fox-rig.js';
import {
  Paint, paintBody, paintTailSegment, tailFrame, paintLegBone, paintPaw, paintHead, paintEar,
  paintMane, paintRuff, paintTuft, paintGroundShadow, tintColor, EARS,
} from './fox-paint.js';

// ---------------------------------------------------------------------------
// Palette and paper

// Sampled from the reference foxes (ref02 under moonlight, ref01 / ref10 in warm light).
export const FOX_PALETTE = {
  fur: ['#5e1503', '#86240a', '#a8340f', '#c24416', '#d8581f', '#e86d2c'], // shadow -> lit orange
  furHi: '#f59a5a',                                                      // sunlit tips along the back and crown
  gap: '#6a1f0b',                                                        // shows between flakes
  ink: 'rgba(58,9,0,0.62)',                                              // contact shadow under flakes
  shade: '#360b02',                                                      // shadow cast between parts
  white: ['#9c8a88', '#c8b2a0', '#e3cdb4', '#f3e4cf'],                   // lavender shade -> cream
  whiteInk: 'rgba(80,55,70,0.4)',
  leg: ['#1a0f0b', '#2a1b15', '#3a2620', '#5a3c2d'],                     // legs and paws (paws lighter)
  legInk: 'rgba(10,4,0,0.55)',
  ear: '#24120b',                                                        // ear backs and tips
  eye: '#160c08',
  nose: '#1b110c',
};

// Fur paper: fibre and felt over a faint crumple.
export const FOX_PAPER = [{ tex: 'fiber', amt: 0.9 }, { tex: 'felt', amt: 0.6, scale: 0.5 }, { tex: 'crumple', amt: 0.3, scale: 0.4 }];

// Palette with an optional grade { color, amount, mode: 'multiply' | 'mix' } and overrides.
export function foxPalette({ tint = null, palette = null } = {}) {
  const base = { ...FOX_PALETTE, ...(palette || {}) };
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = tintColor(v, tint);
  return out;
}

// ---------------------------------------------------------------------------
// Motion helpers

const DEG = 180 / Math.PI;

// Occasional twitches: a damped wobble at deterministic, irregular times.
function twitches(t, period, seed, chance = 0.7) {
  let v = 0;
  const k0 = Math.floor(t / period);
  for (let k = k0 - 1; k <= k0; k++) {
    if (hash1(k + 1000, seed) > chance) continue;
    const tau = t - (k + 0.1 + 0.7 * hash1(k + 1000, seed + 7)) * period;
    if (tau <= 0 || tau > 1.2) continue;
    v += Math.exp(-tau / 0.17) * Math.sin((tau / 0.32) * TAU) * smoothstep(1.2, 0.85, tau);
  }
  return v;
}

const POSES = {
  stand: { yaw: 0, walk: 0 },
  walk: { yaw: 0.92, walk: 1 },
  sit: { yaw: 0, walk: 0 },
};

// Gait: diagonal pairs (near hind + far fore, then far hind + near fore), each foot
// planted for DUTY of the cycle while the body travels over it.
const DUTY = 0.6;
const PHASE = { nh: 0, ff: 0.06, fh: 0.5, nf: 0.56 };
// The near legs' upper bones go under the body so they come out from beneath the
// haunch and chest; their lower bones and paws go over it.
// Standing and walking, the tail leaves the croup and lies over the rump and the back of
// the haunch, so it goes over the body (and the loose back tufts over its root).
const DRAW = ['fh', 'ff', 'tail', 'nh:upper', 'nf:upper', 'torso', 'nh:lower', 'nf:lower', 'head'];
const DRAW_TAIL_OVER = ['fh', 'ff', 'nh:upper', 'nf:upper', 'torso', 'tail', 'tufts', 'nh:lower', 'nf:lower', 'head'];

// ---------------------------------------------------------------------------

// createFox(S, opts) -> { layer, rig, parts, state(t), pointAt(t, name) }
//   z        plane depth (hero band 900-1000)
//   x, y     ground point between the paws, in plane coords
//   scale    1 = the ref02 fox (~355 px from ear tip to paws)
//   pose     'stand' | 'walk' | 'sit'
//   facing   1 = facing right, -1 = mirrored
//   yaw      0 = rear three-quarter (ref02), 1 = side-on (ref01); walk defaults to 0.85
//   look     head raise, -1 (looking ahead) .. 1 (chin up at the sky); 0 = ref02
//   wind     0..1 storm wind (tail streams, loose fur flutters)
//   speed    walk speed in fox units / s when the fox walks in place
//   stride   walk stride in fox units (default 150)
//   motion   t -> { x, y, look, wind, walk (0..1 gait amount), dist, speed, breathe } per-frame overrides;
//            when x changes over time the walk phase follows the distance travelled
//   rim      { color, amount, dir, width, glow } coloured rim light on the edges of the whole silhouette\n//            facing dir (screen space, default: the scene light), e.g. crystal light or star glow
//   tint     { color, amount, mode } palette grade for dusk / night / cave
//   palette  partial FOX_PALETTE override
//   shadow   { alpha, inner } drop-shadow / contact-shadow strength (defaults from the scene)
//   detail   bake resolution per fox unit at scale 1 (default 1.75, room for camera push-ins)
//   seed     varies the flake layout
export function createFox(S, opts = {}) {
  const pose = opts.pose ?? 'stand';
  const preset = POSES[pose] ?? POSES.stand;
  const o = {
    z: 950, x: 620, y: 706, scale: 1, facing: 1, yaw: preset.yaw, look: 0, wind: 0, speed: 125, stride: 150,
    detail: 1.75, seed: 'fox', ...opts,
  };
  const rig = rigFor(pose, o.yaw);
  const pal = foxPalette(o);
  const light = [S.light[0] * o.facing, S.light[1]];
  const res = o.detail * o.scale;
  const rng = new RNG(o.seed);
  const shadowOpts = { alpha: S.shadow.alpha, inner: 0.55, ...(o.shadow || {}) };

  // --- bake -------------------------------------------------------------------
  const bake = (name, painter, { blur = 2.8, edge = {} } = {}) => {
    const P = new Paint();
    painter(P, rng.fork(name));
    const box = P.box(10);
    const s = S.sprite({
      name: `fox-${name}`, ...box, res, mat: FOX_PAPER, light,
      edge: { width: 1.3, hi: 0.32, lo: 0.3, soft: 0.6, ...edge }, shadow: { blur },
      draw: (ctx) => P.draw(ctx),
    });
    // Contact shadows between parts are deep red-brown, like shade on orange paper;
    // the drop shadow on the scene stays neutral and softer.
    s.inner = silhouette(s.shadow.canvas, pal.shade);
    const far = shadowOf(s.canvas, 9 * res);
    s.far = { canvas: far.canvas, pad: far.pad / res };
    return s;
  };

  const legs = {};
  for (const [key, L] of Object.entries(rig.legs)) {
    const far = !!L.far;
    // The upper bones start hidden under the body, so only their lower, dark part shows.
    const up = L.hind ? [20, 13, 0.6] : [15, 13, 0.32];
    const lo = L.hind ? [12.5, 10.5] : [13, 11.5];
    legs[key] = {
      ...L,
      l1: Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]),
      l2: Math.hypot(L.c[0] - L.b[0], L.c[1] - L.b[1]),
      bend: bendOf(L.a, L.b, L.c),
      upper: bake(`${key}-upper`, (P, r) => paintLegBone(P, pal, r, light, L.a, L.b, up[0], up[1], up[2], { far })),
      lower: bake(`${key}-lower`, (P, r) => paintLegBone(P, pal, r, light, L.b, L.c, lo[0], lo[1], 0, { far, bulge: 0.05 }), { blur: 2.5 }),
      paw: bake(`${key}-paw`, (P, r) => paintPaw(P, pal, r, light, L.c, L.toe, { far }), { blur: 2.2 }),
    };
  }

  // Three tail segments; the last starts just before the white brush, so the whole brush
  // (long blades converging on the point) is one piece and the orange laps over its base.
  const W0 = Math.max(0.3, (rig.tail.white ?? 0.5) - 0.06);
  const TAIL_U = [0, W0 * 0.55, W0, 1];
  const frame = tailFrame(rig);
  const tail = [0, 1, 2].map((i) => ({
    pivot: frame.at(TAIL_U[i]).p,
    s: bake(`tail${i}`, (P, r) => paintTailSegment(P, rig, pal, r, light, TAIL_U[i], TAIL_U[i + 1]), { blur: 3.6 }),
  }));

  // One sprite for the whole body silhouette: neck, back, rump, haunch, belly, chest.
  const torso = bake('torso', (P, r) => paintBody(P, rig, pal, r, light), { blur: 4 });
  const mane = bake('mane', (P, r) => paintMane(P, rig, pal, r, light));
  const ruff = bake('ruff', (P, r) => paintRuff(P, rig, pal, r, light));
  const head = bake('head', (P, r) => paintHead(P, rig, pal, r, light), { blur: 3.6 });
  const earN = bake('ear-near', (P, r) => paintEar(P, pal, r, light, 'near', rig.earScale), { blur: 2.6 });
  const earF = bake('ear-far', (P, r) => paintEar(P, pal, r, light, 'far', rig.earScale), { blur: 2.6 });

  // Loose tufts that flutter: [parent, x, y, angle, length, white].
  const back = rig.torso.backLine;
  const tuftSpec = [
    ['body', ...back[1], 2.6, 32, false], ['body', ...back[2], 2.55, 34, false], ['body', ...back[3], 2.4, 32, false],
    ['neck', -30, -216, 2.3, rig.trim ? 25 : 32, false], ['neck', -10, -202, 2.0, rig.trim ? 24 : 30, false],
    ['neck', 62, -118, 1.75, 28, true], ['neck', 72, -128, 1.6, 26, true], ['neck', 54, -140, 1.9, 26, true],
    ['tail2', ...frame.at(0.8).p, Math.atan2(frame.at(0.8).t[1], frame.at(0.8).t[0]), 34, true],
  ];
  const tufts = tuftSpec.map(([parent, x, y, a, len, white], i) => ({
    parent, x, y, a,
    s: bake(`tuft${i}`, (P, r) => paintTuft(P, pal, r, light, x, y, a, len, white), { blur: 2.2 }),
  }));

  const groundCanvas = (() => {
    const g = rig.ground;
    const pad = 20;
    const box = { x: g.c[0] - g.rx - pad, y: g.c[1] - g.ry - pad, w: (g.rx + pad) * 2, h: (g.ry + pad) * 2 };
    const k = Math.min(res, 1);
    const { canvas, ctx } = surface(box.w * k, box.h * k);
    ctx.scale(k, k);
    ctx.translate(-box.x, -box.y);
    paintGroundShadow(ctx, g.c, g.rx, g.ry);
    return { canvas, ...box };
  })();

  // Local bounds of everything, padded for motion.
  const all = [torso, mane, ruff, head, earN, earF, ...tail.map((p) => p.s), ...tufts.map((p) => p.s),
    ...Object.values(legs).flatMap((L) => [L.upper, L.lower, L.paw])];
  const bounds = all.reduce((b, s) => ({
    x0: Math.min(b.x0, s.x), y0: Math.min(b.y0, s.y), x1: Math.max(b.x1, s.x + s.w), y1: Math.max(b.y1, s.y + s.h),
  }), { x0: groundCanvas.x, y0: groundCanvas.y, x1: groundCanvas.x + groundCanvas.w, y1: groundCanvas.y + groundCanvas.h });
  const PAD = 70;

  // --- motion -----------------------------------------------------------------
  const nz = noise(`${o.seed}:motion`);
  const x0 = o.motion ? (o.motion(0)?.x ?? o.x) : o.x;

  function state(t) {
    const m = (o.motion && o.motion(t)) || {};
    const st = {
      t,
      x: m.x ?? o.x, y: m.y ?? o.y,
      look: m.look ?? o.look, wind: m.wind ?? o.wind,
      walk: m.walk ?? preset.walk, breathe: m.breathe ?? 1,
    };
    if (m.dist !== undefined) st.dist = m.dist;
    else if (m.x !== undefined && st.walk > 0) st.dist = ((st.x - x0) * o.facing) / o.scale;
    else st.dist = (m.speed ?? o.speed) * t;
    return st;
  }

  // Bone transforms (fox units) for state st.
  function poseAt(st) {
    const { t, walk: w, wind } = st;
    const ph = st.dist / o.stride;
    const br = Math.sin((t / 3.5) * TAU) * st.breathe;

    // Body: weight shift, walk bob, breathing about the belly.
    const shift = [nz.n1(t * 0.13) * 1.6, nz.n1(t * 0.11 + 9) * 0.6];
    const bob = -w * 2.6 * Math.cos(4 * Math.PI * (ph - 0.3)) - w * 1.2;
    const pitch = w * 0.012 * Math.sin(TAU * ph);
    const bp = rig.breath;
    let body = new DOMMatrix().translate(shift[0], shift[1] + bob)
      .translate(rig.hip[0], rig.hip[1]).rotate(pitch * DEG).translate(-rig.hip[0], -rig.hip[1])
      .translate(bp[0], bp[1]).scale(1 + 0.004 * br, 1 + 0.009 * br).translate(-bp[0], -bp[1]);

    // Neck group (mane, ruff, head, ears) and head.
    const np = rig.neckPivot, hp = rig.headPivot;
    const look = clamp(st.look, -1.5, 1.5);
    const neckRot = 0.012 * br + w * 0.018 * Math.sin(4 * Math.PI * (ph - 0.42)) - look * 0.035;
    const group = body.translate(rig.neckOffset[0] - look * 5, rig.neckOffset[1] - 0.9 * br - look * 4)
      .translate(np[0], np[1]).rotate((neckRot + (rig.neckTilt ?? 0)) * DEG).translate(-np[0], -np[1]);
    const headRot = rig.headTilt - look * 0.22 + 0.035 * nz.n1(t * 0.23 + 3) + 0.01 * Math.sin((t / 3.5) * TAU + 0.8)
      + w * 0.02 * Math.sin(4 * Math.PI * (ph - 0.5));
    const headM = group.translate(hp[0], hp[1]).rotate(headRot * DEG).scale(rig.headScale).translate(-hp[0], -hp[1]);
    const ear = (which, period, seed, side) => {
      const b = EARS[which].base;
      const a = -0.3 * twitches(t, period, seed) - 0.14 * wind + side * 0.03 * nz.n1(t * 0.4 + seed);
      return headM.translate(b[0], b[1]).rotate(a * DEG).translate(-b[0], -b[1]);
    };

    // Tail chain with follow-through: each segment repeats the motion of its parent later.
    const sway = (tt) => 0.032 * Math.sin((tt / 4.4) * TAU) + 0.022 * nz.n1(tt * 0.33 + 5);
    const tailRot = [0, 1, 2].map((i) => sway(t - i * 0.32) * (1 + i * 0.3)
      + w * 0.05 * (1 + i * 0.3) * Math.sin(TAU * (ph - 0.2 - i * 0.12))
      + wind * (i === 0 ? 0.24 : 0.12) + wind * 0.09 * (1 + i * 0.7) * nz.n1(t * 3.4 - i * 0.9));
    const tailM = [];
    let parent = body;
    for (let i = 0; i < 3; i++) {
      const p = tail[i].pivot;
      parent = parent.translate(p[0], p[1]).rotate(tailRot[i] * DEG).translate(-p[0], -p[1]);
      tailM.push(parent);
    }

    // Legs: planted paws (or the gait's foot path) solved back to the hips with IK.
    const Ls = DUTY * o.stride * w;
    const legM = {};
    for (const [key, L] of Object.entries(legs)) {
      let dx = 0, lift = 0, pawRot = 0;
      if (w > 0) {
        const p = ((ph + PHASE[key]) % 1 + 1) % 1;
        if (p < DUTY) dx = Ls * (0.5 - p / DUTY);
        else {
          const s = (p - DUTY) / (1 - DUTY);
          dx = Ls * (-0.5 + (0.5 - 0.5 * Math.cos(Math.PI * s)));
          lift = (L.hind ? 13 : 17) * w * Math.sin(Math.PI * s);
          pawRot = (L.hind ? 0.45 : 1.0) * w * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.15)), 1.4);
        }
      }
      const A = [body.a * L.a[0] + body.c * L.a[1] + body.e, body.b * L.a[0] + body.d * L.a[1] + body.f];
      const C = [L.c[0] + dx, L.c[1] - lift];
      const B = ik2(A, C, L.l1, L.l2, L.bend);
      const ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
      const d1 = ang(A, B) - ang(L.a, L.b);
      const d2 = ang(B, C) - ang(L.b, L.c);
      const Cr = [B[0] + Math.cos(ang(L.b, L.c) + d2) * L.l2, B[1] + Math.sin(ang(L.b, L.c) + d2) * L.l2];
      legM[key] = {
        upper: new DOMMatrix().translate(A[0], A[1]).rotate(d1 * DEG).translate(-L.a[0], -L.a[1]),
        lower: new DOMMatrix().translate(B[0], B[1]).rotate(d2 * DEG).translate(-L.b[0], -L.b[1]),
        paw: new DOMMatrix().translate(Cr[0], Cr[1]).rotate(pawRot * DEG).translate(-L.c[0], -L.c[1]),
      };
    }

    // Loose tufts: idle shiver, strong flutter in the wind.
    const bones = { body, neck: group, tail2: tailM[2] };
    const tuftM = tufts.map((f, i) => {
      const a = (0.025 + 0.28 * wind) * nz.n1(t * (1.1 + wind * 4) + i * 1.7) + wind * 0.12;
      return bones[f.parent].translate(f.x, f.y).rotate(a * DEG).translate(-f.x, -f.y);
    });

    return { body, group, headM, earN: ear('near', 4.7, 11, 1), earF: ear('far', 6.3, 23, -1), tailM, legM, tuftM };
  }

  // Back-to-front draw list: [sprite, matrix, inner-shadow strength].
  const tailOver = pose !== 'sit';
  function stack(B) {
    const out = [];
    const tuftsOf = (parent) => tufts.forEach((f, i) => { if (f.parent === parent) out.push([f.s, B.tuftM[i], 0.8]); });
    for (const part of tailOver ? DRAW_TAIL_OVER : DRAW) {
      const [key, bit] = part.split(':');
      if (key in legs) {
        const L = legs[key], M = B.legM[key];
        if (bit !== 'lower') out.push([L.upper, M.upper, 0.8]);
        if (bit !== 'upper') out.push([L.lower, M.lower, 0.8], [L.paw, M.paw, 0.9]);
      } else if (part === 'tail') {
        for (let i = 2; i >= 0; i--) {
          out.push([tail[i].s, B.tailM[i], i === 2 ? 0.6 : 1]);
          if (i === 2) tuftsOf('tail2');
        }
      } else if (part === 'torso') {
        out.push([torso, B.body, 1]);
        if (!tailOver) tuftsOf('body');
      } else if (part === 'tufts') {
        tuftsOf('body');
      } else if (part === 'head') {
        out.push([mane, B.group, 0.6]);
        tuftsOf('neck');
        out.push([earF, B.earF, 0.7], [ruff, B.group, 0.8], [head, B.headM, 0.7], [earN, B.earN, 1]);
      }
    }
    return out;
  }

  // --- render -----------------------------------------------------------------
  function render(ctx, t, env) {
    const st = state(t);
    const B = poseAt(st);
    const list = stack(B);
    const base = ctx.getTransform();
    const root = new DOMMatrix([o.scale * o.facing, 0, 0, o.scale, st.x, st.y]);
    const dev = base.multiply(root);

    // Device-space box of the fox.
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [x, y] of [[bounds.x0 - PAD, bounds.y0 - PAD], [bounds.x1 + PAD, bounds.y0 - PAD], [bounds.x0 - PAD, bounds.y1 + PAD], [bounds.x1 + PAD, bounds.y1 + PAD]]) {
      const p = dev.transformPoint(new DOMPoint(x, y));
      bx0 = Math.min(bx0, p.x); by0 = Math.min(by0, p.y); bx1 = Math.max(bx1, p.x); by1 = Math.max(by1, p.y);
    }
    bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0));
    bx1 = Math.min(cw, Math.ceil(bx1)); by1 = Math.min(ch, Math.ceil(by1));
    const bw = bx1 - bx0, bh = by1 - by0;
    if (bw <= 0 || bh <= 0) return;

    const fox = pooled('fox', bw, bh), mask = pooled('mask', bw, bh);
    const sh = env.shadow || {};
    const dx = sh.dx ?? 0, dy = sh.dy ?? 8;
    const toBuf = new DOMMatrix().translate(-bx0, -by0).multiply(base);
    const drawM = toBuf.multiply(root);
    const innerM = toBuf.translate(dx * 0.45, dy * 0.45).multiply(root);
    const dropM = toBuf.translate(dx, dy).multiply(root);

    const F = fox.ctx, K = mask.ctx;
    for (const c of [F, K]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, bw, bh);
    }
    K.setTransform(drawM);
    K.drawImage(groundCanvas.canvas, groundCanvas.x, groundCanvas.y, groundCanvas.w, groundCanvas.h);
    const inner = shadowOpts.inner;
    for (const [s, m, k] of list) {
      if (s.shadow && inner > 0) {
        F.setTransform(innerM.multiply(m));
        F.globalCompositeOperation = 'source-atop';
        F.globalAlpha = Math.min(1, inner * k);
        const p = s.shadow.pad;
        F.drawImage(s.inner, s.x - p, s.y - p, s.w + 2 * p, s.h + 2 * p);
      }
      F.setTransform(drawM.multiply(m));
      F.globalCompositeOperation = 'source-over';
      F.globalAlpha = 1;
      F.drawImage(s.canvas, s.x, s.y, s.w, s.h);
      K.setTransform(dropM.multiply(m));
      const q = s.far.pad;
      K.drawImage(s.far.canvas, s.x - q, s.y - q, s.w + 2 * q, s.h + 2 * q);
    }

    if (rim) applyRim(fox, pooled('rim', bw, bh), bw, bh, rim, base.a * o.scale);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * (sh.alpha ?? shadowOpts.alpha);
    ctx.drawImage(mask.canvas, 0, 0, bw, bh, bx0, by0, bw, bh);
    ctx.globalAlpha = ga;
    ctx.drawImage(fox.canvas, 0, 0, bw, bh, bx0, by0, bw, bh);
    ctx.restore();
  }

  const rim = o.rim && o.rim.amount ? {
    color: '#fff1d0', width: 3, glow: 0.35, ...o.rim,
    dir: o.rim.dir ?? S.light,
  } : null;

  const layer = S.add({ name: 'fox', z: o.z, render, tags: ['fox'] });

  // Plane-space position of a named point at time t: 'nose', 'head', 'chest', 'ground'.
  function pointAt(t, name = 'head') {
    const st = state(t);
    const B = poseAt(st);
    const P = { nose: [[127, -285], B.headM], head: [[40, -262], B.headM], chest: [[70, -150], B.group], ground: [[0, 0], new DOMMatrix()] }[name];
    const p = P[1].transformPoint(new DOMPoint(P[0][0], P[0][1]));
    return { x: st.x + p.x * o.scale * o.facing, y: st.y + p.y * o.scale };
  }

  return { layer, rig, palette: pal, state, pointAt, options: o };
}

// Rim light on the composed fox: the band of its silhouette facing dir, tinted and laid
// on top inside the silhouette, plus a faint halo just outside it. k = device px per fox unit.
function applyRim(fox, buf, w, h, rim, k) {
  const F = fox.ctx, R = buf.ctx;
  const len = Math.hypot(rim.dir[0], rim.dir[1]) || 1;
  const dx = (rim.dir[0] / len) * rim.width * k, dy = (rim.dir[1] / len) * rim.width * k;
  R.setTransform(1, 0, 0, 1, 0, 0);
  R.globalAlpha = 1;
  R.globalCompositeOperation = 'copy';
  R.drawImage(fox.canvas, 0, 0, w, h, 0, 0, w, h);
  R.globalCompositeOperation = 'destination-out';
  R.drawImage(fox.canvas, 0, 0, w, h, -dx, -dy, w, h);
  R.globalAlpha = 0.5;
  R.drawImage(fox.canvas, 0, 0, w, h, -dx * 0.5, -dy * 0.5, w, h);
  R.globalAlpha = 1;
  R.globalCompositeOperation = 'source-in';
  R.fillStyle = rim.color;
  R.fillRect(0, 0, w, h);
  F.setTransform(1, 0, 0, 1, 0, 0);
  if (rim.glow > 0) {
    F.globalCompositeOperation = 'destination-over';
    F.globalAlpha = rim.amount * rim.glow;
    F.drawImage(buf.canvas, 0, 0, w, h, dx * 0.6, dy * 0.6, w, h);
  }
  F.globalCompositeOperation = 'source-atop';
  F.globalAlpha = rim.amount;
  F.drawImage(buf.canvas, 0, 0, w, h, 0, 0, w, h);
  F.globalCompositeOperation = 'source-over';
  F.globalAlpha = 1;
}

// Offscreen buffers shared by every fox (foxes are drawn one at a time). Grow-only.
const pools = new Map();
function pooled(key, w, h) {
  let b = pools.get(key);
  if (!b || b.canvas.width < w || b.canvas.height < h) {
    b = surface(Math.max(w, b ? b.canvas.width : 0), Math.max(h, b ? b.canvas.height : 0));
    pools.set(key, b);
  }
  return b;
}
