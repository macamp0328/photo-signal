import { test, expect } from '@playwright/test';
import { safeGrantCameraPermissions, applyStableCameraPlaceholder } from './utils/camera';
import { bootstrapVisualState, gotoLanding, waitForCameraState } from './utils/visual-helpers';

/**
 * Visual Regression Tests for Camera View
 *
 * These tests capture screenshots of the camera view and related UI states
 * to detect unintended CSS or visual changes.
 */

test.describe('Camera View', () => {
  test('@smoke should show camera activation state', async ({ page }) => {
    await bootstrapVisualState(page);
    await safeGrantCameraPermissions(page.context());

    await gotoLanding(page);

    const activateButton = page.getByRole('button', {
      name: /activate camera and begin experience/i,
    });
    await expect(activateButton).toBeVisible();
    await activateButton.click();
    await waitForCameraState(page);

    await applyStableCameraPlaceholder(page);
    await page.waitForLoadState('networkidle');
    const videoMask = page.locator('video');

    await expect(page).toHaveScreenshot('camera-activation-state.png', {
      fullPage: true,
      timeout: 10000,
      mask: [videoMask],
    });
  });
});
