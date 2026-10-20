// Scene-to-scene transitions. Each receives the two scenes, their local times and the
// progress p (0..1) through the transition window, and draws the composed frame.
//
// One rule runs through all of them: the cut from scene A to scene B always happens
// behind something motivated by the story world (a passing tree, branches, trunks,
// cloud, rock, light, a wave, the page itself) so the fox is never seen twice.

import { composePlanes, renderToBuffer, buffer, W, H } from './compose.js';
import { E, clamp, lerp, lmix, smoothstep, invLerp } from '../core/ease.js';
import { rgba, mix } from '../core/color.js';
import * as props from './props.js';

const add = (cam, d) => ({ ...cam, x: cam.x + (d.x ?? 0), y: cam.y + (d.y ?? 0), z: cam.z + (d.z ?? 0), zoom: (cam.zoom ?? 1) * (d.zoom ?? 1), roll: (cam.roll ?? 0) + (d.roll ?? 0) });
const meta = (S, key, fallback) => (S.meta && S.meta[key]) || fallback;

// Draw a buffer filling the output canvas.
function blit(ctx, b, alpha = 1) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(b.canvas, 0, 0);
  ctx.restore();
}

// Run fn with the context in 1920x1080 film coordinates.
function inFilm(ctx, fn) {
  const q = ctx.canvas.width / W;
  ctx.save();
  ctx.setTransform(q, 0, 0, q, 0, 0);
  fn(ctx);
  ctx.restore();
}

export const TRANSITIONS = {
  cut(ctx, { A, B, tA, tB, p }) {
    (p < 0.5 ? A : B).render(ctx, p < 0.5 ? tA : tB);
  },

  fade(ctx, { A, B, tA, tB, p }) {
    blit(ctx, renderToBuffer('A', ctx.canvas, A, tA));
    blit(ctx, renderToBuffer('B', ctx.canvas, B, tB), E.smooth(p));
  },

  // T1 dusk -> night. The camera keeps tracking right with the walking fox; a huge
  // foreground pine sweeps across the lens and the world behind it has become night.
  trackPine(ctx, { A, B, tA, tB, p }) {
    const e = E.smooth(p);
    const PAN = 240;
    const a = renderToBuffer('A', ctx.canvas, A, tA, { cam: add(A.camera(tA), { x: e * PAN }) });
    const b = renderToBuffer('B', ctx.canvas, B, tB, { cam: add(B.camera(tB), { x: (e - 1) * PAN }) });
    const x = lerp(W + 560, -560, e);
    blit(ctx, a);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const q = ctx.canvas.width / W;
    ctx.beginPath();
    ctx.rect(x * q, 0, ctx.canvas.width - x * q, ctx.canvas.height);
    ctx.clip();
    ctx.drawImage(b.canvas, 0, 0);
    ctx.restore();
    inFilm(ctx, (c) => props.passingPine(c, x, p, { dim: lerp(0.7, 0.55, e) }));
  },

  // T2 night lake -> forest. Push forward into the shore trees; fir branches rush in
  // from the edges, fill the lens, and part again inside the firefly forest.
  throughBranches(ctx, { A, B, tA, tB, p }) {
    const cover = props.branchCover(p);            // 0..1, 1 = lens fully covered
    if (p < 0.5) {
      const k = E.dolly(p / 0.5);
      blit(ctx, renderToBuffer('A', ctx.canvas, A, tA, { cam: add(A.camera(tA), { z: k * 420, x: -k * 60 }) }));
    } else {
      const k = 1 - E.out((p - 0.5) / 0.5);
      blit(ctx, renderToBuffer('B', ctx.canvas, B, tB, { cam: add(B.camera(tB), { z: -k * 260 }) }));
    }
    inFilm(ctx, (c) => props.branches(c, p, cover));
  },

  // T3 forest -> canyon. Giant trunks close like theatre curtains, then open on the canyon.
  curtains(ctx, { A, B, tA, tB, p }) {
    const close = p < 0.5 ? E.smooth(clamp(p / 0.47)) : 1 - E.smooth(clamp((p - 0.53) / 0.47));
    if (p < 0.5) {
      composePlanes(ctx, [{
        scene: A, t: tA,
        plane: (L) => L.tags.includes('curtainL') ? { dx: close * 420 } : L.tags.includes('curtainR') ? { dx: -close * 420 } : null,
      }], { background: A.background });
    } else {
      blit(ctx, renderToBuffer('B', ctx.canvas, B, tB, { cam: add(B.camera(tB), { z: -(1 - E.out((p - 0.5) / 0.5)) * 120 }) }));
    }
    inFilm(ctx, (c) => props.trunkCurtains(c, close, p));
  },

  // T4 canyon -> peaks. The camera cranes up through a bank of cloud and comes out
  // high in the snow.
  craneClouds(ctx, { A, B, tA, tB, p }) {
    const e = E.smooth(p);
    if (p < 0.5) blit(ctx, renderToBuffer('A', ctx.canvas, A, tA, { cam: add(A.camera(tA), { y: -E.in(p / 0.5) * 260 }) }));
    else blit(ctx, renderToBuffer('B', ctx.canvas, B, tB, { cam: add(B.camera(tB), { y: (1 - E.out((p - 0.5) / 0.5)) * 260 }) }));
    inFilm(ctx, (c) => props.cloudBank(c, e, p));
  },

  // T5 peaks -> cave. A jagged rock iris closes on the fox, and opens again inside the
  // mountain where the crystals are waking up.
  rockIris(ctx, { A, B, tA, tB, p }) {
    const fa = meta(A, 'fox', { x: 600, y: 600 }), fb = meta(B, 'fox', { x: 600, y: 600 });
    let r, cx, cy;
    // The rock closes in from outside the frame, is shut for only ~0.2 s, then opens.
    if (p < 0.5) {
      const k = E.smooth(clamp(p / 0.48));
      blit(ctx, renderToBuffer('A', ctx.canvas, A, tA, { cam: add(A.camera(tA), { z: k * 160 }) }));
      r = lerp(2300, 0, k); cx = fa.x; cy = fa.y - 140;
    } else {
      const k = E.smooth(clamp((p - 0.52) / 0.48));
      blit(ctx, renderToBuffer('B', ctx.canvas, B, tB, { cam: add(B.camera(tB), { z: -(1 - k) * 160 }) }));
      r = lerp(0, 2300, k); cx = fb.x; cy = fb.y - 140;
    }
    inFilm(ctx, (c) => props.rockIris(c, cx, cy, r));
  },

  // T6 cave -> storm. The star at the end of the tunnel flares, the light turns cold and
  // becomes the lightning that opens the storm.
  lightFlash(ctx, { A, B, tA, tB, p }) {
    const la = meta(A, 'light', { x: 1300, y: 300 });
    if (p < 0.5) {
      const k = E.in(clamp(p / 0.5));
      blit(ctx, renderToBuffer('A', ctx.canvas, A, tA, { cam: add(A.camera(tA), { z: k * 220 }) }));
      inFilm(ctx, (c) => props.flare(c, la.x, la.y, k, { warm: 1 - k }));
    } else {
      const k = clamp((p - 0.5) / 0.5);
      blit(ctx, renderToBuffer('B', ctx.canvas, B, tB));
      inFilm(ctx, (c) => props.flashFade(c, Math.exp(-k * 5) * (1 - k)));
    }
  },

  // T7 storm -> aurora. A great paper wave rises over the lens; when the water drains
  // away the storm has passed and the aurora is revealed from the sky down.
  waveWipe(ctx, { A, B, tA, tB, p }) {
    if (p < 0.5) blit(ctx, renderToBuffer('A', ctx.canvas, A, tA, { cam: add(A.camera(tA), { y: E.in(p / 0.5) * 40 }) }));
    else blit(ctx, renderToBuffer('B', ctx.canvas, B, tB, { cam: add(B.camera(tB), { y: -(1 - E.out((p - 0.5) / 0.5)) * 60 }) }));
    inFilm(ctx, (c) => props.wave(c, p));
  },

  // T8 aurora -> portal. The pop-up book: every cut-out folds flat onto the page, the
  // sky turns, and the next world pops up, back to front.
  popup(ctx, { A, B, tA, tB, p }) {
    const isSky = (L) => L.tags.includes('sky') || L.tags.includes('celestial') || L.tags.includes('aurora');
    const flatFade = (k) => smoothstep(0.03, 0.22, Math.cos(k * Math.PI / 2));
    const fold = (L, S, k) => {
      const hinge = props.planeBottom(L);
      return { sy: Math.max(0.002, Math.cos(k * Math.PI / 2)), ox: W / 2, oy: hinge };
    };
    const nA = A.layers ? A.layers.length : 1;
    const skyMix = smoothstep(0.28, 0.56, p);
    // A's cut-outs fold front to back over p 0..0.44; B's rise back to front over
    // 0.34..0.96, so the far hills of the new world are already rising while the last
    // of the old ones lie down and the page is never empty.
    const kA = (L) => {
      const rank = props.depthRank(A, L);            // 0 = nearest
      return E.in(clamp((p - rank * 0.14) / 0.3));
    };
    const kB = (L) => {
      const rank = 1 - props.depthRank(B, L);        // 0 = farthest
      const x = clamp((p - 0.34 - rank * 0.3) / 0.32);
      // Ease into the spring so big pieces lift off rather than appear in one frame.
      return 1 - props.popSpring(x * x * (3 - 2 * x) * 0.6 + x * 0.4);
    };
    A.build(); B.build();
    // The ground page sits just behind the farthest cut-out of either scene and shows
    // while the pieces lie flat.
    const farZ = Math.max(...[...A.layers, ...B.layers].filter((L) => !isSky(L)).map((L) => L.z));
    const horizon = lerp(meta(A, 'horizon', 560), meta(B, 'horizon', 560), skyMix);
    const pageAlpha = smoothstep(0.2, 0.36, p) * (1 - smoothstep(0.56, 0.74, p));
    composePlanes(ctx, [
      // A cut-out lying almost flat would read as a thin sliver: fade it as it goes down.
      { scene: A, t: tA, filter: (L) => isSky(L) ? true : kA(L) < 0.999, alpha: (L) => isSky(L) ? 1 - skyMix : flatFade(kA(L)), plane: (L) => isSky(L) ? null : fold(L, A, kA(L)) },
      { scene: B, t: tB, filter: (L) => isSky(L) ? skyMix > 0 : kB(L) < 0.999, alpha: (L) => isSky(L) ? skyMix : flatFade(kB(L)), plane: (L) => isSky(L) ? null : fold(L, B, kB(L)) },
    ], {
      background: mix(A.background, B.background, skyMix),
      inserts: [{ z: farZ * 1.001, draw: (c) => props.popupPage(c, horizon, pageAlpha) }],
    });
    void nA;
  },

  // T9 portal -> dawn. The portal's light floods the frame and draws back into the sunrise.
  lightFlood(ctx, { A, B, tA, tB, p }) {
    const la = meta(A, 'light', { x: 960, y: 420 }), lb = meta(B, 'light', { x: 1500, y: 340 });
    if (p < 0.5) {
      const k = E.in(clamp(p / 0.5));
      blit(ctx, renderToBuffer('A', ctx.canvas, A, tA, { cam: add(A.camera(tA), { z: k * 260 }) }));
      inFilm(ctx, (c) => props.flood(c, la.x, la.y, k, '#ffe2a0'));
    } else {
      const k = 1 - E.out(clamp((p - 0.5) / 0.5));
      blit(ctx, renderToBuffer('B', ctx.canvas, B, tB));
      inFilm(ctx, (c) => props.flood(c, lerp(lb.x, la.x, k * 0.3), lerp(lb.y, la.y, k * 0.3), k, '#ffe7b0'));
    }
  },
};

export { invLerp, lmix, rgba, buffer };
