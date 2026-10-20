// Contact sheet of one transition between two scenes (or galleries) across progress p.
//
//   node tools/transition-sheet.mjs trackPine s01 s02 --n 8
//   node tools/transition-sheet.mjs popup calib calib --gallery --n 8
//
// Options: --n frames, --cols, --tile px, --out file, --gallery (both ids are galleries)

import fs from 'node:fs';
import path from 'node:path';
import { openApp, ROOT } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const [type, idA, idB] = argv;
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
if (!type || !idA || !idB) {
  console.log('usage: node tools/transition-sheet.mjs <type> <idA> <idB> [--gallery] [--n 8] [--cols 4] [--tile 480] [--out file]');
  process.exit(1);
}
const n = parseInt(opt('n', '8'), 10);
const cols = parseInt(opt('cols', '4'), 10);
const tileW = parseInt(opt('tile', '480'), 10);
const gallery = !!opt('gallery', false);
const out = path.resolve(ROOT, opt('out', `out/transitions/${type}_${idA}_${idB}.png`));
fs.mkdirSync(path.dirname(out), { recursive: true });

const app = await openApp();
try {
  const dataUrl = await app.page.evaluate(async (o) => {
    const tileH = Math.round(o.tileW * 9 / 16);
    const rows = Math.ceil(o.n / o.cols);
    const sheet = document.createElement('canvas');
    sheet.width = o.cols * o.tileW + (o.cols + 1) * 6;
    sheet.height = rows * (tileH + 22) + 6;
    const sc = sheet.getContext('2d');
    sc.fillStyle = '#111';
    sc.fillRect(0, 0, sheet.width, sheet.height);
    sc.font = '13px monospace';
    for (let i = 0; i < o.n; i++) {
      const p = i / (o.n - 1);
      await window.APP.renderTransition(o.type, o.idA, o.idB, p, { galleryA: o.gallery, galleryB: o.gallery });
      const x = 6 + (i % o.cols) * (o.tileW + 6), y = 6 + Math.floor(i / o.cols) * (tileH + 22);
      sc.drawImage(window.APP.canvas, x, y, o.tileW, tileH);
      sc.fillStyle = '#ccc';
      sc.fillText(`p=${p.toFixed(2)}`, x + 2, y + tileH + 15);
    }
    return sheet.toDataURL('image/png');
  }, { type, idA, idB, n, cols, tileW, gallery });
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(out);
  const errs = app.errors.filter((e) => !e.includes('favicon'));
  if (errs.length) console.log('page errors:\n' + errs.join('\n'));
} finally {
  await app.close();
}
