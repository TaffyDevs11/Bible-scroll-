#!/usr/bin/env node
// Renders icons/logo.svg into PNG app icons using the Chromium bundled with Playwright.
//   node tools/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(ROOT, 'icons/logo.svg'), 'utf8');
const b64 = Buffer.from(svg).toString('base64');

const jobs = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
  { file: 'favicon-32.png', size: 32, maskable: false },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const j of jobs) {
  // Maskable: full-bleed navy background, logo scaled into the 80% safe zone.
  const inner = j.maskable ? Math.round(j.size * 0.8) : j.size;
  const html = `<html><body style="margin:0;width:${j.size}px;height:${j.size}px;display:grid;place-items:center;background:${j.maskable ? '#1B2A3A' : 'transparent'}">
    <img src="data:image/svg+xml;base64,${b64}" width="${inner}" height="${inner}"></body></html>`;
  await page.setViewportSize({ width: j.size, height: j.size });
  await page.setContent(html);
  await page.screenshot({ path: path.join(ROOT, 'icons', j.file), omitBackground: !j.maskable });
  console.log('icons/' + j.file);
}
await browser.close();
