#!/usr/bin/env node
/**
 * generate-favicons.js
 *
 * Renders public/favicon.svg to the required PNG icon sizes using Playwright.
 * Run with: npm run generate-favicons
 */

import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SIZES = [
  { size: 16, out: 'favicon-16x16.png' },
  { size: 32, out: 'favicon-32x32.png' },
  { size: 180, out: 'apple-touch-icon.png' },
  { size: 192, out: 'android-chrome-192x192.png' },
  { size: 512, out: 'android-chrome-512x512.png' },
];

async function main() {
  const svgPath = path.join(ROOT, 'public', 'favicon.svg');
  const svgContent = await readFile(svgPath, 'utf8');
  // Encode as data URL so Playwright can navigate to it without a server
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;

  const browser = await chromium.launch();

  for (const { size, out } of SIZES) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: size, height: size });

    // Render the SVG filling the whole viewport
    await page.setContent(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      * { margin: 0; padding: 0; }
      html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
      img { display: block; width: ${size}px; height: ${size}px; }
    </style>
  </head>
  <body><img src="${dataUrl}"/></body>
</html>`);

    const png = await page.screenshot({ type: 'png' });
    const outPath = path.join(ROOT, 'public', out);
    await writeFile(outPath, png);
    console.log(`✓ ${out} (${size}×${size})`);
    await page.close();
  }

  await browser.close();
  console.log('\nDone. All PNG icons updated in public/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
