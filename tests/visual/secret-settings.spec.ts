import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Secret Settings Menu
 *
 * These tests capture screenshots of the secret settings menu in various states
 * to detect unintended CSS or visual changes.
 */

test.describe('Secret Settings Menu', () => {
  test('closed state - should be invisible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify secret settings not visible by default
    // The menu should not be visible on initial page load
    await expect(page).toHaveScreenshot('secret-settings-closed.png', {
      fullPage: true,
    });
  });

  test('open state - should display all sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Triple-tap the body to open secret settings
    // This is the activation gesture for the secret menu
    const body = page.locator('body');
    await body.click({ clickCount: 3 });

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Take snapshot of open menu
    await expect(page).toHaveScreenshot('secret-settings-open.png', {
      fullPage: true,
    });
  });

  test('feature flags - test mode enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Find and enable Test Mode flag
    // Look for label containing "Test Mode" and click its checkbox
    const testModeLabel = page.locator('label:has-text("Test Mode")');
    const testModeCheckbox = testModeLabel.locator('input[type="checkbox"]');
    await testModeCheckbox.click();

    // Wait a moment for any visual changes
    await page.waitForTimeout(200);

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-test-mode-on.png', {
      fullPage: true,
    });
  });

  test('feature flags - psychedelic mode enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Find and enable Psychedelic Mode flag
    const psychedelicLabel = page.locator('label:has-text("Psychedelic Mode")');
    const psychedelicCheckbox = psychedelicLabel.locator('input[type="checkbox"]');
    await psychedelicCheckbox.click();

    // Wait for visual changes
    await page.waitForTimeout(200);

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-psychedelic-on.png', {
      fullPage: true,
    });
  });

  test('custom settings - motion threshold slider', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Find motion threshold slider (looking for a range input)
    // This may need adjustment based on actual implementation
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();

    if (count > 0) {
      // Adjust first slider to 50%
      const firstSlider = sliders.first();
      await firstSlider.fill('50');
      await page.waitForTimeout(200);
    }

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-slider-50.png', {
      fullPage: true,
    });
  });

  test('retro sounds - visual feedback', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Find and enable retro sounds flag if it exists
    const retroLabel = page.locator('label:has-text("Retro Sounds")');
    const retroExists = (await retroLabel.count()) > 0;

    if (retroExists) {
      const retroCheckbox = retroLabel.locator('input[type="checkbox"]');
      await retroCheckbox.click();
      await page.waitForTimeout(200);
    }

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-retro-sound.png', {
      fullPage: true,
    });
  });

  test('mobile viewport - secret settings menu', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Take snapshot of menu on mobile
    await expect(page).toHaveScreenshot('secret-settings-mobile.png', {
      fullPage: true,
    });
  });
});
