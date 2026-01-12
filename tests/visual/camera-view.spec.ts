import { test, expect } from '@playwright/test';
import { safeGrantCameraPermissions, applyStableCameraPlaceholder } from './utils/camera';

/**
 * Visual Regression Tests for Camera View
 *
 * These tests capture screenshots of the camera view and related UI states
 * to detect unintended CSS or visual changes.
 */

test.describe('Camera View', () => {
  test('should show active camera view layout', async ({ page }) => {
    // Grant camera permissions before navigating
    await safeGrantCameraPermissions(page.context());

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click the activate button (button text is "Begin")
    const activateButton = page.getByRole('button', { name: /begin/i });
    await expect(activateButton).toBeVisible();
    await activateButton.click();

    // Wait for either camera view or permission denied state
    // In CI/headless, camera may not be available, so we check for either state
    await Promise.race([
      page
        .locator('video')
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(() => null),
      page
        .locator('text=Camera Access Required')
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(() => null),
      page
        .locator('text=Point camera at a photo to play music')
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(() => null),
    ]);

    await applyStableCameraPlaceholder(page);

    // Give a brief moment for UI to stabilize
    await page.waitForLoadState('networkidle');

    // Take screenshot of active camera state
    await expect(page).toHaveScreenshot('camera-active-view.png', {
      fullPage: true,
      timeout: 10000,
    });
  });

  test('should show camera view at mobile viewport', async ({ page }) => {
    // Grant camera permissions
    await safeGrantCameraPermissions(page.context());

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click activate
    const activateButton = page.getByRole('button', { name: /begin/i });
    await activateButton.click();

    // Wait for either camera view or permission denied state
    // In CI/headless, camera may not be available, so we check for either state
    await Promise.race([
      page
        .locator('video')
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(() => null),
      page
        .locator('text=Camera Access Required')
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(() => null),
      page
        .locator('text=Point camera at a photo to play music')
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(() => null),
    ]);

    await applyStableCameraPlaceholder(page);

    // Give a brief moment for UI to stabilize
    await page.waitForLoadState('networkidle');

    // Take screenshot of active camera state on mobile
    await expect(page).toHaveScreenshot('camera-active-view-mobile.png', {
      fullPage: true,
      timeout: 10000,
    });
  });
});
