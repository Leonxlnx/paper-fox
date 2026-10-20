// Contact sheet: render N frames of a scene/gallery/film and tile them into one image,
// to judge motion at a glance.
//
//   node tools/sheet.mjs s02 --from 0 --to 7.5 --n 12 --cols 4
//   node tools/sheet.mjs fox --gallery --from 0 --to 2 --n 8 --crop 400,300,700,600
//   node tools/sheet.mjs film --from 0 --to 60 --n 30 --cols 6
//
// Options: --out <file> (default out/sheets/<id>_<from>-<to>.png), --tile <px width>, --raw

import fs from 'node:fs';
import path from 'node:path';
import { openApp, ROOT } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const id = argv[0];
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
if (!id || id.startsWith('--')) {
  console.log('usage: node tools/sheet.mjs <id|film> [--gallery] [--from s] [--to s] [--n 12] [--cols 4] [--crop x,y,w,h] [--tile 480] [--out file]');
  process.exit(1);
}
const from = parseFloat(opt('from', '0'));
const to = parseFloat(opt('to', '6'));
const n = parseInt(opt('n', '12'), 10);
const cols = parseInt(opt('cols', '4'), 10);
const gallery = !!opt('gallery', false);
const raw = !!opt('raw', false);
const crop = opt('crop', null);
const [cx, cy, cw, ch] = crop ? String(crop).split(',').map(Number) : [0, 0, 1920, 1080];
const tileW = parseInt(opt('tile', crop ? String(Math.min(cw, 640)) : '480'), 10);
const out = path.resolve(ROOT, opt('out', `out/sheets/${id}_${from}-${to}.png`));
fs.mkdirSync(path.dirname(out), { recursive: true });

const app = await openApp();
try {
  const dataUrl = await app.page.evaluate(async (o) => {
    const tileH = Math.round(o.tileW * o.ch / o.cw);
    const rows = Math.ceil(o.n / o.cols);
    const sheet = document.createElement('canvas');
    sheet.width = o.cols * o.tileW + (o.cols + 1) * 6;
    sheet.height = rows * (tileH + 22) + 6;
    const sc = sheet.getContext('2d');
    sc.fillStyle = '#111';
    sc.fillRect(0, 0, sheet.width, sheet.height);
    sc.font = '13px monospace';
    for (let i = 0; i < o.n; i++) {
      const t = o.n === 1 ? o.from : o.from + (o.to - o.from) * (i / (o.n - 1));
      if (o.id === 'film') await window.APP.renderFilm(t, { post: !o.raw });
      else await window.APP.renderScene(o.id, t, { gallery: o.gallery, post: !o.raw });
      const col = i % o.cols, row = Math.floor(i / o.cols);
      const x = 6 + col * (o.tileW + 6), y = 6 + row * (tileH + 22);
      sc.drawImage(window.APP.canvas, o.cx, o.cy, o.cw, o.ch, x, y, o.tileW, tileH);
      sc.fillStyle = '#ccc';
      sc.fillText(`t=${t.toFixed(2)}`, x + 2, y + tileH + 15);
    }
    return sheet.toDataURL('image/png');
  }, { id, from, to, n, cols, gallery, raw, cx, cy, cw, ch, tileW });
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(out);
  const errs = app.errors.filter((e) => !e.includes('favicon'));
  if (errs.length) console.log('page errors:\n' + errs.join('\n'));
} finally {
  await app.close();
}
