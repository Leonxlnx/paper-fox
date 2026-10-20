// Side-by-side comparison of a reference and a render, both mapped to 1920x1080.
//
//   node tools/compare.mjs out/s02/s02_t3.00.png <refs>/ref02_night_lake.png
//   node tools/compare.mjs render.png ref.png --crop 300,250,700,500 --out out/fox/cmp.png
//   node tools/compare.mjs render.png ref.png --crop 300,250,700,500 --refcrop 0,0,700,500
//
// --crop x,y,w,h is in 1920x1080 film pixels and applies to both images, unless
// --refcrop gives a separate box for the reference (also in 1920x1080 space).
// Output: reference on the left, render on the right (stacked vertically if --vertical).

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const [render, ref] = argv;
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? def : argv[i + 1];
};
if (!render || !ref) {
  console.log('usage: node tools/compare.mjs <render.png> <ref.png> [--crop x,y,w,h] [--refcrop x,y,w,h] [--out file] [--vertical]');
  process.exit(1);
}
const crop = opt('crop', null);
const refcrop = opt('refcrop', crop);
const vertical = argv.includes('--vertical');
const out = opt('out', path.join(path.dirname(render), path.basename(render, '.png') + '_vs_ref.png'));
const box = (c) => {
  if (!c) return '';
  const [x, y, w, h] = c.split(',').map(Number);
  return `,crop=${w}:${h}:${x}:${y}`;
};
const [rw, rh] = (crop ?? '0,0,1920,1080').split(',').slice(2).map(Number);
const filter = `[0]scale=1920:1080:flags=lanczos${box(refcrop)},scale=${rw}:${rh}[a];[1]scale=1920:1080:flags=lanczos${box(crop)}[b];[a][b]${vertical ? 'vstack' : 'hstack'}`;
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', ref, '-i', render, '-filter_complex', filter, out]);
console.log(out);
