// Render the film to MP4.
//
//   node tools/render.mjs                         full film, 60 fps, 1920x1080 -> out/paper-fox.mp4
//   node tools/render.mjs --from 10 --to 16       a section (seconds)
//   node tools/render.mjs --workers 4 --audio out/audio/soundtrack.wav
//   node tools/render.mjs --preview               half resolution, quicker encode
//
// Frames are rendered by several headless Chrome workers into .render/frames as
// high-quality JPEGs (resumable: existing frames are skipped), then encoded with
// x264 and tagged BT.709. The frame folder is deleted afterwards unless --keep.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openApp, ROOT } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const fps = Number(opt('fps', 60));
const preview = !!opt('preview', false);
const workers = Number(opt('workers', 4));
const keep = !!opt('keep', false);
const audio = opt('audio', null);
const crf = Number(opt('crf', preview ? 22 : 18));
const out = path.resolve(ROOT, opt('out', preview ? 'out/preview.mp4' : 'out/paper-fox.mp4'));
const frameDir = path.resolve(ROOT, '.render', 'frames');
const blur = !opt('no-blur', false);

async function main() {
  fs.mkdirSync(frameDir, { recursive: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });

  // Ask the film for its duration once.
  const probe = await openApp();
  const info = await probe.page.evaluate(() => window.APP.filmInfo());
  await probe.close();
  const from = Number(opt('from', 0));
  const to = Math.min(Number(opt('to', info.duration)), info.duration);
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  const total = f1 - f0;
  console.log(`film ${info.duration}s; rendering frames ${f0}..${f1 - 1} (${total}) at ${fps} fps with ${workers} workers`);

  const name = (f) => path.join(frameDir, `f${String(f).padStart(5, '0')}.jpg`);
  // Contiguous chunks so each worker builds only the scenes it needs.
  const chunk = Math.ceil(total / workers);
  const started = Date.now();
  let done = 0;
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = f0 + w * chunk, b = Math.min(f1, a + chunk);
    if (a >= b) continue;
    jobs.push((async () => {
      const app = await openApp();
      try {
        for (let f = a; f < b; f++) {
          if (fs.existsSync(name(f))) { done++; continue; }
          const dataUrl = await app.page.evaluate(async (t, fr, o) => {
            await window.APP.renderFilm(t, { frame: fr, fps: o.fps, motionBlur: o.blur, scale: o.scale });
            return window.APP.snapshot('image/jpeg', 0.97);
          }, f / fps, f, { fps, blur, scale: preview ? 0.5 : 1 });
          fs.writeFileSync(name(f), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
          done++;
          if (done % 30 === 0) {
            const el = (Date.now() - started) / 1000;
            const eta = (el / done) * (total - done);
            console.log(`  ${done}/${total}  ${(done / el).toFixed(1)} fps  eta ${Math.round(eta)}s`);
          }
        }
      } finally {
        const errs = app.errors.filter((e) => !e.includes('favicon'));
        if (errs.length) console.log(`worker ${w} page errors:\n${errs.join('\n')}`);
        await app.close();
      }
    })());
  }
  await Promise.all(jobs);
  console.log(`frames done in ${Math.round((Date.now() - started) / 1000)}s; encoding ${out}`);

  const args = ['-hide_banner', '-loglevel', 'warning', '-y',
    '-framerate', String(fps), '-start_number', String(f0), '-i', path.join(frameDir, 'f%05d.jpg')];
  if (audio) args.push('-ss', String(from), '-t', String(to - from), '-i', path.resolve(ROOT, audio));
  args.push('-frames:v', String(total),
    // tune grain keeps the film grain steady across keyframes (no grain pulse); the rate
    // cap keeps the file friendly for social uploads (X accepts 1080p60 up to 512 MB).
    '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', String(crf),
    '-maxrate', '25M', '-bufsize', '50M',
    '-tune', preview ? 'film' : 'grain', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
    '-movflags', '+faststart');
  if (audio) args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest');
  args.push(out);
  await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  if (!keep) fs.rmSync(path.resolve(ROOT, '.render'), { recursive: true, force: true });
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
