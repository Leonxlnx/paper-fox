// s02 night lake: scene-local pieces. The ochre goldenrod shrubs of the reference (lit
// yellow leaf clusters over olive and dark undergrowth), the river's two white
// cascades, whose streaks run down over the lip every frame, and the torn foam around
// the river rocks.

import { RNG, noise } from '../core/rng.js';
import { leaf, transform } from '../core/geom.js';
import { piece } from '../core/piece.js';
import { mix } from '../core/color.js';
import { clamp, lerp } from '../core/ease.js';

// Ramp from shade to lit tip, sampled in the reference.
const GOLD = ['#383a14', '#605e1e', '#93842a', '#c2a032', '#dcb63e', '#f0d468'];

function ramp(stops, k) {
  const f = clamp(k, 0, 0.999) * (stops.length - 1);
  const i = Math.floor(f);
  return mix(stops[i], stops[i + 1], f - i);
}

function fillPts(ctx, pts, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// A goldenrod shrub: a dark backing mound covered by fans of small leaves, each fan lit
// on its upper leaves, the fans higher in the mound brighter. (x, y) is the base centre.
export function goldShrub(ctx, { x, y, w, h, seed, warm = 0, size = 1 }) {
  const rng = new RNG(`gold-${seed}`);
  const nz = noise(`gold-${seed}`);
  const mound = [];
  for (let i = 0; i <= 28; i++) {
    const a = Math.PI * (i / 28);
    const r = 0.92 + 0.14 * nz.n1(i * 0.8);
    mound.push([x - Math.cos(a) * w * 0.5 * r, y - Math.sin(a) * h * 0.86 * r]);
  }
  mound.push([x + w * 0.5, y + 8], [x - w * 0.5, y + 8]);
  fillPts(ctx, mound, GOLD[0]);

  // Fan centres inside the half-ellipse, drawn top to bottom so lower fans overlap.
  const fans = [];
  const count = Math.round((w * h) / (520 * size * size));
  for (let i = 0; i < count * 4 && fans.length < count; i++) {
    const u = rng.range(-1, 1), v = rng.range(0, 1);
    if (u * u + v * v > 0.92) continue;
    fans.push({ x: x + u * w * 0.5, y: y - v * h * 0.82, v, r: rng.range(16, 26) * size });
  }
  fans.sort((a, b) => a.y - b.y);
  ctx.save();
  for (const f of fans) {
    // One soft contact shadow per fan instead of one per leaf (cheap to bake).
    ctx.save();
    ctx.shadowColor = 'rgba(12,16,4,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + f.r * 0.1, f.r * 0.8, f.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = GOLD[1];
    ctx.fill();
    ctx.restore();
    const m = rng.int(8, 13);
    const leaves = [];
    for (let j = 0; j < m; j++) {
      const ang = -Math.PI / 2 + rng.range(-1.35, 1.35);
      const len = f.r * rng.range(0.55, 1);
      const bx = f.x + rng.range(-0.3, 0.3) * f.r, by = f.y + f.r * 0.25;
      leaves.push({ ang, len, bx, by });
    }
    // Side leaves first, upright ones on top.
    leaves.sort((a, b) => Math.abs(b.ang + Math.PI / 2) - Math.abs(a.ang + Math.PI / 2));
    for (const L of leaves) {
      const up = -Math.sin(L.ang);
      const k = 0.18 + 0.42 * f.v + 0.3 * up + 0.16 * nz.n2(L.bx * 0.03, L.by * 0.03) + warm;
      const col = ramp(GOLD, k);
      const pts = transform(leaf(L.len, L.len * 0.36, { belly: 0.45 }), { x: L.bx, y: L.by, rot: L.ang + Math.PI / 2 });
      fillPts(ctx, pts, col);
      if (L.len > 13) {
        ctx.save();
        ctx.strokeStyle = mix(col, '#2c3010', 0.35);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(L.bx, L.by);
        ctx.lineTo(L.bx + Math.cos(L.ang) * L.len * 0.7, L.by + Math.sin(L.ang) * L.len * 0.7);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

// --- cascades -------------------------------------------------------------------

function fallOutline(f) {
  const top = [], bot = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    top.push([lerp(f.x0, f.x1, u), lipY(f, lerp(f.x0, f.x1, u)) - 7]);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    bot.push([lerp(f.x0, f.x1, u) + 10, f.bottom + (f.tilt ?? 0) * u + 10 + 3 * Math.sin(u * 23 + f.x0)]);
  }
  return { top, pts: [...top, ...bot] };
}

// Height of a fall's lip at x.
function lipY(f, x) {
  const u = clamp((x - f.x0) / (f.x1 - f.x0), 0, 1);
  return f.top + (f.tilt ?? 0) * u - (f.sag ?? 5) * Math.sin(Math.PI * u);
}

function pathOfPts(pts) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}

// A tapered strip along a spine: half(s) gives the half width at s in 0..1.
function taperStrip(spine, half) {
  const L = [], R = [];
  const n = spine.length;
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl, ny = tx / tl, h = half(i / (n - 1));
    L.push([spine[i][0] + nx * h, spine[i][1] + ny * h]);
    R.push([spine[i][0] - nx * h, spine[i][1] - ny * h]);
  }
  return [...L, ...R.reverse()];
}

// A curved spine from (x, y) heading at angle a for len px, bowing by bend px.
function spineOf(x, y, a, len, bend, n = 12) {
  const c = Math.cos(a), s = Math.sin(a);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, b = Math.sin(Math.PI * u) * bend;
    out.push([x + c * u * len - s * b, y + s * u * len + c * b]);
  }
  return out;
}

const WHITE = '#f6fbff';
const FOAM_SHADOW = 'rgba(10,40,96,0.3)';
const tornOf = (rng, amp = 1.4) => ({ amp, freq: 0.22, fine: 0.7, seed: rng.int(1, 1e6), step: 2 });

// One white streak of trailing water with a thin blue shadow under it.
function streak(ctx, rng, pts, color) {
  fillPts(ctx, pts.map(([x, y]) => [x + 0.8, y + 1.8]), FOAM_SHADOW);
  piece(ctx, pts, { fill: color, torn: tornOf(rng, 0.8) });
}

// falls: [{ x0, x1, top, bottom, tilt, sag }]. Each fall is a row of curling white
// tongues spilling over a dark lip and leaning with the current, a scrolling overlay
// of streaks, and a torn foam band at the foot that trails white water downstream.
export function addCascades(S, { z, falls, palette: P, seed = 's02-cascades', speed = 70 }) {
  const rng = new RNG(seed);
  const shapes = falls.map((f) => ({ f, ...fallOutline(f), path: null }));
  const X0 = Math.min(...falls.map((f) => f.x0)) - 30, X1 = Math.max(...falls.map((f) => f.x1)) + 40;
  const Y0 = Math.min(...falls.map((f) => f.top)) - 30, Y1 = Math.max(...falls.map((f) => f.bottom + (f.tilt ?? 0))) + 40;
  const body = S.sprite({
    name: 'cascade-body', x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0, mat: 'paper',
    edge: { width: 1.2, hi: 0.35, lo: 0.2, soft: 0.5 }, shadow: { blur: 6 },
    draw(ctx) {
      for (const sh of shapes) {
        const { f } = sh;
        const path = pathOfPts(sh.pts);
        // Deep water seen in the slots between the tongues.
        const g = ctx.createLinearGradient(0, f.top, 0, f.bottom);
        g.addColorStop(0, P.deep); g.addColorStop(1, P.base);
        ctx.fillStyle = g;
        ctx.fill(path);
        ctx.save();
        ctx.clip(path);
        // Tongues: arcs shooting right off the lip and dropping (x ~ sqrt(y)), a pale-blue
        // sheet with a white crest on the outer curve, deep blue slots between them.
        const Hh = f.bottom - f.top + 18;
        for (let x = f.x0 - 24; x < f.x1 - 2;) {
          const ly = lipY(f, x) - rng.range(0, 4);
          const skew = rng.range(22, 32), wTop = rng.range(10, 14), wBot = rng.range(19, 26);
          const sp = [];
          for (let k = 0; k <= 16; k++) { const s = k / 16; sp.push([x + skew * Math.sqrt(s), ly + Hh * s]); }
          const half = (s) => lerp(wTop, wBot, s) * 0.5;
          const shoulder = rng.chance(0.7) ? P.light : P.mid, crest = rng.chance(0.85) ? '#ffffff' : P.pale;
          // Rounded crest where the sheet rolls over the lip.
          ctx.fillStyle = shoulder; ctx.beginPath(); ctx.ellipse(sp[0][0], sp[0][1], half(0) + 1.6, half(0) * 0.7 + 1.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = crest; ctx.beginPath(); ctx.ellipse(sp[0][0] + 2, sp[0][1] + 0.6, half(0) * 0.85, half(0) * 0.55, 0, 0, Math.PI * 2); ctx.fill();
          fillPts(ctx, taperStrip(sp, (s) => half(s) + 1.6), shoulder);
          fillPts(ctx, taperStrip(sp.map(([px, py]) => [px + 2.4, py]), (s) => half(s) * 0.82), crest);
          ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.3;
          ctx.beginPath(); sp.forEach(([px, py], k) => { const h = half(k / 16) + 1.2; return k ? ctx.lineTo(px + h, py) : ctx.moveTo(px + h, py); }); ctx.stroke();
          x += rng.range(22, 34);
        }
        // Bluer just under the lip, whiter where it lands and churns.
        const vg = ctx.createLinearGradient(0, f.top, 0, f.bottom + 10);
        vg.addColorStop(0, 'rgba(20,64,160,0.3)'); vg.addColorStop(0.25, 'rgba(20,64,160,0)'); vg.addColorStop(0.72, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(255,255,255,0.5)');
        ctx.fillStyle = vg;
        ctx.fill(path);
        ctx.restore();
      }
    },
  });
  // Foam at each foot: a torn white band over a pale-blue underlayer, ragged below,
  // trailing white streaks downstream to the right.
  const foam = shapes.map((sh, i) => {
    const { f } = sh;
    const bx0 = f.x0 - 34, bx1 = f.x1 + 190;
    return S.sprite({
      name: `cascade-foam-${i}`, x: bx0, y: f.bottom - 28, w: bx1 - bx0, h: 90 + Math.abs(f.tilt ?? 0), mat: 'paper',
      edge: { width: 1, hi: 0.3, lo: 0.2, soft: 0.5 }, shadow: { blur: 4 },
      draw(ctx) {
        const r2 = new RNG(`${seed}-foam-${i}`);
        const nz = noise(`${seed}-foam-${i}`);
        const yAt = (x) => f.bottom + (f.tilt ?? 0) * clamp((x - f.x0) / (f.x1 - f.x0), 0, 1.3);
        const xa = f.x0 - 20, xb = f.x1 + 46;
        const top = [], bot = [];
        for (let x = xa; x <= xb; x += 6) {
          const u = (x - xa) / (xb - xa);
          const fade = Math.pow(Math.sin(Math.PI * clamp(u * 1.05, 0, 1)), 0.5);
          top.push([x, yAt(x) - 5 - 8 * fade + 3 * nz.n1(x * 0.11)]);
          bot.push([x + 4 * u, yAt(x) + 5 + 14 * fade + 6 * nz.n1(x * 0.07 + 9)]);
        }
        const band = [...top, ...bot.reverse()];
        piece(ctx, band.map(([x, y]) => [x + 1, y + 3]), { fill: P.light, torn: tornOf(r2, 1.6) });
        piece(ctx, band, { fill: '#ffffff', torn: tornOf(r2, 1.8), shadow: { color: 'rgba(10,40,96,0.22)', blur: 2, x: 0, y: 1.5 } });
        // Pale creases through the churn.
        for (let k = 0; k < 7; k++) {
          const x = r2.range(xa + 10, xb - 30), y = yAt(x) + r2.range(-2, 8);
          streak(ctx, r2, taperStrip(spineOf(x, y, 0.08, r2.range(18, 40), r2.range(-2, 2), 6), (s) => 1.3 * Math.sin(Math.PI * s)), P.pale);
        }
        // Trailing white water leaving the foot.
        for (let k = 0; k < 9; k++) {
          const x = r2.range(f.x0 + (f.x1 - f.x0) * 0.25, xb), y = yAt(x) + r2.range(8, 20);
          const len = r2.range(50, 150), th = r2.range(2, 5);
          const sp = spineOf(x, y, r2.range(0.06, 0.24), len, r2.range(-3, 6));
          streak(ctx, r2, taperStrip(sp, (s) => th * Math.pow(1 - s, 0.8) * Math.min(1, 0.4 + s * 5)), r2.chance(0.7) ? WHITE : P.pale);
        }
      },
    });
  });
  // Streak overlay: dashes repeating every PER px so the scroll wraps seamlessly.
  const PER = 46;
  const H = Math.max(...falls.map((f) => f.bottom - f.top + (f.tilt ?? 0))) + 40;
  const streaks = S.sprite({
    name: 'cascade-streaks', x: X0, y: 0, w: X1 - X0, h: H + PER, mat: 'none', edge: false, shadow: false,
    draw(ctx) {
      const r3 = new RNG(`${seed}-streaks`);
      for (let x = X0; x < X1; x += r3.range(4, 8)) {
        const n = r3.int(1, 2);
        for (let k = 0; k < n; k++) {
          const y = r3.range(0, PER), len = r3.range(8, 20), wdt = r3.range(1, 2);
          ctx.fillStyle = r3.chance(0.7) ? 'rgba(255,255,255,0.8)' : 'rgba(190,222,248,0.7)';
          for (let yy = y - PER; yy < H + PER; yy += PER) ctx.fillRect(x, yy, wdt, len);
        }
      }
    },
  });
  for (const sh of shapes) sh.path = pathOfPts(sh.pts);
  return S.add({
    name: 'cascades', z, sprites: [{ s: body }],
    render(ctx, t) {
      const off = (t * speed) % PER;
      for (const sh of shapes) {
        ctx.save();
        ctx.clip(sh.path);
        ctx.globalAlpha = 0.32;
        ctx.drawImage(streaks.canvas, streaks.x, sh.f.top - PER - 8 + off, streaks.w, streaks.h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createLinearGradient(0, sh.f.top, 0, sh.f.bottom + 10);
        g.addColorStop(0, 'rgba(210,232,255,0)'); g.addColorStop(0.6, 'rgba(235,246,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0.22)');
        ctx.fillStyle = g;
        ctx.fill(sh.path);
        ctx.restore();
      }
      shapes.forEach((sh, i) => {
        const s = foam[i];
        const bob = 1.4 * Math.sin(t * 2.3 + i * 1.7);
        const sc = 1 + 0.012 * Math.sin(t * 1.7 + i);
        const cx = (sh.f.x0 + sh.f.x1) / 2;
        ctx.save();
        ctx.translate(cx, sh.f.bottom);
        ctx.scale(sc, 1 + 0.03 * Math.sin(t * 2.1 + i));
        ctx.translate(-cx, -sh.f.bottom + bob);
        ctx.globalAlpha = 0.35;
        const p = s.shadow.pad;
        ctx.drawImage(s.shadow.canvas, s.x - p, s.y - p + 3, s.w + 2 * p, s.h + 2 * p);
        ctx.globalAlpha = 1;
        ctx.drawImage(s.canvas, s.x, s.y, s.w, s.h);
        ctx.restore();
      });
    },
  });
}

// --- foam around the river rocks ---------------------------------------------------

function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([lerp(ax, bx, k / n), lerp(ay, by, k / n)]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// The lower half of a convex outline, left to right: the rock's waterline.
function lowerChain(outline) {
  const n = outline.length;
  let iL = 0, iR = 0;
  outline.forEach(([x], i) => { if (x < outline[iL][0]) iL = i; if (x > outline[iR][0]) iR = i; });
  const walk = (a, b) => { const out = []; for (let i = a; ; i = (i + 1) % n) { out.push(outline[i]); if (i === b) break; } return out; };
  const c1 = walk(iL, iR), c2 = walk(iR, iL).reverse();
  const my = (c) => c.reduce((s, p) => s + p[1], 0) / c.length;
  return my(c1) > my(c2) ? c1 : c2;
}

// White water around the river rocks, drawn just behind them so it only shows past
// their silhouettes: a soft torn foam crescent along each waterline (fullest on the
// downstream side), white water trailing downstream, and rapids streaks between rocks.
//   rocks   boulder geometries (boulderGeometry output); flow: current angle (rad)
//   rapids  [{ x, y, len, a, th, n }] bands of white streaks between rocks
export function addRockFoam(S, { z, rocks, rapids = [], palette: P, seed = 's02-rockfoam', flow = 0.3, box, light = [-0.5, -0.866] }) {
  const F = [Math.cos(flow), Math.sin(flow)];
  const edge = { width: 1, hi: 0.3, lo: 0.18, soft: 0.5 };
  const collars = S.sprite({
    name: 'rock-foam-collars', ...box, mat: 'paper', edge, shadow: { blur: 3 },
    draw(ctx) {
      const rng = new RNG(`${seed}-collars`);
      for (const G of rocks) {
        const low = densify(lowerChain(G.outline), 5);
        const c = [G.x, G.y - G.h * 0.45];
        const T = clamp(G.w * 0.075, 6, 14);
        const nz = noise(`${seed}-${G.x}`);
        const outer = [], inner = [], wave = [];
        low.forEach(([x, y], k) => {
          const u = k / (low.length - 1);
          let dx = x - c[0], dy = y - c[1];
          const dl = Math.hypot(dx, dy) || 1;
          dx /= dl; dy /= dl;
          const down = Math.max(0, dx * 0.8 + dy * 0.6);
          const t = T * Math.pow(Math.sin(Math.PI * u), 0.55) * (0.15 + 0.95 * down * down) * (0.8 + 0.4 * (nz.n1(k * 0.35) * 0.5 + 0.5));
          outer.push([x + dx * t, y + dy * t * 0.75 + t * 0.2]);
          inner.push([x - dx * 6, y - dy * 6]);
          wave.push([x + dx * (t + 5), y + dy * (t + 5) * 0.75 + t * 0.2 + 3, u]);
        });
        const ring = [...outer, ...inner.slice().reverse()];
        piece(ctx, ring.map(([x, y]) => [x + 0.5, y + 2]), { fill: P.light, torn: tornOf(rng, 1.5) });
        piece(ctx, ring, { fill: WHITE, torn: tornOf(rng, 1.7), shadow: { color: FOAM_SHADOW, blur: 3, x: 0, y: 2 }, bevel: { light, width: 1.1, hi: 0.35, lo: 0.1 } });
        // A thin pale bow wave just outside, on the downstream side.
        const arc = wave.filter((p) => p[2] > 0.4 && p[2] < 0.97);
        if (arc.length > 4) {
          const sp = arc.map(([x, y]) => [x, y]);
          streak(ctx, rng, taperStrip(sp, (s) => 1.6 * Math.pow(Math.sin(Math.PI * s), 0.7)), P.pale);
        }
      }
    },
  });
  const trailDraw = (set) => (ctx) => {
    const rng = new RNG(`${seed}-trails-${set}`);
    for (const G of rocks) {
      const low = densify(lowerChain(G.outline), 5);
      const c = [G.x, G.y - G.h * 0.45];
      const sc = clamp(G.w / 170, 0.7, 1.3);
      // A broad pale tongue of slack white water straight downstream.
      const k0 = Math.round(low.length * rng.range(0.55, 0.75));
      const [wx, wy] = low[k0];
      const wl = G.w * rng.range(0.45, 0.7);
      streak(ctx, rng, taperStrip(spineOf(wx - F[0] * 8, wy - 2, flow + rng.range(-0.1, 0.1), wl, rng.range(-4, 6)), (s) => 5 * sc * Math.pow(1 - s, 0.7) * Math.min(1, 0.5 + s * 4)), P.pale);
      // Narrow white streaks peeling off the downstream side.
      const n = rng.int(2, 3);
      for (let j = 0; j < n; j++) {
        const k = Math.round((low.length - 1) * rng.range(0.4, 0.97));
        const [x, y] = low[k];
        let dx = x - c[0], dy = y - c[1];
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl; dy /= dl;
        const len = G.w * rng.range(0.4, 1.0), th = rng.range(3, 6) * sc;
        const sp = spineOf(x - dx * 3, y - dy * 3 + 2, flow + rng.range(-0.22, 0.2), len, rng.range(-5, 9));
        streak(ctx, rng, taperStrip(sp, (s) => th * Math.pow(1 - s, 0.85) * Math.min(1, 0.45 + s * 5)), rng.chance(0.7) ? WHITE : P.pale);
      }
    }
    for (const r of rapids) {
      const n = r.n ?? 6;
      for (let j = 0; j < n; j++) {
        const off = rng.range(-1, 1) * (r.th ?? 4) * 3;
        const x = r.x + rng.range(-0.25, 0.25) * r.len - Math.sin(r.a) * off, y = r.y + Math.cos(r.a) * off;
        const len = r.len * rng.range(0.45, 1), th = (r.th ?? 4) * rng.range(0.5, 1);
        const sp = spineOf(x - Math.cos(r.a) * len / 2, y - Math.sin(r.a) * len / 2, r.a + rng.range(-0.12, 0.12), len, rng.range(-4, 4));
        streak(ctx, rng, taperStrip(sp, (s) => th * Math.pow(Math.sin(Math.PI * s), 0.6) * (1.2 - 0.5 * s)), rng.chance(0.65) ? WHITE : P.pale);
      }
    }
  };
  const trails = [0, 1].map((set) => S.sprite({ name: `rock-foam-trails-${set}`, ...box, mat: 'paper', edge, shadow: { blur: 3 }, draw: trailDraw(set) }));
  const blit = (ctx, s, dx, dy, alpha) => {
    const p = s.shadow.pad;
    ctx.globalAlpha = alpha * 0.3;
    ctx.drawImage(s.shadow.canvas, s.x - p + dx, s.y - p + dy + 2, s.w + 2 * p, s.h + 2 * p);
    ctx.globalAlpha = alpha;
    ctx.drawImage(s.canvas, s.x + dx, s.y + dy, s.w, s.h);
  };
  return S.add({
    name: 'rock-foam', z,
    render(ctx, t) {
      ctx.save();
      const ph = Math.sin((t / 4.25) * Math.PI * 2);
      const drift = 3 * Math.sin((t / 8.5) * Math.PI * 2);
      // One set stays crisp while the other breathes in and out over it.
      trails.forEach((s, i) => blit(ctx, s, F[0] * drift * (i ? -0.7 : 1), F[1] * drift * (i ? -0.7 : 1), i ? 0.5 + 0.4 * ph : 0.95));
      // The collars lap up and down against the rocks.
      blit(ctx, collars, 0, 1.2 * Math.sin(t * 2.2), 1);
      ctx.restore();
    },
  });
}

// --- boulders -------------------------------------------------------------------

// Convex hull (monotone chain) of a point list.
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

// An irregular, squared-off oval: the flat top of a boulder seen from slightly above.
// Points run left -> back -> right -> front (clockwise on screen).
export function topOval(cx, cy, w, d, { n = 11, seed = 1, tilt = 0, rough = 0.07, square = 0.7 } = {}) {
  const rng = new RNG(`oval-${seed}`);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / n) * Math.PI * 2 + rng.range(-0.12, 0.12);
    const c = Math.cos(a), s = Math.sin(a);
    const r = 1 + rng.range(-rough, rough);
    const x = cx + Math.sign(c) * Math.abs(c) ** square * w * 0.5 * r;
    pts.push([x, cy + Math.sign(s) * Math.abs(s) ** square * d * 0.5 * r + tilt * (x - cx)]);
  }
  return pts;
}

// Rock looks: top plane [lit, mid, shade]; sides ramp dark -> light; moss specks.
export const ROCK = {
  perch: { top: ['#a6978b', '#8a7b70', '#6e6158'], side: ['#261f1b', '#382e29', '#4b3f38', '#605248', '#776558'], moss: ['#55662a', '#7c8c32', '#a6aa40', '#cdc45a'] },
  charcoal: { top: ['#88796b', '#6e6156', '#584c43'], side: ['#1c1613', '#2a221e', '#3a2f29', '#4c3f37', '#615047'], moss: ['#4a5a22', '#6e7c2e', '#98a03a', '#bdb850'] },
};

// A natural flat-topped boulder: a lighter top plane, a shoulder row of facets and a
// darker lower row dropping to the ground, granular speckle, cracks and moss specks.
//   top     top-plane polygon (see topOval), drop: face height px
//   spread  how far the foot flares out; bulge: px the shoulder facets swell outward
export function drawBoulder(ctx, { top, drop = 80, spread = 1.1, bulge = 7, seed = 1, pal = ROCK.charcoal, moss = 0.5, light = [-0.5, -0.866], speck = 1, cracks = 3 }) {
  const rng = new RNG(`boulder-${seed}`);
  const n = top.length;
  const cx = top.reduce((s, p) => s + p[0], 0) / n, cy = top.reduce((s, p) => s + p[1], 0) / n;
  const mid = [], base = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = top[i];
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    const dr = drop * rng.range(0.82, 1.15);
    const k = rng.range(0.34, 0.5);
    base.push([cx + dx * spread + rng.range(-0.1, 0.1) * drop, y + dr + dy * (spread - 1)]);
    // The shoulder swells out past both the top and the foot: a rounded, low-poly boulder.
    const b = bulge * rng.range(0.7, 1.3);
    mid.push([x + (base[i][0] - x) * k + (dx / len) * b, y + (base[i][1] - y) * k + Math.max(0, dy / len) * b * 0.5]);
  }
  const body = hull([...top, ...mid, ...base]);
  const bodyPath = piece(ctx, body, { fill: pal.side[0], shadow: { color: 'rgba(4,6,10,0.55)', blur: 10, x: 2, y: 5 } });
  const shade = (b) => ramp(pal.side, clamp(b + rng.range(-0.11, 0.11), 0, 1));
  const bev = { light, width: 1.4, hi: 0.16, lo: 0.22, soft: 0.4 };
  // Side faces that look toward the viewer, far ones first.
  const faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = top[j][0] - top[i][0], ey = top[j][1] - top[i][1];
    let nx = ey, ny = -ex;
    const mx = (top[i][0] + top[j][0]) / 2 - cx, my = (top[i][1] + top[j][1]) / 2 - cy;
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    if (ny < -0.12) continue;
    faces.push({ i, j, nx, ny, my: (top[i][1] + top[j][1]) / 2 });
  }
  faces.sort((a, b) => a.my - b.my);
  for (const f of faces) {
    const lit = -f.nx * 0.6;
    // Two facets per face, split at a random seam, so no side reads as a flat band.
    const mm = [lerp(mid[f.i][0], mid[f.j][0], rng.range(0.35, 0.65)), lerp(mid[f.i][1], mid[f.j][1], 0.5) + rng.range(-3, 3)];
    const bm = [lerp(base[f.i][0], base[f.j][0], rng.range(0.3, 0.7)), lerp(base[f.i][1], base[f.j][1], 0.5) + rng.range(-4, 8)];
    piece(ctx, [mid[f.i], mm, bm, base[f.i]], { fill: shade(0.28 + lit * 0.45), bevel: bev });
    piece(ctx, [mm, mid[f.j], base[f.j], bm], { fill: shade(0.36 + lit * 0.45), bevel: bev });
  }
  for (const f of faces) {
    const lit = -f.nx * 0.6;
    piece(ctx, [top[f.i], top[f.j], mid[f.j], mid[f.i]], { fill: shade(0.66 + lit * 0.45), bevel: bev });
  }
  // The top plane: lit toward the back left, with a few faint facets.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of top) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const g = ctx.createLinearGradient(x0, y0, x1, y1 + (x1 - x0) * 0.15);
  g.addColorStop(0, pal.top[0]); g.addColorStop(0.5, pal.top[1]); g.addColorStop(1, pal.top[2]);
  const topPath = piece(ctx, top, { fill: g, bevel: { light, width: 2, hi: 0.3, lo: 0.12, soft: 0.5 } });
  ctx.save();
  ctx.clip(topPath);
  const fx = cx + rng.range(-0.15, 0.15) * (x1 - x0), fy = cy + rng.range(-0.1, 0.1) * (y1 - y0);
  // Big facets fanning from an off-centre apex, alternately lit and shaded, with creases.
  let lightOn = rng.chance(0.5);
  for (let i = 0; i < n;) {
    const step = rng.int(2, 3);
    const fan = [[fx, fy]];
    for (let q = 0; q <= step; q++) fan.push(top[(i + q) % n]);
    fillPts(ctx, fan, lightOn ? 'rgba(255,246,230,0.13)' : 'rgba(12,9,7,0.15)');
    ctx.strokeStyle = 'rgba(12,9,7,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(top[i % n][0], top[i % n][1]); ctx.stroke();
    lightOn = !lightOn;
    i += step;
  }
  ctx.restore();
  // Lit rim along the front edge of the top plane.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(214,204,188,0.45)';
  ctx.lineWidth = 1.6;
  for (const f of faces) { ctx.beginPath(); ctx.moveTo(top[f.i][0], top[f.i][1] + 0.8); ctx.lineTo(top[f.j][0], top[f.j][1] + 0.8); ctx.stroke(); }
  ctx.restore();
  // Granular speckle and cracks inside the whole silhouette.
  ctx.save();
  ctx.clip(bodyPath);
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (const [x, y] of body) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const count = Math.round(((bx1 - bx0) * (by1 - by0) / 14) * speck);
  for (let i = 0; i < count; i++) {
    const x = rng.range(bx0, bx1), y = rng.range(by0, by1);
    const dark = rng.chance(0.52);
    ctx.fillStyle = dark ? `rgba(14,10,8,${rng.range(0.2, 0.45).toFixed(2)})` : `rgba(204,182,154,${rng.range(0.16, 0.38).toFixed(2)})`;
    const r = dark ? rng.range(0.5, 1.5) : rng.range(0.5, 1.4);
    ctx.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
  }
  for (let c = 0; c < cracks && faces.length; c++) {
    const f = faces[rng.int(0, faces.length - 1)];
    const u = rng.range(0.25, 0.75);
    let x = lerp(top[f.i][0], top[f.j][0], u), y = lerp(top[f.i][1], top[f.j][1], u) + 2;
    const pts = [[x, y]];
    const segs = rng.int(3, 5), len = drop * rng.range(0.5, 0.9);
    for (let s = 0; s < segs; s++) { x += rng.range(-7, 7); y += len / segs; pts.push([x, y]); }
    for (const [col, off] of [['rgba(206,196,180,0.25)', 1.2], ['rgba(10,8,6,0.65)', 0]]) {
      ctx.strokeStyle = col; ctx.lineWidth = off ? 1 : 1.3;
      ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + off, py) : ctx.moveTo(px + off, py))); ctx.stroke();
    }
  }
  ctx.restore();
  // Moss specks: clusters along the front rim of the top and a few loose on top.
  if (moss > 0) {
    const clusters = Math.round(moss * 10 + (x1 - x0) / 60 * moss);
    for (let c = 0; c < clusters; c++) {
      let mx, my;
      if (rng.chance(0.6) && faces.length) {
        const f = faces[rng.int(0, faces.length - 1)];
        const u = rng.next();
        mx = lerp(top[f.i][0], top[f.j][0], u); my = lerp(top[f.i][1], top[f.j][1], u) + rng.range(-3, 6);
      } else {
        mx = lerp(x0, x1, rng.range(0.1, 0.9)); my = lerp(y0, y1, rng.range(0.25, 0.8));
      }
      const m = rng.int(3, 8);
      for (let k = 0; k < m; k++) {
        ctx.beginPath();
        ctx.ellipse(mx + rng.range(-9, 9), my + rng.range(-3, 3), rng.range(1.2, 3.6), rng.range(0.9, 2.2), rng.range(-0.4, 0.4), 0, Math.PI * 2);
        ctx.fillStyle = pal.moss[rng.int(0, pal.moss.length - 1)];
        ctx.fill();
      }
    }
  }
}

// --- river foam -------------------------------------------------------------------

// Dense, smoothed polyline of a river centre line with cumulative length, normal and width.
function riverLine(path, width) {
  let pts = path.map((p, i) => [p[0], p[1], Array.isArray(width) ? width[i] : width]);
  for (let it = 0; it < 3; it++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push(a.map((v, k) => v * 0.75 + b[k] * 0.25), a.map((v, k) => v * 0.25 + b[k] * 0.75));
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  const line = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    line.push({ x: pts[i][0], y: pts[i][1], w: pts[i][2], s, nx: -ty / tl, ny: tx / tl });
  }
  return line;
}

function sampleLine(line, s) {
  let i = 1;
  while (i < line.length - 1 && line[i].s < s) i++;
  const a = line[i - 1], b = line[i];
  const u = clamp((s - a.s) / ((b.s - a.s) || 1), 0, 1);
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), nx: lerp(a.nx, b.nx, u), ny: lerp(a.ny, b.ny, u) };
}

// Pale and white swirl strips laid along each river reach, bent with its course, clipped
// to the river and breathing in two out-of-step sets.
//   rivers  [{ path, width, clip, count, white, from, to }]  (from/to: 0..1 of the length)
export function addRiverFoam(S, { z, rivers, palette: P, seed = 's02-foam', box }) {
  const sprites = [0, 1].map((set) => S.sprite({
    name: `river-foam-${set}`, ...box, mat: 'paper', edge: false, shadow: false,
    draw(ctx) {
      const rng = new RNG(`${seed}-${set}`);
      for (const rv of rivers) {
        const line = riverLine(rv.path, rv.width);
        const total = line[line.length - 1].s;
        const n = Math.round((rv.count ?? 120) / 2);
        for (let k = 0; k < n; k++) {
          const s0 = total * rng.range(rv.from ?? 0, rv.to ?? 1);
          const v = rng.range(-0.46, 0.46);
          const here = sampleLine(line, s0);
          const sc = here.w / 120;
          const L = rng.range(50, 170) * Math.max(0.6, sc);
          const th = rng.range(2.2, 6.5) * Math.max(0.7, sc);
          const top = [], bot = [];
          const steps = Math.max(4, Math.round(L / 7));
          for (let q = 0; q <= steps; q++) {
            const u = q / steps;
            const p = sampleLine(line, s0 + (u - 0.5) * L);
            const off = v * p.w * 0.5 + Math.sin(u * Math.PI) * th * 0.6;
            const half = th * 0.5 * Math.sin(Math.PI * clamp(u * 0.94 + 0.03, 0, 1)) ** 0.7;
            top.push([p.x + p.nx * (off - half), p.y + p.ny * (off - half)]);
            bot.push([p.x + p.nx * (off + half), p.y + p.ny * (off + half)]);
          }
          const pts = [...top, ...bot.reverse()];
          const w = rv.white ?? 0.4;
          const roll = rng.next();
          const col = roll < w ? '#f6fbff' : roll < w + 0.22 ? P.pale : P.light;
          fillPts(ctx, pts.map(([x, y]) => [x + 0.8, y + 1.6]), 'rgba(10,40,96,0.28)');
          fillPts(ctx, pts, col);
        }
      }
    },
  }));
  return rivers.map((rv, ri) => S.add({
    name: `river-foam-${ri}`, z: rv.z ?? z,
    render(ctx, t) {
      const ph = Math.sin((t / 4.25) * Math.PI * 2);
      const dx = 5 * Math.sin((t / 8.5) * Math.PI * 2);
      {
        ctx.save();
        ctx.clip(rv.clip);
        sprites.forEach((s, i) => {
          ctx.globalAlpha = 0.72 + 0.28 * (i ? -ph : ph);
          ctx.drawImage(s.canvas, s.x + dx * (i ? -0.6 : 1), s.y, s.w, s.h);
        });
        ctx.restore();
      }
    },
  }));
}

// --- the cliff on the right bank ------------------------------------------------

// A rounded rock promontory dropping into the lake: faceted grey-brown columns lit from
// the upper left, cracks between them, a torn moss cap and a few moss drips.
export function drawPromontory(ctx, { seed = 's02-cliff' } = {}) {
  const rng = new RNG(seed);
  const body = [[1742, 548], [1770, 532], [1820, 526], [1870, 530], [1905, 548], [1915, 800], [1672, 800], [1680, 732], [1694, 664], [1712, 604], [1728, 566]];
  const path = pathOfPts(body);
  piece(ctx, body, { fill: '#5a524c', torn: { amp: 2, freq: 0.08, seed: 3 }, shadow: { color: 'rgba(4,10,16,0.5)', blur: 8, y: 3 } });
  ctx.save();
  ctx.clip(path);
  const tones = ['#9a8e82', '#867a70', '#72685f', '#5e554e', '#4a433d', '#3a3430'];
  for (let x = 1666; x < 1920; x += rng.range(18, 30)) {
    const w = rng.range(20, 32);
    let y = 520;
    const col = Math.min(5, Math.max(0, Math.floor((x - 1670) / 48) + rng.int(-1, 1)));
    while (y < 800) {
      const h = rng.range(40, 90);
      const sk = rng.range(-5, 5);
      const k = Math.min(5, col + (y > 680 ? 1 : 0) + (rng.chance(0.25) ? 1 : 0));
      const q = [[x + sk, y], [x + w + sk, y + rng.range(-6, 6)], [x + w, y + h], [x, y + h + rng.range(-5, 5)]];
      piece(ctx, q, { fill: tones[k], shadow: { color: 'rgba(10,8,6,0.45)', blur: 3, x: 1, y: 2 } });
      ctx.strokeStyle = 'rgba(200,190,175,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(q[0][0] + 1, q[0][1] + 2); ctx.lineTo(q[3][0] + 1, q[3][1] - 2); ctx.stroke();
      y += h;
    }
  }
  ctx.restore();
  // Moss cap and drips.
  const cap = [];
  for (let x = 1734; x <= 1912; x += 6) cap.push([x, 540 - 12 * Math.sin(((x - 1734) / 178) * Math.PI) + rng.range(-2, 2)]);
  const under = cap.slice().reverse().map(([x, y]) => [x, y + rng.range(14, 26)]);
  piece(ctx, [...cap, ...under], { fill: '#8f9234', torn: { amp: 2.5, freq: 0.14, seed: 8 }, shadow: { color: 'rgba(10,14,4,0.5)', blur: 4, y: 3 } });
  for (let i = 0; i < 26; i++) {
    const x = rng.range(1740, 1905), y = 540 - 10 * Math.sin(((x - 1734) / 178) * Math.PI) + rng.range(-4, 10);
    ctx.beginPath();
    ctx.ellipse(x, y, rng.range(6, 12), rng.range(4, 7), rng.range(-0.3, 0.3), 0, Math.PI * 2);
    ctx.fillStyle = rng.pick(['#b8b444', '#cfc85a', '#a2a23a', '#e0d670']);
    ctx.fill();
  }
  for (const [x, y, len] of [[1716, 610, 40], [1740, 566, 30], [1700, 676, 28]]) {
    piece(ctx, [[x - 6, y], [x + 8, y - 2], [x + 4, y + len], [x - 2, y + len * 0.7]], { fill: '#7f8a30', torn: { amp: 1.5, seed: x } });
  }
}
