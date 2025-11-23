import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Responsive Design
 *
 * These tests capture screenshots at various viewport sizes
 * to detect responsive design regressions and ensure the UI
 * adapts properly to different screen sizes.
 */

test.describe('Responsive Design', () => {
  test('desktop viewport - 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take full page screenshot at desktop resolution
    await expect(page).toHaveScreenshot('responsive-desktop-1920x1080.png', {
      fullPage: true,
    });
  });

  test('tablet viewport - 768x1024 (portrait)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot at tablet portrait resolution
    await expect(page).toHaveScreenshot('responsive-tablet-768x1024.png', {
      fullPage: true,
    });
  });

  test('tablet viewport - 1024x768 (landscape)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot at tablet landscape resolution
    await expect(page).toHaveScreenshot('responsive-tablet-1024x768.png', {
      fullPage: true,
    });
  });

  test('mobile viewport - 375x667 (portrait)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot at mobile portrait resolution (iPhone SE)
    await expect(page).toHaveScreenshot('responsive-mobile-375x667.png', {
      fullPage: true,
    });
  });

  test('mobile viewport - 667x375 (landscape)', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot at mobile landscape resolution
    await expect(page).toHaveScreenshot('responsive-mobile-667x375.png', {
      fullPage: true,
    });
  });

  test('small mobile - 320x568', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot at small mobile resolution (iPhone 5/SE)
    await expect(page).toHaveScreenshot('responsive-small-mobile-320x568.png', {
      fullPage: true,
    });
  });

  test('large desktop - 2560x1440', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot at large desktop resolution (2K)
    await expect(page).toHaveScreenshot('responsive-desktop-2560x1440.png', {
      fullPage: true,
    });
  });

  test('secret settings - responsive mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Verify menu fits viewport on mobile
    await expect(page).toHaveScreenshot('responsive-secret-settings-mobile-375.png', {
      fullPage: true,
    });
  });

  test('secret settings - responsive tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Verify menu fits viewport on tablet
    await expect(page).toHaveScreenshot('responsive-secret-settings-tablet-768.png', {
      fullPage: true,
    });
  });

  test('secret settings - responsive desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Verify menu layout on desktop
    await expect(page).toHaveScreenshot('responsive-secret-settings-desktop-1920.png', {
      fullPage: true,
    });
  });

  test('camera view - responsive mobile', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await context.grantPermissions(['camera']);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Activate camera
    const activateButton = page.getByRole('button', { name: /begin/i });
    await activateButton.click();

    // Wait for camera view or permission state
    await Promise.race([
      page
        .locator('video')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
      page
        .locator('text=Camera Access Required')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
      page
        .locator('text=Point camera')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
    ]);

    await page.waitForLoadState('networkidle');

    // Take snapshot of camera view on mobile
    await expect(page).toHaveScreenshot('responsive-camera-view-mobile.png', {
      fullPage: true,
    });
  });

  test('camera view - responsive desktop', async ({ page, context }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await context.grantPermissions(['camera']);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Activate camera
    const activateButton = page.getByRole('button', { name: /begin/i });
    await activateButton.click();

    // Wait for camera view or permission state
    await Promise.race([
      page
        .locator('video')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
      page
        .locator('text=Camera Access Required')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
      page
        .locator('text=Point camera')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
    ]);

    await page.waitForLoadState('networkidle');

    // Take snapshot of camera view on desktop
    await expect(page).toHaveScreenshot('responsive-camera-view-desktop.png', {
      fullPage: true,
    });
  });
});
