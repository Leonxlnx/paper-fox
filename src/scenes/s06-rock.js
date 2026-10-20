// Cave rock for the crystal cave (s06): shelves built from rows of rounded stones with
// humped lit tops and layered faces, big slanted wall plates with tan-lit edges, and
// icy stalactites.
// Every surface is cut into many small facets so nothing reads as a flat vector fill.

import { RNG, noise } from '../core/rng.js';
import { piece, pathOf, bevelBands } from '../core/piece.js';
import { tear } from '../core/geom.js';
import { mix, rgba, vary } from '../core/color.js';
import { clamp, lerp } from '../core/ease.js';
import { surface } from '../core/canvas.js';
import { voronoi, scatterIn, boxOf, inset, brush } from '../elements/terrain-kit.js';

// Palettes sampled from ref06. Ramps run dark -> lit.
export const ROCK = {
  // The ledges: near-black brown faces, warm grey-brown tops, gold and pale specks.
  ledge: {
    face: ['#0d0a0a', '#18120f', '#251c17', '#352920', '#4b3b2f'],
    top: ['#3a2c26', '#4f3d33', '#675243', '#816a55', '#a0876b'],
    lip: '#b09878', seam: 'rgba(8,4,6,0.55)', fleck: ['#c9b38f', '#8f8f9f', '#e2c27a'],
  },
  // Stone in the mouth of the tunnel: dark brown faces, tops lit gold by the star.
  warm: {
    face: ['#100a08', '#1c120c', '#2c1d12', '#422c1a', '#5e4024'],
    top: ['#3e2a1c', '#5a3e26', '#7c5630', '#a8743c', '#d49a52'],
    lip: '#ffe0a0', seam: 'rgba(24,10,4,0.55)', fleck: ['#ffe2a0', '#b07a40', '#fff0c8'],
  },
  // Wall plates on the left: purple-grey slabs whose top edges catch tan light.
  wall: {
    face: ['#1e1b28', '#2a2636', '#363044', '#433b4f', '#524859'],
    top: ['#5a4e50', '#6f6058', '#867462', '#9c8a72', '#b4a284'],
    lip: '#c8b48e', seam: 'rgba(6,4,12,0.55)', fleck: ['#b8aa98', '#7c7890', '#d8c08a'],
  },
  // Deep blue rock of the back wall and the right side, lit cold by the crystals.
  blue: {
    face: ['#0a1022', '#111b34', '#18284a', '#22385e', '#2e4a74'],
    top: ['#2a4a78', '#3a5f90', '#4d77a8', '#6890bf', '#86aad2'],
    lip: '#a6c4e4', seam: 'rgba(2,6,18,0.6)', fleck: ['#8fb4e0', '#5a78a8', '#d2e2f4'],
  },
  // The tunnel walls under the star: warm ochre facets.
  gold: {
    face: ['#3a2416', '#5c3a20', '#8a5a2c', '#b8823e', '#dca456'],
    top: ['#c08848', '#dca45a', '#efc072', '#f8d690', '#fff0c0'],
    lip: '#fff2c8', seam: 'rgba(40,18,6,0.5)', fleck: ['#ffe2a0', '#c08040', '#fff4d0'],
  },
};

// Stone with granite speckle and crushed facets, a little stronger than the default.
export const CAVE_STONE = [{ tex: 'stone', amt: 0.9 }, { tex: 'crumple', amt: 0.55, scale: 0.34 }];

const ramp = (r, k) => {
  const x = clamp(k) * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(x));
  return mix(r[i], r[i + 1], x - i);
};

// Fill a polygon with Voronoi facets shaded from a ramp.
//   ramp    colours dark -> lit;  shadeOf(cell centre, tilt) -> 0..1 picks the colour
//   n       facet count;  sy  < 1 stretches cells vertically, > 1 flattens them
//   seam    colour of the cuts between facets (drawn underneath)
export function facets(ctx, pts, { ramp: R, n = 30, sy = 1, seed = 1, shade = () => 0.5, tilt = 0.18, seam = 'rgba(0,0,0,0.5)', gap = 0.7, bevel = 0.12, light = [0.35, -0.94] }) {
  const rng = new RNG(`facets:${seed}`);
  const b = boxOf(pts);
  const box = [[b.x - 4, b.y - 4], [b.x + b.w + 4, b.y - 4], [b.x + b.w + 4, b.y + b.h + 4], [b.x - 4, b.y + b.h + 4]];
  const seeds = scatterIn(box, n, rng);
  const clip = pathOf(pts);
  ctx.save();
  ctx.clip(clip);
  ctx.fillStyle = seam;
  ctx.fill(clip);
  for (const cell of voronoi(box, seeds, { sy })) {
    const [cx, cy] = cell.seed;
    const k = shade(cx, cy) + rng.range(-tilt, tilt);
    const p = pathOf(gap ? inset(cell.pts, gap) : cell.pts);
    ctx.fillStyle = vary(ramp(R, k), rng, 0.04);
    ctx.fill(p);
    if (bevel) bevelBands(ctx, p, { light, width: 1.3, hi: bevel, lo: bevel * 0.8, soft: 0 });
  }
  ctx.restore();
  return clip;
}

// Granite specks and a few gold flecks over a shape.
export function specks(ctx, pts, { count, colors, seed = 1, size = 1.4, alpha = 0.55 }) {
  const rng = new RNG(`specks:${seed}`);
  ctx.save();
  ctx.clip(pathOf(pts));
  const b = boxOf(pts);
  for (let i = 0; i < count; i++) {
    const r = 0.4 + rng.next() * rng.next() * size;
    ctx.fillStyle = rgba(rng.pick(colors), alpha * rng.range(0.35, 1));
    ctx.beginPath();
    ctx.arc(b.x + rng.next() * b.w, b.y + rng.next() * b.h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Jagged polyline between two points: rock edges are cut in short straight steps.
export function jag(a, b, { amp = 4, step = 18, seed = 1 } = {}) {
  const nz = noise(`jag:${seed}`);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.round(L / step));
  const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const d = i === 0 || i === n ? 0 : nz.n1(i * 0.9) * amp + (nz.n1(i * 3.1 + 5) > 0.3 ? amp * 0.5 : 0);
    out.push([a[0] + (b[0] - a[0]) * k + nx * d, a[1] + (b[1] - a[1]) * k + ny * d]);
  }
  return out;
}

// Smooth polyline through points (Catmull-Rom), sampled about every `step` px.
export function smoothLine(pts, step = 16) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Clamped smoothstep.
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const polyline = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };

// One round of Chaikin corner cutting on a closed polygon: sharp slab corners become
// short chamfers, so cut stone reads rounded-faceted rather than rectangular.
export function chaikin(pts, k = 0.25) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)], [lerp(a[0], b[0], 1 - k), lerp(a[1], b[1], 1 - k)]);
  }
  return out;
}

// A rock shelf seen from slightly above, built as a row of rounded stones. Each stone
// has its own humped, lit top, a front face that rounds into shade at its sides, broken
// strata at its own heights and a dark crack where it meets its neighbour; the front
// edge dips into a rounded notch between stones.
//   front   top front edge, left to right, as [[x, y], ...] (two or more points)
//   depth   how far the top surface recedes (px up from the front edge)
//   h       face height below the front edge (or [left, right])
//   flare   px the face spreads outward toward its foot [left, right]
//   pal     ROCK palette;  glow: { x, y, r, color, amount } light pooled on the stone
export function paintLedge(ctx, o) {
  const { front, depth = 30, h = 120, flare = [10, 10], pal = ROCK.ledge, light = [0.35, -0.94], seed = 1, glow = [], detail = 1 } = o;
  const rng = new RNG(`ledge:${seed}`);
  const nz = noise(`ledgenz:${seed}`);
  const [hl, hr] = Array.isArray(h) ? h : [h, h];
  const A0 = front[0], B0 = front[front.length - 1];
  const span = Math.abs(B0[0] - A0[0]) || 1;
  const uOf = (x) => clamp((x - A0[0]) / ((B0[0] - A0[0]) || 1));
  const hAt = (u) => lerp(hl, hr, u);
  const D = depth * 1.35;
  const sag = Math.min(14, depth * 0.2);
  const litRight = light[0] >= 0;
  // Stones: widths scale with the shelf height; neighbours sit a little higher or lower.
  const hMax = Math.max(hl, hr);
  const bw = clamp(hMax * 0.8 + 50, 70, 260);
  const cuts = [];
  for (let x = A0[0] + bw * rng.range(0.55, 1.1); x < B0[0] - bw * 0.45; x += bw * rng.range(0.65, 1.35)) cuts.push(x);
  const xs = [A0[0], ...cuts, B0[0]];
  const lift = xs.slice(1).map(() => rng.range(-1, 1) * Math.min(8, depth * 0.16 + 2.5));
  const nW = clamp(bw * 0.09, 6, 18), nD = clamp(depth * 0.16 + 2, 3, 8);
  const blockOf = (x) => { let i = 0; while (i < cuts.length && x > cuts[i]) i++; return i; };
  const liftAt = (x) => { let v = lift[0]; for (let i = 0; i < cuts.length; i++) v += (lift[i + 1] - lift[i]) * sstep(cuts[i] - nW, cuts[i] + nW, x); return v; };
  const notch = (x) => cuts.reduce((s, c) => { const d = Math.abs(x - c) / nW; return s + (d < 1 ? nD * (1 - d * d) : 0); }, 0);
  const localU = (x) => { const i = blockOf(x); return clamp((x - xs[i]) / Math.max(1, xs[i + 1] - xs[i])); };
  const edge = smoothLine(front, 6).map(([x, y]) => [x, y + sag * Math.sin(Math.PI * uOf(x)) + nz.n1(x * 0.05) * 3 + nz.n1(x * 0.19 + 4) * 1.3 - liftAt(x) + notch(x)]);
  const A = edge[0], B = edge[edge.length - 1];
  const edgeY = (x) => { const u = uOf(x); return lerp(A[1], B[1], u) + sag * Math.sin(Math.PI * u) - liftAt(x); };
  // Top: every stone humps back in a rounded arc; the shelf rounds off at both ends.
  const back = edge.map(([x, y]) => {
    const u = uOf(x), env = Math.pow(Math.sin(Math.PI * u), 0.45), hump = 0.86 + 0.2 * Math.sin(Math.PI * localU(x));
    return [x + (0.5 - u) * D * 0.3 * env, y - notch(x) * 0.6 - D * env * hump * (0.8 + 0.3 * (0.5 + 0.5 * nz.n1(x * 0.012 + 7)))];
  });
  const top = [...edge, ...back.slice(1, -1).reverse()];
  const side = (P, f, hh, dir, s) => {
    const pts = [];
    for (let i = 1; i < 8; i++) {
      const t = i / 8, bul = Math.sin(Math.PI * t) * Math.min(18, hh * 0.14);
      pts.push([P[0] + dir * (f * t + bul) + nz.n1(t * 5 + s) * 3, P[1] + hh * t]);
    }
    return pts;
  };
  const rightSide = side(B, flare[1], hr, 1, 11);
  const leftSide = side(A, flare[0], hl, -1, 23).reverse();
  const foot = edge.filter((_, i) => i % 3 === 0).reverse().map(([x, y]) => {
    const u = uOf(x);
    return [x + lerp(-flare[0], flare[1], u), y - notch(x) + hAt(u) + nz.n1(x * 0.03 + 3) * 6];
  });
  const face = [...edge, ...rightSide, ...foot, ...leftSide];

  const area = span * (hl + hr) / 2;
  const glowAt = (x, y) => glow.reduce((s, g) => s + g.amount * clamp(1 - Math.hypot(x - g.x, (y - g.y) * 1.6) / g.r), 0);
  const ends = (u) => Math.pow(1 - Math.sin(Math.PI * u), 3);
  // Each stone rounds into shade at its sides and is a touch lighter toward the light.
  const round = (x, p = 3) => { const lu = localU(x), s = litRight ? lu : 1 - lu; return 0.16 * (s - 0.5) - 0.34 * Math.pow(Math.abs(lu - 0.5) * 2, p); };
  const faceClip = facets(ctx, face, {
    ramp: pal.face, n: Math.round(clamp(area / 2200, 6, 80) * detail), sy: 1.2, seed: `${seed}F`, light, seam: pal.seam, bevel: 0.2, tilt: 0.3,
    shade: (x, y) => {
      const u = uOf(x), v = clamp((y - edgeY(x)) / Math.max(1, hAt(u)));
      return 0.66 - v * 0.52 + round(x) - 0.26 * ends(u) + glowAt(x, y) * 0.5;
    },
  });
  brush(ctx, faceClip, { angle: 0.06, amt: 0.18, scale: 0.8, seed: rng.int(1, 1e6) });
  ctx.save();
  ctx.clip(faceClip);
  const last = xs.length - 2;
  for (let i = 0; i <= last; i++) {
    const x0 = xs[i], x1 = xs[i + 1], wB = x1 - x0;
    const xm = (x0 + x1) / 2, hh = hAt(uOf(xm)), ey = edgeY(xm);
    const rx0 = i === 0 ? x0 - flare[0] - 40 : x0, rx1 = i === last ? x1 + flare[1] + 40 : x1;
    const y0 = ey - 30, y1 = ey + hh + 40;
    // Rounded shading across the stone and occlusion toward its foot.
    const gx = ctx.createLinearGradient(x0, 0, x1, 0);
    const dark = 'rgba(4,2,4,0.46)', lit = rgba(pal.lip, 0.15);
    gx.addColorStop(0, litRight ? dark : lit); gx.addColorStop(0.3, 'rgba(0,0,0,0)'); gx.addColorStop(0.78, 'rgba(0,0,0,0)'); gx.addColorStop(1, litRight ? lit : dark);
    ctx.fillStyle = gx;
    ctx.fillRect(rx0, y0, rx1 - rx0, y1 - y0);
    const gy = ctx.createLinearGradient(0, ey, 0, ey + hh);
    gy.addColorStop(0, rgba(pal.lip, 0.12)); gy.addColorStop(0.22, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(3,2,4,0.42)');
    ctx.fillStyle = gy;
    ctx.fillRect(rx0, y0, rx1 - rx0, y1 - y0);
    // Broken strata: short layered steps at this stone's own heights, tapering out.
    const m = Math.max(0, (hh > 150 ? 2 : hh > 56 ? 1 : 0) + (rng.chance(0.3) ? 1 : 0) - (rng.chance(0.25) ? 1 : 0));
    for (let k = 0; k < m; k++) {
      const f = clamp((k + 1) / (m + 1) + rng.range(-0.12, 0.12), 0.15, 0.85);
      const a = x0 + wB * rng.range(-0.05, 0.25), b = x1 - wB * rng.range(-0.05, 0.3);
      const tilt = rng.range(-0.14, 0.14), occH = rng.range(6, 11), lipH = rng.range(2.5, 4.5);
      const line = [];
      for (let s = 0; s <= 12; s++) {
        const xx = lerp(a, b, s / 12);
        line.push([xx, edgeY(xx) + hh * f + (xx - (a + b) / 2) * tilt + nz.n1(xx * 0.05 + k * 9 + i * 3) * 4]);
      }
      const taper = (s) => Math.pow(Math.sin((Math.PI * s) / 12), 0.6);
      ctx.fillStyle = 'rgba(4,2,6,0.45)';
      ctx.fill(pathOf([...line.map(([xx, yy], s) => [xx, yy - occH * taper(s)]), ...line.slice().reverse()]));
      ctx.fillStyle = rgba(mix(pal.top[1], pal.face[4], 0.4), 0.78);
      ctx.fill(pathOf([...line, ...line.map(([xx, yy], s) => [xx, yy + lipH * taper(s)]).reverse()]));
    }
  }
  // Cracks between stones: a soft shadow, the dark cut and a lit sliver on the side
  // that faces the light.
  for (const c of cuts) {
    const y0 = edgeY(c) + nD * 0.8, hh = hAt(uOf(c));
    const pts = jag([c, y0], [c + rng.range(-14, 14), y0 + hh * rng.range(0.75, 1.1)], { amp: 3.5, step: 9, seed: `${seed}k${Math.round(c)}` });
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4,2,4,0.3)'; ctx.lineWidth = 8; polyline(ctx, pts);
    ctx.strokeStyle = 'rgba(5,3,5,0.85)'; ctx.lineWidth = rng.range(1.8, 2.8); polyline(ctx, pts);
    ctx.strokeStyle = rgba(pal.lip, 0.3); ctx.lineWidth = 1.1; polyline(ctx, pts.map(([x, y]) => [x + (litRight ? -2.6 : 2.6), y]));
  }
  // A few short hairline cracks inside the stones.
  const nCracks = Math.round(span / 140);
  for (let i = 0; i < nCracks; i++) {
    const u = rng.range(0.08, 0.92), x = lerp(A[0], B[0], u), y0 = edgeY(x) + hAt(u) * rng.range(0.05, 0.5);
    const pts = jag([x, y0], [x + rng.range(-26, 26), y0 + hAt(u) * rng.range(0.15, 0.35)], { amp: 3, step: 8, seed: `${seed}c${i}` });
    ctx.strokeStyle = 'rgba(6,3,6,0.5)';
    ctx.lineWidth = rng.range(0.8, 1.6);
    polyline(ctx, pts);
  }
  // Chamfer just under the front edge, the rounded lip of each stone.
  const ch = clamp(depth * 0.22, 4, 12);
  ctx.fillStyle = rgba(ramp(pal.top, 0.22), 0.85);
  ctx.fill(pathOf([...edge, ...edge.slice().reverse().map(([x, y]) => [x, y + ch * (0.7 + 0.5 * (0.5 + 0.5 * nz.n1(x * 0.04 + 2)))])]));
  ctx.restore();
  // Top: lit facets, brighter toward the front lip and the light, dimmer where stones meet.
  const topArea = span * D * 0.6;
  const topClip = facets(ctx, top, {
    ramp: pal.top, n: Math.round(clamp(topArea / 900, 4, 80) * detail), sy: 1.8, seed: `${seed}T`, light, seam: pal.seam, tilt: 0.22, bevel: 0.22,
    shade: (x, y) => {
      const u = uOf(x);
      return 0.62 + glowAt(x, y) * 0.4 + (1 - clamp((edgeY(x) - y) / D)) * 0.2 - 0.22 * ends(u) + round(x, 4) * 0.8 + liftAt(x) * 0.012;
    },
  });
  brush(ctx, topClip, { angle: 0, amt: 0.16, scale: 0.7, seed: rng.int(1, 1e6) });
  // Light pooled on the stone from nearby crystals or the tunnel.
  const whole = new Path2D();
  whole.addPath(pathOf(face));
  whole.addPath(pathOf(top));
  for (const g of glow) {
    if (!g.color) continue;
    ctx.save();
    ctx.clip(whole);
    ctx.globalCompositeOperation = 'soft-light';
    const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    gr.addColorStop(0, rgba(g.color, g.amount)); gr.addColorStop(1, rgba(g.color, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    ctx.restore();
  }
  // The lit lip along each stone's front edge, broken at the notches.
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  let run = [];
  const flush = () => {
    if (run.length > 2) {
      ctx.strokeStyle = rgba(pal.lip, 0.16); ctx.lineWidth = 4.5; polyline(ctx, run);
      ctx.strokeStyle = rgba(pal.lip, 0.72); ctx.lineWidth = 1.8; polyline(ctx, run);
    }
    run = [];
  };
  for (const [x, y] of edge) {
    if (notch(x) > nD * 0.35) flush();
    else run.push([x, y + 1]);
  }
  flush();
  ctx.restore();
  specks(ctx, face, { count: Math.round(area / 220), colors: pal.fleck, seed: `${seed}s1`, alpha: 0.45 });
  specks(ctx, top, { count: Math.round(topArea / 90), colors: pal.fleck, seed: `${seed}s2`, alpha: 0.55 });
  return { top, face, edge };
}

// A big wall plate: a dark faceted slab with a band of light along the edges facing
// the light, like thick card cut at an angle.
//   pts    outline;  band: width of the lit band (px);  pal: ROCK palette
export function paintPlate(ctx, pts, { pal = ROCK.wall, light = [0.35, -0.94], seed = 1, band = 14, n = null, lit = 0.6, shade = null, torn = 2.5 }) {
  const rng = new RNG(`plate:${seed}`);
  const shape = torn ? tear(pts, { amp: torn, freq: 0.05, fine: 0.6, seed: rng.int(1, 1e6), step: 6 }) : pts;
  const b = boxOf(shape);
  const count = n ?? Math.round(clamp((b.w * b.h) / 2600, 6, 80));
  const clip = facets(ctx, shape, { ramp: pal.face, n: count, seed: `${seed}P`, light, seam: pal.seam, shade: shade ?? (() => 0.5), tilt: 0.25 });
  brush(ctx, clip, { angle: rng.range(0, Math.PI), amt: 0.2, scale: 0.8, seed: rng.int(1, 1e6) });
  // Lit band: the shape minus a torn copy of itself shifted away from the light.
  if (band > 0) {
    const shifted = tear(shape.map(([x, y]) => [x - light[0] * band, y - light[1] * band]), { amp: band * 0.3, freq: 0.06, fine: 1, seed: rng.int(1, 1e6), step: 5 });
    const outside = new Path2D();
    outside.rect(b.x - band * 4, b.y - band * 4, b.w + band * 8, b.h + band * 8);
    outside.addPath(pathOf(shifted));
    ctx.save();
    ctx.clip(outside, 'evenodd');
    facets(ctx, shape, { ramp: pal.top, n: Math.round(count * 0.45), seed: `${seed}B`, light, seam: pal.seam, shade: () => lit, tilt: 0.25, gap: 0.5, bevel: 0.15 });
    ctx.restore();
  }
  specks(ctx, shape, { count: Math.round((b.w * b.h) / 300), colors: pal.fleck, seed: `${seed}s`, alpha: 0.45 });
  return clip;
}

// An icy stalactite hanging from (x, y): a long pointed shard with a lit and a shaded
// face split by a ridge.
//   len, w (half width at the root), lean (tip offset in px), colors: [dark, mid, pale]
export function paintStalactite(ctx, { x, y, len, w, lean = 0, colors, seed = 1, light = [0.35, -0.94], ridge = 0.5, shadow = true }) {
  const rng = new RNG(`stal:${seed}`);
  const [dark, mid, pale] = colors;
  const tip = [x + lean, y + len];
  const kink = rng.range(0.35, 0.65);
  const L = [[x - w, y - 6], [x - w * rng.range(0.75, 0.95), y + len * kink * 0.6], [x - w * 0.45 + lean * kink, y + len * kink], tip];
  const R = [tip, [x + w * 0.45 + lean * kink, y + len * kink * rng.range(0.9, 1.1)], [x + w * rng.range(0.75, 0.95), y + len * kink * 0.5], [x + w, y - 6]];
  const rx = x + w * (ridge * 2 - 1) * 0.6;
  const ridgeLine = [[rx, y - 6], [rx + (lean * kink) * 0.9 + w * (ridge - 0.5) * 0.3, y + len * kink], tip];
  const outline = [...L, ...R.slice(1)];
  const litLeft = light[0] < 0;
  const left = [...L, ...ridgeLine.slice().reverse().slice(1)];
  const right = [...ridgeLine, ...R.slice(1)];
  const g = (c0, c1) => {
    const gr = ctx.createLinearGradient(x, y, tip[0], tip[1]);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    return gr;
  };
  piece(ctx, outline, { fill: dark, shadow: shadow ? { color: 'rgba(2,6,16,0.55)', blur: Math.max(4, w * 0.3), x: -light[0] * 4, y: 5 } : null });
  piece(ctx, left, { fill: g(litLeft ? mid : dark, litLeft ? pale : mix(dark, mid, 0.5)) });
  piece(ctx, right, { fill: g(litLeft ? dark : mid, litLeft ? mix(dark, mid, 0.5) : pale) });
  // Ice cracks: a few pale shards and dark slits inside.
  const lit = litLeft ? left : right;
  ctx.save();
  ctx.clip(pathOf(outline));
  for (let i = 0; i < Math.round(len / 30); i++) {
    const u = rng.range(0.05, 0.85), cx = lerp(x, tip[0], u) + rng.range(-0.5, 0.5) * w * (1 - u), cy = lerp(y, tip[1], u);
    const s = w * (1 - u) * rng.range(0.3, 0.7);
    ctx.fillStyle = rgba(rng.chance(0.6) ? pale : dark, rng.range(0.2, 0.5));
    ctx.beginPath();
    ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s * rng.range(-0.3, 0.6), cy - s * rng.range(0.6, 1.6)); ctx.lineTo(cx + s, cy + s * rng.range(0.4, 1.5));
    ctx.fill();
  }
  ctx.restore();
  bevelBands(ctx, pathOf(lit), { light, width: 1.4, hi: 0.4, lo: 0.1, soft: 0 });
  ctx.save();
  ctx.strokeStyle = rgba(pale, 0.7);
  ctx.lineWidth = Math.max(0.8, w * 0.04);
  ctx.beginPath(); ridgeLine.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
  ctx.restore();
  return { tip, outline };
}

// Blur a baked sprite in place: depth of field for cut-outs right in front of the lens.
export function soften(sprite, px) {
  const c = sprite.canvas;
  const tmp = surface(c.width, c.height);
  tmp.ctx.filter = `blur(${px * sprite.res}px)`;
  tmp.ctx.drawImage(c, 0, 0);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(tmp.canvas, 0, 0);
  return sprite;
}
