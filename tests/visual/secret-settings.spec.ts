import { test, expect } from '@playwright/test';
import { bootstrapVisualState, gotoLanding, openSecretSettings } from './utils/visual-helpers';
import { getMaxDiffPixelRatio, VISUAL_MAX_DIFF_RATIO_LENIENT } from './utils/visual-thresholds';

/**
 * Visual Regression Tests for Secret Settings Menu
 *
 * These tests capture screenshots of the secret settings menu in various states
 * to detect unintended CSS or visual changes.
 */

test.describe('Secret Settings Menu', () => {
  test('@smoke open settings dialog', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);
    await openSecretSettings(page);

    const modalDocument = page.getByRole('document', { name: /secret settings menu/i });
    const maxDiffPixelRatio = getMaxDiffPixelRatio(
      test.info().project.name,
      {},
      VISUAL_MAX_DIFF_RATIO_LENIENT
    );

    await expect(modalDocument).toHaveScreenshot('secret-settings-dialog.png', {
      maxDiffPixelRatio,
    });
  });

  test('@extended expected feature flags are visible', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);
    await openSecretSettings(page);

    await expect(page.getByText('Dynamic Rectangle Detection')).toBeVisible();
    await expect(page.getByText('Debug Overlay')).toBeVisible();

    const modalDocument = page.getByRole('document', { name: /secret settings menu/i });
    const maxDiffPixelRatio = getMaxDiffPixelRatio(
      test.info().project.name,
      {},
      VISUAL_MAX_DIFF_RATIO_LENIENT
    );

    await expect(modalDocument).toHaveScreenshot('secret-settings-feature-flags-visible.png', {
      maxDiffPixelRatio,
    });
  });

  test('@extended debug overlay toggle remains visible and checked', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);
    await openSecretSettings(page);

    const debugOverlayToggle = page
      .locator('label', { hasText: /debug overlay/i })
      .locator('input[type="checkbox"]');
    await expect(debugOverlayToggle).toBeVisible();
    await debugOverlayToggle.check();
    await expect(debugOverlayToggle).toBeChecked();

    const modalDocument = page.getByRole('document', { name: /secret settings menu/i });
    await modalDocument.evaluate((element) => {
      element.scrollTop = 0;
    });

    const maxDiffPixelRatio = getMaxDiffPixelRatio(
      test.info().project.name,
      {},
      VISUAL_MAX_DIFF_RATIO_LENIENT
    );

    await expect(modalDocument).toHaveScreenshot('secret-settings-debug-overlay-enabled.png', {
      maxDiffPixelRatio,
    });
  });
});
