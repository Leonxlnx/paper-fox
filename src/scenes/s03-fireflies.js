// Firefly forest (s03): fireflies. Warm points of light that drift on slow curving
// paths and pulse, each to its own rhythm, plus "lantern" buds that glow at the tip of
// a thin curved stalk and sway with it, as in the reference.
//
// Every light is two baked sprites drawn additively: a wide warm halo and a small hot
// core. Near (out of focus) lights use a soft bokeh core instead of a crisp one.

import { surface } from '../core/canvas.js';
import { RNG, noise } from '../core/rng.js';
import { radial } from '../core/piece.js';
import { rgba, mix } from '../core/color.js';
import { TAU } from '../core/geom.js';
import { clamp } from '../core/ease.js';

// Sampled from the reference: white-hot centres, butter-yellow rims, amber halos.
export const FIREFLY = {
  core: '#fffbe6',
  rim: '#ffd970',
  halo: '#ffb43c',
  stalk: '#5b5a26',
  stalkLit: '#c9a24a',
};

const sprites = new Map();

// A radial light baked once: stops are [offset, colour, alpha].
function lightSprite(key, stops) {
  let c = sprites.get(key);
  if (!c) {
    const N = 128;
    const s = surface(N, N);
    s.ctx.fillStyle = radial(s.ctx, N / 2, N / 2, 0, N / 2, stops.map(([o, col, a]) => [o, rgba(col, a)]));
    s.ctx.fillRect(0, 0, N, N);
    c = s.canvas;
    sprites.set(key, c);
  }
  return c;
}

// Wide warm halo: a butter-yellow heart fading through amber, with a long soft tail so the
// light reads as a glow around the bead rather than a small disc (ref03).
const haloSprite = () => lightSprite('halo2', [[0, FIREFLY.rim, 0.95], [0.1, FIREFLY.halo, 0.75], [0.24, FIREFLY.halo, 0.42], [0.42, FIREFLY.halo, 0.19], [0.66, FIREFLY.halo, 0.06], [1, FIREFLY.halo, 0]]);
// Crisp core: a flat bright disc with a short falloff, the "bead" of the reference.
const coreSprite = () => lightSprite('core', [[0, FIREFLY.core, 1], [0.45, FIREFLY.core, 1], [0.62, FIREFLY.rim, 0.95], [0.8, FIREFLY.rim, 0.35], [1, FIREFLY.rim, 0]]);
// Bokeh core for lights close to the lens.
const bokehSprite = () => lightSprite('bokeh', [[0, FIREFLY.core, 0.95], [0.5, mix(FIREFLY.core, FIREFLY.rim, 0.5), 0.85], [0.75, FIREFLY.rim, 0.45], [1, FIREFLY.rim, 0]]);

// Glow strength over time: a slow breath with a quicker flicker riding on it. Never
// fully dark, so no light pops in or out.
function pulse(t, f) {
  const nz = noise(f.seed);
  const breath = 0.5 + 0.5 * Math.sin(TAU * (t / f.period + f.phase));
  return clamp(0.55 + 0.38 * breath + 0.12 * nz.n1(t * 1.3 + f.phase * 9), 0.3, 1.05);
}

// Position of a free-flying light: a smooth wandering loop around its home.
function drift(t, f) {
  const nz = noise(f.seed + 101);
  const a = TAU * (t / f.loop + f.phase);
  return [
    f.x + f.drift * (0.7 * Math.sin(a) + 0.45 * nz.n1(t * 0.21 + 3.1)),
    f.y + f.drift * 0.6 * (0.7 * Math.sin(2 * a + 1.1) + 0.5 * nz.n1(t * 0.17 + 7.7)),
  ];
}

// Tip of a lantern stalk: the bud sways about the stalk foot.
function stalkTip(t, f) {
  const sw = f.sway * (Math.sin(TAU * (t / f.loop + f.phase)) + 0.4 * noise(f.seed + 7).n1(t * 0.4));
  const { ang, len } = f.stalk;
  return { tip: [f.foot[0] + Math.sin(ang + sw) * len, f.foot[1] - Math.cos(ang + sw) * len], sw };
}

// Bake the thin curved stalk of a lantern bud (drawn from the foot, pointing up).
function bakeStalk(S, f, rng) {
  const { ang, len, bow = 0.25 } = f.stalk;
  const pad = 8;
  const w = Math.abs(Math.sin(ang)) * len + len * bow + pad * 2;
  const h = len + pad * 2;
  return S.sprite({
    name: 'firefly-stalk', x: -w, y: -h, w: w * 2, h: h + pad, mat: 'smooth', edge: false, shadow: false,
    draw(ctx) {
      // Authored with the foot at the origin and the tip straight up; rotated per frame.
      const b = len * bow * (rng.chance(0.5) ? 1 : -1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = FIREFLY.stalk;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(b, -len * 0.55, 0, -len);
      ctx.stroke();
      // Light from the bud runs down the stalk's upper part.
      ctx.strokeStyle = rgba(FIREFLY.stalkLit, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b * 0.45, -len * 0.62);
      ctx.quadraticCurveTo(b * 0.4, -len * 0.85, 0, -len);
      ctx.stroke();
    },
  });
}

// Warm reflections of the fireflies on still water: a halo squashed flat with a bright dash
// at its heart, wobbling sideways and breathing.
//   glints  [{ x, y, w }]: centre and half width
export function addWaterGlints(S, { z, glints, name = 'water-glints', tags = [] }) {
  const rng = new RNG(`s03-glints:${name}`);
  const list = glints.map((g) => ({ ...g, period: rng.range(1.8, 3.6), phase: rng.next() }));
  return S.add({
    name, z, blend: 'lighter', tags: ['fireflies', ...tags],
    render(ctx, t) {
      const base = ctx.globalAlpha;
      const Hs = haloSprite(), C = coreSprite();
      for (const g of list) {
        const a = TAU * (t / g.period + g.phase);
        const k = 0.65 + 0.35 * Math.sin(a);
        const wob = Math.sin(a * 0.61 + g.phase * 5) * g.w * 0.08;
        ctx.globalAlpha = base * 0.75 * k;
        ctx.drawImage(Hs, g.x - g.w + wob, g.y - g.w * 0.26, g.w * 2, g.w * 0.52);
        ctx.globalAlpha = base * Math.min(1, 0.45 + 0.5 * k);
        const cw = g.w * 0.34, ch = Math.max(2, g.w * 0.06);
        ctx.drawImage(C, g.x - cw + wob * 1.5, g.y - ch, cw * 2, ch * 2);
      }
      ctx.globalAlpha = base;
    },
  });
}

// A soft additive glow (the halo round the guiding star), breathing slowly.
export function addGlow(S, { z, x, y, r, name = 'glow', alpha = 0.5, period = 5.5, tags = [] }) {
  const spr = lightSprite('soft', [[0, '#fff4d2', 0.9], [0.1, '#ffe6a6', 0.55], [0.26, '#f2c676', 0.24], [0.5, '#d29a58', 0.08], [0.78, '#a07848', 0.02], [1, '#a07848', 0]]);
  return S.add({
    name, z, blend: 'lighter', tags,
    render(ctx, t) {
      const base = ctx.globalAlpha;
      const k = 0.9 + 0.1 * Math.sin((TAU * t) / period);
      const rr = r * (0.97 + 0.03 * k);
      ctx.globalAlpha = base * alpha * k;
      ctx.drawImage(spr, x - rr, y - rr, rr * 2, rr * 2);
      ctx.globalAlpha = base;
    },
  });
}

// Add one plane of fireflies.
//   z        plane depth
//   flies    [{ x, y, r, drift?, stalk?: { len, ang, bow } }]; r is the core radius.
//            With a stalk, (x, y) is the bud at rest and the foot is below it.
//   bokeh    true for lights near the lens: soft cores, bigger halos
//   halo     halo radius as a multiple of r
//   glow     overall strength
export function addFireflies(S, { z, flies, name = 'fireflies', bokeh = false, halo = 5.2, glow = 1, seed = 's03-fireflies', tags = [] }) {
  const rng = new RNG(`${seed}:${name}`);
  const list = flies.map((f, i) => {
    const o = {
      ...f,
      seed: rng.int(1, 1e6),
      period: rng.range(2.2, 4.6),
      phase: rng.next(),
      loop: rng.range(9, 16),
      drift: f.drift ?? (f.stalk ? 0 : rng.range(14, 34)),
      sway: f.stalk ? rng.range(0.03, 0.06) : 0,
      i,
    };
    if (f.stalk) {
      o.foot = [f.x - Math.sin(f.stalk.ang) * f.stalk.len, f.y + Math.cos(f.stalk.ang) * f.stalk.len];
      o.stalkSprite = bakeStalk(S, o, rng);
    }
    return o;
  });
  const stalked = list.filter((f) => f.stalk);
  const layers = [];
  if (stalked.length) {
    layers.push(S.add({
      name: `${name}-stalks`, z: z + 1, tags: ['fireflies', ...tags],
      render(ctx, t, env) {
        for (const f of stalked) {
          const { sw } = stalkTip(t, f);
          const s = f.stalkSprite;
          ctx.save();
          ctx.translate(f.foot[0], f.foot[1]);
          ctx.rotate(f.stalk.ang + sw);
          ctx.globalAlpha = env.alpha ?? 1;
          ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h);
          ctx.restore();
        }
      },
    }));
  }
  const core = bokeh ? bokehSprite() : coreSprite();
  layers.push(S.add({
    name, z, blend: 'lighter', tags: ['fireflies', ...tags],
    render(ctx, t) {
      const base = ctx.globalAlpha;
      const H = haloSprite();
      for (const f of list) {
        const [x, y] = f.stalk ? stalkTip(t, f).tip : drift(t, f);
        const k = pulse(t, f) * glow;
        const hr = f.r * halo * (0.85 + 0.25 * k);
        ctx.globalAlpha = base * Math.min(1, 1.0 * k);
        ctx.drawImage(H, x - hr, y - hr, hr * 2, hr * 2);
        const cr = f.r * (bokeh ? 1.6 : 1.25) * (0.92 + 0.12 * k);
        ctx.globalAlpha = base * Math.min(1, 0.55 + 0.5 * k);
        ctx.drawImage(core, x - cr, y - cr, cr * 2, cr * 2);
      }
      ctx.globalAlpha = base;
    },
  }));
  return layers;
}
