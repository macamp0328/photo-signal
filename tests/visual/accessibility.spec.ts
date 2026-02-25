import { test, expect } from '@playwright/test';
import { bootstrapVisualState, gotoLanding, openSecretSettings } from './utils/visual-helpers';
import { getMaxDiffPixelRatio, VISUAL_MAX_DIFF_RATIO_LENIENT } from './utils/visual-thresholds';

/**
 * Visual Regression Tests for Accessibility
 *
 * These tests capture screenshots of accessibility features
 * to detect regressions in focus states, contrast, and other
 * accessibility-related visual elements.
 */

test.describe('Accessibility', () => {
  test('@extended visible focus ring on begin CTA', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);

    const beginButton = page.getByRole('button', {
      name: /activate camera and begin experience/i,
    });
    await beginButton.focus();

    await expect(beginButton).toHaveScreenshot('a11y-focus-begin-button.png');
  });

  test('@extended secret settings in high-contrast mode', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);
    await openSecretSettings(page);

    await page.emulateMedia({ forcedColors: 'active' });
    const maxDiffPixelRatio = getMaxDiffPixelRatio(test.info().project.name, {
      chromium: VISUAL_MAX_DIFF_RATIO_LENIENT,
      'Mobile Chrome': VISUAL_MAX_DIFF_RATIO_LENIENT,
    });

    await expect(page.getByRole('dialog')).toHaveScreenshot('a11y-settings-high-contrast.png', {
      maxDiffPixelRatio,
    });
  });

  test('@extended reduced motion landing state', async ({ page }) => {
    await bootstrapVisualState(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoLanding(page);

    await expect(page).toHaveScreenshot('a11y-reduced-motion-landing.png', {
      fullPage: true,
    });
  });
});
