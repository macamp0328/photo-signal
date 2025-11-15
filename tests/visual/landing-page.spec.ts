import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Gallery Landing Page
 *
 * These tests capture screenshots of the landing page (inactive state)
 * to detect unintended CSS or visual changes.
 */

test.describe('Gallery Landing Page', () => {
  test('should render landing page correctly', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for the main heading to be visible
    await expect(page.getByRole('heading', { name: /photo signal/i })).toBeVisible();

    // Take a screenshot of the entire page
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
    });
  });

  test('should render landing page at mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the main heading to be visible
    await expect(page.getByRole('heading', { name: /photo signal/i })).toBeVisible();

    // Take a screenshot at mobile size
    await expect(page).toHaveScreenshot('landing-page-mobile.png', {
      fullPage: true,
    });
  });

  test('should render landing page at tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the main heading to be visible
    await expect(page.getByRole('heading', { name: /photo signal/i })).toBeVisible();

    // Take a screenshot at tablet size
    await expect(page).toHaveScreenshot('landing-page-tablet.png', {
      fullPage: true,
    });
  });
});
