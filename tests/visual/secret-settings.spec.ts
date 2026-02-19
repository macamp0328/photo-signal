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

    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveScreenshot('secret-settings-dialog.png');
  });

  test('@extended test mode toggle remains visible and checked', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);
    await openSecretSettings(page);

    const testModeToggle = page
      .locator('label', { hasText: /test data mode/i })
      .locator('input[type="checkbox"]');
    await expect(testModeToggle).toBeVisible();
    await testModeToggle.check();
    await expect(testModeToggle).toBeChecked();

    const dialog = page.getByRole('dialog');
    const maxDiffPixelRatio = getMaxDiffPixelRatio(
      test.info().project.name,
      {},
      VISUAL_MAX_DIFF_RATIO_LENIENT
    );

    await expect(dialog).toHaveScreenshot('secret-settings-test-mode-enabled.png', {
      maxDiffPixelRatio,
    });
  });
});
