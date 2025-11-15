import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Camera View
 *
 * These tests capture screenshots of the camera view and related UI states
 * to detect unintended CSS or visual changes.
 */

test.describe('Camera View', () => {
  test('should show active camera view layout', async ({ page }) => {
    // Grant camera permissions before navigating
    await page.context().grantPermissions(['camera']);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click the activate button (button text is "Begin")
    const activateButton = page.getByRole('button', { name: /begin/i });
    await expect(activateButton).toBeVisible();
    await activateButton.click();

    // Wait for camera view to be initialized
    await page.waitForTimeout(1500);

    // Take screenshot of active camera state
    await expect(page).toHaveScreenshot('camera-active-view.png', {
      fullPage: true,
    });
  });

  test('should show camera view at mobile viewport', async ({ page }) => {
    // Grant camera permissions
    await page.context().grantPermissions(['camera']);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click activate
    const activateButton = page.getByRole('button', { name: /begin/i });
    await activateButton.click();

    // Wait for camera view
    await page.waitForTimeout(1500);

    // Take screenshot of active camera state on mobile
    await expect(page).toHaveScreenshot('camera-active-view-mobile.png', {
      fullPage: true,
    });
  });
});
