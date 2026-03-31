/**
 * Export the exhibit flyer as a print-ready PDF and/or high-res PNG.
 *
 * Usage:
 *   node scripts/visual/export-flyer.js           # exports both PDF and PNG at 600 DPI
 *   node scripts/visual/export-flyer.js --pdf      # PDF only
 *   node scripts/visual/export-flyer.js --png      # PNG only
 *   node scripts/visual/export-flyer.js --dpi 300  # override DPI (default: 600)
 *   node scripts/visual/export-flyer.js --out ./my-dir  # custom output dir (default: assets/)
 *
 * Output:
 *   assets/exhibit-flyer.pdf  — Letter, print background, ready to send to a printer
 *   assets/exhibit-flyer.png  — 5100×6600 px at 600 DPI (or scaled to --dpi value)
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
const dpiIdx = args.indexOf('--dpi');
const TARGET_DPI = dpiIdx !== -1 ? Number(args[dpiIdx + 1]) : 600;

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

// CSS viewport: 8.5×11 inches at 96 DPI (the browser's native CSS pixel density)
const CSS_W = 816; // 8.5 * 96
const CSS_H = 1056; // 11  * 96

// Scale CSS pixels up to target DPI (e.g. 600 DPI → DPR = 6.25 → 5100×6600 px)
const DPR = TARGET_DPI / 96;
const WIDTH_PX = Math.round(CSS_W * DPR);
const HEIGHT_PX = Math.round(CSS_H * DPR);

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
    // Render at 2× scale so Chromium rasterizes CSS gradient patterns
    // (hatch lines, polka dots) at double resolution before embedding in
    // the PDF. This significantly reduces aliasing on fine patterns.
    if (doPdf) {
      const ctx = await browser.newContext({ deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.setViewportSize({ width: 816, height: 1056 }); // 8.5×11 at 96 DPI in CSS px
      await page.goto(flyerUrl, { waitUntil: 'networkidle' });
      await page.pdf({
        path: pdfOut,
        format: 'Letter',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      await ctx.close();
      console.log(`✅  PDF  → ${pdfOut}`);
    }

    // ── PNG ─────────────────────────────────────────────────────────────
    // Viewport is the correct CSS-pixel size of an 8.5×11 page at 96 DPI.
    // deviceScaleFactor 3.125 scales to exactly 2550×3300 physical pixels
    // (300 DPI). Previous code used 850×1100 viewport which added 44px of
    // empty space at the bottom because 11in = 1056 CSS px, not 1100.
    if (doPng) {
      const ctx = await browser.newContext({ deviceScaleFactor: DPR });
      const page = await ctx.newPage();
      await page.setViewportSize({ width: CSS_W, height: CSS_H });
      await page.goto(flyerUrl, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: pngOut,
        fullPage: false,
        clip: { x: 0, y: 0, width: CSS_W, height: CSS_H },
        scale: 'device',
      });
      await ctx.close();
      console.log(`✅  PNG  → ${pngOut}  (${WIDTH_PX}×${HEIGHT_PX} px / ${TARGET_DPI} DPI)`);
    }
  } finally {
    await browser.close();
  }
})();
