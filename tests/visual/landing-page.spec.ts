import { test, expect } from '@playwright/test';
import { bootstrapVisualState, gotoLanding, gotoPowerGate } from './utils/visual-helpers';

/**
 * Visual Regression Tests for Gallery Landing Page
 *
 * These tests capture screenshots of the landing page (inactive state)
 * to detect unintended CSS or visual changes.
 */

test.describe('Gallery Landing Page', () => {
  test('@smoke should render turn-on gate shell', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoPowerGate(page);

    await expect(page).toHaveScreenshot('power-gate-shell.png', {
      fullPage: true,
    });
  });

  test('@smoke should render landing shell', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);

    await expect(page).toHaveScreenshot('landing-shell.png', {
      fullPage: true,
    });
  });

  test('@extended should keep begin CTA styling stable', async ({ page }) => {
    await bootstrapVisualState(page);
    await gotoLanding(page);

    const beginButton = page.getByRole('button', { name: /activate camera and begin experience/i });
    await expect(beginButton).toHaveScreenshot('landing-begin-button.png');
  });
});
