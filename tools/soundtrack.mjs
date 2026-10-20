// Mix the soundtrack from licensed music and recorded sound effects:
//   node tools/fetch-audio.mjs        (once: downloads audio/sources.json into audio/cache)
//   node tools/soundtrack.mjs [--out out/audio/soundtrack.wav]
//
// The cue sheet below is written in film seconds and derived from the same timeline and
// story cues the picture uses, so every sound sits on what causes it:
//   - music: "Fairy Tale" (120 BPM, 2 s bars). Its 8-bar intro opens the film; one edit,
//     hidden behind the closing redwood curtains at 18 s, jumps to its breakdown, so the
//     second build rises through the cave and the storm and the full climax lands the
//     moment the wave reveals the aurora (42 s) and carries the portal into the dawn.
//   - one ambience bed per world, crossfaded across each transition window;
//   - story moments (the star, crystals, lightning, portal, star-flower) and one
//     motivated sound per transition (pine, branches, trunks, clouds, rock, flare, wave,
//     pop-up pages, light).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT } from './lib/browser.mjs';
import { limiter, wav } from './audio/dsp.mjs';
import { DURATION, SLOT, TRANSITIONS } from '../src/film/timeline.js';
import { CUES } from '../src/film/cues.js';

const SR = 48000;
const argv = process.argv.slice(2);
const OUT = path.resolve(ROOT, argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'out/audio/soundtrack.wav');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'sources.json'), 'utf8'));

// --- timing helpers -------------------------------------------------------------------

// Transition window of the cut into scene k: [start, mid, end] in film seconds.
const win = (k) => {
  const tr = TRANSITIONS[k];
  const mid = k * SLOT + (tr.offset ?? 0);
  return { a: mid - tr.dur / 2, mid, b: mid + tr.dur / 2 };
};

// Music: track second -> film second. The intro's first downbeat (0.116 s) lands at 2.0 s.
const MUSIC_INTRO = 1.884;
const EDIT_FILM = win(3).mid;                  // 18.0: the trunks meet
const EDIT_FROM = 16.116;                      // end of the intro's 8th bar
const EDIT_TO = 50.116;                        // first chord of the breakdown
const MUSIC_B = EDIT_FILM - EDIT_TO;           // film = track + MUSIC_B after the edit

// Ambience bed for a scene: in over its incoming transition, out over its outgoing one.
function bed(k, key, gain, { from = 0, extra = {} } = {}) {
  const inn = k > 0 ? win(k) : { a: 0, b: 0.35 };
  const out = k < 9 ? win(k + 1) : { a: DURATION - 1.4, b: DURATION };
  return { key, at: inn.a, from, dur: out.b - inn.a, gain, fadeIn: inn.b - inn.a, fadeOut: out.b - out.a, ...extra };
}

// One-shot whose loudest moment (peak, seconds into the file) lands on film time t.
const hit = (key, t, gain, peak = 0, extra = {}) => ({ key, at: t - peak, gain, fadeIn: 0.005, fadeOut: 0.3, ...extra });

// --- cue sheet --------------------------------------------------------------------------

const CUE_SHEET = [
  // Music: intro, then the breakdown -> second build -> climax, breathing out with the fade.
  { key: 'music-fairy-tale', at: MUSIC_INTRO, from: 0, dur: EDIT_FROM - 0.004, gain: 0, fadeIn: 0.02, fadeOut: 0.06 },
  { key: 'music-fairy-tale', at: EDIT_FILM - 0.012, from: EDIT_TO - 0.012, dur: DURATION - EDIT_FILM + 0.012, gain: 0, fadeIn: 0.012, fadeOut: 1.6 },

  // Ambience beds, one world at a time.
  bed(0, 'river-birds', 9, { from: 6 }),
  bed(0, 'river-sunrise', 2, { from: 30 }),
  bed(1, 'river-crickets', 3, { from: 4 }),
  bed(2, 'night-forest', 4, { from: 20 }),
  bed(3, 'waterfall-large', -11, { from: 10 }),
  bed(4, 'mountain-wind', -7, { from: 4 }),
  bed(5, 'cavern', -1, { from: 6 }),
  bed(6, 'storm-rain', -15, { from: 2 }),
  bed(6, 'stormy-sea', -8, { from: 20 }),
  bed(7, 'meadow-wind', 5, { from: 2 }),
  bed(7, 'waterfall-woods', -16, { from: 20 }),
  bed(8, 'waterfall-woods', -9, { from: 40 }),
  bed(8, 'night-crickets', 0, { from: 8 }),
  bed(9, 'morning-birds', -8, { from: 30 }),
  bed(9, 'river-sunrise', 1, { from: 4 }),

  // Story moments.
  hit('star-glow', CUES.starAppears, -3, 0.35),
  hit('icicles-thin', 30.55, -7, 0.4),
  hit('icicles-whoosh', 31.05, -8, 1.0),
  hit('cave-drip', 31.3, 4), hit('cave-drip', 32.75, 2), hit('cave-drip', 34.2, 3), hit('cave-drip', 35.05, 1),
  hit('thunder-close', CUES.lightning[0], -3, 0.1),
  hit('thunder-single', CUES.lightning[1], -2, 0.4),
  hit('thunder-rumble', CUES.lightning[2], -5, 1.2),
  hit('aura', win(7).mid + 0.1, -12, 1.0),
  hit('sparkle-whoosh', CUES.portalOpens - 1.1, -6, 0.3),
  hit('spell-of-light', CUES.portalOpens, -11, 0.4),
  hit('fairy-bell', CUES.starFlower, -9, 0.5),

  // Transitions: the sound of the thing the cut hides behind, its peak on the midpoint.
  hit('windy-swoosh', win(1).mid, -11, 1.3),                                     // the passing pine
  { key: 'breeze-trees', at: win(2).a, from: 5.5, dur: win(2).b - win(2).a + 0.3, gain: -13, fadeIn: 0.45, fadeOut: 0.6 },
  hit('air-woosh', win(2).mid - 0.15, -9, 0.6),                                  // through the branches
  hit('leaves', win(2).mid - 0.05, -5, 0.2),
  hit('leaves', win(2).mid + 0.35, -7, 0.2),
  hit('deep-woosh', win(3).mid - 0.25, -8, 0.4),                                 // trunks close
  hit('ending-swoosh', win(3).mid + 0.45, -10, 0.85),                            // and open
  hit('wind-magic', win(4).mid - 0.3, -9, 0.5),                                  // up through the clouds
  hit('ghostly-whoosh', win(4).mid + 0.1, -10, 2.7),
  hit('stone-slide', win(5).mid - 0.35, -7, 0.8),                                // the rock iris closes
  hit('stones-falling', win(5).mid - 0.1, 2, 0.8),
  hit('glitter', win(5).b - 0.4, -1, 1.2),                                       // opening on the crystals
  hit('light-transition', win(6).mid - 0.05, -9, 2.7),                           // the tunnel light flares
  hit('impact-waves', win(7).a + 0.35, -6, 0.5),                                 // the paper wave
  hit('water-splash', win(7).mid - 0.1, -7, 0.4),
  hit('page-turn-big', win(8).a + 0.2, -5, 0.3),                                 // pop-up: folding down...
  hit('pages-moving', win(8).a + 0.45, 3, 0.3),
  hit('paper-slide', win(8).mid - 0.15, -3, 0.3),
  hit('page-turn', win(8).mid + 0.15, 3, 0.15),                                  // ...and rising up
  hit('page-turn-big', win(8).mid + 0.45, -6, 0.3),
  hit('pages-moving', win(8).mid + 0.7, 2, 0.3),
  hit('light-sweep', win(9).mid, -7, 1.2),                                       // the portal light floods
];

// Music level automation (film s, dB): lift the quiet intro and breakdown a little so the
// film never feels empty on a phone speaker, and settle under the storm's thunder.
const MUSIC_LEVEL = [[0, 3], [EDIT_FILM, 3], [EDIT_FILM + 0.01, 2], [27, 0], [CUES.lightning[0] - 0.2, 0], [CUES.lightning[0] + 0.3, -2], [41.5, -1], [42, 0], [DURATION, 0]];

// --- mixer ----------------------------------------------------------------------------------

const decoded = new Map();
function decode(key) {
  if (decoded.has(key)) return decoded.get(key);
  const f = manifest.files[key];
  if (!f) throw new Error(`unknown audio key ${key}`);
  const file = path.join(ROOT, 'audio', 'cache', `${key}.${f.ext ?? 'wav'}`);
  if (!fs.existsSync(file)) throw new Error(`${file} missing: run node tools/fetch-audio.mjs`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const pcm = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  decoded.set(key, pcm);
  return pcm;
}

const dbToGain = (db) => Math.pow(10, db / 20);
function envelope(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, v0] = points[i - 1], [t1, v1] = points[i];
      return v0 + (v1 - v0) * ((t - t0) / (t1 - t0 || 1));
    }
  }
  return points[points.length - 1][1];
}

const N = Math.round(DURATION * SR);
const L = new Float32Array(N), R = new Float32Array(N);
for (const c of CUE_SHEET) {
  const pcm = decode(c.key);
  const frames = pcm.length / 2;
  const from = Math.round((c.from ?? 0) * SR);
  const len = Math.min(frames - from, Math.round((c.dur ?? (frames / SR)) * SR));
  const at = Math.round(c.at * SR);
  const fi = Math.max(1, Math.round((c.fadeIn ?? 0.01) * SR)), fo = Math.max(1, Math.round((c.fadeOut ?? 0.05) * SR));
  const g = dbToGain(c.gain ?? 0);
  const music = c.key.startsWith('music');
  for (let i = 0; i < len; i++) {
    const o = at + i;
    if (o < 0 || o >= N) continue;
    // Equal-power fades.
    let e = 1;
    if (i < fi) e *= Math.sin((i / fi) * Math.PI / 2);
    if (i > len - fo) e *= Math.sin(Math.max(0, (len - i) / fo) * Math.PI / 2);
    const lvl = music ? dbToGain(envelope(MUSIC_LEVEL, o / SR)) : 1;
    const k = (from + i) * 2;
    L[o] += pcm[k] * g * e * lvl;
    R[o] += pcm[k + 1] * g * e * lvl;
  }
}

// Gentle safety limiting before loudness normalisation.
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
if (peak > 0.95) { const s = 0.95 / peak; for (let i = 0; i < N; i++) { L[i] *= s; R[i] *= s; } }
limiter(L, R, { ceiling: 0.89 });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const raw = OUT.replace(/\.wav$/, '.raw.wav');
fs.writeFileSync(raw, wav(L, R));
// Two-pass loudnorm to -14 LUFS (social platforms), true peak -1.5 dBTP, dynamics kept.
const target = 'I=-14:TP=-1.5:LRA=11';
const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
  '-af', `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
  '-ar', String(SR), '-c:a', 'pcm_s16le', OUT]);
fs.rmSync(raw);
console.log(`wrote ${OUT}  (mix ${m.input_i} LUFS, LRA ${m.input_lra}, TP ${m.input_tp})`);
