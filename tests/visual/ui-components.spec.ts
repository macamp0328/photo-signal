import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for UI Components
 *
 * These tests capture screenshots of various UI components and states
 * to detect unintended CSS or visual changes.
 */

test.describe('UI Components', () => {
  test.describe('Theme Variations', () => {
    test('should render with default theme', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Take screenshot with default theme
      await expect(page).toHaveScreenshot('theme-default.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Layout and Responsive Design', () => {
    test('should render correctly at small mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('responsive-small-mobile.png', {
        fullPage: true,
      });
    });

    test('should render correctly at landscape tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('responsive-landscape-tablet.png', {
        fullPage: true,
      });
    });

    test('should render correctly at desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('responsive-desktop.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Interactive Elements', () => {
    test('should show hover state on begin button', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Find the activate button
      const activateButton = page.getByRole('button', { name: /begin/i });

      // Hover over the button
      await activateButton.hover();

      // Wait for hover animations to complete by waiting for load state
      // This ensures any CSS transitions are fully applied
      await page.waitForLoadState('networkidle');

      // Take screenshot with hover state
      await expect(page).toHaveScreenshot('button-hover-state.png');
    });
  });
});
