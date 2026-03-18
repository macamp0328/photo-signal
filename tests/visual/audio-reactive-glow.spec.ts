import { test, expect } from '@playwright/test';
import { safeGrantCameraPermissions, applyStableCameraPlaceholder } from './utils/camera';
import { bootstrapVisualState, gotoLanding, waitForCameraState } from './utils/visual-helpers';

/**
 * Visual Regression Tests for --glow-reactive-scale CSS variable consumption.
 *
 * useAudioReactiveGlow modulates --glow-reactive-scale on :root in a rAF loop
 * driven by bass energy. The CSS variable is consumed in .signalDot, .signalBand,
 * and .bandName — all of which only render in matched state (requires activeConcert).
 *
 * Since Playwright cannot trigger photo recognition, these tests inject a probe
 * element that replicates the exact text-shadow pattern from .signalDot (App.module.css):
 *   text-shadow:
 *     0 0 calc(6px * var(--glow-reactive-scale)) <accent>,
 *     0 0 calc(16px * var(--glow-reactive-scale)) <glow-soft>;
 *
 * The CSS var is then set to the hook's min (0.85) and max (1.20) values and
 * snapshotted. The two baseline images will differ visually, proving the var chain
 * is intact. Any regression that removes the var from a consuming CSS rule, or
 * that breaks the property cascade, will diverge from baseline.
 *
 * Unit tests in useAudioReactiveGlow.test.ts prove the JS side sets the var;
 * these tests prove the CSS side resolves it correctly in the browser.
 */

const PROBE_TESTID = 'glow-probe';

async function injectGlowProbe(page: Parameters<typeof bootstrapVisualState>[0]): Promise<void> {
  // Replicate the two-layer text-shadow from .signalDot in App.module.css.
  // Uses --signal-glow and --signal-glow-soft which are set by the concert palette
  // on :root. Fall back to known accent colours so the probe is visible even
  // without an active match/palette.
  await page.evaluate((testId) => {
    const probe = document.createElement('div');
    probe.setAttribute('data-testid', testId);
    probe.style.cssText = [
      'position: fixed',
      'bottom: 40px',
      'left: 50%',
      'transform: translateX(-50%)',
      'font-size: 2rem',
      // Use the same calc() pattern as .signalDot
      'text-shadow:' +
        '0 0 calc(6px * var(--glow-reactive-scale)) var(--signal-glow, #60a5fa),' +
        '0 0 calc(16px * var(--glow-reactive-scale)) var(--signal-glow-soft, rgba(96,165,250,0.4))',
      'color: var(--color-accent, #60a5fa)',
      'font-family: monospace',
      'z-index: 9999',
      'pointer-events: none',
      // Stable background so the glow is legible in CI screenshots
      'padding: 8px 12px',
      'background: rgba(0,0,0,0.6)',
      'border-radius: 4px',
    ].join('; ');
    probe.textContent = '○';
    document.body.appendChild(probe);
  }, PROBE_TESTID);
}

async function activateAndInjectProbe(
  page: Parameters<typeof bootstrapVisualState>[0]
): Promise<void> {
  await bootstrapVisualState(page, {
    featureFlags: { 'audio-reactive-glow': true },
  });
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

  await injectGlowProbe(page);
}

test.describe('Audio-Reactive Glow CSS variable', () => {
  test('glow probe renders at minimum scale (0.85) — tight text-shadow', async ({ page }) => {
    await activateAndInjectProbe(page);

    await page.evaluate(() => {
      document.documentElement.style.setProperty('--glow-reactive-scale', '0.850');
    });

    const probe = page.locator(`[data-testid="${PROBE_TESTID}"]`);
    await expect(probe).toBeVisible();

    await expect(probe).toHaveScreenshot('glow-scale-min.png');
  });

  test('glow probe renders at maximum scale (1.20) — expanded text-shadow', async ({ page }) => {
    await activateAndInjectProbe(page);

    await page.evaluate(() => {
      document.documentElement.style.setProperty('--glow-reactive-scale', '1.200');
    });

    const probe = page.locator(`[data-testid="${PROBE_TESTID}"]`);
    await expect(probe).toBeVisible();

    await expect(probe).toHaveScreenshot('glow-scale-max.png');
  });
});
