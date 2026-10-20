// Browser entry. Hosts the film player and the hooks the headless tools drive.
//
//   index.html                      play the film
//   index.html?scene=s02&t=2.5      one scene, paused at a time
//   index.html?gallery=fox          an element test sheet
//
// Tools call window.APP.* through Puppeteer (see tools/).

import { W, H } from './core/stage.js';
import { finish } from './core/post.js';
import { SCENES, GALLERIES } from './registry.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

const loaded = new Map();

async function getScene(kind, id) {
  const key = `${kind}:${id}`;
  if (loaded.has(key)) return loaded.get(key);
  const table = kind === 'gallery' ? GALLERIES : SCENES;
  const entry = table[id];
  if (!entry) throw new Error(`unknown ${kind} "${id}". Known: ${Object.keys(table).join(', ')}`);
  const mod = await entry();
  const scene = mod.default();
  loaded.set(key, scene);
  return scene;
}

function disposeExcept(keep) {
  for (const [key, scene] of loaded) if (!keep.includes(key)) { scene.dispose(); loaded.delete(key); }
}

let film = null;
async function getFilm() {
  if (!film) {
    const mod = await import('./film/film.js');
    film = await mod.createFilm({ getScene: (id) => getScene('scene', id), disposeExcept });
  }
  return film;
}

const APP = {
  W, H, canvas,
  scenes: () => Object.keys(SCENES),
  galleries: () => Object.keys(GALLERIES),

  // Render one scene (or gallery) at local time t, with the film finish.
  async renderScene(id, t = 0, { gallery = false, post = true, cam = null } = {}) {
    const scene = await getScene(gallery ? 'gallery' : 'scene', id);
    const t0 = performance.now();
    scene.build();
    const t1 = performance.now();
    scene.render(ctx, t, cam ? { cam } : {});
    if (post) finish(ctx, { ...scene.post, frame: Math.round(t * 60) });
    const t2 = performance.now();
    return { buildMs: Math.round(t1 - t0), renderMs: Math.round(t2 - t1), duration: scene.duration };
  },

  // Render the full film at absolute time t (seconds).
  async renderFilm(t, opts = {}) {
    const f = await getFilm();
    return f.renderAt(ctx, t, opts);
  },

  // Render one transition between any two scenes/galleries at progress p (for tuning).
  async renderTransition(type, idA, idB, p, { tA = 7.25, tB = 1.25, galleryA = false, galleryB = false, post = true } = {}) {
    const A = await getScene(galleryA ? 'gallery' : 'scene', idA);
    const B = await getScene(galleryB ? 'gallery' : 'scene', idB);
    const { TRANSITIONS } = await import('./film/transitions.js');
    const dur = 1.5;
    TRANSITIONS[type](ctx, { A, B, tA: tA + (p - 0.5) * dur, tB: tB + (p - 0.5) * dur, p, tr: { type, dur } });
    if (post) finish(ctx, { ...(p < 0.5 ? A.post : B.post), frame: Math.round(p * 90) });
  },

  async filmInfo() {
    const f = await getFilm();
    return f.info();
  },

  snapshot(type = 'image/png', quality = 0.95) {
    return canvas.toDataURL(type, quality);
  },
};
window.APP = APP;

// --- interactive player -------------------------------------------------------

const params = new URLSearchParams(location.search);
const hud = document.getElementById('hud');

async function interactive() {
  if (params.has('capture')) return; // headless tools drive everything
  const sceneId = params.get('scene');
  const galleryId = params.get('gallery');
  const fixedT = params.has('t') ? parseFloat(params.get('t')) : null;
  const speed = parseFloat(params.get('speed') ?? '1');
  let start = performance.now();
  let paused = fixedT !== null;
  let tPaused = fixedT ?? 0;
  let duration = 60;

  if (sceneId || galleryId) {
    const s = await getScene(galleryId ? 'gallery' : 'scene', sceneId || galleryId);
    duration = s.duration;
  } else {
    duration = (await APP.filmInfo()).duration;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (paused) { start = performance.now() - (tPaused / speed) * 1000; paused = false; }
      else { tPaused = ((performance.now() - start) / 1000) * speed % duration; paused = true; }
    }
    if (e.code === 'ArrowRight') { tPaused = Math.min(duration, tPaused + (e.shiftKey ? 1 : 1 / 60)); paused = true; }
    if (e.code === 'ArrowLeft') { tPaused = Math.max(0, tPaused - (e.shiftKey ? 1 : 1 / 60)); paused = true; }
  });

  let busy = false;
  async function tick() {
    if (!busy) {
      busy = true;
      const t = paused ? tPaused : (((performance.now() - start) / 1000) * speed) % duration;
      if (sceneId || galleryId) await APP.renderScene(sceneId || galleryId, t, { gallery: !!galleryId });
      else await APP.renderFilm(t);
      if (hud) hud.textContent = `${t.toFixed(2)}s`;
      busy = false;
    }
    requestAnimationFrame(tick);
  }
  tick();
}

APP.ready = interactive().catch((err) => {
  console.error(err);
  if (hud) hud.textContent = String(err);
});
