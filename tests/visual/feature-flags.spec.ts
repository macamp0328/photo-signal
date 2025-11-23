import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Feature Flag Variations
 *
 * These tests capture screenshots of the UI with various feature flags enabled
 * to detect visual regressions when feature flags change the UI behavior.
 */

test.describe('Feature Flag Variations', () => {
  test('debug overlay enabled', async ({ page }) => {
    // Set feature flag in localStorage before page load
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'debug-overlay': true,
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot with debug overlay
    await expect(page).toHaveScreenshot('feature-debug-overlay.png', {
      fullPage: true,
    });
  });

  test('psychedelic mode enabled', async ({ page }) => {
    // Enable psychedelic mode via localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'psychedelic-mode': true,
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot with psychedelic effects
    await expect(page).toHaveScreenshot('feature-psychedelic-mode.png', {
      fullPage: true,
    });
  });

  test('gallery layout enabled', async ({ page }) => {
    // Enable gallery layout via localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'gallery-layout': true,
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot with gallery layout
    await expect(page).toHaveScreenshot('feature-gallery-layout.png', {
      fullPage: true,
    });
  });

  test('test mode enabled', async ({ page }) => {
    // Enable test mode via localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'test-mode': true,
        })
      );
    });

    // Mock test data if needed
    await page.route('**/assets/test-data/concerts.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concerts: [
            {
              id: 1,
              band: 'Test Mode Band',
              venue: 'Test Mode Venue',
              date: '2023-01-01',
              audioFile: '/audio/test.opus',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot with test mode
    await expect(page).toHaveScreenshot('feature-test-mode.png', {
      fullPage: true,
    });
  });

  test('retro sounds enabled', async ({ page }) => {
    // Enable retro sounds via localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'retro-sounds': true,
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot (visual effects may not be visible)
    await expect(page).toHaveScreenshot('feature-retro-sounds.png', {
      fullPage: true,
    });
  });

  test('multiple flags - psychedelic + debug', async ({ page }) => {
    // Enable multiple feature flags
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'psychedelic-mode': true,
          'debug-overlay': true,
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot with multiple flags enabled
    await expect(page).toHaveScreenshot('feature-multiple-flags.png', {
      fullPage: true,
    });
  });

  test('feature flags - secret settings interaction', async ({ page }) => {
    // Enable a flag via localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'debug-overlay': true,
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings to see flag state
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Take snapshot showing flags in settings UI
    await expect(page).toHaveScreenshot('feature-flags-in-settings.png', {
      fullPage: true,
    });
  });

  test('mobile - feature flags enabled', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Enable feature flags
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'psychedelic-mode': true,
        })
      );
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot on mobile with flags
    await expect(page).toHaveScreenshot('feature-flags-mobile.png', {
      fullPage: true,
    });
  });
});
