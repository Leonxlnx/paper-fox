// The edited film: maps film time to scenes and transitions, applies the finish,
// and optionally renders true motion blur for fast moments.

import { SCENE_IDS, DURATION, FPS, segmentAt, TRANSITIONS as PLAN } from './timeline.js';
import { TRANSITIONS } from './transitions.js';
import { finish } from '../core/post.js';
import { E, clamp } from '../core/ease.js';
import { composePlanes } from './compose.js';

const POST_KEYS = ['bloom', 'threshold', 'bloomRadius', 'vignette', 'grain'];

// Opening: the first diorama is already there and moving, but its cut-outs are still
// settling onto their stands, nearest last, so the film starts with paper in motion.
const INTRO = 1.4;
function drawIntro(ctx, scene, t, p) {
  scene.build();
  const zs = scene.layers.map((L) => L.z);
  const lo = Math.log(Math.min(...zs)), hi = Math.log(Math.max(...zs));
  composePlanes(ctx, [{
    scene, t,
    plane: (L) => {
      if (L.tags.includes('sky')) return null;
      const near = hi > lo ? 1 - (Math.log(L.z) - lo) / (hi - lo) : 0;   // 1 = nearest
      const k = E.out(clamp((p - near * 0.35) / 0.65));
      return { dy: (1 - k) * (40 + near * 160) };
    },
  }], { background: scene.background });
}

// Ending: the dawn breathes out into a warm dark as the music's last chord fades.
const OUTRO = 1.3;
function drawOutro(ctx, t) {
  const k = clamp((t - (DURATION - OUTRO)) / OUTRO);
  if (k <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = E.smooth(k) * 0.96;
  ctx.fillStyle = '#0d0a0c';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function blendPost(a = {}, b = {}, p) {
  const out = {};
  for (const k of POST_KEYS) {
    const va = a[k], vb = b[k];
    if (va === undefined && vb === undefined) continue;
    const A = va ?? vb, B = vb ?? va;
    out[k] = A + (B - A) * p;
  }
  // Colour grades and lifts are blended by fading one out and the other in.
  if (a.grade || b.grade) out.grade = p < 0.5 ? a.grade && { ...a.grade, amount: a.grade.amount * (1 - p * 2) } : b.grade && { ...b.grade, amount: b.grade.amount * (p * 2 - 1) };
  if (a.lift || b.lift) out.lift = p < 0.5 ? a.lift && { ...a.lift, amount: a.lift.amount * (1 - p * 2) } : b.lift && { ...b.lift, amount: b.lift.amount * (p * 2 - 1) };
  return out;
}

export async function createFilm({ getScene, disposeExcept }) {
  async function scenesFor(seg) {
    const ids = seg.kind === 'scene' ? [SCENE_IDS[seg.k]] : [SCENE_IDS[seg.from], SCENE_IDS[seg.to]];
    const scenes = [];
    for (const id of ids) scenes.push(await getScene(id));
    disposeExcept(ids.map((id) => `scene:${id}`));
    return scenes;
  }

  // Draw one instant (no motion blur) without the finish.
  async function drawRaw(ctx, t) {
    const seg = segmentAt(t);
    const scenes = await scenesFor(seg);
    if (seg.kind === 'scene') {
      if (seg.k === 0 && t < INTRO) drawIntro(ctx, scenes[0], seg.t, t / INTRO);
      else scenes[0].render(ctx, seg.t);
      return { seg, post: scenes[0].post };
    }
    const [A, B] = scenes;
    const fn = TRANSITIONS[seg.tr.type] ?? TRANSITIONS.fade;
    fn(ctx, { A, B, tA: seg.tA, tB: seg.tB, p: seg.p, tr: seg.tr, t });
    return { seg, post: blendPost(A.post, B.post, E.smooth(seg.p)) };
  }

  let accum = null;

  return {
    info() {
      return { duration: DURATION, fps: FPS, scenes: SCENE_IDS, transitions: PLAN };
    },

    // opts: { post=true, frame, fps, motionBlur=false, scale=1 }
    async renderAt(ctx, t, opts = {}) {
      const scale = opts.scale ?? 1;
      const wantW = Math.round(1920 * scale), wantH = Math.round(1080 * scale);
      if (ctx.canvas.width !== wantW) { ctx.canvas.width = wantW; ctx.canvas.height = wantH; }
      const fps = opts.fps ?? FPS;
      const frame = opts.frame ?? Math.round(t * fps);
      const seg = segmentAt(t);
      const samples = opts.motionBlur && seg.kind === 'transition' ? (seg.tr.blur ?? 0) : 0;
      let res;
      if (samples > 1) {
        // Average sub-frames across a 180-degree shutter in float precision.
        const w = ctx.canvas.width, h = ctx.canvas.height;
        if (!accum || accum.length !== w * h * 4) accum = new Float32Array(w * h * 4);
        accum.fill(0);
        for (let i = 0; i < samples; i++) {
          const ts = t + ((i + 0.5) / samples - 0.5) * (0.5 / fps);
          res = await drawRaw(ctx, ts);
          const d = ctx.getImageData(0, 0, w, h).data;
          for (let j = 0; j < d.length; j++) accum[j] += d[j];
        }
        const img = ctx.createImageData(w, h);
        for (let j = 0; j < accum.length; j++) img.data[j] = accum[j] / samples + 0.5;
        ctx.putImageData(img, 0, 0);
      } else {
        res = await drawRaw(ctx, t);
      }
      if (opts.post !== false) finish(ctx, { ...res.post, frame });
      drawOutro(ctx, t);
      return { kind: res.seg.kind, k: res.seg.k, p: res.seg.p ?? null };
    },
  };
}
