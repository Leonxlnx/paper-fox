// Shared plumbing for the headless tools: a tiny static server and a Chrome page
// that loads index.html in capture mode.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.css': 'text/css',
};

export function serve(root = ROOT) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(root, url === '/' ? 'index.html' : url);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium executable.');
  return hit;
}

// Launch Chrome, open the app in capture mode and wait until it is ready.
export async function openApp({ gpu = true } = {}) {
  const { server, port } = await serve();
  const args = [
    '--headless=new',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--window-size=1920,1080',
  ];
  if (gpu) args.push('--enable-gpu-rasterization', '--ignore-gpu-blocklist');
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    args,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    protocolTimeout: 600000,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('requestfailed', (req) => errors.push(`request failed: ${req.url()}`));
  page.on('response', (res) => { if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/index.html?capture=1`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => !!(window.APP && window.APP.ready), { timeout: 30000 });
  } catch (e) {
    await browser.close(); server.close();
    throw new Error(`app failed to start:\n${errors.join('\n')}`);
  }
  await page.evaluate(() => window.APP.ready);
  const close = async () => { await browser.close(); server.close(); };
  return { browser, page, errors, close, port };
}

export async function grab(page, type = 'image/png', quality = 0.95) {
  const dataUrl = await page.evaluate((t, q) => window.APP.snapshot(t, q), type, quality);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}
