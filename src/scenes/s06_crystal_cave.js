// s06 Crystal cave: deep underground the fox stands on a rock ledge among clusters of
// pale-blue crystals and looks up toward the guiding star, which glows gold at the end
// of a tunnel. An underground stream steps down from the tunnel in small cascades into
// a still pool that mirrors the gold and the blue. The cave starts almost black: the
// crystals wake one by one, far to near, then breathe slowly; drips fall from the
// stalactites, rings spread on the pool. The camera pushes in toward the tunnel.

import { Scene, W, H } from '../core/stage.js';
import { surface } from '../core/canvas.js';
import { smoothstep } from '../core/ease.js';
import { createFox } from '../elements/fox.js';
import { addGuidingStar, addGlow, drawGlow } from '../elements/sky.js';
import { WATER, addLake, addRiver, addWaterfall, addRipples, addReflection } from '../elements/water.js';
import { addCrystalCluster } from './s06-crystals.js';
import { LIGHT, STAR, addBackdrop, addTunnel, addBackWall, addCeiling, addSideWalls, addLedges, addForegroundRocks } from './s06-cave.js';

const DURATION = 8.5;
const REST_T = DURATION / 2;
const FOX = { x: 640, y: 780, scale: 1.0 };
const camK = (t) => Math.sin(((t - REST_T) / REST_T) * (Math.PI / 2));

// Crystal clusters: [name, z, base x, base y, scale, crystals, opts]. Crystals are
// { dx, dy, len, w, lean, turn, tip } relative to the base, back to front.
const C = (dx, dy, len, w, lean = 0, turn = null, tip = 0.27) => ({ dx: dx * 0.85, dy, len, w: w * 1.1, lean: lean * 0.8, turn, tip });
const CLUSTERS = [
  ['cr-tunnel', 2300, 1492, 448, 1, [C(-40, 0, 62, 12, -0.25), C(-10, -2, 110, 18, -0.05), C(24, 0, 86, 15, 0.18), C(46, 4, 50, 10, 0.5)], {}],
  ['cr-right-back', 2000, 1736, 424, 1, [C(-30, 0, 44, 10, -0.3), C(0, 0, 78, 14, 0.05), C(24, 2, 52, 11, 0.4)], {}],
  ['cr-step', 1950, 1632, 500, 1, [C(-10, 0, 34, 8, -0.2), C(8, 0, 46, 9, 0.2)], {}],
  ['cr-back-left', 1800, 994, 482, 1, [C(-70, 0, 70, 13, -0.4), C(-36, -2, 112, 18, -0.15), C(4, -4, 156, 24, 0), C(42, 0, 104, 18, 0.22), C(76, 4, 62, 12, 0.5)], {}],
  ['cr-back-centre', 1700, 1236, 546, 1, [C(-82, 2, 72, 13, -0.45), C(-46, -2, 128, 20, -0.18), C(-8, -6, 214, 30, 0.02), C(36, -2, 150, 24, 0.2), C(70, 2, 92, 16, 0.45), C(100, 6, 54, 11, 0.7)], {}],
  ['cr-back-small', 1740, 1378, 556, 1, [C(-12, 0, 40, 9, -0.25), C(10, 0, 58, 11, 0.15)], {}],
  ['cr-mid', 1390, 1012, 616, 1, [C(-90, 2, 52, 11, -0.6), C(-58, -2, 84, 15, -0.3), C(-22, -4, 120, 20, -0.08), C(14, -4, 108, 19, 0.1), C(48, -2, 80, 15, 0.32), C(82, 2, 56, 11, 0.6)], {}],
  ['cr-behind-fox', 1340, 666, 444, 1, [C(-196, 8, 64, 13, -0.5), C(-150, 4, 96, 17, -0.3), C(-100, 0, 132, 22, -0.15), C(-40, -4, 122, 21, 0.08), C(12, -8, 210, 32, 0), C(62, -2, 150, 26, 0.24), C(108, 6, 98, 18, 0.5), C(140, 10, 56, 12, 0.75)], {}],
  ['cr-left', 1150, 290, 596, 1, [C(-150, 22, 92, 18, -0.62), C(-112, -4, 206, 30, -0.26), C(-48, -6, 348, 47, -0.06), C(34, 0, 296, 44, 0.19), C(-14, 18, 156, 30, -0.12), C(86, 22, 176, 30, 0.42), C(124, 34, 112, 22, 0.72)], { halo: 1.2 }],
  ['cr-fox-right', 1040, 822, 738, 1, [C(-78, 2, 60, 12, -0.55), C(-44, -2, 96, 17, -0.25), C(-8, -4, 124, 21, 0), C(28, -2, 102, 18, 0.22), C(62, 2, 70, 13, 0.5), C(92, 6, 44, 9, 0.8)], {}],
  ['cr-stone', 1090, 1042, 902, 1, [C(-96, 4, 58, 12, -0.62), C(-62, 0, 96, 17, -0.32), C(-22, -4, 142, 23, -0.06), C(16, -4, 126, 21, 0.12), C(52, 0, 92, 16, 0.38), C(86, 4, 58, 12, 0.66)], {}],
  ['cr-right', 880, 1816, 694, 0.82, [C(-150, 6, 96, 18, -0.5), C(-104, 0, 178, 28, -0.24), C(-40, -4, 272, 40, -0.05), C(30, -6, 300, 44, 0.12), C(104, 0, 230, 38, 0.3), C(-70, 14, 120, 22, -0.18), C(150, 10, 160, 30, 0.55)], { halo: 1.1, res: 1.1 }],
  ['cr-bottom-right', 640, 1834, 1046, 1, [C(-150, 10, 120, 24, -0.55), C(-96, 0, 230, 36, -0.22), C(-20, -4, 330, 50, -0.02), C(74, -2, 300, 48, 0.16), C(150, 6, 210, 40, 0.4)], { halo: 1.1, res: 1.2 }],
  ['cr-bottom-centre', 600, 604, 1084, 1, [C(-110, 8, 120, 22, -0.55), C(-66, 0, 170, 28, -0.25), C(-16, -4, 218, 34, -0.05), C(34, -2, 190, 32, 0.16), C(80, 4, 132, 24, 0.42), C(116, 10, 84, 16, 0.7)], { res: 1.2 }],
  ['cr-left-fg', 520, 120, 1110, 1, [C(-70, 20, 470, 104, 0.12, 0.35, 0.18), C(100, 30, 330, 84, 0.26, 0.55, 0.2), C(216, 40, 210, 62, 0.42, 0.5, 0.22), C(-150, 60, 240, 72, -0.15, 0.6, 0.2)], { halo: 1, res: 1 }],
];

// Drips: falling from stalactite tips into the pool (period s, phase 0..1).
const DRIPS = [
  { x: 1188, y0: 236, y1: 812, period: 3.1, phase: 0.18 },
  { x: 1322, y0: 200, y1: 868, period: 2.7, phase: 0.62 },
  { x: 1612, y0: 270, y1: 760, period: 3.7, phase: 0.85 },
  { x: 1050, y0: 214, y1: 784, period: 3.4, phase: 0.4 },
];
const G = 3600;

function group(S, fn, tags) {
  const n = S.layers.length;
  const out = fn(S);
  for (const L of S.layers.slice(n)) for (const tag of tags) if (!L.tags.includes(tag)) L.tags.push(tag);
  return out;
}

function addWater(S) {
  const cave = WATER.cave;
  // ref06's water is a saturated, luminous blue; the stock cave palette is a shade dull.
  const pool = { ...cave, deep: '#0a2c8c', base: '#134ec8', mid: '#2a78e8', light: '#5cb2ff', pale: '#c4e8ff', foam: '#f2faff', foamShade: '#9cc4f0', lake: ['#2a70e2', '#123fb0'] };
  const warm = { ...cave, base: '#3a5296', mid: '#7f8aa8', light: '#e2c486', pale: '#fff0c8', foam: '#fff8e8', foamShade: '#d8c098' };
  const GOLD = ['#b0702a', '#f2b85e', '#fff0c4'], BLUE = ['#3d7fd6', '#86c4f4', '#dff4ff'];
  const splash = (size, count) => ({ size: size * 0.32, count: Math.round(count * 2.2), flat: 0.2 });
  // stairs out of the tunnel, lit gold
  addRiver(S, { z: 2350, palette: warm, texH: 60, persp: 0.3, align: 'across', speed: 26, current: 0.3, torn: 2, bank: 6,
    path: [[1462, 392], [1480, 424], [1504, 462], [1532, 504]], width: [24, 36, 48, 62], seed: 's06-stairs' });
  // first cascade, over the lip of the tunnel floor
  addWaterfall(S, { z: 2310, palette: warm, x: 1500, top: 450, bottom: 496, width: 46, round: 9, bandWidth: 6, speed: 60, accel: 0.3,
    foam: splash(0.3, 7), mist: false, seed: 's06-fall-top' });
  addWaterfall(S, { z: 1900, palette: warm, x: 1545, top: 504, bottom: 556, width: 74, round: 12, bandWidth: 7, speed: 70, accel: 0.3,
    foam: splash(0.36, 10), mist: { strength: 0.16 }, seed: 's06-fall-small' });
  // the level run toward the big cascade
  addLake(S, { z: 1630, x0: 1270, x1: 1640, top: 552, bottom: 612, palette: pool, seed: 's06-run', scale: 0.6,
    shape: [[1290, 600], [1330, 584], [1420, 570], [1500, 558], [1580, 552], [1630, 560], [1610, 600], [1470, 610], [1300, 612]],
    light: { x: 1500, width: 60, widthBottom: 50, top: 556, bottom: 606, count: 12, glow: 0.4 } });
  addWaterfall(S, { z: 1620, palette: pool, x: 1368, top: 602, bottom: 704, width: 168, round: 22, bandWidth: 9, speed: 85, accel: 0.35,
    foam: splash(0.5, 24), mist: { strength: 0.3 }, seed: 's06-fall-big' });
  // the main pool
  addLake(S, {
    z: 1450, x0: 600, x1: 1980, top: 698, bottom: 1100, palette: pool, seed: 's06-pool',
    shape: [[600, 760], [700, 716], [900, 702], [1200, 698], [1500, 700], [1760, 704], [1980, 716], [1980, 1100], [600, 1100]],
    light: { x: 1430, width: 120, widthBottom: 84, top: 704, bottom: 950, count: 40, glow: 0.55 },
  });
  // gold of the tunnel streaming down the pool under the big cascade, blue under the crystals
  addReflection(S, { z: 1440, x: 1372, top: 712, bottom: 944, width: 116, widthBottom: 96, count: 30, colors: GOLD, glow: 0.5, seed: 's06-refl-gold' });
  addReflection(S, { z: 1440, x: 1740, top: 716, bottom: 830, width: 120, widthBottom: 90, count: 14, colors: BLUE, glow: 0.35, seed: 's06-refl-right' });
  addReflection(S, { z: 1440, x: 1040, top: 920, bottom: 1060, width: 160, widthBottom: 120, count: 18, colors: BLUE, glow: 0.3, seed: 's06-refl-blue' });
  addReflection(S, { z: 1440, x: 1250, top: 712, bottom: 800, width: 90, widthBottom: 70, count: 14, colors: BLUE, glow: 0.3, seed: 's06-refl-back' });
  addReflection(S, { z: 1440, x: 900, top: 760, bottom: 880, width: 110, widthBottom: 90, count: 12, colors: BLUE, glow: 0.3, seed: 's06-refl-left' });
  addRipples(S, { z: 1440, x: 1356, y: 852, rx: 150, ry: 32, palette: pool, color: cave.glow[1], seed: 's06-rip1' });
  addRipples(S, { z: 1440, x: 1196, y: 806, rx: 110, ry: 24, palette: pool, color: pool.pale, period: 5.2, seed: 's06-rip2' });
  addRipples(S, { z: 1440, x: 1612, y: 770, rx: 90, ry: 18, palette: pool, color: pool.pale, period: 4.1, seed: 's06-rip3' });
  addRipples(S, { z: 1440, x: 1500, y: 905, rx: 110, ry: 22, palette: pool, color: cave.glow[1], period: 5.6, seed: 's06-rip4' });
  // second step: the pool spills over a rock lip into a lower pool that runs out toward
  // the lens between the foreground rocks
  addWaterfall(S, { z: 850, palette: pool, x: 1376, top: 950, bottom: 1000, width: 230, round: 18, bandWidth: 9, speed: 80, accel: 0.3,
    foam: splash(0.42, 22), mist: { strength: 0.22 }, seed: 's06-fall-low' });
  addLake(S, {
    z: 820, x0: 1020, x1: 1920, top: 984, bottom: 1200, palette: pool, seed: 's06-low', scale: 1.15,
    shape: [[1020, 1020], [1150, 994], [1376, 986], [1620, 992], [1920, 1012], [1920, 1200], [1020, 1200]],
    light: { x: 1390, width: 130, widthBottom: 170, top: 996, bottom: 1170, count: 22, glow: 0.5 },
  });
  addReflection(S, { z: 815, x: 1390, top: 1000, bottom: 1160, width: 130, widthBottom: 180, count: 20, colors: GOLD, glow: 0.45, seed: 's06-refl-low' });
  addRipples(S, { z: 815, x: 1300, y: 1050, rx: 170, ry: 30, palette: pool, color: pool.pale, period: 4.8, seed: 's06-rip5' });
}
function addDrips(S) {
  S.add({
    name: 'drips', z: 1445, order: 2, tags: ['water', 'drips'],
    render(ctx, t) {
      for (const d of DRIPS) {
        const T = Math.sqrt((2 * (d.y1 - d.y0)) / G);
        const tau = ((t / d.period + d.phase) % 1) * d.period;
        const form = 0.6;
        ctx.save();
        if (tau < form) {
          const k = tau / form;
          ctx.globalAlpha *= smoothstep(0, 0.5, k);
          ctx.fillStyle = '#cfeaff';
          ctx.beginPath(); ctx.ellipse(d.x, d.y0 + 3 * k, 2 + 1.6 * k, 2.4 + 2.6 * k, 0, 0, Math.PI * 2); ctx.fill();
        } else if (tau < form + T) {
          const u = tau - form;
          const y = d.y0 + 0.5 * G * u * u;
          const v = G * u;
          ctx.fillStyle = '#d8f0ff';
          ctx.beginPath(); ctx.ellipse(d.x, y, 2.6, 4 + Math.min(10, v * 0.006), 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, d.x, y, 14, '#7cc4ff', 0.5);
        } else {
          const u = (tau - form - T) / Math.max(0.01, d.period - form - T);
          const a = 1 - smoothstep(0, 0.55, u);
          if (a > 0.01) {
            ctx.strokeStyle = `rgba(214,238,255,${(0.75 * a).toFixed(3)})`;
            ctx.lineWidth = 2;
            for (let r = 0; r < 2; r++) {
              const rr = 6 + (60 - r * 22) * Math.min(1, u * 1.6);
              ctx.beginPath(); ctx.ellipse(d.x, d.y1, rr, rr * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
            }
            if (u < 0.12) {
              ctx.fillStyle = `rgba(230,246,255,${(1 - u / 0.12).toFixed(3)})`;
              for (let i = -2; i <= 2; i++) {
                const s = u / 0.12;
                ctx.beginPath(); ctx.arc(d.x + i * 7 * s, d.y1 - 18 * s * (1 - s) * (3 - Math.abs(i)), 1.6, 0, Math.PI * 2); ctx.fill();
              }
            }
          }
        }
        ctx.restore();
      }
    },
  });
}

// The cave starts nearly black. Each crystal opens a soft window of light as it wakes;
// the remaining darkness lifts as the last ones come on. Drawn in screen space.
function addDarkness(S, sources) {
  const sc = 4, w = W / sc, h = H / sc;
  const buf = surface(w, h);
  S.add({
    name: 'darkness', z: 40, order: 99, tags: ['fx'],
    render(ctx, t, env) {
      const base = 0.95 * (1 - smoothstep(0.6, 2.9, t));
      if (base < 0.004) return;
      const g = buf.ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, w, h);
      g.fillStyle = `rgba(2,3,9,${base.toFixed(4)})`;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      for (const s of sources) {
        const k = s.k(t);
        if (k <= 0.002) continue;
        const x = s.x / sc, y = s.y / sc, r = s.r / sc;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(0,0,0,${k.toFixed(4)})`);
        gr.addColorStop(0.45, `rgba(0,0,0,${(k * 0.6).toFixed(4)})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.save();
      ctx.setTransform(env.q, 0, 0, env.q, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(buf.canvas, 0, 0, W, H);
      ctx.restore();
    },
  });
}

export default function () {
  return new Scene({
    id: 's06',
    duration: DURATION,
    background: '#05070e',
    light: LIGHT,
    shadow: { alpha: 0.55, dist: 10, blur: 11 },
    post: { bloom: 0.32, threshold: 0.8, vignette: 0.22, grain: 0.05 },
    camera: (t) => {
      const k = camK(t);
      return { x: 14 * k, y: -6 * k, z: 50 * k, zoom: 1, roll: 0 };
    },
    meta: { fox: { x: FOX.x, y: FOX.y }, light: { x: STAR.x, y: STAR.y }, horizon: 700 },
    build(S) {
      addBackdrop(S);
      group(S, (s) => addGuidingStar(s, { x: STAR.x, y: STAR.y, z: 5000, size: STAR.size, points: 4, rays: 0.5, halo: 0.9, core: 1.2, sparkles: 1.6 }), ['celestial']);
      addGlow(S, { z: 4990, name: 'star-warmth', items: (t) => [
        { x: STAR.x + 90, y: STAR.y + 10, r: 300, color: '#ff9e3a', alpha: 0.14 },
        { x: STAR.x, y: STAR.y, r: 130, color: '#ffe2a0', alpha: 0.3 },
      ] }).tags.push('celestial');
      addTunnel(S);
      // gold light welling up between the far rings, deepest first
      addGlow(S, { z: 3700, order: 1, name: 'tunnel-deep', items: () => [{ x: 1392, y: 266, r: 190, color: '#ffb050', alpha: 0.34 }] }).tags.push('celestial');
      addGlow(S, { z: 3000, order: 1, name: 'tunnel-mid', items: (t) => [{ x: 1475, y: 262, r: 290, color: '#ffa848', alpha: 0.2 + 0.02 * Math.sin(t * 0.9), sx: 1.1 }] }).tags.push('celestial');
      // warm light spilling down the tunnel walls and over the floor
      addGlow(S, { z: 2440, order: 1, name: 'tunnel-spill', items: (t) => [
        { x: 1540, y: 250, r: 380, color: '#ffb95e', alpha: 0.34, sx: 0.8 },
        { x: 1500, y: 430, r: 220, color: '#ffd38a', alpha: 0.3, sy: 0.5 },
      ] }).tags.push('celestial');
      addBackWall(S);
      group(S, addCeiling, []);
      group(S, addSideWalls, []);
      addLedges(S);
      group(S, addWater, ['water']);
      addDrips(S);
      // light spilling out of the tunnel down onto the stream and pool
      addGlow(S, { z: 1600, order: 3, name: 'gold-spill', items: (t) => [
        { x: 1470, y: 560, r: 340, color: '#ffb85a', alpha: 0.2 + 0.03 * Math.sin(t * 1.3), sy: 0.6 },
      ] }).tags.push('celestial');

      const clusters = CLUSTERS.map(([name, z, x, y, scale, crystals, o]) => ({ name, z, x, y, scale, crystals, o }));
      const order = clusters.slice().sort((a, b) => b.z - a.z);
      const results = [];
      order.forEach((c, i) => {
        const ignite = 0.4 + (1.4 * i) / (order.length - 1);
        const fg = c.z < 700;
        const r = addCrystalCluster(S, { x: c.x, y: c.y, scale: c.scale, crystals: c.crystals, seed: c.name }, {
          z: c.z, ignite, rise: 0.4, halo: c.o.halo ?? 1, breathe: 0.14, period: 4.6 + (i % 4) * 0.7, phase: i * 0.27, res: c.o.res ?? 1,
          tags: fg ? ['fg'] : [],
        });
        results.push(r);
      });

      const fox = createFox(S, {
        pose: 'stand', x: FOX.x, y: FOX.y, z: 960, scale: FOX.scale, yaw: 0.2, look: 0.85,
        rim: { amount: 0.9, color: '#8cceff', width: 3, glow: 0.45, dir: [-0.3, -0.95] },
      });
      if (!fox.layer.tags.includes('fox')) fox.layer.tags.push('fox');

      addForegroundRocks(S);

      addDarkness(S, [
        { x: STAR.x, y: STAR.y, r: 300, k: () => 0.5 },
        ...results.map((r) => ({ x: r.centre.x, y: r.centre.y, r: Math.max(160, r.radius * 2.1), k: (t) => r.ignite(t) * 0.92 })),
      ]);
    },
  });
}
