import { test, expect } from '@playwright/test';
import { applyStableCameraPlaceholder } from './utils/camera';
import { bootstrapVisualState, gotoLanding, waitForCameraState } from './utils/visual-helpers';

/**
 * Visual Regression Tests for Error States
 *
 * These tests capture screenshots of various error states and messages
 * to detect unintended CSS or visual changes in error handling UI.
 */

test.describe('Error States', () => {
  test('@smoke camera permission fallback is visible', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);

    const activateButton = page.getByRole('button', {
      name: /activate camera and begin experience/i,
    });
    await activateButton.click();
    await waitForCameraState(page);

    await applyStableCameraPlaceholder(page);
    await page.waitForLoadState('networkidle');

    const videoMask = page.locator('video');

    await expect(page).toHaveScreenshot('error-camera-permission-or-active-state.png', {
      fullPage: true,
      timeout: 10000,
      mask: [videoMask],
    });
  });

  test('@smoke network error fallback state', async ({ page }) => {
    await bootstrapVisualState(page);

    await page.route('**/data.app.v2.json', (route) => {
      route.abort('failed');
    });

    await gotoLanding(page);
    await expect(
      page.getByRole('button', { name: /activate camera and begin experience/i })
    ).toBeVisible();

    await expect(page).toHaveScreenshot('error-network-data-load.png', {
      fullPage: true,
    });
  });

  test('@extended empty data state remains stable', async ({ page }) => {
    await bootstrapVisualState(page);

    await page.route('**/data.app.v2.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: 2, artists: [], photos: [], tracks: [], entries: [] }),
      });
    });

    await gotoLanding(page);
    await expect(
      page.getByRole('button', { name: /activate camera and begin experience/i })
    ).toBeVisible();

    await expect(page).toHaveScreenshot('error-empty-data-state.png', {
      fullPage: true,
    });
  });
});
