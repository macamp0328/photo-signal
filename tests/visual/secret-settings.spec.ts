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

    // Find and enable Test Data Mode flag (not Test Mode)
    const testModeLabel = page.locator('label:has-text("Test Data Mode")');
    const exists = (await testModeLabel.count()) > 0;

    if (exists) {
      const testModeCheckbox = testModeLabel.locator('input[type="checkbox"]');
      await testModeCheckbox.click();
      await page.waitForTimeout(200);
    }

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-test-mode-on.png', {
      fullPage: true,
    });
  });

  test('feature flags - debug overlay enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Find and enable Debug Overlay if it exists
    const debugLabel = page.locator('label:has-text("Debug Overlay")');
    const exists = (await debugLabel.count()) > 0;

    if (exists) {
      const debugCheckbox = debugLabel.locator('input[type="checkbox"]');
      await debugCheckbox.click();
      await page.waitForTimeout(200);
    }

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-debug-overlay.png', {
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
    // Use evaluate to set the slider value instead of fill()
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();

    if (count > 0) {
      // Adjust first slider to middle value using evaluate
      const firstSlider = sliders.first();
      await firstSlider.evaluate((el: HTMLInputElement) => {
        el.value = '2750'; // Middle of range 500-5000
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
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
