// s05 snow peaks: everything nearer than the valley. The steep granite slope on the
// left with its spruces and snow ledges, the outcrop the fox stands on, the rocky
// trail climbing to it, snowy boulders, the red and yellow flowers bottom-left and
// the falling paper snow.

import { RNG } from '../core/rng.js';
import { piece } from '../core/piece.js';
import { drawSprites } from '../core/sprite.js';
import { mix, rgba } from '../core/color.js';
import { conifer, coniferMid, FOLIAGE, addHeroConifer } from '../elements/trees.js';
import { drawBoulder, drawTrail } from '../elements/terrain.js';
import { addFlowerBed, drawUndergrowth } from '../elements/flora.js';
import { rockFace, snowDrape, grassClump, GRANITE, hazed } from './s05-kit.js';
import { sliver } from '../elements/terrain-kit.js';

const L = [0.45, -0.89];
const tagAll = (layers, tag) => { for (const l of [layers].flat()) l.tags = [...(l.tags ?? []), tag]; return layers; };

// Shadowed granite of the slope behind the fox (it faces away from the star).
const GRANITE_DARK = { ...GRANITE, ramp: ['#0c0b10', '#18171e', '#242229', '#33303a', '#48434a', '#5e5858'] };
// Slope masses: near-black crevice faces up to warm grey lit planes, strong spread.
const GRANITE_SLOPE = { ...GRANITE, ramp: ['#0a090d', '#16151a', '#26242a', '#3a373c', '#5a5452', '#847c74'] };
// The outcrop catches the starlight: warmer, lighter grey planes.
const GRANITE_LIT = { ...GRANITE, ramp: ['#100f13', '#211f24', '#323035', '#474345', '#605a58', '#7e766f'] };
// Spruces of ref05: deep green with clearly lit tiers (not near-black).
const SPRUCE = { deep: '#0b281b', dark: '#18462c', mid: '#28603a', lit: '#3d7c46', hi: '#5f9c56', fleck: '#d6c27a' };
const SPRUCE_BACK = hazed(SPRUCE, '#0e2238', 0.25);

// ---------------------------------------------------------------------------
// The slope behind: a dark rock mass from the top-left corner down to the fox,
// spruces standing on it against the sky.
export function addLeftSlope(S) {
  const top = [[-320, -320], [262, -320], [292, 60], [318, 150], [352, 232], [392, 300], [438, 372], [488, 440], [540, 490], [600, 520], [640, 560]];
  S.plane(1260, {
    name: 'left-slope', x: -340, y: -340, w: 1000, h: 1260, mat: 'stone', shadow: { blur: 16 },
    draw(ctx) {
      const rng = new RNG('s05-left-slope');
      rockFace(ctx, [...top, [640, 900], [-320, 900]], { palette: GRANITE_DARK, light: L, seed: 701, sy: 0.7, tilt: 0.2, lit: 0.4 });
      // Spruces standing up the ridge, small and dark near the fox.
      const trees = [
        // Small dark spires high on the ridge (top-left corner), behind the big ones.
        [20, 120, 240], [120, 96, 220], [210, 110, 200], [262, 60, 170], [-90, 140, 260], [300, 150, 170],
        [-170, 330, 560], [-40, 300, 520], [70, 270, 460], [178, 268, 300], [262, 250, 260],
        // Spires standing out against the far peaks, right of the ridge line.
        [330, 252, 230], [372, 300, 250], [416, 352, 230], [462, 400, 190], [500, 440, 150],
        [345, 400, 220], [395, 420, 210], [440, 440, 170], [312, 330, 190], [228, 380, 240],
      ];
      for (const [x, y, h] of trees) {
        conifer(ctx, x + rng.range(-6, 6), y, h, {
          palette: x > 300 ? SPRUCE_BACK : SPRUCE, light: L, seed: rng.int(1, 1e6), width: 0.27, bias: x > 300 ? 0.5 : 0.68, contrast: 1.3,
          interior: true, trunkFrac: 0.06,
        });
      }
    },
  }).tags = ['near', 'trees'];
}

// ---------------------------------------------------------------------------
// The granite cascade on the left: rock blocks stepping down toward the trail,
// each capped by a torn snow ledge, and the snow banks under them.
export function addLeftCliff(S) {
  S.plane(1100, {
    name: 'left-cliff', x: -340, y: 80, w: 840, h: 840, mat: 'stone', res: 1, shadow: { blur: 14 },
    draw(ctx) {
      const rng = new RNG('s05-left-cliff');
      // Top-left block.
      rockFace(ctx, [[-320, 170], [40, 176], [120, 214], [150, 300], [128, 400], [60, 430], [-320, 440]], { palette: GRANITE_LIT, light: L, seed: 711, sy: 0.55, tilt: 0.35, lit: 0.46, contrast: 1.35 });
      snowDrape(ctx, [[-320, 140], [-120, 128], [10, 140], [96, 168], [160, 214], [178, 248], [140, 240], [96, 222], [40, 236], [-40, 226], [-140, 250], [-320, 262]],
        { light: L, seed: 712, shadeDir: [-0.4, 0.9], shadeAmt: 0.55, thick: 7 });
      // Middle block, the big grey face left of the trail.
      rockFace(ctx, [[120, 292], [232, 280], [318, 336], [372, 430], [384, 560], [352, 650], [250, 690], [150, 676], [112, 520]], { palette: GRANITE_LIT, light: L, seed: 713, sy: 0.5, tilt: 0.3, lit: 0.46, contrast: 1.35 });
      snowDrape(ctx, [[150, 290], [200, 264], [252, 270], [300, 302], [330, 344], [300, 350], [262, 334], [222, 346], [180, 326]],
        { light: L, seed: 714, shadeDir: [-0.5, 0.86], shadeAmt: 0.5, thick: 6 });
      snowDrape(ctx, [[286, 372], [340, 362], [392, 384], [436, 420], [470, 462], [452, 472], [416, 462], [404, 500], [380, 560], [350, 520], [330, 450], [300, 420]],
        { light: L, seed: 715, shadeDir: [-0.6, 0.8], shadeAmt: 0.85, thick: 9, tear: 3 });
      // Snow bank right of the middle block, sloping down to the trail, with grass.
      snowDrape(ctx, [[220, 520], [300, 500], [372, 520], [430, 560], [470, 620], [484, 680], [440, 700], [360, 690], [280, 668], [220, 620]],
        { light: L, seed: 716, shadeDir: [-0.5, 0.86], shadeAmt: 0.85, thick: 11, tear: 3.2 });
      // Low snow mound on the far left, below the big spruce.
      snowDrape(ctx, [[-320, 610], [-120, 590], [40, 596], [130, 622], [176, 680], [170, 760], [-320, 780]],
        { light: L, seed: 717, shadeDir: [-0.4, 0.9], shadeAmt: 0.75, thick: 10, tear: 3 });
      for (const [x, y, len] of [[262, 506], [318, 512], [372, 540], [420, 586], [450, 636], [196, 646], [244, 668], [300, 680], [140, 690]].map(([x, y]) => [x, y, rng.range(26, 44)])) {
        grassClump(ctx, x, y, { len, n: 8, light: L, seed: rng.int(1, 1e6), lean: rng.range(-0.2, 0.3) });
      }
      // Spruces down the slope among the ledges, between the cliff and the flowers.
      for (const [x, y, h] of [[196, 300, 200], [300, 744, 220], [236, 560, 180], [420, 520, 150], [-60, 600, 260]]) {
        conifer(ctx, x + rng.range(-6, 6), y, h, {
          palette: SPRUCE, light: L, seed: rng.int(1, 1e6), width: 0.27, bias: 0.66, contrast: 1.3, interior: true, trunkFrac: 0.06,
        });
      }
    },
  }).tags = ['near'];

  // The big spruce on the left edge, each whorl its own sprite (breeze through it).
  tagAll(addHeroConifer(S, {
    name: 's05-left-spruce', x: 92, y: 740, h: 470, z: 1040, palette: SPRUCE, light: L, seed: 7301,
    width: 0.28, interior: true, bias: 0.68, contrast: 1.3, tierSway: { amp: 0.008, period: 4.6, lag: 0.07 },
  }), 'trees');
}

// ---------------------------------------------------------------------------
// The rocky slope the trail climbs, built as one continuous diagonal: a dark granite
// ground from the fox's outcrop down to the bottom right, big faceted rock masses
// overlapping down it (each casting a dark crevice onto the one above), torn snow
// drifts lying along every shelf, the brown trail winding up the gully on the left
// and tall spruces rising in front of the masses on the valley side.
const SNOW_ON = { light: L, shadeDir: [-0.35, 0.94], shadeAmt: 0.75, thick: 4, tear: 3 };

// A torn drift lying along a shelf: its top follows the rock's upper edge (left to
// right), its lower edge sags by a varying depth with a few longer tongues.
function driftAlong(edge, rng, { depth = [10, 26], lift = 4, tongue = 0.3 } = {}) {
  const up = edge.map(([x, y]) => [x, y - lift]);
  const lo = [];
  for (let i = edge.length - 1; i > 0; i--) {
    const [x, y] = edge[i], [x2, y2] = edge[i - 1];
    if (i < edge.length - 1) lo.push([x + rng.range(-4, 4), y + rng.range(depth[0], depth[1])]);
    for (const f of [0.33, 0.66]) {
      const d = rng.chance(tongue) ? depth[1] * rng.range(1.3, 1.9) : rng.range(depth[0] * 0.7, depth[1]);
      lo.push([x + (x2 - x) * f + rng.range(-5, 5), y + (y2 - y) * f + d]);
    }
  }
  const e0 = edge[0], e1 = edge[edge.length - 1];
  return [...up, [e1[0] - 2, e1[1] + 3], ...lo, [e0[0] + 4, e0[1] + 4]];
}

// One rock mass: a dark crevice cast down-left onto what lies beneath, then the face.
function mass(ctx, pts, seed, o = {}) {
  piece(ctx, pts.map(([x, y]) => [x - 8, y + 10]), { fill: 'rgba(4,4,8,0.88)' });
  return rockFace(ctx, pts, { palette: GRANITE_SLOPE, light: L, seed, sy: 0.34, tilt: 0.42, lit: 0.3, contrast: 2.2, ...o });
}

// An angular boulder of width w and height h sitting at (x, y).
function boulder(ctx, x, y, w, h, rng, seed) {
  const pal = GRANITE_SLOPE;
  const j = () => rng.range(-0.06, 0.06);
  const pts = [[x - w * 0.5, y], [x - w * (0.38 + j()), y - h * (0.7 + j())], [x + w * (0.02 + j()), y - h], [x + w * (0.4 + j()), y - h * (0.62 + j())],
    [x + w * 0.5, y - h * 0.04], [x + w * (0.22 + j()), y + h * 0.22], [x - w * (0.3 + j()), y + h * 0.18]];
  piece(ctx, pts.map(([px, py]) => [px - 4, py + 6]), { fill: 'rgba(4,4,8,0.6)' });
  rockFace(ctx, pts, { palette: pal, light: L, seed, sy: 0.6, tilt: 0.6, lit: 0.34, contrast: 2, facets: 5, specks: 0.6 });
}

// The outcrop the fox stands on: a big faceted mass whose left side runs down the
// trail as a diagonal wall, snow lying on its top. In front of the trail plane, so
// the trail's far end tucks in under it.
export function addFoxRock(S) {
  S.plane(960, {
    name: 'fox-rock', x: 400, y: 440, w: 560, h: 460, mat: 'stone', res: 1.25, shadow: { blur: 16, alpha: 0.6 },
    draw(ctx) {
      const rng = new RNG('s05-fox-rock');
      rockFace(ctx, [[470, 572], [530, 534], [610, 510], [700, 502], [790, 510], [846, 548], [884, 622], [904, 716], [884, 800], [830, 838], [770, 828], [716, 772], [668, 702], [620, 642], [560, 604]],
        { palette: GRANITE_SLOPE, light: L, seed: 724, sy: 0.3, tilt: 0.4, lit: 0.28, contrast: 2.2, facets: 34 });
      // Dark crevices splitting the face into columns.
      for (const seg of [[[716, 560], [728, 640], [722, 720], [740, 800]], [[800, 556], [812, 650], [806, 740], [818, 826]], [[640, 590], [664, 650], [690, 720]], [[760, 600], [770, 680], [776, 760]]]) {
        piece(ctx, sliver(seg, 3.2), { fill: 'rgba(5,5,9,0.9)' });
      }
      // Snow on a ledge of the right face.
      snowDrape(ctx, driftAlong([[812, 650], [850, 640], [886, 662], [902, 690]], rng, { depth: [8, 18] }), { ...SNOW_ON, seed: 726 });
      // The snow cap where the fox stands; drifts hang over the front.
      snowDrape(ctx, [[440, 560], [492, 522], [560, 500], [650, 490], [740, 492], [800, 506], [840, 534], [812, 542], [778, 538], [744, 558], [706, 550], [668, 574], [626, 566], [588, 592], [548, 586], [508, 606], [468, 594]],
        { light: L, seed: 725, shadeDir: [-0.3, 0.95], shadeAmt: 0.45, thick: 7, tear: 2.6 });
      for (const [x, y] of [[530, 610], [596, 600], [860, 560], [880, 700], [760, 840]]) {
        grassClump(ctx, x + rng.range(-6, 6), y, { len: rng.range(22, 34), n: 7, light: L, seed: rng.int(1, 1e6) });
      }
    },
  }).tags = ['near', 'rock'];
}

export function addTrail(S) {
  S.plane(968, {
    name: 'trail', x: 280, y: 480, w: 1440, h: 800, mat: 'stone', res: 1.25, shadow: { blur: 12 },
    draw(ctx) {
      const rng = new RNG('s05-trail');
      // The ground: dark granite from the gully up to the crest and down to the frame.
      rockFace(ctx, [[424, 596], [470, 572], [560, 600], [680, 650], [800, 700], [900, 704], [1010, 724], [1120, 780], [1230, 834], [1350, 900],
        [1470, 944], [1570, 1000], [1650, 1100], [1700, 1270], [700, 1270], [640, 1100], [560, 1000], [490, 900], [420, 800], [396, 700]],
      { palette: GRANITE_DARK, light: L, seed: 741, sy: 0.8, tilt: 0.55, lit: 0.38, contrast: 1.2, facets: 34, bevel: false });
      // The trail winding down the gully, near end first.
      drawTrail(ctx, {
        path: [[880, 1270], [836, 1140], [780, 1052], [708, 986], [630, 930], [560, 876], [506, 816], [470, 752], [460, 690], [452, 640], [462, 600]],
        width: 156, taper: 0.5, light: L, seed: 505, snow: 0.45, rocks: 0, palette: 'granite',
      });
      // Rock masses stepping down the diagonal, upper ones first, each with snow
      // lying along its shelf. [outline, top edge for the drift, seed, drift depth]
      const masses = [
        [[[548, 704], [620, 678], [702, 690], [742, 738], [724, 800], [644, 814], [572, 782]], [[544, 706], [620, 674], [702, 686], [744, 726]], 751, [12, 28]],
        [[[836, 760], [892, 714], [990, 712], [1076, 748], [1136, 800], [1152, 880], [1104, 948], [994, 962], [894, 932], [846, 870]],
          [[832, 762], [892, 710], [990, 708], [1078, 744], [1138, 796], [1156, 836]], 753, [26, 58]],
        [[[680, 852], [760, 834], [850, 846], [902, 890], [892, 952], [800, 972], [712, 946], [676, 900]], [[676, 854], [760, 830], [852, 842], [904, 880]], 755, [16, 34]],
        [[[1086, 884], [1172, 842], [1272, 852], [1342, 902], [1374, 982], [1346, 1062], [1232, 1096], [1112, 1066], [1068, 968]],
          [[1082, 886], [1172, 838], [1274, 848], [1346, 898], [1378, 944]], 757, [24, 54]],
        [[[796, 964], [876, 932], [972, 950], [1024, 1000], [1004, 1062], [906, 1084], [808, 1052]], [[792, 966], [876, 928], [974, 946], [1026, 990]], 759, [16, 36]],
        [[[1304, 972], [1392, 942], [1482, 956], [1548, 1002], [1584, 1082], [1546, 1172], [1404, 1194], [1310, 1112]],
          [[1300, 974], [1392, 938], [1484, 952], [1552, 1000], [1588, 1044]], 761, [24, 52]],
        [[[934, 1084], [1032, 1062], [1132, 1082], [1176, 1140], [1140, 1210], [990, 1214], [936, 1160]], [[930, 1086], [1032, 1058], [1134, 1078], [1180, 1124]], 763, [16, 36]],
      ];
      for (const [rock, top, seed, depth] of masses) {
        mass(ctx, rock, seed);
        snowDrape(ctx, driftAlong(top, rng, { depth }), { ...SNOW_ON, seed: seed + 100 });
      }
      // Boulders along both edges of the trail.
      for (const [x, y, w, h] of [[418, 704, 48, 32], [546, 744, 40, 28], [448, 812, 58, 36], [624, 848, 46, 30], [520, 912, 64, 40],
        [748, 990, 52, 34], [610, 1004, 70, 44], [700, 1110, 74, 46], [872, 1150, 60, 38]]) {
        boulder(ctx, x, y, w, h, rng, rng.int(1, 1e6));
      }
      // Loose snow lying over the trail's edges and between the rocks.
      for (const [x, y, w] of [[492, 672, 50], [430, 760, 46], [596, 820, 60], [480, 870, 56], [680, 960, 64], [570, 960, 50], [800, 1100, 70], [660, 1060, 60]]) {
        const edge = [[x - w / 2, y + 4], [x - w / 6, y - 3], [x + w / 6, y - 2], [x + w / 2, y + 5]];
        snowDrape(ctx, driftAlong(edge, rng, { depth: [6, 12], tongue: 0.2 }), { ...SNOW_ON, seed: rng.int(1, 1e6), castShadow: false, thick: 3 });
      }
      for (const [x, y] of [[436, 740], [560, 690], [520, 852], [740, 760], [604, 970], [690, 1000], [770, 950], [900, 900], [1060, 1000], [560, 1040]]) {
        grassClump(ctx, x + rng.range(-6, 6), y, { len: rng.range(22, 38), n: 8, light: L, seed: rng.int(1, 1e6), lean: rng.range(-0.25, 0.25) });
      }
      // Tall spruces rising from below the frame in front of the masses' faces.
      for (const [x, y, h] of [[968, 1250, 420], [1052, 1270, 360], [1146, 1260, 380], [1236, 1270, 320], [1318, 1270, 330], [1410, 1270, 290], [1496, 1270, 300], [1580, 1270, 260], [900, 1270, 300]]) {
        conifer(ctx, x + rng.range(-6, 6), y, h, {
          palette: SPRUCE, light: L, seed: rng.int(1, 1e6), width: 0.25, bias: 0.6, contrast: 1.3, interior: true, trunkFrac: 0.05,
        });
      }
    },
  }).tags = ['near', 'trail'];
}

// ---------------------------------------------------------------------------
// The snow bank along the bottom of the frame, left of the trail.
export function addNearRocks(S) {
  S.plane(820, {
    name: 'near-rocks', x: 120, y: 700, w: 700, h: 600, mat: 'stone', res: 1.25, shadow: { blur: 14 },
    draw(ctx) {
      const rng = new RNG('s05-near-rocks');
      snowDrape(ctx, [[220, 1012], [320, 984], [440, 990], [540, 1012], [600, 1050], [660, 1110], [700, 1150], [760, 1300], [220, 1300]],
        { light: L, seed: 731, shadeDir: [-0.4, 0.9], shadeAmt: 0.45, thick: 8, tear: 3.2 });
      for (const [x, y] of [[470, 1000], [640, 1100]]) {
        grassClump(ctx, x + rng.range(-8, 8), y, { len: rng.range(24, 40), n: 8, light: L, seed: rng.int(1, 1e6), lean: rng.range(-0.25, 0.25) });
      }
    },
  }).tags = ['near'];
}
// ---------------------------------------------------------------------------
// The grassy bank below the left cliff: dark earth under dense blades and yellow
// alpine grass, so nothing of the backdrop shows behind the flowers.
export function addLeftBank(S) {
  const edge = [[-340, 742], [-140, 734], [40, 728], [170, 740], [280, 776], [380, 846], [460, 940], [520, 1060], [560, 1200]];
  S.plane(880, {
    name: 'left-bank', x: -360, y: 560, w: 1000, h: 780, mat: 'paper', res: 1, shadow: { blur: 14 },
    draw(ctx) {
      const rng = new RNG('s05-left-bank');
      piece(ctx, [...edge, [600, 1330], [-340, 1330]], { fill: '#2c4026', torn: { amp: 4, freq: 0.05, seed: 4 } });
      drawUndergrowth(ctx, { x0: -340, x1: 560, y: 1200, h: 420, edge: edge.map(([x, y]) => [x, y - 30]), density: 0.9, tones: ['mid', 'dark', 'lime', 'light'], stems: 0.2, palette: FLOWER_PALETTE, light: L, seed: 41 });
      for (let i = 0; i < 16; i++) {
        const k = i / 15;
        const x = -300 + k * 820 + rng.range(-20, 20);
        const y = (x < 170 ? 744 : 740 + (x - 170) * 0.62) + rng.range(0, 40);
        grassClump(ctx, x, y, { len: rng.range(40, 70), n: 9, light: L, seed: rng.int(1, 1e6), lean: rng.range(-0.25, 0.25) });
      }
    },
  }).tags = ['near'];
}

// ---------------------------------------------------------------------------
// Red plumes, yellow button flowers and dark leaves in the bottom-left corner.
const FLOWER_PALETTE = {
  astilbe: { florets: ['#a8141a', '#c42020', '#d8342a', '#e8503a'], light: '#ff8a5c', dark: '#560808', stem: '#4a3a1c' },
  tansy: { ball: '#e8a41c', light: '#ffd24a', dark: '#a8600c' },
  leaf: { light: '#6a8a48', mid: '#3c6a3c', dark: '#1c4630', deep: '#0b2a20', yellow: '#c8a420', lime: '#a8a830' },
  stem: '#3e5a2c',
};

export function addFlowers(S) {
  const rng = new RNG('s05-flowers');
  const backing = [{ type: 'backing', x0: -320, y0: 860, x1: 420, y1: 1380, anchor: 'left', seed: 3 }];
  const leaves = [];
  for (const [x, y, len, rot] of [[-40, 1120, 330, 0.25], [30, 1130, 300, 0.05], [90, 1140, 260, 0.35], [-80, 1100, 280, -0.1],
    [160, 1140, 220, 0.5], [230, 1150, 200, 0.15], [300, 1150, 170, 0.45], [-120, 1000, 260, 0.6], [470, 1150, 160, -0.2], [520, 1150, 150, 0.3]]) {
    leaves.push({ type: 'leaf', x, y, len, width: 0.21, rot, curl: rng.range(-0.15, 0.15), tone: rng.pick(['mid', 'dark', 'dark']), veins: 7, seed: rng.int(1, 1e6) });
  }
  const tufts = [[120, 1000], [250, 980], [360, 990], [420, 1010], [40, 960]].map(([x, y]) => ({ type: 'tuft', x, y, len: rng.range(90, 140), n: 8, tones: ['lime', 'yellow', 'light'], seed: rng.int(1, 1e6), lean: rng.range(-0.2, 0.2) }));
  const plumes = [[136, 1100, 330, -0.04], [204, 1110, 380, 0.05], [250, 1110, 320, 0.08], [96, 1100, 280, -0.08], [176, 1100, 300, 0.02]]
    .map(([x, y, h, lean]) => ({ type: 'astilbe', x, y, h, w: 84, lean, plume: 0.42, seed: rng.int(1, 1e6) }));
  const balls = [[115, 878], [154, 912], [70, 912], [102, 948], [334, 872], [378, 856], [414, 884], [346, 918], [424, 940], [470, 934], [288, 890], [276, 962], [380, 998], [200, 950], [40, 980], [150, 1000], [330, 1020]]
    .map(([x, y]) => ({ type: 'tansy', base: [x + rng.range(-30, 30), 1130], head: [x, y], r: rng.range(15, 19), seed: rng.int(1, 1e6) }));
  const front = [[-60, 1140, 270, 0.7], [20, 1150, 250, 0.45], [110, 1160, 220, -0.3], [200, 1160, 236, 0.35], [290, 1160, 210, -0.4], [380, 1160, 200, 0.3], [452, 1160, 184, -0.2], [540, 1170, 170, 0.25], [600, 1180, 160, -0.3]]
    .map(([x, y, len, rot]) => ({ type: 'leaf', x, y, len, width: 0.2, rot, curl: rng.range(-0.12, 0.12), tone: rng.pick(['dark', 'mid', 'deep']), veins: 7, seed: rng.int(1, 1e6) }));
  return tagAll(addFlowerBed(S, {
    rows: [backing, [...leaves, ...tufts], plumes, balls, front],
    palette: FLOWER_PALETTE, z: 520, planes: 2, depth: 60, res: 1, wind: { amp: 0.03, period: 4.6 },
  }), 'fg');
}

// ---------------------------------------------------------------------------
// Falling paper snow at three depths. Each flake is a baked torn scrap; positions
// are a pure function of t and wrap far outside the frame, so nothing pops.
export function addSnowfall(S) {
  const flakes = [];
  for (let i = 0; i < 6; i++) {
    const r = 4 + i * 0.9;
    flakes.push(S.sprite({
      name: `flake-${i}`, x: -r - 4, y: -r - 4, w: 2 * r + 8, h: 2 * r + 8, mat: 'smooth', edge: false, shadow: { blur: 3, alpha: 0.4 },
      draw(ctx) {
        const rng = new RNG(`s05-flake-${i}`);
        const pts = [];
        const n = 7;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + rng.range(-0.25, 0.25);
          const rr = r * rng.range(0.6, 1);
          pts.push([Math.cos(a) * rr, Math.sin(a) * rr * rng.range(0.7, 1)]);
        }
        piece(ctx, pts, { fill: mix('#f6f6fa', '#c8d4ec', rng.range(0, 0.35)), torn: { amp: 0.7, freq: 0.6, seed: i + 1 }, bevel: { light: L, width: 1, hi: 0.5, lo: 0.3 } });
      },
    }));
  }
  const bands = [
    { z: 2600, n: 260, size: [0.3, 0.5], v: [24, 38], alpha: 0.7, shadow: false },
    { z: 1400, n: 70, size: [0.55, 0.8], v: [40, 58], alpha: 0.9, shadow: true },
    { z: 640, n: 12, size: [0.9, 1.3], v: [62, 84], alpha: 0.95, shadow: true },
  ];
  const Y0 = -320, SPAN = 1720, X0 = -340, XSPAN = 2600;
  return bands.map((b, bi) => {
    const rng = new RNG(`s05-snow-${bi}`);
    const items = [];
    for (let i = 0; i < b.n; i++) {
      items.push({
        s: rng.int(0, flakes.length - 1), x: rng.next() * XSPAN, y: rng.next() * SPAN,
        v: rng.range(...b.v), sc: rng.range(...b.size), amp: rng.range(8, 26), per: rng.range(3.2, 6.5), ph: rng.next() * Math.PI * 2,
        rot: rng.next() * Math.PI * 2, spin: rng.range(-1.2, 1.2), flip: rng.range(2.5, 5),
      });
    }
    const drift = 9; // a light wind from the left
    return S.add({
      name: `snow-${bi}`, z: b.z, tags: ['snow'],
      render(ctx, t, env) {
        const out = [];
        for (const f of items) {
          const x = X0 + ((f.x + drift * t) % XSPAN) + f.amp * Math.sin((t / f.per) * Math.PI * 2 + f.ph);
          const y = Y0 + ((f.y + f.v * t) % SPAN);
          const tumble = Math.cos((t / f.flip) * Math.PI * 2 + f.ph);
          out.push({ s: flakes[f.s], x, y, ax: 0, ay: 0, rot: f.rot + f.spin * t, sx: f.sc, sy: f.sc * (0.35 + 0.65 * Math.abs(tumble)), alpha: b.alpha, shadow: b.shadow ? undefined : false });
        }
        drawSprites(ctx, out, env?.shadow ?? {});
      },
    });
  });
}

export { rgba };
