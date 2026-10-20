// Skeleton of the paper fox, traced from the references.
//
// Fox units: film px at scale 1 (the ref02 fox is ~355 units from ear tip to paws),
// origin on the ground between the paws, the fox facing +x, y down.
//
// A rig holds the rest geometry of every part for one view:
//   torso.outline   ONE closed silhouette for the whole body: neck, back, rump, the back
//                   and underside of the thigh, the crease in front of it, belly, elbow,
//                   chest. The haunch is part of this outline, never a separate disc.
//                   18 control points with the same meaning in every rig (see BODY_POINTS).
//   torso.rows      fur rows lofted from the rump cross-section (`from`, laid first)
//                   through `mid` to the shoulder cross-section (`to`, laid last), so each
//                   row of tufts laps over the one behind it like shingles.
//   torso.thigh     rows over the haunch, from the knee arc (`from`) up to the hip (`to`).
//   torso.shoulder  rows over the shoulder blade down to the elbow.
//   torso.haunch    (standing rigs) the thigh as its own crisp cut-out inside the body,
//                   clipped to the outline.
//   torso.cape      a line of body fur lapping over the top of the haunch.
//   torso.shades    soft paper overlays clipped to the body: [x, y, rx, ry, rot, k],
//                   k > 0 a highlight, k < 0 a shadow (belly, behind the shoulder, the
//                   crease in front of the thigh, under the thigh).
//   tail            spine (6 points), full widths, tuft size, where the white brush starts.
//   legs            a = hip / shoulder, b = hock / wrist, c = ankle, toe = paw tip.
// and where the head group sits (earScale: ears cut larger about their base; trim: the
// standing rigs' fitted fur, see fox-paint.js paintBody). The head, ears, neck and ruff are painted once in the
// ref02 position (fox-paint.js) and moved as a group by `neckOffset` and leaned by
// `neckTilt` (about `neckPivot`); the head on top of it is tilted further by `headTilt`
// and scaled by `headScale` (about `headPivot`).
//
// Rigs that blend (standRear <-> standSide) must have the same shape: the same keys
// and the same number of points in every list.

import { lerp } from '../core/ease.js';

// Index meaning of the 18 outline points, the same in every rig (for blending).
export const BODY_POINTS = ['neck', 'withers', 'back', 'loin', 'croup', 'rump', 'thighBack', 'thighLow', 'knee', 'stifle',
  'crease', 'waist', 'belly', 'elbow', 'chestLow', 'chest', 'chestHigh', 'throat'];

// ref02: standing, rear three-quarter view, head carried high and turned up-right.
// Traced on a 25-unit grid over the reference fox. A LEAN body: the back runs down from
// the shoulders (-200 at the withers) to a rump at the lower left; a crisp rounded haunch
// (its own cut-out, `haunch`) fills the rear of the body down to the bent hock; a slim
// waist (the belly tucked up to -88) under the ribs, a deep chest between long straight
// forelegs. The tail is drawn OVER the rump in this view: it leaves the croup narrow and
// droops in a gentle S over the back of the haunch to a large white brush on the rock at
// the far left (the last ~42 % of its length).
const STAND_REAR = {
  torso: {
    outline: [[4, -228], [-36, -202], [-62, -186], [-92, -172], [-120, -153], [-140, -128], [-140, -96], [-124, -66], [-98, -52],
      [-64, -49], [-30, -64], [-12, -88], [12, -86], [38, -78], [60, -90], [72, -138], [74, -180], [56, -216]],
    backLine: [[-28, -206], [-58, -184], [-90, -168], [-116, -150], [-134, -126]],
    bellyLine: [[-56, -54], [-32, -68], [-12, -86], [14, -84], [38, -80]],
    belly: [[-16, -98], [16, -100], [18, -86], [-12, -88]],
    rows: { from: [[-120, -153], [-140, -120], [-128, -82]], mid: [[-62, -186], [-58, -134], [-48, -88]], to: [[4, -226], [30, -160], [40, -96]], n: 9 },
    thigh: { from: [[-136, -72], [-104, -52], [-68, -50], [-42, -62]], to: [[-142, -126], [-112, -140], [-78, -134], [-52, -112]], n: 5 },
    haunch: [[-106, -120], [-80, -130], [-52, -128], [-30, -114], [-20, -90], [-25, -66], [-42, -53], [-70, -51], [-100, -58], [-118, -86]],
    shoulder: { from: [[24, -88], [46, -82], [62, -94]], to: [[2, -202], [36, -206], [66, -180]], n: 4 },
    cape: [[-138, -118], [-118, -136], [-90, -144], [-62, -142], [-38, -128]],
    shades: [[-60, -180, 70, 18, -0.5, 0.24], [40, -168, 30, 40, 0, 0.2], [-92, -140, 36, 14, -0.3, 0.2], [0, -90, 56, 12, 0, -0.32],
      [14, -130, 14, 38, 0.2, -0.22], [-12, -84, 9, 26, 0.2, -0.45], [-72, -54, 40, 9, 0, -0.3]],
    size: [40, 54], gap: 22,
  },
  tail: {
    spine: [[-118, -126], [-150, -96], [-180, -58], [-214, -16], [-258, 36], [-306, 86]],
    width: [40, 112, 140, 138, 76, 5],
    size: [62, 84], white: 0.5, step: 30,
  },
  legs: {
    fh: { a: [-50, -96], b: [-62, -42], c: [-42, -12], toe: [-26, -6], hind: true, far: true },
    ff: { a: [-6, -112], b: [-8, -36], c: [-8, -18], toe: [8, -11], far: true },
    nh: { a: [-62, -92], b: [-92, -32], c: [-60, -9], toe: [-32, -1], hind: true },
    nf: { a: [42, -110], b: [44, -34], c: [46, -16], toe: [64, -8] },
  },
  hip: [-80, -100],
  breath: [-40, -115],
  neckPivot: [20, -206],
  headPivot: [36, -246],
  neckOffset: [-1, 0],
  neckTilt: 0,
  headTilt: -0.02,
  headScale: 1.03,
  earScale: 1.03,
  trim: true,
  ground: { c: [-50, -2], rx: 140, ry: 18 },
};

// ref01: walking, seen from the side (the walk uses yaw 0.92, a touch of the rear view).
// Traced from the reference: a short lean body, high withers and a back sloping gently
// to the croup, a deep chest over long dark forelegs, a slim waist, and a big crisp
// haunch filling the rear of the body; the tail leaves the croup and is held out behind
// and a little down to a big white brush. The head is held high on an upright neck.
const STAND_SIDE = {
  torso: {
    outline: [[50, -242], [5, -233], [-50, -228], [-105, -220], [-150, -208], [-182, -186], [-194, -148], [-182, -106], [-156, -80],
      [-118, -76], [-80, -94], [-36, -108], [10, -104], [56, -96], [100, -98], [126, -128], [134, -172], [118, -214]],
    backLine: [[30, -236], [-40, -226], [-100, -216], [-142, -204], [-170, -190]],
    bellyLine: [[-110, -80], [-72, -96], [-32, -110], [14, -106], [58, -98]],
    belly: [[-8, -124], [56, -120], [60, -102], [-4, -106]],
    rows: { from: [[-150, -204], [-186, -160], [-172, -110]], mid: [[-60, -219], [-55, -165], [-45, -108]], to: [[50, -238], [82, -180], [96, -100]], n: 10 },
    thigh: { from: [[-140, -122], [-110, -98], [-70, -95], [-36, -106]], to: [[-128, -204], [-96, -212], [-62, -200], [-36, -170]], n: 5 },
    haunch: [[-200, -232], [-122, -246], [-70, -240], [-40, -180], [-27, -128], [-34, -94], [-60, -79], [-110, -77], [-158, -88], [-204, -140]],
    shoulder: { from: [[72, -100], [100, -100], [126, -112]], to: [[50, -226], [92, -230], [128, -206]], n: 5 },
    cape: [[-184, -176], [-160, -200], [-126, -210], [-92, -206], [-60, -190]],
    shades: [[-40, -212, 90, 16, 0.05, 0.24], [96, -190, 30, 40, 0, 0.2], [-112, -184, 40, 14, -0.1, 0.2], [20, -108, 80, 12, 0, -0.32],
      [62, -160, 14, 40, 0.15, -0.22], [-20, -118, 9, 28, 0.2, -0.45], [-110, -80, 46, 9, 0, -0.3]],
    size: [40, 54], gap: 22,
  },
  tail: {
    spine: [[-150, -192], [-205, -144], [-252, -112], [-300, -86], [-346, -66], [-392, -50]],
    width: [44, 118, 138, 134, 84, 5],
    size: [64, 88], white: 0.47, step: 30,
  },
  legs: {
    fh: { a: [-96, -140], b: [-114, -52], c: [-84, -13], toe: [-64, -6], hind: true, far: true },
    ff: { a: [88, -122], b: [92, -41], c: [92, -18], toe: [110, -8], far: true },
    nh: { a: [-112, -140], b: [-128, -50], c: [-98, -12], toe: [-78, -5], hind: true },
    nf: { a: [108, -122], b: [112, -40], c: [112, -17], toe: [131, -6] },
  },
  hip: [-112, -150],
  breath: [-20, -160],
  neckPivot: [20, -206],
  headPivot: [36, -246],
  neckOffset: [86, -4],
  neckTilt: 0.25,
  headTilt: -0.06,
  headScale: 1.06,
  earScale: 1.12,
  trim: true,
  ground: { c: [-40, -2], rx: 200, ry: 16 },
};

// ref10: sitting on the haunches. Chest upright over straight forelegs, the back curving
// down into a big haunch that rests on the rock with the hind paw tucked forward under
// it, the head raised, the tail draped over the rock edge with the white brush below.
const SIT_REAR = {
  torso: {
    outline: [[-5, -222], [-42, -196], [-85, -162], [-118, -126], [-138, -92], [-150, -56], [-146, -24], [-126, -5], [-92, 2],
      [-50, 2], [-14, -30], [-2, -70], [18, -96], [40, -114], [60, -128], [72, -156], [68, -192], [40, -218]],
    backLine: [[-25, -205], [-65, -178], [-102, -144], [-130, -108], [-146, -70]],
    bellyLine: [[-12, -36], [0, -72], [18, -98], [40, -116]],
    belly: [[2, -84], [18, -98], [22, -82], [6, -72]],
    rows: { from: [[-138, -92], [-150, -56], [-140, -20]], mid: [[-75, -170], [-70, -114], [-55, -60]], to: [[-5, -222], [25, -156], [40, -110]], n: 9 },
    thigh: { from: [[-142, -28], [-115, -6], [-70, -2], [-24, -14]], to: [[-132, -100], [-100, -120], [-58, -112], [-18, -84]], n: 5 },
    shoulder: { from: [[14, -100], [40, -116], [60, -130]], to: [[-5, -190], [30, -196], [62, -170]], n: 4 },
    cape: [[-140, -80], [-125, -106], [-95, -126], [-60, -122], [-32, -100]],
    shades: [[-80, -160, 70, 22, -0.74, 0.24], [35, -165, 30, 40, 0, 0.2], [-78, -92, 46, 28, -0.2, 0.28], [10, -86, 26, 26, 0, -0.32],
      [15, -132, 16, 40, 0.2, -0.22], [-12, -52, 12, 40, 0.3, -0.4], [-85, -4, 55, 10, 0, -0.3]],
    size: [40, 54], gap: 22,
  },
  tail: {
    spine: [[-118, -60], [-160, -42], [-197, -20], [-230, 0], [-262, 16], [-294, 30]],
    width: [58, 98, 112, 104, 70, 5],
    size: [60, 82], white: 0.54, step: 30,
  },
  legs: {
    fh: { a: [-90, -50], b: [-128, -14], c: [-96, -8], toe: [-74, -3], hind: true, far: true },
    ff: { a: [14, -140], b: [12, -34], c: [10, -16], toe: [26, -9], far: true },
    nh: { a: [-62, -56], b: [-100, -14], c: [-58, -8], toe: [-30, -2], hind: true },
    nf: { a: [50, -142], b: [54, -32], c: [54, -14], toe: [72, -5] },
  },
  hip: [-62, -50],
  breath: [-10, -90],
  neckPivot: [20, -206],
  headPivot: [36, -246],
  neckOffset: [-28, 20],
  neckTilt: 0,
  headTilt: -0.04,
  headScale: 1.08,
  earScale: 1.12,
  ground: { c: [-75, -2], rx: 160, ry: 18 },
};

export const RIGS = { standRear: STAND_REAR, standSide: STAND_SIDE, sit: SIT_REAR };

// Blend two rigs of the same shape (numbers and nested arrays / objects).
function blend(A, B, t) {
  if (typeof A === 'number') return lerp(A, B, t);
  if (Array.isArray(A)) return A.map((v, i) => blend(v, B[i], t));
  if (A && typeof A === 'object') {
    const out = {};
    for (const k of Object.keys(A)) out[k] = typeof A[k] === 'boolean' ? A[k] : blend(A[k], B[k], t);
    return out;
  }
  return A;
}

// Rest rig for a pose. yaw: 0 = rear three-quarter (ref02), 1 = side-on (ref01).
export function rigFor(pose, yaw = 0) {
  if (pose === 'sit') return structuredClone(SIT_REAR);
  return blend(STAND_REAR, STAND_SIDE, Math.max(0, Math.min(1, yaw)));
}

// ---------------------------------------------------------------------------
// Two-bone inverse kinematics.

// Middle joint of a two-bone chain from a to target c with bone lengths l1, l2.
// bend = +1 or -1 picks the side the joint bulges to (see bendOf).
export function ik2(a, c, l1, l2, bend) {
  let dx = c[0] - a[0], dy = c[1] - a[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const dc = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  const cosA = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const base = Math.atan2(dy, dx);
  const ang = base + bend * A;
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}

// Which way a rest chain bends, so the solver reproduces the drawn pose.
export function bendOf(a, b, c) {
  const cross = (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
  return cross > 0 ? 1 : -1;
}
