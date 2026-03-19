import { test, expect } from '@playwright/test';
import { safeGrantCameraPermissions } from './utils/camera';
import { bootstrapVisualState, gotoLanding } from './utils/visual-helpers';
import { getSampleByConcertId, setupFakeCamera } from './utils/fake-camera';

/**
 * End-to-End Photo Recognition Tests — Fake Camera
 *
 * These tests exercise the full recognition pipeline using pre-recorded phone
 * video clips as a fake camera feed. No real camera hardware or interactive
 * permission grants are required.
 *
 * How it works:
 *   1. setupFakeCamera() registers a Playwright route handler that serves the
 *      video from assets/test-videos/phone-samples/ and injects a browser-side
 *      script that overrides getUserMedia + optionally seeds the pHash.
 *   2. The app receives frames from the canvas.captureStream() exactly as it
 *      would from a real camera, and the recognition worker runs normally.
 *   3. A successful match sets html[data-state="matched"] and reveals the
 *      band name in an h2.
 *
 * canvas.captureStream() is only supported in Chromium — skip on other browsers.
 */
test.describe('Photo Recognition — fake camera', () => {
  // Recognition pipeline needs more time than screenshot tests:
  // page load + camera activation + frame rendering + match confirmation.
  test.setTimeout(45_000);

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'canvas.captureStream() is Chromium-only; skip on other browsers.'
  );

  test('@smoke should recognize Overcoats (concertId 16)', async ({ page }) => {
    const sample = getSampleByConcertId(16);

    // All setup must happen before page.goto() so the route handler and
    // init script are active from the first request.
    await bootstrapVisualState(page);
    await safeGrantCameraPermissions(page.context());
    await setupFakeCamera(page, sample);

    await gotoLanding(page);

    await page.getByRole('button', { name: /activate camera and begin experience/i }).click();

    // html[data-state="matched"] is set by src/utils/concert-palette.ts when the
    // recognition pipeline confirms a match. With hash seeding the match fires so
    // quickly that the "Summoning camera…" loading state may never be observed —
    // skip the intermediate waitForCameraState guard and go straight to the assertion.
    await expect(page.locator('html')).toHaveAttribute('data-state', 'matched', {
      timeout: 20_000,
    });

    // The band name appears as an h2 in InfoDisplay once matched.
    await expect(page.getByRole('heading', { name: /overcoats/i, level: 2 })).toBeVisible();
  });

  test('@extended should recognize Croy and the Boys (concertId 14)', async ({ page }) => {
    const sample = getSampleByConcertId(14);

    await bootstrapVisualState(page);
    await safeGrantCameraPermissions(page.context());
    await setupFakeCamera(page, sample);

    await gotoLanding(page);

    await page.getByRole('button', { name: /activate camera and begin experience/i }).click();

    await expect(page.locator('html')).toHaveAttribute('data-state', 'matched', {
      timeout: 20_000,
    });

    await expect(page.getByRole('heading', { name: /croy/i, level: 2 })).toBeVisible();
  });
});
