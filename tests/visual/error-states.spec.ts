import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Error States
 *
 * These tests capture screenshots of various error states and messages
 * to detect unintended CSS or visual changes in error handling UI.
 */

test.describe('Error States', () => {
  test('camera permission denied', async ({ page }) => {
    // Start with a clean page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click the activate button to trigger camera request
    const activateButton = page.getByRole('button', { name: /begin/i });

    // In headless mode, this will show the permission state
    await activateButton.click();

    // Wait for either camera view or permission denied state
    await Promise.race([
      page
        .locator('text=Camera Access Required')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
      page
        .locator('text=camera')
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null),
      page.waitForTimeout(3000),
    ]);

    // Take snapshot of permission state
    await expect(page).toHaveScreenshot('error-camera-permission.png', {
      fullPage: true,
    });
  });

  test('network error - data loading failed', async ({ page }) => {
    // Mock network error for data.json
    await page.route('**/data.json', (route) => {
      route.abort('failed');
    });

    await page.goto('/');

    // Wait for page to attempt loading data
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take snapshot showing network error state
    await expect(page).toHaveScreenshot('error-network-failed.png', {
      fullPage: true,
    });
  });

  test('no concerts found - empty data', async ({ page }) => {
    // Mock empty concert data
    await page.route('**/data.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ concerts: [] }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot showing empty data state
    await expect(page).toHaveScreenshot('error-no-concerts.png', {
      fullPage: true,
    });
  });

  test('audio playback error - file not found', async ({ page }) => {
    // Mock concert data but fail audio file loading
    await page.route('**/data.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concerts: [
            {
              id: 1,
              band: 'Test Band',
              venue: 'Test Venue',
              date: '2023-01-01',
              audioFile: '/audio/nonexistent.opus',
            },
          ],
        }),
      });
    });

    // Abort all audio file requests
    await page.route('**/audio/*.opus', (route) => {
      route.abort('failed');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot (may show normal state, as audio errors might be silent)
    await expect(page).toHaveScreenshot('error-audio-failed.png', {
      fullPage: true,
    });
  });

  test('mobile viewport - error states', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Mock network error
    await page.route('**/data.json', (route) => {
      route.abort('failed');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take snapshot of error state on mobile
    await expect(page).toHaveScreenshot('error-mobile.png', {
      fullPage: true,
    });
  });
});
