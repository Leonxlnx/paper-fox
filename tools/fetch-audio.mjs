// Download the licensed music and sound effects listed in audio/sources.json into
// audio/cache/ (gitignored). Existing files are kept.
//   node tools/fetch-audio.mjs

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/browser.mjs';

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'sources.json'), 'utf8'));
const cache = path.join(ROOT, 'audio', 'cache');
fs.mkdirSync(cache, { recursive: true });

const urlOf = (f) => f.url ?? `https://assets.mixkit.co/active_storage/sfx/${f.mixkit}/${f.mixkit}.wav`;
export const fileOf = (key, f) => path.join(cache, `${key}.${f.ext ?? 'wav'}`);

let fetched = 0;
for (const [key, f] of Object.entries(manifest.files)) {
  const dest = fileOf(key, f);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
  const res = await fetch(urlOf(f), {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', referer: f.page ?? 'https://mixkit.co/' },
  });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status} for ${urlOf(f)}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  fetched++;
  console.log(`  ${key}  ${f.title}`);
}
console.log(`${fetched} downloaded, ${Object.keys(manifest.files).length} in audio/cache`);
