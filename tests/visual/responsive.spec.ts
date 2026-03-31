import { test, expect } from '@playwright/test';
import { bootstrapVisualState, gotoLanding, openSecretSettings } from './utils/visual-helpers';
import { VISUAL_MAX_DIFF_RATIO_LENIENT } from './utils/visual-thresholds';

/**
 * Visual Regression Tests for Responsive Design
 *
 * These tests capture screenshots at various viewport sizes
 * to detect responsive design regressions and ensure the UI
 * adapts properly to different screen sizes.
 */

test.describe('Responsive Design', () => {
  test('@extended small mobile viewport baseline (320x568)', async ({ page }) => {
    await bootstrapVisualState(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoLanding(page);

    await expect(page).toHaveScreenshot('responsive-mobile-320x568.png', {
      fullPage: true,
    });
  });

  test('@extended secret settings layout on small mobile', async ({ page }) => {
    await bootstrapVisualState(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoLanding(page);
    await openSecretSettings(page);

    await expect(page.getByRole('dialog')).toHaveScreenshot('responsive-settings-320x568.png', {
      maxDiffPixelRatio: VISUAL_MAX_DIFF_RATIO_LENIENT,
    });
  });

  test('@extended EXIF line is always visible including at 360px', async ({ page }) => {
    await bootstrapVisualState(page);
    await page.setViewportSize({ width: 360, height: 640 });
    await gotoLanding(page);

    // Extract the actual hashed CSS Module class name for .exif from the loaded stylesheets.
    // The .exif rule should never set display: none — all text fields are always visible.
    const exifClassName = await page.evaluate((): string | null => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && /exif/i.test(rule.selectorText)) {
              return rule.selectorText.replace(/^\./, '');
            }
          }
        } catch {
          // cross-origin or opaque sheet — skip
        }
      }
      return null;
    });

    expect(exifClassName).not.toBeNull();

    // Inject a probe element that picks up the .exif CSS Module rule.
    await page.evaluate((cls) => {
      const probe = document.createElement('p');
      probe.className = cls as string;
      probe.textContent = 'f/2.8  1/250s  ISO 800';
      probe.setAttribute('data-testid', 'exif-probe');
      document.body.appendChild(probe);
    }, exifClassName);

    // At 360px the EXIF line must be visible — it is never hidden regardless of viewport width.
    const display360 = await page
      .locator('[data-testid="exif-probe"]')
      .evaluate((el) => getComputedStyle(el).display);
    expect(display360).not.toBe('none');

    // At 361px it must also be visible.
    await page.setViewportSize({ width: 361, height: 640 });
    const display361 = await page
      .locator('[data-testid="exif-probe"]')
      .evaluate((el) => getComputedStyle(el).display);
    expect(display361).not.toBe('none');
  });
});
