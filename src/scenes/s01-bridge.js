// s01 footbridge: a small arched wooden bridge seen from the front left, cut from
// dozens of bark-brown paper blocks. The walking deck is a band of transverse planks,
// its front edge a row of blocky plank ends, and below it a curved rib of voussoir
// blocks over the stream. Four square posts stand at the corners.
//
// All geometry is in film px with the camera at rest. deckY(x) is the walking line the
// fox's paws follow.

import { RNG } from '../core/rng.js';
import { piece, linear } from '../core/piece.js';
import { mix, shade, vary, rgba } from '../core/color.js';
import { emboss } from '../elements/trees.js';

// Deck far edge: an arch whose crown sits at x 690, steeper on the right where the
// bridge turns slightly away from the lens.
const CROWN_X = 690;
const CROWN_Y = 590;
const RISE_L = 0.00022;
const RISE_R = 0.00035;
const DECK_DEPTH = 24;      // far edge to near edge, as seen from above
const EDGE_ROW = 15;        // height of the row of plank ends below the near edge
// Arch opening (intrados) under the front rib.
const ARCH_X0 = 440, ARCH_X1 = 1036, ARCH_TOP = 662, ARCH_K = 0.00067, ARCH_MID = 736;
export const BRIDGE_X0 = 296, BRIDGE_X1 = 1092;
const FOOT_Y = 790;         // abutments run down behind the banks

export const WOOD = {
  deck: ['#8c7060', '#7c6252', '#977a64', '#6f5646', '#86684f'],
  ends: ['#9a7a5e', '#8a6a52', '#a8876a', '#7a5c47'],
  rib: ['#5e4434', '#6e503c', '#4f3a2d', '#7a5a43', '#654734'],
  post: ['#6e5442', '#5a4334'],
  soffit: '#2c1d16',
  crack: '#24170f',
  lit: '#e8b27a',
};

export const farEdge = (x) => CROWN_Y + (x < CROWN_X ? RISE_L : RISE_R) * (x - CROWN_X) ** 2;
export const nearEdge = (x) => farEdge(x) + DECK_DEPTH;
// Where paws land: a little in front of the far edge.
export const deckY = (x) => farEdge(x) + 11;
const intrados = (x) => ARCH_TOP + ARCH_K * (x - ARCH_MID) ** 2;

// Bottom of the front face at x: the arch opening, or the ground at the abutments.
function faceBottom(x) {
  if (x <= ARCH_X0 || x >= ARCH_X1) return FOOT_Y;
  return intrados(x);
}

const curve = (f, x0, x1, step = 6, dy = 0) => {
  const pts = [];
  for (let x = x0; x < x1; x += step) pts.push([x, f(x) + dy]);
  pts.push([x1, f(x1) + dy]);
  return pts;
};

// Fibre grain plus pale and dark flecks, like the torn bark paper of the reference.
function woodGrain(ctx, path, box, rng, angle = 0) {
  emboss(ctx, path, box, { kind: 'bark', alpha: 0.32, angle, scale: 0.7, seed: rng.int(1, 1e6) });
  ctx.save();
  ctx.clip(path);
  const n = Math.round((box.w * box.h) / 90);
  for (let i = 0; i < n; i++) {
    const x = box.x + rng.next() * box.w, y = box.y + rng.next() * box.h;
    const l = rng.range(2, 7), a = angle + rng.range(-0.3, 0.3);
    ctx.strokeStyle = rng.chance(0.55) ? rgba('#ffe2c0', rng.range(0.08, 0.22)) : rgba('#140a05', rng.range(0.1, 0.3));
    ctx.lineWidth = rng.range(0.6, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

const boxOf = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

function block(ctx, pts, fill, rng, light, { angle = 0, shadow = true, torn = 1 } = {}) {
  const path = piece(ctx, pts, {
    fill,
    torn: torn ? { amp: torn, freq: 0.18, fine: 0.5, seed: rng.int(1, 999) } : null,
    shadow: shadow ? { color: 'rgba(20,10,4,0.55)', blur: 3, x: -1.2, y: 2 } : null,
    bevel: { light, width: 1.6, hi: 0.3, lo: 0.32, hiColor: WOOD.lit, soft: 0.4 },
  });
  woodGrain(ctx, path, boxOf(pts), rng, angle);
  return path;
}

// A square post with a lit cap and a lit flank toward the sun.
function post(ctx, x, top, bottom, w, rng, light) {
  const d = w * 0.35;
  block(ctx, [[x + w, top + 2], [x + w + d, top - 3], [x + w + d, bottom - 6], [x + w, bottom]], shade(WOOD.post[0], 0.08), rng, light, { angle: Math.PI / 2 });
  block(ctx, [[x, top], [x + w, top + 2], [x + w, bottom], [x, bottom - 2]], vary(WOOD.post[1], rng, 0.06), rng, light, { angle: Math.PI / 2 });
  block(ctx, [[x - 1, top + 1], [x + d, top - 5], [x + w + d + 1, top - 4], [x + w + 1, top + 3]], '#9c7d63', rng, light, { shadow: false });
}

// Paint the whole bridge into a sprite (box BRIDGE_BOX).
export function drawBridge(ctx, { light, seed = 's01-bridge' } = {}) {
  const rng = new RNG(seed);

  // Far posts and the left ramp down to the bank sit behind the deck.
  post(ctx, 322, 598, 690, 40, rng, light);
  post(ctx, 858, 560, 612, 30, rng, light);

  // Inner vault in shadow, seen through the right half of the opening.
  const vault = [...curve(intrados, ARCH_MID - 60, ARCH_X1 + 4)];
  const back = curve((x) => intrados(x) + 6 + 34 * ((x - ARCH_MID + 60) / (ARCH_X1 - ARCH_MID + 64)) ** 1.4, ARCH_MID - 60, ARCH_X1 + 4).reverse();
  piece(ctx, [...vault, ...back], { fill: linear(ctx, ARCH_MID, 0, ARCH_X1, 0, ['#3a271c', WOOD.soffit]), torn: { amp: 1.5, seed: 3 } });

  // Front face: a dark backing, then voussoir blocks along the rib.
  const top = (x) => nearEdge(x) + EDGE_ROW - 2;
  const facePts = [...curve(top, BRIDGE_X0, BRIDGE_X1, 8), ...curve(faceBottom, BRIDGE_X0, BRIDGE_X1, 4).reverse()];
  piece(ctx, facePts, { fill: '#3b2a20', shadow: { color: 'rgba(15,8,4,0.6)', blur: 8, x: -2, y: 5 } });
  for (let x = BRIDGE_X0; x < BRIDGE_X1;) {
    const w = rng.range(20, 34);
    const x1 = Math.min(BRIDGE_X1, x + w);
    const yb0 = faceBottom(x), yb1 = faceBottom(x1);
    const yt0 = top(x), yt1 = top(x1);
    // Long blocks are split once along the arch, like stacked timbers.
    const rows = yb0 - yt0 > 70 ? 3 : yb0 - yt0 > 34 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const f0 = r / rows, f1 = (r + 1) / rows;
      const g = 1.2;
      const pts = [
        [x + g, yt0 + (yb0 - yt0) * f0 + g], [x1 - g, yt1 + (yb1 - yt1) * f0 + g],
        [x1 - g, yt1 + (yb1 - yt1) * f1 - g], [x + g, yt0 + (yb0 - yt0) * f1 - g],
      ];
      block(ctx, pts, vary(rng.pick(WOOD.rib), rng, 0.08), rng, light, { angle: Math.atan2(yt1 - yt0, x1 - x) });
    }
    x = x1;
  }

  // Row of plank ends along the front of the deck.
  for (let x = BRIDGE_X0 - 2; x < BRIDGE_X1 + 2;) {
    const w = rng.range(17, 27);
    const x1 = x + w;
    const lift = rng.range(-1.5, 2);
    block(ctx, [
      [x + 1, nearEdge(x) - lift], [x1 - 1, nearEdge(x1) - lift],
      [x1 - 1, nearEdge(x1) + EDGE_ROW - lift], [x + 1, nearEdge(x) + EDGE_ROW - lift],
    ], vary(rng.pick(WOOD.ends), rng, 0.07), rng, light, { angle: Math.PI / 2 });
    x = x1 + rng.range(0.5, 2.5);
  }

  // Walking deck: transverse planks between the far and near edges, slightly askew.
  for (let x = BRIDGE_X0; x < BRIDGE_X1;) {
    const w = rng.range(15, 24);
    const x1 = Math.min(BRIDGE_X1, x + w);
    const sk = 4 + rng.range(-1.5, 1.5);
    block(ctx, [
      [x + sk, farEdge(x + sk)], [x1 + sk, farEdge(x1 + sk)],
      [x1, nearEdge(x1) + 1], [x, nearEdge(x) + 1],
    ], vary(rng.pick(WOOD.deck), rng, 0.08), rng, light, { angle: Math.PI / 2 + 0.15, torn: 0.8 });
    x = x1 + rng.range(0.8, 2);
  }

  // Near posts stand in front of everything.
  post(ctx, 410, 618, 724, 44, rng, light);
  post(ctx, 1040, 590, 744, 34, rng, light);
  block(ctx, [[1074, 606], [1112, 610], [1112, 620], [1074, 617]], '#7a5c47', rng, light);
}

export const BRIDGE_BOX = { x: BRIDGE_X0 - 30, y: 530, w: BRIDGE_X1 - BRIDGE_X0 + 90, h: FOOT_Y - 530 + 30 };

// Bake the bridge on its own plane. Returns the layer.
export function addBridge(S, { z = 980 } = {}) {
  return S.plane(z, {
    name: 'bridge', ...BRIDGE_BOX, res: 1.25, mat: 'paper',
    edge: { width: 1.4, hi: 0.25, lo: 0.3, soft: 0.6, hiColor: WOOD.lit },
    shadow: { blur: 9 },
    draw(ctx) { drawBridge(ctx, { light: S.light }); },
  }, { tags: ['bridge'] });
}
