// Render stills of a scene, gallery sheet or the whole film.
//
//   node tools/snap.mjs s02 --t 0,2.5,5            scene s02 at three local times
//   node tools/snap.mjs fox --gallery --t 1         element sheet
//   node tools/snap.mjs film --t 12.5,30            the edited film at absolute times
//   node tools/snap.mjs s02 --t 3 --compare         stack the reference above the render
//
// Options: --out <dir> (default out/snaps), --scale <0..1> output size, --raw (skip film finish),
//          --ref <png> reference to compare with (or set PAPERFOX_REFS to a folder of refNN_*.png)
//          --cam x,y,z,zoom   camera override

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openApp, grab, ROOT } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const id = argv[0];
if (!id || id.startsWith('--')) {
  console.log('usage: node tools/snap.mjs <sceneId|galleryId|film> [--t a,b,c] [--gallery] [--compare] [--out dir] [--scale s] [--raw] [--cam x,y,z,zoom]');
  process.exit(1);
}
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const times = String(opt('t', '0')).split(',').map(Number);
const gallery = !!opt('gallery', false);
const outDir = path.resolve(ROOT, opt('out', 'out/snaps'));
const scale = parseFloat(opt('scale', '1'));
const raw = !!opt('raw', false);
const compare = opt('compare', false);
const camArg = opt('cam', null);
const cam = camArg ? (([x, y, z, zoom]) => ({ x: +x || 0, y: +y || 0, z: +z || 0, zoom: +zoom || 1 }))(String(camArg).split(',')) : null;

function findRef() {
  const explicit = opt('ref', null);
  if (explicit && explicit !== true) return explicit;
  const dir = process.env.PAPERFOX_REFS;
  const m = /^s(\d\d)$/.exec(id);
  if (!dir || !m || !fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((n) => n.startsWith(`ref${m[1]}`) && n.endsWith('.png'));
  return f ? path.join(dir, f) : null;
}

fs.mkdirSync(outDir, { recursive: true });
const app = await openApp();
try {
  for (const t of times) {
    let info;
    if (id === 'film') info = await app.page.evaluate((tt, p) => window.APP.renderFilm(tt, { post: p }), t, !raw);
    else info = await app.page.evaluate((sid, tt, g, p, c) => window.APP.renderScene(sid, tt, { gallery: g, post: p, cam: c }), id, t, gallery, !raw, cam);
    const buf = await grab(app.page);
    const name = `${id}_t${t.toFixed(2)}`;
    let file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, buf);
    if (scale !== 1) {
      const scaled = path.join(outDir, `${name}_s.png`);
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `scale=iw*${scale}:-1:flags=lanczos`, scaled]);
      fs.renameSync(scaled, file);
    }
    console.log(`${file}  ${JSON.stringify(info)}`);
    if (compare) {
      const ref = findRef();
      if (!ref) console.log('  (no reference found: pass --ref or set PAPERFOX_REFS)');
      else {
        const cmp = path.join(outDir, `${name}_cmp.png`);
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', ref, '-i', file,
          '-filter_complex', '[0]scale=1920:1080:flags=lanczos[a];[1]scale=1920:1080:flags=lanczos[b];[a][b]vstack', cmp]);
        console.log(`  compare: ${cmp}`);
      }
    }
  }
  if (app.errors.length) console.log('page errors:\n' + app.errors.join('\n'));
} finally {
  await app.close();
}
