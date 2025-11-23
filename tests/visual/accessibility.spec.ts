import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Accessibility
 *
 * These tests capture screenshots of accessibility features
 * to detect regressions in focus states, contrast, and other
 * accessibility-related visual elements.
 */

test.describe('Accessibility', () => {
  test('focus states - first interactive element', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Wait for focus to be applied
    await page.waitForTimeout(200);

    // Take snapshot showing focus ring on first element
    await expect(page).toHaveScreenshot('a11y-focus-first-element.png', {
      fullPage: true,
    });
  });

  test('focus states - second interactive element', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to first element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Tab to second element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Take snapshot showing focus ring on second element
    await expect(page).toHaveScreenshot('a11y-focus-second-element.png', {
      fullPage: true,
    });
  });

  test('focus states - secret settings interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Tab to first focusable element within dialog
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Take snapshot showing focus within modal
    await expect(page).toHaveScreenshot('a11y-focus-secret-settings-first.png', {
      fullPage: true,
    });
  });

  test('focus states - keyboard navigation through settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Tab through several elements
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Take snapshot showing focus state after multiple tabs
    await expect(page).toHaveScreenshot('a11y-focus-settings-navigation.png', {
      fullPage: true,
    });
  });

  test('high contrast mode - emulated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enable high contrast mode via forced colors
    await page.emulateMedia({ forcedColors: 'active' });
    await page.waitForTimeout(300);

    // Take snapshot with high contrast mode
    await expect(page).toHaveScreenshot('a11y-high-contrast.png', {
      fullPage: true,
    });
  });

  test('high contrast mode - secret settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Enable high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    await page.waitForTimeout(300);

    // Take snapshot of settings in high contrast
    await expect(page).toHaveScreenshot('a11y-high-contrast-settings.png', {
      fullPage: true,
    });
  });

  test('reduced motion - prefers reduced motion', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enable prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(200);

    // Take snapshot
    await expect(page).toHaveScreenshot('a11y-reduced-motion.png', {
      fullPage: true,
    });
  });

  test('aria labels - visible focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for aria-label on activate button
    const activateButton = page.getByRole('button', { name: /begin/i });

    // Focus the button to show focus indicator
    await activateButton.focus();
    await page.waitForTimeout(200);

    // Take snapshot showing focused button with aria-label
    await expect(page).toHaveScreenshot('a11y-aria-labels-button.png', {
      fullPage: true,
    });
  });

  test('mobile accessibility - touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot to verify touch target sizes on mobile
    await expect(page).toHaveScreenshot('a11y-mobile-touch-targets.png', {
      fullPage: true,
    });
  });

  test('screen reader - semantic structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open secret settings to see dialog role
    await page.locator('body').click({ clickCount: 3 });
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Verify dialog has proper role (should be visible in snapshot)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Take snapshot showing semantic structure
    await expect(page).toHaveScreenshot('a11y-semantic-structure.png', {
      fullPage: true,
    });
  });
});
