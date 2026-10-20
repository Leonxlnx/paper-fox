// Synthesize the soundtrack from the film timeline: node tools/audio.mjs [--out out/audio/soundtrack.wav]
//
// A music-box lullaby in D major at 80 BPM that follows the fox's journey: warm at
// dusk, sparse in the cave, tense in the storm, opening up under the aurora, peaking
// at the portal and resolving at dawn. Ambiences and paper whooshes are placed from
// the same timeline and cue list the picture uses.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { SR, buffer, mixInto, hz, reverb, pingPong, limiter, wav, dbToGain, filter } from './audio/dsp.mjs';
import * as I from './audio/instruments.mjs';
import { BAR, BEAT, DURATION, SLOT, TRANSITIONS } from '../src/film/timeline.js';
import { CUES } from '../src/film/cues.js';
import { ROOT } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const outArg = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'out/audio/soundtrack.wav';
const OUT = path.resolve(ROOT, outArg);
const LEN = DURATION + 0.0;

const T = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT;

// Buses: each a mono dry signal plus a reverb send amount, panned at mixdown.
const bus = {};
function track(name, { pan = 0, rev = 0.25, gain = 0 } = {}) {
  bus[name] = { dry: buffer(LEN + 6), pan, rev, gain: dbToGain(gain) };
  return bus[name].dry;
}

const box = track('musicbox', { pan: 0.15, rev: 0.45, gain: -3 });
const piano = track('piano', { pan: -0.1, rev: 0.35, gain: -5 });
const padT = track('pad', { pan: 0, rev: 0.5, gain: -13 });
const choirT = track('choir', { pan: 0, rev: 0.6, gain: -10 });
const harpT = track('harp', { pan: -0.25, rev: 0.4, gain: -9 });
const bellT = track('bells', { pan: 0.2, rev: 0.75, gain: -8 });
const subT = track('sub', { pan: 0, rev: 0.0, gain: -17 });
const drumT = track('drums', { pan: 0, rev: 0.3, gain: -9 });
const amb = track('ambience', { pan: 0, rev: 0.1, gain: -14 });
const ambL = track('ambienceL', { pan: -0.6, rev: 0.15, gain: -16 });
const ambR = track('ambienceR', { pan: 0.6, rev: 0.15, gain: -16 });
const sfx = track('sfx', { pan: 0, rev: 0.35, gain: -10 });

// --- harmony: one chord per half bar ([bar, beat, pad notes, bass]) ---------------
const CHORDS = [
  [1, 0, ['D3', 'A3', 'C#4', 'E4', 'F#4'], 'D2'],
  [2, 0, ['G3', 'B3', 'D4', 'F#4', 'A4'], 'G1'],
  [3, 0, ['B3', 'D4', 'F#4', 'A4'], 'B1'],
  [4, 0, ['G3', 'B3', 'D4', 'F#4'], 'G1'],
  [5, 0, ['E3', 'G3', 'B3', 'D4', 'F#4'], 'E2'],
  [6, 0, ['A3', 'D4', 'E4', 'G4'], 'A1'],
  [6, 2, ['A3', 'C#4', 'E4', 'G4'], 'A1'],
  [7, 0, ['F#3', 'A3', 'D4', 'F#4'], 'F#2'],
  [8, 0, ['G3', 'B3', 'D4'], 'G1'],
  [8, 2, ['A3', 'C#4', 'E4'], 'A1'],
  [9, 0, ['B3', 'D4', 'F#4'], 'B1'],
  [10, 0, ['G3', 'B3', 'D4', 'E4'], 'G1'],
  [10, 2, ['A3', 'C#4', 'E4'], 'A1'],
  [11, 0, ['E3', 'B3', 'F#4', 'G4'], 'E2'],
  [12, 0, ['C4', 'E4', 'G4', 'B4'], 'C2'],
  [13, 0, ['Bb3', 'D4', 'F4', 'A4'], 'Bb1'],
  [14, 0, ['C4', 'E4', 'G4'], 'C2'],
  [14, 2, ['A3', 'D4', 'E4', 'G4'], 'A1'],
  [15, 0, ['D4', 'F#4', 'A4'], 'D2'],
  [15, 2, ['C#4', 'F#4', 'A4'], 'F#1'],
  [16, 0, ['B3', 'D4', 'G4'], 'G1'],
  [16, 2, ['C#4', 'E4', 'A4'], 'A1'],
  [17, 0, ['B3', 'D4', 'F#4'], 'B1'],
  [17, 2, ['B3', 'D4', 'G4'], 'G1'],
  [18, 0, ['A3', 'D4', 'F#4'], 'A1'],
  [18, 2, ['A3', 'C#4', 'E4', 'G4'], 'A1'],
  [19, 0, ['G3', 'B3', 'D4', 'F#4'], 'G1'],
  [19, 2, ['A3', 'C#4', 'E4'], 'A1'],
  [20, 0, ['D3', 'A3', 'D4', 'F#4', 'A4'], 'D2'],
];

// Section intensity per bar (0..1): drives pad brightness and layering.
const ENERGY = [0, 0.35, 0.4, 0.45, 0.45, 0.5, 0.5, 0.6, 0.65, 0.6, 0.65, 0.25, 0.25, 0.55, 0.65, 0.75, 0.8, 0.9, 1.0, 0.6, 0.5];

CHORDS.forEach(([bar, beat, notes, bass], i) => {
  const t0 = T(bar, beat);
  const next = CHORDS[i + 1];
  const t1 = next ? T(next[0], next[1]) : LEN + 1;
  const dur = t1 - t0;
  const e = ENERGY[bar];
  const last = !next;
  mixInto(padT, I.pad(notes.map(hz), { dur: dur + 0.25, attack: i === 0 ? 0.25 : 0.6, release: last ? 3 : 1.4, cutoff: 700 + e * 1500, vel: 0.45 + e * 0.3, seed: i + 3 }), t0 - 0.12);
  if (bar !== 11 && bar !== 12) mixInto(subT, I.sub(hz(bass), { dur: dur, vel: 0.5 + e * 0.3, release: last ? 3 : 0.6 }), t0);
  // Choir under the mountain, aurora and portal sections.
  if ((bar >= 9 && bar <= 10) || bar >= 15 && bar <= 19) mixInto(choirT, I.choir(notes.slice(-3).map(hz), { dur: dur + 0.2, vel: 0.35 + e * 0.35, release: 1.6, seed: i }), t0 - 0.2);
});

// --- melodies ------------------------------------------------------------------
const THEME_A = [[0, 'F#5', 1], [1, 'A5', 1], [2, 'D6', 1.5], [3.5, 'C#6', 0.5], [4, 'B5', 1], [5, 'A5', 0.5], [5.5, 'G5', 0.5], [6, 'F#5', 2]];
const THEME_B = [[0, 'E5', 1], [1, 'F#5', 1], [2, 'A5', 1.5], [3.5, 'G5', 0.5], [4, 'F#5', 1], [5, 'E5', 1], [6, 'D5', 2]];
const CLIMB = [[0, 'F#5', 0.5], [0.5, 'A5', 0.5], [1, 'B5', 1], [2, 'D6', 1], [3, 'E6', 1], [4, 'F#6', 1.5], [5.5, 'E6', 0.5], [6, 'D6', 2]];
const RESOLVE = [[0, 'B5', 1], [1, 'A5', 1], [2, 'F#5', 1.5], [3.5, 'E5', 0.5], [4, 'D5', 3]];

function play(track, phrase, bar, fn, { transpose = 0, vel = 0.8 } = {}) {
  for (const [beat, n, len] of phrase) {
    const f = hz(n) * Math.pow(2, transpose / 12);
    mixInto(track, fn(f, len * BEAT, vel), T(bar, beat));
  }
}
const mb = (f, len, vel) => I.musicBox(f, { vel });
const pn = (f, len, vel) => I.feltPiano(f, { vel, dur: len });

play(box, THEME_A, 1, mb, { vel: 0.75 });
play(box, THEME_B, 3, mb, { vel: 0.7 });
// Piano: broken chords through the night lake.
[[3, ['B2', 'F#3', 'B3', 'D4']], [4, ['G2', 'D3', 'G3', 'B3']]].forEach(([bar, ns]) => {
  for (let k = 0; k < 8; k++) mixInto(piano, I.feltPiano(hz(ns[[0, 1, 2, 3, 2, 1, 2, 3][k]]), { vel: 0.45, dur: 1.2 }), T(bar, k * 0.5));
});
// Forest: firefly plucks and a few high music-box sparks.
[[5, ['E4', 'G4', 'B4', 'D5', 'F#5', 'D5', 'B4', 'G4']], [6, ['A4', 'D5', 'E5', 'G5', 'A5', 'G5', 'E5', 'C#5']]].forEach(([bar, ns]) => {
  ns.forEach((n, k) => mixInto(harpT, I.harp(hz(n), { vel: 0.55, seed: bar * 10 + k }), T(bar, k * 0.5)));
});
play(box, [[1.5, 'B6', 0.5], [3, 'F#6', 0.5], [4.5, 'D6', 0.5], [6.5, 'A6', 0.5]], 5, mb, { vel: 0.4 });
// Canyon: the theme on piano with the music box an octave up, quietly.
play(piano, THEME_A, 7, pn, { transpose: -12, vel: 0.65 });
play(box, THEME_A, 7, mb, { vel: 0.35 });
// Peaks: answer phrase high and airy.
play(box, THEME_B, 9, mb, { transpose: 12, vel: 0.45 });
play(piano, THEME_B, 9, pn, { transpose: -12, vel: 0.5 });
// Cave: sparse crystal bells in a long space.
[[11, 0, 'E5'], [11, 1.5, 'B5'], [11, 3, 'G5'], [12, 0, 'E6'], [12, 1.5, 'B5'], [12, 2.5, 'C6'], [12, 3.25, 'G5']]
  .forEach(([bar, beat, n], k) => mixInto(bellT, I.bell(hz(n), { vel: 0.55 - k * 0.03 }), T(bar, beat)));
// Storm: low drums building through the two bars.
for (let k = 0; k < 8; k++) mixInto(drumT, I.drum(k % 4 === 0 ? 62 : 70, { vel: 0.35 + k * 0.06, seed: k }), T(13, k));
for (let k = 0; k < 4; k++) mixInto(drumT, I.drum(66, { vel: 0.4 + k * 0.08, seed: 20 + k, decay: 0.6 }), T(14, 2 + k * 0.5));
// Aurora: theme returns over rising harp arpeggios.
play(box, THEME_A, 15, mb, { vel: 0.8 });
[15, 16].forEach((bar) => {
  const arp = bar === 15 ? ['D4', 'F#4', 'A4', 'D5', 'C#4', 'F#4', 'A4', 'C#5'] : ['B3', 'D4', 'G4', 'B4', 'C#4', 'E4', 'A4', 'C#5'];
  for (let k = 0; k < 16; k++) mixInto(harpT, I.harp(hz(arp[k % 8]) * (k >= 8 ? 2 : 1), { vel: 0.4, seed: bar * 31 + k }), T(bar, k * 0.25));
});
// Portal: the climb to the peak, full arrangement.
play(box, CLIMB, 17, mb, { vel: 0.9 });
play(piano, CLIMB, 17, pn, { transpose: -12, vel: 0.7 });
[17, 18].forEach((bar) => {
  for (let k = 0; k < 16; k++) mixInto(harpT, I.harp(hz(['B3', 'D4', 'F#4', 'B4', 'D5', 'F#5', 'B5', 'D6'][k % 8]) * (bar === 18 ? 1.122 : 1), { vel: 0.35, seed: bar * 17 + k }), T(bar, k * 0.25));
  mixInto(drumT, I.drum(58, { vel: 0.7, seed: bar }), T(bar, 0));
  mixInto(drumT, I.drum(64, { vel: 0.45, seed: bar + 50 }), T(bar, 2));
});
// Dawn: the theme resolves home.
play(box, RESOLVE, 19, mb, { vel: 0.65 });
mixInto(piano, I.feltPiano(hz('D3'), { vel: 0.5, dur: 3 }), T(20, 0));
mixInto(piano, I.feltPiano(hz('A3'), { vel: 0.4, dur: 3 }), T(20, 0.5));
mixInto(box, I.musicBox(hz('D6'), { vel: 0.5, ring: 2.6 }), T(20, 1));

// --- ambience ------------------------------------------------------------------
const span = (k0, k1) => [k0 * SLOT - 0.8, k1 * SLOT + 0.8];
function ambience(buf, k0, k1, gen, gain = 1) {
  const [a, b] = span(k0, k1);
  const s = Math.max(0, a), e = Math.min(LEN, b);
  mixInto(buf, gen(e - s), s, gain);
}
ambience(amb, 0, 2, (l) => I.river(l, { level: 0.5 }));                       // dusk bridge + night lake
ambience(ambL, 2, 3, (l) => I.crickets(l, { level: 0.5 }));                   // forest
ambience(ambR, 2, 3, (l) => I.river(l, { level: 0.25, seed: 5, bright: 1.3 }));
ambience(amb, 3, 4, (l) => I.waterfall(l, { level: 0.6 }));                   // canyon
ambience(amb, 4, 5, (l) => I.wind(l, { level: 0.6, center: 600 }));           // peaks
ambience(amb, 5, 6, (l) => I.wind(l, { level: 0.25, center: 300, seed: 3 })); // cave air
ambience(amb, 6, 7, (l) => I.rain(l, { level: 0.6 }));                         // storm
ambience(ambL, 6, 7, (l) => I.wind(l, { level: 0.5, center: 420, seed: 9 }));
ambience(amb, 7, 8, (l) => I.wind(l, { level: 0.2, center: 900, seed: 12 }));  // aurora
ambience(amb, 8, 9, (l) => I.hum(l, { level: 0.5 }));                          // portal
ambience(ambR, 8, 10, (l) => I.waterfall(l, { level: 0.35, seed: 21 }));
ambience(ambL, 9, 10, (l) => I.birds(l, { level: 0.5 }));                      // dawn

// Cave drips, storm waves and thunder.
[31.2, 32.4, 33.1, 34.6, 35.3].forEach((t, k) => mixInto(sfx, I.drip(900 + k * 140, { vel: 0.35 }), t));
[36.3, 38.6, 41.0].forEach((t, k) => mixInto(amb, I.waveCrash(3.5, { seed: 29 + k, level: 0.7 }), t));
CUES.lightning.forEach((t, k) => mixInto(sfx, I.thunder(5, { seed: 23 + k, level: 1.0, crack: k ? 0.5 : 0.8 }), t + 0.05));
// Star moments.
[CUES.starAppears, CUES.portalOpens, CUES.starFlower].forEach((t, k) => {
  ['A6', 'D7', 'F#7', 'A7'].forEach((n, j) => mixInto(bellT, I.bell(hz(n), { vel: 0.18, ring: 2.5 }), t + j * 0.07 + k * 0));
});

// Every scene change gets the sound of the thing the cut hides behind.
const TRANSITION_SFX = {
  trackPine: (mid, d) => mixInto(sfx, I.heavySwish(d * 0.8, { seed: 71, level: 0.55 }), mid - d * 0.45),
  throughBranches: (mid, d) => mixInto(sfx, I.rustle(d * 0.95, { seed: 72, level: 0.5 }), mid - d * 0.5),
  curtains: (mid, d) => {
    mixInto(sfx, I.heavySwish(0.7, { seed: 73, level: 0.5 }), mid - d * 0.5);
    mixInto(sfx, I.heavySwish(0.7, { seed: 74, level: 0.45, up: false }), mid + d * 0.05);
  },
  craneClouds: (mid, d) => mixInto(sfx, I.wind(d * 1.1, { seed: 75, level: 0.9, center: 900 }), mid - d * 0.55),
  rockIris: (mid, d) => {
    mixInto(sfx, I.rumble(d * 0.45, { seed: 76, level: 0.6, swell: 'in' }), mid - d * 0.5);
    mixInto(sfx, I.rumble(d * 0.45, { seed: 77, level: 0.45, swell: 'out' }), mid + d * 0.06);
  },
  lightFlash: (mid, d) => mixInto(sfx, I.shimmerSwell(d * 0.5, { seed: 78, level: 0.45 }), mid - d * 0.5),
  waveWipe: (mid, d) => mixInto(amb, I.waveCrash(3.2, { seed: 79, level: 0.9 }), mid - d * 0.45),
  popup: (mid, d) => {
    // Cut-outs folding down (front to back), then popping up (back to front).
    for (let k = 0; k < 6; k++) mixInto(sfx, I.paperFlap({ seed: 80 + k, level: 0.32, pitch: 1 - k * 0.06 }), mid - d * 0.5 + k * 0.07);
    for (let k = 0; k < 7; k++) mixInto(sfx, I.paperFlap({ seed: 90 + k, level: 0.35, pitch: 0.8 + k * 0.07 }), mid - d * 0.05 + k * 0.075);
  },
  lightFlood: (mid, d) => mixInto(sfx, I.shimmerSwell(d * 0.55, { seed: 81, level: 0.55, freqs: [1175, 1397, 1760, 2093] }), mid - d * 0.55),
};
TRANSITIONS.forEach((tr, k) => {
  if (!tr) return;
  const mid = k * SLOT + (tr.offset ?? 0);
  (TRANSITION_SFX[tr.type] ?? ((m, d) => mixInto(sfx, I.paperWhoosh(d, { seed: 41 + k }), m - d / 2)))(mid, tr.dur);
});

// --- mixdown ---------------------------------------------------------------------
const N = Math.ceil(LEN * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const send = new Float32Array(N);
for (const [name, b] of Object.entries(bus)) {
  const gl = Math.cos((b.pan + 1) * Math.PI / 4) * b.gain;
  const gr = Math.sin((b.pan + 1) * Math.PI / 4) * b.gain;
  for (let i = 0; i < N; i++) {
    const v = b.dry[i];
    L[i] += v * gl; R[i] += v * gr;
    send[i] += v * b.gain * b.rev;
  }
}
// Wide music-box shimmer echo.
const echo = pingPong(Float32Array.from(bus.musicbox.dry.subarray(0, N)).map((v) => v * bus.musicbox.gain), { time: BEAT * 0.75, feedback: 0.3, mix: 0.18, tone: 5000 });
const [rl, rr] = reverb(send, { room: 0.88, damp: 0.4 });
for (let i = 0; i < N; i++) {
  L[i] += rl[i] * 0.9 + echo[0][i];
  R[i] += rr[i] * 0.9 + echo[1][i];
}
// Gentle tone shaping and a final fade so the dawn chord breathes out with the picture.
filter(L, 'highpass', 28, 0.7); filter(R, 'highpass', 28, 0.7);
const fadeStart = LEN - 2.2;
for (let i = Math.floor(fadeStart * SR); i < N; i++) {
  const x = (i / SR - fadeStart) / (LEN - fadeStart);
  const g = Math.cos(Math.min(1, x) * Math.PI / 2);
  L[i] *= g; R[i] *= g;
}
// Normalise roughly before limiting, then master to -14 LUFS with ffmpeg.
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const pre = 0.7 / (peak || 1);
for (let i = 0; i < N; i++) { L[i] *= pre; R[i] *= pre; }
limiter(L, R, { ceiling: 0.8 });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const raw = OUT.replace(/\.wav$/, '.raw.wav');
fs.writeFileSync(raw, wav(L, R));
// Two-pass loudnorm: measure, then apply linearly so the dynamics are kept.
const target = 'I=-14:TP=-1.5:LRA=11';
const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
  '-af', `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
  '-ar', String(SR), '-c:a', 'pcm_s16le', OUT]);
fs.rmSync(raw);
console.log(`wrote ${OUT}  (input ${m.input_i} LUFS, LRA ${m.input_lra}, TP ${m.input_tp})`);
