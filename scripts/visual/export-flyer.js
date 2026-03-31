/**
 * Export the exhibit flyer as a print-ready PDF and/or high-res PNG.
 *
 * Usage:
 *   node scripts/visual/export-flyer.js           # exports both PDF and PNG
 *   node scripts/visual/export-flyer.js --pdf      # PDF only
 *   node scripts/visual/export-flyer.js --png      # PNG only
 *   node scripts/visual/export-flyer.js --out ./my-dir  # custom output dir (default: assets/)
 *
 * Output:
 *   assets/exhibit-flyer.pdf  — Letter, print background, ready to send to a printer
 *   assets/exhibit-flyer.png  — 2550×3300 px (300 DPI on 8.5×11)
 */

import { chromium } from '@playwright/test';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../');

// --- CLI args -----------------------------------------------------------
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx !== -1 ? resolve(args[outIdx + 1]) : resolve(repoRoot, 'assets');

const doPdf =
  args.length === 0 ||
  args.includes('--pdf') ||
  (!args.includes('--png') && !args.includes('--pdf'));
const doPng =
  args.length === 0 ||
  args.includes('--png') ||
  (!args.includes('--png') && !args.includes('--pdf'));

const flyerPath = resolve(repoRoot, 'assets/exhibit-flyer.html');
const flyerUrl = `file://${flyerPath}`;

// 8.5 × 11 inches at 300 DPI
const WIDTH_PX = 2550;
const HEIGHT_PX = 3300;

if (!existsSync(flyerPath)) {
  console.error(`❌  Flyer not found: ${flyerPath}`);
  process.exit(1);
}

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const pdfOut = resolve(outDir, 'exhibit-flyer.pdf');
const pngOut = resolve(outDir, 'exhibit-flyer.png');

(async () => {
  const browser = await chromium.launch();

  try {
    // ── PDF ─────────────────────────────────────────────────────────────
    if (doPdf) {
      const page = await browser.newPage();
      // Match the @page size so Chrome doesn't add margins or rescale
      await page.setViewportSize({ width: 816, height: 1056 }); // 96 dpi equivalent of 8.5×11
      await page.goto(flyerUrl, { waitUntil: 'networkidle' });
      await page.pdf({
        path: pdfOut,
        format: 'Letter',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      await page.close();
      console.log(`✅  PDF  → ${pdfOut}`);
    }

    // ── PNG ─────────────────────────────────────────────────────────────
    if (doPng) {
      const page = await browser.newPage();
      // Render at 3× device pixel ratio so CSS pixels match 300 DPI output
      await page.setViewportSize({ width: WIDTH_PX / 3, height: HEIGHT_PX / 3 });
      await page.goto(flyerUrl, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: pngOut,
        fullPage: false,
        clip: { x: 0, y: 0, width: WIDTH_PX / 3, height: HEIGHT_PX / 3 },
        scale: 'device',
      });
      await page.close();
      console.log(
        `✅  PNG  → ${pngOut}  (${WIDTH_PX / 3}×${HEIGHT_PX / 3} CSS px @ 3× = ${WIDTH_PX}×${HEIGHT_PX} px)`
      );
    }
  } finally {
    await browser.close();
  }
})();
