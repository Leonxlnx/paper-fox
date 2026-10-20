// Motion forensics on a rendered film: per-frame change, pops and stalls.
//
//   node tools/forensics.mjs out/preview.mp4 [--fps 60]
//
// Measures the mean luma difference between consecutive frames (at 480 px wide) and
// flags frames whose change jumps far above their neighbourhood (a pop, a one-frame
// glitch) or long stretches with no change at all (a stall). Scene changes and the
// scripted lightning flashes are listed separately so they are not mistaken for faults.

import { spawnSync } from 'node:child_process';
import { TRANSITIONS, SLOT } from '../src/film/timeline.js';
import { CUES } from '../src/film/cues.js';

const argv = process.argv.slice(2);
const file = argv[0];
if (!file) {
  console.log('usage: node tools/forensics.mjs <video.mp4> [--fps 60]');
  process.exit(1);
}
const fps = Number(argv.includes('--fps') ? argv[argv.indexOf('--fps') + 1] : 60);

const res = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf',
  'scale=480:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
  '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const diffs = [...res.stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
if (!diffs.length) { console.error(res.stderr); process.exit(1); }

// Planned events (seconds): transition windows and lightning.
const planned = [];
TRANSITIONS.forEach((tr, k) => {
  if (!tr) return;
  const mid = k * SLOT + (tr.offset ?? 0);
  planned.push({ a: mid - tr.dur / 2, b: mid + tr.dur / 2, what: `transition ${tr.type}` });
});
for (const t of CUES.lightning) planned.push({ a: t - 0.05, b: t + 0.6, what: 'lightning' });
const plannedAt = (t) => planned.find((p) => t >= p.a && t <= p.b);

const median = (arr) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const pops = [], stalls = [];
const W = 12;
for (let i = 0; i < diffs.length; i++) {
  const lo = Math.max(0, i - W), hi = Math.min(diffs.length, i + W + 1);
  const around = diffs.slice(lo, i).concat(diffs.slice(i + 1, hi));
  const m = median(around);
  if (diffs[i] > Math.max(1.5, m * 4)) pops.push({ frame: i + 1, t: (i + 1) / fps, d: diffs[i], m });
}
let run = 0;
for (let i = 0; i < diffs.length; i++) {
  if (diffs[i] < 0.02) run++;
  else { if (run > fps * 0.6) stalls.push({ from: (i - run + 1) / fps, len: run / fps }); run = 0; }
}

const fmt = (x) => x.toFixed(2);
console.log(`${diffs.length + 1} frames; median change ${fmt(median(diffs))}, max ${fmt(Math.max(...diffs))}`);
const unplanned = pops.filter((p) => !plannedAt(p.t));
console.log(`\npops outside planned events: ${unplanned.length}`);
for (const p of unplanned) console.log(`  frame ${p.frame} (${fmt(p.t)} s): change ${fmt(p.d)} vs ~${fmt(p.m)}`);
const inPlanned = pops.filter((p) => plannedAt(p.t));
console.log(`\nspikes inside planned events: ${inPlanned.length}`);
for (const p of inPlanned) console.log(`  ${fmt(p.t)} s  ${plannedAt(p.t).what}  change ${fmt(p.d)}`);
console.log(`\nstalls (no motion > 0.6 s): ${stalls.length}`);
for (const s of stalls) console.log(`  ${fmt(s.from)} s for ${fmt(s.len)} s`);
// Per-second motion profile, to spot dead or frantic stretches.
const perSec = [];
for (let s = 0; s * fps < diffs.length; s++) perSec.push(median(diffs.slice(s * fps, (s + 1) * fps)));
console.log(`\nmedian change per second:\n${perSec.map((v, s) => `${String(s).padStart(2)}:${fmt(v)}`).join('  ')}`);
