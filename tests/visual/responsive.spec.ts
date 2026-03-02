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
});
